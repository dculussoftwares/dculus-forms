import { Readable } from 'stream';
import type { ReadableStream as NodeWebReadableStream } from 'stream/web';
import { downloadZip } from 'client-zip';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import { createGraphQLError } from '../../lib/graphqlErrors.js';
import { audit } from '../../lib/audit.js';
import { logger } from '../../lib/logger.js';
import { formRepository, responseFileExportRepository } from '../../repositories/index.js';
import { openFileStream } from '../fileUploadService.js';
import {
  TEMP_FILE_TTL_MS,
  getTemporaryFileDownloadUrl,
  getTemporaryFileExpiry,
  uploadTemporaryStream,
} from '../temporaryFileService.js';
import { collectResponseFiles, type ResponseFileEntry, type ResponseFileQuery } from './responseFileCatalog.js';
import {
  archiveRootName,
  buildManifestCsv,
  planZipEntries,
  type ResponseFileGrouping,
  type ZipEntryPlan,
} from './zipLayout.js';

/**
 * "Download respondent files as a ZIP". The archive is assembled as a stream —
 * each file is piped from the private bucket through the ZIP writer straight
 * into a multipart upload under temp-exports/ — so memory stays flat whatever
 * the export size. Runs fire-and-forget like PdfGenerationRun; the client polls
 * the job row and asks for a short-lived download link once it completes.
 */

export const MAX_EXPORT_FILES = 5000;
export const MAX_EXPORT_BYTES = 5 * 1024 ** 3;
export const MAX_EXPORTS_PER_HOUR = 10;
// A running job touches updatedAt on this interval (and on every progress write),
// so only a job that really died can look this stale — even mid-way through one
// very large file.
const HEARTBEAT_INTERVAL_MS = 30 * 1000;
const STALLED_THRESHOLD_MS = 15 * 60 * 1000;
const PROGRESS_EVERY_N_FILES = 10;
const ZIP_KEY_NAME = 'response-files.zip';

type ExportRow = NonNullable<Awaited<ReturnType<typeof responseFileExportRepository.findById>>>;

export interface StartResponseFileExportInput {
  formId: string;
  userId: string;
  grouping: ResponseFileGrouping;
  query: ResponseFileQuery;
}

const failStalled = async (row: ExportRow): Promise<ExportRow> => {
  if (row.status !== 'running' || Date.now() - row.updatedAt.getTime() < STALLED_THRESHOLD_MS) {
    return row;
  }
  return responseFileExportRepository.update(row.id, {
    status: 'failed',
    errorMessage: 'The export stopped unexpectedly. Please start it again.',
    completedAt: new Date(),
  });
};

export const startResponseFileExport = async ({
  formId,
  userId,
  grouping,
  query,
}: StartResponseFileExportInput): Promise<ExportRow> => {
  // One export at a time per person and form: re-requesting resumes the
  // in-flight one instead of queueing duplicates.
  const running = await responseFileExportRepository.findRunning(formId, userId);
  if (running) {
    const current = await failStalled(running);
    if (current.status === 'running') return current;
  }

  const recentCount = await responseFileExportRepository.countByRequesterSince(
    userId,
    new Date(Date.now() - 60 * 60 * 1000)
  );
  if (recentCount >= MAX_EXPORTS_PER_HOUR) {
    throw createGraphQLError(
      `You can start up to ${MAX_EXPORTS_PER_HOUR} file downloads per hour. Please try again later.`,
      GRAPHQL_ERROR_CODES.RATE_LIMITED
    );
  }

  const { files } = await collectResponseFiles(formId, query);
  if (files.length === 0) {
    throw createGraphQLError('There are no files to download for these responses', GRAPHQL_ERROR_CODES.NOT_FOUND);
  }
  const totalBytes = files.reduce((sum, file) => sum + (file.size ?? 0), 0);
  if (files.length > MAX_EXPORT_FILES || totalBytes > MAX_EXPORT_BYTES) {
    throw createGraphQLError(
      `A download can hold up to ${MAX_EXPORT_FILES.toLocaleString()} files and 5 GB. Narrow the responses with filters and try again.`,
      GRAPHQL_ERROR_CODES.EXPORT_TOO_LARGE
    );
  }

  const form = await formRepository.findUnique({ where: { id: formId }, select: { title: true } });
  const root = archiveRootName(form?.title ?? 'form');

  let row: ExportRow;
  try {
    row = await responseFileExportRepository.create({
      formId,
      requestedById: userId,
      status: 'running',
      grouping,
      totalCount: files.length,
      totalBytes: BigInt(totalBytes),
      filename: `${root}.zip`,
    });
  } catch (error) {
    // A partial unique index allows one running export per person and form, so
    // a concurrent request that lost the race resumes the winner's export.
    const existing = (error as { code?: string })?.code === 'P2002'
      ? await responseFileExportRepository.findRunning(formId, userId)
      : null;
    if (!existing) throw error;
    return existing;
  }

  await audit('responseFiles.exportRequested', 'Form', formId, userId, {
    exportId: row.id,
    grouping,
    fileCount: files.length,
    totalBytes,
    responseIds: query.responseIds?.length ?? null,
    filterCount: query.filters?.length ?? 0,
  });

  void runResponseFileExport(row.id, planZipEntries(files, grouping, root), root);
  return row;
};

/**
 * Feeds client-zip one entry at a time. A file that can't be opened is skipped
 * (and marked `missing` in the manifest) rather than failing the whole archive;
 * the manifest is appended last so it reflects exactly what was included.
 */
/** Passes a stream through unchanged, failing it once the export as a whole outgrows the byte cap. */
const capExportBytes = (input: ReadableStream<Uint8Array>, budget: { streamed: number }) =>
  input.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        budget.streamed += chunk.byteLength;
        if (budget.streamed > MAX_EXPORT_BYTES) {
          controller.error(new Error('Export exceeds the maximum allowed size'));
          return;
        }
        controller.enqueue(chunk);
      },
    })
  );

async function* zipInputs(exportId: string, entries: ZipEntryPlan[], root: string) {
  const missing = new Set<ResponseFileEntry>();
  const budget = { streamed: 0 };

  for (const [index, entry] of entries.entries()) {
    try {
      const input = capExportBytes(await openFileStream(entry.file.key), budget);
      yield { name: entry.path, lastModified: entry.file.submittedAt, input };
    } catch (error) {
      logger.warn(`[Response files] Skipping ${entry.file.key} in export ${exportId}:`, error);
      missing.add(entry.file);
    }

    const processed = index + 1;
    if (processed % PROGRESS_EVERY_N_FILES === 0 || processed === entries.length) {
      await responseFileExportRepository.update(exportId, { processedCount: processed });
    }
  }

  yield {
    name: `${root}/manifest.csv`,
    lastModified: new Date(),
    input: buildManifestCsv(entries, root, missing),
  };
}

export const runResponseFileExport = async (
  exportId: string,
  entries: ZipEntryPlan[],
  root: string
): Promise<void> => {
  // Time-based heartbeat: progress writes only happen between files, so one
  // large upload could otherwise look stalled while it is working fine.
  const heartbeat = setInterval(() => {
    responseFileExportRepository
      .updateIfRunning(exportId, { updatedAt: new Date() })
      .catch((error) => logger.warn(`[Response files] Heartbeat for export ${exportId} failed:`, error));
  }, HEARTBEAT_INTERVAL_MS);

  try {
    const zip = downloadZip(zipInputs(exportId, entries, root));
    if (!zip.body) throw new Error('ZIP stream could not be created');
    const body = Readable.fromWeb(zip.body as unknown as NodeWebReadableStream);
    const { fileKey } = await uploadTemporaryStream(body, ZIP_KEY_NAME, 'application/zip');

    // Only settle a job that is still running: if it was already marked failed
    // (stalled, or someone started a new one), don't resurrect it.
    await responseFileExportRepository.updateIfRunning(exportId, {
      status: 'completed',
      fileKey,
      processedCount: entries.length,
      completedAt: new Date(),
    });
  } catch (error) {
    logger.error(`[Response files] Export ${exportId} failed:`, error);
    // Own try/catch: this runs fire-and-forget, so a failed status write
    // (e.g. the form was deleted mid-export) must not escape as an
    // unhandled rejection.
    try {
      await responseFileExportRepository.updateIfRunning(exportId, {
        status: 'failed',
        errorMessage: 'Something went wrong while preparing the download. Please try again.',
        completedAt: new Date(),
      });
    } catch (updateError) {
      logger.error(`[Response files] Could not mark export ${exportId} as failed:`, updateError);
    }
  } finally {
    clearInterval(heartbeat);
  }
};

/** An export, visible only to the person who started it. */
export const getResponseFileExport = async (exportId: string, userId: string): Promise<ExportRow> => {
  const row = await responseFileExportRepository.findById(exportId);
  if (!row || row.requestedById !== userId) {
    throw createGraphQLError('Download not found', GRAPHQL_ERROR_CODES.NOT_FOUND);
  }
  return failStalled(row);
};

/**
 * Whether the finished ZIP is gone. The cleanup sweep counts its retention from
 * the moment the upload started (the timestamp in the key), which for a long
 * export is earlier than completion, so that is the clock to use.
 */
export const isExportExpired = (row: Pick<ExportRow, 'completedAt' | 'fileKey'>): boolean => {
  if (row.fileKey) {
    const expiry = getTemporaryFileExpiry(row.fileKey);
    if (expiry) return Date.now() > expiry.getTime();
  }
  return !!row.completedAt && Date.now() - row.completedAt.getTime() > TEMP_FILE_TTL_MS;
};

/**
 * Issue a 5-minute link to a finished export. The caller re-checks form access
 * first, so revoking someone's access also revokes downloads they started.
 */
export const createResponseFileExportDownload = async (
  exportId: string,
  userId: string
): Promise<{ downloadUrl: string; filename: string; expiresAt: string }> => {
  const row = await getResponseFileExport(exportId, userId);
  if (row.status !== 'completed' || !row.fileKey) {
    throw createGraphQLError('This download is not ready yet', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
  }
  if (isExportExpired(row)) {
    throw createGraphQLError('This download has expired. Please start a new one.', GRAPHQL_ERROR_CODES.NOT_FOUND);
  }

  const expiresInSeconds = 300;
  const filename = row.filename ?? ZIP_KEY_NAME;
  const downloadUrl = await getTemporaryFileDownloadUrl(row.fileKey, filename, expiresInSeconds);

  await audit('responseFiles.exportDownloaded', 'Form', row.formId, userId, {
    exportId: row.id,
    fileCount: row.totalCount,
  });

  return {
    downloadUrl,
    filename,
    expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
  };
};

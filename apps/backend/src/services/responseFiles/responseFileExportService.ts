import { Readable } from 'stream';
import type { ReadableStream as NodeWebReadableStream } from 'stream/web';
import { downloadZip } from 'client-zip';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import { createGraphQLError } from '../../lib/graphqlErrors.js';
import { audit } from '../../lib/audit.js';
import { logger } from '../../lib/logger.js';
import { formRepository, responseFileExportRepository } from '../../repositories/index.js';
import { openFileStream } from '../fileUploadService.js';
import { getTemporaryFileDownloadUrl, uploadTemporaryStream } from '../temporaryFileService.js';
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
// Temp exports are swept after 5h (temporaryFileService.cleanupExpiredFiles).
const EXPORT_RETENTION_MS = 5 * 60 * 60 * 1000;
// Progress is written every few files, so a healthy job always refreshes
// updatedAt well within this window — even while streaming one large file.
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

  const row = await responseFileExportRepository.create({
    formId,
    requestedById: userId,
    status: 'running',
    grouping,
    totalCount: files.length,
    totalBytes: BigInt(totalBytes),
    filename: `${root}.zip`,
  });

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
async function* zipInputs(exportId: string, entries: ZipEntryPlan[], root: string) {
  const missing = new Set<ResponseFileEntry>();

  for (const [index, entry] of entries.entries()) {
    try {
      const input = await openFileStream(entry.file.key);
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
  try {
    const zip = downloadZip(zipInputs(exportId, entries, root));
    if (!zip.body) throw new Error('ZIP stream could not be created');
    const body = Readable.fromWeb(zip.body as unknown as NodeWebReadableStream);
    const { fileKey } = await uploadTemporaryStream(body, ZIP_KEY_NAME, 'application/zip');

    await responseFileExportRepository.update(exportId, {
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
      await responseFileExportRepository.update(exportId, {
        status: 'failed',
        errorMessage: 'Something went wrong while preparing the download. Please try again.',
        completedAt: new Date(),
      });
    } catch (updateError) {
      logger.error(`[Response files] Could not mark export ${exportId} as failed:`, updateError);
    }
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

export const isExportExpired = (row: Pick<ExportRow, 'completedAt'>): boolean =>
  !!row.completedAt && Date.now() - row.completedAt.getTime() > EXPORT_RETENTION_MS;

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

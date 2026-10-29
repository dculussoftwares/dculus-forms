import JSZip from 'jszip';
import { GraphQLError } from 'graphql';
import { createGraphQLError } from '#graphql-errors';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import { logger } from '../lib/logger.js';
import { pdfGeneratorRepository } from '../repositories/index.js';
import { downloadFileBuffer } from './fileUploadService.js';
import { filterResultsToLiveResponses } from './pdfGeneratorService.js';

export const ZIP_LIMITS = {
  maxEntries: 500,
  maxTotalBytes: 200 * 1024 * 1024,
} as const;

const inFlightBuilds = new Set<string>();

/**
 * Bundles every successful PdfGenerationResult for a generator into a single
 * ZIP buffer — the "download all" counterpart to the per-response download
 * path. One row per (generator, response) already exists ("latest wins"), so
 * listing a generator's results already reflects the current state across
 * every run (manual or auto) — no run-scoping needed.
 */
export async function buildZipForGenerator(generatorId: string): Promise<Buffer> {
  // The archive is assembled in memory, so builds are bounded: one at a time per generator, and a
  // capped number/total size of entries (exceeding either fails with a clear, user-facing error).
  if (inFlightBuilds.has(generatorId)) {
    throw createGraphQLError(
      'A ZIP archive for this generator is already being prepared. Please try again shortly.',
      GRAPHQL_ERROR_CODES.BAD_USER_INPUT
    );
  }
  inFlightBuilds.add(generatorId);
  try {
    return await buildZip(generatorId);
  } finally {
    inFlightBuilds.delete(generatorId);
  }
}

async function buildZip(generatorId: string): Promise<Buffer> {
  const allResults = await pdfGeneratorRepository.listDownloadableResultsByGenerator(generatorId);
  // Exclude soft-deleted responses' PDFs — see filterResultsToLiveResponses.
  const results = await filterResultsToLiveResponses(allResults);

  if (results.length > ZIP_LIMITS.maxEntries) {
    throw createGraphQLError(
      `Too many PDFs to download at once (${results.length}). The limit is ${ZIP_LIMITS.maxEntries}; narrow the results or download PDFs individually.`,
      GRAPHQL_ERROR_CODES.BAD_USER_INPUT
    );
  }

  const zip = new JSZip();
  let totalBytes = 0;
  const usedNames = new Set<string>();

  for (const result of results) {
    if (!result.fileKey) continue;
    try {
      const buffer = await downloadFileBuffer(result.fileKey);
      totalBytes += buffer.length;
      if (totalBytes > ZIP_LIMITS.maxTotalBytes) {
        throw createGraphQLError(
          'The generated PDFs are too large to download as a single ZIP. Download PDFs individually instead.',
          GRAPHQL_ERROR_CODES.BAD_USER_INPUT
        );
      }
      let entryName = result.filename ?? `${result.responseId}.pdf`;
      if (usedNames.has(entryName)) {
        entryName = `${entryName.replace(/\.pdf$/i, '')}-${result.responseId}.pdf`;
      }
      usedNames.add(entryName);
      zip.file(entryName, buffer);
    } catch (error) {
      if (error instanceof GraphQLError) throw error;
      logger.warn(`Skipping ${result.fileKey} in ZIP — failed to download:`, error);
    }
  }

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

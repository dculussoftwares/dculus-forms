import JSZip from 'jszip';
import { logger } from '../lib/logger.js';
import { pdfGeneratorRepository } from '../repositories/index.js';
import { downloadFileBuffer } from './fileUploadService.js';
import { filterResultsToLiveResponses } from './pdfGeneratorService.js';

/**
 * Bundles every successful PdfGenerationResult for a generator into a single
 * ZIP buffer — the "download all" counterpart to the per-response download
 * path. One row per (generator, response) already exists ("latest wins"), so
 * listing a generator's results already reflects the current state across
 * every run (manual or auto) — no run-scoping needed.
 */
export async function buildZipForGenerator(generatorId: string): Promise<Buffer> {
  const allResults = await pdfGeneratorRepository.listDownloadableResultsByGenerator(generatorId);
  // Exclude soft-deleted responses' PDFs — see filterResultsToLiveResponses.
  const results = await filterResultsToLiveResponses(allResults);

  const zip = new JSZip();
  const usedNames = new Set<string>();

  for (const result of results) {
    if (!result.fileKey) continue;
    try {
      const buffer = await downloadFileBuffer(result.fileKey);
      let entryName = result.filename ?? `${result.responseId}.pdf`;
      if (usedNames.has(entryName)) {
        entryName = `${entryName.replace(/\.pdf$/i, '')}-${result.responseId}.pdf`;
      }
      usedNames.add(entryName);
      zip.file(entryName, buffer);
    } catch (error) {
      logger.warn(`Skipping ${result.fileKey} in ZIP — failed to download:`, error);
    }
  }

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

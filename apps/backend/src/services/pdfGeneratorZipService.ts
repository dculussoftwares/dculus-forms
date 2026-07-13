import JSZip from 'jszip';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { downloadFileBuffer } from './fileUploadService.js';

/**
 * Bundles every successful PdfGenerationResult for a generator into a single
 * ZIP buffer — the "download all" counterpart to the per-response download
 * path. One row per (generator, response) already exists ("latest wins"), so
 * listing a generator's results already reflects the current state across
 * every run (manual or auto) — no run-scoping needed.
 */
export async function buildZipForGenerator(generatorId: string): Promise<Buffer> {
  const results = await prisma.pdfGenerationResult.findMany({
    where: { generatorId, status: 'success', fileKey: { not: null } },
  });

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

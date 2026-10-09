import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import { createGraphQLError } from '../../lib/graphqlErrors.js';
import { formFileRepository, responseRepository } from '../../repositories/index.js';
import { generatePresignedDownloadUrl } from '../fileUploadService.js';
import { fileNameFromKey } from './responseFileCatalog.js';

/**
 * Types a browser can safely render inline for a preview. Anything else —
 * notably HTML and SVG, which can carry script — is always served as an
 * attachment, and the vetted type is pinned on the response so a mislabelled
 * upload cannot be sniffed into something executable.
 */
const PREVIEWABLE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
]);

const DOWNLOAD_URL_TTL_SECONDS = 300;

/**
 * Short-lived link to one respondent file, saved under its original name.
 * Only files still referenced by a live response are served: files of deleted
 * responses and uploads from abandoned submissions stay private.
 */
export const createResponseFileDownloadUrl = async (
  formId: string,
  key: string,
  { preview = false }: { preview?: boolean } = {}
): Promise<string> => {
  if (!(await responseRepository.isFileKeyReferencedRaw(formId, key))) {
    throw createGraphQLError('File not found', GRAPHQL_ERROR_CODES.NOT_FOUND);
  }

  const record = await formFileRepository.findUnique({
    where: { key },
    select: { originalName: true, mimeType: true },
  });
  const filename = record?.originalName || fileNameFromKey(key);
  const mimeType = record?.mimeType;

  if (preview && mimeType && PREVIEWABLE_MIME_TYPES.has(mimeType)) {
    return generatePresignedDownloadUrl(key, {
      expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS,
      disposition: { type: 'inline', filename },
      contentType: mimeType,
    });
  }

  return generatePresignedDownloadUrl(key, {
    expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS,
    disposition: { type: 'attachment', filename },
  });
};

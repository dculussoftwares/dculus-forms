import { getUploadUrl } from '../lib/config';

interface UploadFileResponse {
  key: string;
  type: string;
  url: string;
  originalName: string;
  size: number;
  mimeType: string;
}

/**
 * Typed error class for upload failures.
 * The code matches GRAPHQL_ERROR_CODES from @dculus/types for consistency.
 */
export class UploadError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'UploadError';
  }
}

export async function uploadFileHTTP(
  file: File,
  type: string,
  formId?: string
): Promise<UploadFileResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', type);
  if (formId) {
    formData.append('formId', formId);
  }

  const uploadUrl = getUploadUrl();

  const response = await fetch(uploadUrl, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });

  if (!response.ok) {
    // Try to parse structured error code from backend
    let body: { error?: string; code?: string } = {};
    try {
      body = await response.json();
    } catch {
      // Response body is not JSON — fall through to status-based fallback
    }

    const code =
      body.code ??
      (response.status === 413 ? 'FILE_TOO_LARGE' : 'UPLOAD_FAILED');

    throw new UploadError(body.error ?? 'Upload failed', code);
  }

  return response.json();
}
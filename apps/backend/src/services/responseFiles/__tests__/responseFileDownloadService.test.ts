import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../repositories/index.js', () => ({
  formFileRepository: { findUnique: vi.fn() },
  responseRepository: { isFileKeyReferencedRaw: vi.fn() },
}));
vi.mock('../../fileUploadService.js', () => ({ generatePresignedDownloadUrl: vi.fn() }));
vi.mock('../responseFileCatalog.js', () => ({
  getFileUploadFieldIds: vi.fn(),
  fileNameFromKey: (key: string) => key.split('/').pop()!.replace(/^\d{13}-[0-9a-f-]{36}-/, ''),
}));

import { formFileRepository, responseRepository } from '../../../repositories/index.js';
import { generatePresignedDownloadUrl } from '../../fileUploadService.js';
import { getFileUploadFieldIds } from '../responseFileCatalog.js';
import { createResponseFileDownloadUrl } from '../responseFileDownloadService.js';

const KEY = 'files/form-response/form-1/1700000000000-11111111-2222-3333-4444-555555555555-cv.pdf';

describe('createResponseFileDownloadUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getFileUploadFieldIds).mockResolvedValue(['resume']);
    vi.mocked(responseRepository.isFileKeyReferencedRaw).mockResolvedValue(true);
    vi.mocked(generatePresignedDownloadUrl).mockResolvedValue('https://signed');
  });

  it('refuses files no live response references', async () => {
    vi.mocked(responseRepository.isFileKeyReferencedRaw).mockResolvedValue(false);

    await expect(createResponseFileDownloadUrl('form-1', KEY)).rejects.toThrow('File not found');
    expect(responseRepository.isFileKeyReferencedRaw).toHaveBeenCalledWith('form-1', KEY, ['resume']);
    expect(generatePresignedDownloadUrl).not.toHaveBeenCalled();
  });

  it('downloads as an attachment under the original name', async () => {
    vi.mocked(formFileRepository.findUnique).mockResolvedValue({ originalName: 'My CV.pdf', mimeType: 'application/pdf' } as any);

    await expect(createResponseFileDownloadUrl('form-1', KEY)).resolves.toBe('https://signed');
    expect(generatePresignedDownloadUrl).toHaveBeenCalledWith(KEY, {
      expiresInSeconds: 300,
      disposition: { type: 'attachment', filename: 'My CV.pdf' },
    });
  });

  it('previews vetted types inline with the type pinned', async () => {
    vi.mocked(formFileRepository.findUnique).mockResolvedValue({ originalName: 'id.png', mimeType: 'image/png' } as any);

    await createResponseFileDownloadUrl('form-1', KEY, { preview: true });
    expect(generatePresignedDownloadUrl).toHaveBeenCalledWith(KEY, {
      expiresInSeconds: 300,
      disposition: { type: 'inline', filename: 'id.png' },
      contentType: 'image/png',
    });
  });

  it('never previews script-capable types such as SVG', async () => {
    vi.mocked(formFileRepository.findUnique).mockResolvedValue({ originalName: 'x.svg', mimeType: 'image/svg+xml' } as any);

    await createResponseFileDownloadUrl('form-1', KEY, { preview: true });
    expect(generatePresignedDownloadUrl).toHaveBeenCalledWith(KEY, {
      expiresInSeconds: 300,
      disposition: { type: 'attachment', filename: 'x.svg' },
    });
  });

  it('falls back to the key-derived name when no file record exists', async () => {
    vi.mocked(formFileRepository.findUnique).mockResolvedValue(null);

    await createResponseFileDownloadUrl('form-1', KEY, { preview: true });
    expect(generatePresignedDownloadUrl).toHaveBeenCalledWith(KEY, {
      expiresInSeconds: 300,
      disposition: { type: 'attachment', filename: 'cv.pdf' },
    });
  });
});

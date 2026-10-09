import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@aws-sdk/client-s3', () => {
  const mockSend = vi.fn();
  return {
    S3Client: vi.fn(function () {
      return { send: mockSend };
    }),
    GetObjectCommand: vi.fn(function (this: any, params: any) {
      this.input = params;
    }),
    PutObjectCommand: vi.fn(),
    CopyObjectCommand: vi.fn(),
    HeadObjectCommand: vi.fn(),
    __mockSend: mockSend,
  };
});
vi.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: vi.fn() }));
vi.mock('../../lib/env.js', () => ({
  s3Config: { endpoint: 'https://r2', accessKey: 'a', secretKey: 's', publicBucketName: 'pub', privateBucketName: 'priv' },
}));
vi.mock('../../utils/cdn.js');

import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { generatePresignedDownloadUrl, openFileStream } from '../fileUploadService.js';

const { __mockSend: mockSend } = (await import('@aws-sdk/client-s3')) as any;
const KEY = 'files/form-response/form-1/a.pdf';

describe('fileUploadService downloads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSignedUrl).mockResolvedValue('https://signed');
  });

  it('signs a 15-minute URL from the private bucket by default', async () => {
    await expect(generatePresignedDownloadUrl(KEY)).resolves.toBe('https://signed');
    const [, command, options] = vi.mocked(getSignedUrl).mock.calls[0] as any[];
    expect(command.input).toEqual({
      Bucket: 'priv',
      Key: KEY,
      ResponseContentDisposition: undefined,
      ResponseContentType: undefined,
    });
    expect(options).toEqual({ expiresIn: 900 });
  });

  it('pins disposition, filename and content type when asked', async () => {
    await generatePresignedDownloadUrl(KEY, {
      expiresInSeconds: 60,
      disposition: { type: 'inline', filename: 'a.pdf' },
      contentType: 'application/pdf',
    });
    const [, command, options] = vi.mocked(getSignedUrl).mock.calls[0] as any[];
    expect(command.input.ResponseContentDisposition).toBe(`inline; filename="a.pdf"; filename*=UTF-8''a.pdf`);
    expect(command.input.ResponseContentType).toBe('application/pdf');
    expect(options).toEqual({ expiresIn: 60 });
  });

  it('opens an object as a web stream', async () => {
    const stream = new ReadableStream();
    mockSend.mockResolvedValueOnce({ Body: { transformToWebStream: () => stream } });
    await expect(openFileStream(KEY)).resolves.toBe(stream);

    mockSend.mockResolvedValueOnce({});
    await expect(openFileStream(KEY)).rejects.toThrow('Empty response body');
  });
});

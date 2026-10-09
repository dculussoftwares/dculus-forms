import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Readable } from 'stream';

vi.mock('@sentry/node', () => ({ captureException: vi.fn() }));
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(function () {
    return { send: vi.fn() };
  }),
  GetObjectCommand: vi.fn(function (this: any, params: any) {
    this.input = params;
  }),
  PutObjectCommand: vi.fn(),
  DeleteObjectCommand: vi.fn(),
  ListObjectsV2Command: vi.fn(),
}));
vi.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: vi.fn() }));
vi.mock('@aws-sdk/lib-storage', () => {
  const done = vi.fn();
  return {
    Upload: vi.fn(function (this: any, options: any) {
      this.options = options;
      this.done = done;
    }),
    __done: done,
  };
});
vi.mock('../../lib/env.js', () => ({
  s3Config: { endpoint: 'https://r2', accessKey: 'a', secretKey: 's', privateBucketName: 'priv' },
}));

import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Config } from '../../lib/env.js';
import {
  getTemporaryFileDownloadUrl,
  tempFilesMockStore,
  uploadTemporaryStream,
} from '../temporaryFileService.js';

const { __done: done } = (await import('@aws-sdk/lib-storage')) as any;

describe('temporary file streaming', () => {
  const originalVitest = process.env.VITEST;

  beforeEach(() => {
    vi.clearAllMocks();
    done.mockResolvedValue({});
    vi.mocked(getSignedUrl).mockResolvedValue('https://signed');
  });

  afterEach(() => {
    process.env.VITEST = originalVitest;
    s3Config.endpoint = 'https://r2';
    tempFilesMockStore.clear();
  });

  it('streams into the private bucket with a multipart upload', async () => {
    const body = Readable.from([Buffer.from('zip')]);
    const { fileKey, expiresAt } = await uploadTemporaryStream(body, 'response-files.zip', 'application/zip');

    expect(fileKey).toMatch(/^temp-exports\/\d+-[0-9a-f-]{36}-response-files\.zip$/);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect((vi.mocked(Upload).mock.instances[0] as any).options.params).toMatchObject({
      Bucket: 'priv',
      Key: fileKey,
      Body: body,
      ContentType: 'application/zip',
    });
    expect(done).toHaveBeenCalled();
  });

  it('signs a short-lived attachment URL under the friendly name', async () => {
    await expect(getTemporaryFileDownloadUrl('temp-exports/k.zip', 'Form files.zip')).resolves.toBe('https://signed');
    const [, command, options] = vi.mocked(getSignedUrl).mock.calls[0] as any[];
    expect(command.input).toEqual({
      Bucket: 'priv',
      Key: 'temp-exports/k.zip',
      ResponseContentDisposition: `attachment; filename="Form files.zip"; filename*=UTF-8''Form%20files.zip`,
    });
    expect(options).toEqual({ expiresIn: 300 });
  });

  it('keeps exports in memory when running against the local mock S3', async () => {
    delete process.env.VITEST;
    s3Config.endpoint = 'http://localhost:9000';

    const { fileKey } = await uploadTemporaryStream(Readable.from([Buffer.from('ab'), Buffer.from('c')]), 'f.zip', 'application/zip');

    expect(tempFilesMockStore.get(fileKey)?.buffer.toString()).toBe('abc');
    expect(Upload).not.toHaveBeenCalled();
    await expect(getTemporaryFileDownloadUrl(fileKey, 'f.zip')).resolves.toContain('/api/temp-files-mock/');
  });
});

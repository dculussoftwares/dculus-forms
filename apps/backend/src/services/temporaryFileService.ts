import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Upload } from '@aws-sdk/lib-storage';
import { randomUUID } from 'crypto';
import type { Readable } from 'stream';
import { contentDisposition } from '../lib/contentDisposition.js';
import { s3Config } from '../lib/env.js';
import { logger } from '../lib/logger.js';
import * as Sentry from '@sentry/node';

// Initialize S3 client for Cloudflare R2
const s3Client = new S3Client({
  region: 'auto',
  endpoint: s3Config.endpoint,
  credentials: {
    accessKeyId: s3Config.accessKey,
    secretAccessKey: s3Config.secretKey,
  },
});

export const tempFilesMockStore = new Map<string, { buffer: Buffer; contentType: string; filename: string }>();

export interface TemporaryFileResult {
  downloadUrl: string;
  expiresAt: Date;
  fileKey: string;
}

/**
 * Upload temporary file to S3 private bucket and return signed URL
 */
export async function uploadTemporaryFile(
  buffer: Buffer,
  filename: string,
  contentType: string = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
): Promise<TemporaryFileResult> {
  const fileKey = `temp-exports/${Date.now()}-${randomUUID()}-${filename}`;
  const expiresAt = new Date(Date.now() + 5 * 60 * 60 * 1000); // 5 hours from now

  const isMockS3 = !process.env.VITEST && (s3Config.endpoint.includes('localhost:9000') || process.env.PUBLIC_S3_ENDPOINT?.includes('localhost:9000'));

  if (isMockS3) {
    tempFilesMockStore.set(fileKey, { buffer, contentType, filename });
    const backendPort = process.env.PORT || '4000';
    const downloadUrl = `http://localhost:${backendPort}/api/temp-files-mock/${encodeURIComponent(fileKey)}`;
    logger.info(`[MOCK S3] Temporary file stored in memory: ${fileKey}`);
    return {
      downloadUrl,
      expiresAt,
      fileKey
    };
  }

  try {
    // Upload file to private bucket
    const putCommand = new PutObjectCommand({
      Bucket: s3Config.privateBucketName,
      Key: fileKey,
      Body: buffer,
      ContentType: contentType,
      ContentDisposition: `attachment; filename="${filename}"`,
      // Add metadata for cleanup
      Metadata: {
        'export-type': 'excel-report',
        'expires-at': expiresAt.toISOString(),
        'auto-cleanup': 'true'
      }
    });

    await s3Client.send(putCommand);

    // Generate signed URL for download (valid for 5 hours)
    const getCommand = new GetObjectCommand({
      Bucket: s3Config.privateBucketName,
      Key: fileKey,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const downloadUrl = await getSignedUrl(s3Client as any, getCommand as any, {
      expiresIn: 5 * 60 * 60, // 5 hours in seconds
    });

    return {
      downloadUrl,
      expiresAt,
      fileKey
    };
  } catch (error) {
    logger.error('Error uploading temporary file:', error);
    throw new Error(`Failed to upload temporary file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export const TEMP_FILE_TTL_MS = 5 * 60 * 60 * 1000;

/**
 * When the cleanup sweep will delete a temp file: its TTL counted from the
 * timestamp embedded in the key (the moment the upload started), or null for
 * a key that doesn't follow the temp-exports/{timestamp}-... format.
 */
export const getTemporaryFileExpiry = (fileKey: string): Date | null => {
  const timestamp = Number(/^temp-exports\/(\d+)-/.exec(fileKey)?.[1]);
  return Number.isFinite(timestamp) && timestamp > 0 ? new Date(timestamp + TEMP_FILE_TTL_MS) : null;
};

const isMockS3Enabled = (): boolean =>
  !process.env.VITEST &&
  (s3Config.endpoint.includes('localhost:9000') || !!process.env.PUBLIC_S3_ENDPOINT?.includes('localhost:9000'));

/**
 * Stream a temporary file into the private bucket without buffering it: the
 * body is uploaded in bounded multipart chunks, so memory stays flat no matter
 * how large the file is. `keyName` must be storage-safe; the user-facing name
 * is applied at download time by {@link getTemporaryFileDownloadUrl}.
 */
export async function uploadTemporaryStream(
  body: Readable,
  keyName: string,
  contentType: string
): Promise<{ fileKey: string; expiresAt: Date }> {
  const fileKey = `temp-exports/${Date.now()}-${randomUUID()}-${keyName}`;
  const expiresAt = new Date(Date.now() + TEMP_FILE_TTL_MS);

  if (isMockS3Enabled()) {
    const chunks: Buffer[] = [];
    for await (const chunk of body) chunks.push(Buffer.from(chunk));
    tempFilesMockStore.set(fileKey, { buffer: Buffer.concat(chunks), contentType, filename: keyName });
    return { fileKey, expiresAt };
  }

  await new Upload({
    client: s3Client as unknown as ConstructorParameters<typeof Upload>[0]['client'],
    params: {
      Bucket: s3Config.privateBucketName,
      Key: fileKey,
      Body: body,
      ContentType: contentType,
      Metadata: { 'expires-at': expiresAt.toISOString(), 'auto-cleanup': 'true' },
    },
    queueSize: 2,
    partSize: 8 * 1024 * 1024,
  }).done();

  return { fileKey, expiresAt };
}

/** Short-lived download URL for a temporary file, saved under `filename`. */
export async function getTemporaryFileDownloadUrl(
  fileKey: string,
  filename: string,
  expiresInSeconds = 300
): Promise<string> {
  if (isMockS3Enabled()) {
    const backendPort = process.env.PORT || '4000';
    return `http://localhost:${backendPort}/api/temp-files-mock/${encodeURIComponent(fileKey)}`;
  }

  const command = new GetObjectCommand({
    Bucket: s3Config.privateBucketName,
    Key: fileKey,
    ResponseContentDisposition: contentDisposition('attachment', filename),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return getSignedUrl(s3Client as any, command as any, { expiresIn: expiresInSeconds });
}

/**
 * Delete a temporary file from S3
 */
export async function deleteTemporaryFile(fileKey: string): Promise<boolean> {
  const isMockS3 = !process.env.VITEST && (s3Config.endpoint.includes('localhost:9000') || process.env.PUBLIC_S3_ENDPOINT?.includes('localhost:9000'));
  if (isMockS3) {
    const deleted = tempFilesMockStore.delete(fileKey);
    logger.info(`[MOCK S3] Temporary file deleted from memory: ${fileKey}`);
    return deleted;
  }

  try {
    const deleteCommand = new DeleteObjectCommand({
      Bucket: s3Config.privateBucketName,
      Key: fileKey,
    });

    await s3Client.send(deleteCommand);
    logger.info(`Temporary file deleted: ${fileKey}`);
    return true;
  } catch (error) {
    logger.error(`Error deleting temporary file ${fileKey}:`, error);
    return false;
  }
}

/**
 * P3-06: Start a persistent periodic cleanup that runs every 30 minutes.
 * Also runs immediately on startup to clear files left by a previous process.
 * Uses .unref() so the interval does not prevent graceful process exit.
 * Call this once from index.ts instead of scheduling per-upload timeouts.
 */
export const startPeriodicCleanup = (): void => {
  // Run immediately on startup to clear any files from the previous process
  cleanupExpiredFiles().catch(err => logger.warn('Startup temp-file cleanup failed:', err));

  // Then run every 30 minutes
  setInterval(() => {
    cleanupExpiredFiles().catch(err => logger.warn('Periodic temp-file cleanup failed:', err));
  }, 30 * 60 * 1000).unref();
};

/**
 * Delete all temp-exports objects whose embedded timestamp is older than 5 hours.
 * Key format: temp-exports/{timestamp}-{uuid}-{filename}
 * Called on server startup to clean up files left by previous process restarts.
 */
export async function cleanupExpiredFiles(): Promise<{ deleted: number; errors: number }> {
  const isMockS3 = !process.env.VITEST && (s3Config.endpoint.includes('localhost:9000') || process.env.PUBLIC_S3_ENDPOINT?.includes('localhost:9000'));
  if (isMockS3) {
    const cutoff = Date.now() - 5 * 60 * 60 * 1000;
    let deleted = 0;
    for (const key of tempFilesMockStore.keys()) {
      const ts = parseInt(key.replace('temp-exports/', '').split('-')[0], 10);
      if (!isNaN(ts) && ts < cutoff) {
        tempFilesMockStore.delete(key);
        deleted++;
      }
    }
    logger.info(`[MOCK S3] Temp-file mock cleanup complete: ${deleted} deleted`);
    return { deleted, errors: 0 };
  }

  const cutoff = Date.now() - 5 * 60 * 60 * 1000;
  let deleted = 0;
  let errors = 0;
  let continuationToken: string | undefined;

  try {
    do {
      const result = await s3Client.send(
        new ListObjectsV2Command({
          Bucket: s3Config.privateBucketName,
          Prefix: 'temp-exports/',
          ContinuationToken: continuationToken,
        })
      );

      for (const obj of result.Contents ?? []) {
        if (!obj.Key) continue;
        const ts = parseInt(obj.Key.replace('temp-exports/', '').split('-')[0], 10);
        if (!isNaN(ts) && ts < cutoff) {
          if (await deleteTemporaryFile(obj.Key)) {
            deleted++;
          } else {
            errors++;
          }
        }
      }

      continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined;
    } while (continuationToken);

    logger.info(`Temp-file cleanup complete: ${deleted} deleted, ${errors} errors`);
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Error during temp-file cleanup:', error);
  }

  return { deleted, errors };
}


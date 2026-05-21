import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
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

    const downloadUrl = await getSignedUrl(s3Client as any, getCommand as any, {
      expiresIn: 5 * 60 * 60, // 5 hours in seconds
    });

    // Schedule cleanup (in a real implementation, you'd use a proper job queue)
    scheduleFileCleanup(fileKey, 5 * 60 * 60 * 1000); // 5 hours

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

/**
 * Delete a temporary file from S3
 */
export async function deleteTemporaryFile(fileKey: string): Promise<boolean> {
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
 * Schedule cleanup for a single file after a delay.
 * Known limitation: timer is process-local and lost on server restart.
 * `cleanupExpiredFiles` runs on startup to handle files from previous processes.
 */
function scheduleFileCleanup(fileKey: string, delayMs: number): void {
  setTimeout(async () => {
    try {
      await deleteTemporaryFile(fileKey);
    } catch (error) {
      logger.error(`Failed to cleanup temporary file ${fileKey}:`, error);
    }
  }, delayMs);
}

/**
 * Delete all temp-exports objects whose embedded timestamp is older than 5 hours.
 * Key format: temp-exports/{timestamp}-{uuid}-{filename}
 * Called on server startup to clean up files left by previous process restarts.
 */
export async function cleanupExpiredFiles(): Promise<{ deleted: number; errors: number }> {
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


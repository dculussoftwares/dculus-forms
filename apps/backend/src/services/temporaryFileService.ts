import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { s3Config } from '../lib/env.js';

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
    console.error('Error uploading temporary file:', error);
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
    console.log(`Temporary file deleted: ${fileKey}`);
    return true;
  } catch (error) {
    console.error(`Error deleting temporary file ${fileKey}:`, error);
    return false;
  }
}

/**
 * Schedule file cleanup (simple setTimeout implementation)
 * In production, you'd want to use a proper job queue like Bull, Agenda, or similar
 */
function scheduleFileCleanup(fileKey: string, delayMs: number): void {
  setTimeout(async () => {
    try {
      await deleteTemporaryFile(fileKey);
    } catch (error) {
      console.error(`Failed to cleanup temporary file ${fileKey}:`, error);
    }
  }, delayMs);
}

/**
 * Cleanup expired temporary files
 * This could be called periodically via a cron job
 */
export async function cleanupExpiredFiles(): Promise<void> {
  // This would need to be implemented with proper S3 listing and metadata checking
  // For now, we rely on the scheduled cleanup above
  console.log('Cleanup expired files task - implement with S3 listing if needed');
}


import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { s3Config } from '../lib/env.js';
import { logger } from '../lib/logger.js';

/**
 * Storage for PDF Generator output — durable, private-bucket PDFs referenced
 * repeatedly from the Responses table (unlike temporaryFileService's 5h-TTL
 * exports). Keyed deterministically per (formId, generatorId, responseId) so
 * regenerating a response's PDF overwrites the same object in place ("latest
 * wins" — see PdfGenerationResult.@@unique([generatorId, responseId])).
 */

const s3Client = new S3Client({
  region: 'auto',
  endpoint: s3Config.endpoint,
  credentials: {
    accessKeyId: s3Config.accessKey,
    secretAccessKey: s3Config.secretKey,
  },
});

function buildKey(formId: string, generatorId: string, responseId: string): string {
  return `pdf-generated/${formId}/${generatorId}/${responseId}.pdf`;
}

export async function uploadGeneratedPdf(
  buffer: Buffer,
  formId: string,
  generatorId: string,
  responseId: string
): Promise<{ fileKey: string }> {
  const fileKey = buildKey(formId, generatorId, responseId);

  await s3Client.send(
    new PutObjectCommand({
      Bucket: s3Config.privateBucketName,
      Key: fileKey,
      Body: buffer,
      ContentType: 'application/pdf',
    })
  );

  return { fileKey };
}

/**
 * Delete every generated PDF for a generator (called when the generator itself
 * is deleted). Best-effort — mirrors the "delete DB row first, log a warning
 * on R2 failure" pattern already used by deletePdfTemplate.
 */
export async function deleteGeneratedPdfsForGenerator(
  formId: string,
  generatorId: string
): Promise<void> {
  const prefix = `pdf-generated/${formId}/${generatorId}/`;
  let continuationToken: string | undefined;

  try {
    do {
      const result = await s3Client.send(
        new ListObjectsV2Command({
          Bucket: s3Config.privateBucketName,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        })
      );

      for (const obj of result.Contents ?? []) {
        if (!obj.Key) continue;
        try {
          await s3Client.send(
            new DeleteObjectCommand({ Bucket: s3Config.privateBucketName, Key: obj.Key })
          );
        } catch (error) {
          logger.warn(`Failed to delete generated PDF ${obj.Key}:`, error);
        }
      }

      continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined;
    } while (continuationToken);
  } catch (error) {
    logger.warn(`Failed to list generated PDFs under ${prefix} for cleanup:`, error);
  }
}

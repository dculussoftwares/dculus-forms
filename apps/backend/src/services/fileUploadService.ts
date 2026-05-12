import {
  S3Client,
  PutObjectCommand,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import path from 'path';
import { s3Config } from '../lib/env.js';
import { constructCdnUrl } from '../utils/cdn.js';
import { logger } from '../lib/logger.js';

export interface UploadFileResult {
  key: string;
  type: string;
  url: string;
  originalName: string;
  size: number;
  mimeType: string;
}

export interface UploadFileInput {
  file: {
    filename: string;
    mimetype: string;
    encoding: string;
    createReadStream: () => NodeJS.ReadableStream;
  };
  type: string;
  formId?: string;
}

// Initialize S3 client for Cloudflare R2
const s3Client = new S3Client({
  region: 'auto',
  endpoint: s3Config.endpoint,
  credentials: {
    accessKeyId: s3Config.accessKey,
    secretAccessKey: s3Config.secretKey,
  },
});

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB (for image uploads; FormResponse uses multer limit)

/**
 * Bucket routing — determines which R2 bucket and access model each upload type uses.
 *
 * PUBLIC  → publicBucketName  + ACL: public-read  (served via CDN, no auth needed)
 * PRIVATE → privateBucketName + no ACL            (accessed only via pre-signed URLs)
 */
type BucketMode = 'PUBLIC' | 'PRIVATE';

const UPLOAD_TYPE_BUCKET_MAP: Record<string, BucketMode> = {
  FormTemplate: 'PUBLIC', // Template thumbnails shown in the UI
  FormBackground: 'PUBLIC', // Form background images served in the viewer
  UserAvatar: 'PUBLIC', // Profile pictures shown across the app
  OrganizationLogo: 'PUBLIC', // Org logos shown in the UI
  FormResponse: 'PRIVATE', // Respondent-uploaded files — only form owners/editors may access
};

function getBucketForType(type: string): {
  bucketName: string;
  mode: BucketMode;
} {
  const mode = UPLOAD_TYPE_BUCKET_MAP[type] ?? 'PRIVATE'; // default-private for unknown types
  const bucketName =
    mode === 'PUBLIC' ? s3Config.publicBucketName : s3Config.privateBucketName;
  return { bucketName, mode };
}

// MIME types that must never be stored regardless of field config (prevent stored XSS / execution)
const BLOCKED_MIME_TYPES = new Set([
  'text/html',
  'application/xhtml+xml',
  'application/javascript',
  'text/javascript',
  'application/x-javascript',
  'application/x-httpd-php',
  'application/x-sh',
  'application/x-shellscript',
  'application/x-executable',
  'application/x-elf',
  'application/x-mach-binary',
  'application/x-dosexec',
  'application/vnd.microsoft.portable-executable',
]);

/**
 * Generate a unique S3 key for the uploaded file
 */
function generateS3Key(
  originalName: string,
  type: string,
  formId?: string
): string {
  const timestamp = Date.now();
  const uuid = randomUUID();
  const extension = path.extname(originalName).toLowerCase();
  const baseName = path.basename(originalName, extension);

  // Sanitize filename
  const sanitizedBaseName = baseName
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .toLowerCase();

  // Create unique filename
  const uniqueFilename = `${timestamp}-${uuid}-${sanitizedBaseName}${extension}`;

  // Generate S3 path based on type
  switch (type) {
    case 'FormTemplate':
      return `files/form-template/${uniqueFilename}`;
    case 'FormBackground':
      // Include formId in the path for form-specific backgrounds
      return formId
        ? `files/form-background/${formId}/${uniqueFilename}`
        : `files/form-background/${uniqueFilename}`;
    case 'UserAvatar':
      return `files/user-avatar/${uniqueFilename}`;
    case 'OrganizationLogo':
      return `files/organization-logo/${uniqueFilename}`;
    case 'FormResponse':
      return formId
        ? `files/form-response/${formId}/${uniqueFilename}`
        : `files/form-response/${uniqueFilename}`;
    default:
      return `files/misc/${uniqueFilename}`;
  }
}

/**
 * Convert stream to buffer
 */
async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', (err) => reject(err));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

/**
 * Get mimetype from file extension as fallback
 */
function getMimetypeFromExtension(filename: string | undefined): string {
  if (!filename) return '';

  const ext = path.extname(filename).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
  };
  return mimeMap[ext] || '';
}

/**
 * Upload file to Cloudflare R2
 */
export async function uploadFile(
  input: UploadFileInput
): Promise<UploadFileResult> {
  const { file, type, formId } = input;
  const { filename, mimetype, createReadStream } = file;

  // Use detected mimetype or fallback to extension-based detection
  const finalMimetype = mimetype || getMimetypeFromExtension(filename);

  logger.info('Upload file details:', {
    filename,
    originalMimetype: mimetype,
    finalMimetype,
    type,
  });

  // Validate we have a filename
  if (!filename) {
    throw new Error('Filename is required');
  }

  // Block dangerous MIME types unconditionally (prevents stored XSS / code execution via CDN)
  if (finalMimetype && BLOCKED_MIME_TYPES.has(finalMimetype)) {
    throw new Error(
      `File type ${finalMimetype} is not allowed for security reasons`
    );
  }

  // For non-FormResponse uploads, additionally restrict to known image MIME types
  if (
    type !== 'FormResponse' &&
    (!finalMimetype || !ALLOWED_IMAGE_TYPES.includes(finalMimetype))
  ) {
    throw new Error(
      `File type ${finalMimetype || 'unknown'} is not allowed. Allowed types: ${ALLOWED_IMAGE_TYPES.join(', ')}`
    );
  }

  // Generate S3 key
  const s3Key = generateS3Key(filename, type, formId);

  try {
    // Convert stream to buffer
    const stream = createReadStream();
    const buffer = await streamToBuffer(stream);

    // Check file size — FormResponse relies on multer's 50 MB limit (enforced before this point);
    // all other upload types are capped at MAX_FILE_SIZE (5 MB)
    if (type !== 'FormResponse' && buffer.length > MAX_FILE_SIZE) {
      throw new Error(
        `File size ${buffer.length} bytes exceeds maximum allowed size of ${MAX_FILE_SIZE} bytes`
      );
    }

    // Resolve bucket and access mode from the upload type
    const { bucketName, mode } = getBucketForType(type);

    // Upload to Cloudflare R2
    const putObjectCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      Body: buffer,
      ContentType: finalMimetype,
      ContentLength: buffer.length,
      // Only set public-read ACL for public-bucket uploads
      ...(mode === 'PUBLIC' ? { ACL: 'public-read' } : {}),
    });

    await s3Client.send(putObjectCommand);

    // CDN URL only makes sense for public-bucket objects
    const cdnUrl = mode === 'PUBLIC' ? constructCdnUrl(s3Key)! : '';

    return {
      key: s3Key,
      type,
      url: cdnUrl,
      originalName: filename,
      size: buffer.length,
      mimeType: finalMimetype,
    };
  } catch (error) {
    logger.error('Error uploading file to Cloudflare R2:', error);
    throw new Error(
      `Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Infer the bucket for a given R2 key based on its path prefix.
 * Keys under files/form-response/ were written to the private bucket.
 */
function getBucketForKey(s3Key: string): string {
  return s3Key.startsWith('files/form-response/')
    ? s3Config.privateBucketName
    : s3Config.publicBucketName;
}

/**
 * Delete file from Cloudflare R2
 */
export async function deleteFile(s3Key: string): Promise<boolean> {
  try {
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');

    const deleteObjectCommand = new DeleteObjectCommand({
      Bucket: getBucketForKey(s3Key),
      Key: s3Key,
    });

    await s3Client.send(deleteObjectCommand);
    return true;
  } catch (error) {
    logger.error('Error deleting file from Cloudflare R2:', error);
    return false;
  }
}

/**
 * Copy file within Cloudflare R2 bucket for form duplication
 */
export async function copyFileForForm(
  sourceKey: string,
  formId: string
): Promise<UploadFileResult> {
  try {
    // Extract original filename from source key
    const originalFilename = sourceKey.split('/').pop() || 'background-image';

    // Generate new unique key for the copied file with formId
    const newKey = generateS3Key(originalFilename, 'FormBackground', formId);

    // Copy the file using S3 CopyObjectCommand
    const copyObjectCommand = new CopyObjectCommand({
      Bucket: s3Config.publicBucketName,
      CopySource: `${s3Config.publicBucketName}/${sourceKey}`,
      Key: newKey,
      ACL: 'public-read',
    });

    await s3Client.send(copyObjectCommand);

    // Construct CDN URL for the copied file
    const cdnUrl = constructCdnUrl(newKey) || '';

    return {
      key: newKey,
      type: 'FormBackground',
      url: cdnUrl,
      originalName: originalFilename,
      size: 0, // Size not available from copy operation
      mimeType: 'image/jpeg', // Default to jpeg, could be enhanced to detect from extension
    };
  } catch (error) {
    logger.error('Error copying file in Cloudflare R2:', error);
    throw new Error(
      `Failed to copy file: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

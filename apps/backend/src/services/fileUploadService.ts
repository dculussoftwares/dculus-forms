import {
  S3Client,
  PutObjectCommand,
  CopyObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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

// Background videos sourced from Pexels/Pixabay stock search (re-uploaded via the same
// FormBackground upload type as images) — see downloadPexelsVideo/downloadPixabayVideo.
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm'];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB (for image uploads; FormResponse uses multer limit)
// 45MB for FormBackground video uploads (HD renditions) — kept below the route-level multer
// ceiling (50MB, see upload.ts) so oversized uploads still fail via this controlled error path
// (mapped to 413/FILE_TOO_LARGE) rather than multer's raw LIMIT_FILE_SIZE error.
const MAX_VIDEO_FILE_SIZE = 45 * 1024 * 1024;
const MAX_PDF_TEMPLATE_SIZE = 10 * 1024 * 1024; // 10MB for uploaded base PDFs (PdfTemplateAsset)

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
  PdfTemplateAsset: 'PRIVATE', // Base PDFs for PDF templates — accessed only via pre-signed URLs
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
    case 'PdfTemplateAsset':
      return formId
        ? `files/pdf-template-asset/${formId}/${uniqueFilename}`
        : `files/pdf-template-asset/${uniqueFilename}`;
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
    '.pdf': 'application/pdf',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
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

  // PdfTemplateAsset uploads must be PDFs
  if (type === 'PdfTemplateAsset' && finalMimetype !== 'application/pdf') {
    throw new Error(
      `File type ${finalMimetype || 'unknown'} is not allowed. Allowed types: application/pdf`
    );
  }

  // FormBackground additionally accepts video (stock video backgrounds from Pexels/Pixabay)
  const allowedTypesForFormBackground = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];
  const isVideoUpload =
    type === 'FormBackground' && !!finalMimetype && ALLOWED_VIDEO_TYPES.includes(finalMimetype);

  // For non-FormResponse uploads, additionally restrict to known image (or, for
  // FormBackground, image/video) MIME types
  if (type === 'FormBackground') {
    if (!finalMimetype || !allowedTypesForFormBackground.includes(finalMimetype)) {
      throw new Error(
        `File type ${finalMimetype || 'unknown'} is not allowed. Allowed types: ${allowedTypesForFormBackground.join(', ')}`
      );
    }
  } else if (
    type !== 'FormResponse' &&
    type !== 'PdfTemplateAsset' &&
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
    // PdfTemplateAsset is capped at MAX_PDF_TEMPLATE_SIZE (10 MB);
    // FormBackground videos are capped at MAX_VIDEO_FILE_SIZE (20 MB);
    // all other upload types (including FormBackground images) are capped at MAX_FILE_SIZE (5 MB)
    if (type === 'PdfTemplateAsset') {
      if (buffer.length > MAX_PDF_TEMPLATE_SIZE) {
        throw new Error(
          `File size ${buffer.length} bytes exceeds maximum allowed size of ${MAX_PDF_TEMPLATE_SIZE} bytes`
        );
      }
    } else if (isVideoUpload) {
      if (buffer.length > MAX_VIDEO_FILE_SIZE) {
        throw new Error(
          `File size ${buffer.length} bytes exceeds maximum allowed size of ${MAX_VIDEO_FILE_SIZE} bytes`
        );
      }
    } else if (type !== 'FormResponse' && buffer.length > MAX_FILE_SIZE) {
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
 * Keys under files/form-response/, files/pdf-template-asset/, and
 * pdf-generated/ (PDF Generator output — see pdfGeneratorStorage.ts) were
 * written to the private bucket.
 */
function getBucketForKey(s3Key: string): string {
  return s3Key.startsWith('files/form-response/') ||
    s3Key.startsWith('files/pdf-template-asset/') ||
    s3Key.startsWith('pdf-generated/')
    ? s3Config.privateBucketName
    : s3Config.publicBucketName;
}

// Deterministic filename so repeated generations for the same form reuse one
// object instead of uploading a new copy every time.
const SYNTHETIC_RESPONSE_FILENAME = 'ai-fake-response-placeholder.txt';
const SYNTHETIC_RESPONSE_CONTENT = Buffer.from(
  'This file was attached automatically to an AI-generated fake response, used for testing.\n' +
    'Real file uploads are not simulated for AI-generated responses yet.\n'
);

/**
 * Ensures a small placeholder file exists at a per-form, deterministic key in
 * the private bucket, for FileUploadField answers in AI-generated fake
 * responses. Idempotent (HEAD-check before upload) and keyed under
 * files/form-response/{formId}/... so it satisfies the same key pattern (and
 * therefore the same access checks) as a real respondent-uploaded file — see
 * getResponseFileDownloadUrl's KEY_PATTERN in resolvers/fileUpload.ts.
 */
export async function ensureSyntheticResponseFile(formId: string): Promise<string> {
  const key = `files/form-response/${formId}/${SYNTHETIC_RESPONSE_FILENAME}`;

  try {
    await s3Client.send(
      new HeadObjectCommand({ Bucket: s3Config.privateBucketName, Key: key })
    );
    return key;
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata
      ?.httpStatusCode;
    const name = (error as { name?: string })?.name;
    // Anything other than "object doesn't exist" is unexpected — surface it.
    if (status !== 404 && name !== 'NotFound') throw error;
  }

  await s3Client.send(
    new PutObjectCommand({
      Bucket: s3Config.privateBucketName,
      Key: key,
      Body: SYNTHETIC_RESPONSE_CONTENT,
      ContentType: 'text/plain',
    })
  );
  return key;
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
 * Generate a short-lived pre-signed GET URL for a private R2 object.
 * Only files in the private bucket (form-response path) should use this.
 */
export async function generatePresignedDownloadUrl(
  s3Key: string,
  expiresInSeconds = 900 // 15 minutes
): Promise<string> {
  const bucket = getBucketForKey(s3Key);
  const command = new GetObjectCommand({ Bucket: bucket, Key: s3Key });
  // `as unknown as` required: @aws-sdk/client-s3@3.859 and @aws-sdk/s3-request-presigner@3.872
  // declare private `handlers` independently, making S3Client structurally incompatible at
  // compile time. They are the same runtime object — the cast is safe.
  return getSignedUrl(
    s3Client as unknown as Parameters<typeof getSignedUrl>[0],
    command as unknown as Parameters<typeof getSignedUrl>[1],
    { expiresIn: expiresInSeconds }
  );
}

/**
 * Download an R2 object into a Buffer (bucket inferred from key prefix).
 * Used for server-side processing, e.g. hydrating PDF template base PDFs.
 */
export async function downloadFileBuffer(s3Key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: getBucketForKey(s3Key),
    Key: s3Key,
  });
  const response = await s3Client.send(command);
  if (!response.Body) {
    throw new Error(`Empty response body for key: ${s3Key}`);
  }
  const bytes = await response.Body.transformToByteArray();
  return Buffer.from(bytes);
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
      // Detect from the source file's extension (jpg/png/mp4/webm/...) rather than assuming
      // image/jpeg — background videos must keep their real mimeType when a form is duplicated.
      mimeType: getMimetypeFromExtension(originalFilename) || 'image/jpeg',
    };
  } catch (error) {
    logger.error('Error copying file in Cloudflare R2:', error);
    throw new Error(
      `Failed to copy file: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

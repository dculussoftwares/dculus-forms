import { S3Client, PutObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import path from 'path';

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
}

// Initialize S3 client for Cloudflare R2
const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_KEY!,
  },
});

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'image/webp',
  'image/gif'
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Generate a unique S3 key for the uploaded file
 */
function generateS3Key(originalName: string, type: string): string {
  const timestamp = Date.now();
  const uuid = randomUUID();
  const extension = path.extname(originalName).toLowerCase();
  const baseName = path.basename(originalName, extension);
  
  // Sanitize filename
  const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
  
  // Create unique filename
  const uniqueFilename = `${timestamp}-${uuid}-${sanitizedBaseName}${extension}`;
  
  // Generate S3 path based on type
  switch (type) {
    case 'FormTemplate':
      return `files/form-template/${uniqueFilename}`;
    case 'FormBackground':
      return `files/form-background/${uniqueFilename}`;
    case 'UserAvatar':
      return `files/user-avatar/${uniqueFilename}`;
    case 'OrganizationLogo':
      return `files/organization-logo/${uniqueFilename}`;
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
    '.gif': 'image/gif'
  };
  return mimeMap[ext] || '';
}

/**
 * Upload file to Cloudflare R2
 */
export async function uploadFile(input: UploadFileInput): Promise<UploadFileResult> {
  const { file, type } = input;
  const { filename, mimetype, createReadStream } = file;

  // Use detected mimetype or fallback to extension-based detection
  const finalMimetype = mimetype || getMimetypeFromExtension(filename);
  
  console.log('Upload file details:', {
    filename,
    originalMimetype: mimetype,
    finalMimetype,
    type
  });

  // Validate we have a filename
  if (!filename) {
    throw new Error('Filename is required');
  }

  // Validate file type
  if (!finalMimetype || !ALLOWED_IMAGE_TYPES.includes(finalMimetype)) {
    throw new Error(`File type ${finalMimetype || 'unknown'} is not allowed. Allowed types: ${ALLOWED_IMAGE_TYPES.join(', ')}`);
  }

  // Generate S3 key
  const s3Key = generateS3Key(filename, type);

  try {
    // Convert stream to buffer
    const stream = createReadStream();
    const buffer = await streamToBuffer(stream);

    // Check file size
    if (buffer.length > MAX_FILE_SIZE) {
      throw new Error(`File size ${buffer.length} bytes exceeds maximum allowed size of ${MAX_FILE_SIZE} bytes`);
    }

    // Upload to Cloudflare R2
    const putObjectCommand = new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_PUBLIC_BUCKET_NAME,
      Key: s3Key,
      Body: buffer,
      ContentType: finalMimetype,
      ContentLength: buffer.length,
      // Make the object publicly readable
      ACL: 'public-read',
    });

    await s3Client.send(putObjectCommand);

    // Construct CDN URL
    const cdnUrl = `${process.env.CLOUDFLARE_R2_CDN_URL}/${s3Key}`;

    return {
      key: s3Key,
      type,
      url: cdnUrl,
      originalName: filename,
      size: buffer.length,
      mimeType: finalMimetype,
    };
  } catch (error) {
    console.error('Error uploading file to Cloudflare R2:', error);
    throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Delete file from Cloudflare R2
 */
export async function deleteFile(s3Key: string): Promise<boolean> {
  try {
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    
    const deleteObjectCommand = new DeleteObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_PUBLIC_BUCKET_NAME,
      Key: s3Key,
    });

    await s3Client.send(deleteObjectCommand);
    return true;
  } catch (error) {
    console.error('Error deleting file from Cloudflare R2:', error);
    return false;
  }
}

/**
 * Copy file within Cloudflare R2 bucket for form duplication
 */
export async function copyFileForForm(sourceKey: string, formId: string): Promise<UploadFileResult> {
  try {
    // Extract original filename from source key
    const originalFilename = sourceKey.split('/').pop() || 'background-image';
    
    // Generate new unique key for the copied file
    const newKey = generateS3Key(originalFilename, 'FormBackground');
    
    // Copy the file using S3 CopyObjectCommand
    const copyObjectCommand = new CopyObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_PUBLIC_BUCKET_NAME,
      CopySource: `${process.env.CLOUDFLARE_R2_PUBLIC_BUCKET_NAME}/${sourceKey}`,
      Key: newKey,
      ACL: 'public-read',
    });

    await s3Client.send(copyObjectCommand);

    // Construct CDN URL for the copied file
    const cdnUrl = `${process.env.CLOUDFLARE_R2_CDN_URL}/${newKey}`;

    return {
      key: newKey,
      type: 'FormBackground',
      url: cdnUrl,
      originalName: originalFilename,
      size: 0, // Size not available from copy operation
      mimeType: 'image/jpeg', // Default to jpeg, could be enhanced to detect from extension
    };
  } catch (error) {
    console.error('Error copying file in Cloudflare R2:', error);
    throw new Error(`Failed to copy file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

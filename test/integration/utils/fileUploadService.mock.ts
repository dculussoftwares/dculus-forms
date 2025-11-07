/**
 * Mock File Upload Service for Integration Tests
 *
 * This mock replaces the real S3 operations with in-memory mock S3 operations
 */

import { getMockS3Service } from './s3-mock';
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

/**
 * Generate a unique S3 key for the uploaded file (same logic as real service)
 */
function generateS3Key(originalName: string, type: string, formId?: string): string {
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
      return formId ? `files/form-background/${formId}/${uniqueFilename}` : `files/form-background/${uniqueFilename}`;
    case 'UserAvatar':
      return `files/user-avatar/${uniqueFilename}`;
    case 'OrganizationLogo':
      return `files/organization-logo/${uniqueFilename}`;
    default:
      return `files/misc/${uniqueFilename}`;
  }
}

/**
 * Mock upload file function
 */
export async function uploadFile(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  type: string,
  formId?: string
): Promise<UploadFileResult> {
  const mockS3 = getMockS3Service();
  const key = generateS3Key(originalName, type, formId);

  const url = await mockS3.upload(key, buffer, {
    mimeType,
    originalName,
  });

  return {
    key,
    type,
    url,
    originalName,
    size: buffer.length,
    mimeType,
  };
}

/**
 * Mock copy file for form function
 */
export async function copyFileForForm(
  sourceKey: string,
  newFormId: string
): Promise<UploadFileResult> {
  const mockS3 = getMockS3Service();
  const sourceFile = mockS3.getFile(sourceKey);

  if (!sourceFile) {
    throw new Error(`Source file not found: ${sourceKey}`);
  }

  // Generate new key for the copied file
  const newKey = generateS3Key(sourceFile.originalName, 'FormBackground', newFormId);

  // Copy in mock S3
  await mockS3.copy(sourceKey, newKey);

  const newUrl = mockS3.getUrl(newKey);

  return {
    key: newKey,
    type: 'FormBackground',
    url: newUrl,
    originalName: sourceFile.originalName,
    size: sourceFile.size,
    mimeType: sourceFile.mimeType,
  };
}

/**
 * Mock delete file function
 */
export async function deleteFile(key: string): Promise<void> {
  const mockS3 = getMockS3Service();
  await mockS3.delete(key);
}

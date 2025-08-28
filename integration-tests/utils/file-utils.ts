import * as fs from 'fs';
import * as path from 'path';

export interface TestFileInfo {
  filename: string;
  path: string;
  buffer: Buffer;
  size: number;
  mimetype: string;
}

/**
 * Load a test file from the static-files directory
 */
export function loadStaticTestFile(filename: string): TestFileInfo {
  const staticFilePath = path.join(process.cwd(), 'static-files', filename);
  
  if (!fs.existsSync(staticFilePath)) {
    throw new Error(`Test file not found: ${staticFilePath}`);
  }
  
  const fileStats = fs.statSync(staticFilePath);
  const fileBuffer = fs.readFileSync(staticFilePath);
  
  const mimetype = getMimetypeFromFilename(filename);
  
  return {
    filename: filename,
    path: staticFilePath,
    buffer: fileBuffer,
    size: fileStats.size,
    mimetype: mimetype
  };
}

/**
 * Create a test text file for testing invalid file types
 */
export function createTestTextFile(content: string = 'This is a test text file for upload validation'): TestFileInfo {
  const textBuffer = Buffer.from(content, 'utf-8');
  
  return {
    filename: 'test.txt',
    path: '',
    buffer: textBuffer,
    size: textBuffer.length,
    mimetype: 'text/plain'
  };
}

/**
 * Create a test file that exceeds the size limit
 */
export function createOversizedTestFile(sizeInMB: number = 6): TestFileInfo {
  const sizeInBytes = sizeInMB * 1024 * 1024;
  const buffer = Buffer.alloc(sizeInBytes, 'A'); // Fill with 'A' characters
  
  return {
    filename: 'oversized-test-file.jpg',
    path: '',
    buffer: buffer,
    size: sizeInBytes,
    mimetype: 'image/jpeg'
  };
}

/**
 * Get MIME type from filename extension
 */
function getMimetypeFromFilename(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  
  const mimeMap: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg', 
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.txt': 'text/plain',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  };
  
  return mimeMap[ext] || 'application/octet-stream';
}

/**
 * Validate if a file type should be allowed by the upload service
 */
export function isAllowedFileType(mimetype: string): boolean {
  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png', 
    'image/webp',
    'image/gif'
  ];
  
  return allowedTypes.includes(mimetype);
}

/**
 * Get all available static test files
 */
export function getAvailableStaticFiles(): string[] {
  const staticFilesDir = path.join(process.cwd(), 'static-files');
  
  if (!fs.existsSync(staticFilesDir)) {
    throw new Error(`Static files directory not found: ${staticFilesDir}`);
  }
  
  return fs.readdirSync(staticFilesDir).filter(file => {
    const filePath = path.join(staticFilesDir, file);
    return fs.statSync(filePath).isFile();
  });
}

/**
 * Validate file upload response structure
 */
export function validateFileUploadResponse(response: any): void {
  const requiredFields = ['key', 'type', 'url', 'originalName', 'size', 'mimeType'];
  
  for (const field of requiredFields) {
    if (!(field in response)) {
      throw new Error(`Missing required field in upload response: ${field}`);
    }
  }
  
  // Additional validations
  if (typeof response.size !== 'number' || response.size <= 0) {
    throw new Error('Invalid file size in upload response');
  }
  
  if (!response.url || !response.url.startsWith('http')) {
    throw new Error('Invalid URL in upload response');
  }
  
  if (!response.key || response.key.length === 0) {
    throw new Error('Invalid key in upload response');
  }
}
/**
 * Mock S3 Service for Integration Tests
 *
 * Provides in-memory file storage for testing file upload operations
 * without requiring actual cloud storage (Cloudflare R2/AWS S3)
 */

export interface MockFile {
  key: string;
  buffer: Buffer;
  size: number;
  mimeType: string;
  originalName: string;
  uploadedAt: Date;
}

export class MockS3Service {
  private files = new Map<string, MockFile>();
  private baseUrl: string;

  constructor(baseUrl: string = 'https://test-cdn.example.com') {
    this.baseUrl = baseUrl;
  }

  /**
   * Upload a file to mock S3 storage
   */
  async upload(
    key: string,
    buffer: Buffer,
    metadata: {
      mimeType: string;
      originalName: string;
    }
  ): Promise<string> {
    const file: MockFile = {
      key,
      buffer,
      size: buffer.length,
      mimeType: metadata.mimeType,
      originalName: metadata.originalName,
      uploadedAt: new Date(),
    };

    this.files.set(key, file);

    console.log(`📤 [Mock S3] Uploaded: ${key} (${file.size} bytes)`);

    return this.getUrl(key);
  }

  /**
   * Copy a file from one key to another
   */
  async copy(sourceKey: string, destKey: string): Promise<void> {
    const sourceFile = this.files.get(sourceKey);

    if (!sourceFile) {
      throw new Error(`Source file not found: ${sourceKey}`);
    }

    const copiedFile: MockFile = {
      ...sourceFile,
      key: destKey,
      uploadedAt: new Date(),
    };

    this.files.set(destKey, copiedFile);

    console.log(`📋 [Mock S3] Copied: ${sourceKey} → ${destKey}`);
  }

  /**
   * Delete a file from mock S3 storage
   */
  async delete(key: string): Promise<void> {
    const deleted = this.files.delete(key);

    if (deleted) {
      console.log(`🗑️  [Mock S3] Deleted: ${key}`);
    } else {
      console.log(`⚠️  [Mock S3] File not found (already deleted?): ${key}`);
    }
  }

  /**
   * Check if a file exists in mock S3 storage
   */
  exists(key: string): boolean {
    return this.files.has(key);
  }

  /**
   * Get the public URL for a file
   */
  getUrl(key: string): string {
    return `${this.baseUrl}/${key}`;
  }

  /**
   * Get file metadata
   */
  getFile(key: string): MockFile | undefined {
    return this.files.get(key);
  }

  /**
   * Get all stored files (for debugging)
   */
  getAllFiles(): MockFile[] {
    return Array.from(this.files.values());
  }

  /**
   * Get total storage size
   */
  getTotalSize(): number {
    return Array.from(this.files.values()).reduce(
      (total, file) => total + file.size,
      0
    );
  }

  /**
   * Clear all files from storage
   */
  clear(): void {
    const count = this.files.size;
    this.files.clear();
    console.log(`🧹 [Mock S3] Cleared ${count} files from storage`);
  }

  /**
   * Get storage statistics
   */
  getStats(): {
    fileCount: number;
    totalSize: number;
    files: string[];
  } {
    return {
      fileCount: this.files.size,
      totalSize: this.getTotalSize(),
      files: Array.from(this.files.keys()),
    };
  }
}

// Singleton instance for tests
let mockS3Instance: MockS3Service | null = null;

/**
 * Get or create the mock S3 service instance
 */
export function getMockS3Service(): MockS3Service {
  if (!mockS3Instance) {
    mockS3Instance = new MockS3Service();
  }
  return mockS3Instance;
}

/**
 * Reset the mock S3 service instance
 */
export function resetMockS3Service(): void {
  if (mockS3Instance) {
    mockS3Instance.clear();
  }
  mockS3Instance = null;
}

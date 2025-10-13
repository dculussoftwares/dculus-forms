/**
 * DynamicImporter
 *
 * Handles dynamic import of JavaScript code from strings at runtime.
 * Uses Node.js dynamic import() with temporary file creation.
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';

export interface ImportResult<T = any> {
  success: boolean;
  module?: T;
  error?: string;
}

export class DynamicImporter {
  private static tempDir: string = path.join(os.tmpdir(), 'dculus-plugins');

  /**
   * Initialize the temporary directory for plugin imports
   */
  static async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
      console.log(`[DynamicImporter] Temp directory initialized: ${this.tempDir}`);
    } catch (error) {
      console.error('[DynamicImporter] Failed to initialize temp directory:', error);
      throw error;
    }
  }

  /**
   * Import JavaScript code as an ES module
   * @param code - JavaScript code string (must be ESM format)
   * @param pluginId - Unique identifier for the plugin
   * @returns ImportResult with the imported module or error
   */
  static async importCode<T = any>(code: string, pluginId: string): Promise<ImportResult<T>> {
    const tempFile = path.join(this.tempDir, `${pluginId}-${randomUUID()}.mjs`);

    try {
      // Write code to temporary file
      await fs.writeFile(tempFile, code, 'utf8');

      // Use dynamic import with file:// protocol
      const fileUrl = `file://${tempFile}`;
      const module = await import(fileUrl);

      console.log(`[DynamicImporter] Successfully imported plugin: ${pluginId}`);

      return {
        success: true,
        module: module as T,
      };
    } catch (error) {
      console.error(`[DynamicImporter] Failed to import plugin ${pluginId}:`, error);
      return {
        success: false,
        error: `Import failed: ${(error as Error).message}`,
      };
    } finally {
      // Clean up temporary file
      try {
        await fs.unlink(tempFile);
      } catch (cleanupError) {
        console.warn(`[DynamicImporter] Failed to cleanup temp file ${tempFile}:`, cleanupError);
      }
    }
  }

  /**
   * Import plugin class from code string
   * Expects the module to have a default export that is a plugin class
   */
  static async importPluginClass(code: string, pluginId: string): Promise<ImportResult<any>> {
    const result = await this.importCode(code, pluginId);

    if (!result.success) {
      return result;
    }

    // Check for default export
    if (!result.module?.default) {
      return {
        success: false,
        error: 'Plugin module does not have a default export',
      };
    }

    // Verify it's a class/constructor
    const PluginClass = result.module.default;
    if (typeof PluginClass !== 'function') {
      return {
        success: false,
        error: 'Plugin default export is not a class or constructor function',
      };
    }

    return {
      success: true,
      module: PluginClass,
    };
  }

  /**
   * Clean up old temporary plugin files (older than 1 hour)
   */
  static async cleanupOldFiles(): Promise<void> {
    try {
      const files = await fs.readdir(this.tempDir);
      const now = Date.now();
      const oneHour = 60 * 60 * 1000;

      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = await fs.stat(filePath);
        const age = now - stats.mtimeMs;

        if (age > oneHour) {
          await fs.unlink(filePath);
          console.log(`[DynamicImporter] Cleaned up old temp file: ${file}`);
        }
      }
    } catch (error) {
      console.warn('[DynamicImporter] Cleanup failed:', error);
    }
  }

  /**
   * Clear all temporary plugin files
   */
  static async clearAll(): Promise<void> {
    try {
      const files = await fs.readdir(this.tempDir);
      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        await fs.unlink(filePath);
      }
      console.log(`[DynamicImporter] Cleared all temp files (${files.length} files)`);
    } catch (error) {
      console.warn('[DynamicImporter] Failed to clear temp files:', error);
    }
  }
}

// Initialize temp directory on module load
DynamicImporter.initialize().catch(console.error);

// Cleanup old files every hour
setInterval(() => {
  DynamicImporter.cleanupOldFiles().catch(console.error);
}, 60 * 60 * 1000);

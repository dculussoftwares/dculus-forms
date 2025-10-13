/**
 * BundleValidator
 *
 * Validates external plugin bundles and manifests before installation.
 * Ensures security and compliance with expected plugin structure.
 */

import { z } from 'zod';

/**
 * Manifest schema for external plugins
 */
const ManifestSchema = z.object({
  id: z.string().min(1, 'Plugin ID is required'),
  name: z.string().min(1, 'Plugin name is required'),
  description: z.string().min(1, 'Plugin description is required'),
  icon: z.string().min(1, 'Plugin icon is required'),
  category: z.string().min(1, 'Plugin category is required'),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must be in semver format (e.g., 1.0.0)'),
  bundles: z.object({
    backend: z.string().min(1, 'Backend bundle filename is required'),
    frontend: z.string().min(1, 'Frontend bundle filename is required'),
  }),
  author: z.union([
    z.string(),
    z.object({
      name: z.string(),
      email: z.string().email().optional(),
      url: z.string().url().optional(),
    }),
  ]).optional(),
  homepage: z.string().url().optional(),
  repository: z.union([
    z.string().url(),
    z.object({
      type: z.string(),
      url: z.string().url(),
    }),
  ]).optional(),
  license: z.string().optional(),
  permissions: z.array(z.string()).optional(),
  minVersion: z.string().optional(),
  maxVersion: z.string().optional(),
});

export type PluginManifest = z.infer<typeof ManifestSchema>;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class BundleValidator {
  /**
   * Validate plugin manifest
   */
  static validateManifest(manifestData: unknown): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    };

    try {
      // Parse and validate with Zod schema
      ManifestSchema.parse(manifestData);

      // Additional validation checks
      const manifest = manifestData as PluginManifest;

      // Check for reserved plugin IDs
      const reservedIds = ['system', 'admin', 'internal', 'dculus'];
      if (reservedIds.some(reserved => manifest.id.startsWith(reserved))) {
        result.warnings.push(`Plugin ID '${manifest.id}' uses a reserved prefix`);
      }

      // Check bundle filenames
      if (!manifest.bundles.backend.endsWith('.js')) {
        result.errors.push('Backend bundle must be a .js file');
        result.valid = false;
      }

      if (!manifest.bundles.frontend.endsWith('.js')) {
        result.errors.push('Frontend bundle must be a .js file');
        result.valid = false;
      }

      // Check category is valid
      const validCategories = ['automation', 'integration', 'notification', 'analytics', 'storage', 'other'];
      if (!validCategories.includes(manifest.category)) {
        result.warnings.push(
          `Category '${manifest.category}' is not a standard category. Valid categories: ${validCategories.join(', ')}`
        );
      }

    } catch (error) {
      result.valid = false;
      if (error instanceof z.ZodError) {
        // Safely map Zod errors
        if (error.errors && Array.isArray(error.errors)) {
          result.errors = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
        } else {
          result.errors.push('Manifest validation failed: Invalid schema');
        }
      } else {
        result.errors.push(`Manifest validation failed: ${(error as Error).message}`);
      }
    }

    return result;
  }

  /**
   * Validate backend bundle code
   * Performs basic checks on the JavaScript code
   */
  static validateBackendBundle(code: string): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    };

    if (!code || code.trim().length === 0) {
      result.valid = false;
      result.errors.push('Backend bundle is empty');
      return result;
    }

    // Check for ESM export
    if (!code.includes('export') && !code.includes('module.exports')) {
      result.warnings.push('Backend bundle does not appear to export anything');
    }

    // Check for suspicious patterns (basic security check)
    const suspiciousPatterns = [
      { pattern: /require\s*\(\s*['"]child_process['"]\s*\)/, message: 'Uses child_process (potential security risk)' },
      { pattern: /require\s*\(\s*['"]fs['"]\s*\)/, message: 'Direct filesystem access detected' },
      { pattern: /eval\s*\(/, message: 'Contains eval() which is a security risk' },
      { pattern: /Function\s*\(/, message: 'Contains Function constructor which is a security risk' },
    ];

    for (const { pattern, message } of suspiciousPatterns) {
      if (pattern.test(code)) {
        result.warnings.push(message);
      }
    }

    // Check bundle size (warn if > 5MB)
    const sizeInMB = Buffer.byteLength(code, 'utf8') / (1024 * 1024);
    if (sizeInMB > 5) {
      result.warnings.push(`Backend bundle is large (${sizeInMB.toFixed(2)}MB). Consider optimizing.`);
    }

    return result;
  }

  /**
   * Validate frontend bundle code
   */
  static validateFrontendBundle(code: string): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    };

    if (!code || code.trim().length === 0) {
      result.valid = false;
      result.errors.push('Frontend bundle is empty');
      return result;
    }

    // Check for UMD/IIFE pattern
    const hasUMD = code.includes('typeof exports') || code.includes('typeof define');
    const hasIIFE = /\(function\s*\(/.test(code) || /\(\(\)\s*=>\s*{/.test(code);

    if (!hasUMD && !hasIIFE) {
      result.warnings.push('Frontend bundle does not appear to be in UMD or IIFE format');
    }

    // Check bundle size (warn if > 2MB for frontend)
    const sizeInMB = Buffer.byteLength(code, 'utf8') / (1024 * 1024);
    if (sizeInMB > 2) {
      result.warnings.push(`Frontend bundle is large (${sizeInMB.toFixed(2)}MB). Consider optimizing.`);
    }

    return result;
  }

  /**
   * Validate complete plugin package
   */
  static validatePlugin(manifest: unknown, backendCode: string, frontendCode: string): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    };

    // Validate manifest
    const manifestResult = this.validateManifest(manifest);
    result.errors.push(...manifestResult.errors);
    result.warnings.push(...manifestResult.warnings);
    if (!manifestResult.valid) {
      result.valid = false;
    }

    // Validate backend bundle
    const backendResult = this.validateBackendBundle(backendCode);
    result.errors.push(...backendResult.errors);
    result.warnings.push(...backendResult.warnings);
    if (!backendResult.valid) {
      result.valid = false;
    }

    // Validate frontend bundle
    const frontendResult = this.validateFrontendBundle(frontendCode);
    result.errors.push(...frontendResult.errors);
    result.warnings.push(...frontendResult.warnings);
    if (!frontendResult.valid) {
      result.valid = false;
    }

    return result;
  }
}

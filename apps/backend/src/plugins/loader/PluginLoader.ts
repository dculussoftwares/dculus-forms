/**
 * PluginLoader
 *
 * Orchestrates the installation, validation, and loading of external plugins.
 * Downloads plugin bundles from URLs, validates them, stores in database, and registers with PluginRegistry.
 */

import { prisma } from '../../lib/prisma';
import { BundleValidator, PluginManifest } from './BundleValidator';
import { DynamicImporter } from './DynamicImporter';
import { pluginRegistry } from '../registry';
import { PluginContext } from '../base/PluginContext';
import type { BasePlugin } from '../base/BasePlugin';

export interface InstallResult {
  success: boolean;
  pluginId?: string;
  message: string;
  warnings?: string[];
}

export class PluginLoader {
  /**
   * Fetch manifest.json from plugin URL
   */
  private static async fetchManifest(baseUrl: string): Promise<PluginManifest> {
    const manifestUrl = baseUrl.endsWith('/') ? `${baseUrl}manifest.json` : `${baseUrl}/manifest.json`;

    try {
      const response = await fetch(manifestUrl);

      if (!response.ok) {
        throw new Error(`Failed to fetch manifest: HTTP ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        throw new Error(`Invalid manifest content-type: ${contentType}. Expected application/json`);
      }

      const manifestData = await response.json();
      return manifestData as PluginManifest;
    } catch (error) {
      throw new Error(`Failed to fetch manifest from ${manifestUrl}: ${(error as Error).message}`);
    }
  }

  /**
   * Fetch bundle file from plugin URL
   */
  private static async fetchBundle(baseUrl: string, filename: string): Promise<string> {
    const bundleUrl = baseUrl.endsWith('/') ? `${baseUrl}${filename}` : `${baseUrl}/${filename}`;

    try {
      const response = await fetch(bundleUrl);

      if (!response.ok) {
        throw new Error(`Failed to fetch bundle: HTTP ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('javascript') && !contentType?.includes('text/plain')) {
        throw new Error(`Invalid bundle content-type: ${contentType}. Expected JavaScript`);
      }

      const code = await response.text();
      return code;
    } catch (error) {
      throw new Error(`Failed to fetch bundle from ${bundleUrl}: ${(error as Error).message}`);
    }
  }

  /**
   * Install external plugin from URL
   */
  static async installFromUrl(url: string, organizationId: string): Promise<InstallResult> {
    try {
      console.log(`[PluginLoader] Starting installation from URL: ${url}`);

      // Normalize URL (remove trailing slash)
      const baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;

      // Step 1: Fetch manifest
      console.log('[PluginLoader] Step 1: Fetching manifest...');
      const manifest = await this.fetchManifest(baseUrl);
      console.log(`[PluginLoader] Manifest fetched: ${manifest.id} v${manifest.version}`);

      // Step 2: Fetch bundles
      console.log('[PluginLoader] Step 2: Fetching bundles...');
      const backendCode = await this.fetchBundle(baseUrl, manifest.bundles.backend);
      const frontendCode = await this.fetchBundle(baseUrl, manifest.bundles.frontend);
      console.log(`[PluginLoader] Bundles fetched (backend: ${backendCode.length} bytes, frontend: ${frontendCode.length} bytes)`);

      // Step 3: Validate plugin
      console.log('[PluginLoader] Step 3: Validating plugin...');
      const validationResult = BundleValidator.validatePlugin(manifest, backendCode, frontendCode);

      if (!validationResult.valid) {
        return {
          success: false,
          message: `Plugin validation failed: ${validationResult.errors.join(', ')}`,
        };
      }

      if (validationResult.warnings.length > 0) {
        console.warn('[PluginLoader] Validation warnings:', validationResult.warnings);
      }

      // Step 4: Check if plugin already exists
      const existingPlugin = await prisma.plugin.findUnique({
        where: { id: manifest.id },
      });

      if (existingPlugin) {
        return {
          success: false,
          message: `Plugin '${manifest.id}' is already installed. Use update endpoint to upgrade.`,
        };
      }

      // Step 5: Store plugin in database
      console.log('[PluginLoader] Step 4: Storing plugin in database...');
      const plugin = await prisma.plugin.create({
        data: {
          id: manifest.id,
          name: manifest.name,
          description: manifest.description,
          icon: manifest.icon,
          category: manifest.category,
          version: manifest.version,
          isActive: true,
          isExternal: true,
          installUrl: baseUrl,
          installSource: 'url',
          backendCode: backendCode,
          frontendCode: frontendCode,
          manifest: manifest as any,
        },
      });

      console.log(`[PluginLoader] Plugin stored in database: ${plugin.id}`);

      // Step 6: Load and register plugin
      console.log('[PluginLoader] Step 5: Loading and registering plugin...');
      const loadResult = await this.loadExternalPlugin(plugin.id, organizationId);

      if (!loadResult.success) {
        // Rollback: Delete plugin from database
        await prisma.plugin.delete({ where: { id: plugin.id } });
        return {
          success: false,
          message: `Plugin installation failed during registration: ${loadResult.message}`,
        };
      }

      console.log(`[PluginLoader] ✅ Plugin '${manifest.id}' installed successfully`);

      return {
        success: true,
        pluginId: manifest.id,
        message: `Plugin '${manifest.name}' v${manifest.version} installed successfully`,
        warnings: validationResult.warnings.length > 0 ? validationResult.warnings : undefined,
      };
    } catch (error) {
      console.error('[PluginLoader] Installation failed:', error);
      return {
        success: false,
        message: `Installation failed: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Load external plugin from database and register with PluginRegistry
   */
  static async loadExternalPlugin(pluginId: string, organizationId: string): Promise<InstallResult> {
    try {
      // Fetch plugin from database
      const plugin = await prisma.plugin.findUnique({
        where: { id: pluginId },
      });

      if (!plugin) {
        return {
          success: false,
          message: `Plugin '${pluginId}' not found in database`,
        };
      }

      if (!plugin.isExternal) {
        return {
          success: false,
          message: `Plugin '${pluginId}' is not an external plugin`,
        };
      }

      if (!plugin.backendCode) {
        return {
          success: false,
          message: `Plugin '${pluginId}' has no backend code`,
        };
      }

      // Import plugin class using DynamicImporter
      const importResult = await DynamicImporter.importPluginClass(plugin.backendCode, pluginId);

      if (!importResult.success) {
        return {
          success: false,
          message: importResult.error || 'Failed to import plugin class',
        };
      }

      const PluginClass = importResult.module;

      // Instantiate plugin with Prisma client injected
      const pluginInstance: BasePlugin = new PluginClass(prisma);

      // Verify plugin has required properties and methods
      if (!pluginInstance.metadata || typeof pluginInstance.getConfigSchema !== 'function' || typeof pluginInstance.onFormSubmitted !== 'function') {
        return {
          success: false,
          message: 'Plugin class does not extend BasePlugin correctly',
        };
      }

      // Register plugin with PluginRegistry
      pluginRegistry.register(pluginInstance, organizationId);

      console.log(`[PluginLoader] ✅ Plugin '${pluginId}' loaded and registered for org ${organizationId}`);

      return {
        success: true,
        pluginId: pluginId,
        message: `Plugin '${plugin.name}' loaded successfully`,
      };
    } catch (error) {
      console.error(`[PluginLoader] Failed to load plugin ${pluginId}:`, error);
      return {
        success: false,
        message: `Failed to load plugin: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Uninstall external plugin
   */
  static async uninstallPlugin(pluginId: string, organizationId: string): Promise<InstallResult> {
    try {
      console.log(`[PluginLoader] Uninstalling plugin: ${pluginId}`);

      // Check if plugin exists
      const plugin = await prisma.plugin.findUnique({
        where: { id: pluginId },
      });

      if (!plugin) {
        return {
          success: false,
          message: `Plugin '${pluginId}' not found`,
        };
      }

      if (!plugin.isExternal) {
        return {
          success: false,
          message: `Cannot uninstall built-in plugin '${pluginId}'`,
        };
      }

      // Unregister from PluginRegistry
      pluginRegistry.unregister(pluginId, organizationId);

      // Delete all FormPluginConfig records for this plugin
      await prisma.formPluginConfig.deleteMany({
        where: { pluginId: pluginId },
      });

      // Delete plugin from database
      await prisma.plugin.delete({
        where: { id: pluginId },
      });

      console.log(`[PluginLoader] ✅ Plugin '${pluginId}' uninstalled successfully`);

      return {
        success: true,
        pluginId: pluginId,
        message: `Plugin '${plugin.name}' uninstalled successfully`,
      };
    } catch (error) {
      console.error(`[PluginLoader] Failed to uninstall plugin ${pluginId}:`, error);
      return {
        success: false,
        message: `Uninstall failed: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Update external plugin to latest version from URL
   */
  static async updatePlugin(pluginId: string, organizationId: string): Promise<InstallResult> {
    try {
      console.log(`[PluginLoader] Updating plugin: ${pluginId}`);

      // Get existing plugin
      const existingPlugin = await prisma.plugin.findUnique({
        where: { id: pluginId },
      });

      if (!existingPlugin) {
        return {
          success: false,
          message: `Plugin '${pluginId}' not found`,
        };
      }

      if (!existingPlugin.isExternal || !existingPlugin.installUrl) {
        return {
          success: false,
          message: `Plugin '${pluginId}' is not an external plugin or has no install URL`,
        };
      }

      const baseUrl = existingPlugin.installUrl;

      // Fetch latest manifest
      const manifest = await this.fetchManifest(baseUrl);

      // Check version
      if (manifest.version === existingPlugin.version) {
        return {
          success: true,
          pluginId: pluginId,
          message: `Plugin '${manifest.name}' is already up to date (v${manifest.version})`,
        };
      }

      // Fetch new bundles
      const backendCode = await this.fetchBundle(baseUrl, manifest.bundles.backend);
      const frontendCode = await this.fetchBundle(baseUrl, manifest.bundles.frontend);

      // Validate
      const validationResult = BundleValidator.validatePlugin(manifest, backendCode, frontendCode);

      if (!validationResult.valid) {
        return {
          success: false,
          message: `Plugin validation failed: ${validationResult.errors.join(', ')}`,
        };
      }

      // Unregister old version
      pluginRegistry.unregister(pluginId, organizationId);

      // Update in database
      await prisma.plugin.update({
        where: { id: pluginId },
        data: {
          version: manifest.version,
          name: manifest.name,
          description: manifest.description,
          icon: manifest.icon,
          category: manifest.category,
          backendCode: backendCode,
          frontendCode: frontendCode,
          manifest: manifest as any,
          updatedAt: new Date(),
        },
      });

      // Load and register new version
      const loadResult = await this.loadExternalPlugin(pluginId, organizationId);

      if (!loadResult.success) {
        return {
          success: false,
          message: `Plugin update failed during registration: ${loadResult.message}`,
        };
      }

      console.log(`[PluginLoader] ✅ Plugin '${pluginId}' updated from v${existingPlugin.version} to v${manifest.version}`);

      return {
        success: true,
        pluginId: pluginId,
        message: `Plugin '${manifest.name}' updated to v${manifest.version}`,
        warnings: validationResult.warnings.length > 0 ? validationResult.warnings : undefined,
      };
    } catch (error) {
      console.error(`[PluginLoader] Failed to update plugin ${pluginId}:`, error);
      return {
        success: false,
        message: `Update failed: ${(error as Error).message}`,
      };
    }
  }
}

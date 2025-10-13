/**
 * Plugin Registry
 *
 * Central registry for all plugins. Handles plugin registration,
 * event listener setup, and plugin discovery.
 * Supports both built-in plugins and organization-scoped external plugins.
 */

import { eventBus } from '../lib/events.js';
import { prisma } from '../lib/prisma.js';
import type { BasePlugin } from './base/BasePlugin.js';

class PluginRegistry {
  private plugins: Map<string, BasePlugin> = new Map();
  // Organization-scoped plugins: Map<organizationId, Map<pluginId, plugin>>
  private organizationPlugins: Map<string, Map<string, BasePlugin>> = new Map();
  private initialized = false;

  /**
   * Register a plugin and set up its event listeners
   * @param plugin - Plugin instance to register
   * @param organizationId - Optional organization ID for scoped external plugins
   */
  register(plugin: BasePlugin, organizationId?: string): void {
    if (organizationId) {
      // Register organization-scoped external plugin
      if (!this.organizationPlugins.has(organizationId)) {
        this.organizationPlugins.set(organizationId, new Map());
      }

      const orgPlugins = this.organizationPlugins.get(organizationId)!;

      if (orgPlugins.has(plugin.metadata.id)) {
        console.warn(
          `[PluginRegistry] Plugin ${plugin.metadata.id} is already registered for org ${organizationId}. Skipping.`
        );
        return;
      }

      console.log(
        `[PluginRegistry] Registering plugin for org ${organizationId}: ${plugin.metadata.name} (${plugin.metadata.id})`
      );

      orgPlugins.set(plugin.metadata.id, plugin);

      // Set up event listener for form.submitted
      eventBus.on('form.submitted', async (event: any) => {
        // Only execute if event is for this organization
        if (event.organizationId === organizationId) {
          await plugin.execute(event);
        }
      });

      console.log(
        `[PluginRegistry] Plugin ${plugin.metadata.id} is now listening to form.submitted events for org ${organizationId}`
      );
    } else {
      // Register global built-in plugin
      if (this.plugins.has(plugin.metadata.id)) {
        console.warn(
          `[PluginRegistry] Plugin ${plugin.metadata.id} is already registered. Skipping.`
        );
        return;
      }

      console.log(
        `[PluginRegistry] Registering plugin: ${plugin.metadata.name} (${plugin.metadata.id})`
      );

      // Store plugin instance
      this.plugins.set(plugin.metadata.id, plugin);

      // Set up event listener for form.submitted
      eventBus.on('form.submitted', async (event: any) => {
        await plugin.execute(event);
      });

      console.log(
        `[PluginRegistry] Plugin ${plugin.metadata.id} is now listening to form.submitted events`
      );
    }
  }

  /**
   * Get a plugin by ID
   */
  get(pluginId: string): BasePlugin | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * Get all registered plugins
   */
  getAll(): BasePlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get plugin metadata only (for GraphQL queries)
   * Returns complete metadata from database including isActive, createdAt, updatedAt
   */
  async getAllMetadata() {
    const pluginIds = Array.from(this.plugins.keys());

    // Query database for complete plugin metadata
    const dbPlugins = await prisma.plugin.findMany({
      where: {
        id: { in: pluginIds },
      },
    });

    return dbPlugins;
  }

  /**
   * Check if a plugin is registered
   */
  has(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  /**
   * Unregister a plugin
   * @param pluginId - Plugin ID to unregister
   * @param organizationId - Optional organization ID for scoped external plugins
   */
  unregister(pluginId: string, organizationId?: string): void {
    if (organizationId) {
      // Unregister organization-scoped external plugin
      const orgPlugins = this.organizationPlugins.get(organizationId);
      if (orgPlugins && orgPlugins.has(pluginId)) {
        orgPlugins.delete(pluginId);

        // Clean up empty organization map
        if (orgPlugins.size === 0) {
          this.organizationPlugins.delete(organizationId);
        }

        console.log(`[PluginRegistry] Unregistered plugin ${pluginId} for org ${organizationId}`);
      } else {
        console.warn(`[PluginRegistry] Plugin ${pluginId} not found for org ${organizationId}`);
      }
    } else {
      // Unregister global built-in plugin
      const plugin = this.plugins.get(pluginId);
      if (plugin) {
        // Remove all event listeners for this plugin
        eventBus.removeAllListeners();

        // Re-register remaining plugins
        const remainingPlugins = Array.from(this.plugins.values()).filter(
          (p) => p.metadata.id !== pluginId
        );

        this.plugins.delete(pluginId);

        remainingPlugins.forEach((p) => {
          eventBus.on('form.submitted', async (event: any) => {
            await p.execute(event);
          });
        });

        console.log(`[PluginRegistry] Unregistered plugin: ${pluginId}`);
      }
    }
  }

  /**
   * Initialize the plugin system
   * - Syncs plugin metadata to database
   * - Sets up event listeners
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('[PluginRegistry] Already initialized. Skipping.');
      return;
    }

    console.log('[PluginRegistry] Initializing plugin system...');

    // Sync plugin metadata to database
    await this.syncPluginsToDatabase();

    this.initialized = true;
    console.log(
      `[PluginRegistry] Initialized ${this.plugins.size} plugin(s):`,
      Array.from(this.plugins.keys())
    );
  }

  /**
   * Sync registered plugins to database
   * This ensures the Plugin table always has up-to-date metadata
   */
  private async syncPluginsToDatabase(): Promise<void> {
    console.log('[PluginRegistry] Syncing plugins to database...');

    for (const plugin of this.plugins.values()) {
      try {
        await prisma.plugin.upsert({
          where: { id: plugin.metadata.id },
          update: {
            name: plugin.metadata.name,
            description: plugin.metadata.description,
            icon: plugin.metadata.icon,
            category: plugin.metadata.category,
            version: plugin.metadata.version,
            isActive: true,
          },
          create: {
            id: plugin.metadata.id,
            name: plugin.metadata.name,
            description: plugin.metadata.description,
            icon: plugin.metadata.icon,
            category: plugin.metadata.category,
            version: plugin.metadata.version,
            isActive: true,
          },
        });

        console.log(
          `[PluginRegistry] Synced plugin to database: ${plugin.metadata.id}`
        );
      } catch (error) {
        console.error(
          `[PluginRegistry] Error syncing plugin ${plugin.metadata.id}:`,
          error
        );
      }
    }
  }

  /**
   * Get plugin statistics for debugging
   */
  getStats() {
    return {
      totalPlugins: this.plugins.size,
      registeredPlugins: Array.from(this.plugins.keys()),
      eventListeners: {
        'form.submitted': eventBus.listenerCount('form.submitted'),
      },
    };
  }
}

// Export singleton instance
export const pluginRegistry = new PluginRegistry();

// Also export class for type checking
export { PluginRegistry };

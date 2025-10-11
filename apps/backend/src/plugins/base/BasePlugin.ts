/**
 * Base Plugin Class
 *
 * All plugins must extend this class and implement the required methods.
 * Provides common functionality for configuration management and event handling.
 */

import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import type { FormSubmittedEvent } from '../../lib/events.js';

export interface PluginMetadata {
  id: string; // Unique plugin identifier (e.g., 'hello-world')
  name: string; // Display name (e.g., 'Hello World')
  description: string; // Short description
  icon: string; // Emoji or icon identifier
  category: string; // Category for filtering (e.g., 'automation', 'email')
  version: string; // Semantic version (e.g., '1.0.0')
}

export interface PluginConfig {
  isEnabled: boolean;
  [key: string]: any; // Plugin-specific configuration
}

/**
 * Abstract base class for all plugins
 */
export abstract class BasePlugin {
  public readonly metadata: PluginMetadata;

  constructor(metadata: PluginMetadata) {
    this.metadata = metadata;
  }

  /**
   * Get the Zod schema for validating plugin configuration
   * Each plugin must define its own schema
   */
  abstract getConfigSchema(): z.ZodSchema;

  /**
   * Handle form submission event
   * Override this method to implement custom logic
   */
  abstract onFormSubmitted(event: FormSubmittedEvent): Promise<void>;

  /**
   * Get plugin configuration for a specific form
   */
  async getConfig(formId: string): Promise<PluginConfig | null> {
    try {
      const config = await prisma.formPluginConfig.findUnique({
        where: {
          formId_pluginId: {
            formId,
            pluginId: this.metadata.id,
          },
        },
      });

      if (!config) {
        return null;
      }

      return config.config as PluginConfig;
    } catch (error) {
      console.error(
        `[Plugin: ${this.metadata.id}] Error fetching config for form ${formId}:`,
        error
      );
      return null;
    }
  }

  /**
   * Validate configuration against plugin schema
   */
  validateConfig(config: unknown) {
    const schema = this.getConfigSchema();
    return schema.safeParse(config);
  }

  /**
   * Called when plugin is enabled (optional lifecycle hook)
   */
  async onEnabled(formId: string, config: PluginConfig): Promise<void> {
    console.log(`[Plugin: ${this.metadata.id}] Enabled for form: ${formId}`);
  }

  /**
   * Called when plugin is disabled (optional lifecycle hook)
   */
  async onDisabled(formId: string): Promise<void> {
    console.log(`[Plugin: ${this.metadata.id}] Disabled for form: ${formId}`);
  }

  /**
   * Called when plugin is uninstalled (optional lifecycle hook)
   */
  async onUninstalled(formId: string): Promise<void> {
    console.log(
      `[Plugin: ${this.metadata.id}] Uninstalled from form: ${formId}`
    );
  }

  /**
   * Execute the plugin handler with error isolation
   * This ensures plugin failures don't break the main application
   */
  async execute(event: FormSubmittedEvent): Promise<void> {
    try {
      // Check if plugin is enabled for this form
      const config = await this.getConfig(event.formId);

      if (!config) {
        // Plugin not configured for this form
        return;
      }

      if (!config.isEnabled) {
        // Plugin is disabled
        return;
      }

      // Execute the plugin-specific logic
      await this.onFormSubmitted(event);
    } catch (error) {
      console.error(
        `[Plugin: ${this.metadata.id}] Error executing plugin:`,
        error
      );
      // Error is logged but not thrown - plugin failures are isolated
    }
  }
}

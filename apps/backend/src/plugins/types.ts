import type { PluginContext } from './context.js';

/**
 * Base plugin configuration interface
 * All plugin configs must extend this
 */
export interface PluginConfig {
  type: string;
  [key: string]: any;
}

/**
 * Plugin event structure
 * Contains all data needed for plugin execution
 */
export interface PluginEvent {
  type: 'form.submitted' | 'plugin.test';
  formId: string;
  organizationId: string;
  data: Record<string, any>;
  timestamp: Date;
}

/**
 * Plugin handler function signature
 * All plugin handlers must implement this signature
 *
 * @param plugin - Plugin configuration with config object
 * @param event - Event data that triggered the plugin
 * @param context - Plugin context with helper functions
 * @returns Promise with plugin execution result
 */
export type PluginHandler = (
  plugin: { config: PluginConfig },
  event: PluginEvent,
  context: PluginContext
) => Promise<any>;

/**
 * Webhook plugin configuration
 */
export interface WebhookPluginConfig extends PluginConfig {
  type: 'webhook';
  url: string;
  secret?: string;
  headers?: Record<string, string>;
}

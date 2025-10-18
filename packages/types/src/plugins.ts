/**
 * Shared Plugin Types
 * Types used by both frontend and backend for plugin functionality
 */

/**
 * Plugin event types
 */
export type PluginEventType = 'form.submitted' | 'plugin.test';

/**
 * Plugin types
 */
export type PluginType = 'webhook' | 'email' | 'slack';

/**
 * Plugin delivery status
 */
export type PluginDeliveryStatus = 'success' | 'failed';

/**
 * Base plugin configuration
 */
export interface BasePluginConfig {
  type: PluginType;
  [key: string]: any;
}

/**
 * Webhook plugin configuration
 */
export interface WebhookPluginConfig extends BasePluginConfig {
  type: 'webhook';
  url: string;
  secret?: string;
  headers?: Record<string, string>;
}

/**
 * Form plugin from database
 */
export interface FormPlugin {
  id: string;
  formId: string;
  type: PluginType;
  name: string;
  enabled: boolean;
  config: BasePluginConfig;
  events: PluginEventType[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Plugin delivery record from database
 */
export interface PluginDelivery {
  id: string;
  pluginId: string;
  eventType: PluginEventType;
  status: PluginDeliveryStatus;
  payload: Record<string, any>;
  response?: Record<string, any>;
  errorMessage?: string;
  deliveredAt: string;
}

/**
 * Create plugin input
 */
export interface CreatePluginInput {
  formId: string;
  type: PluginType;
  name: string;
  config: BasePluginConfig;
  events: PluginEventType[];
  enabled?: boolean;
}

/**
 * Update plugin input
 */
export interface UpdatePluginInput {
  name?: string;
  config?: BasePluginConfig;
  events?: PluginEventType[];
  enabled?: boolean;
}

/**
 * Plugin mutation response
 */
export interface PluginMutationResponse {
  success: boolean;
  message: string;
}

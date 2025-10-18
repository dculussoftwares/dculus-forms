import type { WebhookPluginConfig } from '../types.js';

/**
 * Webhook Plugin Types
 * Defines interfaces specific to webhook plugin functionality
 */

/**
 * Webhook payload structure
 * Minimal payload with IDs only, webhook recipient must query API for full data
 */
export interface WebhookPayload {
  event: string;
  formId: string;
  organizationId: string;
  responseId?: string;
  timestamp: string;
  data: Record<string, any>;
}

/**
 * Webhook delivery result
 */
export interface WebhookDeliveryResult {
  success: boolean;
  statusCode?: number;
  responseBody?: any;
  error?: string;
  deliveryTime: number; // milliseconds
}

/**
 * Extended webhook config with validated fields
 */
export interface ValidatedWebhookConfig extends WebhookPluginConfig {
  url: string;
  secret?: string;
  headers?: Record<string, string>;
}

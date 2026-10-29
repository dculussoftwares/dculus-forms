import type { PluginConfig } from '../core/types.js';

export interface WebhookPluginConfig extends PluginConfig {
  type: 'webhook';
  url: string;
  secret?: string;
  headers?: Record<string, string>;
}

export interface WebhookPayload {
  event: string;
  formId: string;
  organizationId: string;
  responseId?: string;
  timestamp: string;
  data: Record<string, any>;
}

export interface WebhookDeliveryResult {
  success: boolean;
  statusCode?: number;
  /** Short truncated excerpt of the receiver's reply — never the full body. */
  responseExcerpt?: string;
  error?: string;
  deliveryTime: number;
}

export type ValidatedWebhookConfig = WebhookPluginConfig;

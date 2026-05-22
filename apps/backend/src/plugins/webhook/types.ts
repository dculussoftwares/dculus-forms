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
  responseBody?: any;
  error?: string;
  deliveryTime: number;
}

export type ValidatedWebhookConfig = WebhookPluginConfig;

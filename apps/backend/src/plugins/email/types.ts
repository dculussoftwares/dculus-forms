import type { PluginConfig } from '../core/types.js';

export interface EmailPluginConfig extends PluginConfig {
  type: 'email';
  recipientEmail: string;
  subject: string;
  message: string;
  sendToSubmitter?: boolean;
}

export const EMAIL_PLUGIN_TYPE = 'email' as const;

export type ValidatedEmailConfig = EmailPluginConfig;

export interface EmailDeliveryResult {
  success: boolean;
  recipient: string;
  subject: string;
  error?: string;
}

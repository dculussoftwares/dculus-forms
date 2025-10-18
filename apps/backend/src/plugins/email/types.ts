import type { PluginConfig } from '../types.js';

/**
 * Email Plugin Configuration
 * Defines settings for email notification plugin
 */
export interface EmailPluginConfig extends PluginConfig {
  type: 'email';
  recipientEmail: string; // Email address to send notifications to
  subject: string; // Email subject line
  message: string; // Rich HTML message body (supports mentions)
  sendToSubmitter?: boolean; // Future: send email to form submitter
}

/**
 * Email plugin type identifier
 */
export const EMAIL_PLUGIN_TYPE = 'email' as const;

/**
 * Validated email config (after validation)
 */
export type ValidatedEmailConfig = EmailPluginConfig;

/**
 * Email delivery result structure
 */
export interface EmailDeliveryResult {
  success: boolean;
  recipient: string;
  subject: string;
  error?: string;
}

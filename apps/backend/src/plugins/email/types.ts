import type { PluginConfig } from '../core/types.js';

export interface EmailPluginConfig extends PluginConfig {
  type: 'email';
  /** Static free-text recipient address. At least one of recipientEmail / recipientFieldId is required. */
  recipientEmail?: string;
  /** ID of an EmailField in the form; its response value is used as an additional recipient at send time. */
  recipientFieldId?: string;
  /** Denormalized label of recipientFieldId, cached at save time for display (same pattern as quiz plugin's fieldLabel). */
  recipientFieldLabel?: string;
  subject: string;
  message: string;
  sendToSubmitter?: boolean;
}

export const EMAIL_PLUGIN_TYPE = 'email' as const;

export type ValidatedEmailConfig = EmailPluginConfig;

export interface EmailDeliveryResult {
  success: boolean;
  /** Comma-separated list of addresses actually sent to; empty string when skipped. */
  recipient: string;
  subject: string;
  /** True when no recipient could be resolved and sendEmail was never called. */
  skipped?: boolean;
  skipReason?: string;
  error?: string;
}

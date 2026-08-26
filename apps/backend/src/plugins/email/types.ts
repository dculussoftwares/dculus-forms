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
  /** ID of a PdfTemplate (this form's) to render for the response and attach to the email. Optional. */
  attachPdfTemplateId?: string;
  /** Denormalized name of attachPdfTemplateId, cached at save time for display (same pattern as recipientFieldLabel). */
  attachPdfTemplateName?: string;
  /** When true and event.data.__digestResponses is present (schedule automation w/ a digest node), appends an HTML table listing each new response's answers to the end of the email body. Ignored outside a digest context. */
  includeDigestTable?: boolean;
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
  /** Filename of the PDF attached to this send, when attachPdfTemplateId was configured and generation succeeded. */
  attachedPdfFilename?: string;
  /** Set when attachPdfTemplateId was configured but the PDF could not be generated — the email is still sent without the attachment. */
  attachmentError?: string;
  /**
   * Set instead of the single-send fields above for a per-response digest batch send
   * (#automations-digest-per-response) — recipientFieldId on a schedule automation with an
   * upstream digest node sends once per matched response, each to that response's own field
   * value, rather than once for the whole batch.
   */
  sentCount?: number;
  skippedCount?: number;
  failedCount?: number;
}

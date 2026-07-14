import {
  deserializeFormSchema,
  extractEmailFields,
  FillableFormField,
  FileUploadField,
  type FormSchema,
} from '@dculus/types';
import { escapeHtml } from '@dculus/utils';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { sendEmail } from './emailService.js';
import { resolveResponsePdfAttachment } from './pdfTemplateService.js';
import { generateResponseCopyEmailHtml, type ResponseCopyQaRow } from '../templates/responseCopyEmail.js';

interface SendResponseCopyParams {
  form: {
    id: string;
    title: string;
    formSchema: any;
    settings?: {
      responseCopy?: {
        enabled: boolean;
        mode: 'always' | 'respondentChoice';
        emailFieldId?: string;
        pdfTemplateId?: string;
        subject?: string;
      };
    } | null;
  };
  response: {
    id: string;
    data: Record<string, any>;
  };
  /** Whether the respondent checked "send me a copy" — irrelevant when mode is 'always'. */
  consent: boolean;
}

/**
 * Fire-and-forget: sends the respondent a copy of their own answers by email,
 * if the form owner has enabled it. Mirrors the recipient-resolution and
 * PDF-attachment behavior of the email plugin (plugins/email/handler.ts), but
 * lives outside the plugin system since this is a first-class form setting,
 * not an admin-managed integration. Never throws — the caller (submitResponse)
 * treats this as best-effort and must not fail the submission because of it.
 */
export async function sendResponseCopyIfEnabled({
  form,
  response,
  consent,
}: SendResponseCopyParams): Promise<void> {
  const settings = form.settings?.responseCopy;
  if (!settings?.enabled) return;
  // Default-deny: consent is required unless mode is explicitly 'always'. `mode` is a
  // plain string end to end (no GraphQL enum), so this must not treat an unexpected/
  // malformed value as implicit consent to send — only the literal 'always' skips it.
  if (settings.mode !== 'always' && !consent) return;
  if (!settings.emailFieldId || !form.formSchema) return;

  let schema: FormSchema;
  try {
    schema = deserializeFormSchema(form.formSchema);
  } catch (error: any) {
    logger.error('Response copy skipped: failed to deserialize form schema', {
      formId: form.id,
      error: error.message,
    });
    return;
  }

  // The configured field could have been deleted/renamed since the setting
  // was saved — treat that exactly like "not configured" rather than
  // guessing at a recipient.
  const isValidRecipientField = extractEmailFields(schema).some((f) => f.id === settings.emailFieldId);
  if (!isValidRecipientField) {
    logger.warn('Response copy skipped: configured email field no longer exists on the form', {
      formId: form.id,
      emailFieldId: settings.emailFieldId,
    });
    return;
  }

  const recipient = response.data?.[settings.emailFieldId];
  if (typeof recipient !== 'string' || !recipient.trim()) return;

  let attachment: { filename: string; content: Buffer; contentType: string } | undefined;

  if (settings.pdfTemplateId) {
    const { attachment: pdfAttachment, error } = await resolveResponsePdfAttachment(prisma, {
      pdfTemplateId: settings.pdfTemplateId,
      formId: form.id,
      responseId: response.id,
      deserializedSchema: schema,
      responseData: response.data,
    });

    if (pdfAttachment) {
      attachment = pdfAttachment;
    } else {
      // Fall back to the plain Q&A summary below rather than sending nothing.
      logger.warn('Response copy PDF attachment failed; falling back to a plain summary', {
        formId: form.id,
        responseId: response.id,
        error,
      });
    }
  }

  const qaRows = attachment ? [] : buildResponseSummaryRows(schema, response.data);
  const subject = settings.subject?.trim() || `Your response to ${form.title}`;

  const html = generateResponseCopyEmailHtml({
    formTitle: form.title,
    hasAttachment: Boolean(attachment),
    qaRows,
  });

  await sendEmail({
    to: recipient.trim(),
    subject,
    html,
    attachments: attachment ? [attachment] : undefined,
  });

  logger.info('Response copy email sent', { formId: form.id, responseId: response.id });
}

/** Formats a single field's answer for the plain-text/HTML Q&A summary fallback. */
function formatAnswerValue(field: FillableFormField, value: any): string {
  if (value === null || value === undefined || value === '') return '&mdash;';

  if (field instanceof FileUploadField) {
    const keys = Array.isArray(value) ? value : [value];
    const filenames = keys
      .filter((key): key is string => typeof key === 'string' && key.length > 0)
      .map((key) => key.split('/').pop() || key);
    return filenames.length ? escapeHtml(filenames.join(', ')) : '&mdash;';
  }

  if (Array.isArray(value)) {
    return value.length ? escapeHtml(value.map(String).join(', ')) : '&mdash;';
  }

  return escapeHtml(String(value));
}

/** Walks the schema in page/field order, pairing each fillable field with its formatted answer. */
export function buildResponseSummaryRows(
  schema: FormSchema,
  data: Record<string, any>
): ResponseCopyQaRow[] {
  const rows: ResponseCopyQaRow[] = [];

  for (const page of schema.pages) {
    for (const field of page.fields) {
      if (!(field instanceof FillableFormField)) continue;
      rows.push({
        label: escapeHtml(field.label || 'Untitled question'),
        answer: formatAnswerValue(field, data?.[field.id]),
      });
    }
  }

  return rows;
}

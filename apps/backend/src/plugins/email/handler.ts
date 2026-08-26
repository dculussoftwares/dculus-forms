import type { PluginHandler, PluginEvent, PluginContext } from '../core/types.js';
import type { ValidatedEmailConfig, EmailDeliveryResult } from './types.js';
import { deserializeFormSchema, FillableFormField, type FormSchema } from '@dculus/types';
import { substituteMentions, createFieldLabelsMap } from '@dculus/utils';
import type { EmailAttachment } from '../../services/emailService.js';
import { resolveResponsePdfAttachment } from '../../services/pdfTemplateService.js';
import { checkUsageExceeded, getRemainingEmailQuota } from '../../subscriptions/usageService.js';
import { emitEmailSent } from '../../subscriptions/events.js';

/** One response embedded in a digest node's output (see services/automation/types.ts DigestResponseSummary). */
interface DigestResponseEntry {
  id: string;
  submittedAt: string;
  data: Record<string, any>;
}

/**
 * `event.data` is a plain `Record<string, any>` — `__digestResponses` reaches this handler via
 * that generic channel with no compile-time guarantee of its shape, so a bare `as
 * DigestResponseEntry[]` cast could let a malformed entry (e.g. a bug upstream in engine.ts's
 * triggerData merge) crash deep inside per-response send/table-rendering logic with a cryptic
 * error instead of failing predictably here.
 */
function isValidDigestResponseEntry(entry: unknown): entry is DigestResponseEntry {
  return (
    typeof entry === 'object' &&
    entry !== null &&
    typeof (entry as Record<string, unknown>).id === 'string' &&
    typeof (entry as Record<string, unknown>).submittedAt === 'string' &&
    typeof (entry as Record<string, unknown>).data === 'object' &&
    (entry as Record<string, unknown>).data !== null
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDigestCellValue(value: any): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// `Date.prototype.toLocaleString()` renders using the SERVER's locale/timezone, not the
// recipient's — a digest table generated on a US-locale server vs. an EU-locale one would show
// the same submission at different-looking timestamps. Format explicitly in UTC instead so the
// table is stable regardless of where the backend process happens to run.
function formatDigestTimestamp(isoString: string): string {
  return `${new Date(isoString).toISOString().replace('T', ' ').slice(0, 16)} UTC`;
}

// Gmail (and most providers) clip a message around ~102KB, showing "[Message clipped]" past
// that point — independent of whatever cap the digest node itself was configured with (up to
// 1000 responses). A wide form with a few hundred rows can blow past this well before "all
// responses" is reached, so the email table caps itself here regardless of how many the digest
// node fetched, rather than inheriting its cap.
const EMAIL_DIGEST_TABLE_ROW_CAP = 100;

/**
 * Renders an HTML table (one row per digest response, capped at EMAIL_DIGEST_TABLE_ROW_CAP) for
 * the email action's "include response table" toggle. Column order/labels come from the form's
 * field schema when available (same pattern as google-sheets/handler.ts's buildHeaders), falling
 * back to the first response's raw data keys for a form whose schema couldn't be loaded.
 */
function buildDigestResponseTable(
  allResponses: DigestResponseEntry[],
  formSchema: FormSchema | null
): string {
  if (allResponses.length === 0) return '';
  const responses = allResponses.slice(0, EMAIL_DIGEST_TABLE_ROW_CAP);
  const omitted = allResponses.length - responses.length;

  const fieldEntries: Array<{ id: string; label: string }> = [];
  if (formSchema?.pages) {
    for (const page of formSchema.pages) {
      for (const field of page.fields ?? []) {
        if (field instanceof FillableFormField && field.label) {
          fieldEntries.push({ id: field.id, label: field.label });
        }
      }
    }
  }

  // Fallback key order is fixed ONCE — as the union of keys across EVERY response in this batch,
  // not just the first — and reused for every row below. Object.keys/Object.values on each row's
  // own `data` independently would misalign columns whenever responses have differing key sets or
  // insertion order, and deriving from only the first response would silently drop a column for
  // any optional field a later response has but the first one lacks.
  const fallbackKeys: string[] = (() => {
    const seen = new Set<string>();
    const keys: string[] = [];
    for (const r of responses) {
      for (const key of Object.keys(r.data ?? {})) {
        if (seen.has(key)) continue;
        seen.add(key);
        keys.push(key);
      }
    }
    return keys;
  })();
  const columnLabels = fieldEntries.length > 0 ? fieldEntries.map((f) => f.label) : fallbackKeys;
  const headers = [...columnLabels, 'Submitted At'];

  const headerRow = headers
    .map(
      (h) =>
        `<th style="text-align:left;padding:6px 10px;border-bottom:2px solid #e5e7eb;">${escapeHtml(h)}</th>`
    )
    .join('');

  const bodyRows = responses
    .map((r) => {
      const values =
        fieldEntries.length > 0
          ? fieldEntries.map((f) => r.data?.[f.id])
          : fallbackKeys.map((key) => r.data?.[key]);
      const cells = values.map(
        (v) =>
          `<td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;">${escapeHtml(formatDigestCellValue(v))}</td>`
      );
      cells.push(
        `<td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;">${escapeHtml(formatDigestTimestamp(r.submittedAt))}</td>`
      );
      return `<tr>${cells.join('')}</tr>`;
    })
    .join('');

  const table = `<table style="border-collapse:collapse;width:100%;margin-top:16px;font-size:13px;"><thead><tr>${headerRow}</tr></thead><tbody>${bodyRows}</tbody></table>`;
  const truncationNote =
    omitted > 0
      ? `<p style="font-size:12px;color:#6b7280;margin-top:8px;">Showing the first ${responses.length} of ${allResponses.length} responses.</p>`
      : '';
  return table + truncationNote;
}

/**
 * Resolves the set of recipient addresses for this send: the static
 * recipientEmail (if set) plus the current value of the recipientFieldId
 * field (if set and populated on this response). Returns an empty array
 * (with a reason) when nothing could be resolved, e.g. a field-only
 * recipient left blank by the respondent, or a plugin.test event where no
 * response data exists at all.
 */
function resolveRecipients(
  config: ValidatedEmailConfig,
  responseData: Record<string, any> | null | undefined,
  hasResponse: boolean
): { recipients: string[]; skipReason?: string } {
  const recipients: string[] = [];

  const staticEmail = config.recipientEmail?.trim();
  if (staticEmail) {
    recipients.push(staticEmail);
  }

  let skipReason: string | undefined;
  if (config.recipientFieldId) {
    if (!hasResponse) {
      skipReason = `Recipient field "${config.recipientFieldLabel || config.recipientFieldId}" has no data during a test send`;
    } else {
      const fieldValue = responseData?.[config.recipientFieldId];
      if (typeof fieldValue === 'string' && fieldValue.trim()) {
        const dynamicEmail = fieldValue.trim();
        if (!recipients.includes(dynamicEmail)) {
          recipients.push(dynamicEmail);
        }
      } else {
        skipReason = `Recipient field "${config.recipientFieldLabel || config.recipientFieldId}" was empty for this submission`;
      }
    }
  }

  return { recipients, skipReason: recipients.length === 0 ? skipReason : undefined };
}

/**
 * Resolves the recipient for ONE response in per-response digest send mode
 * (#automations-digest-per-response) — deliberately does NOT include `config.recipientEmail`.
 * `resolveRecipients` (above) always includes the static address when set, which is correct for
 * a single-response send but wrong here: calling it once per matched response would re-add the
 * same static address on every iteration, sending it one email per response instead of one email
 * total. A user who wants both a static summary AND per-response sends should configure two
 * separate email action nodes (one aggregate, one per-response) — this function only ever
 * resolves the per-response field value.
 */
function resolvePerResponseRecipient(
  config: ValidatedEmailConfig,
  responseData: Record<string, any>
): { recipient?: string; skipReason?: string } {
  const fieldValue = responseData[config.recipientFieldId!];
  if (typeof fieldValue === 'string' && fieldValue.trim()) {
    return { recipient: fieldValue.trim() };
  }
  return {
    skipReason: `Recipient field "${config.recipientFieldLabel || config.recipientFieldId}" was empty for this submission`,
  };
}

/**
 * Per-response digest send (#automations-digest-per-response): recipientFieldId set on a
 * schedule automation with an upstream digest node means "send once per matched response, to
 * that response's own field value" rather than one summary email for the whole batch —
 * engine.ts's handleActionNode skips its usual pre-substitution pass for exactly this
 * combination (recipientFieldId + __digestResponses present) so config.message still has its
 * raw {{field}} placeholders when it reaches us here; each iteration below substitutes them
 * against that ONE response's own data, mirroring what the single-response path does with
 * `response.data`.
 *
 * Failures on individual responses are caught and counted, never thrown — throwing would fail
 * the whole pg-boss job and trigger a full-step retry, which has no per-response idempotency
 * tracking and would re-send to everyone who already succeeded. The usage limit is RESERVED for
 * the whole batch upfront (via getRemainingEmailQuota, not checkUsageExceeded's point-in-time
 * boolean) rather than re-checked per email — emitEmailSent only fires an async event that
 * updates the DB counter out of band, so nothing inside the loop itself would otherwise stop a
 * large batch from sailing past the plan's limit if the org was already close to it going in.
 * Responses beyond the reserved quota are counted as skipped, not sent. PDF attachment is
 * intentionally not supported in this mode (out of scope — would mean up to `maxResponses` PDF
 * generations per tick); attachPdfTemplateId is ignored here.
 */
async function sendPerResponseDigestEmails(
  config: ValidatedEmailConfig,
  formSchema: FormSchema | null,
  digestResponses: DigestResponseEntry[],
  event: PluginEvent,
  context: PluginContext
): Promise<EmailDeliveryResult> {
  if (digestResponses.length === 0) {
    return { success: true, recipient: '', subject: config.subject, sentCount: 0, skippedCount: 0, failedCount: 0 };
  }

  const quota = await getRemainingEmailQuota(event.organizationId);
  if (quota.exceeded) {
    context.logger.warn('Digest email batch skipped: organization has exceeded its email usage limit', {
      organizationId: event.organizationId,
    });
    return {
      success: false,
      recipient: '',
      subject: config.subject,
      skipped: true,
      skipReason: 'Organization has reached its email sending limit for this billing period',
      sentCount: 0,
      skippedCount: digestResponses.length,
      failedCount: 0,
    };
  }
  const remainingQuota = quota.remaining ?? Infinity;

  const fieldLabels = formSchema ? createFieldLabelsMap(formSchema) : undefined;
  let sentCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  let lastError: string | undefined;
  let quotaExhausted = false;

  for (const digestResponse of digestResponses) {
    if (sentCount >= remainingQuota) {
      quotaExhausted = true;
      skippedCount += 1;
      continue;
    }

    // INVARIANT: nothing in this loop body may throw. The whole iteration — recipient
    // resolution and mention substitution included, not just the send — sits inside the try for
    // that reason. There is no per-response delivery record, so a throw escaping mid-batch fails
    // the pg-boss job, and the retry restarts from the FIRST response: everyone already emailed
    // gets a second copy. Isolating every failure to its own response means the batch always runs
    // to completion and reports counts, so a retry can only ever happen from a pre-loop failure,
    // where nothing has been sent yet.
    try {
      const responseData = digestResponse.data ?? {};
      const { recipient, skipReason } = resolvePerResponseRecipient(config, responseData);

      if (!recipient) {
        skippedCount += 1;
        context.logger.warn('Digest email skipped for one response: no recipient could be resolved', {
          responseId: digestResponse.id,
          reason: skipReason,
        });
        continue;
      }

      const emailBody = substituteMentions(config.message, responseData, fieldLabels);

      await context.sendEmail({ to: recipient, subject: config.subject, html: emailBody });
      emitEmailSent(event.organizationId, event.formId, 'plugin');
      sentCount += 1;
    } catch (err: any) {
      failedCount += 1;
      lastError = err?.message || 'Unknown error';
      context.logger.error('Digest email failed for one response', {
        responseId: digestResponse.id,
        error: lastError,
      });
    }
  }

  if (quotaExhausted) {
    context.logger.warn('Digest email batch partially skipped: organization reached its email usage limit mid-batch', {
      organizationId: event.organizationId,
      sentCount,
      remainingQuota,
      totalResponses: digestResponses.length,
    });
  }

  context.logger.info('Digest per-response emails complete', {
    total: digestResponses.length,
    sentCount,
    skippedCount,
    failedCount,
  });

  return {
    success: failedCount === 0,
    recipient: `${sentCount} recipient(s)`,
    subject: config.subject,
    sentCount,
    skippedCount,
    failedCount,
    error: failedCount > 0 ? `${failedCount} of ${digestResponses.length} emails failed to send. Last error: ${lastError}` : undefined,
  };
}

/**
 * Email Plugin Handler
 * Sends email notifications with custom messages (supports mentions)
 *
 * @param plugin - Plugin configuration with email settings
 * @param event - Event that triggered the email
 * @param context - Plugin context with helper functions
 * @returns Email delivery result
 */
export const emailHandler: PluginHandler = async (plugin, event, context) => {
  const config = plugin.config as ValidatedEmailConfig;

  context.logger.info('Email plugin triggered', {
    recipient: config.recipientEmail,
    recipientFieldId: config.recipientFieldId,
    eventType: event.type,
  });

  try {
    // Get form data
    const form = await context.getFormById(event.formId);
    if (!form) {
      throw new Error(`Form not found: ${event.formId}`);
    }
    // Deserialized unconditionally, right after the form is fetched — needed by every path
    // below (single-response mention substitution, the digest response table, AND the
    // per-response digest send branch immediately following).
    const formSchema = deserializeFormSchema(form.formSchema);

    const rawDigestResponses = event.data.__digestResponses;
    const digestResponses = Array.isArray(rawDigestResponses)
      ? (rawDigestResponses as unknown[]).filter(isValidDigestResponseEntry)
      : undefined;
    if (Array.isArray(rawDigestResponses) && digestResponses!.length < rawDigestResponses.length) {
      context.logger.warn('Digest batch contained malformed response entries — they were dropped, not delivered', {
        totalEntries: rawDigestResponses.length,
        validEntries: digestResponses!.length,
        formId: event.formId,
      });
    }
    if (config.recipientFieldId && Array.isArray(digestResponses)) {
      return await sendPerResponseDigestEmails(config, formSchema, digestResponses, event, context);
    }

    // Fetch the response once — used for both mention substitution and
    // resolving a field-based recipient.
    const response = event.data.responseId
      ? await context.getResponseById(event.data.responseId)
      : null;

    const { recipients, skipReason } = resolveRecipients(
      config,
      response?.data,
      Boolean(event.data.responseId)
    );

    if (recipients.length === 0) {
      context.logger.warn('Email skipped: no recipient could be resolved', {
        reason: skipReason,
        eventType: event.type,
      });

      const skippedResult: EmailDeliveryResult = {
        success: false,
        recipient: '',
        subject: config.subject,
        skipped: true,
        skipReason,
      };
      return skippedResult;
    }

    // Enforce the org's emails-sent usage limit before sending — mirrors the
    // hard-block enforcement used for views/submissions.
    const usageExceeded = await checkUsageExceeded(event.organizationId);
    if (usageExceeded.emailsExceeded) {
      context.logger.warn('Email skipped: organization has exceeded its email usage limit', {
        organizationId: event.organizationId,
        eventType: event.type,
      });

      const limitExceededResult: EmailDeliveryResult = {
        success: false,
        recipient: '',
        subject: config.subject,
        skipped: true,
        skipReason: 'Organization has reached its email sending limit for this billing period',
      };
      return limitExceededResult;
    }

    // Prepare email message
    let emailBody = config.message;

    // If this is a form submission (not a test), substitute mentions
    if (response && response.data && formSchema) {
      const fieldLabels = createFieldLabelsMap(formSchema);

      // Substitute mentions with actual response values
      emailBody = substituteMentions(config.message, response.data, fieldLabels);

      context.logger.info('Mentions substituted in email', {
        originalLength: config.message.length,
        substitutedLength: emailBody.length,
      });
    } else if (event.type === 'plugin.test') {
      // Only a genuine standalone plugin test-fire (no response, event.type === 'plugin.test')
      // gets this banner. A real schedule-triggered run also has no single response
      // (event.data.responseId absent by design — triggerService.ts's handleScheduledTick
      // sets triggerData: {}) but event.type is 'schedule' there, not 'plugin.test' — checking
      // `!event.data.responseId` alone previously mislabeled every real schedule-automation
      // email as a test send.
      emailBody = `<div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin-bottom: 16px;">
        <strong>🧪 Test Email</strong><br>
        This is a test email from your plugin. Actual form submissions will include real data.
      </div>${config.message}`;
    }

    // Digest response table (schedule automations with an upstream digest node, #automations-digest).
    // __digestResponses/{{__digest*}} scalars are already substituted into config.message by the
    // engine's substituteConfigMentions() before this handler runs — this only appends the
    // per-response table, which the flat mention-substitution model can't express. (digestResponses
    // itself was already declared above, right after formSchema, for the per-response-send check.)
    if (config.includeDigestTable && Array.isArray(digestResponses) && digestResponses.length > 0) {
      emailBody += buildDigestResponseTable(digestResponses, formSchema);
    }

    // Optionally render a PDF from a configured template and attach it — a
    // failure here should not block the notification itself, so it's
    // recorded on the result but never thrown.
    let attachments: EmailAttachment[] | undefined;
    let attachedPdfFilename: string | undefined;
    let attachmentError: string | undefined;

    if (config.attachPdfTemplateId) {
      if (response && response.data && formSchema) {
        const { attachment, error } = await resolveResponsePdfAttachment(context.prisma, {
          pdfTemplateId: config.attachPdfTemplateId,
          formId: event.formId,
          responseId: response.id,
          deserializedSchema: formSchema,
          responseData: response.data,
        });

        if (attachment) {
          attachedPdfFilename = attachment.filename;
          attachments = [attachment];
        } else {
          // Prefer the plugin config's cached template name over the shared
          // helper's id-based message — friendlier for anyone reading plugin
          // test/send results.
          const templateLabel = config.attachPdfTemplateName || config.attachPdfTemplateId;
          attachmentError = `PDF template "${templateLabel}" could not be attached: ${error}`;
          context.logger.warn('Skipping PDF attachment', {
            attachPdfTemplateId: config.attachPdfTemplateId,
            error,
          });
        }
      } else {
        context.logger.info('Skipping PDF attachment: no response data available', {
          attachPdfTemplateId: config.attachPdfTemplateId,
        });
      }
    }

    const recipientHeader = recipients.join(', ');

    // Send email using context helper
    await context.sendEmail({
      to: recipientHeader,
      subject: config.subject,
      html: emailBody,
      attachments,
    });

    context.logger.info('Email sent successfully', {
      recipient: recipientHeader,
      subject: config.subject,
      attachedPdfFilename,
    });

    emitEmailSent(event.organizationId, event.formId, 'plugin');

    const result: EmailDeliveryResult = {
      success: true,
      recipient: recipientHeader,
      subject: config.subject,
      attachedPdfFilename,
      attachmentError,
    };

    return result;
  } catch (error: any) {
    context.logger.error('Email sending failed', {
      recipient: config.recipientEmail,
      error: error.message,
    });

    throw new Error(`Email sending failed: ${error.message}`);
  }
};

import type { PluginHandler } from '../core/types.js';
import type { ValidatedEmailConfig, EmailDeliveryResult } from './types.js';
import { deserializeFormSchema } from '@dculus/types';
import { substituteMentions, createFieldLabelsMap } from '@dculus/utils';
import type { EmailAttachment } from '../../services/emailService.js';
import { generatePdfForResponse, buildPdfFilename } from '../../services/pdfTemplateService.js';

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

    // Prepare email message
    let emailBody = config.message;
    const formSchema = response && response.data ? deserializeFormSchema(form.formSchema) : null;

    // If this is a form submission (not a test), substitute mentions
    if (response && response.data && formSchema) {
      const fieldLabels = createFieldLabelsMap(formSchema);

      // Substitute mentions with actual response values
      emailBody = substituteMentions(config.message, response.data, fieldLabels);

      context.logger.info('Mentions substituted in email', {
        originalLength: config.message.length,
        substitutedLength: emailBody.length,
      });
    } else if (!event.data.responseId) {
      // For test events, add a note at the top
      emailBody = `<div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin-bottom: 16px;">
        <strong>🧪 Test Email</strong><br>
        This is a test email from your plugin. Actual form submissions will include real data.
      </div>${config.message}`;
    }

    // Optionally render a PDF from a configured template and attach it — a
    // failure here should not block the notification itself, so it's
    // recorded on the result but never thrown.
    let attachments: EmailAttachment[] | undefined;
    let attachedPdfFilename: string | undefined;
    let attachmentError: string | undefined;

    if (config.attachPdfTemplateId) {
      if (response && response.data && formSchema) {
        try {
          const pdfTemplate = await context.prisma.pdfTemplate.findUnique({
            where: { id: config.attachPdfTemplateId },
          });

          // Plugin config is arbitrary JSON, so attachPdfTemplateId could in
          // principle reference a template belonging to a different form.
          // Treat a cross-form template exactly like "not found" rather than
          // generating/emailing another form's PDF.
          if (!pdfTemplate || pdfTemplate.formId !== event.formId) {
            attachmentError = `PDF template "${config.attachPdfTemplateName || config.attachPdfTemplateId}" no longer exists`;
            context.logger.warn('Skipping PDF attachment: template not found', {
              attachPdfTemplateId: config.attachPdfTemplateId,
            });
          } else {
            const pdfBuffer = await generatePdfForResponse({
              storedTemplate: pdfTemplate.template,
              fileKey: pdfTemplate.fileKey,
              deserializedSchema: formSchema,
              responseData: response.data,
            });
            attachedPdfFilename = buildPdfFilename(pdfTemplate.name, response.id);
            attachments = [{ filename: attachedPdfFilename, content: pdfBuffer, contentType: 'application/pdf' }];
          }
        } catch (error: any) {
          attachmentError = error.message;
          context.logger.error('PDF attachment generation failed; sending email without it', {
            attachPdfTemplateId: config.attachPdfTemplateId,
            error: error.message,
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

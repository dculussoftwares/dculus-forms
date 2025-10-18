import type { PluginHandler, PluginEvent } from '../types.js';
import type {
  EmailPluginConfig,
  ValidatedEmailConfig,
  EmailDeliveryResult,
} from './types.js';
import { deserializeFormSchema } from '@dculus/types';
import { substituteMentions, createFieldLabelsMap } from '@dculus/utils';

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
    eventType: event.type,
  });

  try {
    // Get form data
    const form = await context.getFormById(event.formId);
    if (!form) {
      throw new Error(`Form not found: ${event.formId}`);
    }

    // Prepare email message
    let emailBody = config.message;

    // If this is a form submission (not a test), substitute mentions
    if (event.data.responseId) {
      const response = await context.getResponseById(event.data.responseId);

      if (response && response.data) {
        // Extract field labels from form schema
        const formSchema = deserializeFormSchema(form.formSchema);
        const fieldLabels = createFieldLabelsMap(formSchema);

        // Substitute mentions with actual response values
        emailBody = substituteMentions(config.message, response.data, fieldLabels);

        context.logger.info('Mentions substituted in email', {
          originalLength: config.message.length,
          substitutedLength: emailBody.length,
        });
      }
    } else {
      // For test events, add a note at the top
      emailBody = `<div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin-bottom: 16px;">
        <strong>🧪 Test Email</strong><br>
        This is a test email from your plugin. Actual form submissions will include real data.
      </div>${config.message}`;
    }

    // Send email using context helper
    await context.sendEmail({
      to: config.recipientEmail,
      subject: config.subject,
      html: emailBody,
    });

    context.logger.info('Email sent successfully', {
      recipient: config.recipientEmail,
      subject: config.subject,
    });

    const result: EmailDeliveryResult = {
      success: true,
      recipient: config.recipientEmail,
      subject: config.subject,
    };

    return result;
  } catch (error: any) {
    context.logger.error('Email sending failed', {
      recipient: config.recipientEmail,
      error: error.message,
    });

    const result: EmailDeliveryResult = {
      success: false,
      recipient: config.recipientEmail,
      subject: config.subject,
      error: error.message || 'Unknown error',
    };

    throw new Error(`Email sending failed: ${error.message}`);
  }
};

import { eventBus } from '../lib/event-bus.js';
import { sendEmail, sendFormSubmissionEmail, FormSubmissionEmailData } from './emailService.js';
import { JobExecutor } from '../lib/job-executor.js';

/**
 * Email Service Listener
 *
 * Listens to plugin.email.send events and uses the existing email service
 * to actually send emails. This bridges the plugin system with the core email infrastructure.
 */

let jobExecutorInstance: JobExecutor | null = null;

/**
 * Setup email service event listeners
 */
export function setupEmailServiceListener(jobExecutor: JobExecutor) {
  jobExecutorInstance = jobExecutor;

  // Listen for plugin.email.send events
  eventBus.on('plugin.email.send', async (event) => {
    const {
      jobId,
      pluginConfigId,
      formTitle,
      recipientEmail,
      subject,
      message,
      submissionData,
      sendToSubmitter,
      submitterEmailFieldId
    } = event;

    const sentTo: string[] = [];

    try {
      // Send email to configured recipient
      const emailData: FormSubmissionEmailData = {
        formTitle,
        subject,
        message,
        submissionData,
        recipientEmail
      };

      const messageId = await sendFormSubmissionEmail(emailData);
      sentTo.push(recipientEmail);

      console.log(`📧 Email sent to ${recipientEmail} (messageId: ${messageId})`);

      // Optionally send to submitter if configured
      if (sendToSubmitter && submitterEmailFieldId && submissionData[submitterEmailFieldId]) {
        const submitterEmail = submissionData[submitterEmailFieldId];

        // Send thank you email to submitter
        await sendEmail({
          to: submitterEmail,
          subject: `Thank you for your submission - ${formTitle}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Thank you for your submission!</h2>
              <p>We've received your form submission for <strong>${formTitle}</strong>.</p>
              <p>We'll get back to you soon.</p>
              <br>
              <p style="color: #6b7280; font-size: 14px;">
                Powered by Dculus Forms
              </p>
            </div>
          `,
          text: `Thank you for your submission! We've received your form submission for ${formTitle}. We'll get back to you soon.`
        });

        sentTo.push(submitterEmail);
        console.log(`📧 Thank you email sent to submitter ${submitterEmail}`);
      }

      // Emit success event with messageId
      eventBus.emit('plugin.email.sent', {
        jobId,
        pluginConfigId,
        messageId,
        sentTo
      });

      // Mark job as completed via job executor
      if (jobExecutorInstance) {
        await jobExecutorInstance.handleJobCompletion(jobId, {
          success: true,
          messageId,
          sentTo
        });
      }

    } catch (error: any) {
      console.error(`❌ Failed to send email for job ${jobId}:`, error);

      // Emit failure event
      eventBus.emit('plugin.email.failed', {
        jobId,
        pluginConfigId,
        error: error.message
      });

      // Note: Job executor will handle retry logic based on the failed event
    }
  });

  console.log('📧 Email service listener initialized');
}

import { PrismaClient } from '@prisma/client';
import { emailConfigSchema } from './schema.js';

// Dynamic import of event bus to avoid circular dependencies
let eventBus: any;

const prisma = new PrismaClient();

/**
 * Email Plugin Service
 *
 * Independent service that handles email plugin logic.
 * Listens to plugin.email.execute events and emits plugin.email.send events.
 * This service is completely decoupled from the core job executor.
 */

/**
 * Render template with field substitution
 * Supports {{fieldId}} syntax
 */
function renderTemplate(template: string, data: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, field) => {
    return data[field] !== undefined ? String(data[field]) : match;
  });
}

/**
 * Initialize email plugin event listeners
 */
export async function initializeEmailPlugin() {
  // Dynamic import to avoid circular dependencies
  const eventBusModule = await import('../../../apps/backend/src/lib/event-bus.js');
  eventBus = eventBusModule.eventBus;

  // Listen for email plugin execution events
  eventBus.on('plugin.email.execute', async (event: any) => {
    const { jobId, pluginConfigId, formId, config, payload } = event;

    try {
      // Validate config using Zod schema
      const validatedConfig = emailConfigSchema.parse(config);

      // Get form details
      const form = await prisma.form.findUnique({
        where: { id: formId }
      });

      if (!form) {
        throw new Error(`Form ${formId} not found`);
      }

      // Render email template with field substitution
      const subject = renderTemplate(
        validatedConfig.subject || 'New Form Submission',
        payload
      );
      const message = renderTemplate(
        validatedConfig.message || 'You received a new form submission!',
        payload
      );

      // Emit email send event for email service to handle
      eventBus.emit('plugin.email.send', {
        jobId,
        pluginConfigId,
        formId,
        formTitle: form.title,
        recipientEmail: validatedConfig.recipientEmail,
        subject,
        message,
        submissionData: payload,
        sendToSubmitter: validatedConfig.sendToSubmitter,
        submitterEmailFieldId: validatedConfig.submitterEmailFieldId
      });

      console.log(`📧 Email plugin prepared email for job ${jobId}`);

    } catch (error: any) {
      console.error(`❌ Email plugin failed for job ${jobId}:`, error);

      // Emit failure event
      eventBus.emit('plugin.email.failed', {
        jobId,
        pluginConfigId,
        error: error.message
      });
    }
  });

  // Listen for email sent events to mark job complete
  eventBus.on('plugin.email.sent', async (event: any) => {
    console.log(`✅ Email plugin sent email for job ${event.jobId} (messageId: ${event.messageId})`);
  });

  // Listen for email failed events
  eventBus.on('plugin.email.failed', async (event: any) => {
    console.error(`❌ Email plugin failed for job ${event.jobId}: ${event.error}`);
  });

  console.log('📧 Email plugin service initialized');
}

/**
 * Shutdown email plugin and disconnect Prisma
 */
export async function shutdownEmailPlugin() {
  await prisma.$disconnect();
  console.log('📧 Email plugin service shutdown');
}

import { eventBus } from './event-bus.js';
import { JobExecutor } from './job-executor.js';
import { prisma } from './prisma.js';

/**
 * Setup Plugin Event Listeners
 *
 * Listens to form events and creates plugin jobs when events occur.
 * This is the bridge between the event bus and the job executor.
 */
export function setupPluginListeners(jobExecutor: JobExecutor) {
  // Listen for form submission events
  eventBus.on('form.submitted', async ({ formId, responseId, data }) => {
    try {
      // Find all enabled plugins for this form that listen to this event
      const configs = await prisma.pluginConfig.findMany({
        where: {
          formId,
          enabled: true,
          triggerEvents: { has: 'form.submitted' }
        }
      });

      console.log(`Found ${configs.length} enabled plugins for form ${formId} on form.submitted event`);

      // Create jobs for each enabled plugin
      for (const config of configs) {
        await jobExecutor.createJob({
          pluginConfigId: config.id,
          event: 'form.submitted',
          payload: { formId, responseId, data }
        });
        console.log(`Created plugin job for ${config.pluginId} plugin`);
      }
    } catch (error) {
      console.error('Error creating plugin jobs for form.submitted event:', error);
    }
  });

  // Listen for form update events
  eventBus.on('form.updated', async ({ formId, changes }) => {
    try {
      const configs = await prisma.pluginConfig.findMany({
        where: {
          formId,
          enabled: true,
          triggerEvents: { has: 'form.updated' }
        }
      });

      for (const config of configs) {
        await jobExecutor.createJob({
          pluginConfigId: config.id,
          event: 'form.updated',
          payload: { formId, changes }
        });
      }
    } catch (error) {
      console.error('Error creating plugin jobs for form.updated event:', error);
    }
  });

  // Listen for response edit events
  eventBus.on('response.edited', async ({ responseId, formId, changes }) => {
    try {
      const configs = await prisma.pluginConfig.findMany({
        where: {
          formId,
          enabled: true,
          triggerEvents: { has: 'response.edited' }
        }
      });

      for (const config of configs) {
        await jobExecutor.createJob({
          pluginConfigId: config.id,
          event: 'response.edited',
          payload: { responseId, formId, changes }
        });
      }
    } catch (error) {
      console.error('Error creating plugin jobs for response.edited event:', error);
    }
  });

  // Listen for response delete events
  eventBus.on('response.deleted', async ({ responseId, formId }) => {
    try {
      const configs = await prisma.pluginConfig.findMany({
        where: {
          formId,
          enabled: true,
          triggerEvents: { has: 'response.deleted' }
        }
      });

      for (const config of configs) {
        await jobExecutor.createJob({
          pluginConfigId: config.id,
          event: 'response.deleted',
          payload: { responseId, formId }
        });
      }
    } catch (error) {
      console.error('Error creating plugin jobs for response.deleted event:', error);
    }
  });

  console.log('✅ Plugin event listeners initialized');
}

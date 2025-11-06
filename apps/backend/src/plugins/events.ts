import { EventEmitter } from 'events';
import { executePluginsForForm } from './executor.js';
import type { PluginEvent } from './types.js';
import { logger } from '../lib/logger.js';

/**
 * Plugin Event System
 * Central event emitter for all plugin events
 *
 * Currently supported events:
 * - form.submitted: Triggered when a form response is submitted
 * - plugin.test: Triggered when testing a plugin configuration
 */

// Create singleton event emitter
const pluginEventEmitter = new EventEmitter();

// Increase max listeners to handle multiple plugins per form
pluginEventEmitter.setMaxListeners(100);

/**
 * Initialize plugin event system
 * Sets up event listeners that execute plugins when events are emitted
 */
export const initializePluginEvents = (): void => {
  logger.info('[Plugin Events] Initializing plugin event system...');

  // Listen for all plugin events and execute matching plugins
  pluginEventEmitter.on('plugin:event', async (event: PluginEvent) => {
    logger.info(`[Plugin Events] Event triggered: ${event.type}`, {
      formId: event.formId,
      organizationId: event.organizationId,
    });

    try {
      await executePluginsForForm(event.formId, event);
    } catch (error: any) {
      logger.error('[Plugin Events] Error executing plugins:', error);
    }
  });

  logger.info('[Plugin Events] Plugin event system initialized successfully');
};

/**
 * Emit a form.submitted event
 * Triggered when a user submits a form response
 *
 * @param formId - ID of the form that was submitted
 * @param organizationId - ID of the organization that owns the form
 * @param responseData - The submitted form response data
 */
export const emitFormSubmitted = (
  formId: string,
  organizationId: string,
  responseData: Record<string, any>
): void => {
  const event: PluginEvent = {
    type: 'form.submitted',
    formId,
    organizationId,
    data: responseData,
    timestamp: new Date(),
  };

  pluginEventEmitter.emit('plugin:event', event);
};

/**
 * Emit a plugin.test event
 * Triggered when testing a plugin configuration
 *
 * @param formId - ID of the form to test
 * @param organizationId - ID of the organization that owns the form
 * @param testData - Optional test data payload
 */
export const emitPluginTest = (
  formId: string,
  organizationId: string,
  testData: Record<string, any> = {}
): void => {
  const event: PluginEvent = {
    type: 'plugin.test',
    formId,
    organizationId,
    data: {
      test: true,
      message: 'This is a test event',
      ...testData,
    },
    timestamp: new Date(),
  };

  pluginEventEmitter.emit('plugin:event', event);
};

/**
 * Get the event emitter instance (for testing purposes)
 */
export const getEventEmitter = (): EventEmitter => {
  return pluginEventEmitter;
};

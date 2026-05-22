import { EventEmitter } from 'events';
import { executePluginsForForm } from './executor.js';
import type { PluginEvent } from './types.js';
import { logger } from '../../lib/logger.js';

const pluginEventEmitter = new EventEmitter();
pluginEventEmitter.setMaxListeners(100);

export const initializePluginEvents = (): void => {
  logger.info('[Plugin Events] Initializing plugin event system...');

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

export const emitFormSubmitted = (
  formId: string,
  organizationId: string,
  responseData: Record<string, any>
): void => {
  pluginEventEmitter.emit('plugin:event', {
    type: 'form.submitted',
    formId,
    organizationId,
    data: responseData,
    timestamp: new Date(),
  } satisfies PluginEvent);
};

export const emitPluginTest = (
  formId: string,
  organizationId: string,
  testData: Record<string, any> = {}
): void => {
  pluginEventEmitter.emit('plugin:event', {
    type: 'plugin.test',
    formId,
    organizationId,
    data: { test: true, message: 'This is a test event', ...testData },
    timestamp: new Date(),
  } satisfies PluginEvent);
};

export const getEventEmitter = (): EventEmitter => pluginEventEmitter;

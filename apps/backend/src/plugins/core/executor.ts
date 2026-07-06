import { prisma } from '../../lib/prisma.js';
import { getPluginHandler } from './registry.js';
import { createPluginContext } from './context.js';
import type { PluginEvent, PluginConfig } from './types.js';
import { generateId } from '@dculus/utils';
import * as Sentry from '@sentry/node';

export const executePlugin = async (
  pluginId: string,
  event: PluginEvent
): Promise<{ success: boolean; error?: string }> => {
  const context = createPluginContext();

  try {
    const plugin = await prisma.formPlugin.findUnique({ where: { id: pluginId } });

    if (!plugin) throw new Error(`Plugin ${pluginId} not found`);

    if (!plugin.enabled) {
      context.logger.warn(`Plugin ${pluginId} is disabled, skipping execution`);
      return { success: false, error: 'Plugin is disabled' };
    }

    const handler = getPluginHandler(plugin.type);
    if (!handler) throw new Error(`No handler registered for plugin type: ${plugin.type}`);

    context.logger.info(`Executing plugin: ${plugin.name} (${plugin.type})`, {
      pluginId,
      eventType: event.type,
    });

    const startTime = Date.now();
    const result = await handler({ id: pluginId, config: plugin.config as PluginConfig }, event, context);
    const duration = Date.now() - startTime;

    context.logger.info(`Plugin executed successfully: ${plugin.name}`, {
      pluginId,
      duration: `${duration}ms`,
    });

    await prisma.pluginDelivery.create({
      data: {
        id: generateId(),
        pluginId,
        responseId: event.data?.responseId ?? null,
        eventType: event.type,
        status: 'success',
        payload: event.data,
        response: result || {},
        deliveredAt: new Date(),
      },
    });

    return { success: true };
  } catch (error: any) {
    Sentry.captureException(error);
    context.logger.error(`Plugin execution failed: ${pluginId}`, error);

    await prisma.pluginDelivery.create({
      data: {
        id: generateId(),
        pluginId,
        responseId: event.data?.responseId ?? null,
        eventType: event.type,
        status: 'failed',
        payload: event.data,
        errorMessage: error.message || 'Unknown error',
        deliveredAt: new Date(),
      },
    });

    return { success: false, error: error.message || 'Unknown error' };
  }
};

export const executePluginsForForm = async (
  formId: string,
  event: PluginEvent
): Promise<{ total: number; succeeded: number; failed: number }> => {
  const context = createPluginContext();

  try {
    const plugins = await prisma.formPlugin.findMany({
      where: { formId, enabled: true, events: { has: event.type } },
    });

    if (plugins.length === 0) {
      context.logger.info(`No plugins found for form ${formId} and event ${event.type}`);
      return { total: 0, succeeded: 0, failed: 0 };
    }

    context.logger.info(`Found ${plugins.length} plugin(s) for form ${formId}`, {
      eventType: event.type,
    });

    // Run plugins sequentially to prevent race conditions when multiple plugins
    // of the same type (e.g. two quiz grading instances) read-modify-write the
    // same response.metadata field concurrently.
    let succeeded = 0;
    let failed = 0;

    for (const plugin of plugins) {
      const result = await executePlugin(plugin.id, event).catch((err) => ({
        success: false as const,
        error: err?.message || 'Unknown error',
      }));
      if (result.success) {
        succeeded++;
      } else {
        failed++;
        context.logger.error(`Plugin ${plugin.name} failed`, {
          pluginId: plugin.id,
          error: result.error,
        });
      }
    }

    context.logger.info(`Plugin execution completed for form ${formId}`, {
      total: plugins.length,
      succeeded,
      failed,
    });

    return { total: plugins.length, succeeded, failed };
  } catch (error: any) {
    Sentry.captureException(error);
    context.logger.error('Error executing plugins for form', error);
    throw error;
  }
};

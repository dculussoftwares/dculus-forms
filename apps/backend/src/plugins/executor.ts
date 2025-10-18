import { prisma } from '../lib/prisma.js';
import { getPluginHandler } from './registry.js';
import { createPluginContext } from './context.js';
import type { PluginEvent, PluginConfig } from './types.js';
import { generateId } from '@dculus/utils';

/**
 * Execute a single plugin
 * Handles plugin execution, logging, and delivery tracking
 *
 * @param pluginId - Database ID of the plugin to execute
 * @param event - Event that triggered the plugin
 * @returns Promise with execution result
 */
export const executePlugin = async (
  pluginId: string,
  event: PluginEvent
): Promise<{ success: boolean; error?: string }> => {
  const context = createPluginContext();

  try {
    // Fetch plugin configuration from database
    const plugin = await prisma.formPlugin.findUnique({
      where: { id: pluginId },
    });

    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    if (!plugin.enabled) {
      context.logger.warn(`Plugin ${pluginId} is disabled, skipping execution`);
      return { success: false, error: 'Plugin is disabled' };
    }

    // Get handler from registry
    const handler = getPluginHandler(plugin.type);
    if (!handler) {
      throw new Error(`No handler registered for plugin type: ${plugin.type}`);
    }

    context.logger.info(`Executing plugin: ${plugin.name} (${plugin.type})`, {
      pluginId,
      eventType: event.type,
    });

    // Execute plugin handler
    const startTime = Date.now();
    const result = await handler(
      { config: plugin.config as PluginConfig },
      event,
      context
    );
    const duration = Date.now() - startTime;

    context.logger.info(`Plugin executed successfully: ${plugin.name}`, {
      pluginId,
      duration: `${duration}ms`,
    });

    // Record successful delivery
    await prisma.pluginDelivery.create({
      data: {
        id: generateId(),
        pluginId,
        eventType: event.type,
        status: 'success',
        payload: event.data,
        response: result || {},
        deliveredAt: new Date(),
      },
    });

    return { success: true };
  } catch (error: any) {
    context.logger.error(`Plugin execution failed: ${pluginId}`, error);

    // Record failed delivery
    await prisma.pluginDelivery.create({
      data: {
        id: generateId(),
        pluginId,
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

/**
 * Execute all plugins for a form that match the event type
 *
 * @param formId - Form ID to find plugins for
 * @param event - Event that triggered the plugins
 * @returns Promise with execution results
 */
export const executePluginsForForm = async (
  formId: string,
  event: PluginEvent
): Promise<{ total: number; succeeded: number; failed: number }> => {
  const context = createPluginContext();

  try {
    // Find all enabled plugins for this form that listen to this event
    const plugins = await prisma.formPlugin.findMany({
      where: {
        formId,
        enabled: true,
        events: {
          has: event.type,
        },
      },
    });

    if (plugins.length === 0) {
      context.logger.info(`No plugins found for form ${formId} and event ${event.type}`);
      return { total: 0, succeeded: 0, failed: 0 };
    }

    context.logger.info(`Found ${plugins.length} plugin(s) for form ${formId}`, {
      eventType: event.type,
    });

    // Execute all plugins in parallel
    const results = await Promise.allSettled(
      plugins.map((plugin) => executePlugin(plugin.id, event))
    );

    // Count successes and failures
    let succeeded = 0;
    let failed = 0;

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.success) {
        succeeded++;
      } else {
        failed++;
        const plugin = plugins[index];
        context.logger.error(`Plugin ${plugin.name} failed`, {
          pluginId: plugin.id,
          error: result.status === 'fulfilled' ? result.value.error : result.reason,
        });
      }
    });

    context.logger.info(`Plugin execution completed for form ${formId}`, {
      total: plugins.length,
      succeeded,
      failed,
    });

    return { total: plugins.length, succeeded, failed };
  } catch (error: any) {
    context.logger.error('Error executing plugins for form', error);
    throw error;
  }
};

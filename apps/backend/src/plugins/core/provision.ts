import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { getPluginHandler } from './registry.js';
import { createPluginContext } from './context.js';
import type { PluginConfig } from './types.js';

const SHEET_PLUGIN_TYPES = new Set(['google-sheets', 'microsoft-sheets']);

const hasConnection = (config: PluginConfig): boolean =>
  !!(config.googleToken || config.microsoftToken);

const hasDocument = (config: PluginConfig): boolean =>
  !!(config.spreadsheetId || config.workbookId);

/**
 * Creates a sheet plugin's spreadsheet/workbook (in its chosen folder) ahead of the first
 * response, so its link exists as soon as the integration is saved. Best effort: a failure is
 * logged and the handler creates the file lazily on the first delivery, as it always has.
 * Resolves true only when the file was created.
 */
export const provisionSheetPlugin = async (pluginId: string): Promise<boolean> => {
  try {
    const plugin = await prisma.formPlugin.findUnique({ where: { id: pluginId }, include: { form: true } });
    if (!plugin || !plugin.enabled || !SHEET_PLUGIN_TYPES.has(plugin.type)) return false;

    const config = plugin.config as PluginConfig;
    if (!hasConnection(config) || hasDocument(config)) return false;

    const handler = getPluginHandler(plugin.type);
    if (!handler) return false;

    const context = createPluginContext(async (next) => {
      await prisma.formPlugin.update({ where: { id: pluginId }, data: { config: next as any } });
    }, `${pluginId}:provision`);

    const result = await handler(
      { id: pluginId, config },
      {
        type: 'plugin.provision',
        formId: plugin.formId,
        organizationId: plugin.form.organizationId,
        data: {},
        timestamp: new Date(),
      },
      context
    );

    if (!result?.success) {
      logger.warn(`[Plugin Provision] ${plugin.type} ${pluginId} not provisioned: ${result?.error ?? 'unknown error'}`);
    }
    return !!result?.success;
  } catch (error) {
    logger.warn(`[Plugin Provision] ${pluginId} failed`, error);
    return false;
  }
};

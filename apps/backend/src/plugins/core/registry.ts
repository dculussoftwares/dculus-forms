import type { PluginHandler } from './types.js';
import { logger } from '../../lib/logger.js';

const pluginRegistry: Map<string, PluginHandler> = new Map();

export const registerPlugin = (type: string, handler: PluginHandler): void => {
  if (pluginRegistry.has(type)) {
    logger.warn(`[Plugin Registry] Plugin type "${type}" is already registered. Overwriting...`);
  }
  pluginRegistry.set(type, handler);
  logger.info(`[Plugin Registry] Registered plugin type: ${type}`);
};

export const getPluginHandler = (type: string): PluginHandler | undefined =>
  pluginRegistry.get(type);

export const hasPlugin = (type: string): boolean =>
  pluginRegistry.has(type);

export const getAvailablePluginTypes = (): string[] =>
  Array.from(pluginRegistry.keys());

export const unregisterPlugin = (type: string): boolean =>
  pluginRegistry.delete(type);

export const clearRegistry = (): void =>
  pluginRegistry.clear();

import { logger } from '../../lib/logger.js';

export interface PluginExportColumn {
  pluginType: string;
  getColumns(): string[];
  getValues(metadata: any): (string | number | null)[];
}

const PLUGIN_EXPORT_REGISTRY: Map<string, PluginExportColumn> = new Map();

export function registerPluginExport(columnDef: PluginExportColumn): void {
  if (PLUGIN_EXPORT_REGISTRY.has(columnDef.pluginType)) {
    logger.warn(
      `Plugin export for "${columnDef.pluginType}" is already registered. Overwriting...`
    );
  }
  PLUGIN_EXPORT_REGISTRY.set(columnDef.pluginType, columnDef);
  logger.info(`Registered export columns for plugin: ${columnDef.pluginType}`);
}

export function getPluginExport(pluginType: string): PluginExportColumn | undefined {
  return PLUGIN_EXPORT_REGISTRY.get(pluginType);
}

export function getAllPluginExports(): PluginExportColumn[] {
  return Array.from(PLUGIN_EXPORT_REGISTRY.values());
}

export function getActivePluginExports(metadata?: Record<string, any>): PluginExportColumn[] {
  if (!metadata) return [];
  return Object.entries(metadata)
    .filter(([pluginType, data]) => data && PLUGIN_EXPORT_REGISTRY.has(pluginType))
    .map(([pluginType]) => PLUGIN_EXPORT_REGISTRY.get(pluginType)!);
}

export function hasPluginExport(pluginType: string): boolean {
  return PLUGIN_EXPORT_REGISTRY.has(pluginType);
}

export function getPluginTypesWithData(
  responses: { metadata?: Record<string, any> }[]
): string[] {
  const pluginTypes = new Set<string>();
  for (const response of responses) {
    if (response.metadata) {
      for (const pluginType of Object.keys(response.metadata)) {
        if (hasPluginExport(pluginType)) pluginTypes.add(pluginType);
      }
    }
  }
  return Array.from(pluginTypes).sort();
}

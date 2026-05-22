import { logger } from '../../lib/logger.js';

export interface PluginExportColumn {
  pluginType: string;
  getColumns(): string[];
  /**
   * Optional: return column headers using the stored plugin config (e.g. to
   * honour a user-configured `columnName`).  Falls back to `getColumns()` when
   * not implemented.
   */
  getColumnsWithConfig?(pluginConfig: Record<string, any>): string[];
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

/**
 * Extract the plugin type from a metadata key.
 * Handles both legacy bare keys ('quiz-grading') and instance-scoped keys ('quiz-grading:pluginId').
 */
export function pluginTypeFromMetadataKey(key: string): string {
  const colonIdx = key.indexOf(':');
  return colonIdx >= 0 ? key.slice(0, colonIdx) : key;
}

/**
 * Returns every metadata key (across all responses) that belongs to a registered
 * plugin export.  Keys may be bare plugin types ('quiz-grading') for legacy data
 * or instance-scoped ('quiz-grading:pluginId') for current data.
 */
export function getPluginTypesWithData(
  responses: { metadata?: Record<string, any> }[]
): string[] {
  const keys = new Set<string>();
  for (const response of responses) {
    if (response.metadata) {
      for (const key of Object.keys(response.metadata)) {
        if (hasPluginExport(pluginTypeFromMetadataKey(key))) keys.add(key);
      }
    }
  }
  return Array.from(keys).sort();
}

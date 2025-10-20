/**
 * Plugin Export Column Registry
 *
 * Centralized system for plugins to register their export column definitions.
 * This allows plugins to add custom columns to Excel/CSV exports without
 * modifying the core export service.
 */

export interface PluginExportColumn {
  /**
   * Unique plugin type identifier (e.g., 'quiz-grading', 'email', 'webhook')
   */
  pluginType: string;

  /**
   * Get column headers for this plugin
   * @returns Array of column header names
   */
  getColumns(): string[];

  /**
   * Extract values from plugin metadata for export
   * @param metadata - The plugin-specific metadata from response.metadata[pluginType]
   * @returns Array of values matching the columns order, or null/empty if no data
   */
  getValues(metadata: any): (string | number | null)[];
}

/**
 * Registry of all plugin export columns
 */
const PLUGIN_EXPORT_REGISTRY: Map<string, PluginExportColumn> = new Map();

/**
 * Register a plugin's export column definition
 * @param columnDef - Plugin export column definition
 */
export function registerPluginExport(columnDef: PluginExportColumn): void {
  if (PLUGIN_EXPORT_REGISTRY.has(columnDef.pluginType)) {
    console.warn(`Plugin export for "${columnDef.pluginType}" is already registered. Overwriting...`);
  }

  PLUGIN_EXPORT_REGISTRY.set(columnDef.pluginType, columnDef);
  console.log(`Registered export columns for plugin: ${columnDef.pluginType}`);
}

/**
 * Get export column definition for a specific plugin type
 * @param pluginType - The plugin type identifier
 * @returns The plugin export column definition, or undefined if not registered
 */
export function getPluginExport(pluginType: string): PluginExportColumn | undefined {
  return PLUGIN_EXPORT_REGISTRY.get(pluginType);
}

/**
 * Get all registered plugin export columns
 * @returns Array of all registered plugin export column definitions
 */
export function getAllPluginExports(): PluginExportColumn[] {
  return Array.from(PLUGIN_EXPORT_REGISTRY.values());
}

/**
 * Get export columns for plugins that have data in the given metadata
 * @param metadata - Response metadata object containing plugin data
 * @returns Array of plugin export columns that have data
 */
export function getActivePluginExports(metadata?: Record<string, any>): PluginExportColumn[] {
  if (!metadata) {
    return [];
  }

  const activeExports: PluginExportColumn[] = [];

  for (const [pluginType, pluginMetadata] of Object.entries(metadata)) {
    const exportDef = getPluginExport(pluginType);
    if (exportDef && pluginMetadata) {
      activeExports.push(exportDef);
    }
  }

  return activeExports;
}

/**
 * Check if a plugin has registered export columns
 * @param pluginType - The plugin type identifier
 * @returns True if the plugin has registered export columns
 */
export function hasPluginExport(pluginType: string): boolean {
  return PLUGIN_EXPORT_REGISTRY.has(pluginType);
}

/**
 * Get all plugin column headers that have data in any of the responses
 * This is useful for generating consistent export headers across all responses
 *
 * @param responses - Array of form responses
 * @returns Array of plugin types that have data in at least one response
 */
export function getPluginTypesWithData(responses: { metadata?: Record<string, any> }[]): string[] {
  const pluginTypes = new Set<string>();

  for (const response of responses) {
    if (response.metadata) {
      for (const pluginType of Object.keys(response.metadata)) {
        if (hasPluginExport(pluginType)) {
          pluginTypes.add(pluginType);
        }
      }
    }
  }

  return Array.from(pluginTypes).sort(); // Sort for consistent column order
}

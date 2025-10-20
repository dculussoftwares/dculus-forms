/**
 * Plugin Column Registry
 *
 * Centralized system for plugins to register their response table column definitions.
 * This allows plugins to add custom columns to the responses table without
 * modifying the core Responses.tsx file.
 */

import React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@dculus/ui';

/**
 * Plugin Column Configuration
 * Defines how a plugin should render its column in the responses table
 */
export interface PluginColumnConfig {
  /**
   * Plugin type identifier (e.g., 'quiz-grading', 'email', 'webhook')
   */
  pluginType: string;

  /**
   * Column header title
   */
  title: string;

  /**
   * Column width in pixels
   */
  size?: number;

  /**
   * Whether the column is sortable
   */
  enableSorting?: boolean;

  /**
   * Render function for the column cell
   * Receives the response metadata and callbacks
   */
  renderCell: (params: {
    metadata: Record<string, any>;
    responseId: string;
    onViewDetails?: (metadata: any, responseId: string) => void;
  }) => React.ReactNode;
}

/**
 * Registry of plugin columns
 * Plugins register themselves here to add columns to the responses table
 */
const PLUGIN_COLUMN_REGISTRY: Map<string, PluginColumnConfig> = new Map();

/**
 * Register a plugin's column configuration
 * @param columnConfig - Plugin column configuration
 */
export function registerPluginColumn(columnConfig: PluginColumnConfig): void {
  if (PLUGIN_COLUMN_REGISTRY.has(columnConfig.pluginType)) {
    console.warn(`Plugin column for "${columnConfig.pluginType}" is already registered. Overwriting...`);
  }

  PLUGIN_COLUMN_REGISTRY.set(columnConfig.pluginType, columnConfig);
  console.log(`Registered response table column for plugin: ${columnConfig.pluginType}`);
}

/**
 * Get column configuration for a specific plugin type
 * @param pluginType - The plugin type identifier
 * @returns The plugin column configuration, or undefined if not registered
 */
export function getPluginColumn<TData = any>(
  pluginType: string,
  onViewDetails?: (metadata: any, responseId: string) => void
): ColumnDef<TData> | null {
  const config = PLUGIN_COLUMN_REGISTRY.get(pluginType);

  if (!config) {
    return null;
  }

  return {
    accessorKey: 'metadata' as any,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={config.title} />
    ),
    cell: ({ row }) =>
      config.renderCell({
        metadata: (row.original as any).metadata,
        responseId: (row.original as any).id,
        onViewDetails,
      }),
    enableSorting: config.enableSorting ?? false,
    size: config.size,
  } as ColumnDef<TData>;
}

/**
 * Get all plugin columns for enabled plugins
 * @param enabledPluginTypes - Array of plugin types that are enabled for the form
 * @param onViewDetails - Callback for viewing plugin-specific details
 * @returns Array of column definitions for enabled plugins
 */
export function getPluginColumns<TData = any>(
  enabledPluginTypes: string[],
  onViewDetails?: (pluginType: string, metadata: any, responseId: string) => void
): ColumnDef<TData>[] {
  console.log('[PluginColumnRegistry] getPluginColumns called with:', {
    enabledPluginTypes,
    registeredPlugins: Array.from(PLUGIN_COLUMN_REGISTRY.keys())
  });

  return enabledPluginTypes
    .map((pluginType) => {
      const column = getPluginColumn<TData>(
        pluginType,
        onViewDetails
          ? (metadata, responseId) => onViewDetails(pluginType, metadata, responseId)
          : undefined
      );
      if (column) {
        console.log(`[PluginColumnRegistry] Found column for plugin: ${pluginType}`);
      } else {
        console.warn(`[PluginColumnRegistry] No column registered for plugin: ${pluginType}`);
      }
      return column;
    })
    .filter((col): col is ColumnDef<TData> => col !== null);
}

/**
 * Check if a plugin has a registered column
 */
export function hasPluginColumn(pluginType: string): boolean {
  return PLUGIN_COLUMN_REGISTRY.has(pluginType);
}

/**
 * Get all registered plugin types with columns
 */
export function getRegisteredPluginTypes(): string[] {
  return Array.from(PLUGIN_COLUMN_REGISTRY.keys());
}

import React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@dculus/ui';

// ─── Props contracts ────────────────────────────────────────────────────────

export interface OverviewSummaryProps {
  config: Record<string, any>;
}

export interface ConfigFormProps {
  form?: any;
  initialData?: any;
  mode: 'create' | 'edit';
  isSaving: boolean;
  onSave: (data: any) => Promise<void>;
  onCancel: () => void;
}

export interface ResponseCellProps {
  metadata: Record<string, any>;
  /** The key under which this plugin's data is stored in metadata (e.g. 'quiz-grading:pluginId') */
  metadataKey: string;
  responseId: string;
  onViewDetails?: (metadata: any, responseId: string) => void;
}

export interface MetadataViewerProps {
  metadata: any;
}

// ─── Plugin definition ───────────────────────────────────────────────────────

export interface FrontendPlugin {
  type: string;
  /** Config form rendered in PluginConfiguration page and Settings tab of the dashboard modal */
  ConfigForm: React.ComponentType<ConfigFormProps>;
  /** Optional: plugin-specific config summary shown on the Overview tab of the dashboard modal */
  OverviewSummary?: React.ComponentType<OverviewSummaryProps>;
  /** Optional: response table column cell */
  ResponseCell?: React.ComponentType<ResponseCellProps>;
  /**
   * Optional: static column header title (required when ResponseCell is provided
   * and no getColumnTitle is supplied).
   */
  columnTitle?: string;
  /**
   * Optional: derive the column header title from the stored plugin config JSON.
   * Takes precedence over `columnTitle` when supplied.
   */
  getColumnTitle?: (pluginConfig: Record<string, any>) => string;
  /** Optional: column width in pixels */
  columnSize?: number;
  /** Optional: metadata viewer for individual response view */
  MetadataViewer?: React.ComponentType<MetadataViewerProps>;
}

// ─── Registry ────────────────────────────────────────────────────────────────

const pluginRegistry = new Map<string, FrontendPlugin>();

export const registerFrontendPlugin = (plugin: FrontendPlugin): void => {
  pluginRegistry.set(plugin.type, plugin);
};

export const getFrontendPlugin = (type: string | undefined): FrontendPlugin | undefined => {
  if (!type) return undefined;
  return pluginRegistry.get(type);
};

export const getAllFrontendPlugins = (): FrontendPlugin[] =>
  Array.from(pluginRegistry.values());

// ─── Derived: response table columns ─────────────────────────────────────────

export interface PluginInstance {
  type: string;
  /** The plugin instance ID — used to build the per-instance metadata key */
  id?: string;
  /** The raw config JSON stored for this plugin instance */
  config?: Record<string, any>;
}

export function getPluginColumns<TData = any>(
  enabledPlugins: string[] | PluginInstance[],
  onViewDetails?: (pluginType: string, metadata: any, responseId: string) => void
): ColumnDef<TData>[] {
  // Normalise: accept either a string array (legacy) or PluginInstance array
  const instances: PluginInstance[] = (enabledPlugins as any[]).map((item) =>
    typeof item === 'string' ? { type: item } : item
  );

  return instances.flatMap(({ type, id, config = {} }) => {
    const plugin = pluginRegistry.get(type);
    if (!plugin?.ResponseCell) return [];

    // Resolve column title: prefer getColumnTitle(config) over static columnTitle
    const resolvedTitle =
      plugin.getColumnTitle
        ? plugin.getColumnTitle(config)
        : plugin.columnTitle;

    if (!resolvedTitle) return [];

    // Build the metadata key: 'type:id' when id is available, bare 'type' for legacy data
    const metadataKey = id ? `${type}:${id}` : type;

    const { ResponseCell, columnSize } = plugin;

    return [
      {
        accessorKey: 'metadata',
        id: `plugin-${metadataKey}`,
        header: ({ column }: any) => (
          <DataTableColumnHeader column={column} title={resolvedTitle} />
        ),
        cell: ({ row }: any) =>
          React.createElement(ResponseCell, {
            metadata: (row.original as any).metadata,
            metadataKey,
            responseId: (row.original as any).id,
            onViewDetails: onViewDetails
              ? (meta: any, rid: string) => onViewDetails(type, meta, rid)
              : undefined,
          }),
        enableSorting: false,
        size: columnSize,
      } as ColumnDef<TData>,
    ];
  });
}

// ─── Derived: metadata viewer ─────────────────────────────────────────────────

export const getMetadataViewer = (
  type: string
): React.ComponentType<MetadataViewerProps> | undefined =>
  pluginRegistry.get(type)?.MetadataViewer;

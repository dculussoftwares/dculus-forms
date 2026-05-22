import React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@dculus/ui';

// ─── Props contracts ────────────────────────────────────────────────────────

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
  responseId: string;
  onViewDetails?: (metadata: any, responseId: string) => void;
}

export interface MetadataViewerProps {
  metadata: any;
}

// ─── Plugin definition ───────────────────────────────────────────────────────

export interface FrontendPlugin {
  type: string;
  /** Config form rendered in PluginConfiguration page */
  ConfigForm: React.ComponentType<ConfigFormProps>;
  /** Optional: response table column cell */
  ResponseCell?: React.ComponentType<ResponseCellProps>;
  /** Optional: column header title (required when ResponseCell is provided) */
  columnTitle?: string;
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

export function getPluginColumns<TData = any>(
  enabledPluginTypes: string[],
  onViewDetails?: (pluginType: string, metadata: any, responseId: string) => void
): ColumnDef<TData>[] {
  return enabledPluginTypes.flatMap((type) => {
    const plugin = pluginRegistry.get(type);
    if (!plugin?.ResponseCell || !plugin.columnTitle) return [];

    const { ResponseCell, columnTitle, columnSize } = plugin;

    return [
      {
        accessorKey: 'metadata',
        header: ({ column }: any) => (
          <DataTableColumnHeader column={column} title={columnTitle} />
        ),
        cell: ({ row }: any) =>
          React.createElement(ResponseCell, {
            metadata: (row.original as any).metadata,
            responseId: (row.original as any).id,
            onViewDetails: onViewDetails
              ? (meta: any, id: string) => onViewDetails(type, meta, id)
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

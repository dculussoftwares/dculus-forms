/**
 * Responses Table Component
 *
 * Displays form responses in a data table with:
 * - Server-side pagination
 * - Column visibility controls
 * - Global search filtering
 * - Row click handlers
 */

import React from 'react';
import { ColumnDef, VisibilityState } from '@tanstack/react-table';
import { ServerDataTable } from '@dculus/ui';
import { FormResponse } from '@dculus/types';

interface ResponsesTableProps {
  // Data
  columns: ColumnDef<FormResponse>[];
  responses: FormResponse[];
  loading: boolean;

  // Pagination
  currentPage: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;

  // Filtering
  globalFilter: string;
  columnVisibility: VisibilityState;

  // Handlers
  onRowClick?: (row: FormResponse) => void;

  // Translation
  t: (key: string, options?: { values?: Record<string, string | number>; defaultValue?: string }) => string;
}

export const ResponsesTable: React.FC<ResponsesTableProps> = ({
  columns,
  responses,
  loading,
  currentPage,
  pageSize,
  totalPages,
  totalItems,
  onPageChange,
  onPageSizeChange,
  globalFilter,
  columnVisibility,
  onRowClick,
  t,
}) => {
  // Apply column visibility to columns
  const visibleColumns = columns
    .map((col) => ({
      ...col,
      meta: {
        ...col.meta,
        hidden: col.id ? columnVisibility[col.id] === false : false,
      },
    }))
    .filter((col) => !col.meta?.hidden);

  // Filter responses based on global search
  const filteredResponses = responses.filter((response: FormResponse) => {
    if (!globalFilter) return true;

    const searchText = globalFilter.toLowerCase();

    // Search in response ID
    if (response.id.toLowerCase().includes(searchText)) return true;

    // Search in response data
    return Object.values(response.data || {}).some((value) =>
      String(value).toLowerCase().includes(searchText)
    );
  });

  return (
    <div className="flex-1 overflow-hidden">
      <ServerDataTable
        columns={visibleColumns}
        data={filteredResponses}
        searchPlaceholder={t('table.searchPlaceholder')}
        onRowClick={(row) => {
          if (onRowClick) {
            onRowClick(row as FormResponse);
          } else {
            console.log('Row clicked:', row.id);
          }
        }}
        pageCount={totalPages}
        currentPage={currentPage}
        pageSize={pageSize}
        totalItems={totalItems}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        loading={loading}
        maxHeight="100%"
        className="border-0 h-full"
      />
    </div>
  );
};

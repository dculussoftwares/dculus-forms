/**
 * useResponsesState Hook
 *
 * Manages all state for the Responses page including:
 * - Pagination, sorting, and filtering
 * - Column visibility + order (persisted to localStorage)
 * - Plugin dialogs
 * - Export functionality
 */

import { useState, useMemo } from 'react';
import { useMutation } from '@apollo/client';
import { ColumnSizingState, OnChangeFn, RowSelectionState, VisibilityState } from '@tanstack/react-table';
import { FormResponse } from '@dculus/types';
import { FilterState } from '../components/Filters';
import { GENERATE_FORM_RESPONSE_REPORT } from '../graphql/queries';
import { DELETE_RESPONSES } from '../graphql/mutations';

const getStorageKey = (formId: string) => `dculus-responses-col-${formId}`;

function loadPersistedColState(formId: string | undefined): { order: string[]; visibility: VisibilityState } {
  if (!formId) return { order: [], visibility: {} };
  try {
    const raw = localStorage.getItem(getStorageKey(formId));
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        order: Array.isArray(parsed.order) ? parsed.order : [],
        visibility: parsed.visibility && typeof parsed.visibility === 'object' ? parsed.visibility : {},
      };
    }
  } catch { /* ignore */ }
  return { order: [], visibility: {} };
}

function persistColState(formId: string | undefined, update: Partial<{ order: string[]; visibility: VisibilityState; density: string; sizing: ColumnSizingState }>) {
  if (!formId) return;
  try {
    const raw = localStorage.getItem(getStorageKey(formId));
    const existing = raw ? JSON.parse(raw) : {};
    localStorage.setItem(getStorageKey(formId), JSON.stringify({ ...existing, ...update }));
  } catch { /* ignore */ }
}

export interface UseResponsesStateProps {
  formId: string | undefined;
}

export interface UseResponsesStateReturn {
  // Pagination
  currentPage: number;
  pageSize: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;
  handlePageChange: (page: number) => void;
  handlePageSizeChange: (size: number) => void;

  // Search and filters
  globalFilter: string;
  setGlobalFilter: (filter: string) => void;
  filters: Record<string, FilterState>;
  setFilters: React.Dispatch<React.SetStateAction<Record<string, FilterState>>>;
  graphqlFilters: any[] | null;
  filterLogic: 'AND' | 'OR';
  setFilterLogic: (logic: 'AND' | 'OR') => void;
  showFilterModal: boolean;
  setShowFilterModal: (show: boolean) => void;
  handleFilterChange: (fieldId: string, filterUpdate: Partial<FilterState>) => void;
  handleClearAllFilters: () => void;
  handleRemoveFilter: (fieldId: string) => void;
  handleApplyFilters: () => void;

  // Column visibility + order
  columnVisibility: VisibilityState;
  setColumnVisibility: React.Dispatch<React.SetStateAction<VisibilityState>>;
  columnOrder: string[];
  setColumnOrder: (order: string[]) => void;

  // Bulk row selection
  rowSelection: RowSelectionState;
  setRowSelection: React.Dispatch<React.SetStateAction<RowSelectionState>>;
  selectedResponseIds: string[];
  clearRowSelection: () => void;
  handleBulkDelete: (formId: string) => Promise<void>;
  handleBulkExport: (format: 'EXCEL' | 'CSV') => Promise<void>;
  isBulkDeleting: boolean;

  // Submission date range filter
  submittedAtRange: { from?: Date; to?: Date } | null;
  setSubmittedAtRange: (range: { from?: Date; to?: Date } | null) => void;

  // Row density
  rowDensity: 'compact' | 'default' | 'comfortable';
  setRowDensity: (density: 'compact' | 'default' | 'comfortable') => void;

  // Tag filter
  selectedTagIds: string[];
  toggleTagFilter: (tagId: string) => void;
  clearTagFilters: () => void;

  // Response detail panel
  detailPanelResponse: FormResponse | null;
  openDetailPanel: (response: FormResponse) => void;
  closeDetailPanel: () => void;

  // Column sizing
  columnSizing: ColumnSizingState;
  onColumnSizingChange: OnChangeFn<ColumnSizingState>;

  // Plugin dialogs
  pluginDialogState: {
    pluginType: string | null;
    metadata: any;
    responseId: string | null;
  };
  setPluginDialogState: React.Dispatch<React.SetStateAction<{
    pluginType: string | null;
    metadata: any;
    responseId: string | null;
  }>>;

  // Export
  isExporting: boolean;
  exportToExcel: () => Promise<void>;
  exportToCsv: () => Promise<void>;
}

export const useResponsesState = ({ formId }: UseResponsesStateProps): UseResponsesStateReturn => {
  // Pagination and sorting state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy] = useState('submittedAt');
  const [sortOrder] = useState<'asc' | 'desc'>('desc');

  // Enhanced UI state
  const [globalFilter, setGlobalFilter] = useState('');

  const [columnVisibility, setColumnVisibilityRaw] = useState<VisibilityState>(
    () => loadPersistedColState(formId).visibility
  );
  const setColumnVisibility: React.Dispatch<React.SetStateAction<VisibilityState>> = (update) => {
    setColumnVisibilityRaw((prev) => {
      const next = typeof update === 'function' ? update(prev) : update;
      persistColState(formId, { visibility: next });
      return next;
    });
  };

  const [columnOrder, setColumnOrderRaw] = useState<string[]>(
    () => loadPersistedColState(formId).order
  );
  const setColumnOrder = (order: string[]) => {
    setColumnOrderRaw(order);
    persistColState(formId, { order });
  };

  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState<Record<string, FilterState>>({});
  const [filterLogic, setFilterLogic] = useState<'AND' | 'OR'>('AND');

  // Plugin metadata dialog state
  const [pluginDialogState, setPluginDialogState] = useState<{
    pluginType: string | null;
    metadata: any;
    responseId: string | null;
  }>({
    pluginType: null,
    metadata: null,
    responseId: null,
  });

  // Submission date range filter
  const [submittedAtRangeState, setSubmittedAtRangeRaw] = useState<{ from?: Date; to?: Date } | null>(null);
  const submittedAtRange = submittedAtRangeState;
  const setSubmittedAtRange = (range: { from?: Date; to?: Date } | null) => {
    setSubmittedAtRangeRaw(range);
    setCurrentPage(1);
  };

  // Column sizing (persisted to localStorage)
  const [columnSizing, setColumnSizingRaw] = useState<ColumnSizingState>(() => {
    try {
      const raw = formId ? localStorage.getItem(getStorageKey(formId)) : null;
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed.sizing && typeof parsed.sizing === 'object' ? parsed.sizing : {};
    } catch { return {}; }
  });
  const onColumnSizingChange: OnChangeFn<ColumnSizingState> = (updater) => {
    setColumnSizingRaw((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      persistColState(formId, { sizing: next });
      return next;
    });
  };

  // Tag filter
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const toggleTagFilter = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
    setCurrentPage(1);
  };
  const clearTagFilters = () => { setSelectedTagIds([]); setCurrentPage(1); };

  // Response detail panel
  const [detailPanelResponse, setDetailPanelResponse] = useState<FormResponse | null>(null);
  const openDetailPanel = (response: FormResponse) => setDetailPanelResponse(response);
  const closeDetailPanel = () => setDetailPanelResponse(null);

  // Row density (persisted)
  const [rowDensity, setRowDensityRaw] = useState<'compact' | 'default' | 'comfortable'>(() => {
    try {
      const raw = formId ? localStorage.getItem(getStorageKey(formId)) : null;
      const parsed = raw ? JSON.parse(raw) : {};
      return (['compact', 'default', 'comfortable'].includes(parsed.density) ? parsed.density : 'default') as 'compact' | 'default' | 'comfortable';
    } catch { return 'default'; }
  });
  const setRowDensity = (d: 'compact' | 'default' | 'comfortable') => {
    setRowDensityRaw(d);
    persistColState(formId, { density: d });
  };

  // Bulk row selection state
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const selectedResponseIds = useMemo(
    () => Object.entries(rowSelection).filter(([, v]) => v).map(([id]) => id),
    [rowSelection]
  );
  const clearRowSelection = () => setRowSelection({});

  // Mutations
  const [generateReport, { loading: exportLoading }] = useMutation(GENERATE_FORM_RESPONSE_REPORT);
  const [bulkDeleteMutation, { loading: bulkDeleteLoading }] = useMutation(DELETE_RESPONSES);
  const isExporting = exportLoading;
  const isBulkDeleting = bulkDeleteLoading;

  // Pagination handlers
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1); // Reset to first page when page size changes
  };

  // Filter handlers
  const handleFilterChange = (fieldId: string, filterUpdate: Partial<FilterState>) => {
    setFilters((prev) => ({
      ...prev,
      [fieldId]: {
        ...prev[fieldId],
        fieldId,
        ...filterUpdate,
      },
    }));
    setCurrentPage(1);
  };

  const handleClearAllFilters = () => {
    setFilters({});
    setCurrentPage(1);
  };

  const handleRemoveFilter = (fieldId: string) => {
    setFilters((prev) => {
      const newFilters = { ...prev };
      delete newFilters[fieldId];
      return newFilters;
    });
    setCurrentPage(1);
  };

  const handleApplyFilters = () => {
    setCurrentPage(1);
  };

  // Convert filters to GraphQL format (includes synthetic __submittedAt filter when date range is set)
  const graphqlFilters = useMemo(() => {
    const activeFilters = Object.values(filters).filter((f) => f.active);
    const mapped = activeFilters.map((filter) => ({
      fieldId: filter.fieldId,
      operator: filter.operator,
      value: filter.operator === 'DATE_LAST_N_DAYS' && (!filter.value || filter.value.trim() === '')
        ? '7'
        : filter.value,
      values: filter.values,
      dateRange: filter.dateRange,
      numberRange: filter.numberRange,
    }));

    if (submittedAtRange && (submittedAtRange.from || submittedAtRange.to)) {
      mapped.push({
        fieldId: '__submittedAt',
        operator: 'DATE_BETWEEN',
        value: undefined,
        values: undefined,
        dateRange: {
          from: submittedAtRange.from?.toISOString(),
          to: submittedAtRange.to?.toISOString(),
        },
        numberRange: undefined,
      });
    }

    if (selectedTagIds.length > 0) {
      mapped.push({
        fieldId: '__tags',
        operator: 'IN',
        value: undefined,
        values: selectedTagIds,
        dateRange: undefined,
        numberRange: undefined,
      });
    }

    return mapped.length > 0 ? mapped : null;
  }, [filters, submittedAtRange, selectedTagIds]);

  // Convert frontend filters to GraphQL export format
  const convertFiltersForExport = () => {
    return Object.values(filters)
      .filter((filter) => filter.active)
      .map((filter) => ({
        fieldId: filter.fieldId,
        operator: filter.operator,
        value: filter.value || undefined,
        values: filter.values || undefined,
        dateRange: filter.dateRange
          ? {
            from: filter.dateRange.from || undefined,
            to: filter.dateRange.to || undefined,
          }
          : undefined,
        numberRange: filter.numberRange
          ? {
            min: filter.numberRange.min || undefined,
            max: filter.numberRange.max || undefined,
          }
          : undefined,
      }));
  };

  // Common download function
  const handleDownload = (downloadUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    console.log(`Download initiated: ${filename}`);
  };

  // Handle export with format selection
  const handleExport = async (format: 'EXCEL' | 'CSV') => {
    if (!formId) return;

    try {
      const activeFilters = convertFiltersForExport();
      const hasFilters = activeFilters.length > 0;

      console.log(
        `Generating ${format} report on backend${hasFilters ? ` with ${activeFilters.length} filters` : ' (all responses)'}...`
      );

      const { data } = await generateReport({
        variables: {
          formId,
          format,
          filters: hasFilters ? activeFilters : undefined,
          filterLogic: hasFilters && activeFilters.length > 1 ? filterLogic : undefined,
        },
      });

      if (data?.generateFormResponseReport?.downloadUrl) {
        const { downloadUrl, filename } = data.generateFormResponseReport;
        console.log(`${format} report generated: ${filename}`);
        handleDownload(downloadUrl, filename);
      }
    } catch (error) {
      console.error(`${format} export failed:`, error);
    }
  };

  // Export functions
  const exportToExcel = () => handleExport('EXCEL');
  const exportToCsv = () => handleExport('CSV');

  // Bulk delete
  const handleBulkDelete = async (fId: string) => {
    if (!selectedResponseIds.length) return;
    try {
      await bulkDeleteMutation({ variables: { formId: fId, ids: selectedResponseIds } });
      clearRowSelection();
      setCurrentPage(1);
    } catch {
      // error toast handled by caller
    }
  };

  // Bulk export (selected rows only)
  const handleBulkExport = async (format: 'EXCEL' | 'CSV') => {
    if (!formId || !selectedResponseIds.length) return;
    try {
      const { data } = await generateReport({
        variables: { formId, format, ids: selectedResponseIds },
      });
      if (data?.generateFormResponseReport?.downloadUrl) {
        handleDownload(data.generateFormResponseReport.downloadUrl, data.generateFormResponseReport.filename);
      }
    } catch {
      // error toast handled by caller
    }
  };

  return {
    // Pagination
    currentPage,
    pageSize,
    sortBy,
    sortOrder,
    setCurrentPage,
    setPageSize,
    handlePageChange,
    handlePageSizeChange,

    // Search and filters
    globalFilter,
    setGlobalFilter,
    filters,
    setFilters,
    graphqlFilters,
    filterLogic,
    setFilterLogic,
    showFilterModal,
    setShowFilterModal,
    handleFilterChange,
    handleClearAllFilters,
    handleRemoveFilter,
    handleApplyFilters,

    // Column visibility + order
    columnVisibility,
    setColumnVisibility,
    columnOrder,
    setColumnOrder,

    // Bulk row selection
    rowSelection,
    setRowSelection,
    selectedResponseIds,
    clearRowSelection,
    handleBulkDelete,
    handleBulkExport,
    isBulkDeleting,

    // Submission date range
    submittedAtRange,
    setSubmittedAtRange,

    // Tag filter
    selectedTagIds,
    toggleTagFilter,
    clearTagFilters,

    // Row density
    rowDensity,
    setRowDensity,

    // Response detail panel
    detailPanelResponse,
    openDetailPanel,
    closeDetailPanel,

    // Column sizing
    columnSizing,
    onColumnSizingChange,

    // Plugin dialogs
    pluginDialogState,
    setPluginDialogState,

    // Export
    isExporting,
    exportToExcel,
    exportToCsv,
  };
};

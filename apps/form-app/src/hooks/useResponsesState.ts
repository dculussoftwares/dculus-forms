/**
 * useResponsesState Hook
 *
 * Manages all state for the Responses page including:
 * - Pagination, sorting, and filtering
 * - Column visibility
 * - Plugin dialogs
 * - Export functionality
 */

import { useState, useMemo } from 'react';
import { useMutation } from '@apollo/client';
import { VisibilityState } from '@tanstack/react-table';
import { FilterState } from '../components/Filters';
import { GENERATE_FORM_RESPONSE_REPORT } from '../graphql/queries';

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

  // Column visibility
  columnVisibility: VisibilityState;
  setColumnVisibility: React.Dispatch<React.SetStateAction<VisibilityState>>;

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
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
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

  // Mutation for generating reports
  const [generateReport, { loading: exportLoading }] = useMutation(GENERATE_FORM_RESPONSE_REPORT);
  const isExporting = exportLoading;

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

  // Convert filters to GraphQL format
  const graphqlFilters = useMemo(() => {
    const activeFilters = Object.values(filters).filter((f) => f.active);
    return activeFilters.length > 0
      ? activeFilters.map((filter) => ({
        fieldId: filter.fieldId,
        operator: filter.operator,
        // Use default value of '7' for DATE_LAST_N_DAYS if value is empty
        value: filter.operator === 'DATE_LAST_N_DAYS' && (!filter.value || filter.value.trim() === '')
          ? '7'
          : filter.value,
        values: filter.values,
        dateRange: filter.dateRange,
        numberRange: filter.numberRange,
      }))
      : null;
  }, [filters]);

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

    // Column visibility
    columnVisibility,
    setColumnVisibility,

    // Plugin dialogs
    pluginDialogState,
    setPluginDialogState,

    // Export
    isExporting,
    exportToExcel,
    exportToCsv,
  };
};

import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@apollo/client';
import { ColumnDef, VisibilityState } from '@tanstack/react-table';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  LoadingSpinner,
  ServerDataTable,
  TypographyH3,
  TypographyP,
  DataTableColumnHeader,
  Input,
} from '@dculus/ui';
import { MainLayout } from '../components/MainLayout';
import { FilterModal, FilterChip, FilterState } from '../components/Filters';
import {
  GENERATE_FORM_RESPONSE_REPORT,
  GET_FORM_BY_ID,
  GET_FORM_RESPONSES,
} from '../graphql/queries';
import {
  deserializeFormSchema,
  FieldType,
  FillableFormField,
  FormResponse,
  FormSchema,
} from '@dculus/types';
import {
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  MoreHorizontal,
  Search,
  Settings2,
  X,
  Calendar,
  Hash,
  Type,
  CheckSquare,
  List,
  RotateCcw,
} from 'lucide-react';

// Helper function to format values based on field type
const formatFieldValue = (value: any, fieldType: FieldType): string => {
  if (value === null || value === undefined) return '';

  switch (fieldType) {
    case FieldType.CHECKBOX_FIELD:
      return Array.isArray(value) ? value.join(', ') : String(value);
    case FieldType.DATE_FIELD:
      // Handle date field values properly
      const timestamp = typeof value === 'string' ? parseInt(value, 10) : value;
      const date = new Date(timestamp);
      return isNaN(date.getTime()) ? 'Invalid date' : date.toLocaleDateString();
    case FieldType.SELECT_FIELD:
      return Array.isArray(value) ? value.join(', ') : String(value);
    default:
      return String(value);
  }
};

const ResponsesTable: React.FC = () => {
  const { formId, id } = useParams<{ formId?: string; id?: string }>();
  const navigate = useNavigate();

  // Pagination and sorting state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  // Note: Sorting is now handled by the DataTable components directly
  // These states are kept for server-side sorting if needed in the future
  const [sortBy] = useState('submittedAt');
  const [sortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Enhanced UI state
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState<Record<string, FilterState>>({});

  // Use formId if available, otherwise fall back to id for backward compatibility
  const actualFormId = formId || id;

  // Filter handlers
  const handleFilterChange = (fieldId: string, filterUpdate: Partial<FilterState>) => {
    setFilters(prev => ({
      ...prev,
      [fieldId]: { 
        ...prev[fieldId],
        fieldId,
        ...filterUpdate 
      }
    }));
    // Reset to first page when filters change
    setCurrentPage(1);
  };

  const handleClearAllFilters = () => {
    setFilters({});
    setCurrentPage(1);
  };

  const handleRemoveFilter = (fieldId: string) => {
    setFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[fieldId];
      return newFilters;
    });
    setCurrentPage(1);
  };

  const handleApplyFilters = () => {
    // Reset to first page when applying filters
    setCurrentPage(1);
  };

  const {
    data: formData,
    loading: formLoading,
    error: formError,
  } = useQuery(GET_FORM_BY_ID, {
    variables: { id: actualFormId },
    skip: !actualFormId,
  });

  // Convert filters to GraphQL format
  const graphqlFilters = useMemo(() => {
    const activeFilters = Object.values(filters).filter(f => f.active);
    return activeFilters.length > 0 ? activeFilters.map(filter => ({
      fieldId: filter.fieldId,
      operator: filter.operator,
      value: filter.value,
      values: filter.values,
      dateRange: filter.dateRange,
      numberRange: filter.numberRange,
    })) : null;
  }, [filters]);

  const {
    data: responsesData,
    loading: responsesLoading,
    error: responsesError,
    // refetch: refetchResponses,
  } = useQuery(GET_FORM_RESPONSES, {
    variables: {
      formId: actualFormId,
      page: currentPage,
      limit: pageSize,
      sortBy,
      sortOrder,
      filters: graphqlFilters,
    },
    skip: !actualFormId,
    notifyOnNetworkStatusChange: true,
  });

  // Mutation for generating reports
  const [generateReport, { loading: exportLoading }] = useMutation(
    GENERATE_FORM_RESPONSE_REPORT
  );

  const isExporting = exportLoading;

  // This function is not needed with the new DataTableColumnHeader component
  // Sorting is handled automatically by TanStack Table

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

  // Convert frontend filters to GraphQL format
  const convertFiltersForExport = () => {
    return Object.values(filters)
      .filter(filter => filter.active)
      .map(filter => ({
        fieldId: filter.fieldId,
        operator: filter.operator,
        value: filter.value || undefined,
        values: filter.values || undefined,
        dateRange: filter.dateRange ? {
          from: filter.dateRange.from || undefined,
          to: filter.dateRange.to || undefined
        } : undefined,
        numberRange: filter.numberRange ? {
          min: filter.numberRange.min || undefined,
          max: filter.numberRange.max || undefined
        } : undefined
      }));
  };

  // Handle export with format selection
  const handleExport = async (format: 'EXCEL' | 'CSV') => {
    if (!actualFormId) return;

    try {
      const activeFilters = convertFiltersForExport();
      const hasFilters = activeFilters.length > 0;
      
      console.log(`Generating ${format} report on backend${hasFilters ? ` with ${activeFilters.length} filters` : ' (all responses)'}...`);

      const { data } = await generateReport({
        variables: { 
          formId: actualFormId, 
          format,
          filters: hasFilters ? activeFilters : undefined
        },
      });

      if (data?.generateFormResponseReport?.downloadUrl) {
        const { downloadUrl, filename } = data.generateFormResponseReport;
        console.log(`${format} report generated: ${filename}`);
        handleDownload(downloadUrl, filename);
      }
    } catch (error) {
      console.error(`${format} export failed:`, error);
      // You could add a toast notification here
    }
  };

  // Export to Excel function (now using unified backend)
  const exportToExcel = () => handleExport('EXCEL');

  // Export to CSV function (using unified backend)
  const exportToCsv = () => handleExport('CSV');

  // Extract fillable form fields for filtering
  const fillableFields = useMemo(() => {
    if (!formData?.form?.formSchema) return [];

    const formSchema: FormSchema = deserializeFormSchema(formData.form.formSchema);
    const fields: FillableFormField[] = [];
    
    formSchema.pages.forEach((page) => {
      page.fields.forEach((field) => {
        if (field instanceof FillableFormField) {
          fields.push(field);
        }
      });
    });
    
    return fields;
  }, [formData]);

  // Generate dynamic columns based on form schema
  const columns: ColumnDef<FormResponse>[] = useMemo(() => {
    if (!formData?.form?.formSchema) return [];

    const formSchema: FormSchema = deserializeFormSchema(
      formData.form.formSchema
    );
    const baseColumns: ColumnDef<FormResponse>[] = [
      {
        accessorKey: 'id',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Response ID" />
        ),
        cell: ({ row }) => {
          const id = row.getValue('id') as string;
          return (
            <div className="flex items-center space-x-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <span className="inline-flex items-center px-2 py-1 text-xs font-mono font-medium bg-slate-100/80 text-slate-800 border border-slate-200/60 rounded-md">
                {id?.slice(-6) || 'N/A'}
              </span>
            </div>
          );
        },
        enableSorting: true,
        enableHiding: false,
        size: 140,
      },
      {
        accessorKey: 'submittedAt',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Submitted At" />
        ),
        cell: ({ row }) => {
          const submittedAt = row.getValue('submittedAt') as string | number;
          const timestamp =
            typeof submittedAt === 'string'
              ? parseInt(submittedAt, 10)
              : submittedAt;
          const date = new Date(timestamp);

          if (isNaN(date.getTime())) {
            return (
              <div className="flex items-center space-x-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span className="text-sm">Invalid date</span>
              </div>
            );
          }

          return (
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="text-sm font-medium">
                  {date.toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
                <span className="text-xs text-muted-foreground">
                  {date.toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
          );
        },
        enableSorting: true,
        size: 180,
      },
    ];

    // Generate columns for form fields
    const fieldColumns: ColumnDef<FormResponse>[] = [];
    formSchema.pages.forEach((page) => {
      page.fields.forEach((field) => {
        if (field instanceof FillableFormField) {
          // Get field type icon
          const getFieldIcon = (fieldType: FieldType) => {
            switch (fieldType) {
              case FieldType.TEXT_INPUT_FIELD:
                return <Type className="h-4 w-4" />;
              case FieldType.CHECKBOX_FIELD:
                return <CheckSquare className="h-4 w-4" />;
              case FieldType.DATE_FIELD:
                return <Calendar className="h-4 w-4" />;
              case FieldType.SELECT_FIELD:
              case FieldType.RADIO_FIELD:
                return <List className="h-4 w-4" />;
              default:
                return <Type className="h-4 w-4" />;
            }
          };

          fieldColumns.push({
            accessorKey: `data.${field.id}`,
            id: `field-${field.id}`,
            header: ({ column }) => (
              <div className="flex items-center space-x-2">
                <div className="text-muted-foreground">
                  {getFieldIcon(field.type)}
                </div>
                <DataTableColumnHeader 
                  column={column} 
                  title={field.label} 
                />
              </div>
            ),
            cell: ({ row }) => {
              const value = row.original.data[field.id];
              const formattedValue = formatFieldValue(value, field.type);
              
              if (!formattedValue) {
                return (
                  <div className="flex items-center space-x-2 text-muted-foreground">
                    {getFieldIcon(field.type)}
                    <span className="text-sm italic">No response</span>
                  </div>
                );
              }

              return (
                <div className="flex items-center space-x-2">
                  <div className="text-muted-foreground">
                    {getFieldIcon(field.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium truncate block" title={formattedValue}>
                      {formattedValue}
                    </span>
                  </div>
                </div>
              );
            },
            enableSorting: true,
            enableHiding: true,
            size: 200,
          });
        }
      });
    });

    // Actions column
    const actionsColumn: ColumnDef<FormResponse> = {
      id: 'actions',
      header: () => <div className="text-center">Actions</div>,
      cell: ({ row }) => (
        <div className="flex items-center justify-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600"
            onClick={(e) => {
              e.stopPropagation();
              // TODO: Navigate to individual response view
              console.log('View response:', row.original.id);
            }}
          >
            <Eye className="h-4 w-4" />
            <span className="sr-only">View response</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-slate-50"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">More actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => console.log('Edit response:', row.original.id)}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => console.log('Delete response:', row.original.id)}>
                <X className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
      size: 80,
    };

    return [...baseColumns, ...fieldColumns, actionsColumn];
  }, [formData, sortBy, sortOrder]);

  const loading = formLoading;
  const error = formError || responsesError;
  const responsePagination = responsesData?.responsesByForm;
  const responses = responsePagination?.data || [];

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  // Handle page size change
  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1); // Reset to first page when changing page size
  };

  if (loading) {
    return (
      <MainLayout
        title="Table View - Responses"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Form Dashboard', href: `/dashboard/form/${actualFormId}` },
          {
            label: 'Responses',
            href: `/dashboard/form/${actualFormId}/responses`,
          },
          {
            label: 'Table View',
            href: `/dashboard/form/${actualFormId}/responses/table`,
          },
        ]}
      >
        <div className="flex justify-center items-center min-h-96">
          <LoadingSpinner />
        </div>
      </MainLayout>
    );
  }

  if (error || !formData?.form) {
    return (
      <MainLayout
        title="Table View - Responses"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Form Dashboard', href: `/dashboard/form/${actualFormId}` },
          {
            label: 'Responses',
            href: `/dashboard/form/${actualFormId}/responses`,
          },
          {
            label: 'Table View',
            href: `/dashboard/form/${actualFormId}/responses/table`,
          },
        ]}
      >
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="max-w-md text-center p-8 bg-white rounded-lg shadow-sm border border-slate-200/60">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <h3 className="mb-2 text-xl font-semibold">
              {formData?.form ? 'Error Loading Responses' : 'Form Not Found'}
            </h3>
            <p className="text-slate-600">
              {formData?.form
                ? 'There was an error loading the form responses. Please try again.'
                : "The form you're looking for doesn't exist or you don't have permission to view it."}
            </p>
          </div>
        </div>
      </MainLayout>
    );
  }

  const form = formData.form;

  // Enhanced data table toolbar component
  const DataTableToolbar = () => {
    const hiddenColumns = Object.entries(columnVisibility)
      .filter(([_, visible]) => !visible)
      .map(([id]) => {
        const field = formData?.form?.formSchema ? 
          deserializeFormSchema(formData.form.formSchema)
            .pages.flatMap(p => p.fields)
            .find(f => `field-${f.id}` === id && f instanceof FillableFormField) : null;
        return field ? (field as FillableFormField).label : id;
      });

    return (
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-slate-50/80 border-b border-slate-200/40 w-full overflow-hidden">
        {/* Left side - Search and filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-1 min-w-0 overflow-hidden">
          {/* Enhanced search */}
          <div className="relative w-full sm:w-80 sm:max-w-[320px] min-w-0">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search responses..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-9 h-10 w-full"
            />
            {globalFilter && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-transparent"
                onClick={() => setGlobalFilter('')}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Clear search</span>
              </Button>
            )}
          </div>

          {/* Filter toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilterModal(true)}
            className="flex-shrink-0"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
            {Object.values(filters).some(f => f.active) && (
              <span className="ml-2 px-2 py-0.5 bg-blue-100/80 text-blue-800 text-xs rounded-full font-medium border border-blue-200/40">
                {Object.values(filters).filter(f => f.active).length}
              </span>
            )}
          </Button>

          {/* Active filters display */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search indicator */}
            {globalFilter && (
              <div className="flex items-center gap-1 px-2 py-1 bg-blue-50/80 text-blue-700 text-sm rounded-md border border-blue-200/60">
                <span className="truncate max-w-32">Search: "{globalFilter.slice(0, 15)}{globalFilter.length > 15 ? '...' : ''}"</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 hover:bg-transparent text-blue-700 flex-shrink-0"
                  onClick={() => setGlobalFilter('')}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
            
            {/* Field filters */}
            {Object.entries(filters).filter(([, f]) => f.active).map(([filterId, filter]) => {
              const field = fillableFields.find(f => f.id === filter.fieldId);
              return field ? (
                <FilterChip
                  key={filterId}
                  field={field}
                  filter={filter}
                  onRemove={() => handleRemoveFilter(filterId)}
                />
              ) : null;
            })}
          </div>
        </div>

        {/* Right side - Actions and column visibility */}
        <div className="flex items-center gap-3 flex-shrink-0 overflow-visible">
          {/* Column visibility */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="flex-shrink-0">
                <Settings2 className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Columns</span>
                {hiddenColumns.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-slate-100/80 text-slate-700 text-xs rounded-full font-medium border border-slate-200/40">
                    {hiddenColumns.length} hidden
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <div className="flex flex-col max-h-80">
                <div className="flex items-center justify-between p-3 pb-2 border-b flex-shrink-0">
                  <span className="text-sm font-medium">Toggle columns</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => setColumnVisibility({})}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Reset
                  </Button>
                </div>
                <div className="overflow-y-auto flex-1 p-2">
                  {columns.length === 0 ? (
                    <div className="text-center text-slate-500 text-sm py-4">
                      No columns available
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {columns.map((column) => {
                        if (!column.id || column.enableHiding === false) return null;
                        const isVisible = columnVisibility[column.id] !== false;
                        
                        let columnLabel = column.id;
                        if (column.id.startsWith('field-')) {
                          if (formData?.form?.formSchema) {
                            const field = deserializeFormSchema(formData.form.formSchema)
                              .pages.flatMap(p => p.fields)
                              .find(f => `field-${f.id}` === column.id);
                            columnLabel = field instanceof FillableFormField ? field.label : column.id;
                          }
                        } else if (column.id === 'id') {
                          columnLabel = 'Response ID';
                        } else if (column.id === 'submittedAt') {
                          columnLabel = 'Submitted At';
                        }
                        
                        return (
                          <div key={column.id} className="flex items-center space-x-2 p-2 rounded hover:bg-slate-50">
                            <input
                              type="checkbox"
                              checked={isVisible}
                              onChange={(e) => setColumnVisibility(prev => ({
                                ...prev,
                                [column.id!]: e.target.checked
                              }))}
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm flex-1 min-w-0 truncate" title={columnLabel}>
                              {columnLabel}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Export dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={isExporting}
                className="flex-shrink-0"
              >
                {exportLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Export</span>
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportToExcel} disabled={isExporting}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export as Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportToCsv} disabled={isExporting}>
                <FileText className="h-4 w-4 mr-2" />
                Export as CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  };

  return (
    <MainLayout
      title={`${form.title} - Table View`}
      breadcrumbs={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: form.title, href: `/dashboard/form/${actualFormId}` },
        {
          label: 'Responses',
          href: `/dashboard/form/${actualFormId}/responses`,
        },
        {
          label: 'Table View',
          href: `/dashboard/form/${actualFormId}/responses/table`,
        },
      ]}
    >
      {/* Full-screen container with horizontal overflow prevention */}
      <div className="flex flex-col h-full w-full overflow-x-hidden">
        {/* Compact Header */}
        <div className="flex items-center gap-4 p-3 border-b border-slate-200/40 bg-white flex-shrink-0 w-full overflow-hidden rounded-t-lg">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/dashboard/form/${actualFormId}/responses`)}
            className="hover:bg-slate-100 flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="h-4 w-px bg-slate-300 flex-shrink-0" />
          <h1 className="text-lg font-semibold text-slate-900 truncate flex-1">{form.title}</h1>
          <div className="flex items-center gap-2 flex-shrink-0">
            {responsesLoading && (
              <div className="w-4 h-4 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin"></div>
            )}
            <span className="text-sm text-muted-foreground">
              {responsePagination?.total || 0} responses
            </span>
          </div>
        </div>

        {/* Main content area - prevents horizontal page scroll */}
        <div className="flex-1 flex flex-col min-h-0 w-full overflow-x-hidden">
          {responsesError ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center p-8">
                <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
                <TypographyH3 className="text-gray-900 mb-2">
                  Error Loading Responses
                </TypographyH3>
                <TypographyP className="text-gray-600 mb-6">
                  There was an error loading the form responses. Please try again.
                </TypographyP>
                <Button onClick={() => window.location.reload()} variant="outline">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Refresh Page
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex bg-white border border-slate-200/60 rounded-lg shadow-sm m-2 overflow-hidden">
              {/* Main table area */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Enhanced toolbar - Fixed width, no horizontal scroll */}
                <div className="flex-shrink-0 overflow-hidden">
                  <DataTableToolbar />
                </div>
                
                {/* Table container - Only table content scrolls horizontally */}
                <div className="flex-1 overflow-hidden">
                <ServerDataTable
                  columns={columns.map(col => ({
                    ...col,
                    // Apply column visibility
                    meta: {
                      ...col.meta,
                      hidden: col.id ? columnVisibility[col.id] === false : false
                    }
                  })).filter(col => !col.meta?.hidden)}
                  data={responses.filter((response: FormResponse) => {
                    if (!globalFilter) return true;
                    
                    const searchText = globalFilter.toLowerCase();
                    
                    // Search in response ID
                    if (response.id.toLowerCase().includes(searchText)) return true;
                    
                    // Search in response data
                    return Object.values(response.data || {}).some(value => 
                      String(value).toLowerCase().includes(searchText)
                    );
                  })}
                  searchPlaceholder="Search responses..."
                  onRowClick={(row) => {
                    console.log('Row clicked:', row.id);
                  }}
                  pageCount={responsePagination?.totalPages || 0}
                  currentPage={currentPage}
                  pageSize={pageSize}
                  totalItems={responsePagination?.total || 0}
                  onPageChange={handlePageChange}
                  onPageSizeChange={handlePageSizeChange}
                  loading={responsesLoading}
                  maxHeight="100%"
                  className="border-0 h-full"
                />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filter Modal */}
      <FilterModal
        open={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        fields={fillableFields}
        filters={filters}
        onFilterChange={handleFilterChange}
        onRemoveFilter={handleRemoveFilter}
        onClearAllFilters={handleClearAllFilters}
        onApplyFilters={handleApplyFilters}
      />
    </MainLayout>
  );
};

export default ResponsesTable;
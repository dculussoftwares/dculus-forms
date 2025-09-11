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
  Database,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  MoreHorizontal,
  Table,
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
  const [showFilters, setShowFilters] = useState(false);

  // Use formId if available, otherwise fall back to id for backward compatibility
  const actualFormId = formId || id;

  const {
    data: formData,
    loading: formLoading,
    error: formError,
  } = useQuery(GET_FORM_BY_ID, {
    variables: { id: actualFormId },
    skip: !actualFormId,
  });

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

  // Handle export with format selection
  const handleExport = async (format: 'EXCEL' | 'CSV') => {
    if (!actualFormId) return;

    try {
      console.log(`Generating ${format} report on backend...`);

      const { data } = await generateReport({
        variables: { formId: actualFormId, format },
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
              <span className="inline-flex items-center px-2 py-1 text-xs font-mono font-medium bg-slate-100 text-slate-800 border border-slate-200 rounded-md">
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
          <div className="max-w-md text-center p-8 bg-white rounded-lg shadow-sm border border-slate-200">
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 bg-gradient-to-r from-slate-50 via-white to-slate-50 border-b border-slate-200 w-full overflow-hidden">
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
            onClick={() => setShowFilters(!showFilters)}
            className={`flex-shrink-0 ${showFilters ? 'bg-blue-50 border-blue-200' : ''}`}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
            {showFilters && <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">On</span>}
          </Button>

          {/* Active filters indicator */}
          {globalFilter && (
            <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-sm rounded-md border border-blue-200 max-w-xs">
              <span className="truncate">Search: "{globalFilter.slice(0, 20)}{globalFilter.length > 20 ? '...' : ''}"</span>
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
                  <span className="ml-2 px-2 py-0.5 bg-slate-100 text-slate-700 text-xs rounded-full font-medium">
                    {hiddenColumns.length} hidden
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="p-2">
                <div className="flex items-center justify-between pb-2 mb-2 border-b">
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
                {columns.map((column) => {
                  if (!column.id || column.enableHiding === false) return null;
                  const isVisible = columnVisibility[column.id] !== false;
                  return (
                    <div key={column.id} className="flex items-center space-x-2 py-1">
                      <input
                        type="checkbox"
                        checked={isVisible}
                        onChange={(e) => setColumnVisibility(prev => ({
                          ...prev,
                          [column.id!]: e.target.checked
                        }))}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <span className="text-sm">
                        {column.id.startsWith('field-') 
                          ? formData?.form?.formSchema 
                            ? (() => {
                                const field = deserializeFormSchema(formData.form.formSchema)
                                  .pages.flatMap(p => p.fields)
                                  .find(f => `field-${f.id}` === column.id);
                                return field instanceof FillableFormField ? field.label : column.id;
                              })()
                            : column.id
                          : column.id === 'id' ? 'Response ID'
                          : column.id === 'submittedAt' ? 'Submitted At'
                          : column.id}
                      </span>
                    </div>
                  );
                })}
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
        {/* Header with navigation and form info */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-white flex-shrink-0 w-full overflow-hidden">
          <div className="flex items-center gap-4 min-w-0 overflow-hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/dashboard/form/${actualFormId}/responses`)}
              className="hover:bg-slate-100 flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Responses
            </Button>
            <div className="h-6 w-px bg-slate-300 flex-shrink-0" />
            <div className="min-w-0 overflow-hidden">
              <h1 className="text-xl font-semibold text-slate-900 truncate">{form.title}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded-md font-medium flex-shrink-0">
                  <Table className="h-3 w-3 mr-1" />
                  Table View
                </span>
                <span className="text-sm text-muted-foreground flex-shrink-0">
                  {responsePagination?.total || 0} responses
                </span>
              </div>
            </div>
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
          ) : responses.length === 0 && !responsesLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center p-8">
                <Database className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <TypographyH3 className="text-gray-900 mb-2">
                  No responses yet
                </TypographyH3>
                <TypographyP className="text-gray-600 mb-6">
                  Once people start submitting your form, their responses will appear here.
                </TypographyP>
                <Button
                  onClick={() => navigate(`/dashboard/form/${actualFormId}`)}
                  variant="outline"
                >
                  Back to Dashboard
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col bg-white border border-slate-200 m-6 rounded-lg shadow-sm overflow-hidden">
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
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default ResponsesTable;
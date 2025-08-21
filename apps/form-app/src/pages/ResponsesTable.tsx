import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@apollo/client';
import { ColumnDef } from '@tanstack/react-table';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  LoadingSpinner,
  ServerDataTable,
  TypographyH3,
  TypographyP,
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
  const [sortBy, setSortBy] = useState('submittedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

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

  // Handle sorting change
  const handleSortingChange = (column: string) => {
    if (sortBy === column) {
      // If clicking the same column, toggle sort order
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // If clicking a different column, set new column and default to desc
      setSortBy(column);
      setSortOrder('desc');
    }
    setCurrentPage(1); // Reset to first page when changing sort
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
        header: () => (
          <button
            className="group flex items-center space-x-2 text-left font-semibold text-slate-700 hover:text-slate-900 transition-all duration-200 hover:bg-slate-100/50 px-2 py-1.5 rounded-md -mx-2"
            onClick={() => handleSortingChange('id')}
          >
            <span className="font-semibold text-sm">Response ID</span>
            <div className="flex flex-col space-y-0.5 ml-1">
              {sortBy === 'id' ? (
                <div className="flex items-center">
                  {sortOrder === 'asc' ? (
                    <svg
                      className="w-4 h-4 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M5 15l7-7 7 7"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-4 h-4 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  )}
                </div>
              ) : (
                <div className="flex flex-col opacity-30 group-hover:opacity-70 transition-opacity">
                  <svg
                    className="w-3 h-3 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 15l7-7 7 7"
                    />
                  </svg>
                  <svg
                    className="w-3 h-3 text-slate-400 -mt-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              )}
            </div>
          </button>
        ),
        cell: ({ row }) => (
          <div className="w-24">
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              #{row.getValue('id')}
            </span>
          </div>
        ),
        size: 120,
        minSize: 80,
        maxSize: 200,
      },
      {
        accessorKey: 'submittedAt',
        header: () => (
          <button
            className="group flex items-center space-x-2 text-left font-semibold text-slate-700 hover:text-slate-900 transition-all duration-200 hover:bg-slate-100/50 px-2 py-1.5 rounded-md -mx-2"
            onClick={() => handleSortingChange('submittedAt')}
          >
            <span className="font-semibold text-sm">Submitted At</span>
            <div className="flex flex-col space-y-0.5 ml-1">
              {sortBy === 'submittedAt' ? (
                <div className="flex items-center">
                  {sortOrder === 'asc' ? (
                    <svg
                      className="w-4 h-4 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M5 15l7-7 7 7"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-4 h-4 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  )}
                </div>
              ) : (
                <div className="flex flex-col opacity-30 group-hover:opacity-70 transition-opacity">
                  <svg
                    className="w-3 h-3 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 15l7-7 7 7"
                    />
                  </svg>
                  <svg
                    className="w-3 h-3 text-slate-400 -mt-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              )}
            </div>
          </button>
        ),
        cell: ({ row }) => {
          const submittedAt = row.getValue('submittedAt') as string | number;
          // Convert string timestamp to number if needed
          const timestamp =
            typeof submittedAt === 'string'
              ? parseInt(submittedAt, 10)
              : submittedAt;
          const date = new Date(timestamp);

          // Check if date is valid
          if (isNaN(date.getTime())) {
            return (
              <div className="w-36">
                <span className="text-sm text-gray-400 whitespace-nowrap">
                  Invalid date
                </span>
              </div>
            );
          }

          return (
            <div className="w-36">
              <div className="flex flex-col space-y-0.5">
                <span className="text-sm font-medium text-slate-800">
                  {date.toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
                <span className="text-xs text-slate-500">
                  {date.toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZoneName: 'short',
                  })}
                </span>
              </div>
            </div>
          );
        },
        size: 180,
        minSize: 120,
        maxSize: 250,
      },
    ];

    // Generate columns for form fields
    const fieldColumns: ColumnDef<FormResponse>[] = [];
    formSchema.pages.forEach((page) => {
      page.fields.forEach((field) => {
        if (field instanceof FillableFormField) {
          fieldColumns.push({
            accessorKey: `data.${field.id}`,
            header: () => (
              <button
                className="group flex items-center space-x-2 text-left font-semibold text-slate-700 hover:text-slate-900 transition-all duration-200 hover:bg-slate-100/50 px-2 py-1.5 rounded-md -mx-2"
                onClick={() => handleSortingChange(`data.${field.id}`)}
              >
                <span
                  className="font-semibold text-sm truncate max-w-[120px]"
                  title={field.label}
                >
                  {field.label}
                </span>
                <div className="flex flex-col space-y-0.5 ml-1 flex-shrink-0">
                  {sortBy === `data.${field.id}` ? (
                    <div className="flex items-center">
                      {sortOrder === 'asc' ? (
                        <svg
                          className="w-4 h-4 text-blue-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2.5}
                            d="M5 15l7-7 7 7"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="w-4 h-4 text-blue-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2.5}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col opacity-30 group-hover:opacity-70 transition-opacity">
                      <svg
                        className="w-3 h-3 text-slate-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 15l7-7 7 7"
                        />
                      </svg>
                      <svg
                        className="w-3 h-3 text-slate-400 -mt-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              </button>
            ),
            cell: ({ row }) => {
              const value = row.original.data[field.id];
              const formattedValue = formatFieldValue(value, field.type);
              return (
                <div className="overflow-hidden">
                  {formattedValue ? (
                    <span
                      className="text-sm text-slate-700 font-medium block"
                      title={formattedValue}
                    >
                      {formattedValue}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400 italic">
                      No response
                    </span>
                  )}
                </div>
              );
            },
            size: 200,
            minSize: 120,
            maxSize: 400,
          });
        }
      });
    });

    // Actions column
    const actionsColumn: ColumnDef<FormResponse> = {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-1 w-20">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600 transition-all duration-200"
            onClick={(e) => {
              e.stopPropagation();
              // TODO: Navigate to individual response view
              console.log('View response:', row.original.id);
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-slate-50 hover:text-slate-600 transition-all duration-200"
            onClick={(e) => {
              e.stopPropagation();
              // TODO: Show more actions menu
              console.log('More actions for:', row.original.id);
            }}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      ),
      size: 100,
      minSize: 80,
      maxSize: 150,
      enableSorting: false,
    };

    return [...baseColumns, ...fieldColumns, actionsColumn];
  }, [formData, sortBy, sortOrder, handleSortingChange]);

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
        <div className="max-w-4xl mx-auto px-4 py-12">
          <Card className="p-8 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <h3 className="mb-2 text-xl font-semibold">
              {formData?.form ? 'Error Loading Responses' : 'Form Not Found'}
            </h3>
            <p className="text-slate-600">
              {formData?.form
                ? 'There was an error loading the form responses. Please try again.'
                : "The form you're looking for doesn't exist or you don't have permission to view it."}
            </p>
          </Card>
        </div>
      </MainLayout>
    );
  }

  const form = formData.form;

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
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Enhanced Header Section */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-gradient-to-r from-slate-50 to-blue-50/30 p-6 rounded-xl border border-slate-200/60">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                navigate(`/dashboard/form/${actualFormId}/responses`)
              }
              className="text-slate-600 hover:text-slate-900 hover:bg-white/70 transition-all duration-200 px-3 py-2 rounded-lg"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Responses
            </Button>
            <div className="h-6 w-px bg-slate-300"></div>
            <div className="flex flex-col">
              <h1 className="text-lg font-bold text-slate-900">{form.title}</h1>
              <p className="text-sm text-slate-600">Table View</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="bg-white hover:bg-slate-50 border-slate-200 transition-all duration-200"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isExporting}
                  className="bg-white hover:bg-slate-50 border-slate-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {exportLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-600 mr-2"></div>
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Export
                      <ChevronDown className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={exportToExcel}
                  disabled={isExporting}
                  className="cursor-pointer"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Export as Excel
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={exportToCsv}
                  disabled={isExporting}
                  className="cursor-pointer"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Export as CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Enhanced Responses Table Card */}
        <Card className="shadow-sm border-slate-200/60">
          <CardHeader className="bg-gradient-to-r from-white to-slate-50/50 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-blue-50 rounded-lg border border-blue-100">
                  <Table className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-slate-800 font-bold text-xl">
                    Responses Data
                  </CardTitle>
                  <CardDescription className="text-slate-600 mt-1">
                    {responsePagination?.total || 0} total responses
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {responsesError ? (
              <div className="text-center py-12">
                <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
                <TypographyH3 className="text-gray-900 mb-2">
                  Error Loading Responses
                </TypographyH3>
                <TypographyP className="text-gray-600 mb-6">
                  There was an error loading the form responses. Please try
                  again.
                </TypographyP>
                <Button
                  onClick={() => window.location.reload()}
                  variant="outline"
                >
                  Refresh Page
                </Button>
              </div>
            ) : responses.length === 0 && !responsesLoading ? (
              <div className="text-center py-12">
                <Database className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <TypographyH3 className="text-gray-900 mb-2">
                  No responses yet
                </TypographyH3>
                <TypographyP className="text-gray-600 mb-6">
                  Once people start submitting your form, their responses will
                  appear here.
                </TypographyP>
                <Button
                  onClick={() => navigate(`/dashboard/form/${actualFormId}`)}
                  variant="outline"
                >
                  Back to Dashboard
                </Button>
              </div>
            ) : (
              <ServerDataTable
                columns={columns}
                data={responses}
                searchPlaceholder="Search responses..."
                onRowClick={(row) => {
                  // TODO: Navigate to individual response view
                  console.log('Row clicked:', row.id);
                }}
                pageCount={responsePagination?.totalPages || 0}
                currentPage={currentPage}
                pageSize={pageSize}
                totalItems={responsePagination?.total || 0}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
                loading={responsesLoading}
                maxHeight="70vh"
              />
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default ResponsesTable;
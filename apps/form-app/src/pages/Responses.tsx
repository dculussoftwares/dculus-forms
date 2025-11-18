import React, { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { useTranslation } from '../hooks/useTranslation';
import {
  Button,
  LoadingSpinner,
  TypographyH3,
  TypographyP,
} from '@dculus/ui';
import { MainLayout } from '../components/MainLayout';
import { FilterModal } from '../components/Filters';
import { QuizResultsDialog } from '../components/plugins/response-table/quiz/QuizResultsDialog';
import { ResponsesToolbar } from '../components/Responses/ResponsesToolbar';
import { ResponsesTable } from '../components/Responses/ResponsesTable';
import { useResponsesState } from '../hooks/useResponsesState';
import { createResponsesColumns } from '../utils/createResponsesColumns';
import {
  GET_FORM_BY_ID,
  GET_FORM_RESPONSES,
} from '../graphql/queries';
import { GET_FORM_PLUGINS } from '../graphql/plugins';
import {
  deserializeFormSchema,
  FillableFormField,
  FormSchema,
} from '@dculus/types';
import {
  AlertCircle,
  ArrowLeft,
  RotateCcw,
} from 'lucide-react';

const Responses: React.FC = () => {
  const { formId, id } = useParams<{ formId?: string; id?: string }>();
  const navigate = useNavigate();
  const { t, locale } = useTranslation('responses');

  // Use formId if available, otherwise fall back to id for backward compatibility
  const actualFormId = formId || id;

  // Use responses state hook
  const responsesState = useResponsesState({ formId: actualFormId });

  const {
    data: formData,
    loading: formLoading,
    error: formError,
  } = useQuery(GET_FORM_BY_ID, {
    variables: { id: actualFormId },
    skip: !actualFormId,
  });

  // Fetch form plugins to determine which plugin columns to show
  const { data: pluginsData } = useQuery(GET_FORM_PLUGINS, {
    variables: { formId: actualFormId },
    skip: !actualFormId,
  });

  const {
    data: responsesData,
    loading: responsesLoading,
    error: responsesError,
  } = useQuery(GET_FORM_RESPONSES, {
    variables: {
      formId: actualFormId,
      page: responsesState.currentPage,
      limit: responsesState.pageSize,
      sortBy: responsesState.sortBy,
      sortOrder: responsesState.sortOrder,
      filters: responsesState.graphqlFilters,
      filterLogic: responsesState.graphqlFilters && responsesState.graphqlFilters.length > 1 ? responsesState.filterLogic : undefined,
    },
    skip: !actualFormId,
    notifyOnNetworkStatusChange: true,
  });

  // Extract fillable form fields for filtering
  const fillableFields = useMemo(() => {
    if (!formData?.form?.formSchema) return [];

    const formSchema: FormSchema = deserializeFormSchema(
      formData.form.formSchema
    );
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

  // Generate dynamic columns using the utility function
  const columns = useMemo(
    () =>
      createResponsesColumns({
        formSchema: formData?.form?.formSchema,
        formId: actualFormId!,
        pluginsData,
        locale,
        onPluginClick: (pluginType, metadata, responseId) => {
          responsesState.setPluginDialogState({
            pluginType,
            metadata,
            responseId,
          });
        },
        t,
      }),
    [formData, pluginsData, locale, actualFormId, t]
  );

  const loading = formLoading;
  const error = formError || responsesError;
  const responsePagination = responsesData?.responsesByForm;
  const responses = responsePagination?.data || [];

  // Helper to get column label
  const getColumnLabel = (columnId: string): string => {
    if (columnId.startsWith('field-')) {
      if (formData?.form?.formSchema) {
        const field = deserializeFormSchema(formData.form.formSchema)
          .pages.flatMap((p) => p.fields)
          .find((f) => `field-${f.id}` === columnId);
        return field instanceof FillableFormField ? field.label : columnId;
      }
    } else if (columnId === 'id') {
      return t('table.columns.responseId');
    } else if (columnId === 'submittedAt') {
      return t('table.columns.submittedAt');
    } else if (columnId === 'hasBeenEdited') {
      return t('table.columns.editStatus');
    }
    return columnId;
  };

  if (loading) {
    return (
      <MainLayout
        title={t('layout.breadcrumbResponses')}
        breadcrumbs={[
          { label: t('layout.breadcrumbDashboard'), href: '/dashboard' },
          { label: 'Form Dashboard', href: `/dashboard/form/${actualFormId}` },
          {
            label: t('layout.breadcrumbResponses'),
            href: `/dashboard/form/${actualFormId}/responses`,
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
        title={t('layout.breadcrumbResponses')}
        breadcrumbs={[
          { label: t('layout.breadcrumbDashboard'), href: '/dashboard' },
          { label: t('layout.breadcrumbFormDashboard'), href: `/dashboard/form/${actualFormId}` },
          {
            label: t('layout.breadcrumbResponses'),
            href: `/dashboard/form/${actualFormId}/responses`,
          },
        ]}
      >
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="max-w-md text-center p-8 bg-white rounded-lg shadow-sm border border-slate-200/60">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <h3 className="mb-2 text-xl font-semibold">
              {formData?.form ? t('errors.loadingResponses') : t('errors.formNotFound')}
            </h3>
            <p className="text-slate-600">
              {formData?.form
                ? t('errors.loadingResponsesMessage')
                : t('errors.formNotFoundMessage')}
            </p>
          </div>
        </div>
      </MainLayout>
    );
  }

  const form = formData.form;

  return (
    <MainLayout
      title={t('layout.title', { values: { formTitle: form.title } })}
      breadcrumbs={[
        { label: t('layout.breadcrumbDashboard'), href: '/dashboard' },
        { label: form.title, href: `/dashboard/form/${actualFormId}` },
        {
          label: t('layout.breadcrumbResponses'),
          href: `/dashboard/form/${actualFormId}/responses`,
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
            onClick={() =>
              navigate(`/dashboard/form/${actualFormId}`)
            }
            className="hover:bg-slate-100 flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('header.backButton')}
          </Button>
          <div className="h-4 w-px bg-slate-300 flex-shrink-0" />
          <h1 className="text-lg font-semibold text-slate-900 truncate flex-1">
            {form.title}
          </h1>
          <div className="flex items-center gap-2 flex-shrink-0">
            {responsesLoading && (
              <div className="w-4 h-4 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin"></div>
            )}
            <span className="text-sm text-muted-foreground">
              {t('header.responseCount', { values: { count: responsePagination?.total || 0 } })}
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
                  {t('errors.loadingResponses')}
                </TypographyH3>
                <TypographyP className="text-gray-600 mb-6">
                  {t('errors.loadingResponsesMessage')}
                </TypographyP>
                <Button
                  onClick={() => window.location.reload()}
                  variant="outline"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  {t('table.refreshPage')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex bg-white border border-slate-200/60 rounded-lg shadow-sm m-2 overflow-hidden">
              {/* Main table area */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Enhanced toolbar - Fixed width, no horizontal scroll */}
                <div className="flex-shrink-0 overflow-hidden">
                  <ResponsesToolbar
                    globalFilter={responsesState.globalFilter}
                    onGlobalFilterChange={responsesState.setGlobalFilter}
                    filters={responsesState.filters}
                    fillableFields={fillableFields}
                    onShowFilterModal={() => responsesState.setShowFilterModal(true)}
                    onRemoveFilter={responsesState.handleRemoveFilter}
                    columns={columns}
                    columnVisibility={responsesState.columnVisibility}
                    onColumnVisibilityChange={responsesState.setColumnVisibility}
                    getColumnLabel={getColumnLabel}
                    isExporting={responsesState.isExporting}
                    onExportExcel={responsesState.exportToExcel}
                    onExportCsv={responsesState.exportToCsv}
                    t={t}
                  />
                </div>

                {/* Table container - Only table content scrolls horizontally */}
                <ResponsesTable
                  columns={columns}
                  responses={responses}
                  loading={responsesLoading}
                  currentPage={responsesState.currentPage}
                  pageSize={responsesState.pageSize}
                  totalPages={responsePagination?.totalPages || 0}
                  totalItems={responsePagination?.total || 0}
                  onPageChange={responsesState.handlePageChange}
                  onPageSizeChange={responsesState.handlePageSizeChange}
                  globalFilter={responsesState.globalFilter}
                  columnVisibility={responsesState.columnVisibility}
                  t={t}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filter Modal */}
      <FilterModal
        open={responsesState.showFilterModal}
        onClose={() => responsesState.setShowFilterModal(false)}
        fields={fillableFields}
        filters={responsesState.filters}
        filterLogic={responsesState.filterLogic}
        onFilterLogicChange={responsesState.setFilterLogic}
        onFilterChange={responsesState.handleFilterChange}
        onRemoveFilter={responsesState.handleRemoveFilter}
        onClearAllFilters={responsesState.handleClearAllFilters}
        onApplyFilters={responsesState.handleApplyFilters}
      />

      {/* Plugin-specific dialogs */}
      {responsesState.pluginDialogState.pluginType === 'quiz-grading' &&
        responsesState.pluginDialogState.metadata && (
          <QuizResultsDialog
            open={true}
            onOpenChange={(open) => {
              if (!open) {
                responsesState.setPluginDialogState({
                  pluginType: null,
                  metadata: null,
                  responseId: null,
                });
              }
            }}
            metadata={responsesState.pluginDialogState.metadata}
            responseId={responsesState.pluginDialogState.responseId || undefined}
          />
        )}
      {/* Add other plugin dialogs here */}
    </MainLayout>
  );
};

export default Responses;

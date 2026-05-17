import React, { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { useTranslation } from '../hooks/useTranslation';
import { LoadingSpinner, EmptyState } from '@dculus/ui';
import { MainLayout } from '../components/MainLayout';
import { FilterModal } from '../components/Filters';
import { QuizResultsDialog } from '../components/plugins/response-table/quiz/QuizResultsDialog';
import { ResponsesToolbar } from '../components/Responses/ResponsesToolbar';
import { ResponsesTable } from '../components/Responses/ResponsesTable';
import { useResponsesState } from '../hooks/useResponsesState';
import { createResponsesColumns } from '../utils/createResponsesColumns';
import { GET_FORM_BY_ID, GET_FORM_RESPONSES } from '../graphql/queries';
import { GET_FORM_PLUGINS } from '../graphql/plugins';
import { deserializeFormSchema, FillableFormField, FormSchema } from '@dculus/types';
import { AlertCircle, ArrowLeft, RotateCcw } from 'lucide-react';

const Responses: React.FC = () => {
  const { formId, id } = useParams<{ formId?: string; id?: string }>();
  const navigate = useNavigate();
  const { t, locale } = useTranslation('responses');

  const actualFormId = formId || id;
  const responsesState = useResponsesState({ formId: actualFormId });

  const { data: formData, loading: formLoading, error: formError } = useQuery(GET_FORM_BY_ID, {
    variables: { id: actualFormId },
    skip: !actualFormId,
  });

  const { data: pluginsData } = useQuery(GET_FORM_PLUGINS, {
    variables: { formId: actualFormId },
    skip: !actualFormId,
  });

  const { data: responsesData, loading: responsesLoading, error: responsesError } = useQuery(GET_FORM_RESPONSES, {
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

  const fillableFields = useMemo(() => {
    if (!formData?.form?.formSchema) return [];
    const formSchema: FormSchema = deserializeFormSchema(formData.form.formSchema);
    const fields: FillableFormField[] = [];
    formSchema.pages.forEach((page) => {
      page.fields.forEach((field) => {
        if (field instanceof FillableFormField) fields.push(field);
      });
    });
    return fields;
  }, [formData]);

  const columns = useMemo(
    () => createResponsesColumns({
      formSchema: formData?.form?.formSchema,
      formId: actualFormId!,
      pluginsData,
      locale,
      onPluginClick: (pluginType, metadata, responseId) => {
        responsesState.setPluginDialogState({ pluginType, metadata, responseId });
      },
      t,
    }),
    [formData, pluginsData, locale, actualFormId, t]
  );

  const loading = formLoading;
  const error = formError || responsesError;
  const responsePagination = responsesData?.responsesByForm;
  const responses = responsePagination?.data || [];

  const getColumnLabel = (columnId: string): string => {
    if (columnId.startsWith('field-')) {
      if (formData?.form?.formSchema) {
        const field = deserializeFormSchema(formData.form.formSchema)
          .pages.flatMap((p) => p.fields)
          .find((f) => `field-${f.id}` === columnId);
        return field instanceof FillableFormField ? field.label : columnId;
      }
    } else if (columnId === 'id') return t('table.columns.responseId');
    else if (columnId === 'submittedAt') return t('table.columns.submittedAt');
    else if (columnId === 'hasBeenEdited') return t('table.columns.editStatus');
    return columnId;
  };

  if (loading) {
    return (
      <MainLayout
        title={t('layout.breadcrumbResponses')}
        breadcrumbs={[
          { label: t('layout.breadcrumbDashboard'), href: '/dashboard' },
          { label: t('breadcrumbs.formDashboard'), href: `/dashboard/form/${actualFormId}` },
          { label: t('layout.breadcrumbResponses'), href: `/dashboard/form/${actualFormId}/responses` },
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
          { label: t('layout.breadcrumbResponses'), href: `/dashboard/form/${actualFormId}/responses` },
        ]}
      >
        <EmptyState
          variant="error"
          icon={<AlertCircle className="h-6 w-6" style={{ color: '#ce5d55' }} />}
          title={formData?.form ? t('errors.loadingResponses') : t('errors.formNotFound')}
          description={formData?.form ? t('errors.loadingResponsesMessage') : t('errors.formNotFoundMessage')}
        />
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
        { label: t('layout.breadcrumbResponses'), href: `/dashboard/form/${actualFormId}/responses` },
      ]}
    >
      <div className="flex flex-col h-full w-full gap-0 overflow-x-hidden">

        {/* ── Typeform-style compact page header ── */}
        <div
          className="flex items-center gap-3 pb-4 mb-2 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(81,76,84,0.10)' }}
        >
          <button
            onClick={() => navigate(`/dashboard/form/${actualFormId}`)}
            className="h-8 w-8 flex items-center justify-center rounded-lg shrink-0 transition-colors"
            style={{ color: '#655d67' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(87,84,91,0.06)'; (e.currentTarget as HTMLElement).style.color = '#3c323e'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#655d67'; }}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <div className="w-px h-5 shrink-0" style={{ backgroundColor: 'rgba(81,76,84,0.12)' }} />

          <h1 className="text-sm font-semibold truncate flex-1 min-w-0" style={{ color: '#3c323e' }}>
            {form.title}
          </h1>

          <div className="flex items-center gap-2 shrink-0">
            {responsesLoading && (
              <div
                className="w-4 h-4 rounded-full border-2 animate-spin"
                style={{ borderColor: 'rgba(81,76,84,0.15)', borderTopColor: '#3c323e' }}
              />
            )}
            {/* Response count badge — Typeform exact: #f6fafd bg, #01487f text */}
            <span
              className="px-2.5 py-0.5 text-xs font-medium rounded-full"
              style={{ backgroundColor: '#f6fafd', color: '#01487f', border: '1px solid rgb(189,221,249)' }}
            >
              {responsePagination?.total ?? 0}
            </span>
          </div>
        </div>

        {/* ── Main content — white table on #f7f7f8 bg ── */}
        {responsesError ? (
          <EmptyState
            variant="error"
            className="flex-1"
            icon={<AlertCircle className="h-6 w-6" style={{ color: '#ce5d55' }} />}
            title={t('errors.loadingResponses')}
            description={t('errors.loadingResponsesMessage')}
            action={
              <button
                onClick={() => window.location.reload()}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-colors"
                style={{ backgroundColor: 'rgba(255,255,255,0.8)', color: '#655d67', border: '1px solid rgba(81,76,84,0.15)' }}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {t('table.refreshPage')}
              </button>
            }
          />
        ) : (
          /* White table container with Typeform exact border/shadow */
          <div
            className="flex-1 flex flex-col min-h-0 w-full overflow-x-hidden rounded-xl bg-white dark:bg-card"
            style={{ border: '1px solid rgba(81,76,84,0.10)', boxShadow: '0 1px 4px rgba(60,50,62,0.06)' }}
          >
            {/* Toolbar */}
            <div className="flex-shrink-0">
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

            {/* Table */}
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
        )}
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

      {responsesState.pluginDialogState.pluginType === 'quiz-grading' &&
        responsesState.pluginDialogState.metadata && (
          <QuizResultsDialog
            open={true}
            onOpenChange={(open) => {
              if (!open) responsesState.setPluginDialogState({ pluginType: null, metadata: null, responseId: null });
            }}
            metadata={responsesState.pluginDialogState.metadata}
            responseId={responsesState.pluginDialogState.responseId || undefined}
          />
        )}
    </MainLayout>
  );
};

export default Responses;

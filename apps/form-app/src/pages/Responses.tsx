import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useQuery, useMutation } from '@apollo/client/react';
import { CombinedGraphQLErrors } from '@apollo/client';
import { useTranslation } from '../hooks/useTranslation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  LoadingSpinner,
  EmptyState,
  toastSuccess,
  toastError,
} from '@dculus/ui';
import { MainLayout } from '../components/MainLayout';
import { FilterModal, buildMetaFilterFields } from '../components/Filters';
import { QuizResultsDialog } from '../plugins/quiz/ResultsDialog';
import { ResponsesToolbar } from '../components/Responses/ResponsesToolbar';
import { ResponsesTable } from '../components/Responses/ResponsesTable';
import { ResponseDetailPanel } from '../components/Responses/ResponseDetailPanel';
import { GradeDetailDrawer } from '../components/Responses/GradeDetailDrawer';
import { useResponsesState } from '../hooks/useResponsesState';
import { createResponsesColumns } from '../utils/createResponsesColumns';
import { GET_FORM_BY_ID, GET_FORM_RESPONSES, GET_FORM_TAGS, GET_RESPONSE_BY_ID } from '../graphql/queries';
import { GET_FORM_PLUGINS } from '../graphql/plugins';
import { GET_PDF_GENERATORS } from '../graphql/pdfGenerators';
import {
  DELETE_RESPONSE,
  DELETE_PREVIEW_RESPONSES,
  GENERATE_FAKE_RESPONSES,
  DELETE_AI_GENERATED_RESPONSES,
} from '../graphql/mutations';
import { deserializeFormSchema, FillableFormField, FormResponse, FormSchema } from '@dculus/types';
import { AlertCircle, ArrowLeft, FileSpreadsheet, FileText, RotateCcw, Send, Trash2, X } from 'lucide-react';

// Mirrors MAX_FAKE_RESPONSES_PER_REQUEST in the backend's fakeResponseService.ts.
const MAX_FAKE_RESPONSES = 10;

interface BulkActionBarProps {
  selectedCount: number;
  onDelete: () => void;
  onExportExcel: () => void;
  onExportCsv: () => void;
  onClear: () => void;
  isDeleting: boolean;
  isExporting: boolean;
  // Native Quiz — only shown when the form's gradeRelease is 'afterReview'
  onRelease?: () => void;
  isReleasing?: boolean;
  t: (key: string, options?: { values?: Record<string, string | number> }) => string;
}

const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedCount,
  onDelete,
  onExportExcel,
  onExportCsv,
  onClear,
  isDeleting,
  isExporting,
  onRelease,
  isReleasing,
  t,
}) => (
  <div
    className="flex flex-wrap items-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium"
    style={{ background: '#f0f7ff', borderBottom: '1px solid rgb(189,221,249)' }}
  >
    <span className="text-xs font-semibold shrink-0" style={{ color: '#01487f' }}>
      {t('toolbar.bulkActions.selected', { values: { count: selectedCount } })}
    </span>
    <div className="flex flex-wrap items-center gap-1.5">
      <Button
        variant="outline"
        size="sm"
        className="h-7 px-2.5 text-xs gap-1.5 border-red-200 text-red-600 hover:bg-red-50"
        onClick={onDelete}
        disabled={isDeleting}
      >
        <Trash2 className="h-3 w-3" />
        {isDeleting ? t('toolbar.bulkActions.deleting') : t('toolbar.bulkActions.delete')}
      </Button>
      {onRelease && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2.5 text-xs gap-1.5"
          onClick={onRelease}
          disabled={isReleasing}
        >
          <Send className="h-3 w-3" />
          {isReleasing ? t('toolbar.bulkActions.releasing') : t('toolbar.bulkActions.release')}
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        className="h-7 px-2.5 text-xs gap-1.5"
        onClick={onExportExcel}
        disabled={isExporting}
      >
        <FileSpreadsheet className="h-3 w-3" />
        {t('toolbar.export.excel')}
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-7 px-2.5 text-xs gap-1.5"
        onClick={onExportCsv}
        disabled={isExporting}
      >
        <FileText className="h-3 w-3" />
        {t('toolbar.export.csv')}
      </Button>
    </div>
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6 ml-auto"
      onClick={onClear}
    >
      <X className="h-3.5 w-3.5" />
    </Button>
  </div>
);

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

  // Native Quiz (epic #289, Story 11): additive guarantee — quizEnabled stays
  // false for every non-quiz form (and before formData has loaded), so
  // GET_FORM_RESPONSES's `responseGrade @include(if: $quizEnabled)` field is
  // never sent to the server and fires zero extra work.
  const quizEnabled = !!formData?.form?.settings?.quiz?.enabled;

  // Deep-link support: open a specific response's detail panel via ?responseId=
  // (used by the automation run history trigger link).
  const [searchParams, setSearchParams] = useSearchParams();
  const linkedResponseId = searchParams.get('responseId');
  const { data: linkedResponseData, loading: linkedResponseLoading } = useQuery(GET_RESPONSE_BY_ID, {
    variables: { id: linkedResponseId },
    skip: !actualFormId || !linkedResponseId,
  });
  useEffect(() => {
    if (!actualFormId || !linkedResponseId || linkedResponseLoading) return;
    // Only open the panel when the response actually belongs to this form — guards against
    // a stale/foreign responseId opening a response from an unrelated form's context.
    const response = linkedResponseData?.response;
    if (response && response.formId === actualFormId) {
      responsesState.openDetailPanel(response);
    }
    // Clear the param once the lookup has settled either way (found, not found, or the
    // response belongs to a different form) so it never gets retried on reload with no feedback.
    const next = new URLSearchParams(searchParams);
    next.delete('responseId');
    setSearchParams(next, { replace: true });
  }, [actualFormId, linkedResponseId, linkedResponseLoading, linkedResponseData]);

  const handleBulkDelete = async () => {
    if (!actualFormId) return;
    try {
      await responsesState.handleBulkDelete(actualFormId);
      toastSuccess(t('toolbar.bulkActions.deleteSuccess'));
    } catch {
      toastError(t('toolbar.bulkActions.deleteError'));
    }
  };

  const handleBulkRelease = async () => {
    if (!actualFormId) return;
    try {
      const result = await responsesState.handleBulkRelease(actualFormId);
      await refetchResponses();
      if (!result) return;
      toastSuccess(
        result.skippedCount > 0
          ? t('toolbar.bulkActions.releaseSuccessWithSkipped', {
              values: { released: result.releasedCount, skipped: result.skippedCount },
            })
          : t('toolbar.bulkActions.releaseSuccess', { values: { count: result.releasedCount } })
      );
    } catch {
      toastError(t('toolbar.bulkActions.releaseError'));
    }
  };

  // Shared refetch config for every mutation that adds/removes responses —
  // keeps the paginated/filtered GET_FORM_RESPONSES view in sync.
  const responsesRefetchQueries = [
    {
      query: GET_FORM_RESPONSES,
      variables: {
        formId: actualFormId,
        page: responsesState.currentPage,
        limit: responsesState.pageSize,
        sortBy: responsesState.sortBy,
        sortOrder: responsesState.sortOrder,
        filters: responsesState.graphqlFilters,
        filterLogic:
          responsesState.graphqlFilters &&
          responsesState.graphqlFilters.length > 1
            ? responsesState.filterLogic
            : undefined,
        quizEnabled,
      },
    },
  ];

  const [deleteResponseMutation] = useMutation(DELETE_RESPONSE, {
    refetchQueries: responsesRefetchQueries,
  });

  const [clearingPreview, setClearingPreview] = useState(false);
  const [showClearPreviewDialog, setShowClearPreviewDialog] = useState(false);
  const [clearingFakeResponses, setClearingFakeResponses] = useState(false);
  const [showClearFakeResponsesDialog, setShowClearFakeResponsesDialog] = useState(false);

  const [deletePreviewResponsesMutation] = useMutation(DELETE_PREVIEW_RESPONSES, {
    refetchQueries: responsesRefetchQueries,
  });

  const [deleteAiGeneratedResponsesMutation] = useMutation(DELETE_AI_GENERATED_RESPONSES, {
    refetchQueries: responsesRefetchQueries,
  });

  const handleDeleteResponse = async (responseId: string) => {
    try {
      await deleteResponseMutation({ variables: { id: responseId } });
      toastSuccess(t('table.actions.deleteSuccess'));
    } catch {
      toastError(t('table.actions.deleteError'));
    }
  };

  const [generateFakeResponsesMutation, { loading: isGeneratingFakeResponses }] = useMutation(
    GENERATE_FAKE_RESPONSES,
    { refetchQueries: responsesRefetchQueries }
  );

  const handleGenerateFakeResponses = async (count: number) => {
    try {
      const { data } = await generateFakeResponsesMutation({
        variables: { formId: actualFormId, count },
      });
      toastSuccess(
        t('toolbar.fakeResponses.success', {
          values: { count: data?.generateFakeResponses ?? count },
        })
      );
    } catch (error) {
      const isLimitError =
        CombinedGraphQLErrors.is(error) &&
        error.errors.some((e) => e.extensions?.code === 'AI_TOKEN_LIMIT_EXCEEDED');
      toastError(
        isLimitError
          ? t('toolbar.fakeResponses.creditLimitError')
          : t('toolbar.fakeResponses.error')
      );
    }
  };

  const { data: pluginsData } = useQuery(GET_FORM_PLUGINS, {
    variables: { formId: actualFormId },
    skip: !actualFormId,
  });

  const { data: pdfGeneratorsData } = useQuery(GET_PDF_GENERATORS, {
    variables: { formId: actualFormId },
    skip: !actualFormId,
  });
  const enabledPdfGenerators = useMemo(
    () => (pdfGeneratorsData?.pdfGenerators ?? []).filter((g: any) => g.enabled),
    [pdfGeneratorsData]
  );

  const { data: tagsData } = useQuery(GET_FORM_TAGS, {
    variables: { formId: actualFormId },
    skip: !actualFormId,
  });
  const formTags = tagsData?.formTags ?? [];
  const PREVIEW_TAG_NAME = '__preview__';
  const AI_GENERATED_TAG_NAME = '__ai_generated__';
  const userFormTags = formTags.filter(
    (t: { name: string }) => t.name !== PREVIEW_TAG_NAME && t.name !== AI_GENERATED_TAG_NAME
  );

  const quizGradeRelease = formData?.form?.settings?.quiz?.gradeRelease;
  const canReleaseGrades = quizEnabled && quizGradeRelease === 'afterReview';

  const { data: responsesData, previousData: previousResponsesData, loading: responsesLoading, error: responsesError, refetch: refetchResponses } = useQuery(GET_FORM_RESPONSES, {
    variables: {
      formId: actualFormId,
      page: responsesState.currentPage,
      limit: responsesState.pageSize,
      sortBy: responsesState.sortBy,
      sortOrder: responsesState.sortOrder,
      filters: responsesState.graphqlFilters,
      filterLogic: responsesState.graphqlFilters && responsesState.graphqlFilters.length > 1 ? responsesState.filterLogic : undefined,
      quizEnabled,
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
        if (field instanceof FillableFormField && !field.deleted) fields.push(field);
      });
    });
    return fields;
  }, [formData]);

  // Response meta-filters (beyond form fields): quiz grade, submission analytics, respondent
  // identity, edit history, completeness, and — one per configured generator — PDF
  // generation status. Gated by quizEnabled / enabledPdfGenerators, both already loaded above.
  const metaFields = useMemo(
    () => buildMetaFilterFields({ quizEnabled, pdfGenerators: enabledPdfGenerators }),
    [quizEnabled, enabledPdfGenerators]
  );

  // Fall back to previousData while a refetch (e.g. filter/sort/page change) is in flight,
  // so the table keeps showing rows instead of flashing empty and triggering a full-table loading state.
  const responses: FormResponse[] =
    responsesData?.responsesByForm?.data ??
    previousResponsesData?.responsesByForm?.data ??
    [];

  const columns = useMemo(
    () => createResponsesColumns({
      formSchema: formData?.form?.formSchema,
      formId: actualFormId!,
      pluginsData,
      locale,
      formTags: userFormTags,
      generators: enabledPdfGenerators,
      responses,
      showRespondentEmail: !!(
        formData?.form?.settings?.accessControl?.enabled ||
        formData?.form?.settings?.collectRespondentEmail
      ),
      quizEnabled,
      quizGradeRelease,
      onViewGrade: responsesState.openGradeDrawer,
      onPluginClick: (pluginType, metadata, responseId) => {
        responsesState.setPluginDialogState({ pluginType, metadata, responseId });
      },
      onDeleteResponse: handleDeleteResponse,
      t,
    }),
    [formData, pluginsData, formTags, enabledPdfGenerators, locale, actualFormId, responses, quizEnabled, quizGradeRelease, t]
  );

  // Apply stored column order: fixed cols keep their positions; hideable cols are reordered
  const orderedColumns = useMemo(() => {
    const order = responsesState.columnOrder;
    if (!order.length) return columns;

    const fixedStart = columns.filter((c) => c.enableHiding === false && c.id !== 'actions');
    const fixedEnd = columns.filter((c) => c.id === 'actions');
    const hideable = columns.filter((c) => c.enableHiding !== false);

    const orderedHideable = [
      ...order.map((id) => hideable.find((c) => c.id === id)).filter((c): c is typeof hideable[0] => !!c),
      ...hideable.filter((c) => !order.includes(c.id!)),
    ];

    return [...fixedStart, ...orderedHideable, ...fixedEnd];
  }, [columns, responsesState.columnOrder]);

  // Wait for BOTH the form schema AND responses before rendering the table.
  // Without this, when responses arrive before formSchema, field IDs in response data
  // are not found in the (empty) schema, causing them to show as "Unknown field (deleted)".
  // Once we've received data at least once, previousData covers refetches (filter/sort/page
  // changes) so this only gates the true first load — not every subsequent query.
  const loading = formLoading || (responsesLoading && !responsesData && !previousResponsesData);
  const error = formError || responsesError;
  const responsePagination = responsesData?.responsesByForm ?? previousResponsesData?.responsesByForm;

  const previewResponseCount = responses.filter((r: any) =>
    r.tags?.some((tag: any) => tag.name === PREVIEW_TAG_NAME)
  ).length;

  const aiGeneratedResponseCount = responses.filter((r: any) =>
    r.tags?.some((tag: any) => tag.name === AI_GENERATED_TAG_NAME)
  ).length;

  const handleClearPreviewResponses = async () => {
    if (!actualFormId) return;
    setClearingPreview(true);
    try {
      const result = await deletePreviewResponsesMutation({
        variables: { formId: actualFormId },
      });
      const count = result.data?.deletePreviewResponses ?? 0;
      toastSuccess(
        t('toolbar.preview.clearSuccess'),
        t('toolbar.preview.clearSuccessDetail', { values: { count } })
      );
    } catch {
      toastError(t('toolbar.preview.clearError'));
    } finally {
      setClearingPreview(false);
      setShowClearPreviewDialog(false);
    }
  };

  const handleClearFakeResponses = async () => {
    if (!actualFormId) return;
    setClearingFakeResponses(true);
    try {
      const result = await deleteAiGeneratedResponsesMutation({
        variables: { formId: actualFormId },
      });
      const count = result.data?.deleteAiGeneratedResponses ?? 0;
      toastSuccess(
        t('toolbar.fakeResponses.clearSuccess'),
        t('toolbar.fakeResponses.clearSuccessDetail', { values: { count } })
      );
    } catch {
      toastError(t('toolbar.fakeResponses.clearError'));
    } finally {
      setClearingFakeResponses(false);
      setShowClearFakeResponsesDialog(false);
    }
  };

  const getColumnLabel = (columnId: string): string => {
    if (columnId.startsWith('field-')) {
      if (formData?.form?.formSchema) {
        const field = deserializeFormSchema(formData.form.formSchema)
          .pages.flatMap((p) => p.fields)
          .find((f) => `field-${f.id}` === columnId);
        return field instanceof FillableFormField ? field.label : columnId;
      }
    } else if (columnId.startsWith('orphan-')) {
      return 'Unknown field (deleted)';
    } else if (columnId === 'id') return t('table.columns.responseId');
    else if (columnId === 'submittedAt') return t('table.columns.submittedAt');
    else if (columnId === 'hasBeenEdited') return t('table.columns.editStatus');
    else if (columnId === 'respondentEmail') return t('table.columns.respondentEmail');
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
          icon={<AlertCircle className="h-6 w-6 text-destructive" />}
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
          style={{ borderBottom: '1px solid var(--tf-border-medium)' }}
        >
          <Button
            onClick={() => navigate(`/dashboard/form/${actualFormId}`)}
            variant="ghost"
            className="h-8 w-8 flex items-center justify-center rounded-lg shrink-0 p-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div className="w-px h-5 shrink-0" style={{ backgroundColor: 'var(--tf-border)' }} />

          <h1 className="text-sm font-semibold truncate flex-1 min-w-0 text-primary">
            {form.title}
          </h1>

          <div className="flex items-center gap-2 shrink-0">
            {responsesLoading && (
              <div
                className="w-4 h-4 rounded-full border-2 animate-spin"
                style={{ borderColor: 'var(--tf-border-strong)', borderTopColor: 'var(--tf-dark)' }}
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
            icon={<AlertCircle className="h-6 w-6 text-destructive" />}
            title={t('errors.loadingResponses')}
            description={t('errors.loadingResponsesMessage')}
            action={
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
                className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {t('table.refreshPage')}
              </Button>
            }
          />
        ) : (
          <div className="flex-1 flex flex-col min-h-0 w-full overflow-x-hidden bg-white dark:bg-card">
            {/* Bulk action bar — shown when rows are selected */}
            {responsesState.selectedResponseIds.length > 0 && (
              <div className="flex-shrink-0">
                <BulkActionBar
                  selectedCount={responsesState.selectedResponseIds.length}
                  onDelete={handleBulkDelete}
                  onExportExcel={() => responsesState.handleBulkExport('EXCEL')}
                  onExportCsv={() => responsesState.handleBulkExport('CSV')}
                  onClear={responsesState.clearRowSelection}
                  isDeleting={responsesState.isBulkDeleting}
                  isExporting={responsesState.isExporting}
                  onRelease={canReleaseGrades ? handleBulkRelease : undefined}
                  isReleasing={responsesState.isBulkReleasing}
                  t={t}
                />
              </div>
            )}

            {/* Toolbar */}
            <div className="flex-shrink-0">
              {/* Clear preview / fake-response buttons — only shown when they exist */}
              {(previewResponseCount > 0 || aiGeneratedResponseCount > 0) && (
                <div className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 border-b" style={{ borderColor: 'var(--tf-border-medium)' }}>
                  <div className="ml-auto flex items-center gap-2">
                    {aiGeneratedResponseCount > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2.5 text-xs gap-1.5 border-red-200 text-red-600 hover:bg-red-50"
                        onClick={() => setShowClearFakeResponsesDialog(true)}
                        disabled={clearingFakeResponses}
                      >
                        <Trash2 className="h-3 w-3" />
                        {t('toolbar.fakeResponses.clearButton', { values: { count: aiGeneratedResponseCount } })}
                      </Button>
                    )}
                    {previewResponseCount > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2.5 text-xs gap-1.5 border-red-200 text-red-600 hover:bg-red-50"
                        onClick={() => setShowClearPreviewDialog(true)}
                        disabled={clearingPreview}
                      >
                        <Trash2 className="h-3 w-3" />
                        {t('toolbar.preview.clearButton', { values: { count: previewResponseCount } })}
                      </Button>
                    )}
                  </div>
                </div>
              )}
              <ResponsesToolbar
                globalFilter={responsesState.globalFilter}
                onGlobalFilterChange={responsesState.setGlobalFilter}
                filters={responsesState.filters}
                fillableFields={fillableFields}
                onShowFilterModal={() => responsesState.setShowFilterModal(true)}
                columns={orderedColumns}
                columnVisibility={responsesState.columnVisibility}
                onColumnVisibilityChange={responsesState.setColumnVisibility}
                onColumnOrderChange={responsesState.setColumnOrder}
                submittedAtFilter={responsesState.submittedAtFilter}
                onSubmittedAtFilterChange={responsesState.setSubmittedAtFilter}
                rowDensity={responsesState.rowDensity}
                onRowDensityChange={responsesState.setRowDensity}
                formTags={userFormTags}
                selectedTagIds={responsesState.selectedTagIds}
                onToggleTagFilter={responsesState.toggleTagFilter}
                onClearTagFilters={responsesState.clearTagFilters}
                getColumnLabel={getColumnLabel}
                isExporting={responsesState.isExporting}
                onExportExcel={responsesState.exportToExcel}
                onExportCsv={responsesState.exportToCsv}
                isGeneratingFakeResponses={isGeneratingFakeResponses}
                maxFakeResponses={MAX_FAKE_RESPONSES}
                onGenerateFakeResponses={handleGenerateFakeResponses}
                t={t}
              />
            </div>

            {/* Table */}
            <ResponsesTable
              columns={orderedColumns}
              responses={responses}
              rowSelection={responsesState.rowSelection}
              onRowSelectionChange={responsesState.setRowSelection}
              density={responsesState.rowDensity}
              columnSizing={responsesState.columnSizing}
              onColumnSizingChange={responsesState.onColumnSizingChange}
              loading={responsesLoading}
              currentPage={responsesState.currentPage}
              pageSize={responsesState.pageSize}
              totalPages={responsePagination?.totalPages || 0}
              totalItems={responsePagination?.total || 0}
              onPageChange={responsesState.handlePageChange}
              onPageSizeChange={responsesState.handlePageSizeChange}
              globalFilter={responsesState.globalFilter}
              columnVisibility={responsesState.columnVisibility}
              sortBy={responsesState.sortColumnId}
              sortOrder={responsesState.sortOrder}
              onSortingChange={responsesState.handleSortingChange}
              onRowClick={responsesState.openDetailPanel}
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
        metaFields={metaFields}
        filters={responsesState.filters}
        filterLogic={responsesState.filterLogic}
        onApplyFilters={responsesState.handleApplyFilters}
      />

      {/* Response detail slide panel */}
      <ResponseDetailPanel
        response={responsesState.detailPanelResponse}
        fillableFields={fillableFields}
        formId={actualFormId!}
        open={!!responsesState.detailPanelResponse}
        onClose={responsesState.closeDetailPanel}
        onDelete={(id) => {
          handleDeleteResponse(id);
          responsesState.closeDetailPanel();
        }}
        quizEnabled={quizEnabled}
        onViewGrade={responsesState.openGradeDrawer}
        t={t}
      />

      {/* Native Quiz (epic #289, Story 11): grade detail drawer */}
      <GradeDetailDrawer
        responseId={responsesState.gradeDrawerResponseId}
        open={!!responsesState.gradeDrawerResponseId}
        onClose={responsesState.closeGradeDrawer}
        canRelease={canReleaseGrades}
        onChanged={() => refetchResponses()}
        t={t}
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

      {/* Clear preview responses confirmation */}
      <AlertDialog open={showClearPreviewDialog} onOpenChange={setShowClearPreviewDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('toolbar.preview.clearConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('toolbar.preview.clearConfirmDescription', { values: { count: previewResponseCount } })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('toolbar.preview.clearConfirmCancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearPreviewResponses}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {clearingPreview ? t('toolbar.preview.clearConfirmDeleting') : t('toolbar.preview.clearConfirmConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear fake (AI-generated) responses confirmation */}
      <AlertDialog open={showClearFakeResponsesDialog} onOpenChange={setShowClearFakeResponsesDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('toolbar.fakeResponses.clearConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('toolbar.fakeResponses.clearConfirmDescription', { values: { count: aiGeneratedResponseCount } })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('toolbar.fakeResponses.clearConfirmCancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearFakeResponses}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {clearingFakeResponses
                ? t('toolbar.fakeResponses.clearConfirmDeleting')
                : t('toolbar.fakeResponses.clearConfirmConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
};

export default Responses;

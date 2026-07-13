import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery, useMutation, useLazyQuery } from '@apollo/client/react';
import {
  Button,
  Input,
  Label,
  Switch,
  LoadingSpinner,
  EmptyState,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  toastSuccess,
  toastError,
} from '@dculus/ui';
import { AlertCircle, ArrowLeft, Lock, SlidersHorizontal } from 'lucide-react';
import { deserializeFormSchema, FillableFormField, FormSchema } from '@dculus/types';
import { MainLayout } from '../components/MainLayout';
import { useTranslation } from '../hooks/useTranslation';
import { GET_FORM_BY_ID } from '../graphql/queries';
import { GET_PDF_TEMPLATES } from '../graphql/pdfTemplates';
import {
  GET_PDF_GENERATOR,
  CREATE_PDF_GENERATOR,
  UPDATE_PDF_GENERATOR,
  PREVIEW_PDF_GENERATOR_MATCH_COUNT,
} from '../graphql/pdfGenerators';
import { FilterModal, FilterState } from '../components/Filters';

const toGraphqlFilters = (filters: Record<string, FilterState>) =>
  Object.values(filters)
    .filter((f) => f.active)
    .map((f) => ({
      fieldId: f.fieldId,
      operator: f.operator,
      value: f.value,
      values: f.values,
      dateRange: f.dateRange,
      numberRange: f.numberRange,
    }));

const PdfGeneratorEditor: React.FC = () => {
  const { formId, generatorId } = useParams<{ formId: string; generatorId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation('pdfGenerators');
  const isNew = generatorId === 'new';

  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [columnName, setColumnName] = useState('');
  const [columnNameLocked, setColumnNameLocked] = useState(false);
  const [filenameFieldId, setFilenameFieldId] = useState('');
  const [filters, setFilters] = useState<Record<string, FilterState>>({});
  const [filterLogic, setFilterLogic] = useState<'AND' | 'OR'>('AND');
  const [autoRunOnSubmit, setAutoRunOnSubmit] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadedExisting, setLoadedExisting] = useState(isNew);

  const { data: formData, loading: formLoading, error: formError } = useQuery(GET_FORM_BY_ID, {
    variables: { id: formId },
    skip: !formId,
  });

  const { data: templatesData, loading: templatesLoading } = useQuery(GET_PDF_TEMPLATES, {
    variables: { formId },
    skip: !formId,
  });

  const { data: generatorData, loading: generatorLoading, error: generatorError } = useQuery(
    GET_PDF_GENERATOR,
    {
      variables: { id: generatorId },
      skip: isNew || !generatorId,
    }
  );

  const [createPdfGenerator] = useMutation(CREATE_PDF_GENERATOR);
  const [updatePdfGenerator] = useMutation(UPDATE_PDF_GENERATOR);
  const [fetchMatchCount, { data: matchCountData, loading: matchCountLoading }] = useLazyQuery(
    PREVIEW_PDF_GENERATOR_MATCH_COUNT
  );

  const form = formData?.form;
  const canEdit = form?.userPermission === 'EDITOR' || form?.userPermission === 'OWNER';
  const templates = templatesData?.pdfTemplates ?? [];

  const fillableFields = useMemo(() => {
    if (!form?.formSchema) return [];
    const formSchema: FormSchema = deserializeFormSchema(form.formSchema);
    const fields: FillableFormField[] = [];
    formSchema.pages.forEach((page) => {
      page.fields.forEach((field) => {
        if (field instanceof FillableFormField && !field.deleted) fields.push(field);
      });
    });
    return fields;
  }, [form]);

  // Prefill from the existing generator once (not on every refetch, so in-progress edits aren't clobbered)
  useEffect(() => {
    if (isNew || loadedExisting || !generatorData?.pdfGenerator) return;
    const g = generatorData.pdfGenerator;
    setName(g.name);
    setTemplateId(g.templateId);
    setColumnName(g.columnName ?? '');
    setColumnNameLocked(!!g.columnName);
    setFilenameFieldId(g.filenameFieldId ?? '');
    setFilterLogic(g.filterLogic ?? 'AND');
    const asFilterState: Record<string, FilterState> = {};
    (g.filters ?? []).forEach((f: any, index: number) => {
      asFilterState[`filter_${index}`] = { ...f, active: true };
    });
    setFilters(asFilterState);
    setAutoRunOnSubmit(!!g.autoRunOnSubmit);
    setLoadedExisting(true);
  }, [isNew, loadedExisting, generatorData]);

  const graphqlFilters = useMemo(() => toGraphqlFilters(filters), [filters]);

  useEffect(() => {
    if (!formId) return;
    fetchMatchCount({
      variables: {
        formId,
        filters: graphqlFilters.length > 0 ? graphqlFilters : undefined,
        filterLogic: graphqlFilters.length > 1 ? filterLogic : undefined,
      },
    });
  }, [formId, graphqlFilters, filterLogic, fetchMatchCount]);

  const breadcrumbs = [
    { label: t('editor.backButton'), href: `/dashboard/form/${formId}/pdf-templates` },
  ];

  const handleSave = async () => {
    if (!formId) return;
    if (!name.trim()) {
      toastError(t('toasts.createFailedTitle'), t('errors.nameRequired'));
      return;
    }
    if (!templateId) {
      toastError(t('toasts.createFailedTitle'), t('errors.templateRequired'));
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        await createPdfGenerator({
          variables: {
            input: {
              formId,
              templateId,
              name: name.trim(),
              columnName: columnName.trim() || null,
              filenameFieldId: filenameFieldId || null,
              filters: graphqlFilters,
              filterLogic,
              autoRunOnSubmit,
            },
          },
        });
        toastSuccess(t('toasts.createdTitle'), t('toasts.createdDescription'));
      } else {
        await updatePdfGenerator({
          variables: {
            id: generatorId,
            input: {
              templateId,
              name: name.trim(),
              columnName: columnName.trim() || null,
              filenameFieldId: filenameFieldId || null,
              filters: graphqlFilters,
              filterLogic,
              autoRunOnSubmit,
            },
          },
        });
        toastSuccess(t('toasts.updatedTitle'), t('toasts.updatedDescription'));
      }
      navigate(`/dashboard/form/${formId}/pdf-templates/generators`);
    } catch (error) {
      toastError(
        isNew ? t('toasts.createFailedTitle') : t('toasts.updateFailedTitle'),
        error instanceof Error ? error.message : t('toasts.genericError')
      );
    } finally {
      setSaving(false);
    }
  };

  const activeFilterCount = Object.values(filters).filter((f) => f.active).length;

  if (formLoading || (!isNew && generatorLoading)) {
    return (
      <MainLayout title={t('editor.titleNew')} breadcrumbs={breadcrumbs}>
        <div className="flex justify-center items-center min-h-96">
          <LoadingSpinner />
        </div>
      </MainLayout>
    );
  }

  if (formError || !form) {
    return (
      <MainLayout title={t('editor.titleNew')} breadcrumbs={breadcrumbs}>
        <EmptyState
          variant="error"
          icon={<AlertCircle className="h-6 w-6 text-destructive" />}
          title={t('errors.formNotFound.title')}
          description={t('errors.formNotFound.description')}
        />
      </MainLayout>
    );
  }

  if (!isNew && (generatorError || !generatorData?.pdfGenerator)) {
    return (
      <MainLayout title={t('editor.titleEdit')} breadcrumbs={breadcrumbs}>
        <EmptyState
          variant="error"
          icon={<AlertCircle className="h-6 w-6 text-destructive" />}
          title={t('errors.generatorNotFound.title')}
          description={t('errors.generatorNotFound.description')}
        />
      </MainLayout>
    );
  }

  return (
    <MainLayout title={isNew ? t('editor.titleNew') : t('editor.titleEdit')} breadcrumbs={breadcrumbs}>
      <div className="max-w-2xl mx-auto w-full space-y-5">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs -ml-2"
          onClick={() => navigate(`/dashboard/form/${formId}/pdf-templates/generators`)}
        >
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
          {t('editor.backButton')}
        </Button>

        <h1 className="text-lg font-semibold text-primary">
          {isNew ? t('editor.titleNew') : t('editor.titleEdit')}
        </h1>

        <div
          className="rounded-xl bg-white dark:bg-card p-5 space-y-5"
          style={{ border: '1px solid var(--tf-border-medium)', boxShadow: '0 1px 4px var(--tf-overlay)' }}
        >
          <div className="space-y-2">
            <Label htmlFor="pdf-generator-name">{t('editor.nameLabel')}</Label>
            <Input
              id="pdf-generator-name"
              placeholder={t('editor.namePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canEdit}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('editor.templateLabel')}</Label>
            <Select value={templateId} onValueChange={setTemplateId} disabled={!canEdit || templatesLoading}>
              <SelectTrigger>
                <SelectValue placeholder={t('editor.templatePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template: any) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pdf-generator-column-name" className="flex items-center gap-1.5">
              {t('editor.columnNameLabel')}
              {columnNameLocked && <Lock className="h-3 w-3 text-muted-foreground" />}
            </Label>
            <Input
              id="pdf-generator-column-name"
              placeholder={name.trim() || t('editor.columnNamePlaceholder')}
              value={columnName}
              onChange={(e) => setColumnName(e.target.value)}
              disabled={!canEdit || columnNameLocked}
            />
            <p className="text-[11px] text-muted-foreground">
              {columnNameLocked ? t('editor.columnNameLockedDescription') : t('editor.columnNameDescription')}
            </p>
          </div>

          <div className="space-y-2">
            <Label>{t('editor.filenameFieldLabel')}</Label>
            <Select
              value={filenameFieldId || '__none__'}
              onValueChange={(value) => setFilenameFieldId(value === '__none__' ? '' : value)}
              disabled={!canEdit}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('editor.filenameFieldPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t('editor.filenameFieldNone')}</SelectItem>
                {fillableFields.map((field) => (
                  <SelectItem key={field.id} value={field.id}>
                    {field.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">{t('editor.filenameFieldDescription')}</p>
          </div>

          <div className="space-y-2">
            <Label>{t('editor.filtersLabel')}</Label>
            <div
              className="flex items-center justify-between gap-3 rounded-lg px-4 py-3"
              style={{ background: 'var(--tf-faint)', border: '1px solid var(--tf-border-light)' }}
            >
              <p className="text-xs text-muted-foreground">
                {activeFilterCount === 0
                  ? t('editor.noFilters')
                  : matchCountLoading
                    ? '…'
                    : t('editor.matchCount', {
                        values: { count: matchCountData?.previewPdfGeneratorMatchCount ?? 0 },
                      })}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-3 text-xs shrink-0"
                disabled={!canEdit}
                onClick={() => setShowFilterModal(true)}
              >
                <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
                {t('editor.editFiltersButton')}
                {activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              </Button>
            </div>
          </div>

          <div
            className="flex items-center justify-between gap-3 rounded-lg px-4 py-3"
            style={{ background: 'var(--tf-faint)', border: '1px solid var(--tf-border-light)' }}
          >
            <div>
              <p className="text-xs font-medium text-primary">{t('editor.autoRunLabel')}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{t('editor.autoRunDescription')}</p>
            </div>
            <Switch checked={autoRunOnSubmit} onCheckedChange={setAutoRunOnSubmit} disabled={!canEdit} />
          </div>
        </div>

        {canEdit && (
          <div className="flex items-center justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => navigate(`/dashboard/form/${formId}/pdf-templates/generators`)}
              disabled={saving}
            >
              {t('editor.cancelButton')}
            </Button>
            <Button onClick={handleSave} disabled={saving} data-testid="pdf-generator-save">
              {saving ? t('editor.savingButton') : t('editor.saveButton')}
            </Button>
          </div>
        )}
      </div>

      <FilterModal
        open={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        fields={fillableFields}
        filters={filters}
        filterLogic={filterLogic}
        onApplyFilters={(newFilters, newLogic) => {
          setFilters(newFilters);
          setFilterLogic(newLogic);
        }}
      />
    </MainLayout>
  );
};

export default PdfGeneratorEditor;

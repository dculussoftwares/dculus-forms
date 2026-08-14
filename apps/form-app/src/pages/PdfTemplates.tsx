import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery, useMutation } from '@apollo/client/react';
import {
  Button,
  Input,
  LoadingSpinner,
  EmptyState,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  toastSuccess,
  toastError,
} from '@dculus/ui';
import { AlertCircle, FileText, FileUp, FilePlus2 } from 'lucide-react';
import { deserializeFormSchema, FillableFormField, FormSchema } from '@dculus/types';
import { MainLayout } from '../components/MainLayout';
import { useTranslation } from '../hooks/useTranslation';
import { GET_FORM_BY_ID } from '../graphql/queries';
import {
  GET_PDF_TEMPLATES,
  CREATE_PDF_TEMPLATE,
  DELETE_PDF_TEMPLATE,
} from '../graphql/pdfTemplates';
import { GET_PDF_GENERATORS } from '../graphql/pdfGenerators';
import { uploadFileHTTP } from '../services/fileUploadService';
import { TemplateAutomationRow } from '../components/PdfTemplates/TemplateAutomationRow';

// A4 portrait in mm — default page for blank templates
const BLANK_A4_BASE_PDF = { width: 210, height: 297, padding: [10, 10, 10, 10] };
const MAX_PDF_TEMPLATES_PER_FORM = 6;
const ACTIVE_RUN_STATUSES = new Set(['running', 'cancelling']);

type CreateMode = 'blank' | 'upload';

const PdfTemplates: React.FC = () => {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation('pdfTemplates');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [createMode, setCreateMode] = useState<CreateMode | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const { data: formData, loading: formLoading, error: formError } = useQuery(GET_FORM_BY_ID, {
    variables: { id: formId },
    skip: !formId,
  });

  const { data: templatesData, loading: templatesLoading, refetch } = useQuery(GET_PDF_TEMPLATES, {
    variables: { formId },
    skip: !formId,
    fetchPolicy: 'cache-and-network',
  });

  const {
    data: generatorsData,
    refetch: refetchGenerators,
    startPolling,
    stopPolling,
  } = useQuery(GET_PDF_GENERATORS, {
    variables: { formId },
    skip: !formId,
    fetchPolicy: 'cache-and-network',
  });

  const [createPdfTemplate] = useMutation(CREATE_PDF_TEMPLATE);
  const [deletePdfTemplate, { loading: deleting }] = useMutation(DELETE_PDF_TEMPLATE);

  const form = formData?.form;
  const canEdit = form?.userPermission === 'EDITOR' || form?.userPermission === 'OWNER';
  const templates = templatesData?.pdfTemplates || [];
  const atTemplateLimit = templates.length >= MAX_PDF_TEMPLATES_PER_FORM;

  const generators: any[] = generatorsData?.pdfGenerators ?? [];
  const generatorsByTemplateId = useMemo(() => {
    const map: Record<string, any[]> = {};
    generators.forEach((g) => {
      (map[g.templateId] ??= []).push(g);
    });
    return map;
  }, [generators]);

  // Poll while any automation has a run in flight — same pattern the old
  // Generators tab used, now owned by the page since automations render
  // inline on each template row instead of a separate list.
  const hasActiveRun = generators.some((g) => g.latestRun && ACTIVE_RUN_STATUSES.has(g.latestRun.status));
  useEffect(() => {
    if (hasActiveRun) {
      startPolling(3000);
    } else {
      stopPolling();
    }
  }, [hasActiveRun, startPolling, stopPolling]);

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

  const breadcrumbs = [
    { label: t('layout.breadcrumbs.dashboard'), href: '/dashboard' },
    { label: form?.title || t('layout.breadcrumbs.formDashboard'), href: `/dashboard/form/${formId}` },
    { label: t('layout.breadcrumbs.pdfTemplates') },
  ];

  const openBlankDialog = () => {
    setPendingFile(null);
    setTemplateName('');
    setCreateMode('blank');
  };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toastError(t('toasts.invalidFileTitle'), t('toasts.invalidFileDescription'));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toastError(t('toasts.fileTooLargeTitle'), t('toasts.fileTooLargeDescription'));
      return;
    }
    setPendingFile(file);
    setTemplateName(file.name.replace(/\.pdf$/i, ''));
    setCreateMode('upload');
  };

  const handleCreate = async () => {
    if (!formId || !createMode) return;
    const name = templateName.trim();
    if (!name) return;

    setCreating(true);
    try {
      let fileKey: string | undefined;
      let fileName: string | undefined;

      if (createMode === 'upload' && pendingFile) {
        const uploaded = await uploadFileHTTP(pendingFile, 'PdfTemplateAsset', formId);
        fileKey = uploaded.key;
        fileName = uploaded.originalName;
      }

      const template =
        createMode === 'blank'
          ? { basePdf: BLANK_A4_BASE_PDF, schemas: [[]] }
          : { basePdf: null, schemas: [[]] };

      const { data } = await createPdfTemplate({
        variables: {
          input: { formId, name, template, fileKey, fileName },
        },
      });

      toastSuccess(t('toasts.createdTitle'), t('toasts.createdDescription'));
      setCreateMode(null);
      navigate(`/dashboard/form/${formId}/pdf-templates/${data.createPdfTemplate.id}`);
    } catch (error) {
      toastError(
        t('toasts.createFailedTitle'),
        error instanceof Error ? error.message : t('toasts.genericError')
      );
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deletePdfTemplate({ variables: { id: deleteTarget.id } });
      toastSuccess(t('toasts.deletedTitle'), t('toasts.deletedDescription'));
      setDeleteTarget(null);
      refetch();
      refetchGenerators();
    } catch (error) {
      toastError(
        t('toasts.deleteFailedTitle'),
        error instanceof Error ? error.message : t('toasts.genericError')
      );
    }
  };

  if (formLoading) {
    return (
      <MainLayout title={t('layout.title')} breadcrumbs={breadcrumbs}>
        <div className="flex justify-center items-center min-h-96">
          <LoadingSpinner />
        </div>
      </MainLayout>
    );
  }

  if (formError || !form) {
    return (
      <MainLayout title={t('layout.title')} breadcrumbs={breadcrumbs}>
        <EmptyState
          variant="error"
          icon={<AlertCircle className="h-6 w-6 text-destructive" />}
          title={t('errors.formNotFound.title')}
          description={t('errors.formNotFound.description')}
        />
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title={t('layout.dynamicTitle', { values: { formTitle: form.title } })}
      breadcrumbs={breadcrumbs}
    >
      <div className="max-w-4xl mx-auto w-full space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-primary">{t('header.title')}</h1>
            <p className="text-sm mt-0.5 text-muted-foreground">{t('header.description')}</p>
          </div>
        </div>

        {/* First-time explainer: how the feature works end to end */}
        {templates.length === 0 && !templatesLoading && (
          <div
            className="grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-xl px-5 py-4"
            style={{ background: 'var(--tf-faint)', border: '1px solid var(--tf-border-light)' }}
          >
            {(['design', 'bind', 'deliver'] as const).map((step) => (
              <div key={step}>
                <p className="text-xs font-semibold text-primary">{t(`empty.steps.${step}.title`)}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {t(`empty.steps.${step}.description`)}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Create options */}
        {canEdit && (
          <>
            {atTemplateLimit && (
              <p className="text-xs text-muted-foreground">
                {t('limits.templateLimitReached', { values: { max: MAX_PDF_TEMPLATES_PER_FORM } })}
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={openBlankDialog}
                disabled={atTemplateLimit}
                data-testid="pdf-template-create-blank"
                className="group flex items-center gap-4 p-5 rounded-xl bg-white dark:bg-card text-left transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  border: '1px solid var(--tf-border-medium)',
                  boxShadow: '0 1px 4px var(--tf-overlay)',
                }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-blue-50">
                  <FilePlus2 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-primary">{t('create.blank.title')}</p>
                  <p className="text-xs mt-0.5 text-muted-foreground">{t('create.blank.description')}</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={atTemplateLimit}
                data-testid="pdf-template-create-upload"
                className="group flex items-center gap-4 p-5 rounded-xl bg-white dark:bg-card text-left transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  border: '1px solid var(--tf-border-medium)',
                  boxShadow: '0 1px 4px var(--tf-overlay)',
                }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-emerald-50">
                  <FileUp className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-primary">{t('create.upload.title')}</p>
                  <p className="text-xs mt-0.5 text-muted-foreground">{t('create.upload.description')}</p>
                </div>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={onFileSelected}
              />
            </div>
          </>
        )}

        {/* Template list */}
        {templatesLoading && templates.length === 0 ? (
          <div className="flex justify-center items-center py-16">
            <LoadingSpinner />
          </div>
        ) : templates.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-6 w-6 text-muted-foreground" />}
            title={t('empty.title')}
            description={canEdit ? t('empty.description') : t('empty.viewerDescription')}
          />
        ) : (
          <div className="space-y-3">
            {templates.map((template: any) => (
              <TemplateAutomationRow
                key={template.id}
                template={template}
                formId={formId!}
                canEdit={canEdit}
                fillableFields={fillableFields}
                generators={generatorsByTemplateId[template.id] ?? []}
                refetchGenerators={refetchGenerators}
                onOpenDesigner={() => navigate(`/dashboard/form/${formId}/pdf-templates/${template.id}`)}
                onDelete={() => setDeleteTarget({ id: template.id, name: template.name })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create dialog (name entry) */}
      <Dialog open={createMode !== null} onOpenChange={(open) => !open && setCreateMode(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {createMode === 'upload' ? t('createDialog.uploadTitle') : t('createDialog.blankTitle')}
            </DialogTitle>
            <DialogDescription>
              {createMode === 'upload' && pendingFile
                ? t('createDialog.uploadDescription', { values: { fileName: pendingFile.name } })
                : t('createDialog.blankDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              autoFocus
              placeholder={t('createDialog.namePlaceholder')}
              value={templateName}
              data-testid="pdf-template-name-input"
              onChange={(e) => setTemplateName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && templateName.trim() && !creating) handleCreate();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateMode(null)} disabled={creating}>
              {t('createDialog.cancelButton')}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!templateName.trim() || creating}
              data-testid="pdf-template-create-confirm"
            >
              {creating ? t('createDialog.creatingButton') : t('createDialog.createButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('deleteDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('deleteDialog.description', { values: { name: deleteTarget?.name ?? '' } })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              {t('deleteDialog.cancelButton')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              data-testid="pdf-template-delete-confirm"
            >
              {deleting ? t('deleteDialog.deletingButton') : t('deleteDialog.deleteButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default PdfTemplates;

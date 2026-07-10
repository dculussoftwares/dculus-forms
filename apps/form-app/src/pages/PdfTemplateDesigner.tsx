import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery, useMutation } from '@apollo/client/react';
import { Designer } from '@pdfme/ui';
import {
  text,
  image,
  line,
  rectangle,
  ellipse,
  table,
  barcodes,
} from '@pdfme/schemas';
import {
  Button,
  Input,
  LoadingSpinner,
  EmptyState,
  toastSuccess,
  toastError,
} from '@dculus/ui';
import { deserializeFormSchema, FieldType } from '@dculus/types';
import { generateId } from '@dculus/utils';
import { AlertCircle, ArrowLeft, Plus, Save } from 'lucide-react';
import { MainLayout } from '../components/MainLayout';
import { useTranslation } from '../hooks/useTranslation';
import { GET_FORM_BY_ID } from '../graphql/queries';
import { GET_PDF_TEMPLATE, UPDATE_PDF_TEMPLATE } from '../graphql/pdfTemplates';

/**
 * PDF template designer — embeds the pdfme Designer (its own bundled
 * React + antd, mounted into a plain DOM node) with a Dculus form-fields
 * panel for inserting {{fieldId}} response placeholders.
 */

interface FormFieldEntry {
  id: string;
  label: string;
}

const PdfTemplateDesigner: React.FC = () => {
  const { formId, templateId } = useParams<{ formId: string; templateId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation('pdfTemplates');

  const designerContainerRef = useRef<HTMLDivElement>(null);
  const designerRef = useRef<Designer | null>(null);
  const [designerReady, setDesignerReady] = useState(false);
  const [designerError, setDesignerError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');

  const { data: formData, loading: formLoading } = useQuery(GET_FORM_BY_ID, {
    variables: { id: formId },
    skip: !formId,
  });

  const { data: templateData, loading: templateLoading, error: templateError } = useQuery(
    GET_PDF_TEMPLATE,
    {
      variables: { id: templateId },
      skip: !templateId,
      fetchPolicy: 'network-only', // template JSON must be fresh when opening the designer
    }
  );

  const [updatePdfTemplate] = useMutation(UPDATE_PDF_TEMPLATE);

  const form = formData?.form;
  const pdfTemplate = templateData?.pdfTemplate;
  const canEdit = form?.userPermission === 'EDITOR' || form?.userPermission === 'OWNER';

  // Fillable form fields for the placeholder panel
  const formFields = useMemo<FormFieldEntry[]>(() => {
    if (!form?.formSchema) return [];
    try {
      const schema = deserializeFormSchema(form.formSchema);
      const fields: FormFieldEntry[] = [];
      for (const page of schema?.pages ?? []) {
        for (const field of (page as any)?.fields ?? []) {
          if (!field?.id || field.type === FieldType.RICH_TEXT_FIELD) continue;
          fields.push({ id: field.id, label: (field as any).label || field.id });
        }
      }
      return fields;
    } catch {
      return [];
    }
  }, [form?.formSchema]);

  // Element palette — v6 requires non-text schema types to be passed
  // explicitly via `plugins`, which is also how we restrict the palette.
  // Keys are the (localizable) names shown in the designer sidebar.
  const designerPlugins = useMemo(
    () => ({
      [t('palette.text')]: text,
      [t('palette.image')]: image,
      [t('palette.line')]: line,
      [t('palette.rectangle')]: rectangle,
      [t('palette.ellipse')]: ellipse,
      [t('palette.table')]: table,
      [t('palette.qrcode')]: barcodes.qrcode,
    }),
    [t]
  );

  // Mount the pdfme Designer once template (and base PDF, if any) are available
  useEffect(() => {
    if (!pdfTemplate || !designerContainerRef.current || designerRef.current) return;

    let cancelled = false;

    const mount = async () => {
      try {
        const storedTemplate = pdfTemplate.template ?? { schemas: [[]] };
        let basePdf: any = storedTemplate.basePdf;

        // Uploaded-PDF templates are stored with basePdf stripped — hydrate from R2
        if (pdfTemplate.fileKey) {
          if (!pdfTemplate.basePdfUrl) {
            throw new Error(t('designer.basePdfUnavailable'));
          }
          const response = await fetch(pdfTemplate.basePdfUrl);
          if (!response.ok) {
            throw new Error(t('designer.basePdfUnavailable'));
          }
          basePdf = await response.arrayBuffer();
        }

        if (cancelled || !designerContainerRef.current) return;

        const designer = new Designer({
          domContainer: designerContainerRef.current,
          template: { ...storedTemplate, basePdf },
          plugins: designerPlugins,
          options: {
            lang: 'en', // pdfme chrome has no Tamil; surrounding UI is i18n'd (en+ta)
            theme: {
              token: {
                colorPrimary: 'rgb(37, 99, 235)',
              },
            },
          },
        });

        designer.onChangeTemplate(() => setDirty(true));
        designerRef.current = designer;
        setDesignerReady(true);
      } catch (error) {
        if (!cancelled) {
          setDesignerError(
            error instanceof Error ? error.message : t('designer.loadFailed')
          );
        }
      }
    };

    mount();

    return () => {
      cancelled = true;
      if (designerRef.current) {
        designerRef.current.destroy();
        designerRef.current = null;
      }
    };
    // designerPlugins is stable per locale; remount on template identity change only
  }, [pdfTemplate?.id, pdfTemplate?.basePdfUrl, !!pdfTemplate]);

  useEffect(() => {
    if (pdfTemplate?.name) setName(pdfTemplate.name);
  }, [pdfTemplate?.name]);

  // Insert a {{fieldId}} placeholder text element onto the current page
  const insertField = useCallback(
    (field: FormFieldEntry) => {
      const designer = designerRef.current;
      if (!designer) return;

      const template = designer.getTemplate();
      const schemas = template.schemas?.length ? [...template.schemas] : [[]];
      const pageIndex = Math.min(
        (designer as any).getPageCursor?.() ?? 0,
        schemas.length - 1
      );

      const placedCount = schemas[pageIndex]?.length ?? 0;
      const column = Math.floor(placedCount / 10);
      const row = placedCount % 10;
      const newSchema = {
        name: `field_${generateId()}`,
        type: 'text',
        content: `{{${field.id}}}`,
        position: { x: 20 + column * 100, y: 20 + row * 12 },
        width: 80,
        height: 10,
        fontSize: 12,
      };

      schemas[pageIndex] = [...(schemas[pageIndex] ?? []), newSchema as any];
      designer.updateTemplate({ ...template, schemas });
      setDirty(true);
    },
    []
  );

  const handleSave = useCallback(async () => {
    const designer = designerRef.current;
    if (!designer || !templateId) return;

    setSaving(true);
    try {
      const template = designer.getTemplate();
      // Never persist the (multi-MB) uploaded base PDF in the layout JSON —
      // it stays in R2 and is re-hydrated on load
      const toStore = pdfTemplate?.fileKey ? { ...template, basePdf: null } : template;

      await updatePdfTemplate({
        variables: {
          id: templateId,
          input: { name: name.trim() || pdfTemplate?.name, template: toStore },
        },
      });
      setDirty(false);
      toastSuccess(t('toasts.savedTitle'), t('toasts.savedDescription'));
    } catch (error) {
      toastError(
        t('toasts.saveFailedTitle'),
        error instanceof Error ? error.message : t('toasts.genericError')
      );
    } finally {
      setSaving(false);
    }
  }, [templateId, name, pdfTemplate?.fileKey, pdfTemplate?.name, updatePdfTemplate, t]);

  const breadcrumbs = [
    { label: t('layout.breadcrumbs.dashboard'), href: '/dashboard' },
    { label: form?.title || t('layout.breadcrumbs.formDashboard'), href: `/dashboard/form/${formId}` },
    { label: t('layout.breadcrumbs.pdfTemplates'), href: `/dashboard/form/${formId}/pdf-templates` },
    { label: pdfTemplate?.name || t('layout.breadcrumbs.designer') },
  ];

  if (formLoading || templateLoading) {
    return (
      <MainLayout title={t('layout.designerTitle')} breadcrumbs={breadcrumbs}>
        <div className="flex justify-center items-center min-h-96">
          <LoadingSpinner />
        </div>
      </MainLayout>
    );
  }

  if (templateError || !pdfTemplate || !form) {
    return (
      <MainLayout title={t('layout.designerTitle')} breadcrumbs={breadcrumbs}>
        <EmptyState
          variant="error"
          icon={<AlertCircle className="h-6 w-6 text-destructive" />}
          title={t('errors.templateNotFound.title')}
          description={t('errors.templateNotFound.description')}
        />
      </MainLayout>
    );
  }

  return (
    <MainLayout title={t('layout.designerTitle')} breadcrumbs={breadcrumbs}>
      <div className="flex flex-col gap-3 -mt-1 h-[calc(100vh-140px)]">
        {/* Toolbar */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={() => navigate(`/dashboard/form/${formId}/pdf-templates`)}
            data-testid="pdf-designer-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setDirty(true);
            }}
            disabled={!canEdit}
            className="h-8 max-w-xs text-sm font-medium"
            data-testid="pdf-designer-name-input"
          />
          <div className="flex-1" />
          {canEdit && (
            <Button
              size="sm"
              className="h-8 px-4 text-xs"
              onClick={handleSave}
              disabled={saving || !designerReady || !dirty}
              data-testid="pdf-designer-save"
            >
              <Save className="h-3.5 w-3.5 mr-1.5" />
              {saving ? t('designer.savingButton') : t('designer.saveButton')}
            </Button>
          )}
        </div>

        <div className="flex gap-3 flex-1 min-h-0">
          {/* Form fields panel */}
          <aside
            className="w-60 shrink-0 rounded-xl bg-white dark:bg-card p-4 overflow-y-auto"
            style={{
              border: '1px solid var(--tf-border-medium)',
              boxShadow: '0 1px 4px var(--tf-overlay)',
            }}
          >
            <h3 className="text-xs font-semibold text-primary">{t('fieldsPanel.heading')}</h3>
            <p className="text-[11px] mt-1 mb-3 leading-relaxed text-muted-foreground">
              {t('fieldsPanel.description')}
            </p>
            {formFields.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('fieldsPanel.noFields')}</p>
            ) : (
              <div className="space-y-1">
                {formFields.map((field) => (
                  <button
                    key={field.id}
                    type="button"
                    disabled={!canEdit || !designerReady}
                    onClick={() => insertField(field)}
                    data-testid={`pdf-designer-insert-${field.id}`}
                    className="flex items-center gap-2 w-full px-2.5 py-2 rounded-lg text-xs text-left transition-colors text-[#655d67] hover:bg-[rgba(87,84,91,0.06)] hover:text-[#3c323e] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="h-3 w-3 shrink-0" />
                    <span className="truncate">{field.label}</span>
                  </button>
                ))}
              </div>
            )}
          </aside>

          {/* Designer canvas */}
          <div
            className="flex-1 min-w-0 rounded-xl overflow-hidden bg-white dark:bg-card relative"
            style={{ border: '1px solid var(--tf-border-medium)' }}
          >
            {designerError ? (
              <div className="flex items-center justify-center h-full">
                <EmptyState
                  variant="error"
                  icon={<AlertCircle className="h-6 w-6 text-destructive" />}
                  title={t('errors.designerLoadFailed.title')}
                  description={designerError}
                />
              </div>
            ) : (
              <>
                {!designerReady && (
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <LoadingSpinner />
                  </div>
                )}
                <div ref={designerContainerRef} className="w-full h-full" data-testid="pdf-designer-canvas" />
              </>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default PdfTemplateDesigner;

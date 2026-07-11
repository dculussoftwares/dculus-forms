import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery, useMutation } from '@apollo/client/react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
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
import { AlertCircle, ArrowLeft, Save } from 'lucide-react';
import { MainLayout } from '../components/MainLayout';
import { useTranslation } from '../hooks/useTranslation';
import { GET_FORM_BY_ID } from '../graphql/queries';
import { GET_PDF_TEMPLATE, UPDATE_PDF_TEMPLATE } from '../graphql/pdfTemplates';
import {
  buildBoundFieldSchema,
  cascadePosition,
  collectSchemaNames,
  countBoundFields,
  prepareTemplateSchemas,
  removeMissingBoundFields,
  uniqueSchemaName,
  type FormFieldEntry,
} from '../components/pdf-designer/fieldBinding';
import {
  LeftPanel,
  PaletteChip,
  elementVisual,
  fieldVisual,
  type ElementKey,
  type PaletteDragData,
} from '../components/pdf-designer/LeftPanel';
import {
  centeredClampedPosition,
  resolveDropTarget,
  type DropTarget,
} from '../components/pdf-designer/dropPlacement';

/**
 * PDF template designer — embeds the pdfme Designer (its own bundled
 * React + antd, mounted into a plain DOM node) with a Dculus form-fields
 * panel for placing bound field elements (label on canvas, field id in
 * the dculusFieldId prop — see fieldBinding.ts).
 */

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
  const [missingFieldIds, setMissingFieldIds] = useState<string[]>([]);
  const [placedCounts, setPlacedCounts] = useState<Record<string, number>>({});

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
          fields.push({
            id: field.id,
            label: (field as any).label || '',
            type: field.type,
          });
        }
      }
      return fields;
    } catch {
      return [];
    }
  }, [form?.formSchema]);

  // Mount effect below intentionally has narrow deps; read the latest
  // fields through a ref instead of re-mounting the designer on schema refetch
  const formFieldsRef = useRef<FormFieldEntry[]>(formFields);
  formFieldsRef.current = formFields;

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
        // Upgrade legacy {{fieldId}} elements to bound fields and re-sync
        // bound labels before mounting — display-only, so it never marks
        // the template dirty; the upgrade persists on the user's next save
        const prepared = prepareTemplateSchemas(
          pdfTemplate.template ?? { schemas: [[]] },
          formFieldsRef.current,
          t('fieldsPanel.untitledField')
        );
        setMissingFieldIds(prepared.missingFieldIds);
        setPlacedCounts(countBoundFields(prepared.template.schemas ?? []));
        const storedTemplate = prepared.template;
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

        designer.onChangeTemplate((changed) => {
          setDirty(true);
          setPlacedCounts(countBoundFields((changed.schemas ?? []) as any[][]));
        });
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

  // Add a new element to the template: on a drop target's page centered
  // under the pointer (clamped inside the page), or cascaded on the current
  // page for click-to-insert. Selects the new element either way.
  const placeSchema = useCallback((schemaBase: Record<string, any>, drop?: DropTarget) => {
    const designer = designerRef.current;
    if (!designer) return;

    const template = designer.getTemplate();
    const schemas = template.schemas?.length ? [...template.schemas] : [[]];
    const pageIndex = Math.min(
      drop?.pageIndex ?? (designer as any).getPageCursor?.() ?? 0,
      schemas.length - 1
    );

    const newSchema = {
      ...schemaBase,
      name: uniqueSchemaName(schemaBase.name, collectSchemaNames(schemas as any[][])),
      position: drop
        ? centeredClampedPosition(drop, schemaBase.width ?? 40, schemaBase.height ?? 10)
        : cascadePosition(schemas[pageIndex]?.length ?? 0),
    };

    schemas[pageIndex] = [...(schemas[pageIndex] ?? []), newSchema as any];
    designer.updateTemplate({ ...template, schemas });
    try {
      designer.selectSchemas([{ name: newSchema.name, pageIndex }], { scroll: true });
    } catch {
      // selection is a nicety — never let it break the insert
    }
    setDirty(true);
  }, []);

  // Insert a bound field element (label as display text, field id as the
  // binding — see fieldBinding.ts)
  const insertField = useCallback(
    (field: FormFieldEntry, drop?: DropTarget) => {
      placeSchema(
        buildBoundFieldSchema({
          field,
          position: { x: 0, y: 0 }, // placeSchema decides the real position
          existingNames: new Set(), // placeSchema dedupes against the live template
          untitledLabel: t('fieldsPanel.untitledField'),
        }),
        drop
      );
    },
    [placeSchema, t]
  );

  // Insert a static element (text, image, shape, table, QR) using the
  // pdfme plugin's own default schema
  const insertElement = useCallback(
    (element: ElementKey, drop?: DropTarget) => {
      const plugin =
        element === 'qrcode' ? barcodes.qrcode : { text, image, line, rectangle, ellipse, table }[element];
      const defaultSchema = (plugin as any)?.propPanel?.defaultSchema;
      if (!defaultSchema) return;
      placeSchema({ ...defaultSchema, name: element }, drop);
    },
    [placeSchema]
  );

  // Drag-and-drop from the left panel onto the canvas
  const [activeDrag, setActiveDrag] = useState<PaletteDragData | null>(null);
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDrag((event.active.data.current as PaletteDragData) ?? null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDrag(null);
      const data = event.active.data.current as PaletteDragData | undefined;
      const container = designerContainerRef.current;
      if (!data || !container) return;

      // Pointer position at drop = activator position + total drag delta
      const activator = event.activatorEvent as Partial<PointerEvent>;
      if (typeof activator?.clientX !== 'number' || typeof activator?.clientY !== 'number') {
        return;
      }
      const drop = resolveDropTarget(
        container,
        activator.clientX + event.delta.x,
        activator.clientY + event.delta.y
      );
      if (!drop) return; // dropped outside any page — treat as cancelled

      if (data.kind === 'field') {
        insertField(data.field, drop);
      } else {
        insertElement(data.element, drop);
      }
    },
    [insertField, insertElement]
  );

  // Remove every element bound to a field that no longer exists on the form
  const removeMissingFields = useCallback(() => {
    const designer = designerRef.current;
    if (!designer || missingFieldIds.length === 0) return;
    designer.updateTemplate(
      removeMissingBoundFields(designer.getTemplate(), missingFieldIds)
    );
    setMissingFieldIds([]);
    setDirty(true);
  }, [missingFieldIds]);

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
      <DndContext
        sensors={dndSensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveDrag(null)}
      >
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
          <LeftPanel
            fields={formFields}
            placedCounts={placedCounts}
            missingFieldIds={missingFieldIds}
            canEdit={canEdit}
            designerReady={designerReady}
            onInsertField={insertField}
            onInsertElement={insertElement}
            onRemoveMissing={removeMissingFields}
          />

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
      <DragOverlay dropAnimation={null}>
        {activeDrag &&
          (activeDrag.kind === 'field' ? (
            <PaletteChip
              visual={fieldVisual(activeDrag.field.type)}
              label={activeDrag.field.label.trim() || t('fieldsPanel.untitledField')}
            />
          ) : (
            <PaletteChip
              visual={elementVisual(activeDrag.element)}
              label={t(`palette.${activeDrag.element}`)}
            />
          ))}
      </DragOverlay>
      </DndContext>
    </MainLayout>
  );
};

export default PdfTemplateDesigner;

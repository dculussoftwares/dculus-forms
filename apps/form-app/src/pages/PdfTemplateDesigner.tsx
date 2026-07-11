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
  type DragMoveEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { Designer } from '@pdfme/ui';
import { getDefaultFont } from '@pdfme/common';
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
import { AlertCircle, ArrowLeft, Eye, Save } from 'lucide-react';
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
  PDF_FIELD_FONT_NAME,
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
  findPaperElements,
  getPaperViewports,
  resolveDropTarget,
  snappedDropPosition,
  type DropTarget,
  type PaperViewport,
} from '../components/pdf-designer/dropPlacement';
import { DropGuides, type DragGhost } from '../components/pdf-designer/DropGuides';
import { loadColumnGuides } from '../components/pdf-designer/canvasGuides';
import {
  SelectionToolbar,
  type ToolbarSelection,
} from '../components/pdf-designer/SelectionToolbar';
import {
  TextElementEditorDialog,
  type TextElementDraft,
} from '../components/pdf-designer/TextElementEditorDialog';
import { PreviewDialog } from '../components/pdf-designer/PreviewDialog';

/**
 * PDF template designer — embeds the pdfme Designer (its own bundled
 * React + antd, mounted into a plain DOM node) with a Dculus form-fields
 * panel for placing bound field elements (label on canvas, field id in
 * the dculusFieldId prop — see fieldBinding.ts).
 */

const elementDefaultSchema = (element: ElementKey): Record<string, any> | undefined => {
  const plugin =
    element === 'qrcode'
      ? barcodes.qrcode
      : { text, image, line, rectangle, ellipse, table }[element];
  return (plugin as any)?.propPanel?.defaultSchema;
};

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
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selection, setSelection] = useState<ToolbarSelection | null>(null);
  const [movingElements, setMovingElements] = useState(false);
  const [textEditor, setTextEditor] = useState<
    { pageIndex: number; name: string; draft: TextElementDraft } | null
  >(null);

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

        // Bound fields reference NotoSansTamil (covers Tamil + basic Latin).
        // If the font asset can't be fetched, register the name with Roboto's
        // data so templates referencing it still load — Tamil text degrades
        // to tofu instead of the whole designer failing.
        const defaultFont = getDefaultFont();
        let tamilFontData: ArrayBuffer | string = defaultFont.Roboto.data as string;
        try {
          const fontResponse = await fetch('/fonts/NotoSansTamil-Regular.ttf');
          if (fontResponse.ok) tamilFontData = await fontResponse.arrayBuffer();
        } catch {
          // keep Roboto fallback data
        }

        if (cancelled || !designerContainerRef.current) return;

        const designer = new Designer({
          domContainer: designerContainerRef.current,
          template: { ...storedTemplate, basePdf },
          plugins: designerPlugins,
          options: {
            lang: 'en', // pdfme chrome has no Tamil; surrounding UI is i18n'd (en+ta)
            font: {
              ...defaultFont,
              [PDF_FIELD_FONT_NAME]: { data: tamilFontData },
            },
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
        designer.onPageChange(() => {
          // Added pages get fresh (empty) rulers — re-inject column guides
          setTimeout(() => {
            if (designerContainerRef.current) loadColumnGuides(designerContainerRef.current);
          }, 300);
        });
        designer.onChangeSelection((sel) => {
          if (!sel.bounds || sel.schemas.length === 0) {
            setSelection(null);
            return;
          }
          setSelection({
            pageIndex: sel.pageIndex,
            bounds: sel.bounds,
            names: sel.schemas.map((s) => s.name),
            editableTextName:
              sel.schemas.length === 1 && sel.schemas[0].type === 'text'
                ? sel.schemas[0].name
                : null,
          });
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
    // designerPlugins is stable per locale; remount on template identity change.
    // The loading flags matter: while either query is in flight the component
    // early-returns a spinner (no canvas div), so an effect run in that window
    // sees a null container and must be retried once the full UI has rendered.
  }, [pdfTemplate?.id, pdfTemplate?.basePdfUrl, !!pdfTemplate, formLoading, templateLoading]);

  useEffect(() => {
    if (pdfTemplate?.name) setName(pdfTemplate.name);
  }, [pdfTemplate?.name]);

  // Inject the column layout grid into pdfme's rulers once the canvas has
  // rendered (idempotent; retried because pdfme commits asynchronously)
  useEffect(() => {
    if (!designerReady) return;
    const timers = [200, 600, 1500].map((delay) =>
      setTimeout(() => {
        if (designerContainerRef.current) loadColumnGuides(designerContainerRef.current);
      }, delay)
    );
    return () => timers.forEach(clearTimeout);
  }, [designerReady]);

  // Open width-fit instead of pdfme's default height-fit (zoomLevel 1):
  // mirrors pdfme's own fit-width math — measured scale at open IS the
  // height-fit baseScale, and its formula reserves 30px ruler + 40px gutter.
  // Retried because the page renders asynchronously after ready; applied
  // only once so the user's own zooming is never fought.
  useEffect(() => {
    if (!designerReady) return;
    let applied = false;
    const timers = [300, 800, 1600, 3000].map((delay) =>
      setTimeout(() => {
        if (applied) return;
        const container = designerContainerRef.current;
        const designer = designerRef.current;
        if (!container || !designer) return;
        const [paper] = getPaperViewports(container);
        const [paperEl] = findPaperElements(container);
        if (!paper || !paperEl || paperEl.offsetWidth === 0) return;

        // pdfme's zoom math uses its internal scroll container's width — the
        // nearest scrollable ancestor of the page
        let scroller: HTMLElement = container;
        for (let el = paperEl.parentElement; el && el !== container; el = el.parentElement) {
          const overflow = getComputedStyle(el).overflow + getComputedStyle(el).overflowY;
          if (overflow.includes('auto') || overflow.includes('scroll')) {
            scroller = el;
            break;
          }
        }
        const zoom = Math.min(
          2,
          Math.max(0.25, (scroller.clientWidth - 70) / paperEl.offsetWidth / paper.scale)
        );
        try {
          designer.updateOptions({ zoomLevel: zoom });
          applied = true;
        } catch {
          // keep the default zoom on failure
        }
      }, delay)
    );
    return () => timers.forEach(clearTimeout);
  }, [designerReady]);

  const selectionRef = useRef<ToolbarSelection | null>(null);
  selectionRef.current = selection;
  const activeDragRef = useRef(false);

  // Show the guide lines while an existing element is being moved/resized —
  // pdfme's moveable handles the drag itself, so detect it from pointer
  // gestures: press on the canvas (or a moveable handle) with an active
  // selection, then movement past a small threshold
  useEffect(() => {
    const container = designerContainerRef.current;
    if (!designerReady || !container) return;

    let pressed = false;
    let startX = 0;
    let startY = 0;

    const onPointerDown = (event: PointerEvent) => {
      if (activeDragRef.current) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!container.contains(target) && !target.closest('.moveable-control-box')) return;
      pressed = true;
      startX = event.clientX;
      startY = event.clientY;
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!pressed || !selectionRef.current) return;
      if (Math.abs(event.clientX - startX) + Math.abs(event.clientY - startY) < 5) return;
      setMovingElements(true);
    };
    const onPointerEnd = () => {
      pressed = false;
      setMovingElements(false);
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointermove', onPointerMove, true);
    document.addEventListener('pointerup', onPointerEnd, true);
    document.addEventListener('pointercancel', onPointerEnd, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('pointermove', onPointerMove, true);
      document.removeEventListener('pointerup', onPointerEnd, true);
      document.removeEventListener('pointercancel', onPointerEnd, true);
    };
  }, [designerReady]);

  // Select schemas once pdfme has committed a just-applied updateTemplate.
  // Its internal React root renders asynchronously with no completion
  // signal — and a later commit can clear an early successful selection —
  // so re-assert at increasing delays whenever the selection is not the
  // requested one (idempotent; gives up quietly, selection is a nicety).
  const selectSchemasWhenReady = useCallback(
    (targets: { name: string; pageIndex: number }[], scroll = false) => {
      const wanted = new Set(targets.map((target) => target.name));
      for (const delay of [0, 80, 250, 500]) {
        setTimeout(() => {
          const designer = designerRef.current;
          if (!designer) return;
          try {
            const current = designer.getSelectedSchemas();
            const alreadySelected =
              current.length === wanted.size && current.every((s) => wanted.has(s.name));
            if (!alreadySelected) designer.selectSchemas(targets, { scroll });
          } catch {
            // keep trying at the next delay
          }
        }, delay);
      }
    },
    []
  );

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
        ? snappedDropPosition(drop, schemaBase.width ?? 40, schemaBase.height ?? 10)
        : cascadePosition(schemas[pageIndex]?.length ?? 0),
    };

    schemas[pageIndex] = [...(schemas[pageIndex] ?? []), newSchema as any];
    designer.updateTemplate({ ...template, schemas });
    selectSchemasWhenReady([{ name: newSchema.name, pageIndex }], true);
    setDirty(true);
  }, [selectSchemasWhenReady]);

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
      const defaultSchema = elementDefaultSchema(element);
      if (!defaultSchema) return;
      placeSchema({ ...defaultSchema, name: element }, drop);
    },
    [placeSchema]
  );

  // Drag-and-drop from the left panel onto the canvas
  const [activeDrag, setActiveDrag] = useState<PaletteDragData | null>(null);
  const [dragPapers, setDragPapers] = useState<PaperViewport[] | null>(null);
  const [dragGhost, setDragGhost] = useState<DragGhost | null>(null);
  const pendingSizeRef = useRef<{ width: number; height: number }>({ width: 40, height: 10 });
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const clearDragState = useCallback(() => {
    activeDragRef.current = false;
    setActiveDrag(null);
    setDragPapers(null);
    setDragGhost(null);
  }, []);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const data = (event.active.data.current as PaletteDragData) ?? null;
      activeDragRef.current = data !== null;
      setActiveDrag(data);
      if (!data) return;

      // The exact footprint the element will have, so the ghost matches
      if (data.kind === 'field') {
        const schema = buildBoundFieldSchema({
          field: data.field,
          position: { x: 0, y: 0 },
          existingNames: new Set(),
          untitledLabel: t('fieldsPanel.untitledField'),
        });
        pendingSizeRef.current = { width: schema.width, height: schema.height };
      } else {
        const defaultSchema = elementDefaultSchema(data.element);
        pendingSizeRef.current = {
          width: defaultSchema?.width ?? 40,
          height: defaultSchema?.height ?? 10,
        };
      }
      if (designerContainerRef.current) {
        setDragPapers(getPaperViewports(designerContainerRef.current));
      }
    },
    [t]
  );

  // Pointer position during/at the end of a drag = activator position + delta
  const dragPointer = (event: DragMoveEvent | DragEndEvent): { x: number; y: number } | null => {
    const activator = event.activatorEvent as Partial<PointerEvent>;
    if (typeof activator?.clientX !== 'number' || typeof activator?.clientY !== 'number') {
      return null;
    }
    return { x: activator.clientX + event.delta.x, y: activator.clientY + event.delta.y };
  };

  const handleDragMove = useCallback((event: DragMoveEvent) => {
    const container = designerContainerRef.current;
    const pointer = container && dragPointer(event);
    if (!pointer) return;
    // Re-read paper geometry each move — wheel-scrolling mid-drag moves pages
    setDragPapers(getPaperViewports(container));
    const drop = resolveDropTarget(container, pointer.x, pointer.y);
    if (!drop) {
      setDragGhost(null);
      return;
    }
    const { width, height } = pendingSizeRef.current;
    setDragGhost({
      pageIndex: drop.pageIndex,
      ...snappedDropPosition(drop, width, height),
      width,
      height,
    });
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      clearDragState();
      const data = event.active.data.current as PaletteDragData | undefined;
      const container = designerContainerRef.current;
      const pointer = container && dragPointer(event);
      if (!data || !pointer) return;

      const drop = resolveDropTarget(container, pointer.x, pointer.y);
      if (!drop) return; // dropped outside any page — treat as cancelled

      if (data.kind === 'field') {
        insertField(data.field, drop);
      } else {
        insertElement(data.element, drop);
      }
    },
    [clearDragState, insertField, insertElement]
  );

  // Duplicate the current selection: copies land 6mm down-right with fresh
  // unique names and become the new selection
  const duplicateSelection = useCallback(() => {
    const designer = designerRef.current;
    if (!designer || !selection) return;

    const template = designer.getTemplate();
    const schemas = [...(template.schemas ?? [])];
    const page = [...(schemas[selection.pageIndex] ?? [])];
    const allNames = collectSchemaNames(schemas as any[][]);

    const copies = selection.names.flatMap((name) => {
      const source = page.find((schema: any) => schema.name === name);
      if (!source) return [];
      const copyName = uniqueSchemaName(source.name, allNames);
      allNames.add(copyName);
      return [
        {
          ...source,
          name: copyName,
          position: { x: source.position.x + 6, y: source.position.y + 6 },
        },
      ];
    });
    if (copies.length === 0) return;

    schemas[selection.pageIndex] = [...page, ...copies];
    designer.updateTemplate({ ...template, schemas });
    selectSchemasWhenReady(
      copies.map((copy) => ({ name: copy.name, pageIndex: selection.pageIndex }))
    );
    setDirty(true);
  }, [selection, selectSchemasWhenReady]);

  // Delete the current selection
  const deleteSelection = useCallback(() => {
    const designer = designerRef.current;
    if (!designer || !selection) return;

    const template = designer.getTemplate();
    const schemas = [...(template.schemas ?? [])];
    const names = new Set(selection.names);
    schemas[selection.pageIndex] = (schemas[selection.pageIndex] ?? []).filter(
      (schema: any) => !names.has(schema.name)
    );
    designer.updateTemplate({ ...template, schemas });
    setSelection(null);
    setDirty(true);
  }, [selection]);

  // Open the text editor for the single selected text element. A bound
  // field element (dculusFieldId) opens as an inline-text draft with its
  // field as a pill — applying converts it to the inline-text model, so
  // "label + more text around it" behaves predictably at generation.
  const openTextEditor = useCallback(() => {
    const designer = designerRef.current;
    if (!designer || !selection?.editableTextName) return;

    const page = designer.getTemplate().schemas?.[selection.pageIndex] ?? [];
    const schema: any = page.find((s: any) => s.name === selection.editableTextName);
    if (!schema) return;

    let draft: TextElementDraft;
    if (typeof schema.dculusFieldId === 'string') {
      const field = formFields.find((f) => f.id === schema.dculusFieldId);
      if (field) {
        const token = uniqueSchemaName(field.label, new Set());
        draft = {
          display: field.label.trim() || t('fieldsPanel.untitledField'),
          template: `{${token}}`,
          fieldVars: { [token]: field.id },
        };
      } else {
        draft = { display: '', template: '', fieldVars: {} };
      }
    } else {
      const content = typeof schema.content === 'string' ? schema.content : '';
      const template =
        typeof schema.dculusTextTemplate === 'string' ? schema.dculusTextTemplate : content;
      draft = {
        display: content,
        template,
        fieldVars:
          schema.dculusFieldVars && typeof schema.dculusFieldVars === 'object'
            ? { ...schema.dculusFieldVars }
            : {},
      };
    }
    setTextEditor({ pageIndex: selection.pageIndex, name: schema.name, draft });
  }, [selection, formFields, t]);

  const saveTextEditor = useCallback(
    (draft: TextElementDraft) => {
      const designer = designerRef.current;
      if (!designer || !textEditor) return;

      const template = designer.getTemplate();
      const schemas = [...(template.schemas ?? [])];
      schemas[textEditor.pageIndex] = (schemas[textEditor.pageIndex] ?? []).map(
        (schema: any) => {
          if (schema.name !== textEditor.name) return schema;
          const next = { ...schema };
          // Editing always yields an inline-text element; the field binding
          // (if any) now lives in dculusFieldVars via its pill
          delete next.dculusFieldId;
          if (Object.keys(draft.fieldVars).length > 0) {
            next.content = draft.display;
            next.dculusTextTemplate = draft.template;
            next.dculusFieldVars = draft.fieldVars;
          } else {
            next.content = draft.template;
            delete next.dculusTextTemplate;
            delete next.dculusFieldVars;
          }
          return next;
        }
      );
      designer.updateTemplate({ ...template, schemas });
      setTextEditor(null);
      setDirty(true);
    },
    [textEditor]
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

  // Working template for the preview, with the (multi-MB) uploaded base PDF
  // stripped — the backend re-hydrates it from R2 via the stored fileKey
  const getWorkingTemplate = useCallback(() => {
    const designer = designerRef.current;
    if (!designer) return null;
    const template = designer.getTemplate();
    return pdfTemplate?.fileKey ? { ...template, basePdf: null } : template;
  }, [pdfTemplate?.fileKey]);

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
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onDragCancel={clearDragState}
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
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs"
              onClick={() => setPreviewOpen(true)}
              disabled={!designerReady}
              data-testid="pdf-designer-preview"
            >
              <Eye className="h-3.5 w-3.5 mr-1.5" />
              {t('preview.button')}
            </Button>
          )}
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
            data-guides-visible={movingElements ? 'true' : 'false'}
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
                <div
                  ref={designerContainerRef}
                  className="w-full h-full"
                  data-testid="pdf-designer-canvas"
                  data-pdf-designer-canvas=""
                />
                {activeDrag && dragPapers && (
                  <DropGuides papers={dragPapers} ghost={dragGhost} />
                )}
                {canEdit && !activeDrag && (
                  <SelectionToolbar
                    container={designerContainerRef.current}
                    selection={selection}
                    onDuplicate={duplicateSelection}
                    onDelete={deleteSelection}
                    onEditText={openTextEditor}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
      <TextElementEditorDialog
        open={textEditor !== null}
        onOpenChange={(open) => !open && setTextEditor(null)}
        initial={textEditor?.draft ?? null}
        fields={formFields}
        onSave={saveTextEditor}
      />
      {formId && templateId && (
        <PreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          templateId={templateId}
          formId={formId}
          fields={formFields}
          getWorkingTemplate={getWorkingTemplate}
        />
      )}
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

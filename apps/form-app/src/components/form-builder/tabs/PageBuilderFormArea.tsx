import React, { useMemo, useEffect } from 'react';
import { ScrollArea, Button, toast, resolveFormTheme, useFormFonts, FormThemeContext, buttonTokenClass } from '@dculus/ui';
import { FormPage, FormField, FieldType, buildPageTree, countQuestionFields, isLayoutField, pageHasGrid } from '@dculus/types';
import { cn } from '@dculus/utils';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useFormBuilderStore } from '../../../store/useFormBuilderStore';
import { useEffectiveTokens } from '../../../store/useBrandPreviewStore';
import { useCanvasStyleStore } from '../../../store/useCanvasStyleStore';
import { CanvasStylePopover } from '../design/CanvasStylePopover';
import { useTranslation } from '../../../hooks';
import { useFormPermissions } from '../../../hooks/useFormPermissions';
import { useFieldCreation } from '../../../hooks/useFieldCreation';
import { useDroppable } from '@dnd-kit/core';
import { DraggableFieldCard } from './PageBuilderFieldCard';
import { GridBlock } from './PageBuilderGridBlock';
import { FieldPickerPopover } from '../field-library/FieldPickerPopover';
import { getFieldTypesConfig } from '../FieldTypesPanel';
import { recordRecentFieldType } from '../field-library/fieldLibraryStorage';
import { isTypingTarget } from '../../../utils/isTypingTarget';
import { adjacentColumnTarget, horizontalNeighbour, verticalNeighbour, type Step } from './gridNavigation';
import { useDeleteGridWithUndo } from './useDeleteGridWithUndo';

// =============================================================================
// ConnectionStatus
// =============================================================================

/**
 * ConnectionStatus - Shows the collaboration connection status
 */
export const ConnectionStatus: React.FC<{ isConnected: boolean }> = ({
  isConnected,
}) => {
  const { t } = useTranslation('pageBuilderTab');

  return (
    <p className="text-sm mt-2">
      {isConnected
        ? `✓ ${t('status.connected')}`
        : `○ ${t('status.connecting')}`}
    </p>
  );
};

// =============================================================================
// EmptyFormAreaPlaceholder
// =============================================================================

/**
 * EmptyFormAreaPlaceholder - Shows when no fields exist with instant 1-click starter actions
 */
export const EmptyFormAreaPlaceholder: React.FC<{
  isConnected: boolean;
  pageId?: string;
}> = ({ isConnected: _isConnected, pageId }) => {
  const { t } = useTranslation('pageBuilderTab');
  const permissions = useFormPermissions();
  const canEdit = permissions.canEditFields();
  const { addField, setSelectedField } = useFormBuilderStore();
  const { createFieldData } = useFieldCreation();
  const { t: tFieldTypes } = useTranslation('fieldTypesPanel');
  const FIELD_TYPES = useMemo(() => getFieldTypesConfig(tFieldTypes), [tFieldTypes]);

  const handleQuickAdd = (type: FieldType) => {
    if (!pageId || !canEdit) return;
    const cfg = FIELD_TYPES.find((f) => f.type === type);
    if (!cfg) return;

    const previousIds = new Set(
      useFormBuilderStore
        .getState()
        .pages.find((p) => p.id === pageId)
        ?.fields.map((f) => f.id) ?? []
    );

    addField(pageId, type, createFieldData(cfg));
    recordRecentFieldType(type);

    setTimeout(() => {
      const page = useFormBuilderStore
        .getState()
        .pages.find((p) => p.id === pageId);
      const newField = page?.fields.find((f) => !previousIds.has(f.id));
      if (newField) setSelectedField(newField.id);
    }, 80);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-[#655d67] dark:text-gray-400 py-10 px-4 text-center select-none">
      <div className="w-12 h-12 rounded-2xl bg-[var(--tf-icon-lavender)] flex items-center justify-center mb-3 text-[#5c2e6b]">
        <Plus className="w-6 h-6" />
      </div>
      <p className="text-base font-semibold text-[#3c323e] dark:text-white">
        {t('formArea.emptyTitle', { defaultValue: 'Start building your page' })}
      </p>
      <p className="text-xs mt-1 text-[#655d67] dark:text-gray-400 max-w-sm mb-5">
        {t('formArea.emptySubtitle', {
          defaultValue: 'Add your first question or drag field types from the library.',
        })}
      </p>

      {canEdit && pageId && (
        <div className="flex flex-col items-center gap-4">
          <FieldPickerPopover pageId={pageId} idPrefix="empty-state-">
            <Button
              className="gap-2 px-5 py-2.5 h-auto text-sm font-semibold rounded-xl shadow-sm cursor-pointer"
              data-testid="empty-add-first-field-button"
            >
              <Plus className="w-4 h-4" />
              {t('formArea.addFirstQuestion', { defaultValue: 'Add your first question' })}
            </Button>
          </FieldPickerPopover>

          {/* Quick starter chips */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
            <span className="text-[11px] text-[var(--tf-muted)] mr-1">
              {t('formArea.orQuickStart', { defaultValue: 'or start with:' })}
            </span>
            {([
              FieldType.TEXT_INPUT_FIELD,
              FieldType.EMAIL_FIELD,
              FieldType.RADIO_FIELD,
              FieldType.NUMBER_FIELD,
            ] as const).map((type) => {
              const cfg = FIELD_TYPES.find((f) => f.type === type);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleQuickAdd(type)}
                  className="text-xs px-2.5 py-1 rounded-lg border border-[var(--tf-border-medium)] hover:border-[var(--tf-border-strong)] hover:bg-[var(--tf-faint)] text-[var(--tf-text)] transition-colors cursor-pointer"
                >
                  + {cfg?.label || type}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// DropIndicator
// =============================================================================

/**
 * DropIndicator - A drop zone between fields for inserting new fields.
 * While dragging: expands into a highlighted drop target.
 * While resting: acts as an interactive hover divider with a centered "+" insertion button.
 */
export const DropIndicator: React.FC<{
  index: number;
  pageId: string;
  isAnyDragActive?: boolean;
  /** Grid pages only: the top-level node this slot sits before (null = end of page). */
  beforeNodeId?: string | null;
}> = ({ index, pageId, isAnyDragActive = false, beforeNodeId }) => {
  const permissions = useFormPermissions();
  const canEdit = permissions.canEditFields();
  const { t } = useTranslation('pageBuilderTab');
  const { setNodeRef, isOver } = useDroppable({
    id: `drop-indicator-${pageId}-${index}`,
    data: {
      type: 'field-insert',
      pageId,
      insertIndex: index,
      ...(beforeNodeId !== undefined && { beforeNodeId }),
    },
    disabled: !canEdit,
  });

  if (isAnyDragActive) {
    const height = isOver
      ? 'h-14 py-1.5'
      : 'h-8 py-1';

    return (
      <div
        ref={setNodeRef}
        className={`transition-all duration-150 rounded-lg my-0.5 ${height}`}
      >
        <div
          className={`
            w-full h-full rounded-lg border-2 border-dashed flex items-center justify-center
            transition-all duration-150
            ${
              isOver
                ? 'border-[rgba(60,50,62,0.28)] bg-[var(--tf-tab-bg)]'
                : 'border-[rgba(60,50,62,0.12)]'
            }
          `}
        >
          {isOver && (
            <span className="text-xs text-[#3c323e] font-medium select-none">
              {t('formArea.dropHere', { defaultValue: 'Drop here' })}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Resting state: subtle hover insertion divider
  return (
    <div
      ref={setNodeRef}
      className="relative group/divider h-4 -my-1 flex items-center justify-center z-10"
    >
      <div className="absolute inset-x-3 h-[1px] bg-gradient-to-r from-transparent via-[var(--tf-border-strong)]/30 to-transparent opacity-0 group-hover/divider:opacity-100 transition-opacity duration-150" />
      {canEdit && (
        <FieldPickerPopover
          pageId={pageId}
          insertIndex={index}
          idPrefix={`between-${index}-`}
        >
          <button
            type="button"
            className="opacity-0 group-hover/divider:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none transition-all duration-150 transform scale-90 group-hover/divider:scale-100 focus-visible:scale-100 w-5 h-5 rounded-full bg-white dark:bg-card border border-[var(--tf-border-medium)] hover:border-[var(--tf-border-strong)] shadow-xs hover:shadow hover:scale-110 flex items-center justify-center text-[var(--tf-muted)] hover:text-[var(--tf-dark)] cursor-pointer"
            title={t('formArea.insertFieldHere', { defaultValue: 'Insert field here' })}
            aria-label={t('formArea.insertFieldHere', { defaultValue: 'Insert field here' })}
            data-testid={`insert-field-button-${index}`}
          >
            <Plus className="w-3 h-3" />
          </button>
        </FieldPickerPopover>
      )}
    </div>
  );
};

// =============================================================================
// FieldListWithDropZones
// =============================================================================

/**
 * Top-level nodes of a page that has a grid (§8.2): plain fields and grid blocks, with insert slots
 * between nodes. Slot indexes count the canonical visible order, so the insert popover's
 * `addFieldAtIndex` lands before the same node the slot's `beforeNodeId` names.
 */
const GridAwareNodeList: React.FC<{
  fields: FormField[];
  pageId: string;
  recentlyDroppedFieldId?: string | null;
  isDelayingExpansion: boolean;
  isAnyDragActive: boolean;
}> = ({ fields, pageId, recentlyDroppedFieldId, isDelayingExpansion, isAnyDragActive }) => {
  const nodes = useMemo(() => buildPageTree(fields), [fields]);
  const indexById = useMemo(() => new Map(fields.map((f, i) => [f.id, i])), [fields]);

  let cursor = 0;
  const items = nodes.map((node) => {
    const start = cursor;
    const nodeId = node.kind === 'field' ? node.field.id : node.grid.id;
    cursor += node.kind === 'field' ? 1 : 1 + node.columns.reduce((s, c) => s + c.fields.length, 0);
    return { node, nodeId, start };
  });

  return (
    <>
      {items.map(({ node, nodeId, start }) => (
        <div key={nodeId}>
          <DropIndicator
            index={start}
            pageId={pageId}
            isAnyDragActive={isAnyDragActive}
            beforeNodeId={nodeId}
          />
          {node.kind === 'field' ? (
            <DraggableFieldCard
              field={node.field}
              index={indexById.get(node.field.id) ?? start}
              pageId={pageId}
              totalFields={fields.length}
              isRecentlyDropped={node.field.id === recentlyDroppedFieldId}
              isDelayingExpansion={isDelayingExpansion}
            />
          ) : (
            <GridBlock
              grid={node.grid}
              columns={node.columns}
              pageId={pageId}
              pageFields={fields}
              recentlyDroppedFieldId={recentlyDroppedFieldId}
              isDelayingExpansion={isDelayingExpansion}
              isAnyDragActive={isAnyDragActive}
            />
          )}
        </div>
      ))}
      <DropIndicator
        index={cursor}
        pageId={pageId}
        isAnyDragActive={isAnyDragActive}
        beforeNodeId={null}
      />
    </>
  );
};

/**
 * FieldListWithDropZones - Renders fields with drop/insert indicators and bottom Add content button
 */
export const FieldListWithDropZones: React.FC<{
  fields: FormField[];
  pageId: string;
  recentlyDroppedFieldId?: string | null;
  isDelayingExpansion?: boolean;
  isAnyDragActive?: boolean;
}> = ({
  fields,
  pageId,
  recentlyDroppedFieldId,
  isDelayingExpansion = false,
  isAnyDragActive = false,
}) => {
  const permissions = useFormPermissions();
  const canEdit = permissions.canEditFields();
  const { t } = useTranslation('pageBuilderTab');
  const hasGrid = pageHasGrid(fields);

  return (
    <div className="space-y-0.5">
      {hasGrid ? (
        <GridAwareNodeList
          fields={fields}
          pageId={pageId}
          recentlyDroppedFieldId={recentlyDroppedFieldId}
          isDelayingExpansion={isDelayingExpansion}
          isAnyDragActive={isAnyDragActive}
        />
      ) : (
      <>
      <DropIndicator index={0} pageId={pageId} isAnyDragActive={isAnyDragActive} />

      {fields.map((field, index) => (
        <div key={field.id}>
          <DraggableFieldCard
            field={field}
            index={index}
            pageId={pageId}
            totalFields={fields.length}
            isRecentlyDropped={field.id === recentlyDroppedFieldId}
            isDelayingExpansion={isDelayingExpansion}
          />
          <DropIndicator index={index + 1} pageId={pageId} isAnyDragActive={isAnyDragActive} />
        </div>
      ))}
      </>
      )}

      {/* Bottom "+ Add content" button — left-aligned to avoid overlap with centered floating Ask AI pill */}
      {canEdit && (
        <div
          className={cn(
            'pt-3 transition-opacity duration-150 flex items-center justify-start',
            isAnyDragActive ? 'opacity-0 pointer-events-none' : 'opacity-100'
          )}
        >
          <FieldPickerPopover
            pageId={pageId}
            insertIndex={fields.length}
            idPrefix="bottom-add-"
            align="start"
            side="top"
          >
            <button
              type="button"
              data-testid="bottom-add-content-button"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-[var(--tf-border-medium)] hover:border-[var(--tf-border-strong)] hover:bg-[var(--tf-faint)] text-[#4c414e] dark:text-gray-200 text-sm font-medium transition-all group cursor-pointer shadow-xs"
            >
              <span className="w-5 h-5 rounded-full bg-white dark:bg-card border border-[var(--tf-border-medium)] group-hover:border-[var(--tf-border-strong)] flex items-center justify-center text-[var(--tf-muted)] group-hover:text-[var(--tf-dark)] group-hover:scale-110 transition-all">
                <Plus className="w-3.5 h-3.5" />
              </span>
              <span>{t('formArea.addContent', { defaultValue: 'Add content' })}</span>
            </button>
          </FieldPickerPopover>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// PageHeader
// =============================================================================

/**
 * PageHeader - Displays the selected page title and field count
 */
export const PageHeader: React.FC<{
  selectedPage: FormPage | undefined;
  headingFont?: boolean;
}> = ({ selectedPage, headingFont = false }) => {
  const { t } = useTranslation('pageBuilderTab');
  const { t: tDesign } = useTranslation('designDrawer');
  const toggleCanvasStyle = useCanvasStyleStore((s) => s.toggle);

  if (!selectedPage) {
    return (
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-[#655d67]">
          {t('formArea.noPageSelected')}
        </h1>
      </div>
    );
  }

  const questionCount = countQuestionFields(selectedPage.fields);

  return (
    <div className="mb-4 flex items-baseline gap-3 sm:mb-6">
      <CanvasStylePopover target="title">
        <h1
          className="text-3xl font-bold tracking-tight text-[#3c323e] dark:text-white"
          style={headingFont ? { fontFamily: 'var(--df-font-heading)' } : undefined}
        >
          <button
            type="button"
            title={tDesign('brandStyle.canvasStyle.hint')}
            data-testid="canvas-style-title"
            onClick={() => toggleCanvasStyle('title')}
            className="rounded text-left hover:bg-black/5 focus-visible:outline focus-visible:outline-2 dark:hover:bg-white/10"
          >
            {selectedPage.title || t('formArea.untitledPage')}
          </button>
        </h1>
      </CanvasStylePopover>
      <span className="text-xs text-[#655d67] dark:text-gray-400">
        {t(questionCount === 1 ? 'formArea.fieldCount' : 'formArea.fieldCount_plural', {
          values: { count: questionCount },
        })}
      </span>
    </div>
  );
};

// =============================================================================
// PageProgress / PageNavFooter
// =============================================================================

/**
 * PageProgress - Viewer-style progress bar with a "Page X of Y" counter
 */
export const PageProgress: React.FC<{
  pageCount: number;
  currentIndex: number;
  themed: boolean;
}> = ({ pageCount, currentIndex, themed }) => {
  const { t } = useTranslation('pageBuilderTab');
  if (pageCount < 2 || currentIndex < 0) return null;

  return (
    <div className="mb-4 flex items-center gap-3" data-testid="page-progress">
      <div className="h-0.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div
          className={cn(
            'h-full rounded-full bg-primary transition-all duration-500 ease-out motion-reduce:transition-none',
            themed && 'bg-[var(--df-primary)]'
          )}
          style={{ width: `${Math.round(((currentIndex + 1) / pageCount) * 100)}%` }}
        />
      </div>
      <span
        className="flex-shrink-0 text-xs tabular-nums text-gray-400 dark:text-gray-500"
        data-testid="page-indicator"
      >
        {t('pageNavigator.position', { values: { current: currentIndex + 1, total: pageCount } })}
      </span>
    </div>
  );
};

const NAV_PILL_CLASS =
  'flex items-center gap-2.5 rounded-full bg-primary px-8 py-3 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:bg-primary/90 hover:shadow-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none';

/**
 * BackToIntro - Viewer-style link at the top of the page card that returns to the intro screen
 */
export const BackToIntro: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const { t } = useTranslation('pageBuilderTab');
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="page-back-to-intro"
      className="mb-5 flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      {t('pageNavigator.backToIntro')}
    </button>
  );
};

/**
 * PageNavFooter - Viewer-style footer: ghost "Prev" on the left, pill "Next" on the right.
 * On the last page the pill reads "Submit" and is disabled, since the builder never submits.
 */
export const PageNavFooter: React.FC<{
  pages: FormPage[];
  selectedPageId: string | null;
  onSelectPage: (pageId: string) => void;
  brandTheme: ReturnType<typeof resolveFormTheme>;
}> = ({ pages, selectedPageId, onSelectPage, brandTheme }) => {
  const { t } = useTranslation('pageBuilderTab');
  const currentIndex = pages.findIndex((p) => p.id === selectedPageId);

  if (currentIndex === -1) return null;

  const prevPage = pages[currentIndex - 1];
  const nextPage = pages[currentIndex + 1];
  const pillClass = cn(NAV_PILL_CLASS, buttonTokenClass(brandTheme));

  return (
    <nav
      aria-label={t('pageNavigator.label')}
      className="mt-6 border-t border-gray-100 pt-4 dark:border-gray-800"
      data-testid="page-navigator"
    >
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => prevPage && onSelectPage(prevPage.id)}
          disabled={!prevPage}
          data-testid="page-navigator-prev"
          className="flex items-center gap-1.5 text-sm font-medium text-gray-400 transition-colors hover:text-gray-700 disabled:pointer-events-none disabled:opacity-0 dark:hover:text-gray-300"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          {t('pageNavigator.previous')}
        </button>
        {nextPage ? (
          <button
            type="button"
            onClick={() => onSelectPage(nextPage.id)}
            data-testid="page-navigator-next"
            className={pillClass}
          >
            {t('pageNavigator.next')}
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            disabled
            title={t('pageNavigator.submitHint')}
            data-testid="page-navigator-submit"
            className={pillClass}
          >
            {t('pageNavigator.submit')}
            <Check className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </nav>
  );
};

// =============================================================================
// FormArea
// =============================================================================

/**
 * FormArea - Center column displaying form fields (drop zone + keyboard shortcuts)
 */
export const FormArea: React.FC<{
  recentlyDroppedFieldId?: string | null;
  isDelayingExpansion?: boolean;
  isAnyDragActive?: boolean;
}> = ({ recentlyDroppedFieldId, isDelayingExpansion = false, isAnyDragActive = false }) => {
  const permissions = useFormPermissions();
  const { t } = useTranslation('pageBuilderTab');
  const {
    isConnected,
    pages,
    selectedPageId,
    selectedFieldId,
    setSelectedPage,
    setSelection,
    setSelectedField,
    removeField,
    restoreField,
    duplicateField,
    duplicateGrid,
    reorderFields,
    placeField,
    layout,
  } = useFormBuilderStore();
  // Brand tokens drive the canvas too, so Design-drawer changes show live; unbranded forms keep the legacy look.
  const tokens = useEffectiveTokens(layout?.tokens);
  useFormFonts(tokens);
  const isDarkChrome =
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const brandTheme = useMemo(
    () => resolveFormTheme(tokens, isDarkChrome ? 'dark' : 'light'),
    [tokens, isDarkChrome]
  );
  const toggleCanvasStyle = useCanvasStyleStore((s) => s.toggle);
  const deleteGridWithUndo = useDeleteGridWithUndo(permissions.canEditFields());
  const selectedPage = pages.find((p) => p.id === selectedPageId);

  // Canvas Keyboard Shortcuts (Cmd+D to duplicate, Delete/Backspace with undo, Arrow nav, Alt+Arrow reorder)
  useEffect(() => {
    if (!permissions.canEditFields() || !selectedPage || !selectedFieldId) return;

    const hasGrid = pageHasGrid(selectedPage.fields);
    const arrowStep = (key: string): Step | undefined =>
      key === 'ArrowUp' || key === 'ArrowLeft' ? -1 : key === 'ArrowDown' || key === 'ArrowRight' ? 1 : undefined;

    /** Arrow keys on a grid page (§8.7). Returns true when the key was handled. */
    const handleGridArrowKeys = (e: KeyboardEvent, fieldId: string): boolean => {
      const step = arrowStep(e.key);
      if (step === undefined || e.metaKey || e.ctrlKey || e.shiftKey) return false;
      const horizontal = e.key === 'ArrowLeft' || e.key === 'ArrowRight';

      if (e.altKey) {
        // Alt+↑/↓ fall through to reorderFields, whose grid branch owns the column-edge semantics (D10)
        if (!horizontal) return false;
        const target = adjacentColumnTarget(selectedPage.fields, fieldId, step);
        if (target) {
          e.preventDefault();
          placeField({ pageId: selectedPage.id, fieldId, target });
        }
        return true;
      }

      const next = horizontal
        ? horizontalNeighbour(selectedPage.fields, fieldId, step)
        : verticalNeighbour(selectedPage.fields, fieldId, step);
      if (next) {
        e.preventDefault();
        setSelectedField(next);
      }
      return true;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;

      const fieldIndex = selectedPage.fields.findIndex((f) => f.id === selectedFieldId);
      if (fieldIndex === -1) return;
      const currentField = selectedPage.fields[fieldIndex];

      // Delete / Backspace: remove field with undo toast (guard against focused interactive controls)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const target = e.target as HTMLElement | null;
        if (target && target.closest('button, select, [role="button"], [role="switch"], [role="menuitem"], [role="combobox"], [role="option"]')) {
          return;
        }
        e.preventDefault();
        if (isLayoutField(currentField)) {
          deleteGridWithUndo(selectedPage.id, currentField.id);
          return;
        }
        const removed = removeField(selectedPage.id, currentField.id);
        if (removed !== false) {
          setSelectedField(null);
          toast({
            title: t('notifications.fieldDeleted', { defaultValue: 'Question deleted' }),
            action: {
              label: t('notifications.undo', { defaultValue: 'Undo' }),
              onClick: () => {
                const restored = restoreField(selectedPage.id, currentField, fieldIndex);
                if (restored) {
                  setSelectedField(currentField.id);
                }
              },
            },
          });
        }
        return;
      }

      // Cmd+D / Ctrl+D: duplicate field
      if ((e.metaKey || e.ctrlKey) && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        if (isLayoutField(currentField)) {
          const newId = duplicateGrid(selectedPage.id, currentField.id);
          if (newId) setSelectedField(newId);
          return;
        }
        duplicateField(selectedPage.id, currentField.id);
        return;
      }

      // Grid pages walk the layout tree; grid-less pages keep the flat-list behaviour below unchanged
      if (hasGrid && handleGridArrowKeys(e, currentField.id)) return;

      // Alt+Up / Alt+Down: reorder field
      if (e.altKey && e.key === 'ArrowUp') {
        if (fieldIndex > 0) {
          e.preventDefault();
          reorderFields(selectedPage.id, fieldIndex, fieldIndex - 1);
        }
        return;
      }
      if (e.altKey && e.key === 'ArrowDown') {
        if (fieldIndex < selectedPage.fields.length - 1) {
          e.preventDefault();
          reorderFields(selectedPage.id, fieldIndex, fieldIndex + 1);
        }
        return;
      }

      // ArrowUp / ArrowDown without modifiers: navigate selection
      if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
        if (e.key === 'ArrowUp' && fieldIndex > 0) {
          e.preventDefault();
          setSelectedField(selectedPage.fields[fieldIndex - 1].id);
        } else if (e.key === 'ArrowDown' && fieldIndex < selectedPage.fields.length - 1) {
          e.preventDefault();
          setSelectedField(selectedPage.fields[fieldIndex + 1].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    permissions,
    selectedPage,
    selectedFieldId,
    removeField,
    setSelectedField,
    restoreField,
    duplicateField,
    duplicateGrid,
    reorderFields,
    placeField,
    deleteGridWithUndo,
    t,
  ]);

  // Make the form area a drop zone
  const { setNodeRef, isOver } = useDroppable({
    id: 'form-area-drop-zone',
    data: {
      type: 'form-area',
      pageId: selectedPageId,
    },
    disabled: !permissions.canEditFields(),
  });

  return (
    <div className="flex h-full flex-col min-h-0 bg-[var(--tf-faint)] dark:bg-background">
      {/* Radix sizes the viewport's content box as `display: table`, which grows to the content's
          intrinsic width instead of the canvas width, so in the 390px phone frame the page card
          spilled past the frame's right edge. A block box keeps the content at the canvas width. */}
      <ScrollArea className="min-h-0 flex-1 [&_[data-radix-scroll-area-viewport]>div]:!block">
        <div className="p-6 pb-36">
          <div className="max-w-3xl mx-auto" style={brandTheme.branded ? brandTheme.cssVars : undefined}>
            {/* One page card, like the form viewer: back link, progress, title, fields, prev/next */}
            <FormThemeContext.Provider value={brandTheme}>
            <CanvasStylePopover target="surface">
            <div
              // Only clicks on the card's own padding/empty space; fields and their controls keep their behaviour.
              onClick={(e) => e.target === e.currentTarget && toggleCanvasStyle('surface')}
              className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-black/5 dark:bg-card sm:p-8"
              style={{
                ...(brandTheme.hasSurface ? { backgroundColor: 'var(--df-surface)' } : null),
                ...(tokens?.bodyFont ? { fontFamily: 'var(--df-font-body)' } : null),
              }}
              data-testid="page-card"
            >
              <BackToIntro onClick={() => setSelection({ kind: 'intro' })} />

              <PageProgress
                pageCount={pages.length}
                currentIndex={pages.findIndex((p) => p.id === selectedPageId)}
                themed={brandTheme.hasPrimary}
              />

              <PageHeader selectedPage={selectedPage} headingFont={!!tokens?.headingFont} />

              {/* Form Fields Container - Drop Zone */}
              <div
                ref={setNodeRef}
                onClick={(e) => e.target === e.currentTarget && toggleCanvasStyle('surface')}
                className={`min-h-[240px] rounded-xl transition-all duration-150 ${isOver ? 'ring-2 ring-[rgba(60,50,62,0.12)]' : ''}`}
                style={isOver ? { border: '2px dashed rgba(60,50,62,0.25)' } : undefined}
                data-testid="droppable-page"
              >
                {selectedPage && selectedPage.fields.length > 0 ? (
                  <FieldListWithDropZones
                    fields={selectedPage.fields}
                    pageId={selectedPage.id}
                    recentlyDroppedFieldId={recentlyDroppedFieldId}
                    isDelayingExpansion={isDelayingExpansion}
                    isAnyDragActive={isAnyDragActive}
                  />
                ) : (
                  <EmptyFormAreaPlaceholder isConnected={isConnected} pageId={selectedPage?.id} />
                )}
              </div>

              <PageNavFooter
                pages={pages}
                selectedPageId={selectedPageId}
                onSelectPage={setSelectedPage}
                brandTheme={brandTheme}
              />
            </div>
            </CanvasStylePopover>
            </FormThemeContext.Provider>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};
export default FormArea;

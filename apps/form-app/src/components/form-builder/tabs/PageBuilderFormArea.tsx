import React, { useMemo, useEffect } from 'react';
import { ScrollArea, Button, toast } from '@dculus/ui';
import { FormPage, FormField, FieldType } from '@dculus/types';
import { cn } from '@dculus/utils';
import { Plus } from 'lucide-react';
import { useFormBuilderStore } from '../../../store/useFormBuilderStore';
import { useTranslation } from '../../../hooks';
import { useFormPermissions } from '../../../hooks/useFormPermissions';
import { useFieldCreation } from '../../../hooks/useFieldCreation';
import { useDroppable } from '@dnd-kit/core';
import { DraggableFieldCard } from './PageBuilderFieldCard';
import { FieldPickerPopover } from '../field-library/FieldPickerPopover';
import { getFieldTypesConfig } from '../FieldTypesPanel';
import { recordRecentFieldType } from '../field-library/fieldLibraryStorage';
import { isTypingTarget } from '../../../utils/isTypingTarget';

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
            <button
              type="button"
              onClick={() => handleQuickAdd(FieldType.TEXT_INPUT_FIELD)}
              className="text-xs px-2.5 py-1 rounded-lg border border-[var(--tf-border-medium)] hover:border-[var(--tf-border-strong)] hover:bg-[var(--tf-faint)] text-[var(--tf-text)] transition-colors cursor-pointer"
            >
              + Short Text
            </button>
            <button
              type="button"
              onClick={() => handleQuickAdd(FieldType.EMAIL_FIELD)}
              className="text-xs px-2.5 py-1 rounded-lg border border-[var(--tf-border-medium)] hover:border-[var(--tf-border-strong)] hover:bg-[var(--tf-faint)] text-[var(--tf-text)] transition-colors cursor-pointer"
            >
              + Email
            </button>
            <button
              type="button"
              onClick={() => handleQuickAdd(FieldType.RADIO_FIELD)}
              className="text-xs px-2.5 py-1 rounded-lg border border-[var(--tf-border-medium)] hover:border-[var(--tf-border-strong)] hover:bg-[var(--tf-faint)] text-[var(--tf-text)] transition-colors cursor-pointer"
            >
              + Multiple Choice
            </button>
            <button
              type="button"
              onClick={() => handleQuickAdd(FieldType.NUMBER_FIELD)}
              className="text-xs px-2.5 py-1 rounded-lg border border-[var(--tf-border-medium)] hover:border-[var(--tf-border-strong)] hover:bg-[var(--tf-faint)] text-[var(--tf-text)] transition-colors cursor-pointer"
            >
              + Number
            </button>
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
}> = ({ index, pageId, isAnyDragActive = false }) => {
  const permissions = useFormPermissions();
  const canEdit = permissions.canEditFields();
  const { setNodeRef, isOver } = useDroppable({
    id: `drop-indicator-${pageId}-${index}`,
    data: {
      type: 'field-insert',
      pageId,
      insertIndex: index,
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
              Drop here
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
            className="opacity-0 group-hover/divider:opacity-100 transition-all duration-150 transform scale-90 group-hover/divider:scale-100 w-5 h-5 rounded-full bg-white dark:bg-card border border-[var(--tf-border-medium)] hover:border-[var(--tf-border-strong)] shadow-xs hover:shadow hover:scale-110 flex items-center justify-center text-[var(--tf-muted)] hover:text-[var(--tf-dark)] cursor-pointer"
            title="Insert field here"
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

  return (
    <div className="space-y-0.5">
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
}> = ({ selectedPage }) => {
  const { t } = useTranslation('pageBuilderTab');

  if (!selectedPage) {
    return (
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-[#655d67]">
          {t('formArea.noPageSelected')}
        </h1>
      </div>
    );
  }

  return (
    <div className="mb-4 flex items-baseline gap-3">
      <h1 className="text-xl font-semibold text-[#3c323e] dark:text-white">
        {selectedPage.title || t('formArea.untitledPage')}
      </h1>
      <span className="text-xs text-[#655d67] dark:text-gray-400">
        {selectedPage.fields.length}{' '}
        {selectedPage.fields.length === 1 ? 'field' : 'fields'}
      </span>
    </div>
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
    setSelectedField,
    removeField,
    restoreField,
    duplicateField,
    reorderFields,
  } = useFormBuilderStore();
  const selectedPage = pages.find((p) => p.id === selectedPageId);

  // Canvas Keyboard Shortcuts (Cmd+D to duplicate, Delete/Backspace with undo, Arrow nav, Alt+Arrow reorder)
  useEffect(() => {
    if (!permissions.canEditFields() || !selectedPage || !selectedFieldId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;

      const fieldIndex = selectedPage.fields.findIndex((f) => f.id === selectedFieldId);
      if (fieldIndex === -1) return;
      const currentField = selectedPage.fields[fieldIndex];

      // Delete / Backspace: remove field with undo toast
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removeField(selectedPage.id, currentField.id);
        setSelectedField(null);
        toast({
          title: t('notifications.fieldDeleted', { defaultValue: 'Question deleted' }),
          action: {
            label: t('notifications.undo', { defaultValue: 'Undo' }),
            onClick: () => {
              restoreField(selectedPage.id, currentField, fieldIndex);
              setSelectedField(currentField.id);
            },
          },
        });
        return;
      }

      // Cmd+D / Ctrl+D: duplicate field
      if ((e.metaKey || e.ctrlKey) && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        duplicateField(selectedPage.id, currentField.id);
        return;
      }

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
    reorderFields,
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
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-6 pb-36">
          <div className="max-w-3xl mx-auto">
            {/* Page Header */}
            <PageHeader selectedPage={selectedPage} />

            {/* Form Fields Container - Drop Zone */}
            <div
              ref={setNodeRef}
              className={`
                min-h-[400px] p-4 bg-white dark:bg-card rounded-xl
                transition-all duration-150
                ${isOver ? 'ring-2 ring-[rgba(60,50,62,0.12)]' : ''}
              `}
              style={{
                border: isOver
                  ? '2px dashed rgba(60,50,62,0.25)'
                  : '1px solid rgba(81,76,84,0.10)',
                boxShadow: isOver
                  ? undefined
                  : '0 1px 4px rgba(60,50,62,0.06)',
              }}
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
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};
export default FormArea;

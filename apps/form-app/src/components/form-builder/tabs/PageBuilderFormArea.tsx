import React from 'react';
import { ScrollArea } from '@dculus/ui';
import { FormPage, FormField } from '@dculus/types';
import { useFormBuilderStore } from '../../../store/useFormBuilderStore';
import { useTranslation } from '../../../hooks';
import { useFormPermissions } from '../../../hooks/useFormPermissions';
import { useDroppable } from '@dnd-kit/core';
import { DraggableFieldCard } from './PageBuilderFieldCard';

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
 * EmptyFormAreaPlaceholder - Shows when no fields exist
 */
export const EmptyFormAreaPlaceholder: React.FC<{ isConnected: boolean }> = ({
  isConnected: _isConnected,
}) => {
  const { t } = useTranslation('pageBuilderTab');

  return (
    <div className="flex items-center justify-center h-full min-h-[240px] text-[#655d67] dark:text-gray-400">
      <div className="text-center select-none">
        <div className="w-10 h-10 rounded-xl bg-[var(--tf-icon-lavender)] flex items-center justify-center mx-auto mb-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5c2e6b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
        </div>
        <p className="text-sm font-medium text-[#4c414e]">{t('formArea.placeholder')}</p>
        <p className="text-xs mt-1 text-[#655d67]">{t('dragHint')}</p>
      </div>
    </div>
  );
};

// =============================================================================
// DropIndicator
// =============================================================================

/**
 * DropIndicator - A drop zone between fields for inserting new fields.
 * Stays at a minimal height at rest, expands to a visible target while a
 * drag is in flight, and grows further when the cursor is directly over it.
 */
export const DropIndicator: React.FC<{
  index: number;
  pageId: string;
  isAnyDragActive?: boolean;
}> = ({ index, pageId, isAnyDragActive = false }) => {
  const permissions = useFormPermissions();
  const { setNodeRef, isOver } = useDroppable({
    id: `drop-indicator-${pageId}-${index}`,
    data: {
      type: 'field-insert',
      pageId,
      insertIndex: index,
    },
    disabled: !permissions.canEditFields(),
  });

  const height = isOver
    ? 'h-14 py-1.5'
    : isAnyDragActive
      ? 'h-8 py-1'
      : 'h-2 py-0';

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
              : isAnyDragActive
                ? 'border-[rgba(60,50,62,0.12)]'
                : 'border-transparent'
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
};

// =============================================================================
// FieldListWithDropZones
// =============================================================================

/**
 * FieldListWithDropZones - Renders fields with drop indicators between them
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
  return (
    <div>
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
 * FormArea - Center column displaying form fields (drop zone)
 */
export const FormArea: React.FC<{
  recentlyDroppedFieldId?: string | null;
  isDelayingExpansion?: boolean;
  isAnyDragActive?: boolean;
}> = ({ recentlyDroppedFieldId, isDelayingExpansion = false, isAnyDragActive = false }) => {
  const permissions = useFormPermissions();
  const { isConnected, pages, selectedPageId } = useFormBuilderStore();
  const selectedPage = pages.find((p) => p.id === selectedPageId);

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
    <div className="flex-1 flex flex-col bg-[var(--tf-faint)] dark:bg-background">
      <ScrollArea className="flex-1">
        <div className="p-6">
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
                <EmptyFormAreaPlaceholder isConnected={isConnected} />
              )}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

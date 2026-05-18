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
  isConnected,
}) => {
  const { t } = useTranslation('pageBuilderTab');

  return (
    <div className="flex items-center justify-center h-full min-h-[200px] text-muted-foreground dark:text-gray-400">
      <div className="text-center">
        <p className="text-lg font-medium">{t('formArea.placeholder')}</p>
        <ConnectionStatus isConnected={isConnected} />
        <p className="text-sm mt-2">{t('dragHint')}</p>
      </div>
    </div>
  );
};

// =============================================================================
// DropIndicator
// =============================================================================

/**
 * DropIndicator - A drop zone between fields for inserting new fields
 */
export const DropIndicator: React.FC<{
  index: number;
  pageId: string;
}> = ({ index, pageId }) => {
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

  return (
    <div
      ref={setNodeRef}
      className={`
        transition-all duration-200 rounded-lg my-1
        ${isOver ? 'h-16 py-2' : 'h-3 hover:h-6 py-0'}
      `}
    >
      <div
        className={`
          w-full h-full rounded-lg border-2 border-dashed flex items-center justify-center
          transition-all duration-200
          ${
            isOver
              ? 'border-blue-500 bg-blue-100 dark:bg-blue-950/50'
              : 'border-transparent'
          }
        `}
      >
        {isOver && (
          <span className="text-xs text-blue-600 dark:text-blue-400 font-medium animate-pulse">
            Drop here to insert
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
}> = ({
  fields,
  pageId,
  recentlyDroppedFieldId,
  isDelayingExpansion = false,
}) => {
  return (
    <div>
      {/* Drop zone at the beginning */}
      <DropIndicator index={0} pageId={pageId} />

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
          {/* Drop zone after each field */}
          <DropIndicator index={index + 1} pageId={pageId} />
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-muted-foreground">
          {t('formArea.noPageSelected')}
        </h1>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-primary dark:text-white">
        {selectedPage.title || t('formArea.untitledPage')}
      </h1>
      <p className="text-sm text-muted-foreground dark:text-gray-400 mt-1">
        {selectedPage.fields.length}{' '}
        {selectedPage.fields.length === 1 ? 'field' : 'fields'}
      </p>
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
}> = ({ recentlyDroppedFieldId, isDelayingExpansion = false }) => {
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
    <div className="flex-1 flex flex-col bg-gradient-to-br from-gray-50 to-blue-50/30 dark:from-gray-800 dark:to-blue-950/30">
      <ScrollArea className="flex-1">
        <div className="p-6">
          <div className="max-w-4xl mx-auto">
            {/* Page Header */}
            <PageHeader selectedPage={selectedPage} />

            {/* Form Fields Container - Drop Zone */}
            <div
              ref={setNodeRef}
              className={`
                min-h-[400px] p-4 bg-white dark:bg-gray-900 rounded-xl border-2 border-dashed
                transition-all duration-200
                ${
                  isOver
                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 ring-2 ring-blue-500/20'
                    : 'border-[var(--tf-border-strong)] dark:border-gray-600'
                }
              `}
              data-testid="droppable-page"
            >
              {selectedPage && selectedPage.fields.length > 0 ? (
                <FieldListWithDropZones
                  fields={selectedPage.fields}
                  pageId={selectedPage.id}
                  recentlyDroppedFieldId={recentlyDroppedFieldId}
                  isDelayingExpansion={isDelayingExpansion}
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

import React, { useCallback } from 'react';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { ScrollArea } from '@dculus/ui';
import { useFormBuilderStore } from '../../../store/useFormBuilderStore';
import { useTranslation } from '../../../hooks';
import { FieldTypesPanel } from '../FieldTypesPanel';
import { PagesSidebar } from '../PagesSidebar';
import { DroppablePage } from '../DroppablePage';
import { EmptyFormState } from '../EmptyFormState';

interface PageBuilderTabProps {
  sidebarWidth: number;
  onSidebarWidthChange: (width: number) => void;
  selectedFieldId: string | null;
  onFieldEdit: (fieldId: string) => void;
  onFieldUpdate: (updates: Record<string, any>) => void;
  onFieldDeselect: () => void;
}

export const PageBuilderTab: React.FC<PageBuilderTabProps> = ({
  sidebarWidth,
  onSidebarWidthChange,
  selectedFieldId,
  onFieldEdit,
  onFieldUpdate,
  onFieldDeselect,
}) => {
  const { t } = useTranslation('pageBuilderTab');
  const {
    pages,
    layout,
    isShuffleEnabled,
    selectedPageId,
    isConnected,
    setSelectedPage,
    setSelectedField,
    addEmptyPage,
    removePage,
    duplicatePage,
    updatePageTitle,
    updateField,
    removeField,
    duplicateField,
    moveFieldBetweenPages,
    copyFieldToPage,
    reorderFields,
    getSelectedField,
  } = useFormBuilderStore();

  const selectedPage = pages.find((p) => p.id === selectedPageId);

  const handlePageSelect = useCallback(
    (pageId: string) => {
      setSelectedPage(pageId);
      setSelectedField(null);
    },
    [setSelectedPage, setSelectedField]
  );

  return (
    <div className="flex h-full">
      {/* Left Sidebar - Field Types Panel */}
      <div className="w-80 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <FieldTypesPanel />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Main Editor */}
        <ScrollArea className="flex-1">
          <div className="p-6">
            {pages.length === 0 ? (
              <EmptyFormState
                onCreatePage={addEmptyPage}
                isConnected={isConnected}
              />
            ) : selectedPage ? (
              <div className="max-w-4xl mx-auto">
                <DroppablePage
                  key={`${selectedPage.id}-${selectedPage.title}`}
                  page={selectedPage}
                  index={pages.findIndex((p) => p.id === selectedPage.id)}
                  isSelected={true}
                  isConnected={isConnected}
                  selectedFieldId={selectedFieldId}
                  pages={pages}
                  onSelect={() => {}}
                  onUpdateField={updateField}
                  onRemoveField={removeField}
                  onDuplicateField={duplicateField}
                  onEditField={onFieldEdit}
                  onMoveFieldBetweenPages={moveFieldBetweenPages}
                  onCopyFieldToPage={copyFieldToPage}
                  onReorderField={reorderFields}
                  onUpdatePageTitle={(title) =>
                    updatePageTitle(selectedPage.id, title)
                  }
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-600 dark:text-gray-400">
                  {t('noPageSelected')}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right Sidebar - Pages Sidebar */}
      <div
        className="border-l border-gray-200 dark:border-gray-700"
        style={{ width: `${sidebarWidth}px` }}
      >
        <SortableContext
          items={pages.map((p) => p.id)}
          strategy={verticalListSortingStrategy}
        >
          <PagesSidebar
            pages={pages}
            layout={layout}
            isShuffleEnabled={isShuffleEnabled}
            selectedPageId={selectedPageId}
            selectedField={getSelectedField()}
            isConnected={isConnected}
            onPageSelect={handlePageSelect}
            onAddPage={addEmptyPage}
            onRemovePage={removePage}
            onDuplicatePage={duplicatePage}
            onUpdatePageTitle={updatePageTitle}
            onFieldUpdate={onFieldUpdate}
            onFieldDeselect={onFieldDeselect}
            width={sidebarWidth}
            onWidthChange={onSidebarWidthChange}
          />
        </SortableContext>
      </div>
    </div>
  );
};

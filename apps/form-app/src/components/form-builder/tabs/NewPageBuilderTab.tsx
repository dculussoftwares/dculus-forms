import React from 'react';
import { ScrollArea } from '@dculus/ui';
import { FormPage } from '@dculus/types';
import { useFormBuilderStore } from '../../../store/useFormBuilderStore';
import { useTranslation } from '../../../hooks';

// =============================================================================
// Types
// =============================================================================

interface PageCardProps {
  pageId: string;
  pageTitle: string;
  fieldCount: number;
  pageNumber: number;
  isSelected: boolean;
}

// =============================================================================
// Sub-Components
// =============================================================================

/**
 * PageCard - Displays a single page in the pages sidebar
 */
const PageCard: React.FC<PageCardProps> = ({
  pageTitle,
  fieldCount,
  pageNumber,
  isSelected,
}) => {
  const { t } = useTranslation('newPageBuilderTab');

  return (
    <div
      className={`
        p-3 rounded-lg border-2 cursor-pointer transition-all
        ${
          isSelected
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
        }
      `}
    >
      <div className="flex items-center gap-2">
        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-medium">
          {pageNumber}
        </span>
        <span className="font-medium text-gray-900 dark:text-white truncate">
          {pageTitle || t('formArea.untitledPage')}
        </span>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-8">
        {fieldCount} {fieldCount === 1 ? 'field' : 'fields'}
      </p>
    </div>
  );
};

/**
 * FieldTypesSidebar - Left column displaying available field types
 */
const FieldTypesSidebar: React.FC = () => {
  const { t } = useTranslation('newPageBuilderTab');

  return (
    <div className="w-80 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {t('sidebar.fieldTypes.title')}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {t('sidebar.fieldTypes.description')}
        </p>
      </div>

      {/* Field Types List */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-2">
          {/* Phase 2 will populate this with field type cards */}
          <div className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center text-gray-500 dark:text-gray-400">
            {t('sidebar.fieldTypes.placeholder')}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

/**
 * PagesSidebar - Right column displaying form pages
 */
const PagesSidebar: React.FC = () => {
  const { t } = useTranslation('newPageBuilderTab');
  const { pages, selectedPageId } = useFormBuilderStore();

  return (
    <div className="w-80 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {t('sidebar.pages.title')}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {pages.length} {pages.length === 1 ? 'page' : 'pages'}
        </p>
      </div>

      {/* Pages List */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-2">
          {pages.length === 0 ? (
            <div className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center text-gray-500 dark:text-gray-400">
              {t('sidebar.pages.noPages')}
            </div>
          ) : (
            pages.map((page, index) => (
              <PageCard
                key={page.id}
                pageId={page.id}
                pageTitle={page.title}
                fieldCount={page.fields.length}
                pageNumber={index + 1}
                isSelected={selectedPageId === page.id}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

/**
 * FormArea - Center column displaying form fields
 */
const FormArea: React.FC = () => {
  const { t } = useTranslation('newPageBuilderTab');
  const { isConnected, pages, selectedPageId } = useFormBuilderStore();
  const selectedPage = pages.find((p) => p.id === selectedPageId);

  return (
    <div className="flex-1 flex flex-col bg-gradient-to-br from-gray-50 to-blue-50/30 dark:from-gray-800 dark:to-blue-950/30">
      <ScrollArea className="flex-1">
        <div className="p-6">
          <div className="max-w-4xl mx-auto">
            {/* Page Header */}
            <PageHeader selectedPage={selectedPage} />

            {/* Form Fields Container */}
            <div
              className="min-h-[400px] p-6 bg-white dark:bg-gray-900 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600"
              data-testid="form-fields-area"
            >
              <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                <div className="text-center">
                  <p className="text-lg font-medium">
                    {t('formArea.placeholder')}
                  </p>
                  <ConnectionStatus isConnected={isConnected} />
                  {selectedPage && (
                    <p className="text-sm mt-1">
                      Page has {selectedPage.fields.length} field(s)
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

/**
 * PageHeader - Displays the selected page title and field count
 */
const PageHeader: React.FC<{
  selectedPage: FormPage | undefined;
}> = ({ selectedPage }) => {
  const { t } = useTranslation('newPageBuilderTab');

  if (!selectedPage) {
    return (
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-400">
          {t('formArea.noPageSelected')}
        </h1>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        {selectedPage.title || t('formArea.untitledPage')}
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
        {selectedPage.fields.length}{' '}
        {selectedPage.fields.length === 1 ? 'field' : 'fields'}
      </p>
    </div>
  );
};

/**
 * ConnectionStatus - Shows the collaboration connection status
 */
const ConnectionStatus: React.FC<{ isConnected: boolean }> = ({
  isConnected,
}) => {
  const { t } = useTranslation('newPageBuilderTab');

  return (
    <p className="text-sm mt-2">
      {isConnected
        ? `✓ ${t('status.connected')}`
        : `○ ${t('status.connecting')}`}
    </p>
  );
};

// =============================================================================
// Main Component
// =============================================================================

/**
 * NewPageBuilderTab - Phase 1: Basic 3-Column Layout
 *
 * This is a fresh reimplementation of the page builder with stable drag-and-drop.
 * Each phase adds functionality incrementally for thorough testing.
 */
export const NewPageBuilderTab: React.FC = () => {
  return (
    <div className="flex h-full" data-testid="new-page-builder-tab">
      {/* Left: Field Types */}
      <FieldTypesSidebar />

      {/* Center: Form Area */}
      <FormArea />

      {/* Right: Pages */}
      <PagesSidebar />
    </div>
  );
};

export default NewPageBuilderTab;

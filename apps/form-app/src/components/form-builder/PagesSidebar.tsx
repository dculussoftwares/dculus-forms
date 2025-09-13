import React, { useState, useRef, useCallback, useEffect } from 'react';
import { FormPage, FormLayout, FormField } from '@dculus/types';
import { Button } from '@dculus/ui';
import { useFormPermissions } from '../../hooks/useFormPermissions';
import {
  Plus,
  FileText,
  Code,
  GripHorizontal,
  Settings
} from 'lucide-react';
import { DraggablePageItem } from './DraggablePageItem';
import { JSONPreview } from './JSONPreview';
import { FieldSettingsV2 as FieldSettings } from './field-settings-v2';

interface PagesSidebarProps {
  pages: FormPage[];
  layout: FormLayout;
  isShuffleEnabled: boolean;
  selectedPageId: string | null;
  selectedField: FormField | null;
  isConnected: boolean;
  onPageSelect: (pageId: string) => void;
  onAddPage: () => string | undefined;
  onRemovePage?: (pageId: string) => void;
  onDuplicatePage?: (pageId: string) => void;
  onFieldUpdate?: (updates: Record<string, any>) => void;
  onFieldDeselect?: () => void;
  width?: number;
  onWidthChange?: (width: number) => void;
}


export const PagesSidebar: React.FC<PagesSidebarProps> = ({
  pages,
  layout,
  isShuffleEnabled,
  selectedPageId,
  selectedField,
  isConnected,
  onPageSelect,
  onAddPage,
  onRemovePage,
  onDuplicatePage,
  onFieldUpdate,
  onFieldDeselect,
  width = 320,
  onWidthChange,
}) => {
  const permissions = useFormPermissions();
  const [activeTab, setActiveTab] = useState<'pages' | 'json' | 'field-settings'>('pages');
  const [isResizing, setIsResizing] = useState(false);
  const [newlyCreatedPageId, setNewlyCreatedPageId] = useState<string | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!onWidthChange) return;
    
    setIsResizing(true);
    e.preventDefault();
    
    const startX = e.clientX;
    const startWidth = width;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = startX - e.clientX;
      const newWidth = Math.max(200, Math.min(600, startWidth + deltaX));
      onWidthChange(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [width, onWidthChange]);

  useEffect(() => {
    document.body.style.cursor = isResizing ? 'ew-resize' : '';
    document.body.style.userSelect = isResizing ? 'none' : '';
    
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  // Auto-switch to field settings tab when a field is selected (only when field selection changes)
  useEffect(() => {
    if (selectedField) {
      setActiveTab('field-settings');
    }
  }, [selectedField]);

  // Clear the newly created page flag after scrolling
  useEffect(() => {
    if (newlyCreatedPageId && selectedPageId === newlyCreatedPageId) {
      const timer = setTimeout(() => {
        setNewlyCreatedPageId(null);
      }, 1000); // Clear after 1 second to ensure scrolling is complete
      return () => clearTimeout(timer);
    }
  }, [newlyCreatedPageId, selectedPageId]);

  const handleTabSwitch = (tab: 'pages' | 'json' | 'field-settings') => {
    setActiveTab(tab);
    // Clear field selection when switching away from field settings
    if (tab !== 'field-settings' && selectedField && onFieldDeselect) {
      onFieldDeselect();
    }
  };

  const handleAddPage = useCallback(() => {
    // First ensure we're on the pages tab
    setActiveTab('pages');
    
    // Call the original onAddPage which now returns the new page ID
    const newPageId = onAddPage();
    
    // Track the newly created page for auto-scrolling
    if (newPageId) {
      setNewlyCreatedPageId(newPageId);
    }
  }, [onAddPage]);

  return (
    <div 
      ref={sidebarRef}
      data-testid="pages-sidebar"
      className="h-full flex bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 relative"
      style={{ width: `${width}px` }}
    >
      {/* Resize Handle */}
      {onWidthChange && (
        <div
          className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-blue-500/20 transition-colors group z-10"
          onMouseDown={handleMouseDown}
        >
          <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
            <GripHorizontal className="w-3 h-3 text-gray-400" />
          </div>
        </div>
      )}
      
      {/* Sidebar Content */}
      <div className="flex-1 flex flex-col">
      {/* Header with Tabs */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex space-x-1">
            <Button
              size="sm"
              variant={activeTab === 'pages' ? 'default' : 'ghost'}
              onClick={() => handleTabSwitch('pages')}
              className="h-8 px-3"
            >
              <FileText className="w-4 h-4 mr-1" />
              Pages
            </Button>
            <Button
              size="sm"
              variant={activeTab === 'json' ? 'default' : 'ghost'}
              onClick={() => handleTabSwitch('json')}
              className="h-8 px-3"
            >
              <Code className="w-4 h-4 mr-1" />
              JSON
            </Button>
            <Button
              size="sm"
              variant={activeTab === 'field-settings' ? 'default' : 'ghost'}
              onClick={() => handleTabSwitch('field-settings')}
              className="h-8 px-3"
              disabled={!selectedField || !permissions.canEditFields()}
              title={!permissions.canEditFields() ? "View-only mode - field editing disabled" : ""}
            >
              <Settings className="w-4 h-4 mr-1" />
              Field
            </Button>
          </div>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {activeTab === 'pages' 
            ? pages.length > 1 
              ? `${pages.length} pages • Drag fields here to move between pages`
              : `${pages.length} ${pages.length === 1 ? 'page' : 'pages'}`
            : activeTab === 'json'
            ? 'Form Schema Preview'
            : 'Field Properties'
          }
        </p>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'pages' ? (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-2" data-testid="pages-list">
              {pages.map((page, index) => (
                <DraggablePageItem
                  key={`page-item-${page.id}-${index}`}
                  page={page}
                  index={index}
                  isSelected={page.id === selectedPageId}
                  isConnected={isConnected}
                  onSelect={() => onPageSelect(page.id)}
                  onRemove={onRemovePage ? () => onRemovePage(page.id) : undefined}
                  onDuplicate={onDuplicatePage ? () => onDuplicatePage(page.id) : undefined}
                  shouldScrollIntoView={page.id === newlyCreatedPageId}
                />
              ))}
            </div>

            {pages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                  <FileText className="w-6 h-6 text-gray-400" />
                </div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                  No pages yet
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  Start by creating your first page
                </p>
              </div>
            )}
          </div>
        ) : activeTab === 'json' ? (
          <div className="flex-1 overflow-y-auto">
            <JSONPreview 
              pages={pages} 
              layout={layout}
              isShuffleEnabled={isShuffleEnabled}
            />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <FieldSettings
              field={selectedField}
              isConnected={isConnected}
              onUpdate={onFieldUpdate}
            />
          </div>
        )}
      </div>

      {/* Fixed Add Page Button at Bottom - Only show for users who can add pages */}
      {activeTab === 'pages' && permissions.canAddPages() && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <Button
            size="sm"
            onClick={handleAddPage}
            disabled={!isConnected}
            className="w-full"
            data-testid="add-page-button"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Page
          </Button>
        </div>
      )}
      </div>
    </div>
  );
};

export default PagesSidebar;

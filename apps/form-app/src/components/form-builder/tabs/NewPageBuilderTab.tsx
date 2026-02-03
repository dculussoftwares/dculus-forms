import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ScrollArea, FieldPreview } from '@dculus/ui';
import {
  FormPage,
  FormField,
  FillableFormField,
} from '@dculus/types';
import { useFormBuilderStore } from '../../../store/useFormBuilderStore';
import { useTranslation } from '../../../hooks';
import FieldSettingsV2 from '../FieldSettingsV2';
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  useDndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  GripVertical,
  Trash2,
  StickyNote,
  Plus,
  Settings,
  Copy,
  ArrowUp,
  ArrowDown,
  Code,
  GripHorizontal,
  Type,
  FileText,
  Mail,
  Hash,
  ChevronDown,
  Circle,
  CheckSquare,
  Calendar,
  FileCode,
} from 'lucide-react';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { DraggablePageItem } from '../DraggablePageItem';
import { useFormPermissions } from '../../../hooks/useFormPermissions';
import { FieldTypesPanel, FieldTypeDisplay, type FieldTypeConfig } from '../FieldTypesPanel';
import { JSONPreview } from '../JSONPreview';
import { PageActionsSelector } from '../PageActionsSelector';

// =============================================================================
// Field Type Configuration
// =============================================================================

/**
 * Helper to get field type icon and category for display
 */
const getFieldTypeConfig = (type: string): { icon: React.ElementType; category: string; label: string } => {
  const configs: Record<string, { icon: React.ElementType; category: string; label: string }> = {
    text_input_field: { icon: Type, category: 'input', label: 'Short Text' },
    text_area_field: { icon: FileText, category: 'input', label: 'Long Text' },
    email_field: { icon: Mail, category: 'input', label: 'Email' },
    number_field: { icon: Hash, category: 'input', label: 'Number' },
    select_field: { icon: ChevronDown, category: 'choice', label: 'Dropdown' },
    radio_field: { icon: Circle, category: 'choice', label: 'Multiple Choice' },
    checkbox_field: { icon: CheckSquare, category: 'choice', label: 'Checkboxes' },
    date_field: { icon: Calendar, category: 'input', label: 'Date' },
    rich_text_field: { icon: FileCode, category: 'content', label: 'Rich Text' },
  };
  return configs[type] || { icon: Type, category: 'input', label: 'Unknown' };
};

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'input':
      return 'bg-blue-500/10 text-blue-600 dark:text-blue-400';
    case 'choice':
      return 'bg-purple-500/10 text-purple-600 dark:text-purple-400';
    case 'content':
      return 'bg-green-500/10 text-green-600 dark:text-green-400';
    default:
      return 'bg-gray-500/10 text-gray-600 dark:text-gray-400';
  }
};

// =============================================================================
// Sub-Components
// =============================================================================

/**
 * LeftSidebar - Shows available field types using shared FieldTypesPanel
 */
const LeftSidebar: React.FC = () => {
  return (
    <div className="w-80 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <FieldTypesPanel />
    </div>
  );
};

/**
 * RightSidebar - Shows field settings, pages, and JSON preview with resizable width
 */
const RightSidebar: React.FC<{
  width: number;
  onWidthChange: (width: number) => void;
}> = ({ width, onWidthChange }) => {
  const { t } = useTranslation('newPageBuilderTab');
  const [activeTab, setActiveTab] = useState<'pages' | 'properties' | 'json'>('pages');
  const [isResizing, setIsResizing] = useState(false);
  const prevSelectedFieldIdRef = useRef<string | null>(null);

  const {
    selectedFieldId,
    updateField,
    removeField,
    isConnected,
    pages,
    selectedPageId,
    layout,
    isShuffleEnabled,
    setSelectedPage,
    setSelectedField,
    addEmptyPage,
    removePage,
    duplicatePage,
    updatePageTitle,
  } = useFormBuilderStore();

  const permissions = useFormPermissions();

  const selectedField = useFormBuilderStore((state) => {
    if (!selectedFieldId) return null;
    for (const page of state.pages) {
      const field = page.fields.find((f) => f.id === selectedFieldId);
      if (field) return field;
    }
    return null;
  });

  // Auto-switch to properties when a field is newly selected (but not on field move)
  React.useEffect(() => {
    if (selectedFieldId && selectedFieldId !== prevSelectedFieldIdRef.current) {
      // Switch to properties when a different field is selected
      setActiveTab('properties');
    }
    prevSelectedFieldIdRef.current = selectedFieldId;
  }, [selectedFieldId]);

  const handleUpdate = (updates: Record<string, unknown>) => {
    if (selectedFieldId) {
      const pageWithField = pages.find((page) =>
        page.fields.some((f) => f.id === selectedFieldId)
      );
      if (pageWithField) {
        updateField(pageWithField.id, selectedFieldId, updates);
      }
    }
  };

  const handleDelete = () => {
    if (selectedFieldId) {
      const pageWithField = pages.find((page) =>
        page.fields.some((f) => f.id === selectedFieldId)
      );
      if (pageWithField) {
        removeField(pageWithField.id, selectedFieldId);
        setSelectedField(null);
      }
    }
  };

  const handleAddPage = () => {
    if (permissions.canAddPages() && isConnected) {
      addEmptyPage();
    }
  };

  // Resize handle functionality
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
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

  return (
    <div
      className="border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col relative"
      style={{ width: `${width}px` }}
    >
      {/* Resize handle */}
      <div
        className={`
          absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500/50
          ${isResizing ? 'bg-blue-500' : ''}
        `}
        onMouseDown={handleMouseDown}
      >
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <GripHorizontal className="w-4 h-4 text-gray-400 rotate-90" />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('pages')}
          className={`
            flex-1 flex items-center justify-center py-3 text-sm font-medium transition-colors
            ${
              activeTab === 'pages'
                ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }
          `}
        >
          <StickyNote className="w-4 h-4 mr-2" />
          {t('sidebar.pages.title')}
        </button>
        <button
          onClick={() => setActiveTab('properties')}
          className={`
            flex-1 flex items-center justify-center py-3 text-sm font-medium transition-colors
            ${
              activeTab === 'properties'
                ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }
          `}
        >
          <Settings className="w-4 h-4 mr-2" />
          {t('tabs.field')}
        </button>
        <button
          onClick={() => setActiveTab('json')}
          className={`
            flex-1 flex items-center justify-center py-3 text-sm font-medium transition-colors
            ${
              activeTab === 'json'
                ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }
          `}
        >
          <Code className="w-4 h-4 mr-2" />
          JSON
        </button>
      </div>

      <ScrollArea className="flex-1">
        {activeTab === 'pages' ? (
          /* Pages Tab Content */
          <div className="p-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {t('sidebar.pages.pageCount', {
                  values: { count: pages.length },
                })}
              </div>
              {permissions.canAddPages() && (
                <button
                  onClick={handleAddPage}
                  disabled={!isConnected}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors text-blue-600 dark:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={t('menu.addPage')}
                >
                  <Plus className="w-5 h-5" />
                </button>
              )}
            </div>

            <SortableContext
              items={pages.map((p) => p.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {pages.map((page, index) => (
                  <DraggablePageItem
                    key={page.id}
                    page={page}
                    index={index}
                    isSelected={selectedPageId === page.id}
                    isConnected={isConnected}
                    onSelect={() => setSelectedPage(page.id)}
                    onRemove={() => removePage(page.id)}
                    onDuplicate={() => duplicatePage(page.id)}
                    onUpdateTitle={(title) => updatePageTitle(page.id, title)}
                  />
                ))}
              </div>
            </SortableContext>

            {pages.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                {t('sidebar.pages.noPages')}
                {permissions.canAddPages() && (
                  <button
                    onClick={handleAddPage}
                    className="mt-2 text-blue-600 dark:text-blue-400 text-sm font-medium hover:underline"
                  >
                    Create your first page
                  </button>
                )}
              </div>
            )}
          </div>
        ) : activeTab === 'properties' ? (
          /* Properties Tab Content */
          <div className="h-full flex flex-col">
            {selectedField ? (
              <FieldSettingsV2
                field={selectedField}
                isConnected={isConnected}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400 p-8 text-center">
                <Settings className="w-12 h-12 mb-4 opacity-20" />
                <p>{t('emptyState.title')}</p>
              </div>
            )}
          </div>
        ) : (
          /* JSON Tab Content */
          <div className="h-full">
            <JSONPreview
              pages={pages}
              layout={layout}
              isShuffleEnabled={isShuffleEnabled}
            />
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

/**
 * FieldCard - Displays a single existing field with optional drag handle
 */
const FieldCard: React.FC<{
  field: FormField;
  pageId: string;
  index: number;
  totalFields: number;
  pages: FormPage[];
  isDragging?: boolean;
  isSelected?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  onClick?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onMoveToPage?: (targetPageId: string) => void;
  onCopyToPage?: (targetPageId: string) => void;
  isAnyDragActive?: boolean;
  isRecentlyDropped?: boolean;
  isDelayingExpansion?: boolean;
}> = ({
  field,
  pageId,
  index,
  totalFields,
  pages,
  isDragging = false,
  isSelected = false,
  dragHandleProps,
  onClick,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onMoveToPage,
  onCopyToPage,
  isAnyDragActive = false,
  isRecentlyDropped = false,
  isDelayingExpansion = false,
}) => {
  // Get label for fillable fields, or use type name for others
  const label: string =
    'label' in field && typeof field.label === 'string' && field.label
      ? field.label
      : field.type.replace(/_/g, ' ').toLowerCase();

  // Get field type config for icon and category
  const typeConfig = getFieldTypeConfig(field.type);
  const Icon = typeConfig.icon;
  const categoryColor = getCategoryColor(typeConfig.category);

  // Show compact view when any drag is active OR during expansion delay
  const shouldShowCompact = isAnyDragActive || isDelayingExpansion;

  return (
    <div
      onClick={onClick}
      className={`
        p-4 bg-white dark:bg-gray-800 border rounded-lg transition-all duration-200 group
        ${
          isDragging
            ? 'border-blue-400 bg-blue-50/50 dark:bg-blue-950/30 opacity-50 shadow-lg'
            : isRecentlyDropped
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/50 ring-2 ring-blue-500 animate-pulse shadow-lg'
              : isSelected
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/50 ring-2 ring-blue-500/20 shadow-md'
              : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm cursor-pointer'
        }
      `}
      data-testid={`field-${field.id}`}
    >
      {/* Compact view when any drag is active */}
      {shouldShowCompact ? (
        <div className="flex items-center gap-3 w-full">
          {/* Drag handle */}
          <div
            {...dragHandleProps}
            className="flex-shrink-0 p-1 -ml-2 cursor-grab hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="Drag to reorder"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-4 h-4 text-gray-400 dark:text-gray-500" />
          </div>

          {/* Field type icon badge */}
          <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${categoryColor}`}>
            <Icon className="w-4 h-4" />
          </div>

          {/* Field info */}
          <div className="flex-1 min-w-0 max-w-[280px]">
            <div className="text-sm font-medium text-gray-900 dark:text-white truncate flex items-center gap-1">
              <span className="truncate">{label}</span>
              {/* Required indicator - red asterisk */}
              {'validation' in field &&
                (field as FillableFormField).validation?.required && (
                  <span className="text-red-500 text-sm flex-shrink-0" title="Required field">
                    *
                  </span>
                )}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {typeConfig.label}
            </div>
          </div>
        </div>
      ) : (
        /* Full preview when not dragging */
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {/* Drag handle */}
            <div
              {...dragHandleProps}
              className="flex-shrink-0 p-1 -ml-2 cursor-grab hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              title="Drag to reorder"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            </div>

            {/* Field type icon badge */}
            <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${categoryColor}`}>
              <Icon className="w-4 h-4" />
            </div>

            {/* Field info */}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 dark:text-white truncate flex items-center gap-1">
                <span className="truncate">{label}</span>
                {/* Required indicator - red asterisk */}
                {'validation' in field &&
                  (field as FillableFormField).validation?.required && (
                    <span className="text-red-500 text-sm flex-shrink-0" title="Required field">
                      *
                    </span>
                  )}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {typeConfig.label}
              </div>
            </div>
          </div>

          {/* Field Preview */}
          <div className="pl-9 pr-2">
            <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-md border border-gray-200 dark:border-gray-700">
              <FieldPreview
                field={field}
                disabled={true}
                showValidation={false}
              />
            </div>
          </div>

          {/* Actions - only show on hover */}
          <div className="pl-9 pr-2">
            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {onMoveUp && index > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onMoveUp();
                  }}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-md transition-all"
                  title="Move Up"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
              )}

              {onMoveDown && index < totalFields - 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onMoveDown();
                  }}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-md transition-all"
                  title="Move Down"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
              )}

              {onDuplicate && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicate();
                  }}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-md transition-all"
                  title="Duplicate Field"
                >
                  <Copy className="w-4 h-4" />
                </button>
              )}
              
              {/* Cross-page actions menu */}
              {pages.length > 1 && onMoveToPage && onCopyToPage && (
                <PageActionsSelector
                  pages={pages}
                  currentPageId={pageId}
                  triggerElement={
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-md transition-all"
                      title="Move/Copy to another page"
                    >
                      <ArrowUp className="w-4 h-4 rotate-90" />
                    </button>
                  }
                  onMoveToPage={onMoveToPage}
                  onCopyToPage={onCopyToPage}
                />
              )}

              {onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md transition-all"
                  title="Delete field"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * DraggableFieldCard - Wrapper that makes FieldCard draggable via grip handle
 */
const DraggableFieldCard: React.FC<{
  field: FormField;
  index: number;
  pageId: string;
  totalFields: number;
  isRecentlyDropped?: boolean;
  isDelayingExpansion?: boolean;
}> = ({ field, index, pageId, totalFields, isRecentlyDropped = false, isDelayingExpansion = false }) => {
  const {
    selectedFieldId,
    setSelectedField,
    removeField,
    duplicateField,
    reorderFields,
    moveFieldBetweenPages,
    copyFieldToPage,
    pages,
  } = useFormBuilderStore();
  
  // Detect if ANY drag is active
  const { active } = useDndContext();
  const isAnyDragActive = !!active;
  
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `existing-field-${field.id}`,
    data: {
      type: 'existing-field',
      field,
      pageId,
      index,
    },
  });

  const isSelected = selectedFieldId === field.id;

  const handleClick = () => {
    setSelectedField(field.id);
  };

  const handleDelete = () => {
    removeField(pageId, field.id);
    if (isSelected) {
      setSelectedField(null);
    }
  };

  const handleDuplicate = () => {
    duplicateField(pageId, field.id);
  };

  const handleMoveUp = () => {
    if (index > 0) {
      reorderFields(pageId, index, index - 1);
    }
  };

  const handleMoveDown = () => {
    if (index < totalFields - 1) {
      reorderFields(pageId, index, index + 1);
    }
  };

  const handleMoveToPage = (targetPageId: string) => {
    moveFieldBetweenPages(pageId, targetPageId, field.id);
  };

  const handleCopyToPage = (targetPageId: string) => {
    copyFieldToPage(pageId, targetPageId, field.id);
  };

  return (
    <div ref={setNodeRef}>
      <FieldCard
        field={field}
        pageId={pageId}
        index={index}
        totalFields={totalFields}
        pages={pages}
        isDragging={isDragging}
        isSelected={isSelected}
        isAnyDragActive={isAnyDragActive}
        isRecentlyDropped={isRecentlyDropped}
        isDelayingExpansion={isDelayingExpansion}
        dragHandleProps={{ ...attributes, ...listeners }}
        onClick={handleClick}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        onMoveUp={index > 0 ? handleMoveUp : undefined}
        onMoveDown={index < totalFields - 1 ? handleMoveDown : undefined}
        onMoveToPage={handleMoveToPage}
        onCopyToPage={handleCopyToPage}
      />
    </div>
  );
};

/**
 * EmptyFormAreaPlaceholder - Shows when no fields exist
 */
const EmptyFormAreaPlaceholder: React.FC<{ isConnected: boolean }> = ({
  isConnected,
}) => {
  const { t } = useTranslation('newPageBuilderTab');

  return (
    <div className="flex items-center justify-center h-full min-h-[200px] text-gray-500 dark:text-gray-400">
      <div className="text-center">
        <p className="text-lg font-medium">{t('formArea.placeholder')}</p>
        <ConnectionStatus isConnected={isConnected} />
        <p className="text-sm mt-2">Drag a field type here to add it</p>
      </div>
    </div>
  );
};

/**
 * DropIndicator - A drop zone between fields for inserting new fields
 */
const DropIndicator: React.FC<{
  index: number;
  pageId: string;
}> = ({ index, pageId }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `drop-indicator-${pageId}-${index}`,
    data: {
      type: 'field-insert',
      pageId,
      insertIndex: index,
    },
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

/**
 * FieldListWithDropZones - Renders fields with drop indicators between them
 */
const FieldListWithDropZones: React.FC<{
  fields: FormField[];
  pageId: string;
  recentlyDroppedFieldId?: string | null;
  isDelayingExpansion?: boolean;
}> = ({ fields, pageId, recentlyDroppedFieldId, isDelayingExpansion = false }) => {
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

/**
 * FormArea - Center column displaying form fields (drop zone)
 */
const FormArea: React.FC<{
  recentlyDroppedFieldId?: string | null;
  isDelayingExpansion?: boolean;
}> = ({ recentlyDroppedFieldId, isDelayingExpansion = false }) => {
  const { isConnected, pages, selectedPageId } = useFormBuilderStore();
  const selectedPage = pages.find((p) => p.id === selectedPageId);

  // Make the form area a drop zone
  const { setNodeRef, isOver } = useDroppable({
    id: 'form-area-drop-zone',
    data: {
      type: 'form-area',
      pageId: selectedPageId,
    },
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
                    : 'border-gray-300 dark:border-gray-600'
                }
              `}
              data-testid="form-fields-area"
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
 * NewPageBuilderTab - Reimplemented page builder with stable drag-and-drop and all features from old PageBuilderTab
 */
export const NewPageBuilderTab: React.FC = () => {
  // Track the currently dragged field type (from sidebar)
  const [activeFieldType, setActiveFieldType] =
    useState<FieldTypeConfig | null>(null);

  // Track the currently dragged existing field (for reordering)
  const [activeField, setActiveField] = useState<{
    field: FormField;
    index: number;
    pageId: string;
  } | null>(null);

  // Resizable sidebar width
  const [sidebarWidth, setSidebarWidth] = useState(320);

  // Track recently dropped field for highlight animation
  const [recentlyDroppedFieldId, setRecentlyDroppedFieldId] = useState<string | null>(null);
  
  // Delay compact view exit after drop
  const [isDelayingExpansion, setIsDelayingExpansion] = useState(false);

  // Get store actions including cross-page operations
  const {
    addField,
    addFieldAtIndex,
    reorderFields,
    reorderPages,
    moveFieldBetweenPages,
    pages,
  } = useFormBuilderStore();

  // Configure sensors - require slight movement before drag starts
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px movement to start drag
      },
    })
  );

  // Auto-scroll to recently dropped field for better UX
  useEffect(() => {
    if (recentlyDroppedFieldId) {
      // Delay scroll until after expansion completes (400ms expansion + 100ms buffer)
      const scrollTimeout = setTimeout(() => {
        const fieldElement = document.querySelector(
          `[data-testid="field-${recentlyDroppedFieldId}"]`
        );
        
        if (fieldElement) {
          fieldElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest',
          });
        }
      }, 500); // Scroll after expansion completes

      return () => clearTimeout(scrollTimeout);
    }
  }, [recentlyDroppedFieldId]);

  // Handle drag start - store the active dragged item
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    if (active.data.current?.type === 'field-type') {
      setActiveFieldType(active.data.current.fieldType as FieldTypeConfig);
    } else if (active.data.current?.type === 'existing-field') {
      setActiveField({
        field: active.data.current.field as FormField,
        index: active.data.current.index as number,
        pageId: active.data.current.pageId as string,
      });
    }
  };

  // Handle drag end - add field, reorder, or move between pages
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    // Track which field was dropped for highlighting
    let droppedFieldId: string | null = null;

    // Start delayed expansion
    setIsDelayingExpansion(true);

    // Check if we have a valid drop target
    if (!over) {
      // No valid drop - clear expansion delay after a short time
      setTimeout(() => {
        setActiveFieldType(null);
        setActiveField(null);
        setIsDelayingExpansion(false);
      }, 300);
      return;
    }

    const dragType = active.data.current?.type;

    // Handle page reordering
    if (dragType === 'page-item') {
      if (active.id !== over.id) {
        const oldIndex = pages.findIndex((p) => p.id === active.id);
        const newIndex = pages.findIndex((p) => p.id === over.id);

        if (oldIndex !== -1 && newIndex !== -1) {
          reorderPages(oldIndex, newIndex);
        }
      }
      // Clear state and exit expansion delay
      setTimeout(() => {
        setActiveFieldType(null);
        setActiveField(null);
        setIsDelayingExpansion(false);
      }, 300);
      return;
    }

    // Handle existing-field reordering and cross-page moves
    if (dragType === 'existing-field') {
      const sourceIndex = active.data.current?.index as number;
      const sourcePageId = active.data.current?.pageId as string;
      droppedFieldId = active.data.current?.field?.id as string;

      // Dropped on a field-insert zone
      if (over.data.current?.type === 'field-insert') {
        const targetPageId = over.data.current.pageId as string;
        let targetIndex = over.data.current.insertIndex as number;

        if (sourcePageId === targetPageId) {
          // Same page - reorder
          if (targetIndex > sourceIndex) {
            targetIndex = targetIndex - 1;
          }

          if (sourceIndex !== targetIndex) {
            console.log(
              `Reordering field from ${sourceIndex} to ${targetIndex}`
            );
            reorderFields(sourcePageId, sourceIndex, targetIndex);
          }
        } else {
          // Cross-page move
          console.log(
            `Moving field ${droppedFieldId} from page ${sourcePageId} to page ${targetPageId} at index ${targetIndex}`
          );
          moveFieldBetweenPages(sourcePageId, targetPageId, droppedFieldId, targetIndex);
        }
      }
      
      // Set highlight and clear state after delay
      if (droppedFieldId) {
        setRecentlyDroppedFieldId(droppedFieldId);
        setTimeout(() => setRecentlyDroppedFieldId(null), 2000); // Keep highlight for 2s
      }
      
      setTimeout(() => {
        setActiveFieldType(null);
        setActiveField(null);
        setIsDelayingExpansion(false);
      }, 400); // 400ms delay before expansion
      return;
    }

    // Handle new field-type drops
    if (dragType === 'field-type') {
      const fieldTypeConfig = active.data.current?.fieldType as FieldTypeConfig;

      // Check if dropping onto a field-insert zone (between fields)
      if (over.data.current?.type === 'field-insert') {
        const targetPageId = over.data.current.pageId as string;
        const insertIndex = over.data.current.insertIndex as number;

        if (targetPageId && fieldTypeConfig) {
          console.log(
            `Inserting field ${fieldTypeConfig.type} at index ${insertIndex} in page ${targetPageId}`
          );
          addFieldAtIndex(targetPageId, fieldTypeConfig.type, {}, insertIndex);
          
          // Find the newly added field ID (it will be the last one added)
          setTimeout(() => {
            const targetPage = pages.find(p => p.id === targetPageId);
            if (targetPage && targetPage.fields[insertIndex]) {
              const newFieldId = targetPage.fields[insertIndex].id;
              setRecentlyDroppedFieldId(newFieldId);
              setTimeout(() => setRecentlyDroppedFieldId(null), 2000);
            }
          }, 50);
        }
        
        setTimeout(() => {
          setActiveFieldType(null);
          setActiveField(null);
          setIsDelayingExpansion(false);
        }, 400);
        return;
      }

      // Check if dropping onto the form area (append to end)
      if (over.data.current?.type === 'form-area') {
        const targetPageId = over.data.current.pageId as string;

        if (targetPageId && fieldTypeConfig) {
          console.log(
            `Adding field ${fieldTypeConfig.type} to end of page ${targetPageId}`
          );
          addField(targetPageId, fieldTypeConfig.type, {});
          
          // Find the newly added field ID
          setTimeout(() => {
            const targetPage = pages.find(p => p.id === targetPageId);
            if (targetPage && targetPage.fields.length > 0) {
              const newFieldId = targetPage.fields[targetPage.fields.length - 1].id;
              setRecentlyDroppedFieldId(newFieldId);
              setTimeout(() => setRecentlyDroppedFieldId(null), 2000);
            }
          }, 50);
        }
        
        setTimeout(() => {
          setActiveFieldType(null);
          setActiveField(null);
          setIsDelayingExpansion(false);
        }, 400);
      }
    }
    
    // Fallback: clear state after delay
    setTimeout(() => {
      setActiveFieldType(null);
      setActiveField(null);
      setIsDelayingExpansion(false);
    }, 400);
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full" data-testid="new-page-builder-tab">
        {/* Left: Field Types */}
        <LeftSidebar />

        {/* Center: Form Area */}
        <FormArea 
          recentlyDroppedFieldId={recentlyDroppedFieldId} 
          isDelayingExpansion={isDelayingExpansion}
        />

        {/* Right: Field Settings with Resizable Width */}
        <RightSidebar width={sidebarWidth} onWidthChange={setSidebarWidth} />
      </div>

      {/* Drag Overlay - follows cursor during drag */}
      <DragOverlay dropAnimation={null}>
        {activeFieldType && (
          <div className="w-72">
            <FieldTypeDisplay fieldType={activeFieldType} isOverlay />
          </div>
        )}
        {activeField && (
          <div className="w-[400px] pointer-events-none opacity-90">
            <FieldCard
              field={activeField.field}
              pageId={activeField.pageId} 
              index={activeField.index}
              totalFields={1}
              pages={[]}
              isDragging={true}
              isAnyDragActive={true}
              dragHandleProps={{}}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
};

export default NewPageBuilderTab;

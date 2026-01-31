import React, { useState } from 'react';
import { ScrollArea } from '@dculus/ui';
import {
  FormPage,
  FieldType,
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
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  Type,
  FileText,
  Mail,
  Hash,
  ChevronDown,
  Circle,
  CheckSquare,
  Calendar,
  FileCode,
  GripVertical,
  Trash2,
  Layers,
  StickyNote,
  Plus,
  Settings,
  Copy,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { DraggablePageItem } from '../DraggablePageItem';
import { useFormPermissions } from '../../../hooks/useFormPermissions';

// =============================================================================
// Types
// =============================================================================

// =============================================================================
// Sub-Components
// =============================================================================

// =============================================================================
// Field Types Configuration
// =============================================================================

interface FieldTypeConfig {
  type: FieldType;
  label: string;
  description: string;
  icon: React.ReactNode;
  category: 'input' | 'choice' | 'content';
}

const FIELD_TYPES: FieldTypeConfig[] = [
  // Input Fields
  {
    type: FieldType.TEXT_INPUT_FIELD,
    label: 'Short Text',
    description: 'Single line text input',
    icon: <Type className="w-5 h-5" />,
    category: 'input',
  },
  {
    type: FieldType.TEXT_AREA_FIELD,
    label: 'Long Text',
    description: 'Multi-line text area',
    icon: <FileText className="w-5 h-5" />,
    category: 'input',
  },
  {
    type: FieldType.EMAIL_FIELD,
    label: 'Email',
    description: 'Email address input',
    icon: <Mail className="w-5 h-5" />,
    category: 'input',
  },
  {
    type: FieldType.NUMBER_FIELD,
    label: 'Number',
    description: 'Numeric input',
    icon: <Hash className="w-5 h-5" />,
    category: 'input',
  },
  {
    type: FieldType.DATE_FIELD,
    label: 'Date',
    description: 'Date picker',
    icon: <Calendar className="w-5 h-5" />,
    category: 'input',
  },
  // Choice Fields
  {
    type: FieldType.SELECT_FIELD,
    label: 'Dropdown',
    description: 'Single choice dropdown',
    icon: <ChevronDown className="w-5 h-5" />,
    category: 'choice',
  },
  {
    type: FieldType.RADIO_FIELD,
    label: 'Radio',
    description: 'Single choice options',
    icon: <Circle className="w-5 h-5" />,
    category: 'choice',
  },
  {
    type: FieldType.CHECKBOX_FIELD,
    label: 'Checkbox',
    description: 'Multiple choice options',
    icon: <CheckSquare className="w-5 h-5" />,
    category: 'choice',
  },
  // Content Fields
  {
    type: FieldType.RICH_TEXT_FIELD,
    label: 'Rich Text',
    description: 'Formatted content block',
    icon: <FileCode className="w-5 h-5" />,
    category: 'content',
  },
];

const CATEGORY_STYLES = {
  input: {
    label: 'Input',
    iconBg: 'bg-blue-100 dark:bg-blue-900/50',
    iconText: 'text-blue-600 dark:text-blue-400',
  },
  choice: {
    label: 'Choice',
    iconBg: 'bg-purple-100 dark:bg-purple-900/50',
    iconText: 'text-purple-600 dark:text-purple-400',
  },
  content: {
    label: 'Content',
    iconBg: 'bg-green-100 dark:bg-green-900/50',
    iconText: 'text-green-600 dark:text-green-400',
  },
};

/**
 * FieldTypeCardContent - Display content of a field type card
 */
const FieldTypeCardContent: React.FC<{
  fieldType: FieldTypeConfig;
  isDragging?: boolean;
  isOverlay?: boolean;
}> = ({ fieldType, isDragging = false, isOverlay = false }) => {
  const categoryStyle = CATEGORY_STYLES[fieldType.category];

  return (
    <div
      className={`
        p-3 border-2 border-dashed rounded-lg transition-all duration-200 group
        ${
          isOverlay
            ? 'border-blue-500 bg-white dark:bg-gray-800 shadow-xl cursor-grabbing'
            : isDragging
              ? 'border-blue-400 bg-blue-50/50 dark:bg-blue-950/30 opacity-50'
              : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 cursor-grab'
        }
      `}
      data-testid={`field-type-${fieldType.type}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`p-2 rounded-lg ${categoryStyle.iconBg} ${categoryStyle.iconText}
                      ${!isDragging && !isOverlay ? 'group-hover:scale-110' : ''} transition-transform duration-200`}
        >
          {fieldType.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div
            className={`text-sm font-medium ${isOverlay ? 'text-gray-900 dark:text-white' : 'text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400'}`}
          >
            {fieldType.label}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {fieldType.description}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * DraggableFieldTypeCard - Wrapper that makes field type cards draggable
 */
const DraggableFieldTypeCard: React.FC<{ fieldType: FieldTypeConfig }> = ({
  fieldType,
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `field-type-${fieldType.type}`,
    data: {
      type: 'field-type',
      fieldType,
    },
  });

  return (
    <div ref={setNodeRef} {...attributes} {...listeners}>
      <FieldTypeCardContent fieldType={fieldType} isDragging={isDragging} />
    </div>
  );
};

/**
 * LeftSidebar - Tabbed sidebar for Components and Pages
 */
/**
 * LeftSidebar - Shows available field types to drag and drop
 */
const LeftSidebar: React.FC = () => {
  const { t } = useTranslation('newPageBuilderTab');

  // Group field types by category
  const inputFields = FIELD_TYPES.filter((f) => f.category === 'input');
  const choiceFields = FIELD_TYPES.filter((f) => f.category === 'choice');
  const contentFields = FIELD_TYPES.filter((f) => f.category === 'content');

  return (
    <div className="w-64 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2 text-gray-900 dark:text-white mb-1">
          <Layers className="w-5 h-5" />
          <h2 className="text-sm font-semibold uppercase tracking-wider">
            {t('sidebar.fieldTypes.title')}
          </h2>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-6">
          {/* Input Fields */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              {CATEGORY_STYLES.input.label}
            </h3>
            <div className="space-y-2">
              {inputFields.map((fieldType) => (
                <DraggableFieldTypeCard
                  key={fieldType.type}
                  fieldType={fieldType}
                />
              ))}
            </div>
          </div>

          {/* Choice Fields */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              {CATEGORY_STYLES.choice.label}
            </h3>
            <div className="space-y-2">
              {choiceFields.map((fieldType) => (
                <DraggableFieldTypeCard
                  key={fieldType.type}
                  fieldType={fieldType}
                />
              ))}
            </div>
          </div>

          {/* Content Fields */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              {CATEGORY_STYLES.content.label}
            </h3>
            <div className="space-y-2">
              {contentFields.map((fieldType) => (
                <DraggableFieldTypeCard
                  key={fieldType.type}
                  fieldType={fieldType}
                />
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

/**
 * RightSidebar - Shows field settings when a field is selected
 */
const RightSidebar: React.FC = () => {
  const { t } = useTranslation('newPageBuilderTab');
  const [activeTab, setActiveTab] = useState<'pages' | 'properties'>('pages');

  const {
    selectedFieldId,
    updateField,
    removeField,
    isConnected,
    pages,
    selectedPageId,
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

  // Auto-switch to properties when a field is selected
  React.useEffect(() => {
    if (selectedFieldId) {
      setActiveTab('properties');
    }
  }, [selectedFieldId]);

  const handleUpdate = (updates: Record<string, any>) => {
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

  return (
    <div className="w-80 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col">
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
        ) : (
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
  index: number;
  isDragging?: boolean;
  isSelected?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  onClick?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}> = ({
  field,
  index,
  isDragging = false,
  isSelected = false,
  dragHandleProps,
  onClick,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
}) => {
  // Get label for fillable fields, or use type name for others
  const label: string =
    'label' in field && typeof field.label === 'string' && field.label
      ? field.label
      : field.type.replace(/_/g, ' ').toLowerCase();

  // Get the icon for this field type
  const fieldTypeConfig = FIELD_TYPES.find((ft) => ft.type === field.type);
  const icon = fieldTypeConfig?.icon || <Type className="w-5 h-5" />;
  const categoryStyle = fieldTypeConfig
    ? CATEGORY_STYLES[fieldTypeConfig.category]
    : CATEGORY_STYLES.input;

  return (
    <div
      onClick={onClick}
      className={`
        p-4 bg-white dark:bg-gray-800 border rounded-lg transition-all duration-200 group
        ${
          isDragging
            ? 'border-blue-400 bg-blue-50/50 dark:bg-blue-950/30 opacity-50 shadow-lg'
            : isSelected
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/50 ring-2 ring-blue-500/20 shadow-md'
              : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm cursor-pointer'
        }
      `}
      data-testid={`field-${field.id}`}
    >
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

        {/* Field number badge */}
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs flex items-center justify-center font-medium">
          {index + 1}
        </div>

        {/* Field icon */}
        <div
          className={`p-2 rounded-lg ${categoryStyle.iconBg} ${categoryStyle.iconText}`}
        >
          {icon}
        </div>

        {/* Field info */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {label}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {field.type.replace(/_/g, ' ')}
          </div>
        </div>

        {/* Required indicator */}
        {'validation' in field &&
          (field as FillableFormField).validation?.required && (
            <span className="text-xs text-red-500 font-medium mr-2">
              Required
            </span>
          )}

        {/* Actions - only show on hover if not dragging */}
        {!isDragging && (
          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onMoveUp && (
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

            {onMoveDown && (
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
        )}
      </div>
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
}> = ({ field, index, pageId, totalFields }) => {
  const {
    selectedFieldId,
    setSelectedField,
    removeField,
    duplicateField,
    reorderFields,
  } = useFormBuilderStore();
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

  return (
    <div ref={setNodeRef}>
      <FieldCard
        field={field}
        index={index}
        isDragging={isDragging}
        isSelected={isSelected}
        dragHandleProps={{ ...attributes, ...listeners }}
        onClick={handleClick}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        onMoveUp={index > 0 ? handleMoveUp : undefined}
        onMoveDown={index < totalFields - 1 ? handleMoveDown : undefined}
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
}> = ({ fields, pageId }) => {
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
const FormArea: React.FC = () => {
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
 * NewPageBuilderTab - Reimplemented page builder with stable drag-and-drop.
 * Each phase adds functionality incrementally for thorough testing.
 */
export const NewPageBuilderTab: React.FC = () => {
  // Track the currently dragged field type (from sidebar)
  const [activeFieldType, setActiveFieldType] =
    useState<FieldTypeConfig | null>(null);

  // Track the currently dragged existing field (for reordering)
  const [activeField, setActiveField] = useState<{
    field: FormField;
    index: number;
  } | null>(null);

  // Get store actions
  const { addField, addFieldAtIndex, reorderFields, reorderPages, pages } =
    useFormBuilderStore();

  // Configure sensors - require slight movement before drag starts
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px movement to start drag
      },
    })
  );

  // Handle drag start - store the active dragged item
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    if (active.data.current?.type === 'field-type') {
      setActiveFieldType(active.data.current.fieldType as FieldTypeConfig);
    } else if (active.data.current?.type === 'existing-field') {
      setActiveField({
        field: active.data.current.field as FormField,
        index: active.data.current.index as number,
      });
    }
  };

  // Handle drag end - add field or reorder existing fields
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    // Always clear the active items
    setActiveFieldType(null);
    setActiveField(null);

    // Check if we have a valid drop target
    if (!over) return;

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
      return;
    }

    // Handle existing-field reordering
    if (dragType === 'existing-field') {
      const sourceIndex = active.data.current?.index as number;
      const sourcePageId = active.data.current?.pageId as string;

      // Dropped on a field-insert zone
      if (over.data.current?.type === 'field-insert') {
        const targetPageId = over.data.current.pageId as string;
        let targetIndex = over.data.current.insertIndex as number;

        // Only reorder within the same page for now
        if (sourcePageId === targetPageId) {
          // Adjust target index if moving down (since we remove first)
          if (targetIndex > sourceIndex) {
            targetIndex = targetIndex - 1;
          }

          if (sourceIndex !== targetIndex) {
            console.log(
              `Reordering field from ${sourceIndex} to ${targetIndex}`
            );
            reorderFields(sourcePageId, sourceIndex, targetIndex);
          }
        }
      }
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
        }
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
        }
      }
    }
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full" data-testid="new-page-builder-tab">
        {/* Left: Field Types & Pages */}
        <LeftSidebar />

        {/* Center: Form Area */}
        <FormArea />

        {/* Right: Field Settings */}
        <RightSidebar />
      </div>

      {/* Drag Overlay - follows cursor during drag */}
      <DragOverlay dropAnimation={null}>
        {activeFieldType && (
          <div className="w-72">
            <FieldTypeCardContent fieldType={activeFieldType} isOverlay />
          </div>
        )}
        {activeField && (
          <div className="w-[500px] max-w-[90vw] pointer-events-none">
            <FieldCard
              field={activeField.field}
              index={activeField.index}
              isDragging={false}
              dragHandleProps={{}}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
};

export default NewPageBuilderTab;

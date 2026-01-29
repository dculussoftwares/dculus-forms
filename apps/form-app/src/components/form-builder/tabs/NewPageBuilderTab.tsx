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
} from 'lucide-react';

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
 * FieldTypesSidebar - Left column displaying available field types
 */
const FieldTypesSidebar: React.FC = () => {
  const { t } = useTranslation('newPageBuilderTab');

  // Group field types by category
  const inputFields = FIELD_TYPES.filter((f) => f.category === 'input');
  const choiceFields = FIELD_TYPES.filter((f) => f.category === 'choice');
  const contentFields = FIELD_TYPES.filter((f) => f.category === 'content');

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
 * FieldCard - Displays a single existing field (read-only for now)
 */
const FieldCard: React.FC<{ field: FormField; index: number }> = ({
  field,
  index,
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
      className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg
                 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm
                 transition-all duration-200 group"
      data-testid={`field-${field.id}`}
    >
      <div className="flex items-center gap-3">
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
            <span className="text-xs text-red-500 font-medium">Required</span>
          )}
      </div>
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
        transition-all duration-200
        ${isOver ? 'h-14 py-1' : 'h-1 py-0'}
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
          <FieldCard field={field} index={index} />
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
  // Track the currently dragged field type
  const [activeFieldType, setActiveFieldType] =
    useState<FieldTypeConfig | null>(null);

  // Get store actions
  const { addField, addFieldAtIndex } = useFormBuilderStore();

  // Configure sensors - require slight movement before drag starts
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px movement to start drag
      },
    })
  );

  // Handle drag start - store the active field type
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    if (active.data.current?.type === 'field-type') {
      setActiveFieldType(active.data.current.fieldType as FieldTypeConfig);
    }
  };

  // Handle drag end - add field if dropped on form area
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    // Always clear the active field type
    setActiveFieldType(null);

    // Check if we have a valid drop target
    if (!over) return;

    // Only handle field-type drags
    if (active.data.current?.type !== 'field-type') return;

    const fieldTypeConfig = active.data.current.fieldType as FieldTypeConfig;

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
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full" data-testid="new-page-builder-tab">
        {/* Left: Field Types */}
        <FieldTypesSidebar />

        {/* Center: Form Area */}
        <FormArea />

        {/* Right: Pages */}
        <PagesSidebar />
      </div>

      {/* Drag Overlay - follows cursor during drag */}
      <DragOverlay dropAnimation={null}>
        {activeFieldType && (
          <div className="w-72">
            <FieldTypeCardContent fieldType={activeFieldType} isOverlay />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
};

export default NewPageBuilderTab;

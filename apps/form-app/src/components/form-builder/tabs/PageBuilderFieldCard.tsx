import React from 'react';
import { FieldPreview, Button } from '@dculus/ui';
import { FormField, FormPage, FillableFormField } from '@dculus/types';
import { useFormBuilderStore } from '../../../store/useFormBuilderStore';

import { useFormPermissions } from '../../../hooks/useFormPermissions';
import {
  useDraggable,
  useDndContext,
} from '@dnd-kit/core';
import {
  GripVertical,
  Trash2,
  Settings,
  Copy,
  ArrowUp,
  ArrowDown,
  Type,
  FileText,
  Mail,
  Hash,
  ChevronDown,
  Circle,
  CheckSquare,
  Calendar,
  FileCode,
  Upload,
  Phone,
} from 'lucide-react';
import { PageActionsSelector } from '../PageActionsSelector';

// =============================================================================
// Field Type Configuration
// =============================================================================

/**
 * Helper to get field type icon and category for display
 */
export const getFieldTypeConfig = (
  type: string
): { icon: React.ElementType; category: string; label: string } => {
  const configs: Record<
    string,
    { icon: React.ElementType; category: string; label: string }
  > = {
    text_input_field: { icon: Type, category: 'input', label: 'Short Text' },
    text_area_field: { icon: FileText, category: 'input', label: 'Long Text' },
    email_field: { icon: Mail, category: 'input', label: 'Email' },
    number_field: { icon: Hash, category: 'input', label: 'Number' },
    select_field: { icon: ChevronDown, category: 'choice', label: 'Dropdown' },
    radio_field: { icon: Circle, category: 'choice', label: 'Multiple Choice' },
    checkbox_field: {
      icon: CheckSquare,
      category: 'choice',
      label: 'Checkboxes',
    },
    date_field: { icon: Calendar, category: 'input', label: 'Date' },
    phone_number_field: { icon: Phone, category: 'input', label: 'Phone Number' },
    rich_text_field: {
      icon: FileCode,
      category: 'content',
      label: 'Rich Text',
    },
    file_upload_field: {
      icon: Upload,
      category: 'advanced',
      label: 'File Upload',
    },
  };
  return configs[type] || { icon: Type, category: 'input', label: 'Unknown' };
};

export const getCategoryColor = (category: string) => {
  /* Typeform field-icon palette (exact extracted colors) */
  switch (category) {
    case 'input':
      return 'bg-[var(--tf-icon-salmon)] text-primary';      /* salmon */
    case 'choice':
      return 'bg-[var(--tf-icon-lavender)] text-[#5c2e6b]';      /* lavender */
    case 'content':
      return 'bg-[var(--tf-icon-teal)] text-[var(--tf-green)]';      /* teal */
    default:
      return 'bg-[var(--tf-icon-gray)] text-foreground';      /* neutral gray */
  }
};

// =============================================================================
// FieldCard
// =============================================================================

/**
 * FieldCard - Displays a single existing field with optional drag handle
 */
export const FieldCard: React.FC<{
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
  const typeConfig = getFieldTypeConfig(field.type);
  const label: string =
    'label' in field && typeof field.label === 'string' && field.label
      ? field.label
      : typeConfig.label;

  // Get field type config for icon and category
  const Icon = typeConfig.icon;
  const categoryColor = getCategoryColor(typeConfig.category);

  // Show compact view when any drag is active OR during expansion delay
  const shouldShowCompact = isAnyDragActive || isDelayingExpansion;

  // AI highlight ring + auto-scroll
  const aiHighlightedFieldId = useFormBuilderStore((s) => s.aiHighlightedFieldId);
  const isAIHighlighted = aiHighlightedFieldId === field.id;
  const cardRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (isAIHighlighted && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isAIHighlighted]);

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      className={`
        px-4 py-3.5 bg-white dark:bg-card rounded-xl transition-all duration-150 group
        ${
          isDragging
            ? 'opacity-40'
            : isRecentlyDropped
              ? 'shadow-md'
              : isSelected
                ? ''
                : 'cursor-pointer hover:shadow-sm'
        }
        ${isAIHighlighted ? 'ring-2 ring-primary ring-offset-2 transition-all duration-300' : ''}
      `}
      style={{
        border: isDragging
          ? '1px solid rgba(81,76,84,0.25)'
          : isRecentlyDropped
            ? '1px solid rgba(60,50,62,0.30)'
            : isSelected
              ? '1.5px solid #3c323e'
              : '1px solid rgba(81,76,84,0.10)',
        boxShadow: isSelected
          ? '0 0 0 3px rgba(60,50,62,0.08), 0 1px 4px rgba(60,50,62,0.06)'
          : isRecentlyDropped
            ? '0 4px 12px rgba(60,50,62,0.10)'
            : '0 1px 3px rgba(60,50,62,0.05)',
      }}
      data-testid={`draggable-field-${field.id}`}
    >
      {/* Header row — always visible in both compact and expanded states */}
      <div className="flex items-center gap-3 w-full">
        {dragHandleProps && (
          <div
            {...dragHandleProps}
            className="flex-shrink-0 p-1 -ml-1 cursor-grab rounded-md transition-colors hover:bg-[var(--tf-tab-bg)]"
            title="Drag to reorder"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-4 h-4 text-muted-foreground dark:text-gray-500" />
          </div>
        )}

        <div
          className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${categoryColor}`}
        >
          <Icon className="w-3.5 h-3.5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate flex items-center gap-1 text-[#4c414e] dark:text-white">
            <span className="truncate">{label}</span>
            {'validation' in field &&
              (field as FillableFormField).validation?.required && (
                <span className="text-[#ce5d55] text-sm flex-shrink-0" title="Required field">
                  *
                </span>
              )}
          </div>
          <div className="text-xs text-[#655d67] dark:text-gray-400">
            {typeConfig.label}
          </div>
        </div>
      </div>

      {/* Animated expansion panel — collapses to zero height during drag */}
      <div
        className="grid"
        style={{
          gridTemplateRows: shouldShowCompact ? '0fr' : '1fr',
          transition: 'grid-template-rows 300ms ease-out',
        }}
      >
        <div className="overflow-hidden">
          <div className="pt-3 space-y-2.5">
            {/* Field Preview */}
            <div className="pl-9 pr-1" data-testid={`field-content-${index + 1}`}>
              <div className="px-3 py-2.5 rounded-lg" style={{ backgroundColor: 'var(--tf-faint)', border: '1px solid var(--tf-border-faint)' }}>
                <FieldPreview
                  field={field}
                  disabled={true}
                  showValidation={false}
                />
              </div>
            </div>

            {/* Actions — fade in on hover */}
            <div className="pl-9 pr-1">
              <div className="flex items-center space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-100">
                {onClick && (
                  <Button
                    variant="ghost"
                    onClick={(e) => { e.stopPropagation(); onClick(); }}
                    className="p-1.5 rounded-lg h-auto"
                    title="Field settings"
                    data-testid={`field-settings-button-${index + 1}`}
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                )}
                {onMoveUp && index > 0 && (
                  <Button
                    variant="ghost"
                    onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
                    className="p-1.5 rounded-lg h-auto"
                    title="Move Up"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </Button>
                )}
                {onMoveDown && index < totalFields - 1 && (
                  <Button
                    variant="ghost"
                    onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
                    className="p-1.5 rounded-lg h-auto"
                    title="Move Down"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </Button>
                )}
                {onDuplicate && (
                  <Button
                    variant="ghost"
                    onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
                    className="p-1.5 rounded-lg h-auto"
                    title="Duplicate Field"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                )}
                {pages.length > 1 && onMoveToPage && onCopyToPage && (
                  <PageActionsSelector
                    pages={pages}
                    currentPageId={pageId}
                    triggerElement={
                      <Button
                        variant="ghost"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-lg h-auto"
                        title="Move/Copy to another page"
                      >
                        <ArrowUp className="w-4 h-4 rotate-90" />
                      </Button>
                    }
                    onMoveToPage={onMoveToPage}
                    onCopyToPage={onCopyToPage}
                  />
                )}
                {onDelete && (
                  <Button
                    variant="ghost"
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-[var(--tf-error-bg)] dark:hover:bg-red-950/30 rounded-lg h-auto"
                    title="Delete field"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// DraggableFieldCard
// =============================================================================

/**
 * DraggableFieldCard - Wrapper that makes FieldCard draggable via grip handle
 */
export const DraggableFieldCard: React.FC<{
  field: FormField;
  index: number;
  pageId: string;
  totalFields: number;
  isRecentlyDropped?: boolean;
  isDelayingExpansion?: boolean;
}> = ({
  field,
  index,
  pageId,
  totalFields,
  isRecentlyDropped = false,
  isDelayingExpansion = false,
}) => {
  const permissions = useFormPermissions();
  const canEdit = permissions.canEditFields();
  const canReorder = permissions.canReorderFields();
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
    disabled: !canReorder,
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
        dragHandleProps={
          canReorder ? { ...attributes, ...listeners } : undefined
        }
        onClick={handleClick}
        onDelete={canEdit ? handleDelete : undefined}
        onDuplicate={canEdit ? handleDuplicate : undefined}
        onMoveUp={canReorder && index > 0 ? handleMoveUp : undefined}
        onMoveDown={
          canReorder && index < totalFields - 1 ? handleMoveDown : undefined
        }
        onMoveToPage={canEdit ? handleMoveToPage : undefined}
        onCopyToPage={canEdit ? handleCopyToPage : undefined}
      />
    </div>
  );
};

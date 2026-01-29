import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { useDndContext } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { FormField, FieldType, FormPage } from '@dculus/types';
import { Card, Button, FieldPreview } from '@dculus/ui';
import { useFormPermissions } from '../../hooks/useFormPermissions';
import { useTranslation } from '../../hooks/useTranslation';
import {
  GripVertical,
  Type,
  FileText,
  Mail,
  Hash,
  ChevronDown,
  Circle,
  CheckSquare,
  Calendar,
  Copy,
  Trash2,
  Settings,
  FileCode,
  MoreVertical,
} from 'lucide-react';
import { PageActionsSelector } from './PageActionsSelector';
import { CompactFieldCard } from './CompactFieldCard';

const FIELD_ICONS: Partial<Record<FieldType, React.ReactNode>> = {
  [FieldType.TEXT_INPUT_FIELD]: <Type className="w-4 h-4" />,
  [FieldType.TEXT_AREA_FIELD]: <FileText className="w-4 h-4" />,
  [FieldType.EMAIL_FIELD]: <Mail className="w-4 h-4" />,
  [FieldType.NUMBER_FIELD]: <Hash className="w-4 h-4" />,
  [FieldType.SELECT_FIELD]: <ChevronDown className="w-4 h-4" />,
  [FieldType.RADIO_FIELD]: <Circle className="w-4 h-4" />,
  [FieldType.CHECKBOX_FIELD]: <CheckSquare className="w-4 h-4" />,
  [FieldType.DATE_FIELD]: <Calendar className="w-4 h-4" />,
  [FieldType.RICH_TEXT_FIELD]: <FileCode className="w-4 h-4" />,
  [FieldType.FORM_FIELD]: <Type className="w-4 h-4" />,
};

interface DraggableFieldProps {
  field: FormField;
  pageId: string;
  index: number; // Required for test IDs and field positioning
  isConnected: boolean;
  isSelected?: boolean;
  pages?: FormPage[];
  onUpdate: (updates: Record<string, any>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onEdit?: () => void;
  onMoveToPage?: (fieldId: string, targetPageId: string) => void;
  onCopyToPage?: (fieldId: string, targetPageId: string) => void;
}

export const DraggableField: React.FC<DraggableFieldProps> = ({
  field,
  pageId,
  index,
  isConnected,
  isSelected = false,
  pages = [],
  onUpdate: _onUpdate,
  onRemove,
  onDuplicate,
  onEdit,
  onMoveToPage,
  onCopyToPage,
}) => {
  const { t } = useTranslation('draggableField');
  const permissions = useFormPermissions();

  // Get global DnD context to detect if any drag is active
  const { active } = useDndContext();
  const isAnyDragActive = !!active;

  // Check if this specific field is being dragged
  const isFieldBeingDragged = active?.data?.current?.type === 'field';

  // Function to get translated field type labels
  const getFieldTypeLabel = (fieldType: FieldType): string => {
    const labelMap: Partial<Record<FieldType, string>> = {
      [FieldType.TEXT_INPUT_FIELD]: t('fieldTypes.shortText'),
      [FieldType.TEXT_AREA_FIELD]: t('fieldTypes.longText'),
      [FieldType.EMAIL_FIELD]: t('fieldTypes.email'),
      [FieldType.NUMBER_FIELD]: t('fieldTypes.number'),
      [FieldType.SELECT_FIELD]: t('fieldTypes.dropdown'),
      [FieldType.RADIO_FIELD]: t('fieldTypes.radio'),
      [FieldType.CHECKBOX_FIELD]: t('fieldTypes.checkbox'),
      [FieldType.DATE_FIELD]: t('fieldTypes.date'),
      [FieldType.RICH_TEXT_FIELD]: t('fieldTypes.richText'),
      [FieldType.FORM_FIELD]: t('fieldTypes.formField'),
    };
    return labelMap[fieldType] || t('fieldTypes.fallback');
  };

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: field.id,
    data: {
      type: 'field',
      field,
      pageId,
    },
    disabled: !permissions.canReorderFields(), // Disable dragging for viewers
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleFieldClick = (e: React.MouseEvent) => {
    // Don't handle clicks during drag operations
    if (isAnyDragActive) return;

    const target = e.target as HTMLElement;
    const isInteractiveElement =
      target.closest('button') ||
      target.closest('input') ||
      target.closest('[data-drag-handle]');

    if (!isInteractiveElement && onEdit && permissions.canEditFields()) {
      onEdit();
    }
  };

  const handleMoveToPage = (targetPageId: string) => {
    if (onMoveToPage) {
      onMoveToPage(field.id, targetPageId);
    }
  };

  const handleCopyToPage = (targetPageId: string) => {
    if (onCopyToPage) {
      onCopyToPage(field.id, targetPageId);
    }
  };

  // Render compact card when ANY field drag is active
  if (isFieldBeingDragged && isAnyDragActive) {
    return (
      <div
        ref={setNodeRef}
        data-testid={`draggable-field-${field.id}`}
        style={style}
        className="transition-all duration-200"
        {...(permissions.canReorderFields()
          ? { ...attributes, ...listeners }
          : {})}
      >
        <CompactFieldCard
          field={field}
          variant={isDragging ? 'dragSource' : 'normal'}
        />
      </div>
    );
  }

  // Render full field card when no drag is active
  return (
    <div
      ref={setNodeRef}
      data-testid={`draggable-field-${field.id}`}
      style={style}
      className={`
        group relative transition-all duration-200
        ${isDragging ? 'opacity-50 scale-105 z-50' : ''}
      `}
    >
      <Card
        data-field-type={field.type}
        className={`
          border-2 transition-all duration-200 cursor-pointer
          ${
            isDragging
              ? 'border-blue-500 shadow-lg'
              : isSelected
                ? 'border-blue-400 shadow-md ring-2 ring-blue-200 dark:ring-blue-800 bg-blue-50/50 dark:bg-blue-950/50'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
          }
          group-hover:shadow-md
        `}
        onClick={handleFieldClick}
      >
        <div className="p-4">
          <div className="flex items-start space-x-3">
            {/* Drag Handle */}
            {permissions.canReorderFields() ? (
              <div
                {...attributes}
                {...listeners}
                data-drag-handle
                data-testid={`field-drag-handle-${index + 1}`}
                className="flex-shrink-0 p-1 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <GripVertical className="w-4 h-4" />
              </div>
            ) : (
              <div className="flex-shrink-0 p-1 text-gray-300 dark:text-gray-600">
                <GripVertical className="w-4 h-4" />
              </div>
            )}

            {/* Field Icon */}
            <div className="flex-shrink-0 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400">
              {FIELD_ICONS[field.type] || <Type className="w-4 h-4" />}
            </div>

            {/* Field Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* Field Type Badge */}
                  <div className="mb-3">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      {FIELD_ICONS[field.type]}
                      <span className="ml-1">
                        {getFieldTypeLabel(field.type)}
                      </span>
                    </span>
                  </div>

                  {/* Field Preview */}
                  <div
                    className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-md border border-gray-200 dark:border-gray-700"
                    data-testid={`field-content-${index + 1}`}
                  >
                    <FieldPreview
                      field={field}
                      disabled={true}
                      showValidation={false}
                    />
                  </div>

                  {/* Connection Status */}
                  {!isConnected && (
                    <div className="mt-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                        Offline
                      </span>
                    </div>
                  )}
                </div>

                {/* Field Actions - Only show for users with edit permissions */}
                {!permissions.isReadOnly && (
                  <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity ml-3">
                    {onEdit && permissions.canEditFields() && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={onEdit}
                        disabled={!isConnected}
                        className="h-8 w-8 text-gray-500 hover:text-blue-600"
                        title={t('tooltips.fieldSettings')}
                        data-testid={`field-settings-button-${index + 1}`}
                      >
                        <Settings className="w-4 h-4" />
                      </Button>
                    )}
                    {permissions.canAddFields() && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={onDuplicate}
                        disabled={!isConnected}
                        className="h-8 w-8 text-gray-500 hover:text-blue-600"
                        title={t('tooltips.duplicateField')}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    )}
                    {(onMoveToPage || onCopyToPage) &&
                      pages.length > 1 &&
                      permissions.canEditFields() && (
                        <PageActionsSelector
                          pages={pages}
                          currentPageId={pageId}
                          onMoveToPage={handleMoveToPage}
                          onCopyToPage={handleCopyToPage}
                          disabled={!isConnected}
                          triggerElement={
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled={!isConnected}
                              className="h-8 w-8 text-gray-500 hover:text-blue-600"
                              title={t('tooltips.pageActions')}
                            >
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          }
                        />
                      )}
                    {permissions.canDeleteFields() && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={onRemove}
                        disabled={!isConnected}
                        className="h-8 w-8 text-gray-500 hover:text-red-600"
                        title={t('tooltips.deleteField')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default DraggableField;

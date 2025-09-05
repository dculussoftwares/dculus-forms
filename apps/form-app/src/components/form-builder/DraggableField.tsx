import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FormField, FieldType, FormPage } from '@dculus/types';
import { Card, Button, FieldPreview } from '@dculus/ui';
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
  MoreVertical
} from 'lucide-react';
import { PageSelector } from './PageSelector';

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

const FIELD_TYPE_LABELS: Partial<Record<FieldType, string>> = {
  [FieldType.TEXT_INPUT_FIELD]: 'Short Text',
  [FieldType.TEXT_AREA_FIELD]: 'Long Text',
  [FieldType.EMAIL_FIELD]: 'Email',
  [FieldType.NUMBER_FIELD]: 'Number',
  [FieldType.SELECT_FIELD]: 'Dropdown',
  [FieldType.RADIO_FIELD]: 'Radio',
  [FieldType.CHECKBOX_FIELD]: 'Checkbox',
  [FieldType.DATE_FIELD]: 'Date',
  [FieldType.RICH_TEXT_FIELD]: 'Rich Text',
  [FieldType.FORM_FIELD]: 'Form Field',
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
}) => {


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
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };






  const handleFieldClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const isInteractiveElement = 
      target.closest('button') || 
      target.closest('input') || 
      target.closest('[data-drag-handle]');
    
    if (!isInteractiveElement && onEdit) {
      onEdit();
    }
  };

  const handleMoveToPage = (targetPageId: string) => {
    if (onMoveToPage) {
      onMoveToPage(field.id, targetPageId);
    }
  };

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
          ${isDragging 
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
            <div
              {...attributes}
              {...listeners}
              data-drag-handle
              data-testid={`field-drag-handle-${index + 1}`}
              className="flex-shrink-0 p-1 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <GripVertical className="w-4 h-4" />
            </div>

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
                      <span className="ml-1">{FIELD_TYPE_LABELS[field.type] || 'Field'}</span>
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

                {/* Field Actions */}
                <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity ml-3">
                  {onEdit && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={onEdit}
                      disabled={!isConnected}
                      className="h-8 w-8 text-gray-500 hover:text-blue-600"
                      title="Field settings"
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={onDuplicate}
                    disabled={!isConnected}
                    className="h-8 w-8 text-gray-500 hover:text-blue-600"
                    title="Duplicate field"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  {onMoveToPage && pages.length > 1 && (
                    <PageSelector
                      pages={pages}
                      currentPageId={pageId}
                      onPageSelect={handleMoveToPage}
                      disabled={!isConnected}
                      triggerElement={
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={!isConnected}
                          className="h-8 w-8 text-gray-500 hover:text-green-600"
                          title="Move to page"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      }
                    />
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={onRemove}
                    disabled={!isConnected}
                    className="h-8 w-8 text-gray-500 hover:text-red-600"
                    title="Delete field"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>


            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default DraggableField;

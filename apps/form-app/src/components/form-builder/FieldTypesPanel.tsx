import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { FieldType } from '@dculus/types';
import { Card } from '@dculus/ui';
import { cn } from '@dculus/utils';
import { useFormPermissions } from '../../hooks/useFormPermissions';
import { useTranslation } from '../../hooks/useTranslation';
import { useFieldCreation } from '../../hooks/useFieldCreation';
import { useFormBuilderStore } from '../../store/useFormBuilderStore';
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
  Upload,
} from 'lucide-react';

export interface FieldTypeConfig {
  type: FieldType;
  label: string;
  description: string;
  icon: React.ReactNode;
  category: 'input' | 'choice' | 'content' | 'advanced';
}

const getFieldTypesConfig = (t: (key: string) => string): FieldTypeConfig[] => [
  // Input Fields
  {
    type: FieldType.TEXT_INPUT_FIELD,
    label: t('fieldTypes.shortText.label'),
    description: t('fieldTypes.shortText.description'),
    icon: <Type className="w-5 h-5" />,
    category: 'input',
  },
  {
    type: FieldType.TEXT_AREA_FIELD,
    label: t('fieldTypes.longText.label'),
    description: t('fieldTypes.longText.description'),
    icon: <FileText className="w-5 h-5" />,
    category: 'input',
  },
  {
    type: FieldType.EMAIL_FIELD,
    label: t('fieldTypes.email.label'),
    description: t('fieldTypes.email.description'),
    icon: <Mail className="w-5 h-5" />,
    category: 'input',
  },
  {
    type: FieldType.NUMBER_FIELD,
    label: t('fieldTypes.number.label'),
    description: t('fieldTypes.number.description'),
    icon: <Hash className="w-5 h-5" />,
    category: 'input',
  },
  {
    type: FieldType.DATE_FIELD,
    label: t('fieldTypes.date.label'),
    description: t('fieldTypes.date.description'),
    icon: <Calendar className="w-5 h-5" />,
    category: 'input',
  },

  // Choice Fields
  {
    type: FieldType.SELECT_FIELD,
    label: t('fieldTypes.dropdown.label'),
    description: t('fieldTypes.dropdown.description'),
    icon: <ChevronDown className="w-5 h-5" />,
    category: 'choice',
  },
  {
    type: FieldType.RADIO_FIELD,
    label: t('fieldTypes.radio.label'),
    description: t('fieldTypes.radio.description'),
    icon: <Circle className="w-5 h-5" />,
    category: 'choice',
  },
  {
    type: FieldType.CHECKBOX_FIELD,
    label: t('fieldTypes.checkbox.label'),
    description: t('fieldTypes.checkbox.description'),
    icon: <CheckSquare className="w-5 h-5" />,
    category: 'choice',
  },

  // Content Fields
  {
    type: FieldType.RICH_TEXT_FIELD,
    label: t('fieldTypes.richText.label'),
    description: t('fieldTypes.richText.description'),
    icon: <FileCode className="w-5 h-5" />,
    category: 'content',
  },

  // Advanced Fields
  {
    type: FieldType.FILE_UPLOAD_FIELD,
    label: t('fieldTypes.fileUpload.label'),
    description: t('fieldTypes.fileUpload.description'),
    icon: <Upload className="w-5 h-5" />,
    category: 'advanced',
  },
];

const getCategoriesConfig = (t: (key: string) => string) => ({
  input: {
    label: t('categories.input'),
    color: 'bg-[#f8cdd8] text-[#3c323e] border-[rgba(248,205,216,0.6)]',
  },
  choice: {
    label: t('categories.choice'),
    color: 'bg-[#ddd6fa] text-[#5c2e6b] border-[rgba(221,214,250,0.6)]',
  },
  content: {
    label: t('categories.content'),
    color: 'bg-[#f4faf8] text-[#177767] border-[rgba(244,250,248,0.8)]',
  },
  advanced: {
    label: t('categories.advanced'),
    color: 'bg-[#fbe19d] text-[#8b6a18] border-[rgba(251,225,157,0.6)]',
  },
});

// Shared component for displaying field type content
interface FieldTypeDisplayProps {
  fieldType: FieldTypeConfig;
  isDragging?: boolean;
  isOverlay?: boolean;
  categories?: ReturnType<typeof getCategoriesConfig>;
}

const FieldTypeDisplay: React.FC<FieldTypeDisplayProps> = ({
  fieldType,
  isDragging = false,
  isOverlay = false,
  categories,
}) => {
  return (
    <Card
      className={cn(
        'p-3',
        isOverlay
          ? 'border-[rgba(81,76,84,0.20)] bg-white shadow-md transition-none'
          : cn(
              'border-[var(--tf-border-medium)] bg-white dark:bg-card',
              'hover:border-[rgba(81,76,84,0.22)] hover:bg-[var(--tf-faint)] hover:shadow-sm',
              'dark:hover:border-white/[0.15]',
              isDragging
                ? 'border-[rgba(81,76,84,0.28)] bg-[var(--tf-faint)] shadow-sm transition-none'
                : 'transition-all duration-150'
            )
      )}
    >
      <div className="flex items-start space-x-2.5">
        <div
          className={cn(
            'p-1.5 rounded-lg flex-shrink-0',
            isOverlay
              ? 'bg-[var(--tf-icon-lavender)] text-[#5c2e6b]'
              : cn(
                  categories?.[fieldType.category as keyof typeof categories]?.color || 'bg-[var(--tf-icon-gray)] text-foreground',
                  isDragging
                    ? 'transition-none'
                    : 'transition-colors duration-150'
                )
          )}
        >
          {fieldType.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div
            className={cn(
              'text-sm font-medium',
              isOverlay
                ? 'text-[#3c323e] dark:text-white'
                : cn(
                    isDragging
                      ? 'text-[#3c323e] dark:text-white'
                      : 'text-[#4c414e] dark:text-white'
                  )
            )}
          >
            {fieldType.label}
          </div>
          <div className="text-xs text-[#655d67] dark:text-gray-400 mt-0.5 leading-tight">
            {fieldType.description}
          </div>
        </div>
      </div>
    </Card>
  );
};

interface DraggableFieldTypeProps {
  fieldType: FieldTypeConfig;
  categories: ReturnType<typeof getCategoriesConfig>;
  onAdd?: () => void;
}

const DraggableFieldType: React.FC<DraggableFieldTypeProps> = ({
  fieldType,
  categories,
  onAdd,
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `field-type-${fieldType.type}`,
    data: {
      type: 'field-type',
      fieldType,
    },
  });

  return (
    <>
      {/* Inject CSS to completely disable transforms for field type elements */}
      <style>{`
        [data-draggable-id*="field-type-"] {
          transform: none !important;
          transition: none !important;
          position: static !important;
          left: auto !important;
          top: auto !important;
          will-change: auto !important;
        }
        
        [data-draggable-id*="field-type-"] * {
          transform: none !important;
          transition: none !important;
        }
      `}</style>

      <div
        ref={setNodeRef}
        data-draggable-id={`field-type-${fieldType.type}`}
        data-testid={`field-type-${fieldType.label.replace(/\s+/g, '-').toLowerCase()}`}
        {...listeners}
        {...attributes}
        onClick={onAdd}
        className={cn(
          'group cursor-grab active:cursor-grabbing',
          isDragging ? 'opacity-50' : ''
        )}
      >
        <FieldTypeDisplay
          fieldType={fieldType}
          isDragging={isDragging}
          categories={categories}
        />
      </div>
    </>
  );
};

interface FieldTypesPanelProps {
  className?: string;
}

export { FieldTypeDisplay };

export const FieldTypesPanel: React.FC<FieldTypesPanelProps> = ({
  className = '',
}) => {
  const permissions = useFormPermissions();
  const { t } = useTranslation('fieldTypesPanel');
  const { selectedPageId, addField } = useFormBuilderStore();
  const { createFieldData } = useFieldCreation();

  // Hide field types panel for viewers as they can't add fields
  if (!permissions.canAddFields()) {
    return null;
  }

  const FIELD_TYPES = getFieldTypesConfig(t);
  const CATEGORIES = getCategoriesConfig(t);

  const groupedFields = FIELD_TYPES.reduce(
    (acc, field) => {
      if (!acc[field.category]) {
        acc[field.category] = [];
      }
      acc[field.category].push(field);
      return acc;
    },
    {} as Record<string, FieldTypeConfig[]>
  );

  return (
    <div className={cn('h-full flex flex-col overflow-hidden', className)}>
      {/* Header */}
      <div className="px-4 py-3.5" style={{ borderBottom: '1px solid var(--tf-border)' }}>
        <p className="text-xs font-semibold uppercase tracking-wider text-[#655d67]">
          {t('header.title')}
        </p>
      </div>

      {/* Field type list */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3 space-y-5">
          {Object.entries(groupedFields).map(([category, fields]) => (
            <div key={category}>
              {/* Category label */}
              <div className="flex items-center gap-1.5 mb-2 px-1">
                <span
                  className={cn(
                    'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border tracking-wide uppercase',
                    CATEGORIES[category as keyof typeof CATEGORIES].color
                  )}
                >
                  {CATEGORIES[category as keyof typeof CATEGORIES].label}
                </span>
              </div>

              <div className="space-y-1.5">
                {fields.map((fieldType) => (
                  <DraggableFieldType
                    key={fieldType.type}
                    fieldType={fieldType}
                    categories={CATEGORIES}
                    onAdd={selectedPageId ? () => addField(selectedPageId, fieldType.type as FieldType, createFieldData(fieldType)) : undefined}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FieldTypesPanel;

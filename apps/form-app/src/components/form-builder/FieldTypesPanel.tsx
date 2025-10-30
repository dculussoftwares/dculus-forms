import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { FieldType } from '@dculus/types';
import { Card, TypographyH3 } from '@dculus/ui';
import { useFormPermissions } from '../../hooks/useFormPermissions';
import { useTranslation } from '../../hooks/useTranslation';
import {
  Type,
  FileText,
  Mail,
  Hash,
  ChevronDown,
  Circle,
  CheckSquare,
  Calendar,
  FileCode
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
    category: 'input'
  },
  {
    type: FieldType.TEXT_AREA_FIELD,
    label: t('fieldTypes.longText.label'),
    description: t('fieldTypes.longText.description'),
    icon: <FileText className="w-5 h-5" />,
    category: 'input'
  },
  {
    type: FieldType.EMAIL_FIELD,
    label: t('fieldTypes.email.label'),
    description: t('fieldTypes.email.description'),
    icon: <Mail className="w-5 h-5" />,
    category: 'input'
  },
  {
    type: FieldType.NUMBER_FIELD,
    label: t('fieldTypes.number.label'),
    description: t('fieldTypes.number.description'),
    icon: <Hash className="w-5 h-5" />,
    category: 'input'
  },
  {
    type: FieldType.DATE_FIELD,
    label: t('fieldTypes.date.label'),
    description: t('fieldTypes.date.description'),
    icon: <Calendar className="w-5 h-5" />,
    category: 'input'
  },
  
  // Choice Fields
  {
    type: FieldType.SELECT_FIELD,
    label: t('fieldTypes.dropdown.label'),
    description: t('fieldTypes.dropdown.description'),
    icon: <ChevronDown className="w-5 h-5" />,
    category: 'choice'
  },
  {
    type: FieldType.RADIO_FIELD,
    label: t('fieldTypes.radio.label'),
    description: t('fieldTypes.radio.description'),
    icon: <Circle className="w-5 h-5" />,
    category: 'choice'
  },
  {
    type: FieldType.CHECKBOX_FIELD,
    label: t('fieldTypes.checkbox.label'),
    description: t('fieldTypes.checkbox.description'),
    icon: <CheckSquare className="w-5 h-5" />,
    category: 'choice'
  },
  
  // Content Fields
  {
    type: FieldType.RICH_TEXT_FIELD,
    label: t('fieldTypes.richText.label'),
    description: t('fieldTypes.richText.description'),
    icon: <FileCode className="w-5 h-5" />,
    category: 'content'
  }
];

const getCategoriesConfig = (t: (key: string) => string) => ({
  input: { label: t('categories.input'), color: 'bg-blue-50 text-blue-700 border-blue-200' },
  choice: { label: t('categories.choice'), color: 'bg-purple-50 text-purple-700 border-purple-200' },
  content: { label: t('categories.content'), color: 'bg-green-50 text-green-700 border-green-200' },
  advanced: { label: t('categories.advanced'), color: 'bg-orange-50 text-orange-700 border-orange-200' }
});

// Shared component for displaying field type content
interface FieldTypeDisplayProps {
  fieldType: FieldTypeConfig;
  isDragging?: boolean;
  isOverlay?: boolean;
  categories?: ReturnType<typeof getCategoriesConfig>;
}

const FieldTypeDisplay: React.FC<FieldTypeDisplayProps> = ({ fieldType, isDragging = false, isOverlay = false, categories }) => {
  return (
    <Card className={`
      p-4 border-2 border-dashed
      ${isOverlay 
        ? 'border-blue-500 bg-white dark:bg-gray-800 shadow-lg transition-none' 
        : `border-gray-200 hover:border-blue-300 hover:bg-blue-50/50
           dark:border-gray-700 dark:hover:border-blue-600 dark:hover:bg-blue-950/30
           group-hover:shadow-md
           ${isDragging ? 'border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/40 transition-none' : 'transition-all duration-200'}`
      }
    `}>
      <div className="flex items-start space-x-3">
        <div className={`
          p-2 rounded-lg
          ${isOverlay 
            ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400' 
            : `${categories?.[fieldType.category as keyof typeof categories]?.color || 'bg-gray-100'}
               ${isDragging ? 'scale-110 transition-none' : 'group-hover:scale-110 transition-transform duration-200'}`
          }
        `}>
          {fieldType.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-medium ${
            isOverlay 
              ? 'text-gray-900 dark:text-white'
              : `group-hover:text-blue-600 dark:group-hover:text-blue-400 ${
                  isDragging 
                    ? 'text-blue-600 dark:text-blue-400' 
                    : 'text-gray-900 dark:text-white'
                }`
          }`}>
            {fieldType.label}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
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
}

const DraggableFieldType: React.FC<DraggableFieldTypeProps> = ({ fieldType, categories }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
  } = useDraggable({
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
        className={`group cursor-grab active:cursor-grabbing transition-transform duration-200 ${
          isDragging ? 'scale-102' : 'hover:scale-102'
        }`}
      >
        <FieldTypeDisplay fieldType={fieldType} isDragging={isDragging} categories={categories} />
      </div>
    </>
  );
};

interface FieldTypesPanelProps {
  className?: string;
}

export { FieldTypeDisplay };

export const FieldTypesPanel: React.FC<FieldTypesPanelProps> = ({ className = '' }) => {
  const permissions = useFormPermissions();
  const { t } = useTranslation('fieldTypesPanel');
  
  // Hide field types panel for viewers as they can't add fields
  if (!permissions.canAddFields()) {
    return null;
  }
  
  const FIELD_TYPES = getFieldTypesConfig(t);
  const CATEGORIES = getCategoriesConfig(t);
  
  const groupedFields = FIELD_TYPES.reduce((acc, field) => {
    if (!acc[field.category]) {
      acc[field.category] = [];
    }
    acc[field.category].push(field);
    return acc;
  }, {} as Record<string, FieldTypeConfig[]>);

  return (
    <div className={`h-full overflow-y-auto ${className}`}>
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <TypographyH3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {t('header.title')}
        </TypographyH3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {t('header.description')}
        </p>
      </div>

      <div className="p-4 space-y-6">
        {Object.entries(groupedFields).map(([category, fields]) => (
          <div key={category}>
            <div className="flex items-center space-x-2 mb-3">
              <div className={`
                px-2 py-1 rounded-full text-xs font-medium border
                ${CATEGORIES[category as keyof typeof CATEGORIES].color}
              `}>
                {CATEGORIES[category as keyof typeof CATEGORIES].label}
              </div>
            </div>
            
            <div className="space-y-2">
              {fields.map((fieldType) => (
                <DraggableFieldType
                  key={fieldType.type}
                  fieldType={fieldType}
                  categories={CATEGORIES}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FieldTypesPanel;

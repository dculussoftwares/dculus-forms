import React from 'react';
import {
  FormField,
  FillableFormField,
  NonFillableFormField,
  RichTextFormField,
  FieldType,
} from '@dculus/types';
import { stripHtmlAndTruncate } from '@dculus/utils';
import { Card } from '@dculus/ui';
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
} from 'lucide-react';

export type CompactFieldCardVariant = 'normal' | 'dragSource' | 'overlay';

interface CompactFieldCardProps {
  field: FormField;
  variant?: CompactFieldCardVariant;
  className?: string;
}

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
};

const getFieldIcon = (type: FieldType): React.ReactNode => {
  const iconClass = 'w-4 h-4';
  switch (type) {
    case FieldType.TEXT_INPUT_FIELD:
      return <Type className={iconClass} />;
    case FieldType.TEXT_AREA_FIELD:
      return <FileText className={iconClass} />;
    case FieldType.EMAIL_FIELD:
      return <Mail className={iconClass} />;
    case FieldType.NUMBER_FIELD:
      return <Hash className={iconClass} />;
    case FieldType.SELECT_FIELD:
      return <ChevronDown className={iconClass} />;
    case FieldType.RADIO_FIELD:
      return <Circle className={iconClass} />;
    case FieldType.CHECKBOX_FIELD:
      return <CheckSquare className={iconClass} />;
    case FieldType.DATE_FIELD:
      return <Calendar className={iconClass} />;
    case FieldType.RICH_TEXT_FIELD:
      return <FileCode className={iconClass} />;
    default:
      return <Type className={iconClass} />;
  }
};

const getFieldLabel = (field: FormField): string => {
  // For fillable form fields, show the label
  if (field instanceof FillableFormField) {
    return field.label || FIELD_TYPE_LABELS[field.type] || 'Field';
  }

  // For non-fillable form fields
  if (field instanceof NonFillableFormField) {
    // For rich text fields, show content with ellipsis
    if (
      field.type === FieldType.RICH_TEXT_FIELD &&
      field instanceof RichTextFormField
    ) {
      const content = field.content;
      if (content && content.trim()) {
        return stripHtmlAndTruncate(content, 30);
      }
      return 'Rich Text';
    }
  }

  return FIELD_TYPE_LABELS[field.type] || 'Field';
};

export const CompactFieldCard: React.FC<CompactFieldCardProps> = ({
  field,
  variant = 'normal',
  className = '',
}) => {
  const fieldTypeLabel = FIELD_TYPE_LABELS[field.type] || 'Field';
  const fieldLabel = getFieldLabel(field);

  // Determine if we should show the label (only if different from type label)
  const showLabel = fieldLabel !== fieldTypeLabel;

  // Variant-specific styles
  const getVariantStyles = () => {
    switch (variant) {
      case 'dragSource':
        // Collapsed placeholder where the dragged item originated
        return {
          container:
            'h-[52px] border-2 border-dashed border-blue-300 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-950/30',
          content: 'opacity-40',
        };
      case 'overlay':
        // The dragged item overlay - distinguished styling
        return {
          container:
            'h-[52px] border-2 border-solid border-blue-500 bg-white dark:bg-gray-800 shadow-xl ring-2 ring-blue-200/50 dark:ring-blue-800/50',
          content: '',
        };
      case 'normal':
      default:
        // Normal compact state during drag
        return {
          container:
            'h-[52px] border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 hover:border-gray-400 dark:hover:border-gray-500',
          content: '',
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <Card
      data-testid={`compact-field-card-${field.id}`}
      data-variant={variant}
      className={`
        ${styles.container}
        flex items-center px-3 py-2 rounded-lg transition-colors duration-150
        ${className}
      `}
    >
      <div
        className={`flex items-center flex-1 min-w-0 space-x-3 ${styles.content}`}
      >
        {/* Drag Handle (visual only in compact mode) */}
        <div className="flex-shrink-0 text-gray-400 dark:text-gray-500">
          <GripVertical className="w-4 h-4" />
        </div>

        {/* Field Icon */}
        <div
          className={`
          flex-shrink-0 p-1.5 rounded-md
          ${
            variant === 'overlay'
              ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
          }
        `}
        >
          {getFieldIcon(field.type)}
        </div>

        {/* Field Type Badge */}
        <span
          className={`
          flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded-full
          ${
            variant === 'overlay'
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
              : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
          }
        `}
        >
          {fieldTypeLabel}
        </span>

        {/* Field Label (truncated) */}
        {showLabel && (
          <>
            <span className="flex-shrink-0 text-gray-400 dark:text-gray-500">
              •
            </span>
            <span
              className={`
              flex-1 min-w-0 truncate text-sm
              ${
                variant === 'overlay'
                  ? 'text-gray-900 dark:text-white font-medium'
                  : 'text-gray-600 dark:text-gray-400'
              }
            `}
            >
              {fieldLabel}
            </span>
          </>
        )}
      </div>
    </Card>
  );
};

export default CompactFieldCard;

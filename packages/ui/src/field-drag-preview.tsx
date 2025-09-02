import React from 'react';
import { FormField, FillableFormField, NonFillableFormField, RichTextFormField, FieldType } from '@dculus/types';
import { stripHtmlAndTruncate } from '@dculus/utils';
import { Card } from './index';
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

interface FieldDragPreviewProps {
  field: FormField;
}

export const FieldDragPreview: React.FC<FieldDragPreviewProps> = ({ field }) => {
  const getPreviewText = (): string => {
    // For fillable form fields, show the label
    if (field instanceof FillableFormField) {
      return field.label || getDefaultFieldLabel(field.type);
    }
    
    // For non-fillable form fields
    if (field instanceof NonFillableFormField) {
      // For rich text fields, show content with ellipsis
      if (field.type === FieldType.RICH_TEXT_FIELD && field instanceof RichTextFormField) {
        const content = field.content;
        if (content && content.trim()) {
          return stripHtmlAndTruncate(content, 40);
        }
        return 'Rich Text';
      }
    }
    
    // Fallback to default field label
    return getDefaultFieldLabel(field.type);
  };

  const getDefaultFieldLabel = (type: FieldType): string => {
    switch (type) {
      case FieldType.TEXT_INPUT_FIELD:
        return 'Short Text';
      case FieldType.TEXT_AREA_FIELD:
        return 'Long Text';
      case FieldType.EMAIL_FIELD:
        return 'Email';
      case FieldType.NUMBER_FIELD:
        return 'Number';
      case FieldType.SELECT_FIELD:
        return 'Dropdown';
      case FieldType.RADIO_FIELD:
        return 'Radio';
      case FieldType.CHECKBOX_FIELD:
        return 'Checkbox';
      case FieldType.DATE_FIELD:
        return 'Date';
      case FieldType.RICH_TEXT_FIELD:
        return 'Rich Text';
      default:
        return 'Field';
    }
  };

  const getFieldIcon = (type: FieldType): React.ReactNode => {
    switch (type) {
      case FieldType.TEXT_INPUT_FIELD:
        return <Type className="w-4 h-4" />;
      case FieldType.TEXT_AREA_FIELD:
        return <FileText className="w-4 h-4" />;
      case FieldType.EMAIL_FIELD:
        return <Mail className="w-4 h-4" />;
      case FieldType.NUMBER_FIELD:
        return <Hash className="w-4 h-4" />;
      case FieldType.SELECT_FIELD:
        return <ChevronDown className="w-4 h-4" />;
      case FieldType.RADIO_FIELD:
        return <Circle className="w-4 h-4" />;
      case FieldType.CHECKBOX_FIELD:
        return <CheckSquare className="w-4 h-4" />;
      case FieldType.DATE_FIELD:
        return <Calendar className="w-4 h-4" />;
      case FieldType.RICH_TEXT_FIELD:
        return <FileCode className="w-4 h-4" />;
      default:
        return <Type className="w-4 h-4" />;
    }
  };

  return (
    <Card className="p-3 border-2 border-blue-500 bg-white dark:bg-gray-800 shadow-lg opacity-90 max-w-xs">
      <div className="flex items-start space-x-3">
        {/* Field Icon */}
        <div className="flex-shrink-0 p-2 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-lg">
          {getFieldIcon(field.type)}
        </div>
        
        {/* Field Content */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {getPreviewText()}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {getDefaultFieldLabel(field.type)}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default FieldDragPreview;
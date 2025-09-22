import React from 'react';
import { ResponseFieldChange, ChangeType } from '@dculus/types';
import {
  Card,
  CardContent,
  Badge,
  Separator
} from '@dculus/ui';
import {
  Plus,
  Minus,
  Edit3,
  FileText,
  Mail,
  Hash,
  Calendar,
  CheckSquare,
  Circle,
  Square,
  Type
} from 'lucide-react';

interface FieldChangeCardProps {
  fieldChange: ResponseFieldChange;
}

export const FieldChangeCard: React.FC<FieldChangeCardProps> = ({
  fieldChange
}) => {
  const getChangeTypeColor = (changeType: ChangeType) => {
    switch (changeType) {
      case ChangeType.ADD:
        return 'bg-green-100 text-green-800 border-green-200';
      case ChangeType.UPDATE:
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case ChangeType.DELETE:
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getChangeTypeIcon = (changeType: ChangeType) => {
    switch (changeType) {
      case ChangeType.ADD:
        return <Plus className="h-3 w-3" />;
      case ChangeType.UPDATE:
        return <Edit3 className="h-3 w-3" />;
      case ChangeType.DELETE:
        return <Minus className="h-3 w-3" />;
      default:
        return <Edit3 className="h-3 w-3" />;
    }
  };

  const getFieldTypeIcon = (fieldType: string) => {
    switch (fieldType) {
      case 'text_input_field':
      case 'text_area_field':
        return <Type className="h-4 w-4" />;
      case 'email_field':
        return <Mail className="h-4 w-4" />;
      case 'number_field':
        return <Hash className="h-4 w-4" />;
      case 'date_field':
        return <Calendar className="h-4 w-4" />;
      case 'checkbox_field':
        return <CheckSquare className="h-4 w-4" />;
      case 'radio_field':
        return <Circle className="h-4 w-4" />;
      case 'select_field':
        return <Square className="h-4 w-4" />;
      case 'rich_text_field':
        return <FileText className="h-4 w-4" />;
      default:
        return <Type className="h-4 w-4" />;
    }
  };

  const formatValue = (value: any, fieldType: string): string => {
    if (value === null || value === undefined) {
      return '(empty)';
    }

    if (Array.isArray(value)) {
      return value.length > 0 ? value.join(', ') : '(empty)';
    }

    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }

    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }

    if (typeof value === 'string' && value.trim() === '') {
      return '(empty)';
    }

    // Format based on field type
    switch (fieldType) {
      case 'date_field':
        try {
          return new Date(value).toLocaleDateString();
        } catch {
          return String(value);
        }
      case 'email_field':
        return String(value);
      case 'number_field':
        return isNaN(Number(value)) ? String(value) : Number(value).toLocaleString();
      default:
        return String(value);
    }
  };

  const getValueDisplayClass = (changeType: ChangeType, isOldValue: boolean) => {
    if (changeType === ChangeType.ADD && isOldValue) {
      return 'text-gray-400 italic';
    }
    if (changeType === ChangeType.DELETE && !isOldValue) {
      return 'text-gray-400 italic';
    }
    if (changeType === ChangeType.UPDATE) {
      return isOldValue ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50';
    }
    return '';
  };

  const truncateValue = (value: string, maxLength: number = 100): string => {
    if (value.length <= maxLength) return value;
    return value.substring(0, maxLength) + '...';
  };

  const isLongText = (value: string): boolean => {
    return value.length > 100 || value.includes('\n');
  };

  const renderValue = (value: any, fieldType: string, changeType: ChangeType, isOldValue: boolean) => {
    const formattedValue = formatValue(value, fieldType);
    const displayClass = getValueDisplayClass(changeType, isOldValue);

    if (formattedValue === '(empty)') {
      return (
        <span className={`italic text-gray-400 ${displayClass}`}>
          {formattedValue}
        </span>
      );
    }

    if (isLongText(formattedValue)) {
      return (
        <div className={`font-mono text-sm whitespace-pre-wrap break-words ${displayClass} p-2 rounded border`}>
          {truncateValue(formattedValue, 300)}
        </div>
      );
    }

    return (
      <span className={`font-mono text-sm ${displayClass} px-1 rounded`}>
        {truncateValue(formattedValue)}
      </span>
    );
  };

  return (
    <Card className="border-l-4 border-l-gray-200">
      <CardContent className="p-4">
        {/* Field Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            {getFieldTypeIcon(fieldChange.fieldType)}
            <span className="font-medium text-gray-900">
              {fieldChange.fieldLabel}
            </span>
            <Badge
              variant="outline"
              className={getChangeTypeColor(fieldChange.changeType)}
            >
              {getChangeTypeIcon(fieldChange.changeType)}
              <span className="ml-1">{fieldChange.changeType}</span>
            </Badge>
          </div>

          {/* Character change indicator for text fields */}
          {fieldChange.valueChangeSize !== undefined && fieldChange.valueChangeSize > 0 && (
            <Badge variant="outline" className="text-xs">
              {fieldChange.changeType === ChangeType.UPDATE ? '±' : ''}
              {fieldChange.valueChangeSize} chars
            </Badge>
          )}
        </div>

        {/* Value Changes */}
        <div className="space-y-3">
          {fieldChange.changeType === ChangeType.UPDATE && (
            <>
              {/* Before Value */}
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Before
                </div>
                {renderValue(
                  fieldChange.previousValue,
                  fieldChange.fieldType,
                  fieldChange.changeType,
                  true
                )}
              </div>

              <Separator />

              {/* After Value */}
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  After
                </div>
                {renderValue(
                  fieldChange.newValue,
                  fieldChange.fieldType,
                  fieldChange.changeType,
                  false
                )}
              </div>
            </>
          )}

          {fieldChange.changeType === ChangeType.ADD && (
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Added Value
              </div>
              {renderValue(
                fieldChange.newValue,
                fieldChange.fieldType,
                fieldChange.changeType,
                false
              )}
            </div>
          )}

          {fieldChange.changeType === ChangeType.DELETE && (
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Removed Value
              </div>
              {renderValue(
                fieldChange.previousValue,
                fieldChange.fieldType,
                fieldChange.changeType,
                true
              )}
            </div>
          )}
        </div>

        {/* Field metadata */}
        <div className="mt-3 pt-2 border-t border-gray-100">
          <div className="text-xs text-gray-500">
            Field ID: <code className="bg-gray-100 px-1 rounded">{fieldChange.fieldId}</code>
            <span className="mx-2">•</span>
            Type: <span className="capitalize">{fieldChange.fieldType.replace('_', ' ')}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
import React from 'react';
import { Type } from 'lucide-react';
import { FormField, FieldType } from '@dculus/types';

const FIELD_ICONS: Partial<Record<FieldType, React.ReactNode>> = {
  [FieldType.TEXT_INPUT_FIELD]: <Type className="w-4 h-4" />,
  [FieldType.TEXT_AREA_FIELD]: <Type className="w-4 h-4" />,
  [FieldType.EMAIL_FIELD]: <Type className="w-4 h-4" />,
  [FieldType.NUMBER_FIELD]: <Type className="w-4 h-4" />,
  [FieldType.SELECT_FIELD]: <Type className="w-4 h-4" />,
  [FieldType.RADIO_FIELD]: <Type className="w-4 h-4" />,
  [FieldType.CHECKBOX_FIELD]: <Type className="w-4 h-4" />,
  [FieldType.DATE_FIELD]: <Type className="w-4 h-4" />,
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
  [FieldType.FORM_FIELD]: 'Form Field',
};

interface FieldSettingsHeaderProps {
  field: FormField;
  isDirty: boolean;
}

export const FieldSettingsHeader: React.FC<FieldSettingsHeaderProps> = ({ field, isDirty }) => {
  return (
    <div className={`flex-shrink-0 border-b border-gray-200 dark:border-gray-700 p-4 transition-colors duration-200 ${
      isDirty 
        ? 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800' 
        : 'bg-white dark:bg-gray-900'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400">
            {FIELD_ICONS[field.type] || <Type className="w-4 h-4" />}
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">
              {FIELD_TYPE_LABELS[field.type] || 'Field'} Settings
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Configure field properties and validation
            </p>
          </div>
        </div>
        
        {/* Dirty state indicator */}
        <div className="flex items-center justify-end min-w-[120px]">
          <div className={`flex items-center space-x-1 text-orange-600 text-xs transition-all duration-200 ease-in-out ${
            isDirty 
              ? 'opacity-100 transform translate-x-0' 
              : 'opacity-0 transform translate-x-2 pointer-events-none'
          }`}>
            <div className="w-2 h-2 bg-orange-600 rounded-full animate-pulse"></div>
            <span className="font-medium">Unsaved changes</span>
          </div>
        </div>
      </div>
    </div>
  );
};
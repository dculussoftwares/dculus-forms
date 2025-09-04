import React from 'react';
import { FormField, FieldType } from '@dculus/types';
import { Settings } from 'lucide-react';
import {
  TextFieldSettings,
  NumberFieldSettings,
  SelectionFieldSettings,
  DateFieldSettings,
  RichTextFieldSettings
} from './field-settings-v2';

interface FieldSettingsV2Props {
  field: FormField | null;
  isConnected: boolean;
  onUpdate?: (updates: Record<string, any>) => void;
  onFieldSwitch?: () => void;
}

/**
 * Router component that renders the appropriate field-specific settings component
 * based on the field type. This replaces the monolithic FieldSettings component
 * with separate, maintainable components for each field type.
 */
export const FieldSettingsV2: React.FC<FieldSettingsV2Props> = ({
  field,
  isConnected,
  onUpdate,
  onFieldSwitch,
}) => {
  // Show empty state if no field is selected
  if (!field) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <Settings className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Select a field to edit its settings</p>
        </div>
      </div>
    );
  }

  // Route to the appropriate field-specific settings component
  switch (field.type) {
    case FieldType.TEXT_INPUT_FIELD:
    case FieldType.TEXT_AREA_FIELD:
    case FieldType.EMAIL_FIELD:
      return (
        <TextFieldSettings
          field={field as any}
          isConnected={isConnected}
          onUpdate={onUpdate}
          onFieldSwitch={onFieldSwitch}
        />
      );

    case FieldType.NUMBER_FIELD:
      return (
        <NumberFieldSettings
          field={field as any}
          isConnected={isConnected}
          onUpdate={onUpdate}
          onFieldSwitch={onFieldSwitch}
        />
      );

    case FieldType.SELECT_FIELD:
    case FieldType.RADIO_FIELD:
    case FieldType.CHECKBOX_FIELD:
      return (
        <SelectionFieldSettings
          field={field as any}
          isConnected={isConnected}
          onUpdate={onUpdate}
          onFieldSwitch={onFieldSwitch}
        />
      );

    case FieldType.DATE_FIELD:
      return (
        <DateFieldSettings
          field={field as any}
          isConnected={isConnected}
          onUpdate={onUpdate}
          onFieldSwitch={onFieldSwitch}
        />
      );

    case FieldType.RICH_TEXT_FIELD:
      return (
        <RichTextFieldSettings
          field={field as any}
          isConnected={isConnected}
          onUpdate={onUpdate}
          onFieldSwitch={onFieldSwitch}
        />
      );

    default:
      return (
        <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
          <div className="text-center">
            <Settings className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Unsupported field type: {field.type}</p>
            <p className="text-xs mt-1">Please select a different field or contact support</p>
          </div>
        </div>
      );
  }
};

export default FieldSettingsV2;
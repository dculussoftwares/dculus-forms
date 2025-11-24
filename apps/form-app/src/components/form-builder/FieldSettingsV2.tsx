import React from 'react';
import { FormField, FieldType } from '@dculus/types';
import { Settings } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
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
}) => {
  const { t } = useTranslation('fieldSettings');
  // Show empty state if no field is selected
  if (!field) {
    return (
      <div
        className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400"
        data-testid="field-settings-panel"
      >
        <div className="text-center">
          <Settings className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">{t('emptyState.title')}</p>
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
        <div data-testid="field-settings-panel" className="h-full flex flex-col">
          <TextFieldSettings
            field={field as any}
            isConnected={isConnected}
            onUpdate={onUpdate}
          />
        </div>
      );

    case FieldType.NUMBER_FIELD:
      return (
        <NumberFieldSettings
          field={field as any}
          isConnected={isConnected}
          onUpdate={onUpdate}
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
        />
      );

    case FieldType.DATE_FIELD:
      return (
        <div data-testid="field-settings-panel" className="h-full flex flex-col">
          <DateFieldSettings
            field={field as any}
            isConnected={isConnected}
            onUpdate={onUpdate}
          />
        </div>
      );

    case FieldType.RICH_TEXT_FIELD:
      return (
        <div data-testid="field-settings-panel" className="h-full flex flex-col">
          <RichTextFieldSettings
            field={field as any}
            isConnected={isConnected}
            onUpdate={onUpdate}
          />
        </div>
      );

    default:
      return (
        <div
          className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400"
          data-testid="field-settings-panel"
        >
          <div className="text-center">
            <Settings className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">{t('unsupportedField.title', { values: { fieldType: field.type } })}</p>
            <p className="text-xs mt-1">{t('unsupportedField.subtitle')}</p>
          </div>
        </div>
      );
  }
};

export default FieldSettingsV2;

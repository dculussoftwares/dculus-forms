import React from 'react';
import { FormField, FieldType } from '@dculus/types';
import { Settings } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import {
  TextFieldSettings,
  NumberFieldSettings,
  SelectionFieldSettings,
  DateFieldSettings,
  RichTextFieldSettings,
} from './field-settings-v2';

interface FieldSettingsV2Props {
  field: FormField | null;
  isConnected: boolean;
  onUpdate?: (updates: Record<string, any>) => void;
  onDelete?: () => void;
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
  onDelete,
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

  // Wrapper to add delete button to all field settings
  const FieldSettingsWrapper: React.FC<{ children: React.ReactNode }> = ({
    children,
  }) => (
    <div data-testid="field-settings-panel" className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto">{children}</div>
      {onDelete && isConnected && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <button
            onClick={onDelete}
            className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            {t('deleteField.button')}
          </button>
        </div>
      )}
    </div>
  );

  // Route to the appropriate field-specific settings component
  switch (field.type) {
    case FieldType.TEXT_INPUT_FIELD:
    case FieldType.TEXT_AREA_FIELD:
    case FieldType.EMAIL_FIELD:
      return (
        <FieldSettingsWrapper>
          <TextFieldSettings
            field={field as any}
            isConnected={isConnected}
            onUpdate={onUpdate}
          />
        </FieldSettingsWrapper>
      );

    case FieldType.NUMBER_FIELD:
      return (
        <FieldSettingsWrapper>
          <NumberFieldSettings
            field={field as any}
            isConnected={isConnected}
            onUpdate={onUpdate}
          />
        </FieldSettingsWrapper>
      );

    case FieldType.SELECT_FIELD:
    case FieldType.RADIO_FIELD:
    case FieldType.CHECKBOX_FIELD:
      return (
        <FieldSettingsWrapper>
          <SelectionFieldSettings
            field={field as any}
            isConnected={isConnected}
            onUpdate={onUpdate}
          />
        </FieldSettingsWrapper>
      );

    case FieldType.DATE_FIELD:
      return (
        <FieldSettingsWrapper>
          <DateFieldSettings
            field={field as any}
            isConnected={isConnected}
            onUpdate={onUpdate}
          />
        </FieldSettingsWrapper>
      );

    case FieldType.RICH_TEXT_FIELD:
      return (
        <FieldSettingsWrapper>
          <RichTextFieldSettings
            field={field as any}
            isConnected={isConnected}
            onUpdate={onUpdate}
          />
        </FieldSettingsWrapper>
      );

    default:
      return (
        <div
          className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400"
          data-testid="field-settings-panel"
        >
          <div className="text-center">
            <Settings className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              {t('unsupportedField.title', {
                values: { fieldType: field.type },
              })}
            </p>
            <p className="text-xs mt-1">{t('unsupportedField.subtitle')}</p>
          </div>
        </div>
      );
  }
};

export default FieldSettingsV2;

import React from 'react';
import { Type, FileCode, Upload, Phone, Loader2, Check, AlertCircle, CloudOff } from 'lucide-react';
import { FormField, FieldType } from '@dculus/types';
import { useTranslation } from '../../../hooks';
import type { FieldSaveStatus } from '../../../hooks/types';

const FIELD_ICONS: Partial<Record<FieldType, React.ReactNode>> = {
  [FieldType.TEXT_INPUT_FIELD]: <Type className="w-4 h-4" />,
  [FieldType.TEXT_AREA_FIELD]: <Type className="w-4 h-4" />,
  [FieldType.EMAIL_FIELD]: <Type className="w-4 h-4" />,
  [FieldType.NUMBER_FIELD]: <Type className="w-4 h-4" />,
  [FieldType.SELECT_FIELD]: <Type className="w-4 h-4" />,
  [FieldType.RADIO_FIELD]: <Type className="w-4 h-4" />,
  [FieldType.CHECKBOX_FIELD]: <Type className="w-4 h-4" />,
  [FieldType.DATE_FIELD]: <Type className="w-4 h-4" />,
  [FieldType.PHONE_NUMBER_FIELD]: <Phone className="w-4 h-4" />,
  [FieldType.FORM_FIELD]: <Type className="w-4 h-4" />,
  [FieldType.RICH_TEXT_FIELD]: <FileCode className="w-4 h-4" />,
  [FieldType.FILE_UPLOAD_FIELD]: <Upload className="w-4 h-4" />,
};

const getFieldTypeLabels = (t: any) => ({
  [FieldType.TEXT_INPUT_FIELD]: t('fieldTypes.shortText'),
  [FieldType.TEXT_AREA_FIELD]: t('fieldTypes.longText'),
  [FieldType.EMAIL_FIELD]: t('fieldTypes.email'),
  [FieldType.NUMBER_FIELD]: t('fieldTypes.number'),
  [FieldType.SELECT_FIELD]: t('fieldTypes.dropdown'),
  [FieldType.RADIO_FIELD]: t('fieldTypes.radio'),
  [FieldType.CHECKBOX_FIELD]: t('fieldTypes.checkbox'),
  [FieldType.DATE_FIELD]: t('fieldTypes.date'),
  [FieldType.PHONE_NUMBER_FIELD]: t('fieldTypes.phone'),
  [FieldType.FORM_FIELD]: t('fieldTypes.formField'),
  [FieldType.RICH_TEXT_FIELD]: t('fieldTypes.richText'),
  [FieldType.FILE_UPLOAD_FIELD]: t('fieldTypes.fileUpload'),
});

interface FieldSettingsHeaderProps {
  field: FormField;
  saveStatus: FieldSaveStatus;
  isConnected: boolean;
}

const SaveStatusIndicator: React.FC<{ saveStatus: FieldSaveStatus; isConnected: boolean }> = ({
  saveStatus,
  isConnected,
}) => {
  const { t } = useTranslation('fieldSettingsHeader');
  const status = !isConnected ? 'offline' : saveStatus;

  const content: Record<typeof status, React.ReactNode> = {
    idle: null,
    pending: (
      <span className="flex items-center gap-1 text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
        {t('status.saving')}
      </span>
    ),
    saved: (
      <span className="flex items-center gap-1 text-muted-foreground">
        <Check className="w-3 h-3 text-green-600" aria-hidden="true" />
        {t('status.saved')}
      </span>
    ),
    invalid: (
      <span className="flex items-center gap-1 text-destructive">
        <AlertCircle className="w-3 h-3" aria-hidden="true" />
        {t('status.invalid')}
      </span>
    ),
    offline: (
      <span className="flex items-center gap-1 text-yellow-700 dark:text-yellow-400">
        <CloudOff className="w-3 h-3" aria-hidden="true" />
        {t('status.offline')}
      </span>
    ),
  };

  return (
    <div
      data-testid="field-settings-save-status"
      data-status={status}
      role="status"
      aria-live="polite"
      className="flex items-center justify-end min-w-[120px] text-xs font-medium"
    >
      {content[status]}
    </div>
  );
};

export const FieldSettingsHeader: React.FC<FieldSettingsHeaderProps> = ({
  field,
  saveStatus,
  isConnected,
}) => {
  const { t } = useTranslation('fieldSettingsHeader');
  const fieldTypeLabels = getFieldTypeLabels(t);

  return (
    <div
      data-testid="field-settings-header"
      className="flex-shrink-0 border-b border-[var(--tf-border-medium)] dark:border-gray-700 p-4 bg-white dark:bg-gray-900"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-background dark:bg-gray-800 rounded-lg text-foreground dark:text-gray-400">
            {FIELD_ICONS[field.type] || <Type className="w-4 h-4" />}
          </div>
          <div>
            <h3 className="text-sm font-medium text-primary dark:text-white">
              {(fieldTypeLabels as any)[field.type] || 'Field'}{' '}
              {t('header.settings')}
            </h3>
            <p className="text-xs text-muted-foreground dark:text-gray-400">
              {t('header.configure')}
            </p>
          </div>
        </div>

        <SaveStatusIndicator saveStatus={saveStatus} isConnected={isConnected} />
      </div>
    </div>
  );
};

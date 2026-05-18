import React from 'react';
import {
  FormField,
  FieldType,
  FileUploadField,
  TextInputField,
  TextAreaField,
  EmailField,
  NumberField,
  SelectField,
  RadioField,
  CheckboxField,
  DateField,
  RichTextFormField,
} from '@dculus/types';
import { Settings } from 'lucide-react';
import { Controller } from 'react-hook-form';
import { Button, Label, Checkbox } from '@dculus/ui';
import { useTranslation } from '../../hooks/useTranslation';
import { useFormPermissions } from '../../hooks/useFormPermissions';
import { useFieldEditor } from '../../hooks';
import {
  ValidationSummary,
  FieldSettingsHeader,
  FieldSettingsFooter,
  FormInputField,
  useFieldSettingsConstants,
} from './field-settings';
import {
  TextFieldSettings,
  NumberFieldSettings,
  SelectionFieldSettings,
  DateFieldSettings,
  RichTextFieldSettings,
} from './field-settings-v2';

/** Common MIME type options for the file upload field settings UI */
const MIME_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'image/*', label: 'Images (all)' },
  { value: 'image/jpeg', label: 'JPEG' },
  { value: 'image/png', label: 'PNG' },
  { value: 'image/webp', label: 'WebP' },
  { value: 'image/gif', label: 'GIF' },
  { value: 'application/pdf', label: 'PDF' },
  { value: 'application/msword', label: 'Word (.doc)' },
  {
    value:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    label: 'Word (.docx)',
  },
  { value: 'application/vnd.ms-excel', label: 'Excel (.xls)' },
  {
    value: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    label: 'Excel (.xlsx)',
  },
  { value: 'text/plain', label: 'Text (.txt)' },
  { value: 'text/csv', label: 'CSV' },
  { value: 'video/*', label: 'Videos (all)' },
  { value: 'audio/*', label: 'Audio (all)' },
];

interface FileUploadFieldSettingsInnerProps {
  field: FileUploadField;
  isConnected: boolean;
  isReadOnly?: boolean;
  onUpdate?: (updates: Record<string, any>) => void;
}

const FileUploadFieldSettingsInner: React.FC<
  FileUploadFieldSettingsInnerProps
> = ({ field, isConnected, isReadOnly = false, onUpdate }) => {
  const constants = useFieldSettingsConstants();
  const isEditable = isConnected && !isReadOnly;
  const {
    form,
    isSaving,
    isValid,
    errors: formErrors,
    handleSave,
    handleCancel,
    handleReset,
  } = useFieldEditor({
    field,
    onSave: (updates) => onUpdate?.(updates),
    onCancel: () => {},
  });

  const errors = formErrors as any;
  const {
    control,
    watch,
    setValue,
    formState: { isDirty },
  } = form;
  const allowedMimeTypes: string[] = watch('allowedMimeTypes') || [];

  const toggleMimeType = (value: string) => {
    const next = allowedMimeTypes.includes(value)
      ? allowedMimeTypes.filter((m) => m !== value)
      : [...allowedMimeTypes, value];
    setValue('allowedMimeTypes', next, { shouldDirty: true });
  };

  return (
    <div className="h-full flex flex-col">
      <FieldSettingsHeader field={field} isDirty={isDirty} />

      <div className="flex-1 overflow-y-auto">
        <form
          onSubmit={handleSave}
          className={`p-4 space-y-6 transition-all duration-200 ${
            isDirty
              ? 'bg-gradient-to-b from-orange-25 to-transparent dark:from-orange-950/10'
              : ''
          }`}
        >
          {!isValid && Object.keys(errors).length > 0 && (
            <ValidationSummary errors={errors} />
          )}

          {/* Basic Settings */}
          <div className={constants.CSS_CLASSES.SECTION_SPACING}>
            <h4 className={constants.CSS_CLASSES.SECTION_TITLE}>
              {constants.SECTION_TITLES.BASIC_SETTINGS}
            </h4>

            <FormInputField
              name="label"
              label={constants.LABELS.LABEL}
              placeholder={constants.PLACEHOLDERS.FIELD_LABEL}
              multiline={true}
              rows={2}
              control={control}
              error={errors.label}
              disabled={!isEditable}
            />

            <FormInputField
              name="hint"
              label={constants.LABELS.HELP_TEXT}
              placeholder={constants.PLACEHOLDERS.HELP_TEXT}
              multiline={true}
              rows={2}
              control={control}
              error={errors.hint}
              disabled={!isEditable}
            />
          </div>

          {/* Validation */}
          <div className={constants.CSS_CLASSES.SECTION_SPACING}>
            <h4 className={constants.CSS_CLASSES.SECTION_TITLE}>
              {constants.SECTION_TITLES.VALIDATION}
            </h4>

            <div className="flex items-center space-x-2">
              <Controller
                name="required"
                control={control}
                render={({ field: ctrl }) => (
                  <Checkbox
                    id="file-upload-required"
                    checked={ctrl.value || false}
                    onCheckedChange={ctrl.onChange}
                    disabled={!isEditable}
                  />
                )}
              />
              <Label
                htmlFor="file-upload-required"
                className={constants.CSS_CLASSES.LABEL_STYLE}
              >
                {constants.LABELS.REQUIRED_FIELD}
              </Label>
            </div>
          </div>

          {/* Upload Constraints */}
          <div className={constants.CSS_CLASSES.SECTION_SPACING}>
            <h4 className={constants.CSS_CLASSES.SECTION_TITLE}>
              {constants.SECTION_TITLES.FILE_UPLOAD_SETTINGS}
            </h4>

            <FormInputField
              name="maxFileSizeMb"
              label={constants.LABELS.MAX_FILE_SIZE_MB}
              placeholder="5"
              type="number"
              min="1"
              max="50"
              control={control}
              error={errors.maxFileSizeMb}
              disabled={!isEditable}
              transform={{
                output: (v: string) => (v === '' ? undefined : parseInt(v)),
              }}
            />

            <FormInputField
              name="maxFiles"
              label={constants.LABELS.MAX_FILES}
              placeholder="1"
              type="number"
              min="1"
              max="10"
              control={control}
              error={errors.maxFiles}
              disabled={!isEditable}
              transform={{
                output: (v: string) => (v === '' ? undefined : parseInt(v)),
              }}
            />

            {/* Allowed File Types */}
            <div className="space-y-2">
              <Label className={constants.CSS_CLASSES.LABEL_STYLE}>
                {constants.LABELS.ALLOWED_FILE_TYPES}
              </Label>
              <p className="text-xs text-muted-foreground dark:text-gray-400">
                Leave all unchecked to allow any file type.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {MIME_TYPE_OPTIONS.map(({ value, label }) => (
                  <div key={value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`mime-${value}`}
                      checked={allowedMimeTypes.includes(value)}
                      onCheckedChange={() => toggleMimeType(value)}
                      disabled={!isEditable}
                    />
                    <Label
                      htmlFor={`mime-${value}`}
                      className="text-xs text-foreground dark:text-gray-300 cursor-pointer"
                    >
                      {label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="pb-4" />
        </form>
      </div>

      <FieldSettingsFooter
        isDirty={isDirty}
        isValid={isValid}
        isConnected={isConnected}
        isReadOnly={isReadOnly}
        isSaving={isSaving}
        errors={errors}
        onReset={handleReset}
        onCancel={handleCancel}
        onSave={handleSave}
      />
    </div>
  );
};

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
  const permissions = useFormPermissions();
  const canEdit = permissions.canEditFields();
  const isReadOnly = !canEdit;
  const updateHandler = canEdit ? onUpdate : undefined;
  const deleteHandler = canEdit ? onDelete : undefined;
  // Show empty state if no field is selected
  if (!field) {
    return (
      <div
        className="h-full flex items-center justify-center text-muted-foreground dark:text-gray-400"
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
      {deleteHandler && isConnected && (
        <div className="border-t border-[var(--tf-border-medium)] dark:border-gray-700 p-4">
          <Button
            onClick={deleteHandler}
            className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center justify-center gap-2"
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
          </Button>
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
            field={field as TextInputField | TextAreaField | EmailField}
            isConnected={isConnected}
            isReadOnly={isReadOnly}
            onUpdate={updateHandler}
          />
        </FieldSettingsWrapper>
      );

    case FieldType.NUMBER_FIELD:
      return (
        <FieldSettingsWrapper>
          <NumberFieldSettings
            field={field as NumberField}
            isConnected={isConnected}
            isReadOnly={isReadOnly}
            onUpdate={updateHandler}
          />
        </FieldSettingsWrapper>
      );

    case FieldType.SELECT_FIELD:
    case FieldType.RADIO_FIELD:
    case FieldType.CHECKBOX_FIELD:
      return (
        <FieldSettingsWrapper>
          <SelectionFieldSettings
            field={field as SelectField | RadioField | CheckboxField}
            isConnected={isConnected}
            isReadOnly={isReadOnly}
            onUpdate={updateHandler}
          />
        </FieldSettingsWrapper>
      );

    case FieldType.DATE_FIELD:
      return (
        <FieldSettingsWrapper>
          <DateFieldSettings
            field={field as DateField}
            isConnected={isConnected}
            isReadOnly={isReadOnly}
            onUpdate={updateHandler}
          />
        </FieldSettingsWrapper>
      );

    case FieldType.RICH_TEXT_FIELD:
      return (
        <FieldSettingsWrapper>
          <RichTextFieldSettings
            field={field as RichTextFormField}
            isConnected={isConnected}
            isReadOnly={isReadOnly}
            onUpdate={updateHandler}
          />
        </FieldSettingsWrapper>
      );

    case FieldType.FILE_UPLOAD_FIELD:
      return (
        <FieldSettingsWrapper>
          <FileUploadFieldSettingsInner
            field={field as FileUploadField}
            isConnected={isConnected}
            isReadOnly={isReadOnly}
            onUpdate={updateHandler}
          />
        </FieldSettingsWrapper>
      );

    default:
      return (
        <div
          className="h-full flex items-center justify-center text-muted-foreground dark:text-gray-400"
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

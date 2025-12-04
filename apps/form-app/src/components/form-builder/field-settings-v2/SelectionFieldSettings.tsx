import React, { useEffect, useRef, useCallback } from 'react';
import { SelectField, RadioField, CheckboxField } from '@dculus/types';
import { Settings } from 'lucide-react';
import { Controller } from 'react-hook-form';
import { 
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Checkbox
} from '@dculus/ui';
import { useFieldEditor } from '../../../hooks';
import {
  ValidationSummary,
  FieldSettingsHeader,
  FieldSettingsFooter,
  FormInputField,
  OptionsSettings,
  useFieldSettingsConstants
} from '../field-settings';

interface SelectionFieldSettingsProps {
  field: SelectField | RadioField | CheckboxField | null;
  isConnected: boolean;
  onUpdate?: (updates: Record<string, any>) => void;
  onFieldSwitch?: () => void;
}

/**
 * Specialized settings component for selection-based fields
 * Handles SELECT_FIELD, RADIO_FIELD, and CHECKBOX_FIELD types
 */
const SelectionFieldSettings: React.FC<SelectionFieldSettingsProps> = ({
  field,
  isConnected,
  onUpdate,
  onFieldSwitch: _onFieldSwitch,
}) => {
  const constants = useFieldSettingsConstants();
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
    onSave: async (updates) => {
      if (onUpdate) {
        await onUpdate(updates);
      }
    },
    onCancel: () => console.log('Selection field edit cancelled'),
  });

  // Cast errors to any to handle union type properties
  const errors = formErrors as any;

  const { control, watch, setValue, getValues, formState: { isDirty } } = form;
  const options = watch('options') || [];

  // Option management functions
  const addOption = useCallback(() => {
    const currentOptions = getValues('options') || [];
    setValue('options', [...currentOptions, ''], { shouldDirty: true });
  }, [getValues, setValue]);

  const updateOption = useCallback((index: number, value: string) => {
    const currentOptions = getValues('options') || [];
    const newOptions = [...currentOptions];
    newOptions[index] = value;
    setValue('options', newOptions, { shouldDirty: true });
  }, [getValues, setValue]);

  const removeOption = useCallback((index: number) => {
    const currentOptions = getValues('options') || [];
    const newOptions = currentOptions.filter((_, i) => i !== index);
    // Ensure at least one option remains
    if (newOptions.length === 0) {
      newOptions.push('');
    }
    setValue('options', newOptions, { shouldDirty: true });
  }, [getValues, setValue]);

  // Track field changes (auto-save disabled)
  const fieldIdRef = useRef<string | null>(null);
  useEffect(() => {
    // Track field changes without auto-save
    fieldIdRef.current = field?.id || null;
  }, [field?.id]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'Escape') {
        handleCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, handleCancel]);

  if (!field) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <Settings className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">{constants.INFO_MESSAGES.SELECT_FIELD_TO_EDIT}</p>
        </div>
      </div>
    );
  }

  const isCheckboxField = field.type === 'checkbox_field';
  const isSingleSelectionField = field.type === 'select_field' || field.type === 'radio_field';

  return (
    <div data-testid="field-settings-panel" className="h-full flex flex-col">
      <div className="h-full flex flex-col">
        <FieldSettingsHeader field={field} isDirty={isDirty} />

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <form onSubmit={handleSave} className={`p-4 space-y-6 transition-all duration-200 ${
            isDirty ? 'bg-gradient-to-b from-orange-25 to-transparent dark:from-orange-950/10' : ''
          }`}>
            {/* Validation Error Summary */}
            {!isValid && Object.keys(errors).length > 0 && (
              <ValidationSummary errors={errors} />
            )}

            {/* Basic Settings */}
            <div className={constants.CSS_CLASSES.SECTION_SPACING}>
              <h4 className={constants.CSS_CLASSES.SECTION_TITLE}>
                {constants.SECTION_TITLES.BASIC_SETTINGS}
              </h4>
              
              {/* Label */}
              <FormInputField
                name="label"
                label={constants.LABELS.LABEL}
                placeholder={constants.PLACEHOLDERS.FIELD_LABEL}
                control={control}
                error={errors.label}
                disabled={!isConnected}
              />

              {/* Hint */}
              <FormInputField
                name="hint"
                label={constants.LABELS.HELP_TEXT}
                placeholder={constants.PLACEHOLDERS.HELP_TEXT}
                multiline={true}
                rows={2}
                control={control}
                error={errors.hint}
                disabled={!isConnected}
              />


              {/* Default Value - Dropdown for single selection fields (Radio and Select) */}
              {isSingleSelectionField && (
                <div className="space-y-2">
                  <Label className={constants.CSS_CLASSES.LABEL_STYLE}>
                    {constants.LABELS.DEFAULT_VALUE}
                  </Label>
                  <Controller
                    name="defaultValue"
                    control={control}
                    render={({ field: controllerField }) => (
                      <Select
                        value={typeof controllerField.value === 'string' ? controllerField.value || '__no_default__' : '__no_default__'}
                        onValueChange={(value) => {
                          // Convert the special "no default" value back to empty string
                          const actualValue = value === '__no_default__' ? '' : value;
                          controllerField.onChange(actualValue);
                        }}
                        disabled={!isConnected}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={constants.PLACEHOLDERS.SELECT_DEFAULT_OPTION} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__no_default__">{constants.PLACEHOLDERS.SELECT_DEFAULT_OPTION}</SelectItem>
                          {options.length === 0 ? (
                            <SelectItem value="__no_options__" disabled>
                              Add options first to set default value
                            </SelectItem>
                          ) : (
                            options
                              .filter((option: any) => {
                                // Only show options that have actual content
                                const optionValue = option.value || option.label || option.text || option;
                                return optionValue && String(optionValue).trim();
                              })
                              .map((option: any, index: number) => {
                                // Use the actual option properties as they exist
                                const optionValue = option.value || option.label || option.text || option;
                                const optionLabel = option.label || option.value || option.text || option;
                                
                                return (
                                  <SelectItem key={option.id || index} value={String(optionValue)}>
                                    {String(optionLabel)}
                                  </SelectItem>
                                );
                              })
                          )}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.defaultValue && (
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {errors.defaultValue.message}
                    </p>
                  )}
                </div>
              )}

              {/* Default Value - Multiple selection for Checkbox fields */}
              {field.type === 'checkbox_field' && (
                <div className="space-y-2">
                  <Label className={constants.CSS_CLASSES.LABEL_STYLE}>
                    {constants.LABELS.DEFAULT_VALUE}
                  </Label>
                  <Controller
                    name="defaultValue"
                    control={control}
                    render={({ field: controllerField }) => {
                      const selectedValues = Array.isArray(controllerField.value) ? controllerField.value : [];
                      
                      return (
                        <div className="space-y-2 max-h-40 overflow-y-auto border border-input rounded-md p-3 bg-background">
                          {options.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              Add options first to set default selections
                            </p>
                          ) : (
                            options
                              .filter((option: any) => {
                                // Only show options that have actual content
                                const optionValue = option.value || option.label || option.text || option;
                                return optionValue && String(optionValue).trim();
                              })
                              .map((option: any, index: number) => {
                                // Use the actual option properties as they exist
                                const optionValue = option.value || option.label || option.text || option;
                                const optionLabel = option.label || option.value || option.text || option;
                                
                                return (
                                  <div key={option.id || index} className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`default-${option.id || index}`}
                                      checked={selectedValues.includes(String(optionValue))}
                                      onCheckedChange={(checked) => {
                                        const value = String(optionValue);
                                        let newValues;
                                        if (checked) {
                                          newValues = [...selectedValues, value];
                                        } else {
                                          newValues = selectedValues.filter((val: string) => val !== value);
                                        }
                                        controllerField.onChange(newValues);
                                      }}
                                      disabled={!isConnected}
                                    />
                                    <Label 
                                      htmlFor={`default-${option.id || index}`}
                                      className="text-sm font-medium text-foreground cursor-pointer"
                                    >
                                      {String(optionLabel)}
                                    </Label>
                                  </div>
                                );
                              })
                          )}
                        </div>
                      );
                    }}
                  />
                  {errors.defaultValue && (
                    <p className="text-sm text-destructive">
                      {errors.defaultValue.message}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Options Management */}
            <div className={constants.CSS_CLASSES.SECTION_SPACING}>
              <OptionsSettings
                control={control}
                errors={errors}
                isConnected={isConnected}
                options={options}
                addOption={addOption}
                updateOption={updateOption}
                removeOption={removeOption}
              />
              
              {/* Show validation error for empty options */}
              {errors.options && (
                <div className="text-sm text-destructive mt-2 p-3 bg-destructive/10 rounded-md border border-destruct ive/20">
                  <p className="font-medium">⚠️ Options Error:</p>
                  <p>{errors.options.message}</p>
                </div>
              )}
            </div>

            {/* Selection Limits (for checkbox fields) */}
            {isCheckboxField && (
              <div className={constants.CSS_CLASSES.SECTION_SPACING}>
                <h4 className={constants.CSS_CLASSES.SECTION_TITLE}>
                  Selection Limits
                </h4>
                
                <div className="grid grid-cols-2 gap-4">
                  {/* Minimum Selections */}
                  <FormInputField
                    name="validation.minSelections"
                    label={constants.LABELS.MINIMUM}
                    placeholder={constants.PLACEHOLDERS.NO_MINIMUM}
                    type="number"
                    min="0"
                    control={control}
                    error={(errors.validation as any)?.minSelections}
                    disabled={!isConnected}
                    transform={{
                      output: (value: string) => value === '' ? undefined : parseInt(value)
                    }}
                  />

                  {/* Maximum Selections */}
                  <FormInputField
                    name="validation.maxSelections"
                    label={constants.LABELS.MAXIMUM}
                    placeholder={constants.PLACEHOLDERS.NO_MAXIMUM}
                    type="number"
                    min="1"
                    control={control}
                    error={(errors.validation as any)?.maxSelections}
                    disabled={!isConnected}
                    transform={{
                      output: (value: string) => value === '' ? undefined : parseInt(value)
                    }}
                  />
                </div>
              </div>
            )}

            {/* Validation Settings */}
            <div className={constants.CSS_CLASSES.SECTION_SPACING}>
              <h4 className={constants.CSS_CLASSES.SECTION_TITLE}>
                {constants.SECTION_TITLES.VALIDATION}
              </h4>
              
              {/* Required field toggle */}
              <div className="flex items-center space-x-2">
                <Controller
                  name="required"
                  control={control}
                  render={({ field: controllerField }) => (
                    <Checkbox
                      id="field-required"
                      checked={controllerField.value || false}
                      onCheckedChange={controllerField.onChange}
                      disabled={!isConnected}
                    />
                  )}
                />
                <Label 
                  htmlFor="field-required" 
                  className={constants.CSS_CLASSES.LABEL_STYLE}
                >
                  {constants.LABELS.REQUIRED_FIELD}
                </Label>
              </div>
            </div>

            {/* Add some bottom padding to prevent content from being hidden behind the floating actions */}
            <div className="pb-4"></div>
          </form>
        </div>

        <FieldSettingsFooter
          isDirty={isDirty}
          isValid={isValid}
          isConnected={isConnected}
          isSaving={isSaving}
          errors={errors}
          onReset={handleReset}
          onCancel={handleCancel}
          onSave={handleSave}
        />
      </div>
    </div>
  );
};

export default SelectionFieldSettings;
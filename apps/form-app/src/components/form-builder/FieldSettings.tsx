import React, { useEffect, useRef } from 'react';
import { FormField } from '@dculus/types';
import { Settings } from 'lucide-react';
import { useFieldEditor } from '../../hooks/useFieldEditor';
import {
  ValidationSummary,
  BasicSettings,
  FieldTypeSpecificSettings,
  ValidationSettings,
  FieldSettingsHeader,
  FieldSettingsFooter
} from './field-settings';


interface FieldSettingsProps {
  field: FormField | null;
  isConnected: boolean;
  onUpdate?: (updates: Record<string, any>) => void;
  onFieldSwitch?: () => void;
}

export const FieldSettings: React.FC<FieldSettingsProps> = ({
  field,
  isConnected,
  onUpdate,
  onFieldSwitch: _onFieldSwitch,
}) => {
  const {
    form,
    isSaving,
    isValid,
    errors,
    handleSave,
    handleCancel,
    handleReset,
    handleAutoSave,
    addOption,
    updateOption,
    removeOption,
  } = useFieldEditor({
    field,
    onSave: (updates) => onUpdate?.(updates),
    onCancel: () => console.log('Edit cancelled'),
  });

  const { control, watch, formState: { isDirty } } = form;
  const options = watch('options') || [];

  // Handle auto-save when switching fields - only save when field actually changes
  const fieldIdRef = useRef<string | null>(null);
  useEffect(() => {
    // If we're switching from one field to another (not initial mount)
    if (fieldIdRef.current && fieldIdRef.current !== field?.id && isDirty && isValid) {
      handleAutoSave();
    }
    fieldIdRef.current = field?.id || null;
  }, [field?.id, isDirty, isValid, handleAutoSave]);

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
          <p className="text-sm">Select a field to edit its settings</p>
        </div>
      </div>
    );
  }

  return (
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
          <BasicSettings
            control={control}
            errors={errors}
            isConnected={isConnected}
            field={field}
            watch={watch}
          />

          {/* Field-specific settings */}
          <FieldTypeSpecificSettings
            field={field}
            control={control}
            errors={errors}
            isConnected={isConnected}
            options={options}
            addOption={addOption}
            updateOption={updateOption}
            removeOption={removeOption}
          />

          {/* Validation */}
          <ValidationSettings control={control} isConnected={isConnected} errors={errors} field={field} />

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
  );
};

export default FieldSettings;

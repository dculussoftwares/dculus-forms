import React, { useEffect, useRef } from 'react';
import { Controller } from 'react-hook-form';
import { FormField, FieldType } from '@dculus/types';
import { Button, Input, Label, Textarea } from '@dculus/ui';
import {
  Type,
  FileText,
  Mail,
  Hash,
  ChevronDown,
  Circle,
  CheckSquare,
  Calendar,
  Settings,
  Plus,
  X,
  Save,
  RotateCcw,
  AlertCircle,
  AlertTriangle
} from 'lucide-react';
import { useFieldEditor } from '../../hooks/useFieldEditor';

const FIELD_ICONS: Partial<Record<FieldType, React.ReactNode>> = {
  [FieldType.TEXT_INPUT_FIELD]: <Type className="w-4 h-4" />,
  [FieldType.TEXT_AREA_FIELD]: <FileText className="w-4 h-4" />,
  [FieldType.EMAIL_FIELD]: <Mail className="w-4 h-4" />,
  [FieldType.NUMBER_FIELD]: <Hash className="w-4 h-4" />,
  [FieldType.SELECT_FIELD]: <ChevronDown className="w-4 h-4" />,
  [FieldType.RADIO_FIELD]: <Circle className="w-4 h-4" />,
  [FieldType.CHECKBOX_FIELD]: <CheckSquare className="w-4 h-4" />,
  [FieldType.DATE_FIELD]: <Calendar className="w-4 h-4" />,
  [FieldType.FORM_FIELD]: <Type className="w-4 h-4" />,
};

const FIELD_TYPE_LABELS: Partial<Record<FieldType, string>> = {
  [FieldType.TEXT_INPUT_FIELD]: 'Short Text',
  [FieldType.TEXT_AREA_FIELD]: 'Long Text',
  [FieldType.EMAIL_FIELD]: 'Email',
  [FieldType.NUMBER_FIELD]: 'Number',
  [FieldType.SELECT_FIELD]: 'Dropdown',
  [FieldType.RADIO_FIELD]: 'Multiple Choice',
  [FieldType.CHECKBOX_FIELD]: 'Checkbox',
  [FieldType.DATE_FIELD]: 'Date',
  [FieldType.FORM_FIELD]: 'Form Field',
};

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


  // Render error message
  const renderError = (error?: any) => {
    const errorMessage = error?.message || (typeof error === 'string' ? error : null);
    if (!errorMessage) return null;
    return (
      <div className="flex items-center space-x-1 text-red-600 dark:text-red-400 text-xs mt-1 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md animate-in slide-in-from-top-2 duration-200">
        <AlertCircle className="w-3 h-3 flex-shrink-0" />
        <span className="font-medium">{errorMessage}</span>
      </div>
    );
  };

  // Render validation error summary for complex validation issues
  const renderValidationSummary = () => {
    const errorMessages = Object.entries(errors)
      .filter(([_, error]) => {
        // Handle both direct error messages and nested error objects
        const message = error?.message || (typeof error === 'string' ? error : null);
        return Boolean(message);
      })
      .map(([field, error]) => ({
        field,
        message: error?.message || (typeof error === 'string' ? error : ''),
        isGlobalError: ['minDate', 'maxDate', 'defaultValue', 'min', 'max', 'options'].includes(field)
      }));

    if (errorMessages.length === 0) return null;

    const globalErrors = errorMessages.filter(err => err.isGlobalError);
    const fieldErrors = errorMessages.filter(err => !err.isGlobalError);

    return (
      <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <div className="flex items-start space-x-2">
          <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h4 className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
              Please fix the following issues to save:
            </h4>
            <ul className="space-y-1 text-sm text-red-700 dark:text-red-300">
              {globalErrors.map((err, index) => (
                <li key={index} className="flex items-start space-x-1">
                  <span className="text-red-500 mt-1">•</span>
                  <span>{String(err.message)}</span>
                </li>
              ))}
              {fieldErrors.map((err, index) => (
                <li key={index} className="flex items-start space-x-1">
                  <span className="text-red-500 mt-1">•</span>
                  <span>
                    <strong className="capitalize">{err.field}:</strong> {String(err.message)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  };

  // Render default value input based on field type
  const renderDefaultValueInput = () => (
    <Controller
      name="defaultValue"
      control={control}
      render={({ field: controlField }) => {
        if (field?.type === FieldType.DATE_FIELD) {
          const minDateValue = watch('minDate');
          const maxDateValue = watch('maxDate');
          
          return (
            <Input
              {...controlField}
              id="field-default"
              type="date"
              min={minDateValue || undefined}
              max={maxDateValue || undefined}
              disabled={!isConnected}
              className={`text-sm ${errors.defaultValue ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
              value={controlField.value || ''}
            />
          );
        }
        
        return (
          <Input
            {...controlField}
            id="field-default"
            placeholder="Default value"
            disabled={!isConnected}
            className={`text-sm ${errors.defaultValue ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
            value={controlField.value || ''}
          />
        );
      }}
    />
  );

  // Render placeholder settings for text-based fields
  const renderTextInputSettings = () => (
    <div className="space-y-2">
      <Label htmlFor="field-placeholder" className="text-xs font-medium text-gray-700 dark:text-gray-300">
        Placeholder
      </Label>
      <Controller
        name="placeholder"
        control={control}
        render={({ field }) => (
          <Input
            {...field}
            id="field-placeholder"
            placeholder="Placeholder text"
            disabled={!isConnected}
            className="text-sm"
            value={field.value || ''}
          />
        )}
      />
      {renderError(errors.placeholder?.message)}
    </div>
  );

  // Render prefix settings
  const renderPrefixSettings = () => (
    <div className="space-y-2">
      <Label htmlFor="field-prefix" className="text-xs font-medium text-gray-700 dark:text-gray-300">
        Prefix
      </Label>
      <Controller
        name="prefix"
        control={control}
        render={({ field }) => (
          <Input
            {...field}
            id="field-prefix"
            placeholder="e.g., $, @"
            disabled={!isConnected}
            className="text-sm"
            value={field.value || ''}
          />
        )}
      />
      {renderError(errors.prefix?.message)}
    </div>
  );

  // Render options settings for select/radio/checkbox fields
  const renderOptionsSettings = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-900 dark:text-white">Options</h4>
        <Button
          size="sm"
          variant="ghost"
          onClick={addOption}
          disabled={!isConnected}
          className="h-8 px-2"
          type="button"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add
        </Button>
      </div>
      
      <div className="space-y-2">
        {options.map((option: string, index: number) => (
          <div key={index} className="flex items-center space-x-2">
            <Input
              value={option}
              onChange={(e) => updateOption(index, e.target.value)}
              placeholder={`Option ${index + 1}`}
              disabled={!isConnected}
              className="text-sm flex-1"
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={() => removeOption(index)}
              disabled={!isConnected}
              className="h-8 w-8 text-gray-500 hover:text-red-600"
              type="button"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>
      {renderError(errors.options?.message)}
    </div>
  );

  // Render multiple selection checkbox for select/checkbox fields
  const renderMultipleSelectionSettings = () => (
    <div className="flex items-center space-x-2">
      <Controller
        name="multiple"
        control={control}
        render={({ field }) => (
          <input
            type="checkbox"
            id="field-multiple"
            checked={field.value || false}
            onChange={field.onChange}
            disabled={!isConnected}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
          />
        )}
      />
      <Label htmlFor="field-multiple" className="text-xs font-medium text-gray-700 dark:text-gray-300">
        Allow multiple selections
      </Label>
    </div>
  );

  // Render number range settings
  const renderNumberRangeSettings = () => (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-gray-900 dark:text-white">Number Range</h4>
      
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="field-min" className="text-xs font-medium text-gray-700 dark:text-gray-300">
            Minimum
          </Label>
          <Controller
            name="min"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                id="field-min"
                type="number"
                placeholder="Min"
                disabled={!isConnected}
                className={`text-sm ${errors.min ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                value={field.value || ''}
              />
            )}
          />
          {renderError(errors.min?.message)}
        </div>
        <div className="space-y-2">
          <Label htmlFor="field-max" className="text-xs font-medium text-gray-700 dark:text-gray-300">
            Maximum
          </Label>
          <Controller
            name="max"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                id="field-max"
                type="number"
                placeholder="Max"
                disabled={!isConnected}
                className={`text-sm ${errors.max ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                value={field.value || ''}
              />
            )}
          />
          {renderError(errors.max?.message)}
        </div>
      </div>
    </div>
  );

  // Render date range settings
  const renderDateRangeSettings = () => (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-gray-900 dark:text-white">Date Range</h4>
      
      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="field-min-date" className="text-xs font-medium text-gray-700 dark:text-gray-300">
            Minimum Date
          </Label>
          <Controller
            name="minDate"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                id="field-min-date"
                type="date"
                disabled={!isConnected}
                className={`text-sm ${errors.minDate ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                value={field.value || ''}
              />
            )}
          />
          {renderError(errors.minDate?.message)}
        </div>
        <div className="space-y-2">
          <Label htmlFor="field-max-date" className="text-xs font-medium text-gray-700 dark:text-gray-300">
            Maximum Date
          </Label>
          <Controller
            name="maxDate"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                id="field-max-date"
                type="date"
                disabled={!isConnected}
                className={`text-sm ${errors.maxDate ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                value={field.value || ''}
              />
            )}
          />
          {renderError(errors.maxDate?.message)}
        </div>
      </div>
    </div>
  );

  // Main render function for field-specific settings
  const renderFieldSpecificSettings = () => {
    switch (field?.type) {
      case FieldType.TEXT_INPUT_FIELD:
        return (
          <>
            {renderTextInputSettings()}
            {renderPrefixSettings()}
          </>
        );

      case FieldType.TEXT_AREA_FIELD:
        return (
          <>
            {renderTextInputSettings()}
            {renderPrefixSettings()}
          </>
        );

      case FieldType.EMAIL_FIELD:
        return renderTextInputSettings();

      case FieldType.NUMBER_FIELD:
        return (
          <>
            {renderTextInputSettings()}
            {renderPrefixSettings()}
            {renderNumberRangeSettings()}
          </>
        );

      case FieldType.SELECT_FIELD:
        return (
          <>
            {renderOptionsSettings()}
            {renderMultipleSelectionSettings()}
          </>
        );

      case FieldType.RADIO_FIELD:
        return renderOptionsSettings();

      case FieldType.CHECKBOX_FIELD:
        return renderOptionsSettings();

      case FieldType.DATE_FIELD:
        return renderDateRangeSettings();

      default:
        return null;
    }
  };

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
      {/* Fixed Field Type Header */}
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
          
          {/* Dirty state indicator - Fixed space to prevent layout shift */}
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

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <form onSubmit={handleSave} className={`p-4 space-y-6 transition-all duration-200 ${
          isDirty ? 'bg-gradient-to-b from-orange-25 to-transparent dark:from-orange-950/10' : ''
        }`}>

          {/* Validation Error Summary */}
          {!isValid && Object.keys(errors).length > 0 && renderValidationSummary()}

          {/* Basic Settings */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">Basic Settings</h4>
            
            {/* Label */}
            <div className="space-y-2">
              <Label htmlFor="field-label" className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Label
              </Label>
              <Controller
                name="label"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    id="field-label"
                    placeholder="Field label"
                    disabled={!isConnected}
                    className="text-sm"
                    value={field.value || ''}
                  />
                )}
              />
              {renderError(errors.label?.message)}
            </div>

            {/* Hint */}
            <div className="space-y-2">
              <Label htmlFor="field-hint" className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Help Text
              </Label>
              <Controller
                name="hint"
                control={control}
                render={({ field }) => (
                  <Textarea
                    {...field}
                    id="field-hint"
                    placeholder="Help text for this field"
                    disabled={!isConnected}
                    className="text-sm resize-none"
                    rows={2}
                    value={field.value || ''}
                  />
                )}
              />
              {renderError(errors.hint?.message)}
            </div>

            {/* Default Value */}
            <div className="space-y-2">
              <Label htmlFor="field-default" className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Default Value
              </Label>
              {renderDefaultValueInput()}
              {renderError(errors.defaultValue?.message)}
            </div>
          </div>

          {/* Field-specific settings */}
          {renderFieldSpecificSettings()}

          {/* Validation */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">Validation</h4>
            
            <div className="flex items-center space-x-2">
              <Controller
                name="required"
                control={control}
                render={({ field }) => (
                  <input
                    type="checkbox"
                    id="field-required"
                    checked={field.value || false}
                    onChange={field.onChange}
                    disabled={!isConnected}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                )}
              />
              <Label htmlFor="field-required" className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Required field
              </Label>
            </div>
          </div>

          {/* Add some bottom padding to prevent content from being hidden behind the floating actions */}
          <div className="pb-4"></div>
        </form>
      </div>

      {/* Fixed/Floating Form Actions Section */}
      <div className={`flex-shrink-0 border-t p-4 space-y-4 transition-all duration-200 ${
        isDirty 
          ? 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800 shadow-lg' 
          : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700'
      }`}>
        {/* Form Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={!isDirty || !isConnected}
              className="text-gray-500 hover:text-gray-700"
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              Reset
            </Button>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={!isDirty || !isConnected}
            >
              Cancel
            </Button>
            <div className="relative group">
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={!isDirty || !isValid || !isConnected || isSaving}
                className={`transition-all duration-200 ${
                  isDirty 
                    ? 'bg-orange-600 hover:bg-orange-700 ring-2 ring-orange-200 dark:ring-orange-800 scale-105' 
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-1" />
                    Save
                  </>
                )}
              </Button>
              {/* Tooltip for disabled save button */}
              {isDirty && !isValid && Object.keys(errors).length > 0 && (
                <div className="absolute bottom-full right-0 mb-2 p-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                  <div className="flex items-center space-x-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>Fix validation errors to save</span>
                  </div>
                  <div className="absolute top-full right-3 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Connection Status */}
        {!isConnected && (
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
            <p className="text-xs text-yellow-800 dark:text-yellow-300">
              Changes are disabled while offline
            </p>
          </div>
        )}

        {/* Keyboard shortcuts hint */}
        <div className={`text-xs pt-2 border-t transition-colors duration-200 ${
          isDirty 
            ? 'text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800' 
            : 'text-gray-500 dark:text-gray-400 border-gray-100 dark:border-gray-800'
        }`}>
          <div className="flex items-center justify-between">
            <span className={isDirty ? 'font-medium' : ''}>
              {isDirty ? 'Save your changes:' : 'Keyboard shortcuts:'}
            </span>
            <div className="flex items-center space-x-4">
              <span className={isDirty ? 'font-medium animate-pulse' : ''}>⌘/Ctrl + S to save</span>
              <span>Esc to cancel</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FieldSettings;

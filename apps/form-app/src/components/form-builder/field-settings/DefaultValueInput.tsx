import React, { useEffect } from 'react';
import { Controller, Control } from 'react-hook-form';
import { 
  Input, 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue,
  Label,
  Checkbox,
  DatePicker
} from '@dculus/ui';
import { FormField, FieldType } from '@dculus/types';
import { useFieldSettingsConstants } from './useFieldSettingsConstants';

interface DefaultValueInputProps {
  field: FormField | null;
  control: Control<any>;
  errors: Record<string, any>;
  isConnected: boolean;
  watch: (name: string) => any;
  setValue?: (name: string, value: any) => void;
}

export const DefaultValueInput: React.FC<DefaultValueInputProps> = ({
  field,
  control,
  errors,
  isConnected,
  watch,
  setValue
}) => {
  const constants = useFieldSettingsConstants();
  // For SelectField, RadioField, and CheckboxField, automatically reset default value if it's no longer in options
  useEffect(() => {
    if ((field?.type === FieldType.SELECT_FIELD || field?.type === FieldType.RADIO_FIELD || field?.type === FieldType.CHECKBOX_FIELD) && setValue) {
      const options = watch('options') || [];
      const currentDefaultValue = watch('defaultValue');
      
      if (field?.type === FieldType.CHECKBOX_FIELD) {
        // For checkbox fields, defaultValue is now string[]
        const selectedValues = Array.isArray(currentDefaultValue) ? currentDefaultValue : 
          (currentDefaultValue ? currentDefaultValue.split(',').map((s: string) => s.trim()).filter(Boolean) : []);
        
        if (selectedValues.length > 0) {
          const validValues = selectedValues.filter((value: string) => options.includes(value));
          
          // If some values are no longer valid, update to only valid values
          if (validValues.length !== selectedValues.length) {
            setValue('defaultValue', validValues);
          }
        }
      } else {
        // For select and radio fields, single value handling
        if (currentDefaultValue && 
            currentDefaultValue !== '' && 
            !options.some((option: string) => option === currentDefaultValue)) {
          // Reset to empty (which will show as "None" in the UI)
          setValue('defaultValue', '');
        }
      }
    }
  }, [field?.type, watch, setValue, watch('options')]);

  return (
    <Controller
      name="defaultValue"
      control={control}
      render={({ field: controlField }) => {
        if (field?.type === FieldType.DATE_FIELD) {
          const minDateValue = watch('minDate');
          const maxDateValue = watch('maxDate');
          
          return (
            <DatePicker
              id="field-defaultValue"
              date={controlField.value ? new Date(controlField.value) : undefined}
              onDateChange={(date) => controlField.onChange(date ? date.toISOString().split('T')[0] : '')}
              minDate={minDateValue ? new Date(minDateValue) : undefined}
              maxDate={maxDateValue ? new Date(maxDateValue) : undefined}
              disabled={!isConnected}
              error={!!errors.defaultValue}
              placeholder="Select default date"
            />
          );
        }
        
        if (field?.type === FieldType.CHECKBOX_FIELD) {
          const options = watch('options') || [];
          // Handle both array (new format) and comma-separated string (legacy format)
          const selectedValues = Array.isArray(controlField.value) ? controlField.value : 
            (controlField.value ? controlField.value.split(',').map((s: string) => s.trim()).filter(Boolean) : []);
          
          const handleCheckboxToggle = (option: string, checked: boolean) => {
            let newSelectedValues: string[];
            if (checked) {
              newSelectedValues = [...selectedValues, option];
            } else {
              newSelectedValues = selectedValues.filter((v: string) => v !== option);
            }
            // For CheckboxField, we now store as array but also maintain string format for compatibility
            controlField.onChange(newSelectedValues);
          };
          
          return (
            <div className={`space-y-2 ${errors.defaultValue ? 'border border-red-300 rounded-md p-2' : ''}`}>
              {options.length === 0 ? (
                <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                  {constants.INFO_MESSAGES.NO_OPTIONS_AVAILABLE}
                </div>
              ) : (
                <>
                  {options
                    .filter((option: string) => option && option.trim() !== '')
                    .map((option: string, index: number) => (
                      <div key={`checkbox-default-${index}`} className="flex items-center space-x-2">
                        <Checkbox
                          id={`default-option-${index}`}
                          checked={selectedValues.includes(option)}
                          onCheckedChange={(checked) => handleCheckboxToggle(option, !!checked)}
                          disabled={!isConnected}
                        />
                        <Label 
                          htmlFor={`default-option-${index}`} 
                          className="text-sm font-normal text-gray-700 dark:text-gray-300 cursor-pointer"
                        >
                          {option}
                        </Label>
                      </div>
                    ))}
                  {selectedValues.length > 0 && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      {selectedValues.length} option{selectedValues.length === 1 ? '' : 's'} selected as default
                    </div>
                  )}
                </>
              )}
            </div>
          );
        }
        
        if (field?.type === FieldType.SELECT_FIELD || field?.type === FieldType.RADIO_FIELD) {
          const options = watch('options') || [];
          
          return (
            <Select
              value={controlField.value || '__none__'}
              onValueChange={(value) => controlField.onChange(value === '__none__' ? '' : value)}
              disabled={!isConnected}
            >
              <SelectTrigger className={`text-sm ${errors.defaultValue ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}>
                <SelectValue placeholder={constants.PLACEHOLDERS.SELECT_DEFAULT_OPTION} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  {constants.LABELS.NONE}
                </SelectItem>
                {options
                  .map((option: string, originalIndex: number) => {
                    if (!option || option.trim() === '') return null;
                    return (
                      <SelectItem key={`option-${originalIndex}`} value={option}>
                        {option}
                      </SelectItem>
                    );
                  })
                  .filter(Boolean)}
              </SelectContent>
            </Select>
          );
        }
        
        return (
          <Input
            {...controlField}
            id="field-default"
            placeholder={constants.PLACEHOLDERS.DEFAULT_VALUE}
            disabled={!isConnected}
            className={`text-sm ${errors.defaultValue ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
            value={controlField.value || ''}
          />
        );
      }}
    />
  );
};
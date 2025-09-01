import { FormField, FieldType } from '@dculus/types';
import { BaseFieldData, OptionFieldData, ValidationFieldData, NumberRangeFieldData, DateRangeFieldData } from './types';

/**
 * Type-safe field data extraction utilities
 * Replaces the large switch statement with typed extractors
 */

/**
 * Extract base field data that all fields share
 */
export function extractBaseFieldData(field: FormField): BaseFieldData {
  const fieldWithProps = field as any;
  return {
    label: fieldWithProps.label || '',
    hint: fieldWithProps.hint || '',
    placeholder: fieldWithProps.placeholder || '',
    defaultValue: getFieldDefaultValue(field),
    prefix: fieldWithProps.prefix || '',
    required: fieldWithProps.validation?.required || false,
  };
}

/**
 * Extract default value with proper type handling
 */
function getFieldDefaultValue(field: FormField): string | string[] {
  const fieldWithDefaults = field as any;
  
  // Handle checkbox fields with array default values
  if (field.type === FieldType.CHECKBOX_FIELD) {
    return fieldWithDefaults.defaultValues || [];
  }
  
  // Handle regular default values
  return fieldWithDefaults.defaultValue || '';
}

/**
 * Extract validation data for text fields
 */
export function extractValidationData(field: FormField): ValidationFieldData {
  const validation = (field as any).validation || {};
  
  return {
    validation: {
      required: validation.required || false,
      minLength: validation.minLength || undefined,
      maxLength: validation.maxLength || undefined,
    },
  };
}

/**
 * Extract options data for option-based fields
 */
export function extractOptionData(field: FormField): OptionFieldData {
  const fieldWithOptions = field as any;
  return {
    options: fieldWithOptions.options || [],
  };
}

/**
 * Extract number range data for number fields
 */
export function extractNumberRangeData(field: FormField): NumberRangeFieldData {
  const fieldWithRange = field as any;
  return {
    min: fieldWithRange.min || undefined,
    max: fieldWithRange.max || undefined,
  };
}

/**
 * Extract date range data for date fields
 */
export function extractDateRangeData(field: FormField): DateRangeFieldData {
  const fieldWithDateRange = field as any;
  return {
    minDate: fieldWithDateRange.minDate || '',
    maxDate: fieldWithDateRange.maxDate || '',
  };
}

/**
 * Field type specific data extractors
 */
const FIELD_DATA_EXTRACTORS: Partial<Record<FieldType, (field: FormField) => Record<string, any>>> = {
  [FieldType.TEXT_INPUT_FIELD]: (field: FormField) => ({
    ...extractBaseFieldData(field),
    ...extractValidationData(field),
  }),

  [FieldType.TEXT_AREA_FIELD]: (field: FormField) => ({
    ...extractBaseFieldData(field),
    ...extractValidationData(field),
  }),

  [FieldType.EMAIL_FIELD]: (field: FormField) => ({
    ...extractBaseFieldData(field),
  }),

  [FieldType.NUMBER_FIELD]: (field: FormField) => ({
    ...extractBaseFieldData(field),
    ...extractNumberRangeData(field),
  }),

  [FieldType.SELECT_FIELD]: (field: FormField) => ({
    ...extractBaseFieldData(field),
    ...extractOptionData(field),
  }),

  [FieldType.RADIO_FIELD]: (field: FormField) => ({
    ...extractBaseFieldData(field),
    ...extractOptionData(field),
  }),

  [FieldType.CHECKBOX_FIELD]: (field: FormField) => ({
    ...extractBaseFieldData(field),
    ...extractOptionData(field),
    multiple: ('multiple' in field && field.multiple) || true,
  }),

  [FieldType.DATE_FIELD]: (field: FormField) => ({
    ...extractBaseFieldData(field),
    ...extractDateRangeData(field),
  }),
};

/**
 * Main field data extraction function
 * Type-safe replacement for the extractFieldData function
 */
export function extractFieldData(field: FormField): Record<string, any> {
  const extractor = FIELD_DATA_EXTRACTORS[field.type];
  
  if (!extractor) {
    // Fallback to base data for unknown field types
    return extractBaseFieldData(field);
  }
  
  return extractor(field);
}

/**
 * Type predicate to check if a field has options
 */
export function fieldHasOptions(field: FormField): field is FormField & OptionFieldData {
  return 'options' in field;
}

/**
 * Type predicate to check if a field has validation settings
 */
export function fieldHasValidation(field: FormField): field is FormField & ValidationFieldData {
  return field.type === FieldType.TEXT_INPUT_FIELD || field.type === FieldType.TEXT_AREA_FIELD;
}

/**
 * Type predicate to check if a field has number range settings
 */
export function fieldHasNumberRange(field: FormField): field is FormField & NumberRangeFieldData {
  return field.type === FieldType.NUMBER_FIELD;
}

/**
 * Type predicate to check if a field has date range settings
 */
export function fieldHasDateRange(field: FormField): field is FormField & DateRangeFieldData {
  return field.type === FieldType.DATE_FIELD;
}
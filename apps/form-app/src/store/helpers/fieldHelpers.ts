/**
 * Field Helper Functions
 *
 * Utility functions for creating, validating, and serializing form fields.
 */

import * as Y from 'yjs';
import {
  FieldType,
  FormField,
  FillableFormField,
  TextInputField,
  TextAreaField,
  EmailField,
  NumberField,
  SelectField,
  RadioField,
  CheckboxField,
  DateField,
  RichTextFormField,
  FillableFormFieldValidation,
  TextFieldValidation,
  CheckboxFieldValidation,
} from '@dculus/types';
import { FieldData } from '../collaboration/CollaborationManager';

/**
 * Field configuration for default labels and placeholders
 */
export const FIELD_CONFIGS: Partial<Record<FieldType, { label: string; placeholder?: string }>> = {
  [FieldType.TEXT_INPUT_FIELD]: { label: 'Text Input' },
  [FieldType.TEXT_AREA_FIELD]: { label: 'Text Area' },
  [FieldType.EMAIL_FIELD]: { label: 'Email' },
  [FieldType.NUMBER_FIELD]: { label: 'Number' },
  [FieldType.SELECT_FIELD]: { label: 'Select' },
  [FieldType.RADIO_FIELD]: { label: 'Radio' },
  [FieldType.CHECKBOX_FIELD]: { label: 'Checkbox' },
  [FieldType.DATE_FIELD]: { label: 'Date' },
  // NOTE: RICH_TEXT_FIELD omitted intentionally - it's non-fillable and shouldn't have a label
};

/**
 * Generate a unique ID for fields
 */
export const generateUniqueId = (): string => {
  return `field-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
};

/**
 * Check if a field is fillable (has label, validation, etc.)
 */
export const isFillableFormField = (field: FormField): field is FillableFormField => {
  return (
    field instanceof FillableFormField ||
    (field as any).label !== undefined ||
    field.type !== FieldType.FORM_FIELD
  );
};

/**
 * Create a FormField instance from field type and data
 */
export const createFormField = (
  fieldType: FieldType,
  fieldData: Partial<FieldData> = {}
): FormField => {
  const fieldId = generateUniqueId();
  const config = FIELD_CONFIGS[fieldType] || { label: 'Field' };

  const label = fieldData.label || config.label;
  const defaultValue = fieldData.defaultValue || '';
  const prefix = fieldData.prefix || '';
  const hint = fieldData.hint || '';
  const placeholder = fieldData.placeholder || '';

  switch (fieldType) {
    case FieldType.TEXT_INPUT_FIELD: {
      const textValidation = new TextFieldValidation(
        fieldData.required || false,
        fieldData.min,
        fieldData.max
      );
      return new TextInputField(fieldId, label, defaultValue, prefix, hint, placeholder, textValidation);
    }
    case FieldType.TEXT_AREA_FIELD: {
      const textValidation = new TextFieldValidation(
        fieldData.required || false,
        fieldData.min,
        fieldData.max
      );
      return new TextAreaField(fieldId, label, defaultValue, prefix, hint, placeholder, textValidation);
    }
    case FieldType.EMAIL_FIELD: {
      const validation = new FillableFormFieldValidation(fieldData.required || false);
      return new EmailField(fieldId, label, defaultValue, prefix, hint, placeholder, validation);
    }
    case FieldType.NUMBER_FIELD: {
      const validation = new FillableFormFieldValidation(fieldData.required || false);
      return new NumberField(
        fieldId,
        label,
        defaultValue,
        prefix,
        hint,
        placeholder,
        validation,
        fieldData.min,
        fieldData.max
      );
    }
    case FieldType.SELECT_FIELD: {
      const validation = new FillableFormFieldValidation(fieldData.required || false);
      return new SelectField(
        fieldId,
        label,
        defaultValue,
        prefix,
        hint,
        validation,
        fieldData.options || []
      );
    }
    case FieldType.RADIO_FIELD: {
      const validation = new FillableFormFieldValidation(fieldData.required || false);
      return new RadioField(
        fieldId,
        label,
        defaultValue,
        prefix,
        hint,
        validation,
        fieldData.options || []
      );
    }
    case FieldType.CHECKBOX_FIELD: {
      const validation = new CheckboxFieldValidation(
        fieldData.required || false,
        fieldData.validation?.minSelections,
        fieldData.validation?.maxSelections
      );
      // For checkbox fields, use defaultValue as array (it could be string or array from fieldData)
      const checkboxDefaults = fieldData.defaultValue || [];
      return new CheckboxField(
        fieldId,
        label,
        checkboxDefaults,
        prefix,
        hint,
        placeholder,
        validation,
        fieldData.options || []
      );
    }
    case FieldType.DATE_FIELD: {
      const validation = new FillableFormFieldValidation(fieldData.required || false);
      return new DateField(
        fieldId,
        label,
        defaultValue,
        prefix,
        hint,
        placeholder,
        validation,
        fieldData.minDate,
        fieldData.maxDate
      );
    }
    case FieldType.RICH_TEXT_FIELD: {
      const content = (fieldData as any).content || '<p>Enter your rich text content here...</p>';
      return new RichTextFormField(fieldId, content);
    }
    default:
      return new FormField(fieldId);
  }
};

/**
 * Create a YJS Map from field data
 */
export const createYJSFieldMap = (fieldData: FieldData): Y.Map<any> => {
  const fieldMap = new Y.Map();

  Object.entries(fieldData).forEach(([key, value]) => {
    if (key === 'options' && Array.isArray(value)) {
      const optionsArray = new Y.Array();
      value.filter((option) => option && option.trim() !== '').forEach((option) => optionsArray.push([option]));
      fieldMap.set('options', optionsArray);
    } else if (value !== undefined) {
      fieldMap.set(key, value);
    }
  });

  // Store validation object for fields that have specialized validation
  if (fieldData.type === FieldType.TEXT_INPUT_FIELD || fieldData.type === FieldType.TEXT_AREA_FIELD) {
    const validationMap = new Y.Map();
    validationMap.set('required', fieldData.required || false);
    validationMap.set('type', FieldType.TEXT_FIELD_VALIDATION);
    if (fieldData.min !== undefined) {
      validationMap.set('minLength', fieldData.min);
    }
    if (fieldData.max !== undefined) {
      validationMap.set('maxLength', fieldData.max);
    }
    fieldMap.set('validation', validationMap);
  } else if (fieldData.type === FieldType.CHECKBOX_FIELD) {
    const validationMap = new Y.Map();
    validationMap.set('required', fieldData.required || false);
    validationMap.set('type', FieldType.CHECKBOX_FIELD_VALIDATION);
    if (fieldData.validation?.minSelections !== undefined) {
      validationMap.set('minSelections', fieldData.validation.minSelections);
    }
    if (fieldData.validation?.maxSelections !== undefined) {
      validationMap.set('maxSelections', fieldData.validation.maxSelections);
    }
    fieldMap.set('validation', validationMap);
  } else if (fieldData.type === FieldType.RICH_TEXT_FIELD) {
    // Rich Text fields don't have validation - skip validation setup
    // Content is already handled in the Object.entries loop above
  } else {
    // For other field types, store basic validation
    const validationMap = new Y.Map();
    validationMap.set('required', fieldData.required || false);
    validationMap.set('type', FieldType.FILLABLE_FORM_FIELD);
    fieldMap.set('validation', validationMap);
  }

  return fieldMap;
};

/**
 * Serialize a FormField instance to YJS Map
 */
export const serializeFieldToYMap = (field: FormField): Y.Map<any> => {
  if (!(field instanceof FillableFormField) && !isFillableFormField(field)) {
    const fieldMap = new Y.Map();
    fieldMap.set('id', field.id);
    fieldMap.set('type', field.type);

    // Handle rich text fields
    if (field.type === FieldType.RICH_TEXT_FIELD) {
      fieldMap.set('content', (field as any).content || '');
    }

    return fieldMap;
  }

  const fillableField = field as any;
  const fieldData: FieldData = {
    id: field.id,
    type: field.type,
    label: fillableField.label || '',
    defaultValue: fillableField.defaultValue || '',
    prefix: fillableField.prefix || '',
    hint: fillableField.hint || '',
    required: fillableField.validation?.required || false,
    placeholder: fillableField.placeholder || '',
    options: fillableField.options,
    min: fillableField.validation?.minLength || fillableField.min,
    max: fillableField.validation?.maxLength || fillableField.max,
    minDate: fillableField.minDate,
    maxDate: fillableField.maxDate,
  };

  return createYJSFieldMap(fieldData);
};

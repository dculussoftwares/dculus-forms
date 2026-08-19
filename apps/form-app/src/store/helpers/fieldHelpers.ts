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
  FileUploadField,
  PhoneNumberField,
  FillableFormFieldValidation,
  TextFieldValidation,
  CheckboxFieldValidation,
  FieldGrading,
} from '@dculus/types';
import { generateRandomString } from '@dculus/utils';
import { FieldData } from '../collaboration/CollaborationManager';

/**
 * Field configuration for default labels and placeholders
 */
export const FIELD_CONFIGS: Partial<
  Record<FieldType, { label: string; placeholder?: string }>
> = {
  [FieldType.TEXT_INPUT_FIELD]: { label: 'Text Input' },
  [FieldType.TEXT_AREA_FIELD]: { label: 'Text Area' },
  [FieldType.EMAIL_FIELD]: { label: 'Email' },
  [FieldType.NUMBER_FIELD]: { label: 'Number' },
  [FieldType.SELECT_FIELD]: { label: 'Select' },
  [FieldType.RADIO_FIELD]: { label: 'Radio' },
  [FieldType.CHECKBOX_FIELD]: { label: 'Checkbox' },
  [FieldType.DATE_FIELD]: { label: 'Date' },
  [FieldType.FILE_UPLOAD_FIELD]: { label: 'File Upload' },
  [FieldType.PHONE_NUMBER_FIELD]: { label: 'Phone Number' },
  // NOTE: RICH_TEXT_FIELD omitted intentionally - it's non-fillable and shouldn't have a label
};

/**
 * Generate a short unique ID scoped to a single-character entity prefix
 * (e.g. 'f' for fields, 'p' for pages).
 *
 * Short (10-char) alphanumeric IDs instead of full UUIDs — field/page IDs are
 * echoed into the AI chat context on every request, so their length directly
 * drives token cost. Uniqueness only needs to hold within a single form's
 * field/page count, so a 9-char random suffix is more than collision-safe.
 */
export const generateShortEntityId = (prefix: string): string => {
  return `${prefix}${generateRandomString(9)}`;
};

/**
 * Generate a unique ID for fields
 */
export const generateUniqueId = (): string => {
  return generateShortEntityId('f');
};

/**
 * Check if a field is fillable (has label, validation, etc.)
 */
export const isFillableFormField = (
  field: FormField
): field is FillableFormField => {
  return (
    field instanceof FillableFormField ||
    (field as FillableFormField).label !== undefined ||
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

  const field = createFormFieldInstance(fieldType, fieldId, fieldData, {
    label,
    defaultValue,
    prefix,
    hint,
    placeholder,
  });

  // `grading` is deliberately not a constructor parameter (see
  // FillableFormField.grading) — assign after construction instead.
  if (fieldData.grading && field instanceof FillableFormField) {
    field.grading = fieldData.grading;
  }

  return field;
};

const createFormFieldInstance = (
  fieldType: FieldType,
  fieldId: string,
  fieldData: Partial<FieldData>,
  { label, defaultValue, prefix, hint, placeholder }: {
    label: string;
    defaultValue: string;
    prefix: string;
    hint: string;
    placeholder: string;
  }
): FormField => {
  switch (fieldType) {
    case FieldType.TEXT_INPUT_FIELD: {
      const textValidation = new TextFieldValidation(
        fieldData.required || false,
        fieldData.min,
        fieldData.max
      );
      return new TextInputField(
        fieldId,
        label,
        defaultValue,
        prefix,
        hint,
        placeholder,
        textValidation
      );
    }
    case FieldType.TEXT_AREA_FIELD: {
      const textValidation = new TextFieldValidation(
        fieldData.required || false,
        fieldData.min,
        fieldData.max
      );
      return new TextAreaField(
        fieldId,
        label,
        defaultValue,
        prefix,
        hint,
        placeholder,
        textValidation
      );
    }
    case FieldType.EMAIL_FIELD: {
      const validation = new FillableFormFieldValidation(
        fieldData.required || false
      );
      return new EmailField(
        fieldId,
        label,
        defaultValue,
        prefix,
        hint,
        placeholder,
        validation
      );
    }
    case FieldType.NUMBER_FIELD: {
      const validation = new FillableFormFieldValidation(
        fieldData.required || false
      );
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
      const validation = new FillableFormFieldValidation(
        fieldData.required || false
      );
      // Initialize with default options if none provided
      const defaultOptions = fieldData.options || [
        'Option 1',
        'Option 2',
        'Option 3',
      ];
      return new SelectField(
        fieldId,
        label,
        defaultValue,
        prefix,
        hint,
        validation,
        defaultOptions
      );
    }
    case FieldType.RADIO_FIELD: {
      const validation = new FillableFormFieldValidation(
        fieldData.required || false
      );
      // Initialize with default options if none provided
      const defaultOptions = fieldData.options || [
        'Option 1',
        'Option 2',
        'Option 3',
      ];
      return new RadioField(
        fieldId,
        label,
        defaultValue,
        prefix,
        hint,
        validation,
        defaultOptions
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
      // Initialize with default options if none provided
      const defaultOptions = fieldData.options || [
        'Option 1',
        'Option 2',
        'Option 3',
      ];
      return new CheckboxField(
        fieldId,
        label,
        checkboxDefaults,
        prefix,
        hint,
        placeholder,
        validation,
        defaultOptions
      );
    }
    case FieldType.DATE_FIELD: {
      const validation = new FillableFormFieldValidation(
        fieldData.required || false
      );
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
    case FieldType.PHONE_NUMBER_FIELD: {
      const validation = new FillableFormFieldValidation(
        fieldData.required || false
      );
      return new PhoneNumberField(
        fieldId,
        label,
        defaultValue,
        prefix,
        hint,
        placeholder,
        validation,
        fieldData.defaultCountry
      );
    }
    case FieldType.RICH_TEXT_FIELD: {
      const content =
        (fieldData as RichTextFormField).content ||
        '<p>Enter your rich text content here...</p>';
      console.log('🏗️ createFormField - Creating Rich Text Field:', {
        fieldId,
        contentLength: content.length,
        content: content.substring(0, 100) + '...',
      });
      return new RichTextFormField(fieldId, content);
    }
    case FieldType.FILE_UPLOAD_FIELD: {
      const validation = new FillableFormFieldValidation(
        fieldData.required || false
      );
      return new FileUploadField(
        fieldId,
        label,
        prefix,
        hint,
        validation,
        (fieldData as FileUploadField).allowedMimeTypes,
        (fieldData as FileUploadField).maxFileSizeMb,
        (fieldData as FileUploadField).maxFiles
      );
    }
    default:
      return new FormField(fieldId);
  }
};

/**
 * Build (or repopulate) the `grading` Y.Map for a field, giving `acceptedAnswers`
 * and `optionFeedback` the same explicit Y.Array treatment as `options` /
 * `allowedMimeTypes` above, and the mode-specific option objects
 * (`text`/`numeric`/`set`) their own nested Y.Map — mirrors `validation`.
 * Only called when `fieldData.grading` is present; callers skip this
 * entirely otherwise so a non-quiz field's Y.Map has no `grading` key at all.
 *
 * Pass an existing `grading` Y.Map as `target` to update it in place instead of
 * replacing it wholesale — fieldsSlice's `updateField` does this on every save so
 * the map's own identity survives across saves rather than being orphaned each
 * time. NOTE this does NOT give per-key CRDT merge granularity: every key
 * (including nested `text`/`numeric`/`set` sub-maps and the `acceptedAnswers` /
 * `optionFeedback` arrays) is cleared and fully rewritten from the caller's
 * complete `FieldGrading` snapshot on every call, the same "whole settings
 * panel, one save" model every other field property in this file already uses.
 * Two collaborators concurrently editing different parts of the same field's
 * grading can still have one save overwrite the other's change with a stale
 * value — that would need real per-key diffing, which this doesn't attempt.
 * Existing keys are cleared first so a mode switch (e.g. 'set' -> 'text')
 * doesn't leave a stale `set`/`numeric` sub-map behind.
 */
export const createGradingYMap = (
  grading: FieldGrading,
  target?: Y.Map<any>
): Y.Map<any> => {
  const gradingMap = target ?? new Y.Map();
  if (target) {
    Array.from(target.keys()).forEach((key) => target.delete(key));
  }

  gradingMap.set('mode', grading.mode);
  gradingMap.set('pointValue', grading.pointValue);

  const acceptedAnswersArray = new Y.Array();
  (grading.acceptedAnswers || []).forEach((answer) =>
    acceptedAnswersArray.push([answer])
  );
  gradingMap.set('acceptedAnswers', acceptedAnswersArray);

  if (grading.text) {
    const textMap = new Y.Map();
    Object.entries(grading.text).forEach(([key, value]) => {
      if (value !== undefined) textMap.set(key, value);
    });
    gradingMap.set('text', textMap);
  }
  if (grading.numeric) {
    const numericMap = new Y.Map();
    Object.entries(grading.numeric).forEach(([key, value]) => {
      if (value !== undefined) numericMap.set(key, value);
    });
    gradingMap.set('numeric', numericMap);
  }
  if (grading.set) {
    const setMap = new Y.Map();
    Object.entries(grading.set).forEach(([key, value]) => {
      if (value !== undefined) setMap.set(key, value);
    });
    gradingMap.set('set', setMap);
  }

  if (grading.whenCorrect !== undefined) gradingMap.set('whenCorrect', grading.whenCorrect);
  if (grading.whenIncorrect !== undefined) gradingMap.set('whenIncorrect', grading.whenIncorrect);
  if (grading.general !== undefined) gradingMap.set('general', grading.general);

  if (grading.optionFeedback) {
    const optionFeedbackArray = new Y.Array();
    grading.optionFeedback.forEach((entry) => {
      const entryMap = new Y.Map();
      entryMap.set('option', entry.option);
      entryMap.set('feedback', entry.feedback);
      optionFeedbackArray.push([entryMap]);
    });
    gradingMap.set('optionFeedback', optionFeedbackArray);
  }

  if (grading.shuffleOptions !== undefined) {
    gradingMap.set('shuffleOptions', grading.shuffleOptions);
  }

  return gradingMap;
};

/**
 * Create a YJS Map from field data
 */
export const createYJSFieldMap = (fieldData: FieldData): Y.Map<any> => {
  const fieldMap = new Y.Map();

  Object.entries(fieldData).forEach(([key, value]) => {
    if (key === 'options' && Array.isArray(value)) {
      const optionsArray = new Y.Array();
      value
        .filter((option) => option && option.trim() !== '')
        .forEach((option) => optionsArray.push([option]));
      fieldMap.set('options', optionsArray);
    } else if (key === 'allowedMimeTypes' && Array.isArray(value)) {
      const mimeArray = new Y.Array();
      value.forEach((mime: string) => mimeArray.push([mime]));
      fieldMap.set('allowedMimeTypes', mimeArray);
    } else if (key === 'grading' && value) {
      fieldMap.set('grading', createGradingYMap(value as FieldGrading));
    } else if (value !== undefined) {
      fieldMap.set(key, value);
    }
  });

  // Store validation object for fields that have specialized validation
  if (
    fieldData.type === FieldType.TEXT_INPUT_FIELD ||
    fieldData.type === FieldType.TEXT_AREA_FIELD
  ) {
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
  } else if (fieldData.type === FieldType.FILE_UPLOAD_FIELD) {
    // File upload fields use basic required validation
    const validationMap = new Y.Map();
    validationMap.set('required', fieldData.required || false);
    validationMap.set('type', FieldType.FILLABLE_FORM_FIELD);
    fieldMap.set('validation', validationMap);
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
      fieldMap.set('content', (field as RichTextFormField).content || '');
    }

    return fieldMap;
  }

  const fillableField = field as FillableFormField;
  const fieldData: FieldData = {
    id: field.id,
    type: field.type,
    label: fillableField.label || '',
    defaultValue: fillableField.defaultValue || '',
    prefix: fillableField.prefix || '',
    hint: fillableField.hint || '',
    required: fillableField.validation?.required || false,
    placeholder: fillableField.placeholder || '',
    options: (fillableField as SelectField | RadioField | CheckboxField).options,
    min: (fillableField.validation as TextFieldValidation)?.minLength || (fillableField as NumberField).min,
    max: (fillableField.validation as TextFieldValidation)?.maxLength || (fillableField as NumberField).max,
    minDate: (fillableField as DateField).minDate,
    maxDate: (fillableField as DateField).maxDate,
    allowedMimeTypes: (fillableField as FileUploadField).allowedMimeTypes,
    maxFileSizeMb: (fillableField as FileUploadField).maxFileSizeMb,
    maxFiles: (fillableField as FileUploadField).maxFiles,
    grading: fillableField.grading,
    defaultCountry: (fillableField as PhoneNumberField).defaultCountry,
  };

  return createYJSFieldMap(fieldData);
};

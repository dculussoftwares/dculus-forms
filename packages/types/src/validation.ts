import { z } from 'zod';
import { FieldType } from './index.js';

// Base validation schema for common field properties
export const baseFieldValidationSchema = z.object({
  label: z.string().min(1, 'fieldSettingsConstants:errorMessages.labelRequired').max(200, 'fieldSettingsConstants:errorMessages.labelTooLong'),
  hint: z.string().max(500, 'fieldSettingsConstants:errorMessages.hintTooLong').optional(),
  placeholder: z.string().max(100, 'fieldSettingsConstants:errorMessages.placeholderTooLong').optional(),
  defaultValue: z.string().max(1000, 'fieldSettingsConstants:errorMessages.defaultValueTooLong').optional(),
  prefix: z.string().max(10, 'fieldSettingsConstants:errorMessages.prefixTooLong').optional(),
  required: z.boolean().default(false),
});

// Field-specific validation schemas
export const textInputFieldValidationSchema = baseFieldValidationSchema.extend({
  validation: z.object({
    required: z.boolean().default(false),
    minLength: z.number().min(0, 'fieldSettingsConstants:errorMessages.minLengthInvalid').max(5000, 'fieldSettingsConstants:errorMessages.characterLimitExceeded').optional().or(z.string().regex(/^\d*$/, 'fieldSettingsConstants:errorMessages.minLengthInvalid').refine(
      (val) => !val || parseInt(val) <= 5000,
      'fieldSettingsConstants:errorMessages.characterLimitExceeded'
    ).optional()),
    maxLength: z.number().min(1, 'fieldSettingsConstants:errorMessages.maxLengthInvalid').max(5000, 'fieldSettingsConstants:errorMessages.characterLimitExceeded').optional().or(z.string().regex(/^\d*$/, 'fieldSettingsConstants:errorMessages.maxLengthInvalid').refine(
      (val) => !val || parseInt(val) <= 5000,
      'fieldSettingsConstants:errorMessages.characterLimitExceeded'
    ).optional()),
  }).optional().refine(
    (validation) => {
      if (!validation) return true;
      const { minLength, maxLength } = validation;
      if (minLength !== undefined && maxLength !== undefined && minLength !== '' && maxLength !== '') {
        const minNum = typeof minLength === 'string' ? parseInt(minLength) : minLength;
        const maxNum = typeof maxLength === 'string' ? parseInt(maxLength) : maxLength;
        return isNaN(minNum) || isNaN(maxNum) || minNum <= maxNum;
      }
      return true;
    },
    {
      message: 'fieldSettingsConstants:errorMessages.minGreaterThanMax',
      path: ['maxLength'],
    }
  ),
}).refine(
  (data) => {
    // Check if default value meets minimum length requirement
    if (!data.defaultValue || !data.validation?.minLength) return true;
    const defaultLength = data.defaultValue.length;
    const minLength = typeof data.validation.minLength === 'string' ? parseInt(data.validation.minLength) : data.validation.minLength;
    return isNaN(minLength) || defaultLength >= minLength;
  },
  {
    message: 'fieldSettingsConstants:errorMessages.defaultValueTooShort',
    path: ['defaultValue'],
  }
).refine(
  (data) => {
    // Check if default value meets maximum length requirement
    if (!data.defaultValue || !data.validation?.maxLength) return true;
    const defaultLength = data.defaultValue.length;
    const maxLength = typeof data.validation.maxLength === 'string' ? parseInt(data.validation.maxLength) : data.validation.maxLength;
    return isNaN(maxLength) || defaultLength <= maxLength;
  },
  {
    message: 'fieldSettingsConstants:errorMessages.defaultValueTooLongForMax',
    path: ['defaultValue'],
  }
);

export const textAreaFieldValidationSchema = baseFieldValidationSchema.extend({
  validation: z.object({
    required: z.boolean().default(false),
    minLength: z.number().min(0, 'fieldSettingsConstants:errorMessages.minLengthInvalid').max(5000, 'fieldSettingsConstants:errorMessages.characterLimitExceeded').optional().or(z.string().regex(/^\d*$/, 'fieldSettingsConstants:errorMessages.minLengthInvalid').refine(
      (val) => !val || parseInt(val) <= 5000,
      'fieldSettingsConstants:errorMessages.characterLimitExceeded'
    ).optional()),
    maxLength: z.number().min(1, 'fieldSettingsConstants:errorMessages.maxLengthInvalid').max(5000, 'fieldSettingsConstants:errorMessages.characterLimitExceeded').optional().or(z.string().regex(/^\d*$/, 'fieldSettingsConstants:errorMessages.maxLengthInvalid').refine(
      (val) => !val || parseInt(val) <= 5000,
      'fieldSettingsConstants:errorMessages.characterLimitExceeded'
    ).optional()),
  }).optional().refine(
    (validation) => {
      if (!validation) return true;
      const { minLength, maxLength } = validation;
      if (minLength !== undefined && maxLength !== undefined && minLength !== '' && maxLength !== '') {
        const minNum = typeof minLength === 'string' ? parseInt(minLength) : minLength;
        const maxNum = typeof maxLength === 'string' ? parseInt(maxLength) : maxLength;
        return isNaN(minNum) || isNaN(maxNum) || minNum <= maxNum;
      }
      return true;
    },
    {
      message: 'fieldSettingsConstants:errorMessages.minGreaterThanMax',
      path: ['maxLength'],
    }
  ),
}).refine(
  (data) => {
    // Check if default value meets minimum length requirement
    if (!data.defaultValue || !data.validation?.minLength) return true;
    const defaultLength = data.defaultValue.length;
    const minLength = typeof data.validation.minLength === 'string' ? parseInt(data.validation.minLength) : data.validation.minLength;
    return isNaN(minLength) || defaultLength >= minLength;
  },
  {
    message: 'fieldSettingsConstants:errorMessages.defaultValueTooShort',
    path: ['defaultValue'],
  }
).refine(
  (data) => {
    // Check if default value meets maximum length requirement
    if (!data.defaultValue || !data.validation?.maxLength) return true;
    const defaultLength = data.defaultValue.length;
    const maxLength = typeof data.validation.maxLength === 'string' ? parseInt(data.validation.maxLength) : data.validation.maxLength;
    return isNaN(maxLength) || defaultLength <= maxLength;
  },
  {
    message: 'fieldSettingsConstants:errorMessages.defaultValueTooLongForMax',
    path: ['defaultValue'],
  }
);

export const emailFieldValidationSchema = baseFieldValidationSchema.extend({
  placeholder: z.string().max(100, 'fieldSettingsConstants:errorMessages.placeholderTooLong').optional(),
});

export const numberFieldValidationSchema = baseFieldValidationSchema.extend({
  min: z.number().optional().or(z.string().regex(/^-?\d*\.?\d*$/, 'Minimum must be a valid number').optional()),
  max: z.number().optional().or(z.string().regex(/^-?\d*\.?\d*$/, 'Maximum must be a valid number').optional()),
  defaultValue: z.string().optional().refine(
    (value) => !value || !isNaN(parseFloat(value)),
    'fieldSettingsConstants:errorMessages.invalidNumber'
  ),
}).refine(
  (data) => {
    if (data.min !== undefined && data.max !== undefined && data.min !== '' && data.max !== '') {
      const minNum = typeof data.min === 'string' ? parseFloat(data.min) : data.min;
      const maxNum = typeof data.max === 'string' ? parseFloat(data.max) : data.max;
      return isNaN(minNum) || isNaN(maxNum) || minNum <= maxNum;
    }
    return true;
  },
  {
    message: 'fieldSettingsConstants:errorMessages.minValueGreaterThanMax',
    path: ['max'],
  }
).refine(
  (data) => {
    if (data.defaultValue && data.min !== undefined && data.min !== '') {
      const defaultNum = parseFloat(data.defaultValue);
      const minNum = typeof data.min === 'string' ? parseFloat(data.min) : data.min;
      return isNaN(defaultNum) || isNaN(minNum) || defaultNum >= minNum;
    }
    return true;
  },
  {
    message: 'fieldSettingsConstants:errorMessages.defaultBelowMin',
    path: ['defaultValue'],
  }
).refine(
  (data) => {
    if (data.defaultValue && data.max !== undefined && data.max !== '') {
      const defaultNum = parseFloat(data.defaultValue);
      const maxNum = typeof data.max === 'string' ? parseFloat(data.max) : data.max;
      return isNaN(defaultNum) || isNaN(maxNum) || defaultNum <= maxNum;
    }
    return true;
  },
  {
    message: 'fieldSettingsConstants:errorMessages.defaultAboveMax',
    path: ['defaultValue'],
  }
);

export const selectFieldValidationSchema = baseFieldValidationSchema.omit({ placeholder: true }).extend({
  options: z.array(z.string().min(1, 'fieldSettingsConstants:errorMessages.optionEmpty')).min(1, 'fieldSettingsConstants:errorMessages.minOptionsRequired').refine(
    (options) => new Set(options.filter(opt => opt.trim())).size === options.filter(opt => opt.trim()).length,
    'fieldSettingsConstants:errorMessages.duplicateOptions'
  ),
});

export const radioFieldValidationSchema = baseFieldValidationSchema.omit({ placeholder: true }).extend({
  options: z.array(z.string().min(1, 'fieldSettingsConstants:errorMessages.optionEmpty')).min(2, 'fieldSettingsConstants:errorMessages.minRadioOptionsRequired').refine(
    (options) => new Set(options.filter(opt => opt.trim())).size === options.filter(opt => opt.trim()).length,
    'fieldSettingsConstants:errorMessages.duplicateOptions'
  ),
});

export const checkboxFieldValidationSchema = baseFieldValidationSchema.extend({
  // Override defaultValue to accept string[] for checkbox fields
  defaultValue: z.array(z.string()).max(100, 'fieldSettingsConstants:errorMessages.characterLimitExceeded').optional().or(
    z.string().max(1000, 'fieldSettingsConstants:errorMessages.defaultValueTooLong').optional()
  ),
  options: z.array(z.string().min(1, 'fieldSettingsConstants:errorMessages.optionEmpty')).min(1, 'fieldSettingsConstants:errorMessages.minOptionsRequired').refine(
    (options) => new Set(options.filter(opt => opt.trim())).size === options.filter(opt => opt.trim()).length,
    'fieldSettingsConstants:errorMessages.duplicateOptions'
  ),
  validation: z.object({
    required: z.boolean().default(false),
    minSelections: z.number().min(0, 'Minimum selections must be 0 or greater').optional().or(z.string().regex(/^\d*$/, 'Minimum selections must be a valid number').optional()),
    maxSelections: z.number().min(1, 'Maximum selections must be 1 or greater').optional().or(z.string().regex(/^\d*$/, 'Maximum selections must be a valid number').optional()),
  }).optional().refine(
    (validation) => {
      if (!validation) return true;
      const { minSelections, maxSelections } = validation;
      if (minSelections !== undefined && maxSelections !== undefined && minSelections !== '' && maxSelections !== '') {
        const minNum = typeof minSelections === 'string' ? parseInt(minSelections) : minSelections;
        const maxNum = typeof maxSelections === 'string' ? parseInt(maxSelections) : maxSelections;
        return isNaN(minNum) || isNaN(maxNum) || minNum <= maxNum;
      }
      return true;
    },
    {
      message: 'fieldSettingsConstants:errorMessages.minSelectionsGreaterThanMax',
      path: ['maxSelections'],
    }
  ),
}).refine(
  (data) => {
    // Validate that default values exist in options
    if (data.defaultValue && data.options) {
      const defaultValues = Array.isArray(data.defaultValue) ? data.defaultValue :
        (data.defaultValue ? data.defaultValue.split(',').map(s => s.trim()).filter(Boolean) : []);

      const invalidDefaults = defaultValues.filter(val => !data.options.includes(val));
      return invalidDefaults.length === 0;
    }
    return true;
  },
  {
    message: 'fieldSettingsConstants:errorMessages.defaultValuesInvalid',
    path: ['defaultValue'],
  }
).refine(
  (data) => {
    // Validate that selection limits don't exceed available options
    if (data.options && data.validation) {
      const optionsCount = data.options.length;
      const maxSelections = data.validation.maxSelections;
      if (maxSelections !== undefined && maxSelections !== '') {
        const maxNum = typeof maxSelections === 'string' ? parseInt(maxSelections) : maxSelections;
        return isNaN(maxNum) || maxNum <= optionsCount;
      }
    }
    return true;
  },
  {
    message: 'fieldSettingsConstants:errorMessages.characterLimitExceeded',
    path: ['validation', 'maxSelections'],
  }
);

export const dateFieldValidationSchema = baseFieldValidationSchema.extend({
  minDate: z.string().optional().refine(
    (date) => !date || !isNaN(Date.parse(date)),
    'fieldSettingsConstants:errorMessages.invalidDate'
  ),
  maxDate: z.string().optional().refine(
    (date) => !date || !isNaN(Date.parse(date)),
    'fieldSettingsConstants:errorMessages.invalidDate'
  ),
  defaultValue: z.string().optional().refine(
    (date) => !date || !isNaN(Date.parse(date)),
    'fieldSettingsConstants:errorMessages.invalidDate'
  ),
}).refine(
  (data) => {
    if (data.minDate && data.maxDate && data.minDate.trim() && data.maxDate.trim()) {
      return new Date(data.minDate) <= new Date(data.maxDate);
    }
    return true;
  },
  {
    message: 'fieldSettingsConstants:errorMessages.minDateAfterMax',
    path: ['maxDate'],
  }
).refine(
  (data) => {
    if (data.defaultValue && data.minDate && data.defaultValue.trim() && data.minDate.trim()) {
      return new Date(data.defaultValue) >= new Date(data.minDate);
    }
    return true;
  },
  {
    message: 'fieldSettingsConstants:errorMessages.defaultDateBelowMin',
    path: ['defaultValue'],
  }
).refine(
  (data) => {
    if (data.defaultValue && data.maxDate && data.defaultValue.trim() && data.maxDate.trim()) {
      return new Date(data.defaultValue) <= new Date(data.maxDate);
    }
    return true;
  },
  {
    message: 'fieldSettingsConstants:errorMessages.defaultDateAboveMax',
    path: ['defaultValue'],
  }
);

// Rich text field validation schema
export const richTextFieldValidationSchema = z.object({
  content: z.string().max(50000, 'fieldSettingsConstants:errorMessages.characterLimitExceeded').default(''),
});

// Factory function to get validation schema by field type
export function getFieldValidationSchema(fieldType: FieldType) {
  switch (fieldType) {
    case FieldType.TEXT_INPUT_FIELD:
      return textInputFieldValidationSchema;
    case FieldType.TEXT_AREA_FIELD:
      return textAreaFieldValidationSchema;
    case FieldType.EMAIL_FIELD:
      return emailFieldValidationSchema;
    case FieldType.NUMBER_FIELD:
      return numberFieldValidationSchema;
    case FieldType.SELECT_FIELD:
      return selectFieldValidationSchema;
    case FieldType.RADIO_FIELD:
      return radioFieldValidationSchema;
    case FieldType.CHECKBOX_FIELD:
      return checkboxFieldValidationSchema;
    case FieldType.DATE_FIELD:
      return dateFieldValidationSchema;
    case FieldType.RICH_TEXT_FIELD:
      return richTextFieldValidationSchema;
    default:
      return baseFieldValidationSchema;
  }
}

// Type inference for form data
export type BaseFieldFormData = z.infer<typeof baseFieldValidationSchema>;
export type TextInputFieldFormData = z.infer<typeof textInputFieldValidationSchema>;
export type TextAreaFieldFormData = z.infer<typeof textAreaFieldValidationSchema>;
export type EmailFieldFormData = z.infer<typeof emailFieldValidationSchema>;
export type NumberFieldFormData = z.infer<typeof numberFieldValidationSchema>;
export type SelectFieldFormData = z.infer<typeof selectFieldValidationSchema>;
export type RadioFieldFormData = z.infer<typeof radioFieldValidationSchema>;
export type CheckboxFieldFormData = z.infer<typeof checkboxFieldValidationSchema>;
export type DateFieldFormData = z.infer<typeof dateFieldValidationSchema>;
export type RichTextFieldFormData = z.infer<typeof richTextFieldValidationSchema>;

// Union type for all field form data
export type FieldFormData =
  | TextInputFieldFormData
  | TextAreaFieldFormData
  | EmailFieldFormData
  | NumberFieldFormData
  | SelectFieldFormData
  | RadioFieldFormData
  | CheckboxFieldFormData
  | DateFieldFormData
  | RichTextFieldFormData;

// Form layout validation schema
export const formLayoutValidationSchema = z.object({
  theme: z.enum(['light', 'dark', 'auto']),
  textColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color format'),
  spacing: z.enum(['compact', 'normal', 'spacious']),
  code: z.string().regex(/^L[1-6]$/, 'Invalid layout code'),
  content: z.string().max(10000, 'Content is too long'),
  customBackGroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color format'),
  customCTAButtonName: z.string().max(50, 'Button name is too long').optional(),
  backgroundImageKey: z.string().max(200, 'Background image key is too long'),
  pageMode: z.enum(['multipage']),
});

export type FormLayoutFormData = z.infer<typeof formLayoutValidationSchema>;
import { z } from 'zod';
import { FieldType } from './index.js';

// Base validation schema for common field properties
export const baseFieldValidationSchema = z.object({
  label: z.string().min(1, 'Field label is required').max(200, 'Label is too long'),
  hint: z.string().max(500, 'Help text is too long').optional(),
  placeholder: z.string().max(100, 'Placeholder is too long').optional(),
  defaultValue: z.string().max(1000, 'Default value is too long').optional(),
  prefix: z.string().max(10, 'Prefix is too long').optional(),
  required: z.boolean().default(false),
});

// Field-specific validation schemas
export const textInputFieldValidationSchema = baseFieldValidationSchema;

export const textAreaFieldValidationSchema = baseFieldValidationSchema;

export const emailFieldValidationSchema = baseFieldValidationSchema.extend({
  placeholder: z.string().max(100, 'Placeholder is too long').optional(),
});

export const numberFieldValidationSchema = baseFieldValidationSchema.extend({
  min: z.number().optional().or(z.string().regex(/^-?\d*\.?\d*$/, 'Minimum must be a valid number').optional()),
  max: z.number().optional().or(z.string().regex(/^-?\d*\.?\d*$/, 'Maximum must be a valid number').optional()),
  defaultValue: z.string().optional().refine(
    (value) => !value || !isNaN(parseFloat(value)),
    'Default value must be a valid number'
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
    message: 'Minimum value must be less than or equal to maximum value',
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
    message: 'Default value must be greater than or equal to minimum value',
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
    message: 'Default value must be less than or equal to maximum value',
    path: ['defaultValue'],
  }
);

export const selectFieldValidationSchema = baseFieldValidationSchema.extend({
  options: z.array(z.string().min(1, 'Option text cannot be empty')).min(1, 'Add at least one option for the dropdown').refine(
    (options) => new Set(options.filter(opt => opt.trim())).size === options.filter(opt => opt.trim()).length,
    'Duplicate options are not allowed'
  ),
  multiple: z.boolean().default(false),
});

export const radioFieldValidationSchema = baseFieldValidationSchema.extend({
  options: z.array(z.string().min(1, 'Option text cannot be empty')).min(2, 'Radio fields need at least 2 options to choose from').refine(
    (options) => new Set(options.filter(opt => opt.trim())).size === options.filter(opt => opt.trim()).length,
    'Duplicate options are not allowed'
  ),
});

export const checkboxFieldValidationSchema = baseFieldValidationSchema.extend({
  options: z.array(z.string().min(1, 'Option text cannot be empty')).min(1, 'Add at least one option for checkboxes').refine(
    (options) => new Set(options.filter(opt => opt.trim())).size === options.filter(opt => opt.trim()).length,
    'Duplicate options are not allowed'
  ),
  multiple: z.boolean().default(true),
});

export const dateFieldValidationSchema = baseFieldValidationSchema.extend({
  minDate: z.string().optional().refine(
    (date) => !date || !isNaN(Date.parse(date)),
    'Invalid minimum date format'
  ),
  maxDate: z.string().optional().refine(
    (date) => !date || !isNaN(Date.parse(date)),
    'Invalid maximum date format'
  ),
  defaultValue: z.string().optional().refine(
    (date) => !date || !isNaN(Date.parse(date)),
    'Default value must be a valid date'
  ),
}).refine(
  (data) => {
    if (data.minDate && data.maxDate && data.minDate.trim() && data.maxDate.trim()) {
      return new Date(data.minDate) <= new Date(data.maxDate);
    }
    return true;
  },
  {
    message: 'Minimum date must be before or equal to maximum date',
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
    message: 'Default date must be after or equal to minimum date',
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
    message: 'Default date must be before or equal to maximum date',
    path: ['defaultValue'],
  }
);

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

// Union type for all field form data
export type FieldFormData = 
  | TextInputFieldFormData
  | TextAreaFieldFormData
  | EmailFieldFormData
  | NumberFieldFormData
  | SelectFieldFormData
  | RadioFieldFormData
  | CheckboxFieldFormData
  | DateFieldFormData;

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
  pageMode: z.enum(['single_page', 'multipage']),
});

export type FormLayoutFormData = z.infer<typeof formLayoutValidationSchema>;
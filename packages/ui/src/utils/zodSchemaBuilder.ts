import { z } from 'zod';
import { parseCalendarDate } from '@dculus/utils';
import {
  FormField,
  FormPage,
  FieldType,
  FillableFormField,
  NumberField,
  DateField,
  CheckboxField,
  FileUploadField,
} from '@dculus/types';

export interface ValidationError {
  field: string;
  message: string;
}

export interface PageValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

const formatDateForDisplay = (isoDate: string): string => {
  try {
    const [year, month, day] = isoDate.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return isoDate;
  }
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const isFillableField = (field: FormField): field is FillableFormField =>
  field instanceof FillableFormField ||
  (field as any).label !== undefined ||
  field.type !== FieldType.FORM_FIELD;

/**
 * Creates a Zod schema for a single form field based on its validation properties
 */
export const createFieldSchema = (field: FormField): z.ZodTypeAny => {
  const fillableField = isFillableField(field)
    ? (field as FillableFormField)
    : null;

  if (!fillableField) {
    // Non-fillable fields don't require validation
    return z.any().optional();
  }

  const isRequired = fillableField.validation?.required || false;

  switch (field.type) {
    case FieldType.TEXT_INPUT_FIELD:
    case FieldType.TEXT_AREA_FIELD: {
      const textField = field as any;
      const textValidation = textField.validation;

      let schema: z.ZodString = z.string().trim();

      if (
        textValidation?.minLength !== undefined &&
        textValidation.minLength > 0
      ) {
        schema = schema.min(
          textValidation.minLength,
          `${fillableField.label} must be at least ${plural(textValidation.minLength, 'character')} long`
        );
      }

      if (
        textValidation?.maxLength !== undefined &&
        textValidation.maxLength > 0
      ) {
        schema = schema.max(
          textValidation.maxLength,
          `${fillableField.label} cannot exceed ${plural(textValidation.maxLength, 'character')}`
        );
      }

      if (isRequired) {
        return schema.min(1, `${fillableField.label} is required`);
      }

      // For optional fields with length constraints, allow blank (unfilled) submissions
      const hasConstraints =
        (textValidation?.minLength ?? 0) > 0 || (textValidation?.maxLength ?? 0) > 0;
      return hasConstraints
        ? z.union([z.literal(''), schema]).optional()
        : schema.optional();
    }

    case FieldType.EMAIL_FIELD: {
      const invalidEmailMsg = `${fillableField.label} must be a valid email address (e.g. name@example.com)`;
      if (isRequired) {
        return z
          .string()
          .trim()
          .min(1, `${fillableField.label} is required`)
          .email(invalidEmailMsg);
      } else {
        return z
          .union([
            z.literal(''),
            z.string().trim().email(invalidEmailMsg),
          ])
          .optional();
      }
    }

    case FieldType.NUMBER_FIELD: {
      const numberField = field as NumberField;

      // Create a schema that handles empty strings and numbers
      let schema: z.ZodTypeAny = z
        .union([
          z.string().length(0), // Allow empty string
          z.number({
            message: `${fillableField.label} must be a valid number`,
          }),
        ])
        .transform((val) => {
          // Transform empty string to undefined, keep numbers as is
          if (val === '') return undefined;
          return val as number;
        });

      // Add min/max constraints if specified
      if (numberField.min !== undefined || numberField.max !== undefined) {
        let rangeMsg: string;
        if (numberField.min !== undefined && numberField.max !== undefined) {
          rangeMsg = `${fillableField.label} must be between ${numberField.min} and ${numberField.max}`;
        } else if (numberField.min !== undefined) {
          rangeMsg = `${fillableField.label} must be at least ${numberField.min}`;
        } else {
          rangeMsg = `${fillableField.label} must be no more than ${numberField.max}`;
        }

        schema = (schema as any).refine(
          (val: any) => {
            if (val === undefined) return !isRequired; // Allow undefined if not required
            if (typeof val !== 'number') return false;
            if (numberField.min !== undefined && val < numberField.min) return false;
            if (numberField.max !== undefined && val > numberField.max) return false;
            return true;
          },
          { message: rangeMsg }
        );
      }

      if (!isRequired) {
        return (schema as any).optional();
      }

      // For required fields, ensure we have a number
      return (schema as any).refine(
        (val: any) => val !== undefined && typeof val === 'number',
        {
          message: `${fillableField.label} is required`,
        }
      );
    }

    case FieldType.DATE_FIELD: {
      const dateField = field as DateField;
      let schema: z.ZodTypeAny = z.string();

      if (isRequired) {
        schema = (schema as z.ZodString).min(
          1,
          `${fillableField.label} is required`
        );
      }

      // Convert string to date for validation — use local midnight to avoid UTC day shift
      schema = schema.refine(
        (dateStr: unknown) => {
          if (typeof dateStr !== 'string') return false;
          if (!dateStr && !isRequired) return true;
          if (!dateStr && isRequired) return false;

          const date = parseCalendarDate(dateStr);
          return !isNaN(date.getTime());
        },
        {
          message: `${fillableField.label} must be a valid date`,
        }
      );

      // Add min/max date constraints if specified
      if (dateField.minDate || dateField.maxDate) {
        let dateRangeMsg: string;
        if (dateField.minDate && dateField.maxDate) {
          dateRangeMsg = `${fillableField.label} must be between ${formatDateForDisplay(dateField.minDate)} and ${formatDateForDisplay(dateField.maxDate)}`;
        } else if (dateField.minDate) {
          dateRangeMsg = `${fillableField.label} must be on or after ${formatDateForDisplay(dateField.minDate)}`;
        } else {
          dateRangeMsg = `${fillableField.label} must be on or before ${formatDateForDisplay(dateField.maxDate!)}`;
        }

        schema = (schema as any).refine(
          (dateStr: unknown) => {
            if (typeof dateStr !== 'string') return false;
            if (!dateStr) return !isRequired;

            const date = parseCalendarDate(dateStr);

            if (dateField.minDate && date < parseCalendarDate(dateField.minDate)) {
              return false;
            }

            if (dateField.maxDate && date > parseCalendarDate(dateField.maxDate)) {
              return false;
            }

            return true;
          },
          { message: dateRangeMsg }
        );
      }

      if (!isRequired) {
        return schema.optional();
      }

      return schema;
    }

    case FieldType.SELECT_FIELD: {
      // SelectField is always single-select (no multiple property)
      if (isRequired) {
        return z
          .string()
          .min(1, `Please select an option for ${fillableField.label}`);
      } else {
        return z.string().optional();
      }
    }

    case FieldType.RADIO_FIELD: {
      if (isRequired) {
        return z
          .string()
          .min(1, `Please select an option for ${fillableField.label}`);
      } else {
        return z.string().optional();
      }
    }

    case FieldType.CHECKBOX_FIELD: {
      const checkboxField = field as CheckboxField;
      const checkboxValidation = checkboxField.validation;

      let schema: z.ZodTypeAny = z.array(z.string());

      // If field is required OR has minSelections, apply validation
      if (
        isRequired ||
        (checkboxValidation?.minSelections !== undefined &&
          checkboxValidation.minSelections > 0)
      ) {
        const minSelections = checkboxValidation?.minSelections || 1;

        if (isRequired) {
          // Required: enforce minimum selections
          schema = (schema as z.ZodArray<z.ZodString>).min(
            minSelections,
            `Please select at least ${plural(minSelections, 'option')} for ${fillableField.label}`
          );
        } else {
          // Not required but has minSelections: allow empty OR enforce min when selected
          schema = (schema as z.ZodArray<z.ZodString>).refine(
            (val) => val.length === 0 || val.length >= minSelections,
            {
              message: `For ${fillableField.label}, select at least ${plural(minSelections, 'option')} or leave all unchecked`,
            }
          );
        }
      }

      // Add maxSelections validation if specified
      if (
        checkboxValidation?.maxSelections !== undefined &&
        checkboxValidation.maxSelections > 0
      ) {
        schema = (schema as z.ZodArray<z.ZodString>).refine(
          (val) => val.length <= checkboxValidation.maxSelections!,
          {
            message: `${fillableField.label} allows a maximum of ${plural(checkboxValidation.maxSelections, 'selection')}`,
          }
        );
      }

      // Make optional if not required and no minSelections
      if (!isRequired && !checkboxValidation?.minSelections) {
        return schema.optional();
      }

      return schema;
    }

    case FieldType.FILE_UPLOAD_FIELD: {
      const fileUploadField = field as FileUploadField;
      // Values are File[] objects stored by the UI; validate presence for required fields
      let schema: z.ZodTypeAny = z.array(z.any());

      if (isRequired) {
        schema = (schema as z.ZodArray<z.ZodTypeAny>).min(
          1,
          `Please upload at least one file for ${fillableField.label}`
        );
      }

      if (fileUploadField.maxFiles) {
        schema = (schema as z.ZodArray<z.ZodTypeAny>).max(
          fileUploadField.maxFiles,
          `${fillableField.label} allows a maximum of ${plural(fileUploadField.maxFiles, 'file')}`
        );
      }

      if (!isRequired) {
        return schema.optional();
      }

      return schema;
    }

    default:
      return z.any().optional();
  }
};

/**
 * Creates a Zod schema for an entire form page
 */
export const createPageSchema = (page: FormPage): z.ZodObject<any> => {
  const schemaFields: Record<string, z.ZodTypeAny> = {};

  page.fields.forEach((field) => {
    schemaFields[field.id] = createFieldSchema(field);
  });

  return z.object(schemaFields);
};

/**
 * Creates default values for a page based on field types and default values
 */
export const createPageDefaultValues = (
  page: FormPage
): Record<string, any> => {
  const defaultValues: Record<string, any> = {};

  page.fields.forEach((field) => {
    const fillableField = isFillableField(field)
      ? (field as FillableFormField)
      : null;

    switch (field.type) {
      case FieldType.TEXT_INPUT_FIELD:
      case FieldType.TEXT_AREA_FIELD:
      case FieldType.EMAIL_FIELD:
      case FieldType.DATE_FIELD:
      case FieldType.SELECT_FIELD:
      case FieldType.RADIO_FIELD:
        defaultValues[field.id] = fillableField?.defaultValue || '';
        break;
      case FieldType.NUMBER_FIELD:
        defaultValues[field.id] = fillableField?.defaultValue
          ? Number(fillableField.defaultValue)
          : '';
        break;
      case FieldType.CHECKBOX_FIELD:
      case FieldType.FILE_UPLOAD_FIELD:
        defaultValues[field.id] = [];
        break;
      default:
        defaultValues[field.id] = '';
    }
  });

  return defaultValues;
};

/**
 * Validates a page's data and returns validation result
 */
export const validatePageData = (
  page: FormPage,
  data: Record<string, any>
): PageValidationResult => {
  const schema = createPageSchema(page);

  try {
    schema.parse(data);
    return {
      isValid: true,
      errors: [],
    };
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const validationErrors: ValidationError[] = error.issues.map(
        (err: any) => ({
          field: err.path.join('.'),
          message: err.message,
        })
      );

      return {
        isValid: false,
        errors: validationErrors,
      };
    }

    return {
      isValid: false,
      errors: [{ field: 'general', message: 'Validation failed' }],
    };
  }
};

/**
 * Gets validation error for a specific field
 */
export const getFieldError = (
  validationResult: PageValidationResult,
  fieldId: string
): string | undefined => {
  const error = validationResult.errors.find((err) => err.field === fieldId);
  return error?.message;
};

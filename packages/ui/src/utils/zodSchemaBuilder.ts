import { z } from 'zod';
import { FormField, FormPage, FieldType, FillableFormField, NumberField, DateField, SelectField, RadioField, CheckboxField } from '@dculus/types';

export interface ValidationError {
  field: string;
  message: string;
}

export interface PageValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Creates a Zod schema for a single form field based on its validation properties
 */
export const createFieldSchema = (field: FormField): z.ZodTypeAny => {
  // Check if field is fillable to access validation properties
  const isFillableField = (field: FormField): field is FillableFormField => {
    return field instanceof FillableFormField || 
           (field as any).label !== undefined ||
           field.type !== FieldType.FORM_FIELD;
  };

  const fillableField = isFillableField(field) ? field as FillableFormField : null;
  
  if (!fillableField) {
    // Non-fillable fields don't require validation
    return z.any().optional();
  }

  const isRequired = fillableField.validation?.required || false;

  switch (field.type) {
    case FieldType.TEXT_INPUT_FIELD:
    case FieldType.TEXT_AREA_FIELD: {
      if (isRequired) {
        return z.string().min(1, `${fillableField.label} is required`);
      } else {
        return z.string().optional();
      }
    }

    case FieldType.EMAIL_FIELD: {
      if (isRequired) {
        return z.string().min(1, `${fillableField.label} is required`).email(`Please enter a valid email address`);
      } else {
        return z.string().email(`Please enter a valid email address`).optional();
      }
    }

    case FieldType.NUMBER_FIELD: {
      const numberField = field as NumberField;
      
      // Create a schema that handles empty strings and numbers
      let schema: z.ZodTypeAny = z.union([
        z.string().length(0), // Allow empty string
        z.number({
          invalid_type_error: `${fillableField.label} must be a number`,
        })
      ]).transform((val) => {
        // Transform empty string to undefined, keep numbers as is
        if (val === '') return undefined;
        return val as number;
      });

      // Add min/max constraints if specified
      if (numberField.min !== undefined || numberField.max !== undefined) {
        schema = (schema as any).refine((val: any) => {
          if (val === undefined) return !isRequired; // Allow undefined if not required
          if (typeof val !== 'number') return false;
          
          if (numberField.min !== undefined && val < numberField.min) {
            return false;
          }
          if (numberField.max !== undefined && val > numberField.max) {
            return false;
          }
          return true;
        }, {
          message: `${fillableField.label} must be ${numberField.min !== undefined ? `at least ${numberField.min}` : ''}${numberField.min !== undefined && numberField.max !== undefined ? ' and ' : ''}${numberField.max !== undefined ? `at most ${numberField.max}` : ''}`
        });
      }

      if (!isRequired) {
        return (schema as any).optional();
      }
      
      // For required fields, ensure we have a number
      return (schema as any).refine((val: any) => val !== undefined && typeof val === 'number', {
        message: `${fillableField.label} is required`
      });
    }

    case FieldType.DATE_FIELD: {
      const dateField = field as DateField;
      let schema: z.ZodTypeAny = z.string();

      if (isRequired) {
        schema = (schema as z.ZodString).min(1, `${fillableField.label} is required`);
      }

      // Convert string to date for validation
      schema = schema.refine((dateStr: string) => {
        if (!dateStr && !isRequired) return true;
        if (!dateStr && isRequired) return false;
        
        const date = new Date(dateStr);
        return !isNaN(date.getTime());
      }, {
        message: `Please enter a valid date`
      });

      // Add min/max date constraints if specified
      if (dateField.minDate || dateField.maxDate) {
        schema = (schema as any).refine((dateStr: string) => {
          if (!dateStr) return !isRequired;
          
          const date = new Date(dateStr);
          
          if (dateField.minDate && date < new Date(dateField.minDate)) {
            return false;
          }
          
          if (dateField.maxDate && date > new Date(dateField.maxDate)) {
            return false;
          }
          
          return true;
        }, {
          message: `Date must be ${dateField.minDate ? `after ${dateField.minDate}` : ''}${dateField.minDate && dateField.maxDate ? ' and ' : ''}${dateField.maxDate ? `before ${dateField.maxDate}` : ''}`
        });
      }

      if (!isRequired) {
        return schema.optional();
      }
      
      return schema;
    }

    case FieldType.SELECT_FIELD: {
      // SelectField is always single-select (no multiple property)
      if (isRequired) {
        return z.string().min(1, `Please select a ${fillableField.label.toLowerCase()}`);
      } else {
        return z.string().optional();
      }
    }

    case FieldType.RADIO_FIELD: {
      if (isRequired) {
        return z.string().min(1, `Please select a ${fillableField.label.toLowerCase()}`);
      } else {
        return z.string().optional();
      }
    }

    case FieldType.CHECKBOX_FIELD: {
      if (isRequired) {
        return z.array(z.string()).min(1, `Please select at least one ${fillableField.label.toLowerCase()}`);
      } else {
        return z.array(z.string()).optional();
      }
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
export const createPageDefaultValues = (page: FormPage): Record<string, any> => {
  const defaultValues: Record<string, any> = {};

  page.fields.forEach((field) => {
    const isFillableField = (field: FormField): field is FillableFormField => {
      return field instanceof FillableFormField || 
             (field as any).label !== undefined ||
             field.type !== FieldType.FORM_FIELD;
    };

    const fillableField = isFillableField(field) ? field as FillableFormField : null;

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
        defaultValues[field.id] = fillableField?.defaultValue ? Number(fillableField.defaultValue) : '';
        break;
      case FieldType.CHECKBOX_FIELD:
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
export const validatePageData = (page: FormPage, data: Record<string, any>): PageValidationResult => {
  const schema = createPageSchema(page);
  
  try {
    schema.parse(data);
    return {
      isValid: true,
      errors: []
    };
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const validationErrors: ValidationError[] = error.errors.map((err: any) => ({
        field: err.path.join('.'),
        message: err.message
      }));
      
      return {
        isValid: false,
        errors: validationErrors
      };
    }
    
    return {
      isValid: false,
      errors: [{ field: 'general', message: 'Validation failed' }]
    };
  }
};

/**
 * Gets validation error for a specific field
 */
export const getFieldError = (validationResult: PageValidationResult, fieldId: string): string | undefined => {
  const error = validationResult.errors.find(err => err.field === fieldId);
  return error?.message;
};
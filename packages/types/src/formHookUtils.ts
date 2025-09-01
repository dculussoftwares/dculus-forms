import { FormPage, FormField, CheckboxField, FieldType } from './index.js';

/**
 * Create a React Hook Form resolver for a specific form page
 * Note: Validation has been removed - returns undefined (no resolver)
 */
export function createPageResolver(page: FormPage) {
  return undefined;
}

/**
 * Generate default values for a form page based on field defaults
 */
export function generatePageDefaultValues(page: FormPage): Record<string, any> {
  const defaultValues: Record<string, any> = {};
  
  for (const field of page.fields) {
    const fieldValue = getDefaultValueForField(field);
    if (fieldValue !== undefined) {
      defaultValues[field.id] = fieldValue;
    }
  }
  
  return defaultValues;
}

/**
 * Get the default value for a specific field type
 */
function getDefaultValueForField(field: FormField): any {
  // Handle checkbox fields specially since they don't have string defaultValue
  if (field.type === FieldType.CHECKBOX_FIELD) {
    if (field instanceof CheckboxField) {
      return field.defaultValues;
    }
    return [];
  }

  // Type guard to check if field has defaultValue property
  const hasDefaultValue = (field: any): field is { defaultValue: string } => {
    return 'defaultValue' in field && typeof field.defaultValue === 'string';
  };

  if (hasDefaultValue(field)) {
    // Handle different field types for default values
    switch (field.type) {
      case FieldType.NUMBER_FIELD:
        const numValue = parseFloat(field.defaultValue);
        return isNaN(numValue) ? undefined : numValue;
      case FieldType.SELECT_FIELD:
        // Check if this is a multi-select field
        const isMultiple = (field as any).multiple;
        if (isMultiple) {
          return field.defaultValue ? field.defaultValue.split(',').map(s => s.trim()) : [];
        }
        return field.defaultValue;
      default:
        return field.defaultValue;
    }
  }

  // Return appropriate empty values for each field type
  switch (field.type) {
    case FieldType.SELECT_FIELD:
      const isMultiple = (field as any).multiple;
      return isMultiple ? [] : '';
    case FieldType.NUMBER_FIELD:
      return undefined;
    default:
      return '';
  }
}


/**
 * Create field registration options for React Hook Form
 * Note: Validation has been removed - returns empty object
 */
export function createFieldRegistration(field: FormField) {
  return {};
}

/**
 * Form mode configuration
 * Note: Validation modes have been removed
 */
export const FORM_VALIDATION_MODE = {
  shouldUnregister: false,        // Keep values when fields are unmounted
} as const;


/**
 * Transform form data before submission
 */
export function transformFormDataForSubmission(
  page: FormPage,
  formData: Record<string, any>
): Record<string, any> {
  const transformed: Record<string, any> = {};
  
  for (const field of page.fields) {
    const value = formData[field.id];
    
    // Handle field-specific transformations
    switch (field.type) {
      case FieldType.NUMBER_FIELD:
        // Ensure numbers are properly typed
        transformed[field.id] = value === '' ? null : value;
        break;
      case FieldType.CHECKBOX_FIELD:
        // Ensure checkboxes are arrays
        transformed[field.id] = Array.isArray(value) ? value : [];
        break;
      case FieldType.SELECT_FIELD:
        const isMultiple = (field as any).multiple;
        if (isMultiple) {
          transformed[field.id] = Array.isArray(value) ? value : [];
        } else {
          transformed[field.id] = value || '';
        }
        break;
      default:
        transformed[field.id] = value || '';
    }
  }
  
  return transformed;
}
import { FormPage, FormField } from './index';

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
  // Type guard to check if field has defaultValue property
  const hasDefaultValue = (field: any): field is { defaultValue: string } => {
    return 'defaultValue' in field && typeof field.defaultValue === 'string';
  };

  if (hasDefaultValue(field) && field.defaultValue) {
    // Handle different field types for default values
    switch (field.type) {
      case 'checkbox_field':
        // For checkbox fields, default value might be a comma-separated string
        return field.defaultValue ? field.defaultValue.split(',').map(s => s.trim()) : [];
      case 'number_field':
        const numValue = parseFloat(field.defaultValue);
        return isNaN(numValue) ? undefined : numValue;
      case 'select_field':
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
    case 'checkbox_field':
      return [];
    case 'select_field':
      const isMultiple = (field as any).multiple;
      return isMultiple ? [] : '';
    case 'number_field':
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
      case 'number_field':
        // Ensure numbers are properly typed
        transformed[field.id] = value === '' ? null : value;
        break;
      case 'checkbox_field':
        // Ensure checkboxes are arrays
        transformed[field.id] = Array.isArray(value) ? value : [];
        break;
      case 'select_field':
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
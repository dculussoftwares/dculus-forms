import { useCallback } from 'react';
import { FieldType } from '@dculus/types';
import { FieldTypeConfig } from '../components/form-builder/FieldTypesPanel';

export const useFieldCreation = () => {
  const createFieldData = useCallback((fieldType: FieldTypeConfig) => {
    const baseData = {
      label: fieldType.label,
      required: false,
      placeholder: `Enter ${fieldType.label.toLowerCase()}`,
      defaultValue: '',
      prefix: '',
      hint: '',
    };

    // Add type-specific default data
    if (
      fieldType.type === FieldType.SELECT_FIELD ||
      fieldType.type === FieldType.RADIO_FIELD ||
      fieldType.type === FieldType.CHECKBOX_FIELD
    ) {
      return {
        ...baseData,
        options: ['Option 1', 'Option 2'],
        ...(fieldType.type === FieldType.SELECT_FIELD ? { multiple: false } : {}),
      };
    }

    // Rich text field has different structure (non-fillable)
    if (fieldType.type === FieldType.RICH_TEXT_FIELD) {
      return {
        content: '<p>Enter your rich text content here...</p>',
      };
    }

    return baseData;
  }, []);

  return { createFieldData };
};
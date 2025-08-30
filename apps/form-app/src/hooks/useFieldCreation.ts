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
      validation: {
        required: false,
        type: fieldType.type,
      },
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

    // Add text field specific validation properties
    if (
      fieldType.type === FieldType.TEXT_INPUT_FIELD ||
      fieldType.type === FieldType.TEXT_AREA_FIELD
    ) {
      return {
        ...baseData,
        validation: {
          required: false,
          type: fieldType.type,
          minLength: undefined,
          maxLength: undefined,
        },
      };
    }

    return baseData;
  }, []);

  return { createFieldData };
};
import { useCallback } from 'react';
import { FieldType, setColumnCount } from '@dculus/types';
import { FieldTypeConfig } from '../components/form-builder/FieldTypesPanel';

export const useFieldCreation = () => {
  const createFieldData = useCallback((fieldType: FieldTypeConfig) => {
    // A grid holds no answer: its only data is the equal split for the tile's column count
    if (fieldType.type === FieldType.GRID_FIELD) {
      return { columnWidths: setColumnCount([], fieldType.preset?.columns ?? 2) };
    }

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
        ...(fieldType.type === FieldType.SELECT_FIELD
          ? { multiple: false }
          : {}),
      };
    }

    // File upload field has specific structure (no placeholder/defaultValue)
    if (fieldType.type === FieldType.FILE_UPLOAD_FIELD) {
      return {
        label: fieldType.label,
        required: false,
        hint: '',
        prefix: '',
        allowedMimeTypes: [],
        maxFileSizeMb: 5,
        maxFiles: 1,
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

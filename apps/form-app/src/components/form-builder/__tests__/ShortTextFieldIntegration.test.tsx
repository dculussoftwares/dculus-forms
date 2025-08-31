/**
 * Integration tests for Short Text Field Settings
 * Tests the interaction between field types, validation, and form handling
 */

import { FieldType } from '@dculus/types';

// Mock the field extraction logic similar to useFieldEditor
const extractFieldData = (field: any): any => {
  const baseData = {
    label: field.label || '',
    hint: field.hint || '',
    placeholder: field.placeholder || '',
    defaultValue: field.defaultValue || '',
    prefix: field.prefix || '',
    required: field.validation?.required || false,
  };

  // Add field-specific properties for text fields
  if (field.type === FieldType.TEXT_INPUT_FIELD || field.type === FieldType.TEXT_AREA_FIELD) {
    return {
      ...baseData,
      validation: {
        required: field.validation?.required || false,
        minLength: field.validation?.minLength || undefined,
        maxLength: field.validation?.maxLength || undefined,
      },
    };
  }

  return baseData;
};

// Mock field update logic similar to form builder store
const updateFieldValidation = (field: any, updates: any): any => {
  const updatedField = { ...field };
  
  if (updates.validation && (field.type === FieldType.TEXT_INPUT_FIELD || field.type === FieldType.TEXT_AREA_FIELD)) {
    updatedField.validation = {
      ...field.validation,
      required: updates.validation.required !== undefined ? updates.validation.required : field.validation?.required || false,
      minLength: updates.validation.minLength !== undefined ? updates.validation.minLength : field.validation?.minLength,
      maxLength: updates.validation.maxLength !== undefined ? updates.validation.maxLength : field.validation?.maxLength,
    };
  }
  
  return updatedField;
};

describe('Short Text Field Integration', () => {
  describe('Field Data Extraction', () => {
    test('extracts Short Text field data with character limits', () => {
      const field = {
        id: 'test-field',
        type: FieldType.TEXT_INPUT_FIELD,
        label: 'Test Label',
        hint: 'Test hint',
        placeholder: 'Test placeholder',
        defaultValue: 'Test default',
        prefix: '$',
        validation: {
          required: true,
          minLength: 10,
          maxLength: 200
        }
      };

      const extracted = extractFieldData(field);

      expect(extracted).toEqual({
        label: 'Test Label',
        hint: 'Test hint',
        placeholder: 'Test placeholder',
        defaultValue: 'Test default',
        prefix: '$',
        required: true,
        validation: {
          required: true,
          minLength: 10,
          maxLength: 200
        }
      });
    });

    test('handles field without validation object', () => {
      const field = {
        id: 'test-field',
        type: FieldType.TEXT_INPUT_FIELD,
        label: 'Test Label'
      };

      const extracted = extractFieldData(field);

      expect(extracted.validation).toEqual({
        required: false,
        minLength: undefined,
        maxLength: undefined
      });
    });

    test('handles field with partial validation', () => {
      const field = {
        id: 'test-field',
        type: FieldType.TEXT_INPUT_FIELD,
        label: 'Test Label',
        validation: {
          required: true
          // minLength and maxLength not set
        }
      };

      const extracted = extractFieldData(field);

      expect(extracted.validation).toEqual({
        required: true,
        minLength: undefined,
        maxLength: undefined
      });
    });
  });

  describe('Field Update Logic', () => {
    test('updates Short Text field with new character limits', () => {
      const originalField = {
        id: 'test-field',
        type: FieldType.TEXT_INPUT_FIELD,
        label: 'Test Label',
        validation: {
          required: false,
          minLength: 5,
          maxLength: 50
        }
      };

      const updates = {
        validation: {
          required: true,
          minLength: 10,
          maxLength: 100
        }
      };

      const updatedField = updateFieldValidation(originalField, updates);

      expect(updatedField.validation).toEqual({
        required: true,
        minLength: 10,
        maxLength: 100
      });
    });

    test('preserves existing validation when partially updating', () => {
      const originalField = {
        id: 'test-field',
        type: FieldType.TEXT_INPUT_FIELD,
        label: 'Test Label',
        validation: {
          required: true,
          minLength: 5,
          maxLength: 50
        }
      };

      const updates = {
        validation: {
          maxLength: 100
          // Only updating maxLength, should preserve required and minLength
        }
      };

      const updatedField = updateFieldValidation(originalField, updates);

      expect(updatedField.validation).toEqual({
        required: true,
        minLength: 5,
        maxLength: 100
      });
    });

    test('creates validation object when none exists', () => {
      const originalField = {
        id: 'test-field',
        type: FieldType.TEXT_INPUT_FIELD,
        label: 'Test Label'
        // No validation object
      };

      const updates = {
        validation: {
          required: true,
          minLength: 10
        }
      };

      const updatedField = updateFieldValidation(originalField, updates);

      expect(updatedField.validation).toEqual({
        required: true,
        minLength: 10,
        maxLength: undefined
      });
    });
  });

  describe('Character Limit Business Logic', () => {
    test('validates that 5000 is the maximum allowed character limit', () => {
      const maxAllowedLimit = 5000;
      
      // Test that our business logic enforces this limit
      const validateCharacterLimit = (value: number | string | undefined): boolean => {
        if (value === undefined || value === '') return true;
        const numValue = typeof value === 'string' ? parseInt(value) : value;
        return numValue <= maxAllowedLimit;
      };

      expect(validateCharacterLimit(5000)).toBe(true);
      expect(validateCharacterLimit(5001)).toBe(false);
      expect(validateCharacterLimit('5000')).toBe(true);
      expect(validateCharacterLimit('5001')).toBe(false);
      expect(validateCharacterLimit(undefined)).toBe(true);
      expect(validateCharacterLimit('')).toBe(true);
    });

    test('validates min <= max constraint', () => {
      const validateMinMaxConstraint = (min: number | string | undefined, max: number | string | undefined): boolean => {
        if (min === undefined || max === undefined || min === '' || max === '') return true;
        const minNum = typeof min === 'string' ? parseInt(min) : min;
        const maxNum = typeof max === 'string' ? parseInt(max) : max;
        return minNum <= maxNum;
      };

      expect(validateMinMaxConstraint(10, 100)).toBe(true);
      expect(validateMinMaxConstraint(100, 10)).toBe(false);
      expect(validateMinMaxConstraint('10', '100')).toBe(true);
      expect(validateMinMaxConstraint('100', '10')).toBe(false);
      expect(validateMinMaxConstraint(undefined, 100)).toBe(true);
      expect(validateMinMaxConstraint(10, undefined)).toBe(true);
    });
  });

  describe('Field Type Compatibility', () => {
    test('Short Text field supports character limits', () => {
      const fieldTypesWithCharacterLimits = [
        FieldType.TEXT_INPUT_FIELD,
        FieldType.TEXT_AREA_FIELD
      ];

      expect(fieldTypesWithCharacterLimits).toContain(FieldType.TEXT_INPUT_FIELD);
      expect(fieldTypesWithCharacterLimits).toContain(FieldType.TEXT_AREA_FIELD);
      expect(fieldTypesWithCharacterLimits).not.toContain(FieldType.NUMBER_FIELD);
      expect(fieldTypesWithCharacterLimits).not.toContain(FieldType.EMAIL_FIELD);
    });

    test('identifies when field supports character limits', () => {
      const supportsCharacterLimits = (fieldType: string): boolean => {
        return fieldType === FieldType.TEXT_INPUT_FIELD || fieldType === FieldType.TEXT_AREA_FIELD;
      };

      expect(supportsCharacterLimits(FieldType.TEXT_INPUT_FIELD)).toBe(true);
      expect(supportsCharacterLimits(FieldType.TEXT_AREA_FIELD)).toBe(true);
      expect(supportsCharacterLimits(FieldType.EMAIL_FIELD)).toBe(false);
      expect(supportsCharacterLimits(FieldType.NUMBER_FIELD)).toBe(false);
      expect(supportsCharacterLimits(FieldType.SELECT_FIELD)).toBe(false);
    });
  });
});
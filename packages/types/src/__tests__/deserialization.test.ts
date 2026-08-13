import { describe, it, expect } from 'vitest';
import {
  TextInputField,
  TextFieldValidation,
  CheckboxField,
  CheckboxFieldValidation,
  deserializeFormField,
  serializeFormField,
  FieldType,
} from '../index';

describe('Field Deserialization with Property Fallbacks', () => {
  describe('Required property fallbacks', () => {
    it('should preserve required=true from validation object (normal case)', () => {
      const field = new TextInputField(
        'field1',
        'Test Label',
        'default',
        '',
        'hint',
        'placeholder',
        new TextFieldValidation(true, 5, 100)
      );
      const serialized = serializeFormField(field);
      const deserialized = deserializeFormField(serialized);
      expect(deserialized.validation.required).toBe(true);
    });

    it('should use top-level required when validation object is missing', () => {
      const fieldData = {
        id: 'field2',
        type: FieldType.TEXT_INPUT_FIELD,
        label: 'AI Field',
        required: true, // Top-level required (AI sets this)
        placeholder: 'Enter text',
        defaultValue: '',
        prefix: '',
        hint: 'Test hint',
      };
      const deserialized = deserializeFormField(fieldData);
      expect(deserialized.validation.required).toBe(true);
    });

    it('should use top-level required when validation.required is missing', () => {
      const fieldData = {
        id: 'field3',
        type: FieldType.TEXT_INPUT_FIELD,
        label: 'Fallback Field',
        required: true, // Top-level required
        validation: {
          minLength: 2,
          maxLength: 20,
          // No required property in validation
        },
        placeholder: 'Enter text',
        defaultValue: '',
        prefix: '',
        hint: '',
      };
      const deserialized = deserializeFormField(fieldData);
      expect(deserialized.validation.required).toBe(true);
    });

    it('should default to false when no required property exists', () => {
      const fieldData = {
        id: 'field4',
        type: FieldType.TEXT_INPUT_FIELD,
        label: 'Default Field',
        placeholder: 'Enter text',
        defaultValue: '',
        prefix: '',
        hint: '',
      };
      const deserialized = deserializeFormField(fieldData);
      expect(deserialized.validation.required).toBe(false);
    });
  });

  describe('Validation range properties fallbacks', () => {
    it('should use top-level min/max when validation object is missing', () => {
      const fieldData = {
        id: 'field5',
        type: FieldType.TEXT_INPUT_FIELD,
        label: 'Min/Max Field',
        required: false,
        min: 3, // Top-level min
        max: 50, // Top-level max
        placeholder: 'Enter text',
        defaultValue: '',
        prefix: '',
        hint: '',
      };
      const deserialized = deserializeFormField(fieldData);
      expect(deserialized.validation.minLength).toBe(3);
      expect(deserialized.validation.maxLength).toBe(50);
    });

    it('should use validation.minLength/maxLength when available', () => {
      const fieldData = {
        id: 'field6',
        type: FieldType.TEXT_INPUT_FIELD,
        label: 'Text Field',
        required: false,
        validation: {
          required: false,
          minLength: 5,
          maxLength: 100,
        },
        placeholder: 'Enter text',
        defaultValue: '',
        prefix: '',
        hint: '',
      };
      const deserialized = deserializeFormField(fieldData);
      expect(deserialized.validation.minLength).toBe(5);
      expect(deserialized.validation.maxLength).toBe(100);
    });

    it('should prefer validation object over top-level properties', () => {
      const fieldData = {
        id: 'field7',
        type: FieldType.TEXT_INPUT_FIELD,
        label: 'Priority Field',
        required: false,
        min: 1, // Top-level min (should be ignored)
        max: 10, // Top-level max (should be ignored)
        validation: {
          required: false,
          minLength: 5, // Should use this
          maxLength: 100, // Should use this
        },
        placeholder: 'Enter text',
        defaultValue: '',
        prefix: '',
        hint: '',
      };
      const deserialized = deserializeFormField(fieldData);
      expect(deserialized.validation.minLength).toBe(5);
      expect(deserialized.validation.maxLength).toBe(100);
    });
  });

  describe('Checkbox field validation fallbacks', () => {
    it('should use top-level required for checkbox when validation is missing', () => {
      const fieldData = {
        id: 'field8',
        type: FieldType.CHECKBOX_FIELD,
        label: 'Checkbox Field',
        required: true, // Top-level required
        options: ['Option 1', 'Option 2'],
        placeholder: '',
        defaultValue: [],
        prefix: '',
        hint: '',
      };
      const deserialized = deserializeFormField(fieldData);
      expect(deserialized.validation.required).toBe(true);
    });

    it('should preserve all checkbox validation properties', () => {
      const field = new CheckboxField(
        'field9',
        'Checkbox Field',
        [],
        '',
        'hint',
        '',
        new CheckboxFieldValidation(true, 2, 5),
        ['Option 1', 'Option 2', 'Option 3']
      );
      const serialized = serializeFormField(field);
      const deserialized = deserializeFormField(serialized);
      expect(deserialized.validation.required).toBe(true);
      expect(deserialized.validation.minSelections).toBe(2);
      expect(deserialized.validation.maxSelections).toBe(5);
    });
  });

  describe('AI-generated field properties', () => {
    it('should handle complete AI field data with all properties', () => {
      const aiFieldData = {
        id: 'ai-field-1',
        type: FieldType.TEXT_INPUT_FIELD,
        label: 'Full Name',
        required: true,
        placeholder: 'Enter your full name',
        defaultValue: '',
        prefix: '',
        hint: 'Your full legal name',
        min: 2,
        max: 100,
      };
      const deserialized = deserializeFormField(aiFieldData);
      expect(deserialized.label).toBe('Full Name');
      expect(deserialized.validation.required).toBe(true);
      expect(deserialized.placeholder).toBe('Enter your full name');
      expect(deserialized.hint).toBe('Your full legal name');
      expect(deserialized.validation.minLength).toBe(2);
      expect(deserialized.validation.maxLength).toBe(100);
    });
  });
});

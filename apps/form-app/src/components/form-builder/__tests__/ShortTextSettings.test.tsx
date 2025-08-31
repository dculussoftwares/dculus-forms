/**
 * Unit tests for Short Text Field Settings functionality
 * Focuses on validation logic and form behavior for Text Input fields
 */

import { textInputFieldValidationSchema } from '@dculus/types';

describe('Short Text Field Settings', () => {
  describe('Character Limit Validation', () => {
    test('validates minimum length constraints', () => {
      const testData = {
        label: 'Test Field',
        validation: {
          minLength: 10,
          maxLength: 100
        }
      };

      const result = textInputFieldValidationSchema.safeParse(testData);
      expect(result.success).toBe(true);
    });

    test('rejects minimum length above 5000', () => {
      const testData = {
        label: 'Test Field',
        validation: {
          minLength: 6000
        }
      };

      const result = textInputFieldValidationSchema.safeParse(testData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('5000');
      }
    });

    test('rejects maximum length above 5000', () => {
      const testData = {
        label: 'Test Field',
        validation: {
          maxLength: 7000
        }
      };

      const result = textInputFieldValidationSchema.safeParse(testData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('5000');
      }
    });

    test('rejects when minimum length > maximum length', () => {
      const testData = {
        label: 'Test Field',
        validation: {
          minLength: 100,
          maxLength: 50
        }
      };

      const result = textInputFieldValidationSchema.safeParse(testData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Minimum length must be less than or equal to maximum length');
      }
    });

    test('accepts valid character limits within bounds', () => {
      const testData = {
        label: 'Test Field',
        validation: {
          minLength: 0,
          maxLength: 5000
        }
      };

      const result = textInputFieldValidationSchema.safeParse(testData);
      expect(result.success).toBe(true);
    });

    test('accepts string inputs for character limits', () => {
      const testData = {
        label: 'Test Field',
        validation: {
          minLength: '10',
          maxLength: '100'
        }
      };

      const result = textInputFieldValidationSchema.safeParse(testData);
      expect(result.success).toBe(true);
    });

    test('rejects string inputs above 5000', () => {
      const testData = {
        label: 'Test Field',
        validation: {
          minLength: '6000'
        }
      };

      const result = textInputFieldValidationSchema.safeParse(testData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('5000');
      }
    });

    test('accepts empty/undefined character limits', () => {
      const testData = {
        label: 'Test Field',
        validation: {
          minLength: undefined,
          maxLength: undefined
        }
      };

      const result = textInputFieldValidationSchema.safeParse(testData);
      expect(result.success).toBe(true);
    });

    test('accepts empty string character limits', () => {
      const testData = {
        label: 'Test Field',
        validation: {
          minLength: '',
          maxLength: ''
        }
      };

      const result = textInputFieldValidationSchema.safeParse(testData);
      expect(result.success).toBe(true);
    });
  });

  describe('Basic Field Validation', () => {
    test('requires field label', () => {
      const testData = {
        label: '',
        validation: {}
      };

      const result = textInputFieldValidationSchema.safeParse(testData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Field label is required');
      }
    });

    test('validates label length limits', () => {
      const testData = {
        label: 'a'.repeat(201), // Exceeds 200 char limit
        validation: {}
      };

      const result = textInputFieldValidationSchema.safeParse(testData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Label is too long');
      }
    });

    test('validates hint length limits', () => {
      const testData = {
        label: 'Test Field',
        hint: 'a'.repeat(501), // Exceeds 500 char limit
        validation: {}
      };

      const result = textInputFieldValidationSchema.safeParse(testData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Help text is too long');
      }
    });

    test('validates placeholder length limits', () => {
      const testData = {
        label: 'Test Field',
        placeholder: 'a'.repeat(101), // Exceeds 100 char limit
        validation: {}
      };

      const result = textInputFieldValidationSchema.safeParse(testData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Placeholder is too long');
      }
    });

    test('validates required field default value', () => {
      const testData = {
        label: 'Test Field',
        required: true,
        validation: {
          required: true
        }
      };

      const result = textInputFieldValidationSchema.safeParse(testData);
      expect(result.success).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('handles minimum length of 0', () => {
      const testData = {
        label: 'Test Field',
        validation: {
          minLength: 0,
          maxLength: 100
        }
      };

      const result = textInputFieldValidationSchema.safeParse(testData);
      expect(result.success).toBe(true);
    });

    test('handles maximum length of 5000 (boundary)', () => {
      const testData = {
        label: 'Test Field',
        validation: {
          minLength: 0,
          maxLength: 5000
        }
      };

      const result = textInputFieldValidationSchema.safeParse(testData);
      expect(result.success).toBe(true);
    });

    test('rejects negative minimum length', () => {
      const testData = {
        label: 'Test Field',
        validation: {
          minLength: -1
        }
      };

      const result = textInputFieldValidationSchema.safeParse(testData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Minimum length must be 0 or greater');
      }
    });

    test('rejects maximum length of 0', () => {
      const testData = {
        label: 'Test Field',
        validation: {
          maxLength: 0
        }
      };

      const result = textInputFieldValidationSchema.safeParse(testData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Maximum length must be 1 or greater');
      }
    });
  });
});
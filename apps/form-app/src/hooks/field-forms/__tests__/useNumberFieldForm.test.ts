import { renderHook, waitFor } from '@testing-library/react';
import { act } from '@testing-library/react';
import { useNumberFieldForm } from '../useNumberFieldForm';
import {
  createMockNumberField,
  createMockOnSave,
  createMockOnCancel,
  waitForHookUpdate,
  triggerValidation,
  switchField,
  submitForm,
  setFormValue,
  triggerAutoSave,
  expectFormToBeDirty,
  expectFormToBeClean,
  expectFormToBeValid,
  expectFormToBeInvalid,
  expectFormToHaveError,
  expectFormValue
} from './test-utils';

// Mock setTimeout for debouncing tests
jest.useFakeTimers();

describe('useNumberFieldForm', () => {
  afterEach(() => {
    jest.clearAllTimers();
    jest.clearAllMocks();
  });

  describe('Core Functionality', () => {
    test('initializes with correct default values', () => {
      const field = createMockNumberField({
        label: 'Test Number',
        hint: 'Enter a number',
        placeholder: 'Number input',
        prefix: '$',
        defaultValue: 42,
        min: 0,
        max: 100
      });
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useNumberFieldForm({ field, onSave })
      );

      expect(result.current.isDirty).toBe(false);
      expect(result.current.isValid).toBe(true);
      expect(result.current.isSaving).toBe(false);
      
      expectFormValue(result, 'label', 'Test Number');
      expectFormValue(result, 'hint', 'Enter a number');
      expectFormValue(result, 'placeholder', 'Number input');
      expectFormValue(result, 'prefix', '$');
      expectFormValue(result, 'defaultValue', 42);
      expectFormValue(result, 'min', 0);
      expectFormValue(result, 'max', 100);
    });

    test('handles field data extraction correctly', () => {
      const field = createMockNumberField({
        label: 'Required Number',
        validation: { required: true, type: 'number_field' },
        min: 5,
        max: 50
      });
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useNumberFieldForm({ field, onSave })
      );

      expectFormValue(result, 'label', 'Required Number');
      expectFormValue(result, 'required', true);
      expectFormValue(result, 'min', 5);
      expectFormValue(result, 'max', 50);
    });

    test('handles null/undefined number values correctly', () => {
      const field = createMockNumberField({
        defaultValue: undefined,
        min: undefined,
        max: undefined
      });
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useNumberFieldForm({ field, onSave })
      );

      expectFormValue(result, 'defaultValue', undefined);
      expectFormValue(result, 'min', undefined);
      expectFormValue(result, 'max', undefined);
    });
  });

  describe('Number Parsing and Validation', () => {
    test('validates form data according to schema', async () => {
      const field = createMockNumberField();
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useNumberFieldForm({ field, onSave })
      );

      // Test required label validation
      await setFormValue(result, 'label', '');
      await triggerValidation(result);

      expectFormToBeInvalid(result);
      expectFormToHaveError(result, 'label');
    });

    test('validates number range correctly (min ≤ max)', async () => {
      const field = createMockNumberField();
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useNumberFieldForm({ field, onSave })
      );

      // Set invalid range (min > max)
      await setFormValue(result, 'min', 100);
      await setFormValue(result, 'max', 50);
      await triggerValidation(result);

      expectFormToBeInvalid(result);
      expectFormToHaveError(result, 'max');
    });

    test('validates default value against min/max range', async () => {
      const field = createMockNumberField();
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useNumberFieldForm({ field, onSave })
      );

      // Set range constraints
      await setFormValue(result, 'min', 10);
      await setFormValue(result, 'max', 20);
      
      // Set default value outside range
      await setFormValue(result, 'defaultValue', 5);
      await triggerValidation(result);

      expectFormToBeInvalid(result);
      expectFormToHaveError(result, 'defaultValue');

      // Fix default value to be within range
      await setFormValue(result, 'defaultValue', 15);
      await waitFor(() => {
        expectFormToBeValid(result);
      });
    });

    test('handles decimal numbers correctly', async () => {
      const field = createMockNumberField();
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useNumberFieldForm({ field, onSave })
      );

      // Set decimal values
      await setFormValue(result, 'defaultValue', 12.5);
      await setFormValue(result, 'min', 0.5);
      await setFormValue(result, 'max', 99.9);
      await triggerValidation(result);

      expectFormToBeValid(result);
      expectFormValue(result, 'defaultValue', 12.5);
      expectFormValue(result, 'min', 0.5);
      expectFormValue(result, 'max', 99.9);
    });

    test('handles NaN and invalid number inputs', async () => {
      const field = createMockNumberField();
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useNumberFieldForm({ field, onSave })
      );

      // Test form handles conversion properly through transform functions
      // This would typically be handled by FormInputField transform
      await act(async () => {
        result.current.setValue('defaultValue', '');
      });
      await triggerValidation(result);

      expectFormToBeValid(result);
      expectFormValue(result, 'defaultValue', undefined);
    });
  });

  describe('Form State Management', () => {
    test('handles form reset correctly', async () => {
      const field = createMockNumberField({ 
        label: 'Original Label',
        defaultValue: 10 
      });
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useNumberFieldForm({ field, onSave })
      );

      // Make changes
      await setFormValue(result, 'label', 'Modified Label');
      await setFormValue(result, 'defaultValue', 20);
      expectFormToBeDirty(result);

      // Reset form
      await act(async () => {
        result.current.handleReset();
      });

      expectFormToBeClean(result);
      expectFormValue(result, 'label', 'Original Label');
      expectFormValue(result, 'defaultValue', 10);
    });

    test('handles form cancel correctly', async () => {
      const field = createMockNumberField({ 
        label: 'Original Label',
        min: 0 
      });
      const onSave = createMockOnSave();
      const onCancel = createMockOnCancel();

      const { result } = renderHook(() =>
        useNumberFieldForm({ field, onSave, onCancel })
      );

      // Make changes
      await setFormValue(result, 'label', 'Modified Label');
      await setFormValue(result, 'min', 10);
      expectFormToBeDirty(result);

      // Cancel changes
      await act(async () => {
        result.current.handleCancel();
      });

      expectFormToBeClean(result);
      expectFormValue(result, 'label', 'Original Label');
      expectFormValue(result, 'min', 0);
      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cross-field Validation', () => {
    test('re-triggers validation when min value changes', async () => {
      const field = createMockNumberField({
        defaultValue: 15,
        max: 20
      });
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useNumberFieldForm({ field, onSave })
      );

      // Set min value that makes default invalid
      await setFormValue(result, 'min', 18);
      
      await waitFor(() => {
        expectFormToBeInvalid(result);
      });
    });

    test('re-triggers validation when max value changes', async () => {
      const field = createMockNumberField({
        defaultValue: 15,
        min: 10
      });
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useNumberFieldForm({ field, onSave })
      );

      // Set max value that makes default invalid
      await setFormValue(result, 'max', 12);
      
      await waitFor(() => {
        expectFormToBeInvalid(result);
      });
    });

    test('re-triggers validation when default value changes', async () => {
      const field = createMockNumberField({
        min: 10,
        max: 20
      });
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useNumberFieldForm({ field, onSave })
      );

      // Set default value outside range
      await setFormValue(result, 'defaultValue', 25);
      
      await waitFor(() => {
        expectFormToBeInvalid(result);
      });
    });
  });

  describe('Save Functionality', () => {
    test('saves form data with proper transformation', async () => {
      const field = createMockNumberField();
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useNumberFieldForm({ field, onSave })
      );

      // Set form values
      await setFormValue(result, 'label', 'New Number Field');
      await setFormValue(result, 'hint', 'Enter amount');
      await setFormValue(result, 'required', true);
      await setFormValue(result, 'defaultValue', 25);
      await setFormValue(result, 'min', 0);
      await setFormValue(result, 'max', 100);

      await submitForm(result);

      expect(onSave).toHaveBeenCalledWith({
        label: 'New Number Field',
        hint: 'Enter amount',
        placeholder: expect.any(String),
        prefix: expect.any(String),
        defaultValue: 25,
        min: 0,
        max: 100,
        validation: {
          required: true
        }
      });
    });

    test('handles undefined/null number values in save', async () => {
      const field = createMockNumberField();
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useNumberFieldForm({ field, onSave })
      );

      // Set undefined values
      await setFormValue(result, 'defaultValue', undefined);
      await setFormValue(result, 'min', undefined);
      await setFormValue(result, 'max', undefined);

      await submitForm(result);

      expect(onSave).toHaveBeenCalledWith({
        label: expect.any(String),
        hint: expect.any(String),
        placeholder: expect.any(String),
        prefix: expect.any(String),
        defaultValue: undefined,
        min: undefined,
        max: undefined,
        validation: {
          required: expect.any(Boolean)
        }
      });
    });

    test('prevents invalid submissions', async () => {
      const field = createMockNumberField();
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useNumberFieldForm({ field, onSave })
      );

      // Create invalid state (empty label)
      await setFormValue(result, 'label', '');
      
      await act(async () => {
        try {
          await result.current.handleSave();
        } catch (error) {
          // Expected to fail validation
        }
      });

      expect(onSave).not.toHaveBeenCalled();
    });

    test('handles save errors gracefully', async () => {
      const field = createMockNumberField();
      const onSave = jest.fn().mockRejectedValue(new Error('Save failed'));

      const { result } = renderHook(() =>
        useNumberFieldForm({ field, onSave })
      );

      await setFormValue(result, 'label', 'New Label');

      await act(async () => {
        try {
          await result.current.handleSave();
        } catch (error) {
          expect(error.message).toBe('Save failed');
        }
      });

      expect(result.current.isSaving).toBe(false);
    });
  });

  describe('Auto-save Behavior', () => {
    test('debounces auto-save correctly', async () => {
      const field = createMockNumberField();
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useNumberFieldForm({ field, onSave })
      );

      // Make form dirty and valid
      await setFormValue(result, 'label', 'New Label');

      // Trigger auto-save multiple times quickly
      await triggerAutoSave(result);
      await triggerAutoSave(result);
      await triggerAutoSave(result);

      // Fast-forward timers to trigger debounced save
      await act(async () => {
        jest.advanceTimersByTime(500);
      });

      // Should only be called once due to debouncing
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    test('does not auto-save when form is invalid', async () => {
      const field = createMockNumberField();
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useNumberFieldForm({ field, onSave })
      );

      // Make form invalid (min > max)
      await setFormValue(result, 'min', 100);
      await setFormValue(result, 'max', 50);

      await triggerAutoSave(result);

      // Fast-forward timers
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      expect(onSave).not.toHaveBeenCalled();
    });
  });

  describe('Field Switching', () => {
    test('handles rapid field switching without data loss', async () => {
      const field1 = createMockNumberField({ 
        id: 'field-1', 
        label: 'Number 1',
        defaultValue: 10
      });
      const field2 = createMockNumberField({ 
        id: 'field-2', 
        label: 'Number 2',
        defaultValue: 20
      });
      const onSave = createMockOnSave();

      const { result, rerender } = renderHook(
        ({ field }) => useNumberFieldForm({ field, onSave }),
        { initialProps: { field: field1 } }
      );

      // Make changes to field 1
      await setFormValue(result, 'label', 'Modified Number 1');
      expectFormToBeDirty(result);

      // Switch to field 2
      await switchField(result, field2, rerender);

      // Verify field 2 data is loaded
      expectFormValue(result, 'label', 'Number 2');
      expectFormValue(result, 'defaultValue', 20);
      expectFormToBeClean(result);
    });
  });

  describe('Performance and Stability', () => {
    test('memoizes validation schema properly', () => {
      const field = createMockNumberField();
      const onSave = createMockOnSave();

      const { result, rerender } = renderHook(() =>
        useNumberFieldForm({ field, onSave })
      );

      const initialSchema = result.current.form;

      // Re-render with same props
      rerender();

      // Should maintain same form instance (memoized)
      expect(result.current.form).toBe(initialSchema);
    });

    test('handles concurrent updates gracefully', async () => {
      const field = createMockNumberField();
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useNumberFieldForm({ field, onSave })
      );

      // Simulate concurrent updates
      await act(async () => {
        result.current.setValue('label', 'Update 1');
        result.current.setValue('defaultValue', 10);
        result.current.setValue('label', 'Update 2');
      });

      expectFormValue(result, 'label', 'Update 2');
      expectFormValue(result, 'defaultValue', 10);
    });
  });

  describe('Error Handling', () => {
    test('handles malformed field data gracefully', () => {
      const malformedField = {
        ...createMockNumberField(),
        min: 'invalid', // Invalid number
        max: null,
        validation: null
      } as any;
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useNumberFieldForm({ field: malformedField, onSave })
      );

      // Should not crash and provide reasonable defaults
      expect(result.current.isDirty).toBe(false);
      expect(result.current.isValid).toBe(true);
      expectFormValue(result, 'min', undefined);
      expectFormValue(result, 'max', undefined);
    });

    test('recovers from validation errors', async () => {
      const field = createMockNumberField();
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useNumberFieldForm({ field, onSave })
      );

      // Create validation error (min > max)
      await setFormValue(result, 'min', 100);
      await setFormValue(result, 'max', 50);
      await triggerValidation(result);
      expectFormToBeInvalid(result);

      // Recover from error
      await setFormValue(result, 'max', 150);
      await waitFor(() => {
        expectFormToBeValid(result);
      });
    });
  });
});
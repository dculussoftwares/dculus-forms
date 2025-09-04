import { renderHook, waitFor } from '@testing-library/react';
import { act } from '@testing-library/react';
import { useTextFieldForm } from '../useTextFieldForm';
import { TextFieldValidation, FieldType } from '@dculus/types';
import {
  createMockTextField,
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

describe('useTextFieldForm', () => {
  afterEach(() => {
    jest.clearAllTimers();
    jest.clearAllMocks();
  });

  describe('Core Functionality', () => {
    test('initializes with correct default values', () => {
      const field = createMockTextField({
        label: 'Test Label',
        hint: 'Test hint',
        placeholder: 'Test placeholder',
        prefix: '$',
        defaultValue: 'default text'
      });
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useTextFieldForm({ field, onSave })
      );

      expect(result.current.isDirty).toBe(false);
      expect(result.current.isValid).toBe(true);
      expect(result.current.isSaving).toBe(false);
      
      expectFormValue(result, 'label', 'Test Label');
      expectFormValue(result, 'hint', 'Test hint');
      expectFormValue(result, 'placeholder', 'Test placeholder');
      expectFormValue(result, 'prefix', '$');
      expectFormValue(result, 'defaultValue', 'default text');
    });

    test('handles field data extraction correctly', () => {
      const validation = new TextFieldValidation(true, 5, 100);
      const field = createMockTextField({
        label: 'Required Field',
        validation
      });
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useTextFieldForm({ field, onSave })
      );

      expectFormValue(result, 'label', 'Required Field');
      expectFormValue(result, 'required', true);
      expectFormValue(result, 'validation.minLength', 5);
      expectFormValue(result, 'validation.maxLength', 100);
    });

    test('validates form data according to schema', async () => {
      const field = createMockTextField();
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useTextFieldForm({ field, onSave })
      );

      // Test required label validation
      await setFormValue(result, 'label', '');
      await triggerValidation(result);

      expectFormToBeInvalid(result);
      expectFormToHaveError(result, 'label');
    });
  });

  describe('Form State Management', () => {
    test('handles form reset correctly', async () => {
      const field = createMockTextField({ label: 'Original Label' });
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useTextFieldForm({ field, onSave })
      );

      // Make changes
      await setFormValue(result, 'label', 'Modified Label');
      expectFormToBeDirty(result);

      // Reset form
      await act(async () => {
        result.current.handleReset();
      });

      expectFormToBeClean(result);
      expectFormValue(result, 'label', 'Original Label');
    });

    test('handles form cancel correctly', async () => {
      const field = createMockTextField({ label: 'Original Label' });
      const onSave = createMockOnSave();
      const onCancel = createMockOnCancel();

      const { result } = renderHook(() =>
        useTextFieldForm({ field, onSave, onCancel })
      );

      // Make changes
      await setFormValue(result, 'label', 'Modified Label');
      expectFormToBeDirty(result);

      // Cancel changes
      await act(async () => {
        result.current.handleCancel();
      });

      expectFormToBeClean(result);
      expectFormValue(result, 'label', 'Original Label');
      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('Validation', () => {
    test('validates character limits correctly', async () => {
      const field = createMockTextField();
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useTextFieldForm({ field, onSave })
      );

      // Set invalid character limits (min > max)
      await setFormValue(result, 'validation.minLength', 100);
      await setFormValue(result, 'validation.maxLength', 50);
      await triggerValidation(result);

      expectFormToBeInvalid(result);
      expectFormToHaveError(result, 'validation.maxLength');
    });

    test('handles cross-field validation (min ≤ max)', async () => {
      const field = createMockTextField();
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useTextFieldForm({ field, onSave })
      );

      // Set valid character limits
      await setFormValue(result, 'validation.minLength', 5);
      await setFormValue(result, 'validation.maxLength', 10);
      await triggerValidation(result);

      expectFormToBeValid(result);
    });

    test('validates default value against character limits', async () => {
      const field = createMockTextField();
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useTextFieldForm({ field, onSave })
      );

      // Set character limits
      await setFormValue(result, 'validation.minLength', 10);
      await setFormValue(result, 'validation.maxLength', 20);
      
      // Set default value that's too short
      await setFormValue(result, 'defaultValue', 'short');
      await triggerValidation(result);

      expectFormToBeInvalid(result);
      expectFormToHaveError(result, 'defaultValue');
    });

    test('clears errors when input becomes valid', async () => {
      const field = createMockTextField();
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useTextFieldForm({ field, onSave })
      );

      // Create invalid state
      await setFormValue(result, 'label', '');
      await triggerValidation(result);
      expectFormToBeInvalid(result);

      // Fix the error
      await setFormValue(result, 'label', 'Valid Label');
      await waitFor(() => {
        expectFormToBeValid(result);
      });
    });
  });

  describe('Save Functionality', () => {
    test('saves form data with proper transformation', async () => {
      const field = createMockTextField();
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useTextFieldForm({ field, onSave })
      );

      // Set form values
      await setFormValue(result, 'label', 'New Label');
      await setFormValue(result, 'hint', 'New hint');
      await setFormValue(result, 'required', true);
      await setFormValue(result, 'validation.minLength', 5);

      await submitForm(result);

      expect(onSave).toHaveBeenCalledWith({
        label: 'New Label',
        hint: 'New hint',
        placeholder: expect.any(String),
        prefix: expect.any(String),
        defaultValue: expect.any(String),
        validation: {
          required: true,
          minLength: 5,
          maxLength: undefined
        }
      });
    });

    test('prevents invalid submissions', async () => {
      const field = createMockTextField();
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useTextFieldForm({ field, onSave })
      );

      // Create invalid state
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
      const field = createMockTextField();
      const onSave = jest.fn().mockRejectedValue(new Error('Save failed'));

      const { result } = renderHook(() =>
        useTextFieldForm({ field, onSave })
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
      const field = createMockTextField();
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useTextFieldForm({ field, onSave })
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
      const field = createMockTextField();
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useTextFieldForm({ field, onSave })
      );

      // Make form dirty but invalid
      await setFormValue(result, 'label', '');

      await triggerAutoSave(result);

      // Fast-forward timers
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      expect(onSave).not.toHaveBeenCalled();
    });

    test('does not auto-save when already saving', async () => {
      const field = createMockTextField();
      const onSave = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 1000))
      );

      const { result } = renderHook(() =>
        useTextFieldForm({ field, onSave })
      );

      await setFormValue(result, 'label', 'New Label');

      // Start first save
      act(() => {
        result.current.handleSave();
      });

      expect(result.current.isSaving).toBe(true);

      // Try to trigger auto-save while saving
      await triggerAutoSave(result);

      // Fast-forward timers
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      // Should only be called once
      expect(onSave).toHaveBeenCalledTimes(1);
    });
  });

  describe('Field Switching', () => {
    test('handles rapid field switching without data loss', async () => {
      const field1 = createMockTextField({ id: 'field-1', label: 'Field 1' });
      const field2 = createMockTextField({ id: 'field-2', label: 'Field 2' });
      const onSave = createMockOnSave();

      const { result, rerender } = renderHook(
        ({ field }) => useTextFieldForm({ field, onSave }),
        { initialProps: { field: field1 } }
      );

      // Make changes to field 1
      await setFormValue(result, 'label', 'Modified Field 1');
      expectFormToBeDirty(result);

      // Switch to field 2
      await switchField(result, field2, rerender);

      // Verify field 2 data is loaded
      expectFormValue(result, 'label', 'Field 2');
      expectFormToBeClean(result);
    });

    test('memoizes validation schema properly', () => {
      const field = createMockTextField();
      const onSave = createMockOnSave();

      const { result, rerender } = renderHook(() =>
        useTextFieldForm({ field, onSave })
      );

      const initialSchema = result.current.form;

      // Re-render with same field type
      rerender();

      // Should maintain same form instance (memoized)
      expect(result.current.form).toBe(initialSchema);
    });
  });

  describe('Performance', () => {
    test('does not re-render unnecessarily', () => {
      const field = createMockTextField();
      const onSave = createMockOnSave();

      let renderCount = 0;
      const { rerender } = renderHook(() => {
        renderCount++;
        return useTextFieldForm({ field, onSave });
      });

      const initialRenderCount = renderCount;

      // Re-render with same props
      rerender();

      // Should not cause unnecessary re-renders of the hook
      expect(renderCount).toBe(initialRenderCount + 1);
    });

    test('memoizes expensive computations', async () => {
      const field = createMockTextField();
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useTextFieldForm({ field, onSave })
      );

      // Multiple access to form data should use memoized values
      const data1 = result.current.getValues();
      const data2 = result.current.getValues();

      expect(data1).toBe(data2); // Same reference due to memoization
    });
  });

  describe('Error Handling', () => {
    test('handles malformed field data gracefully', () => {
      const malformedField = {
        ...createMockTextField(),
        validation: null // Invalid validation
      } as any;
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useTextFieldForm({ field: malformedField, onSave })
      );

      // Should not crash and provide reasonable defaults
      expect(result.current.isDirty).toBe(false);
      expect(result.current.isValid).toBe(true);
    });

    test('recovers from validation errors', async () => {
      const field = createMockTextField();
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useTextFieldForm({ field, onSave })
      );

      // Create validation error
      await setFormValue(result, 'label', '');
      await triggerValidation(result);
      expectFormToBeInvalid(result);

      // Recover from error
      await setFormValue(result, 'label', 'Valid Label');
      await waitFor(() => {
        expectFormToBeValid(result);
      });
    });
  });
});
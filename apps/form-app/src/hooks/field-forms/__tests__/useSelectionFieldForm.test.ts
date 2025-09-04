import { renderHook, waitFor } from '@testing-library/react';
import { act } from '@testing-library/react';
import { useSelectionFieldForm } from '../useSelectionFieldForm';
import {
  createMockSelectField,
  createMockCheckboxField,
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

describe('useSelectionFieldForm', () => {
  afterEach(() => {
    jest.clearAllTimers();
    jest.clearAllMocks();
  });

  describe('Core Functionality - Select Field', () => {
    test('initializes with correct default values for select field', () => {
      const field = createMockSelectField({
        label: 'Test Select',
        hint: 'Choose option',
        placeholder: 'Select...',
        options: ['Option 1', 'Option 2', 'Option 3'],
        multiple: true
      });
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useSelectionFieldForm({ field, onSave })
      );

      expect(result.current.isDirty).toBe(false);
      expect(result.current.isValid).toBe(true);
      expect(result.current.isSaving).toBe(false);
      
      expectFormValue(result, 'label', 'Test Select');
      expectFormValue(result, 'hint', 'Choose option');
      expectFormValue(result, 'placeholder', 'Select...');
      expectFormValue(result, 'options', ['Option 1', 'Option 2', 'Option 3']);
      expectFormValue(result, 'multiple', true);
    });

    test('initializes with correct default values for checkbox field', () => {
      const field = createMockCheckboxField({
        label: 'Test Checkbox',
        options: ['Choice 1', 'Choice 2'],
        validation: {
          required: true,
          type: 'checkbox_field_validation',
          minSelections: 1,
          maxSelections: 2
        }
      });
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useSelectionFieldForm({ field, onSave })
      );

      expectFormValue(result, 'label', 'Test Checkbox');
      expectFormValue(result, 'options', ['Choice 1', 'Choice 2']);
      expectFormValue(result, 'required', true);
      expectFormValue(result, 'validation.minSelections', 1);
      expectFormValue(result, 'validation.maxSelections', 2);
    });
  });

  describe('Options Management', () => {
    test('adds new option correctly', async () => {
      const field = createMockSelectField({
        options: ['Option 1', 'Option 2']
      });
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useSelectionFieldForm({ field, onSave })
      );

      // Add new option
      await act(async () => {
        result.current.addOption();
      });

      expectFormToBeDirty(result);
      expectFormValue(result, 'options', ['Option 1', 'Option 2', '']);
    });

    test('updates existing option correctly', async () => {
      const field = createMockSelectField({
        options: ['Option 1', 'Option 2']
      });
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useSelectionFieldForm({ field, onSave })
      );

      // Update option at index 1
      await act(async () => {
        result.current.updateOption(1, 'Updated Option 2');
      });

      expectFormToBeDirty(result);
      expectFormValue(result, 'options', ['Option 1', 'Updated Option 2']);
    });

    test('removes option correctly', async () => {
      const field = createMockSelectField({
        options: ['Option 1', 'Option 2', 'Option 3']
      });
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useSelectionFieldForm({ field, onSave })
      );

      // Remove option at index 1
      await act(async () => {
        result.current.removeOption(1);
      });

      expectFormToBeDirty(result);
      expectFormValue(result, 'options', ['Option 1', 'Option 3']);
    });

    test('prevents removing last option', async () => {
      const field = createMockSelectField({
        options: ['Only Option']
      });
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useSelectionFieldForm({ field, onSave })
      );

      // Try to remove the only option
      await act(async () => {
        result.current.removeOption(0);
      });

      // Should keep at least one (empty) option
      expectFormValue(result, 'options', ['']);
    });
  });

  describe('Validation', () => {
    test('validates required label', async () => {
      const field = createMockSelectField();
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useSelectionFieldForm({ field, onSave })
      );

      // Set empty label
      await setFormValue(result, 'label', '');
      await triggerValidation(result);

      expectFormToBeInvalid(result);
      expectFormToHaveError(result, 'label');
    });

    test('validates at least one option is required', async () => {
      const field = createMockSelectField();
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useSelectionFieldForm({ field, onSave })
      );

      // Set empty options array
      await setFormValue(result, 'options', []);
      await triggerValidation(result);

      expectFormToBeInvalid(result);
      expectFormToHaveError(result, 'options');
    });

    test('validates options are unique and non-empty', async () => {
      const field = createMockSelectField();
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useSelectionFieldForm({ field, onSave })
      );

      // Set duplicate options
      await setFormValue(result, 'options', ['Option 1', 'Option 1', 'Option 2']);
      await triggerValidation(result);

      expectFormToBeInvalid(result);
      expectFormToHaveError(result, 'options');
    });

    test('validates selection limits for checkbox fields (min ≤ max)', async () => {
      const field = createMockCheckboxField();
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useSelectionFieldForm({ field, onSave })
      );

      // Set invalid selection limits (min > max)
      await setFormValue(result, 'validation.minSelections', 5);
      await setFormValue(result, 'validation.maxSelections', 2);
      await triggerValidation(result);

      expectFormToBeInvalid(result);
      expectFormToHaveError(result, 'validation.maxSelections');
    });

    test('validates max selections does not exceed available options', async () => {
      const field = createMockCheckboxField({
        options: ['Option 1', 'Option 2'] // Only 2 options
      });
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useSelectionFieldForm({ field, onSave })
      );

      // Set max selections greater than available options
      await setFormValue(result, 'validation.maxSelections', 5);
      await triggerValidation(result);

      expectFormToBeInvalid(result);
      expectFormToHaveError(result, 'validation.maxSelections');
    });

    test('validates default value is valid option', async () => {
      const field = createMockSelectField({
        options: ['Valid 1', 'Valid 2']
      });
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useSelectionFieldForm({ field, onSave })
      );

      // Set invalid default value
      await setFormValue(result, 'defaultValue', 'Invalid Option');
      await triggerValidation(result);

      expectFormToBeInvalid(result);
      expectFormToHaveError(result, 'defaultValue');
    });
  });

  describe('Cross-field Validation', () => {
    test('re-triggers validation when options change', async () => {
      const field = createMockCheckboxField({
        options: ['Option 1', 'Option 2', 'Option 3'],
        validation: { 
          required: false, 
          type: 'checkbox_field_validation',
          maxSelections: 3 
        }
      });
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useSelectionFieldForm({ field, onSave })
      );

      // Remove options to make maxSelections invalid
      await act(async () => {
        result.current.removeOption(2);
        result.current.removeOption(1);
      });

      await waitFor(() => {
        expectFormToBeInvalid(result);
      });
    });

    test('re-triggers validation when selection limits change', async () => {
      const field = createMockCheckboxField({
        defaultValue: ['Option 1', 'Option 2'],
        options: ['Option 1', 'Option 2', 'Option 3']
      });
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useSelectionFieldForm({ field, onSave })
      );

      // Set min selections that makes current default invalid
      await setFormValue(result, 'validation.minSelections', 3);
      
      await waitFor(() => {
        expectFormToBeInvalid(result);
      });
    });
  });

  describe('Form State Management', () => {
    test('handles form reset correctly', async () => {
      const field = createMockSelectField({ 
        label: 'Original Label',
        options: ['Original 1', 'Original 2']
      });
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useSelectionFieldForm({ field, onSave })
      );

      // Make changes
      await setFormValue(result, 'label', 'Modified Label');
      await act(async () => {
        result.current.updateOption(0, 'Modified 1');
      });
      expectFormToBeDirty(result);

      // Reset form
      await act(async () => {
        result.current.handleReset();
      });

      expectFormToBeClean(result);
      expectFormValue(result, 'label', 'Original Label');
      expectFormValue(result, 'options', ['Original 1', 'Original 2']);
    });

    test('handles form cancel correctly', async () => {
      const field = createMockCheckboxField({ 
        label: 'Original Label',
        options: ['Choice 1', 'Choice 2']
      });
      const onSave = createMockOnSave();
      const onCancel = createMockOnCancel();

      const { result } = renderHook(() =>
        useSelectionFieldForm({ field, onSave, onCancel })
      );

      // Make changes
      await setFormValue(result, 'label', 'Modified Label');
      await act(async () => {
        result.current.addOption();
      });
      expectFormToBeDirty(result);

      // Cancel changes
      await act(async () => {
        result.current.handleCancel();
      });

      expectFormToBeClean(result);
      expectFormValue(result, 'label', 'Original Label');
      expectFormValue(result, 'options', ['Choice 1', 'Choice 2']);
      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('Save Functionality', () => {
    test('saves select field data correctly', async () => {
      const field = createMockSelectField();
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useSelectionFieldForm({ field, onSave })
      );

      // Set form values
      await setFormValue(result, 'label', 'New Select Field');
      await setFormValue(result, 'hint', 'Choose one');
      await setFormValue(result, 'required', true);
      await setFormValue(result, 'multiple', true);
      await act(async () => {
        result.current.updateOption(0, 'Updated Option 1');
      });

      await submitForm(result);

      expect(onSave).toHaveBeenCalledWith({
        label: 'New Select Field',
        hint: 'Choose one',
        placeholder: expect.any(String),
        prefix: expect.any(String),
        defaultValue: expect.anything(),
        options: ['Updated Option 1', expect.any(String), expect.any(String)],
        multiple: true,
        validation: {
          required: true
        }
      });
    });

    test('saves checkbox field data with selection limits', async () => {
      const field = createMockCheckboxField();
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useSelectionFieldForm({ field, onSave })
      );

      // Set form values
      await setFormValue(result, 'label', 'New Checkbox Field');
      await setFormValue(result, 'required', true);
      await setFormValue(result, 'validation.minSelections', 1);
      await setFormValue(result, 'validation.maxSelections', 2);

      await submitForm(result);

      expect(onSave).toHaveBeenCalledWith({
        label: 'New Checkbox Field',
        hint: expect.any(String),
        placeholder: expect.any(String),
        prefix: expect.any(String),
        defaultValue: expect.anything(),
        options: expect.any(Array),
        validation: {
          required: true,
          minSelections: 1,
          maxSelections: 2
        }
      });
    });

    test('filters out empty options when saving', async () => {
      const field = createMockSelectField({
        options: ['Option 1', '', 'Option 3', '  ', 'Option 5']
      });
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useSelectionFieldForm({ field, onSave })
      );

      await submitForm(result);

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          options: ['Option 1', 'Option 3', 'Option 5'] // Empty options filtered out
        })
      );
    });

    test('prevents invalid submissions', async () => {
      const field = createMockSelectField();
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useSelectionFieldForm({ field, onSave })
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
  });

  describe('Auto-save Behavior', () => {
    test('debounces auto-save correctly', async () => {
      const field = createMockSelectField();
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useSelectionFieldForm({ field, onSave })
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
      const field = createMockSelectField();
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useSelectionFieldForm({ field, onSave })
      );

      // Make form invalid (empty label)
      await setFormValue(result, 'label', '');

      await triggerAutoSave(result);

      // Fast-forward timers
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      expect(onSave).not.toHaveBeenCalled();
    });
  });

  describe('Field Switching', () => {
    test('handles switching between different selection field types', async () => {
      const selectField = createMockSelectField({ 
        id: 'select-1', 
        label: 'Select Field',
        options: ['Select 1', 'Select 2']
      });
      const checkboxField = createMockCheckboxField({ 
        id: 'checkbox-1', 
        label: 'Checkbox Field',
        options: ['Checkbox 1', 'Checkbox 2']
      });
      const onSave = createMockOnSave();

      const { result, rerender } = renderHook(
        ({ field }) => useSelectionFieldForm({ field, onSave }),
        { initialProps: { field: selectField } }
      );

      // Verify select field data
      expectFormValue(result, 'label', 'Select Field');
      expectFormValue(result, 'multiple', false);

      // Switch to checkbox field
      await switchField(result, checkboxField, rerender);

      // Verify checkbox field data is loaded
      expectFormValue(result, 'label', 'Checkbox Field');
      expectFormValue(result, 'validation.minSelections', undefined);
      expectFormToBeClean(result);
    });
  });

  describe('Error Handling', () => {
    test('handles malformed field data gracefully', () => {
      const malformedField = {
        ...createMockSelectField(),
        options: null, // Invalid options
        validation: undefined
      } as any;
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useSelectionFieldForm({ field: malformedField, onSave })
      );

      // Should not crash and provide reasonable defaults
      expect(result.current.isDirty).toBe(false);
      expectFormValue(result, 'options', []);
    });

    test('recovers from validation errors', async () => {
      const field = createMockSelectField();
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useSelectionFieldForm({ field, onSave })
      );

      // Create validation error (empty label)
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

  describe('Performance', () => {
    test('memoizes option handlers properly', async () => {
      const field = createMockSelectField();
      const onSave = createMockOnSave();

      const { result, rerender } = renderHook(() =>
        useSelectionFieldForm({ field, onSave })
      );

      const initialHandlers = {
        addOption: result.current.addOption,
        updateOption: result.current.updateOption,
        removeOption: result.current.removeOption
      };

      // Re-render with same props
      rerender();

      // Handlers should maintain same reference (memoized)
      expect(result.current.addOption).toBe(initialHandlers.addOption);
      expect(result.current.updateOption).toBe(initialHandlers.updateOption);
      expect(result.current.removeOption).toBe(initialHandlers.removeOption);
    });

    test('handles large option lists efficiently', async () => {
      const largeOptions = Array.from({ length: 100 }, (_, i) => `Option ${i + 1}`);
      const field = createMockSelectField({
        options: largeOptions
      });
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useSelectionFieldForm({ field, onSave })
      );

      // Should handle large lists without performance issues
      expectFormValue(result, 'options', largeOptions);
      expectFormToBeValid(result);

      // Should be able to add/update/remove options efficiently
      await act(async () => {
        result.current.addOption();
        result.current.updateOption(50, 'Updated Option 51');
        result.current.removeOption(99);
      });

      expect(result.current.getValues('options')).toHaveLength(100); // 100 original + 1 added - 1 removed
    });
  });
});
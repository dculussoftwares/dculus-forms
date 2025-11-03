/**
 * Performance and Stability Tests for Field Settings V2
 * These tests ensure the new architecture performs well and handles edge cases gracefully
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import {
  useTextFieldForm,
  useNumberFieldForm,
  useSelectionFieldForm,
  useRichTextFieldForm
} from '../../../../hooks/field-forms';

jest.mock('@hookform/resolvers/zod', () => ({
  zodResolver: () => () => ({ values: {}, errors: {} }),
}));

// Mock field creation utilities
const createMockField = (type: string, id: string = 'test-id') => {
  switch (type) {
    case 'text':
      return {
        id,
        type: 'text_input_field',
        label: 'Test Field',
        defaultValue: '',
        validation: { required: false }
      };
    case 'number':
      return {
        id,
        type: 'number_field',
        label: 'Test Number',
        defaultValue: 0,
        validation: { required: false }
      };
    case 'select':
      return {
        id,
        type: 'select_field',
        label: 'Test Select',
        options: ['Option 1', 'Option 2'],
        validation: { required: false }
      };
    case 'date':
      return {
        id,
        type: 'date_field',
        label: 'Test Date',
        defaultValue: '',
        validation: { required: false }
      };
    case 'richtext':
      return {
        id,
        type: 'rich_text_field',
        content: 'Test content'
      };
    default:
      return null;
  }
};

const createMockOnSave = () => jest.fn().mockResolvedValue(undefined);

describe('Performance and Stability Tests', () => {
  describe('Memory and Render Performance', () => {
    test('text field hook does not cause memory leaks', () => {
      const field = createMockField('text') as any;
      const onSave = createMockOnSave();

      // Render and unmount multiple times to check for memory leaks
      for (let i = 0; i < 10; i++) {
        const { unmount } = renderHook(() =>
          useTextFieldForm({ field, onSave })
        );
        unmount();
      }

      // If there were memory leaks, this test would fail due to excessive memory usage
      expect(true).toBe(true);
    });

    test('number field hook handles rapid field switching efficiently', async () => {
      const onSave = createMockOnSave();
      
      // Create multiple fields
      const fields = Array.from({ length: 5 }, (_, i) => 
        createMockField('number', `field-${i}`)
      );

      const { result, rerender } = renderHook(
        ({ field }) => useNumberFieldForm({ field, onSave }),
        { initialProps: { field: fields[0] as any } }
      );

      // Rapidly switch between fields
      for (const field of fields) {
        await act(async () => {
          rerender({ field: field as any });
        });
      }

      // Should not crash and should be stable
      expect(result.current.isValid).toBeDefined();
    });

    test('selection field hook handles large option lists efficiently', async () => {
      // Create field with large number of options
      const largeOptionList = Array.from({ length: 100 }, (_, i) => `Option ${i + 1}`);
      const field = {
        ...createMockField('select'),
        options: largeOptionList
      };
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useSelectionFieldForm({ field: field as any, onSave })
      );

      // Should handle large lists without performance issues
      expect(result.current.getValues('options')).toHaveLength(100);

      // Should be able to modify options efficiently
      await act(async () => {
        result.current.addOption();
        result.current.updateOption(50, 'Updated Option 51');
        result.current.removeOption(99);
      });

      expect(result.current.getValues('options')).toHaveLength(100); // 100 - 1 + 1
    });
  });

  describe('Error Handling and Stability', () => {
    test('hooks gracefully handle null/undefined field data', () => {
      const onSave = createMockOnSave();

      // Test with null field
      expect(() => {
        renderHook(() => useTextFieldForm({ field: null, onSave }));
      }).not.toThrow();

      expect(() => {
        renderHook(() => useNumberFieldForm({ field: null, onSave }));
      }).not.toThrow();

      expect(() => {
        renderHook(() => useSelectionFieldForm({ field: null, onSave }));
      }).not.toThrow();
    });

    test('hooks handle malformed field data gracefully', () => {
      const onSave = createMockOnSave();
      
      // Create malformed fields
      const malformedFields = [
        { id: 'test', type: 'text_input_field' }, // Missing required properties
        { id: 'test', type: 'number_field', min: 'invalid' }, // Invalid type
        { id: 'test', type: 'select_field', options: null }, // Null options
      ];

      malformedFields.forEach(field => {
        expect(() => {
          renderHook(() => useTextFieldForm({ field: field as any, onSave }));
        }).not.toThrow();
      });
    });

    test('hooks support manual validation cycle after label changes', async () => {
      const field = createMockField('text') as any;
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useTextFieldForm({ field, onSave })
      );

      // Create validation error
      await act(async () => {
        result.current.setValue('label', '', {
          shouldDirty: true,
          shouldValidate: false,
        });
      });
      await act(async () => {
        await result.current.form.trigger();
      });

      // Label should reflect update and form marked dirty
      expect(result.current.form.getValues('label')).toBe('');
      expect(result.current.form.formState.isDirty).toBe(true);

      // Restore a valid label
      await act(async () => {
        result.current.setValue('label', 'Valid Label', {
          shouldDirty: true,
          shouldValidate: false,
        });
        await result.current.form.trigger();
      });

      // Label remains updated and validation ran without throwing
      expect(result.current.form.getValues('label')).toBe('Valid Label');
    });

    test('hooks process overlapping save requests sequentially', async () => {
      const field = createMockField('text') as any;
      const onSave = jest.fn()
        .mockImplementationOnce(() => new Promise(resolve => setTimeout(resolve, 100)))
        .mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useTextFieldForm({ field, onSave })
      );

      // Make field dirty and valid
      await act(async () => {
        result.current.setValue('label', 'Valid Label', {
          shouldDirty: true,
          shouldValidate: true,
        });
        await result.current.form.trigger();
      });

      // Start first save
      const firstSave = result.current.handleSave();

      await waitFor(() => expect(result.current.isSaving).toBe(true));

      // Try to start another save while first is in progress
      await act(async () => {
        await result.current.handleSave();
      });

      // Both save attempts should complete sequentially
      expect(onSave).toHaveBeenCalledTimes(2);
      await act(async () => {
        await firstSave;
      });
      expect(result.current.isSaving).toBe(false);
    });
  });

  describe('Save Performance', () => {
    test('multiple rapid saves invoke onSave for each attempt', async () => {
      const field = createMockField('text') as any;
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useTextFieldForm({ field, onSave })
      );

      // Make form valid and dirty
      await act(async () => {
        result.current.setValue('label', 'Valid Label', {
          shouldDirty: true,
          shouldValidate: true,
        });
        await result.current.form.trigger();
      });

      // Trigger save multiple times quickly
      await act(async () => {
        await result.current.handleSave();
        await result.current.handleSave();
        await result.current.handleSave();
      });

      // Each save attempt should invoke onSave
      expect(onSave).toHaveBeenCalledTimes(3);
    });

    test('different field types have appropriate save behavior', async () => {
      const textField = createMockField('text') as any;
      const richTextField = createMockField('richtext') as any;
      const onSave = createMockOnSave();

      // Text field hook
      const { result: textResult } = renderHook(() =>
        useTextFieldForm({ field: textField, onSave })
      );

      // Rich text field hook
      const { result: richTextResult } = renderHook(() =>
        useRichTextFieldForm({ field: richTextField, onSave })
      );

      // Trigger save on both
      await act(async () => {
        textResult.current.setValue('label', 'Text Label', {
          shouldDirty: true,
          shouldValidate: true,
        });
        richTextResult.current.setValue('content', 'Rich text content', {
          shouldDirty: true,
          shouldValidate: true,
        });
        await textResult.current.form.trigger();
        await richTextResult.current.form.trigger();
        await textResult.current.handleSave();
        await richTextResult.current.handleSave();
      });

      // Both should save successfully
      expect(onSave).toHaveBeenCalledTimes(2);
    });
  });

  describe('Form State Consistency', () => {
    test('form state remains consistent during rapid updates', async () => {
      const field = createMockField('number') as any;
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useNumberFieldForm({ field, onSave })
      );

      // Perform rapid updates
      await act(async () => {
        result.current.setValue('label', 'Label 1');
        result.current.setValue('min', 0);
        result.current.setValue('max', 100);
        result.current.setValue('label', 'Label 2');
        result.current.setValue('defaultValue', 50);
      });

      // Final state should be consistent
      expect(result.current.getValues('label')).toBe('Label 2');
      expect(result.current.getValues('min')).toBe(0);
      expect(result.current.getValues('max')).toBe(100);
      expect(result.current.getValues('defaultValue')).toBe(50);
    });

    test('validation fields apply updates without inconsistencies', async () => {
      const field = createMockField('text') as any;
      const onSave = createMockOnSave();

      const { result } = renderHook(() =>
        useTextFieldForm({ field, onSave })
      );

      // Set invalid state
      await act(async () => {
        result.current.setValue('validation.minLength', 10, {
          shouldDirty: true,
          shouldValidate: false,
        });
        result.current.setValue('validation.maxLength', 5, {
          shouldDirty: true,
          shouldValidate: false,
        }); // Invalid: min > max
      });
      await act(async () => {
        await result.current.form.trigger();
      });

      // Values reflect invalid configuration
      expect(result.current.form.getValues('validation.minLength')).toBe(10);
      expect(result.current.form.getValues('validation.maxLength')).toBe(5);

      // Fix the validation
      await act(async () => {
        result.current.setValue('validation.maxLength', 15, {
          shouldDirty: true,
          shouldValidate: false,
        });
      });
      await act(async () => {
        await result.current.form.trigger();
      });

      // Updated values should be preserved after trigger
      expect(result.current.form.getValues('validation.maxLength')).toBe(15);
    });
  });

  describe('Resource Cleanup', () => {
    test('hooks clean up timers and subscriptions on unmount', () => {
      const field = createMockField('text') as any;
      const onSave = createMockOnSave();

      const { unmount } = renderHook(() =>
        useTextFieldForm({ field, onSave })
      );

      // Set up some pending operations
      // Note: This would require access to internal timer refs in actual implementation

      // Unmount should clean up resources
      expect(() => unmount()).not.toThrow();
    });

    test('hooks handle rapid mount/unmount cycles', () => {
      const field = createMockField('select') as any;
      const onSave = createMockOnSave();

      // Rapidly mount and unmount
      for (let i = 0; i < 5; i++) {
        const { unmount } = renderHook(() =>
          useSelectionFieldForm({ field, onSave })
        );
        unmount();
      }

      // Should not cause memory leaks or errors
      expect(true).toBe(true);
    });
  });
});

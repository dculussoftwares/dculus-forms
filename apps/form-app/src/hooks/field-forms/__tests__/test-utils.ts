import { renderHook, RenderHookResult } from '@testing-library/react';
import { act } from '@testing-library/react';
import { 
  TextInputField, 
  NumberField, 
  SelectField, 
  RadioField, 
  CheckboxField, 
  DateField, 
  RichTextFormField,
  FieldType,
  TextFieldValidation,
  CheckboxFieldValidation
} from '@dculus/types';

// Test utilities for field form hooks

/**
 * Creates a mock TextInputField for testing
 */
export const createMockTextField = (overrides: Partial<TextInputField> = {}): TextInputField => {
  const validation = overrides.validation || new TextFieldValidation(false);
  const field = new TextInputField(
    overrides.id || 'test-id',
    overrides.label || 'Test Label',
    overrides.defaultValue || 'default value',
    overrides.prefix || 'prefix',
    overrides.hint || 'hint text',
    overrides.placeholder || 'placeholder',
    validation
  );
  
  // Apply any additional overrides
  Object.assign(field, overrides);
  return field;
};

/**
 * Creates a mock NumberField for testing
 */
export const createMockNumberField = (overrides: Partial<NumberField> = {}): NumberField => {
  const field = new NumberField(
    overrides.id || 'test-id',
    overrides.label || 'Test Number',
    overrides.defaultValue !== undefined ? overrides.defaultValue : 10,
    overrides.prefix || '$',
    overrides.placeholder || 'Enter number',
    overrides.hint || 'Number hint',
    overrides.validation || { required: false },
    overrides.min !== undefined ? overrides.min : 0,
    overrides.max !== undefined ? overrides.max : 100
  );
  
  // Apply any additional overrides
  Object.assign(field, overrides);
  return field;
};

/**
 * Creates a mock SelectField for testing
 */
export const createMockSelectField = (overrides: Partial<SelectField> = {}): SelectField => {
  const field = new SelectField(
    overrides.id || 'test-id',
    overrides.label || 'Test Select',
    overrides.defaultValue || '',
    overrides.prefix || '',
    overrides.hint || 'Select hint',
    overrides.placeholder || 'Choose option',
    overrides.validation || { required: false },
    overrides.options || ['Option 1', 'Option 2', 'Option 3'],
    overrides.multiple || false
  );
  
  // Apply any additional overrides
  Object.assign(field, overrides);
  return field;
};

/**
 * Creates a mock CheckboxField for testing
 */
export const createMockCheckboxField = (overrides: Partial<CheckboxField> = {}): CheckboxField => {
  const validation = overrides.validation || new CheckboxFieldValidation(false);
  const field = new CheckboxField(
    overrides.id || 'test-id',
    overrides.label || 'Test Checkbox',
    overrides.defaultValue || [],
    overrides.prefix || '',
    overrides.hint || 'Checkbox hint',
    overrides.placeholder || 'Select options',
    validation,
    overrides.options || ['Option 1', 'Option 2', 'Option 3']
  );
  
  // Apply any additional overrides
  Object.assign(field, overrides);
  return field;
};

/**
 * Creates a mock DateField for testing
 */
export const createMockDateField = (overrides: Partial<DateField> = {}): DateField => {
  const field = new DateField(
    overrides.id || 'test-id',
    overrides.label || 'Test Date',
    overrides.defaultValue || '',
    overrides.prefix || '',
    overrides.hint || 'Date hint',
    overrides.placeholder || 'Select date',
    overrides.validation || { required: false },
    overrides.minDate,
    overrides.maxDate
  );
  
  // Apply any additional overrides
  Object.assign(field, overrides);
  return field;
};

/**
 * Creates a mock RichTextFormField for testing
 */
export const createMockRichTextField = (overrides: Partial<RichTextFormField> = {}): RichTextFormField => {
  const field = new RichTextFormField(
    overrides.id || 'test-id',
    overrides.content || '<p>Rich text content</p>'
  );
  
  // Apply any additional overrides
  Object.assign(field, overrides);
  return field;
};

/**
 * Mock onSave function for testing
 */
export const createMockOnSave = () => {
  const mock = jest.fn().mockResolvedValue(undefined);
  return mock;
};

/**
 * Mock onCancel function for testing
 */
export const createMockOnCancel = () => {
  const mock = jest.fn();
  return mock;
};

/**
 * Helper to wait for hook updates
 */
export const waitForHookUpdate = async () => {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
};

/**
 * Helper to trigger form validation
 */
export const triggerValidation = async (hookResult: RenderHookResult<any, any>) => {
  await act(async () => {
    // Trigger form validation
    await hookResult.result.current.form.trigger();
  });
};

/**
 * Helper to simulate field switching
 */
export const switchField = async (
  hookResult: RenderHookResult<any, any>,
  newField: any,
  rerender: (props: any) => void
) => {
  await act(async () => {
    rerender({ field: newField, onSave: createMockOnSave() });
  });
  await waitForHookUpdate();
};

/**
 * Helper to simulate form submission
 */
export const submitForm = async (hookResult: RenderHookResult<any, any>) => {
  await act(async () => {
    await hookResult.result.current.handleSave();
  });
};

/**
 * Helper to set form values
 */
export const setFormValue = async (
  hookResult: RenderHookResult<any, any>,
  name: string,
  value: any
) => {
  await act(async () => {
    hookResult.result.current.setValue(name, value, { shouldDirty: true });
  });
  await waitForHookUpdate();
};

/**
 * Helper to simulate auto-save trigger
 */
export const triggerAutoSave = async (hookResult: RenderHookResult<any, any>) => {
  await act(async () => {
    hookResult.result.current.handleAutoSave();
  });
};

/**
 * Assertion helpers
 */
export const expectFormToBeDirty = (hookResult: RenderHookResult<any, any>) => {
  expect(hookResult.result.current.isDirty).toBe(true);
};

export const expectFormToBeClean = (hookResult: RenderHookResult<any, any>) => {
  expect(hookResult.result.current.isDirty).toBe(false);
};

export const expectFormToBeValid = (hookResult: RenderHookResult<any, any>) => {
  expect(hookResult.result.current.isValid).toBe(true);
};

export const expectFormToBeInvalid = (hookResult: RenderHookResult<any, any>) => {
  expect(hookResult.result.current.isValid).toBe(false);
};

export const expectFormToHaveError = (
  hookResult: RenderHookResult<any, any>,
  fieldName: string
) => {
  const errors = hookResult.result.current.errors;
  const hasError = fieldName.includes('.') 
    ? fieldName.split('.').reduce((obj, key) => obj?.[key], errors)
    : errors[fieldName];
  expect(hasError).toBeDefined();
};

export const expectFormValue = (
  hookResult: RenderHookResult<any, any>,
  fieldName: string,
  expectedValue: any
) => {
  const value = hookResult.result.current.getValues(fieldName);
  expect(value).toEqual(expectedValue);
};
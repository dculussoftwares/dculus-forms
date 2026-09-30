import { renderHook, act } from '@testing-library/react';
import { z } from 'zod';
import { FieldType, FormField, getFieldValidationSchema } from '@dculus/types';
import { FIELD_AUTOSAVE_DELAY_MS, useFieldEditor } from '../useFieldEditor';

// @dculus/types is globally mocked (setupTests.ts); these tests exercise autosave
// mechanics, so a minimal real schema stands in for the per-type ones.
jest.mock('@hookform/resolvers/zod', () => ({
  zodResolver: () => async (values: unknown) => ({ values, errors: {} }),
}));

const testSchema = z
  .object({
    label: z.string().min(1),
    options: z.array(z.string().min(1)).min(2).optional(),
  })
  .passthrough();

beforeEach(() => {
  (getFieldValidationSchema as jest.Mock).mockReturnValue(testSchema);
});

const textField = (overrides: Record<string, unknown> = {}): FormField =>
  ({
    id: 'field-1',
    type: FieldType.TEXT_INPUT_FIELD,
    label: 'Name',
    hint: '',
    placeholder: '',
    prefix: '',
    defaultValue: '',
    validation: { required: false },
    ...overrides,
  } as unknown as FormField);

const radioField = (overrides: Record<string, unknown> = {}): FormField =>
  ({
    id: 'radio-1',
    type: FieldType.RADIO_FIELD,
    label: 'Pick one',
    hint: '',
    prefix: '',
    defaultValue: '',
    options: ['A', 'B'],
    validation: { required: true },
    ...overrides,
  } as unknown as FormField);

function setup(field: FormField, enabled = true) {
  const onSave = jest.fn();
  const hook = renderHook(
    (props: { field: FormField; enabled: boolean }) =>
      useFieldEditor({ field: props.field, enabled: props.enabled, onSave }),
    { initialProps: { field, enabled } }
  );
  const edit = (name: string, value: unknown) =>
    act(() => {
      hook.result.current.form.setValue(name as any, value as any);
    });
  const advance = (ms = FIELD_AUTOSAVE_DELAY_MS) =>
    act(() => {
      jest.advanceTimersByTime(ms);
    });
  return { onSave, edit, advance, ...hook };
}

describe('useFieldEditor autosave', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('debounces typing and writes only the changed property', () => {
    const { result, onSave, edit, advance } = setup(textField());

    edit('label', 'Full name');
    expect(onSave).not.toHaveBeenCalled();
    expect(result.current.saveStatus).toBe('pending');

    advance();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({ label: 'Full name' }, 'field-1');
    expect(result.current.saveStatus).toBe('saved');
  });

  it('saves boolean toggles immediately as a validation update', () => {
    const { onSave, edit, advance } = setup(textField());

    edit('required', true);
    advance(0);

    expect(onSave).toHaveBeenCalledWith(
      { validation: { required: true, minLength: null, maxLength: null } },
      'field-1'
    );
  });

  it('sends null for a cleared setting so it is removed', () => {
    const numberField = textField({ id: 'num-1', type: FieldType.NUMBER_FIELD, min: 5 });
    const { onSave, edit, advance } = setup(numberField);

    edit('min', undefined);
    advance();

    expect(onSave).toHaveBeenCalledWith({ min: null }, 'num-1');
  });

  it('saves unchecking required on choice fields', () => {
    const { onSave, edit, advance } = setup(radioField());

    edit('required', false);
    advance(0);

    expect(onSave).toHaveBeenCalledWith({ validation: { required: false } }, 'radio-1');
  });

  it('holds invalid edits back until they are fixed', () => {
    const { result, onSave, edit, advance } = setup(textField());

    edit('label', '');
    advance();
    expect(onSave).not.toHaveBeenCalled();
    expect(result.current.saveStatus).toBe('invalid');

    edit('label', 'Fixed');
    advance();
    expect(onSave).toHaveBeenCalledWith({ label: 'Fixed' }, 'field-1');
    expect(result.current.saveStatus).toBe('saved');
  });

  it('clears the invalid state when the value is reverted to what is saved', () => {
    const { result, onSave, edit, advance } = setup(textField());

    edit('label', '');
    advance();
    expect(result.current.saveStatus).toBe('invalid');

    edit('label', 'Name');
    advance();
    expect(onSave).not.toHaveBeenCalled();
    expect(result.current.saveStatus).toBe('saved');
  });

  it('does not block saving on a just-added blank option', () => {
    const { onSave, edit, advance } = setup(radioField());

    edit('options', ['A', 'B', 'C', '']);
    advance();

    expect(onSave).toHaveBeenCalledWith({ options: ['A', 'B', 'C'] }, 'radio-1');
  });

  it('flushes pending edits to the previously selected field', () => {
    const { result, onSave, edit, rerender } = setup(textField());

    edit('label', 'Edited');
    rerender({ field: textField({ id: 'field-2', label: 'Other' }), enabled: true });

    expect(onSave).toHaveBeenCalledWith({ label: 'Edited' }, 'field-1');
    expect(result.current.form.getValues('label')).toBe('Other');
    expect(result.current.saveStatus).toBe('idle');
  });

  it('flushes pending edits when the panel unmounts', () => {
    const { onSave, edit, unmount } = setup(textField());

    edit('hint', 'Help');
    unmount();

    expect(onSave).toHaveBeenCalledWith({ hint: 'Help' }, 'field-1');
  });

  it('holds edits while disabled and saves once re-enabled', () => {
    const { result, onSave, edit, advance, rerender } = setup(textField(), false);

    edit('label', 'Offline edit');
    advance();
    expect(onSave).not.toHaveBeenCalled();
    expect(result.current.saveStatus).toBe('pending');

    rerender({ field: textField(), enabled: true });
    expect(onSave).toHaveBeenCalledWith({ label: 'Offline edit' }, 'field-1');
  });
});

describe('useFieldEditor collaboration', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('applies incoming changes to untouched properties without saving them back', () => {
    const { result, onSave, advance, rerender } = setup(textField());

    rerender({ field: textField({ hint: 'From a collaborator' }), enabled: true });
    advance();

    expect(result.current.form.getValues('hint')).toBe('From a collaborator');
    expect(onSave).not.toHaveBeenCalled();
    expect(result.current.saveStatus).toBe('idle');
  });

  it('keeps local edits when the same property changes remotely', () => {
    const { result, onSave, edit, advance, rerender } = setup(textField());

    edit('label', 'Mine');
    rerender({ field: textField({ label: 'Theirs' }), enabled: true });
    expect(result.current.form.getValues('label')).toBe('Mine');

    advance();
    expect(onSave).toHaveBeenCalledWith({ label: 'Mine' }, 'field-1');
  });

  it('never overwrites properties a collaborator changed while another was edited', () => {
    const { onSave, edit, advance, rerender } = setup(textField());

    rerender({ field: textField({ placeholder: 'Theirs' }), enabled: true });
    edit('label', 'Mine');
    advance();

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toEqual({ label: 'Mine' });
  });

  it('does not re-apply its own normalized write when it round-trips', () => {
    const { result, edit, advance, rerender } = setup(radioField());

    edit('options', ['A', 'B', 'C', '']);
    advance();
    rerender({ field: radioField({ options: ['A', 'B', 'C'] }), enabled: true });

    expect(result.current.form.getValues('options')).toEqual(['A', 'B', 'C', '']);
  });
});

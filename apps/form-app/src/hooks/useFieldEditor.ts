import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { FieldType, FormField, getFieldValidationSchema, FieldFormData } from '@dculus/types';
import { FieldSaveStatus, UseFieldEditorProps, UseFieldEditorReturn } from './types';
import { extractFieldData } from './fieldDataExtractor';

/** Debounce for typed input; boolean toggles save immediately. */
export const FIELD_AUTOSAVE_DELAY_MS = 400;

type Values = Record<string, any>;

// `required` is edited top-level but persisted inside `validation`, so they are saved together.
const VALIDATION_KEYS = ['required', 'validation'];

const isObject = (value: unknown): value is Values =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Structural equality that treats `undefined` object keys as absent. */
export function isDeepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => isDeepEqual(item, b[i]));
  }
  if (isObject(a) && isObject(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return Array.from(keys).every((key) => isDeepEqual(a[key], b[key]));
  }
  return false;
}

// RHF mutates nested form values in place, so snapshots must not share references.
function cloneValue<T>(value: T): T {
  if (Array.isArray(value)) return value.map(cloneValue) as T;
  if (isObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cloneValue(item)])
    ) as T;
  }
  return value;
}

function getChangedKeys(next: Values, prev: Values): string[] {
  const keys = new Set([...Object.keys(next), ...Object.keys(prev)]);
  return Array.from(keys).filter((key) => !isDeepEqual(next[key], prev[key]));
}

// updateField drops blank options, so a just-added empty row shouldn't block saving the rest.
function withoutBlankOptions(values: Values): Values {
  if (!Array.isArray(values.options)) return values;
  return {
    ...values,
    options: values.options.filter(
      (option: unknown) => typeof option === 'string' && option.trim() !== ''
    ),
  };
}

/** Converts changed form keys into the partial update shape `updateField` expects. */
export function buildFieldUpdates(
  fieldType: FieldType,
  values: Values,
  changedKeys: string[]
): Values {
  const updates: Values = {};
  changedKeys
    .filter((key) => !VALIDATION_KEYS.includes(key))
    .forEach((key) => {
      updates[key] = values[key];
    });

  if (!changedKeys.some((key) => VALIDATION_KEYS.includes(key))) return updates;

  const validation: Values = values.validation ?? {};
  const required = values.required ?? validation.required ?? false;
  if (fieldType === FieldType.TEXT_INPUT_FIELD || fieldType === FieldType.TEXT_AREA_FIELD) {
    updates.validation = {
      required,
      minLength: validation.minLength,
      maxLength: validation.maxLength,
    };
  } else if (fieldType === FieldType.CHECKBOX_FIELD) {
    updates.validation = {
      required,
      minSelections: validation.minSelections,
      maxSelections: validation.maxSelections,
    };
  } else {
    updates.validation = { required };
  }
  return updates;
}

/**
 * Form state for the field settings panel with autosave.
 *
 * Only properties the user actually changed are written, so edits made by
 * collaborators (or inline on the canvas) to other properties are never
 * overwritten with stale panel values. Incoming document changes are applied
 * to the panel for any property the user isn't currently editing.
 */
export function useFieldEditor({
  field,
  onSave,
  enabled = true,
}: UseFieldEditorProps): UseFieldEditorReturn {
  const [saveStatus, setSaveStatus] = useState<FieldSaveStatus>('idle');

  // Memoize validation schema to prevent unnecessary re-renders
  const validationSchema = useMemo(() => {
    return field ? getFieldValidationSchema(field.type) : null;
  }, [field?.type]);

  const form = useForm<FieldFormData>({
    resolver: validationSchema ? zodResolver(validationSchema as any) : undefined,
    mode: 'onChange',
    reValidateMode: 'onChange',
    criteriaMode: 'all',
  });

  const { 
    reset, 
    watch, 
    trigger,
    formState: { errors, isValid },
    setValue,
    getValues
  } = form;

  // Watch all form values to detect changes (with stable reference)
  watch();
  

  // Watch specific fields for cross-field validation re-triggering
  const minDateValue = watch('minDate');
  const maxDateValue = watch('maxDate');
  const minValue = watch('min');
  const maxValue = watch('max');
  const defaultValue = watch('defaultValue');
  const minLengthValue = watch('validation.minLength');
  const maxLengthValue = watch('validation.maxLength');
  const minSelectionsValue = watch('validation.minSelections');
  const maxSelectionsValue = watch('validation.maxSelections');

  // Re-trigger validation when related fields change (for cross-field validation)
  useEffect(() => {
    if (field?.type === FieldType.DATE_FIELD) {
      // Trigger validation for all date-related fields when any of them change
      trigger(['minDate', 'maxDate', 'defaultValue']);
    } else if (field?.type === FieldType.NUMBER_FIELD) {
      // Trigger validation for all number-related fields when any of them change
      trigger(['min', 'max', 'defaultValue']);
    } else if (field?.type === FieldType.TEXT_INPUT_FIELD || field?.type === FieldType.TEXT_AREA_FIELD) {
      // Trigger validation for character limit fields when any of them change
      trigger(['validation.minLength', 'validation.maxLength', 'defaultValue']);
    } else if (field?.type === FieldType.CHECKBOX_FIELD) {
      // Trigger validation for selection limit fields when any of them change
      trigger(['validation.minSelections', 'validation.maxSelections', 'defaultValue', 'options']);
    }
  }, [minDateValue, maxDateValue, minValue, maxValue, defaultValue, minLengthValue, maxLengthValue, minSelectionsValue, maxSelectionsValue, field?.type, trigger]);

  const fieldRef = useRef<FormField | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  // Panel values known to match the document; a key differing from this has unsaved edits.
  const baselineRef = useRef<Values>({});
  // Document values last seen via the `field` prop, used to detect incoming changes.
  const syncedRef = useRef<Values>({});
  // Keys just written by this panel whose round-trip through the store must not be re-applied.
  const awaitingEchoRef = useRef<Set<string>>(new Set());
  const isApplyingRemoteRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const saveStatusRef = useRef(saveStatus);
  saveStatusRef.current = saveStatus;
  const lastSeenValuesRef = useRef<Values>({});

  const flush = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = undefined;
    const current = fieldRef.current;
    if (!current) return;

    const values = getValues() as Values;
    const changedKeys = getChangedKeys(values, baselineRef.current);
    if (changedKeys.length === 0) {
      setSaveStatus((status) => (status === 'idle' ? 'idle' : 'saved'));
      return;
    }
    if (!enabledRef.current) {
      setSaveStatus('pending');
      return;
    }
    const toSave = withoutBlankOptions(values);
    if (!getFieldValidationSchema(current.type).safeParse(toSave).success) {
      setSaveStatus('invalid');
      void trigger();
      return;
    }

    onSaveRef.current(buildFieldUpdates(current.type, toSave, changedKeys), current.id);
    baselineRef.current = cloneValue(values);
    const savedKeys = changedKeys.some((key) => VALIDATION_KEYS.includes(key))
      ? [...changedKeys, ...VALIDATION_KEYS]
      : changedKeys;
    savedKeys.forEach((key) => awaitingEchoRef.current.add(key));
    setSaveStatus('saved');
  }, [getValues, trigger]);

  const scheduleSave = useCallback((delay: number) => {
    clearTimeout(timerRef.current);
    setSaveStatus((status) => (status === 'invalid' ? status : 'pending'));
    timerRef.current = setTimeout(flush, delay);
  }, [flush]);

  // Load the selected field, or apply incoming document changes to the open one
  useEffect(() => {
    if (!field) return;

    if (field.id !== fieldRef.current?.id) {
      // Values still belong to the previous field until reset below
      flush();
      const data = extractFieldData(field);
      fieldRef.current = field;
      baselineRef.current = cloneValue(data);
      syncedRef.current = data;
      awaitingEchoRef.current = new Set();
      reset(data);
      setSaveStatus('idle');
      return;
    }

    fieldRef.current = field;
    const next = extractFieldData(field);
    const echoes = awaitingEchoRef.current;
    awaitingEchoRef.current = new Set();
    const values = getValues() as Values;
    const incomingKeys = getChangedKeys(next, syncedRef.current).filter(
      (key) => !echoes.has(key) && isDeepEqual(values[key], baselineRef.current[key])
    );
    syncedRef.current = next;
    if (incomingKeys.length === 0) return;

    isApplyingRemoteRef.current = true;
    try {
      incomingKeys.forEach((key) => {
        baselineRef.current[key] = cloneValue(next[key]);
        setValue(key as any, cloneValue(next[key]), { shouldValidate: true });
      });
    } finally {
      isApplyingRemoteRef.current = false;
    }
  }, [field, flush, getValues, reset, setValue]);

  // Autosave on user edits
  useEffect(() => {
    const subscription = watch((_values, { name }) => {
      if (!name || isApplyingRemoteRef.current) return;
      const values = getValues() as Values;
      // Validation-only notifications must not restart the debounce
      if (isDeepEqual(values, lastSeenValuesRef.current)) return;
      lastSeenValuesRef.current = cloneValue(values);

      const key = name.split('.')[0];
      const isUnchanged = isDeepEqual(values[key], baselineRef.current[key]);
      // An unchanged value only matters if it may clear a pending/invalid state
      if (isUnchanged && (saveStatusRef.current === 'idle' || saveStatusRef.current === 'saved')) return;
      const nextValue = getValues(name as any);
      scheduleSave(typeof nextValue === 'boolean' ? 0 : FIELD_AUTOSAVE_DELAY_MS);
    });
    return () => subscription.unsubscribe();
  }, [watch, getValues, scheduleSave]);

  // Retry held edits once saving is possible again (e.g. after reconnecting)
  useEffect(() => {
    if (enabled) flush();
  }, [enabled, flush]);

  // Cmd/Ctrl+S saves immediately instead of waiting for the debounce
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        flush();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [flush]);

  // Persist pending edits when the panel closes
  useEffect(() => () => flush(), [flush]);

  // Memoized option management functions for better performance
  const optionHandlers = useMemo(() => ({
    addOption: () => {
      const currentOptions = getValues('options') || [];
      setValue('options', [...currentOptions, ''], { shouldDirty: true });
    },
    updateOption: (index: number, value: string) => {
      const currentOptions = getValues('options') || [];
      const newOptions = [...currentOptions];
      newOptions[index] = value;
      setValue('options', newOptions, { shouldDirty: true });
    },
    removeOption: (index: number) => {
      const currentOptions = getValues('options') || [];
      const newOptions = currentOptions.filter((_, i) => i !== index);
      setValue('options', newOptions, { shouldDirty: true });
    },
  }), [getValues, setValue]);

  return {
    form,
    isValid,
    errors,
    saveStatus,
    handleSave: flush,
    addOption: optionHandlers.addOption,
    updateOption: optionHandlers.updateOption,
    removeOption: optionHandlers.removeOption,
    setValue,
    getValues,
  };
}

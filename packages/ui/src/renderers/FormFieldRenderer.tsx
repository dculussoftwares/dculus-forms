/**
 * FormFieldRenderer
 *
 * Renders every form field type using the shared UI kit components —
 * the SAME components used in the builder's FieldPreview. This guarantees
 * a single visual source of truth: change a component once, both builder
 * and viewer update together.
 */
import React, { useMemo } from 'react';
import { Controller, Control, FieldValues, Path } from 'react-hook-form';
import {
  FormField,
  FieldType,
  FILE_UPLOAD_DEFAULT_MAX_FILES,
  FILE_UPLOAD_DEFAULT_MAX_FILE_SIZE_MB,
  FILE_UPLOAD_MAX_FILE_SIZE_MB,
  FillableFormField,
  TextFieldValidation,
  RichTextFormField,
  PhoneNumberField,
  isLayoutField,
} from '@dculus/types';
import { RendererMode } from '@dculus/utils';
import { FileUploadInput } from './FileUploadInput';
import { LexicalRichTextEditor } from '../rich-text-editor/LexicalRichTextEditor';
import {
  AffixedInput,
  AffixedTextarea,
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
  RadioGroup, RadioGroupItem,
  Checkbox,
  Label,
  DatePicker,
  PhoneNumberInput,
} from '../index';

/* ── Types ── */

interface FieldStyles {
  container: string;
  label: string;
  input: string;
  textarea: string;
  select: string;
}

interface FormFieldRendererProps<T extends FieldValues = FieldValues> {
  field: FormField;
  control: Control<T>;
  fieldStyles?: FieldStyles;
  className?: string;
  mode?: RendererMode;
  requiredOverride?: boolean;
}

/* ── Error message ── */

/**
 * Long labels wrap inside their box (a narrow grid column included) instead of painting over the next one;
 * `overflow-wrap:anywhere` also breaks single long words, and `leading-snug` keeps wrapped lines apart.
 */
const WRAP_TEXT_CLASS = 'leading-snug break-words [overflow-wrap:anywhere]';

const ErrorMessage: React.FC<{ message: string }> = ({ message }) => (
  <p className="mt-1.5 text-xs flex items-center gap-1.5" style={{ color: '#ce5d55' }} role="alert">
    <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
    {message}
  </p>
);

/* ── Char count ── */

const CharCount: React.FC<{ current: number; min?: number; max?: number }> = ({ current, min, max }) => {
  const over = max && current > max;
  const under = min && current < min;
  return (
    <div className="flex justify-end mt-1">
      <span className="text-[10px]" style={{ color: over || under ? '#ce5d55' : '#655d67' }}>
        {current}{max ? `/${max}` : ''}{min && !max ? ` (min ${min})` : ''}
      </span>
    </div>
  );
};

/* ── Main renderer ── */

export const FormFieldRenderer: React.FC<FormFieldRendererProps> = ({
  field,
  control,
  fieldStyles,
  className = '',
  mode = RendererMode.PREVIEW,
  requiredOverride,
}) => {
  // Layout containers render through GridRenderer; the fillable heuristic below would treat them as inputs
  if (isLayoutField(field)) return null;

  const isFillableField = (f: FormField): f is FillableFormField =>
    f instanceof FillableFormField || (f as any).label !== undefined || f.type !== FieldType.FORM_FIELD;

  const fillableField = isFillableField(field) ? (field as FillableFormField) : null;
  const isRequired = requiredOverride ?? fillableField?.validation?.required ?? false;

  /* Container class — from formStyles or default */
  const containerClass = fieldStyles?.container ?? 'mb-5';
  /* Label class — hardcoded to match builder's FieldPreview exactly */
  const labelClass = `min-w-0 flex-1 text-sm font-medium text-gray-900 dark:text-white ${WRAP_TEXT_CLASS}`;

  const isInteractive = mode === RendererMode.PREVIEW || mode === RendererMode.SUBMISSION || mode === RendererMode.EDIT;

  /* ── Rich text: uncontrolled, just render ── */
  if (field.type === FieldType.RICH_TEXT_FIELD) {
    const richTextField = field as RichTextFormField;
    const safeContent = useMemo(() => {
      try {
        const doc = new DOMParser().parseFromString(richTextField.content || '', 'text/html');
        doc.querySelectorAll('script').forEach((el) => el.remove());
        doc.querySelectorAll('*').forEach((el) => {
          Array.from(el.attributes).forEach((attr) => {
            if (attr.name.toLowerCase().startsWith('on')) el.removeAttribute(attr.name);
          });
        });
        return doc.body.innerHTML;
      } catch { return ''; }
    }, [richTextField.content]);

    return (
      <div className={`${containerClass} ${className}`}>
        <LexicalRichTextEditor value={safeContent} editable={false} className="border-none shadow-none" />
      </div>
    );
  }

  return (
    <div className={`${containerClass} ${className}`}>

      {/* ── Field label ── */}
      {fillableField?.label && (
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <Label className={labelClass}>
            {fillableField.label}
            {isRequired && (
              <span className="text-red-500 ml-1" aria-label="required">*</span>
            )}
          </Label>
          {/* Real-time validation indicator */}
          {mode === RendererMode.PREVIEW && (
            <Controller
              name={field.id as Path<FieldValues>}
              control={control}
              render={({ fieldState }) => {
                if (!fieldState.isTouched) return <span />;
                return (
                  <span className="shrink-0 text-xs" style={{ color: fieldState.error ? '#ce5d55' : '#177767' }}>
                    {fieldState.error ? '✕' : '✓'}
                  </span>
                );
              }}
            />
          )}
        </div>
      )}

      {/* ── Controlled field ── */}
      <Controller
        name={field.id as Path<FieldValues>}
        control={control}
        render={({ field: cf, fieldState, formState }) => {
          const hasError = !!(fieldState.error && (fieldState.isTouched || formState.isSubmitted));
          /* Error className — appended to Input/Textarea/SelectTrigger for consistent red border */
          const errCls = hasError ? 'border-[#ce5d55] focus-visible:border-[#ce5d55]' : '';

          switch (field.type) {

            /* ─── Short text ─── */
            case FieldType.TEXT_INPUT_FIELD: {
              const v = fillableField?.validation as TextFieldValidation;
              const len = String(cf.value || '').length;
              return (
                <div>
                  <AffixedInput
                    {...cf}
                    value={cf.value ?? ''}
                    type="text"
                    prefixText={fillableField?.prefix}
                    suffixText={fillableField?.suffix}
                    invalid={hasError}
                    placeholder={fillableField?.placeholder || 'Type your answer here…'}
                    maxLength={v?.maxLength}
                    disabled={!isInteractive}
                    className={errCls}
                  />
                  {(v?.minLength || v?.maxLength) && <CharCount current={len} min={v?.minLength} max={v?.maxLength} />}
                  {hasError && <ErrorMessage message={fieldState.error!.message!} />}
                </div>
              );
            }

            /* ─── Long text ─── */
            case FieldType.TEXT_AREA_FIELD: {
              const v = fillableField?.validation as TextFieldValidation;
              const len = String(cf.value || '').length;
              return (
                <div>
                  <AffixedTextarea
                    {...cf}
                    value={cf.value ?? ''}
                    prefixText={fillableField?.prefix}
                    suffixText={fillableField?.suffix}
                    invalid={hasError}
                    placeholder={fillableField?.placeholder || 'Type your answer here…'}
                    maxLength={v?.maxLength}
                    disabled={!isInteractive}
                    className={errCls}
                  />
                  {(v?.minLength || v?.maxLength) && <CharCount current={len} min={v?.minLength} max={v?.maxLength} />}
                  {hasError && <ErrorMessage message={fieldState.error!.message!} />}
                </div>
              );
            }

            /* ─── Email ─── */
            case FieldType.EMAIL_FIELD:
              return (
                <div>
                  <AffixedInput
                    {...cf}
                    value={cf.value ?? ''}
                    type="email"
                    prefixText={fillableField?.prefix}
                    suffixText={fillableField?.suffix}
                    invalid={hasError}
                    placeholder={fillableField?.placeholder || 'name@example.com'}
                    disabled={!isInteractive}
                    className={errCls}
                  />
                  {hasError && <ErrorMessage message={fieldState.error!.message!} />}
                </div>
              );

            /* ─── Phone number ─── */
            case FieldType.PHONE_NUMBER_FIELD: {
              const pf = field as PhoneNumberField;
              return (
                <div>
                  <PhoneNumberInput
                    name={cf.name}
                    ref={cf.ref}
                    value={cf.value ?? ''}
                    onChange={cf.onChange}
                    onBlur={cf.onBlur}
                    defaultCountry={pf.defaultCountry as any}
                    // Only guess the respondent's country from their browser locale on the
                    // public submission flow — never in the builder preview/edit tools.
                    browserLocaleFallback={mode === RendererMode.SUBMISSION}
                    placeholder={fillableField?.placeholder || 'Phone number'}
                    disabled={!isInteractive}
                    error={hasError}
                  />
                  {hasError && <ErrorMessage message={fieldState.error!.message!} />}
                </div>
              );
            }

            /* ─── Number ─── */
            case FieldType.NUMBER_FIELD: {
              const nf = field as any;
              return (
                <div>
                  <AffixedInput
                    name={cf.name}
                    ref={cf.ref}
                    onBlur={cf.onBlur}
                    value={cf.value ?? ''}
                    type="number"
                    prefixText={fillableField?.prefix}
                    suffixText={fillableField?.suffix}
                    invalid={hasError}
                    min={nf.min}
                    max={nf.max}
                    placeholder={fillableField?.placeholder || '0'}
                    disabled={!isInteractive}
                    className={errCls}
                    onChange={(e) => cf.onChange(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                  {hasError && <ErrorMessage message={fieldState.error!.message!} />}
                </div>
              );
            }

            /* ─── Dropdown ─── */
            case FieldType.SELECT_FIELD:
              return (
                <div>
                  <Select value={cf.value ?? ''} onValueChange={cf.onChange} disabled={!isInteractive}>
                    <SelectTrigger onBlur={cf.onBlur} className={errCls}>
                      <SelectValue placeholder={fillableField?.placeholder || 'Select an option…'} />
                    </SelectTrigger>
                    <SelectContent>
                      {(fillableField as any)?.options?.map((opt: string, i: number) => (
                        <SelectItem key={i} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {hasError && <ErrorMessage message={fieldState.error!.message!} />}
                </div>
              );

            /* ─── Radio ─── */
            case FieldType.RADIO_FIELD: {
              const options: string[] = (fillableField as any)?.options ?? [];
              return (
                <div>
                  <RadioGroup
                    value={cf.value ?? ''}
                    onValueChange={(val) => isInteractive && cf.onChange(val)}
                    disabled={!isInteractive}
                    className="space-y-2"
                  >
                    {options.map((option, i) => (
                      <div key={i} className="flex items-center gap-2.5">
                        <RadioGroupItem
                          value={option}
                          id={`${field.id}-radio-${i}`}
                          style={hasError && !cf.value ? { borderColor: '#ce5d55' } : {}}
                        />
                        <Label
                          htmlFor={`${field.id}-radio-${i}`}
                          className={`min-w-0 text-sm font-normal cursor-pointer ${WRAP_TEXT_CLASS}`}
                          style={{ color: '#4c414e' }}
                        >
                          {option}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                  {hasError && <ErrorMessage message={fieldState.error!.message!} />}
                </div>
              );
            }

            /* ─── Checkbox ─── */
            case FieldType.CHECKBOX_FIELD: {
              const options: string[] = (fillableField as any)?.options ?? [];
              const selected: string[] = cf.value ?? [];
              return (
                <div>
                  <div className="space-y-2">
                    {options.map((option, i) => {
                      const checked = selected.includes(option);
                      return (
                        <div key={i} className="flex items-center gap-2.5">
                          <Checkbox
                            id={`${field.id}-cb-${i}`}
                            checked={checked}
                            onCheckedChange={(val) => {
                              if (!isInteractive) return;
                              const next = val
                                ? [...selected, option]
                                : selected.filter((v) => v !== option);
                              cf.onChange(next);
                            }}
                            disabled={!isInteractive}
                          />
                          <Label
                            htmlFor={`${field.id}-cb-${i}`}
                            className={`min-w-0 text-sm font-normal cursor-pointer ${WRAP_TEXT_CLASS}`}
                            style={{ color: '#4c414e' }}
                          >
                            {option}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                  {hasError && <ErrorMessage message={fieldState.error!.message!} />}
                </div>
              );
            }

            /* ─── Date ─── */
            case FieldType.DATE_FIELD: {
              const df = field as any;
              const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
              return (
                <div>
                  <DatePicker
                    name={field.id}
                    date={cf.value ? parse(cf.value) : undefined}
                    onDateChange={(date) => {
                      cf.onChange(date
                        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
                        : '');
                    }}
                    minDate={df.minDate ? parse(df.minDate) : undefined}
                    maxDate={df.maxDate ? parse(df.maxDate) : undefined}
                    placeholder={fillableField?.placeholder || 'Pick a date'}
                    disabled={!isInteractive}
                    error={hasError}
                  />
                  {hasError && <ErrorMessage message={fieldState.error!.message!} />}
                </div>
              );
            }

            /* ─── File upload ─── */
            case FieldType.FILE_UPLOAD_FIELD: {
              const fuf = field as any;
              const maxMb: number = Math.min(
                fuf.maxFileSizeMb || FILE_UPLOAD_DEFAULT_MAX_FILE_SIZE_MB,
                FILE_UPLOAD_MAX_FILE_SIZE_MB
              );
              return (
                <>
                  <FileUploadInput
                    fieldId={field.id}
                    value={cf.value}
                    onChange={cf.onChange}
                    maxFiles={fuf.maxFiles || FILE_UPLOAD_DEFAULT_MAX_FILES}
                    maxMb={maxMb}
                    allowedMimeTypes={fuf.allowedMimeTypes || []}
                    isInteractive={isInteractive}
                    hasError={hasError}
                  />
                  {hasError && <ErrorMessage message={fieldState.error!.message!} />}
                </>
              );
            }

            default:
              return <p className="text-xs" style={{ color: '#655d67' }}>Unsupported field: {field.type}</p>;
          }
        }}
      />

      {/* ── Hint ── */}
      {fillableField?.hint && (
        <p className="text-xs mt-1.5" style={{ color: '#655d67' }}>{fillableField.hint}</p>
      )}
    </div>
  );
};

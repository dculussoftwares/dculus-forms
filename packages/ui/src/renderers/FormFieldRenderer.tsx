import React, { useMemo } from 'react';
import { Controller, Control, FieldValues, Path } from 'react-hook-form';
import {
  FormField,
  FieldType,
  FillableFormField,
  TextFieldValidation,
  RichTextFormField,
} from '@dculus/types';
import { RendererMode } from '@dculus/utils';
import { Upload } from 'lucide-react';
import { LexicalRichTextEditor } from '../rich-text-editor/LexicalRichTextEditor';
import { DatePicker, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../index';

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
}

const ErrorMessage: React.FC<{ message: string }> = ({ message }) => (
  <p className="mt-2 text-sm text-red-500 flex items-center gap-1.5" role="alert">
    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
        clipRule="evenodd"
      />
    </svg>
    {message}
  </p>
);

export const FormFieldRenderer: React.FC<FormFieldRendererProps> = ({
  field,
  control,
  fieldStyles,
  className = '',
  mode = RendererMode.PREVIEW,
}) => {
  const isFillableField = (field: FormField): field is FillableFormField => {
    return (
      field instanceof FillableFormField ||
      (field as any).label !== undefined ||
      field.type !== FieldType.FORM_FIELD
    );
  };

  const fillableField = isFillableField(field) ? (field as FillableFormField) : null;
  const isRequired = fillableField?.validation?.required || false;

  const baseStyles = fieldStyles || {
    container: 'mb-10',
    label: 'text-xl font-semibold text-gray-900 dark:text-white mb-5',
    input:
      'w-full bg-transparent border-0 border-b-2 px-0 pb-3 text-base text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-0 transition-colors duration-200',
    textarea:
      'w-full bg-transparent border-0 border-b-2 px-0 pb-3 pt-1 text-base text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-0 transition-colors duration-200 resize-none min-h-[100px]',
    select: 'w-full',
  };

  const styles = baseStyles;

  const isInteractive =
    mode === RendererMode.PREVIEW ||
    mode === RendererMode.SUBMISSION ||
    mode === RendererMode.EDIT;

  const renderControlledField = () => {
    return (
      <Controller
        name={field.id as Path<FieldValues>}
        control={control}
        render={({ field: controllerField, fieldState, formState }) => {
          const { error, isTouched } = fieldState;
          const hasError = error && (isTouched || formState.isSubmitted);

          const inputProps = {
            ...controllerField,
            value: controllerField.value ?? '',
            className: '',
            disabled: !isInteractive,
          };

          const getInputClassName = (baseClassName: string) =>
            `${baseClassName} ${
              hasError
                ? 'border-red-400 focus:border-red-500'
                : 'border-gray-300 focus:border-primary'
            }`;

          switch (field.type) {
            case FieldType.TEXT_INPUT_FIELD: {
              const textValidation = fillableField?.validation as TextFieldValidation;
              const currentLength = String(controllerField.value || '').length;
              const showCharCount = textValidation?.minLength || textValidation?.maxLength;
              const isOverLimit = textValidation?.maxLength && currentLength > textValidation.maxLength;
              const isUnderLimit = textValidation?.minLength && currentLength < textValidation.minLength;

              return (
                <div>
                  <input
                    {...inputProps}
                    type="text"
                    className={getInputClassName(styles.input)}
                    placeholder={fillableField?.placeholder || 'Type your answer here...'}
                    maxLength={textValidation?.maxLength}
                  />
                  {showCharCount && (
                    <div className="flex justify-end mt-1.5">
                      <span className={`text-xs ${isOverLimit || isUnderLimit ? 'text-red-400' : 'text-gray-400'}`}>
                        {currentLength}
                        {textValidation?.maxLength && `/${textValidation.maxLength}`}
                        {textValidation?.minLength && !textValidation?.maxLength && ` (min ${textValidation.minLength})`}
                      </span>
                    </div>
                  )}
                  {hasError && <ErrorMessage message={error.message!} />}
                </div>
              );
            }

            case FieldType.EMAIL_FIELD:
              return (
                <div>
                  <input
                    {...inputProps}
                    type="email"
                    className={getInputClassName(styles.input)}
                    placeholder={fillableField?.placeholder || 'name@example.com'}
                  />
                  {hasError && <ErrorMessage message={error.message!} />}
                </div>
              );

            case FieldType.NUMBER_FIELD: {
              const numberField = field as any;
              const numberValue = controllerField.value ?? '';
              return (
                <div>
                  <input
                    name={controllerField.name}
                    ref={controllerField.ref}
                    onBlur={controllerField.onBlur}
                    value={numberValue}
                    type="number"
                    min={numberField.min}
                    max={numberField.max}
                    className={getInputClassName(styles.input)}
                    placeholder={fillableField?.placeholder || '0'}
                    disabled={!isInteractive}
                    onChange={(e) => {
                      const value = e.target.value === '' ? '' : Number(e.target.value);
                      controllerField.onChange(value);
                    }}
                  />
                  {hasError && <ErrorMessage message={error.message!} />}
                </div>
              );
            }

            case FieldType.TEXT_AREA_FIELD: {
              const textAreaValidation = fillableField?.validation as TextFieldValidation;
              const textAreaLength = String(controllerField.value || '').length;
              const showTextAreaCharCount = textAreaValidation?.minLength || textAreaValidation?.maxLength;
              const isTextAreaOverLimit = textAreaValidation?.maxLength && textAreaLength > textAreaValidation.maxLength;
              const isTextAreaUnderLimit = textAreaValidation?.minLength && textAreaLength < textAreaValidation.minLength;

              return (
                <div>
                  <textarea
                    {...inputProps}
                    className={getInputClassName(styles.textarea)}
                    placeholder={fillableField?.placeholder || 'Type your answer here...'}
                    maxLength={textAreaValidation?.maxLength}
                  />
                  {showTextAreaCharCount && (
                    <div className="flex justify-end mt-1.5">
                      <span className={`text-xs ${isTextAreaOverLimit || isTextAreaUnderLimit ? 'text-red-400' : 'text-gray-400'}`}>
                        {textAreaLength}
                        {textAreaValidation?.maxLength && `/${textAreaValidation.maxLength}`}
                        {textAreaValidation?.minLength && !textAreaValidation?.maxLength && ` (min ${textAreaValidation.minLength})`}
                      </span>
                    </div>
                  )}
                  {hasError && <ErrorMessage message={error.message!} />}
                </div>
              );
            }

            case FieldType.SELECT_FIELD:
              return (
                <div>
                  <Select
                    value={controllerField.value ?? ''}
                    onValueChange={controllerField.onChange}
                    disabled={!isInteractive}
                  >
                    <SelectTrigger
                      onBlur={controllerField.onBlur}
                      className={hasError ? 'border-red-400' : ''}
                    >
                      <SelectValue placeholder={fillableField?.placeholder || 'Select an option...'} />
                    </SelectTrigger>
                    <SelectContent>
                      {(fillableField as any)?.options?.map((option: string, index: number) => (
                        <SelectItem key={index} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {hasError && <ErrorMessage message={error.message!} />}
                </div>
              );

            case FieldType.RADIO_FIELD:
              return (
                <div>
                  <div
                    className="space-y-2"
                    role="radiogroup"
                    aria-label={(fillableField as any)?.label ?? 'Radio group'}
                  >
                    {(fillableField as any)?.options?.map((option: string, index: number) => {
                      const isSelected = controllerField.value === option;
                      const letter = String.fromCharCode(65 + index);
                      return (
                        <button
                          key={index}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          onClick={() => isInteractive && controllerField.onChange(option)}
                          disabled={!isInteractive}
                          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{
                            border: isSelected ? '2px solid #3c323e' : hasError ? '2px solid rgba(206,93,85,0.40)' : '2px solid rgba(81,76,84,0.15)',
                            backgroundColor: isSelected ? '#3c323e' : 'rgba(255,255,255,0.8)',
                            color: isSelected ? '#ffffff' : '#4c414e',
                          }}
                        >
                          <span
                            className="flex-shrink-0 w-7 h-7 rounded-md text-xs font-bold flex items-center justify-center"
                            style={{
                              border: isSelected ? '1px solid rgba(255,255,255,0.30)' : '1px solid rgba(81,76,84,0.25)',
                              color: isSelected ? 'rgba(255,255,255,0.85)' : '#655d67',
                              backgroundColor: isSelected ? 'rgba(255,255,255,0.15)' : 'transparent',
                            }}
                          >
                            {letter}
                          </span>
                          <span className="text-sm font-medium">{option}</span>
                        </button>
                      );
                    })}
                  </div>
                  {hasError && <ErrorMessage message={error.message!} />}
                </div>
              );

            case FieldType.CHECKBOX_FIELD: {
              const currentValues = controllerField.value ?? [];
              return (
                <div>
                  <div className="space-y-2">
                    {(fillableField as any)?.options?.map((option: string, index: number) => {
                      const isChecked = currentValues.includes(option);
                      const letter = String.fromCharCode(65 + index);
                      return (
                        <button
                          key={index}
                          type="button"
                          role="checkbox"
                          aria-checked={isChecked}
                          onClick={() => {
                            if (!isInteractive) return;
                            const newValues = isChecked
                              ? currentValues.filter((v: string) => v !== option)
                              : [...currentValues, option];
                            controllerField.onChange(newValues);
                          }}
                          disabled={!isInteractive}
                          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{
                            border: isChecked ? '2px solid #3c323e' : hasError ? '2px solid rgba(206,93,85,0.40)' : '2px solid rgba(81,76,84,0.15)',
                            backgroundColor: isChecked ? '#3c323e' : 'rgba(255,255,255,0.8)',
                            color: isChecked ? '#ffffff' : '#4c414e',
                          }}
                        >
                          <span
                            className="flex-shrink-0 w-7 h-7 rounded-md text-xs font-bold flex items-center justify-center"
                            style={{
                              border: isChecked ? '1px solid rgba(255,255,255,0.30)' : '1px solid rgba(81,76,84,0.25)',
                              color: isChecked ? 'rgba(255,255,255,0.85)' : '#655d67',
                              backgroundColor: isChecked ? 'rgba(255,255,255,0.15)' : 'transparent',
                            }}
                          >
                            {isChecked ? '✓' : letter}
                          </span>
                          <span className="text-sm font-medium">{option}</span>
                        </button>
                      );
                    })}
                  </div>
                  {hasError && <ErrorMessage message={error.message!} />}
                </div>
              );
            }

            case FieldType.DATE_FIELD: {
              const dateField = field as any;
              const parseLocalDate = (s: string) => {
                const [y, m, d] = s.split('-').map(Number);
                return new Date(y, m - 1, d);
              };
              const dateValue = controllerField.value ? parseLocalDate(controllerField.value) : undefined;
              const minDateValue = dateField.minDate ? parseLocalDate(dateField.minDate) : undefined;
              const maxDateValue = dateField.maxDate ? parseLocalDate(dateField.maxDate) : undefined;

              return (
                <div>
                  <DatePicker
                    name={field.id}
                    date={dateValue}
                    onDateChange={(date) => {
                      controllerField.onChange(
                        date
                          ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
                          : ''
                      );
                    }}
                    minDate={minDateValue}
                    maxDate={maxDateValue}
                    placeholder={fillableField?.placeholder || 'Pick a date'}
                    disabled={!isInteractive}
                    error={hasError}
                  />
                  {hasError && <ErrorMessage message={error.message!} />}
                </div>
              );
            }

            case FieldType.FILE_UPLOAD_FIELD: {
              const fileUploadField = field as any;
              const rawValue: (string | File)[] = Array.isArray(controllerField.value)
                ? controllerField.value
                : [];
              const existingKeys: string[] = rawValue.filter((v): v is string => typeof v === 'string');
              const newFiles: File[] = rawValue.filter((v): v is File => v instanceof File);

              const maxFiles: number = fileUploadField.maxFiles || 1;
              const maxFileSizeMb: number = fileUploadField.maxFileSizeMb || 5;
              const allowedMimeTypes: string[] = fileUploadField.allowedMimeTypes || [];
              const acceptAttr = allowedMimeTypes.length > 0 ? allowedMimeTypes.join(',') : undefined;
              const totalCount = existingKeys.length + newFiles.length;

              const extractKeyName = (key: string): string => {
                const segment = key.split('/').pop() ?? key;
                return segment.replace(/^\d{13}-[0-9a-f-]{36}-/i, '');
              };

              const handleFiles = (files: FileList | null) => {
                if (!files || !isInteractive) return;
                const incoming = Array.from(files).filter((f) => {
                  if (f.size > maxFileSizeMb * 1024 * 1024) return false;
                  if (allowedMimeTypes.length > 0 && !allowedMimeTypes.includes(f.type)) return false;
                  return true;
                });
                const combined: (string | File)[] = [...existingKeys, ...newFiles, ...incoming].slice(0, maxFiles);
                controllerField.onChange(combined);
              };

              const removeExistingKey = (idx: number) => {
                controllerField.onChange([...existingKeys.filter((_, i) => i !== idx), ...newFiles]);
              };

              const removeNewFile = (idx: number) => {
                controllerField.onChange([...existingKeys, ...newFiles.filter((_, i) => i !== idx)]);
              };

              return (
                <div>
                  {existingKeys.length > 0 && (
                    <ul className="mb-3 space-y-2">
                      {existingKeys.map((key, idx) => (
                        <li
                          key={key}
                          className="flex items-center justify-between text-sm bg-primary/5 border border-primary/20 rounded-xl px-4 py-2.5"
                        >
                          <span className="truncate text-gray-700 dark:text-gray-300">{extractKeyName(key)}</span>
                          {isInteractive && (
                            <button
                              type="button"
                              onClick={() => removeExistingKey(idx)}
                              className="ml-2 text-gray-400 hover:text-red-500 flex-shrink-0 text-lg leading-none transition-colors"
                              aria-label={`Remove ${extractKeyName(key)}`}
                            >
                              &times;
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}

                  {(totalCount < maxFiles || maxFiles === 1) && isInteractive && (
                    <div
                      className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-200 ${
                        hasError
                          ? 'border-red-300 bg-red-50'
                          : 'border-gray-200 bg-gray-50/50 hover:border-primary/50 hover:bg-primary/5'
                      } cursor-pointer`}
                      onClick={() => {
                        (document.getElementById(`file-input-${field.id}`) as HTMLInputElement | null)?.click();
                      }}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleFiles(e.dataTransfer.files); }}
                    >
                      <Upload className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                      <p className="text-sm font-medium text-gray-500">
                        {existingKeys.length > 0 ? 'Click or drag to add more files' : 'Click or drag files here'}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Max {maxFiles} file{maxFiles > 1 ? 's' : ''} · up to {maxFileSizeMb}MB
                        {allowedMimeTypes.length > 0 && ` · ${allowedMimeTypes.join(', ')}`}
                      </p>
                      <input
                        id={`file-input-${field.id}`}
                        type="file"
                        multiple={maxFiles > 1}
                        accept={acceptAttr}
                        className="hidden"
                        disabled={!isInteractive}
                        onChange={(e) => handleFiles(e.target.files)}
                      />
                    </div>
                  )}

                  {!isInteractive && existingKeys.length === 0 && newFiles.length === 0 && (
                    <div className="border-2 border-dashed rounded-2xl p-8 text-center border-gray-200 bg-gray-50/50 opacity-50 cursor-not-allowed">
                      <Upload className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                      <p className="text-sm text-gray-500">File upload</p>
                    </div>
                  )}

                  {newFiles.length > 0 && (
                    <ul className="mt-3 space-y-2">
                      {newFiles.map((file, idx) => (
                        <li
                          key={idx}
                          className="flex items-center justify-between text-sm bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5"
                        >
                          <span className="truncate text-gray-700 dark:text-gray-300">{file.name}</span>
                          {isInteractive && (
                            <button
                              type="button"
                              onClick={() => removeNewFile(idx)}
                              className="ml-2 text-gray-400 hover:text-red-500 flex-shrink-0 text-lg leading-none transition-colors"
                              aria-label={`Remove ${file.name}`}
                            >
                              &times;
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}

                  {hasError && <ErrorMessage message={error.message!} />}
                </div>
              );
            }

            default:
              return <div className={styles.input}>Unknown field type: {field.type}</div>;
          }
        }}
      />
    );
  };

  if (field.type === FieldType.RICH_TEXT_FIELD) {
    const richTextField = field as RichTextFormField;
    // eslint-disable-next-line react-hooks/rules-of-hooks
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
      } catch {
        return '';
      }
    }, [richTextField.content]);

    return (
      <div className={`${styles.container} ${className}`}>
        <LexicalRichTextEditor value={safeContent} editable={false} className="border-none shadow-none" />
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${className}`}>
      {fillableField?.label && (
        <label className={`${styles.label} flex items-center justify-between`}>
          <span>
            {fillableField.label}
            {isRequired && (
              <span className="text-primary ml-1.5" aria-label="required">
                *
              </span>
            )}
          </span>
          {mode === RendererMode.PREVIEW && (
            <Controller
              name={field.id as Path<FieldValues>}
              control={control}
              render={({ fieldState }) => {
                const { error, isTouched } = fieldState;
                if (!isTouched) return <span></span>;
                return (
                  <span className={`text-xs ${error ? 'text-red-500' : 'text-primary'}`}>
                    {error ? '✕' : '✓'}
                  </span>
                );
              }}
            />
          )}
        </label>
      )}
      {renderControlledField()}
      {fillableField?.hint && (
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">{fillableField.hint}</p>
      )}
    </div>
  );
};

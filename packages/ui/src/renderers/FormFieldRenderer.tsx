import React from 'react';
import { Controller, Control, FieldValues, Path } from 'react-hook-form';
import { FormField, FieldType, FillableFormField, TextFieldValidation, RichTextFormField } from '@dculus/types';
import { RendererMode } from '@dculus/utils';
import { LexicalRichTextEditor } from '../rich-text-editor/LexicalRichTextEditor';
import { Checkbox, RadioGroup, RadioGroupItem } from '../index';

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

export const FormFieldRenderer: React.FC<FormFieldRendererProps> = ({
  field,
  control,
  fieldStyles,
  className = '',
  mode = RendererMode.PREVIEW
}) => {
  // Check if field is fillable to access additional properties
  const isFillableField = (field: FormField): field is FillableFormField => {
    return field instanceof FillableFormField || 
           (field as any).label !== undefined ||
           field.type !== FieldType.FORM_FIELD;
  };

  const fillableField = isFillableField(field) ? field as FillableFormField : null;

  const isRequired = fillableField?.validation?.required || false;

  // Use provided fieldStyles or fall back to default styles
  const baseStyles = fieldStyles || {
    container: 'mb-4',
    label: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2',
    input: 'w-full h-10 bg-white border border-gray-300 rounded-md px-3 text-gray-500',
    textarea: 'w-full h-24 bg-white border border-gray-300 rounded-md px-3 py-2 text-gray-500',
    select: 'w-full h-10 bg-white border border-gray-300 rounded-md px-3 text-gray-500',
  };

  const styles = baseStyles;

  // Determine if field should be interactive
  // PREVIEW, SUBMISSION, and EDIT modes: interactive
  // BUILDER mode: disabled/read-only
  const isInteractive = mode === RendererMode.PREVIEW || mode === RendererMode.SUBMISSION || mode === RendererMode.EDIT;
  
  const renderControlledField = () => {
    return (
      <Controller
        name={field.id as Path<FieldValues>}
        control={control}
        render={({ field: controllerField, fieldState, formState }) => {
         const { error, isTouched } = fieldState;
          // Show error if field is touched OR if form has been submitted
          const hasError = error && (isTouched || formState.isSubmitted);
          
          const inputProps = {
            ...controllerField,
            value: controllerField.value ?? '', // Ensure value is never undefined
            className: '',
            disabled: !isInteractive,
          };

          // Add error styling classes
          const getInputClassName = (baseClassName: string) => {
            return `${baseClassName} ${
              hasError 
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
            } transition-colors`;
          };

          switch (field.type) {
            case FieldType.TEXT_INPUT_FIELD:
              const textValidation = fillableField?.validation as TextFieldValidation;
              const currentLength = String(controllerField.value || '').length;
              const showCharacterCount = textValidation?.minLength || textValidation?.maxLength;
              const isOverLimit = textValidation?.maxLength && currentLength > textValidation.maxLength;
              const isUnderLimit = textValidation?.minLength && currentLength < textValidation.minLength;
              
              return (
                <div>
                  <input
                    {...inputProps}
                    type="text"
                    className={getInputClassName(styles.input)}
                    placeholder={fillableField?.placeholder || 'Enter text...'}
                    maxLength={textValidation?.maxLength}
                  />
                  {showCharacterCount && (
                    <div className="flex justify-between items-center mt-1">
                      <span className={`text-xs ${
                        isOverLimit || isUnderLimit ? 'text-red-500' : 'text-gray-500'
                      }`}>
                        {currentLength}
                        {textValidation?.maxLength && `/${textValidation.maxLength}`} characters
                        {textValidation?.minLength && !textValidation?.maxLength && 
                          ` (min ${textValidation.minLength})`}
                      </span>
                    </div>
                  )}
                  {hasError && (
                    <p className="mt-1 text-sm text-red-600" role="alert">
                      {error.message}
                    </p>
                  )}
                </div>
              );

            case FieldType.EMAIL_FIELD:
              return (
                <div>
                  <input
                    {...inputProps}
                    type="email"
                    className={getInputClassName(styles.input)}
                    placeholder={fillableField?.placeholder || 'Enter email...'}
                  />
                  {hasError && (
                    <p className="mt-1 text-sm text-red-600" role="alert">
                      {error.message}
                    </p>
                  )}
                </div>
              );

            case FieldType.NUMBER_FIELD:
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
                    placeholder={fillableField?.placeholder || 'Enter number...'}
                    disabled={!isInteractive}
                    onChange={(e) => {
                      const value = e.target.value === '' ? '' : Number(e.target.value);
                      controllerField.onChange(value);
                    }}
                  />
                  {hasError && (
                    <p className="mt-1 text-sm text-red-600" role="alert">
                      {error.message}
                    </p>
                  )}
                </div>
              );

            case FieldType.TEXT_AREA_FIELD:
              const textAreaValidation = fillableField?.validation as TextFieldValidation;
              const textAreaLength = String(controllerField.value || '').length;
              const showTextAreaCharacterCount = textAreaValidation?.minLength || textAreaValidation?.maxLength;
              const isTextAreaOverLimit = textAreaValidation?.maxLength && textAreaLength > textAreaValidation.maxLength;
              const isTextAreaUnderLimit = textAreaValidation?.minLength && textAreaLength < textAreaValidation.minLength;
              
              return (
                <div>
                  <textarea
                    {...inputProps}
                    className={getInputClassName(styles.textarea)}
                    placeholder={fillableField?.placeholder || 'Enter message...'}
                    maxLength={textAreaValidation?.maxLength}
                  />
                  {showTextAreaCharacterCount && (
                    <div className="flex justify-between items-center mt-1">
                      <span className={`text-xs ${
                        isTextAreaOverLimit || isTextAreaUnderLimit ? 'text-red-500' : 'text-gray-500'
                      }`}>
                        {textAreaLength}
                        {textAreaValidation?.maxLength && `/${textAreaValidation.maxLength}`} characters
                        {textAreaValidation?.minLength && !textAreaValidation?.maxLength && 
                          ` (min ${textAreaValidation.minLength})`}
                      </span>
                    </div>
                  )}
                  {hasError && (
                    <p className="mt-1 text-sm text-red-600" role="alert">
                      {error.message}
                    </p>
                  )}
                </div>
              );

            case FieldType.SELECT_FIELD:
              return (
                <div>
                  <select {...inputProps} className={getInputClassName(styles.select)}>
                    <option value="">{fillableField?.placeholder || 'Select option...'}</option>
                    {(fillableField as any)?.options?.map((option: string, index: number) => (
                      <option key={index} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  {hasError && (
                    <p className="mt-1 text-sm text-red-600" role="alert">
                      {error.message}
                    </p>
                  )}
                </div>
              );

            case FieldType.RADIO_FIELD:
              return (
                <div>
                  <div className={`${hasError ? 'border-l-2 border-red-300 pl-3' : ''}`}>
                    <RadioGroup
                      value={controllerField.value ?? ''}
                      onValueChange={controllerField.onChange}
                      disabled={!isInteractive}
                      className="space-y-2"
                    >
                      {(fillableField as any)?.options?.map((option: string, index: number) => (
                        <div key={index} className="flex items-center space-x-2">
                          <RadioGroupItem 
                            value={option} 
                            id={`${field.id}-${index}`}
                            className={hasError ? 'border-red-300 focus:ring-red-500' : ''}
                          />
                          <label htmlFor={`${field.id}-${index}`} className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                            {option}
                          </label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                  {hasError && (
                    <p className="mt-1 text-sm text-red-600" role="alert">
                      {error.message}
                    </p>
                  )}
                </div>
              );

            case FieldType.CHECKBOX_FIELD:
              const currentValues = controllerField.value ?? [];
              return (
                <div>
                  <div className={`space-y-2 ${hasError ? 'border-l-2 border-red-300 pl-3' : ''}`}>
                    {(fillableField as any)?.options?.map((option: string, index: number) => (
                      <div key={index} className="flex items-center">
                        <Checkbox
                          id={`${field.id}-${index}`}
                          checked={currentValues.includes(option)}
                          onCheckedChange={(checked) => {
                            const newValues = checked
                              ? [...currentValues, option]
                              : currentValues.filter((v: string) => v !== option);
                            controllerField.onChange(newValues);
                          }}
                          className={`${
                            hasError 
                              ? 'text-red-600 focus:ring-red-500 border-red-300' 
                              : 'text-blue-600 focus:ring-blue-500'
                          }`}
                          disabled={!isInteractive}
                        />
                        <label htmlFor={`${field.id}-${index}`} className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                          {option}
                        </label>
                      </div>
                    ))}
                  </div>
                  {hasError && (
                    <p className="mt-1 text-sm text-red-600" role="alert">
                      {error.message}
                    </p>
                  )}
                </div>
              );

            case FieldType.DATE_FIELD:
              const dateField = field as any;
              return (
                <div>
                  <input
                    {...inputProps}
                    type="date"
                    min={dateField.minDate}
                    max={dateField.maxDate}
                    className={getInputClassName(styles.input)}
                  />
                  {hasError && (
                    <p className="mt-1 text-sm text-red-600" role="alert">
                      {error.message}
                    </p>
                  )}
                </div>
              );

            default:
              return (
                <div className={styles.input}>
                  Unknown field type: {field.type}
                </div>
              );
          }
        }}
      />
    );
  };

  // Handle non-fillable fields separately (like RichTextFormField)
  if (field.type === FieldType.RICH_TEXT_FIELD) {
    const richTextField = field as RichTextFormField;
    return (
      <div className={`${styles.container} ${className}`}>
        <LexicalRichTextEditor
          value={richTextField.content}
          editable={false}
          className="border-none shadow-none"
        />
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
              <span className="text-red-500 ml-1" aria-label="required">*</span>
            )}
          </span>
          {/* Validation status indicator */}
          {mode === RendererMode.PREVIEW && (
            <Controller
              name={field.id as Path<FieldValues>}
              control={control}
              render={({ fieldState }) => {
                const { error, isTouched } = fieldState;
                if (!isTouched) return <span></span>;
                
                return (
                  <span className={`text-xs ${error ? 'text-red-500' : 'text-green-500'}`}>
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
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {fillableField.hint}
        </p>
      )}
    </div>
  );
};
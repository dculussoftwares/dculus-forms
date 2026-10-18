import React, { useState, useRef, useCallback } from 'react';
import { CombinedGraphQLErrors } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import { Send, Loader2 } from 'lucide-react';
import AIIcon from '../icons/AIIcon';
import { cn } from '@dculus/utils';
import { toastSuccess, toastError } from '@dculus/ui';
import { FieldType } from '@dculus/types';
import { GENERATE_FORM_WITH_AI } from '../../graphql/mutations';
import { useFormBuilderStore } from '../../store/useFormBuilderStore';
import { useTranslation } from '../../hooks/useTranslation';

interface AIFormBarProps {
  organizationId: string;
  className?: string;
}

// Map AI-produced type strings → FieldType enum
const AI_TYPE_MAP: Record<string, FieldType> = {
  text: FieldType.TEXT_INPUT_FIELD,
  textarea: FieldType.TEXT_AREA_FIELD,
  email: FieldType.EMAIL_FIELD,
  number: FieldType.NUMBER_FIELD,
  date: FieldType.DATE_FIELD,
  select: FieldType.SELECT_FIELD,
  radio: FieldType.RADIO_FIELD,
  checkbox: FieldType.CHECKBOX_FIELD,
  file: FieldType.FILE_UPLOAD_FIELD,
  phone: FieldType.PHONE_NUMBER_FIELD,
};

function buildFieldData(field: {
  type: string;
  label: string;
  placeholder?: string | null;
  required: boolean;
  options?: Array<{ value: string; label: string }> | null;
}) {
  const fieldType = AI_TYPE_MAP[field.type] ?? FieldType.TEXT_INPUT_FIELD;

  if (fieldType === FieldType.FILE_UPLOAD_FIELD) {
    return {
      label: field.label,
      required: field.required,
      hint: '',
      prefix: '',
      allowedMimeTypes: [],
      maxFileSizeMb: 5,
      maxFiles: 1,
    };
  }

  if (
    fieldType === FieldType.SELECT_FIELD ||
    fieldType === FieldType.RADIO_FIELD ||
    fieldType === FieldType.CHECKBOX_FIELD
  ) {
    const options =
      field.options && field.options.length > 0
        ? field.options.map((o) => o.label)
        : ['Option 1', 'Option 2'];
    return {
      label: field.label,
      required: field.required,
      placeholder: field.placeholder ?? '',
      defaultValue: '',
      prefix: '',
      hint: '',
      options,
      ...(fieldType === FieldType.SELECT_FIELD ? { multiple: false } : {}),
    };
  }

  return {
    label: field.label,
    required: field.required,
    placeholder: field.placeholder ?? `Enter ${field.label.toLowerCase()}`,
    defaultValue: '',
    prefix: '',
    hint: '',
  };
}

const AIFormBar: React.FC<AIFormBarProps> = ({ organizationId, className }) => {
  const { t } = useTranslation('aiFormBar');
  const [prompt, setPrompt] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { pages, selectedPageId, addField, updateLayout } = useFormBuilderStore();

  const targetPageId =
    selectedPageId ?? pages[0]?.id ?? null;

  const [generateForm, { loading }] = useMutation(GENERATE_FORM_WITH_AI, {
    onCompleted(data) {
      const generated = data?.generateFormWithAI;
      if (!generated || !targetPageId) return;

      generated.fields.forEach((field: {
        type: string;
        label: string;
        placeholder?: string | null;
        required: boolean;
        options?: Array<{ value: string; label: string }> | null;
      }) => {
        const fieldType = AI_TYPE_MAP[field.type] ?? FieldType.TEXT_INPUT_FIELD;
        addField(targetPageId, fieldType, buildFieldData(field));
      });

      if (generated.layout) {
        updateLayout({
          content: generated.layout.content,
          customCTAButtonName: generated.layout.customCTAButtonName,
        });
      }

      toastSuccess(
        t('success.title'),
        t('success.description', { values: { count: generated.fields.length } })
      );
      setPrompt('');
    },
    onError(error) {
      const isLimitError =
        CombinedGraphQLErrors.is(error) &&
        error.errors.some(
          (e) => e.extensions?.code === 'AI_TOKEN_LIMIT_EXCEEDED'
        );
      toastError(
        t('error.title'),
        isLimitError ? t('error.limitReached') : t('error.description')
      );
    },
  });

  const handleSubmit = useCallback(() => {
    const trimmed = prompt.trim();
    if (!trimmed || loading || !targetPageId) return;
    generateForm({ variables: { prompt: trimmed, organizationId } });
  }, [prompt, loading, targetPageId, generateForm, organizationId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <div
      className={cn(
        'flex items-end gap-2 px-3 py-2 bg-background border border-border rounded-xl shadow-sm',
        'focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary/50',
        'transition-all duration-200',
        className
      )}
    >
      <AIIcon className="h-4 w-4 text-primary shrink-0 mb-2" />
      <textarea
        ref={inputRef}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t('placeholder')}
        disabled={loading}
        rows={1}
        className={cn(
          'flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground',
          'max-h-24 overflow-y-auto leading-5 py-1.5',
          'disabled:opacity-50'
        )}
        style={{ minHeight: '28px' }}
      />
      <button
        onClick={handleSubmit}
        disabled={!prompt.trim() || loading || !targetPageId}
        aria-label={t('send')}
        className={cn(
          'shrink-0 mb-1 h-7 w-7 flex items-center justify-center rounded-lg',
          'bg-primary text-primary-foreground',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          'hover:bg-primary/90 transition-colors'
        )}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Send className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
};

export default AIFormBar;

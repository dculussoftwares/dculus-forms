// apps/form-app/src/hooks/useAIChips.ts
import { useMemo } from 'react';
import { useFormBuilderStore } from '../store/useFormBuilderStore';
import { useTranslation } from './useTranslation';

export interface AIChip {
  key: string;
  label: string;
  prompt: string;
}

export function useAIChips(): AIChip[] {
  const pages = useFormBuilderStore((s) => s.pages);
  const { t } = useTranslation('aiEditDrawer');

  return useMemo(() => {
    const allFields = pages.flatMap((p) => p.fields ?? []);
    const totalFields = allFields.length;
    const totalPages = pages.length;
    const hasOptional = allFields.some(
      (f) => !(f as any).validation?.required && !(f as any).required
    );
    const hasNoValidation = allFields.some(
      (f) =>
        !(f as any).validation?.minLength &&
        !(f as any).validation?.maxLength &&
        (f as any).min == null &&
        (f as any).max == null
    );

    const candidates: AIChip[] = [];

    if (totalFields === 0) {
      candidates.push({
        key: 'generateFields',
        label: t('chips.generateFields'),
        prompt:
          'Generate appropriate fields for this form based on its title and purpose.',
      });
    }

    if (hasNoValidation && totalFields > 2) {
      candidates.push({
        key: 'suggestValidation',
        label: t('chips.suggestValidation'),
        prompt:
          'Use listFields to read all fields, then use proposeValidation to suggest appropriate validation rules for each field based on its label and type.',
      });
    }

    if (totalFields > 0) {
      candidates.push({
        key: 'analyseForm',
        label: t('chips.analyseForm'),
        prompt: `Please analyse this form. Use listFields to read all pages and fields first, then give structured feedback on: (1) field order and logical flow, (2) missing fields for this type of form, (3) unclear or confusing labels, (4) fields that should be required but aren't. Be concise and actionable.`,
      });
    }

    if (totalPages > 1) {
      candidates.push({
        key: 'reorganisePages',
        label: t('chips.reorganisePages'),
        prompt:
          'Review the page structure of this form and suggest a better organisation. Reorder pages if needed and rename them to be clearer.',
      });
    }

    if (totalFields > 2) {
      candidates.push({
        key: 'remixForm',
        label: t('chips.remixForm'),
        prompt:
          'I want to transform this form for a different purpose. Please remix it into: ',
      });
    }

    if (hasOptional && totalFields > 0) {
      candidates.push({
        key: 'makeAllRequired',
        label: t('chips.makeAllRequired'),
        prompt: 'Make every field on every page required.',
      });
    }

    return candidates.slice(0, 3);
  }, [pages, t]);
}

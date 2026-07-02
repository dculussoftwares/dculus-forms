// apps/form-app/src/hooks/useAIChips.ts
// Phase 3.1: Context-aware quick actions — dynamically chosen based on
// real form state: field count, type mix, validation gaps, page structure.
import { useMemo } from 'react';
import { useFormBuilderStore } from '../store/useFormBuilderStore';
import { useTranslation } from './useTranslation';

export interface AIChip {
  key: string;
  label: string;
  prompt: string;
  /** Visual category used to colour the chip in the UI. */
  category: 'add' | 'edit' | 'remove' | 'structure' | 'style' | 'ai';
  /** Lucide icon name */
  icon: string;
}

export function useAIChips(): AIChip[] {
  const pages = useFormBuilderStore((s) => s.pages);
  const { t } = useTranslation('aiEditDrawer');

  return useMemo(() => {
    const allFields = pages.flatMap((p) => p.fields ?? []);
    const totalFields = allFields.length;
    const totalPages = pages.length;

    const textLikeFields = allFields.filter((f) =>
      ['TEXT_INPUT_FIELD', 'TEXT_AREA_FIELD', 'EMAIL_FIELD', 'NUMBER_FIELD'].includes(
        (f as any).type ?? ''
      )
    );

    const hasNoValidation = textLikeFields.some(
      (f) =>
        !(f as any).validation?.minLength &&
        !(f as any).validation?.maxLength &&
        (f as any).min == null &&
        (f as any).max == null
    );
    const hasOptional = allFields.some(
      (f) => !(f as any).validation?.required && !(f as any).required
    );
    const multiPage = totalPages > 1;

    const candidates: AIChip[] = [];

    // ── Empty form ─────────────────────────────────────────────────────────
    if (totalFields === 0) {
      candidates.push({
        key: 'generateFields',
        label: t('chips.generateFields'),
        prompt:
          'Generate appropriate fields for this form based on its title and purpose.',
        category: 'add',
        icon: 'Wand2',
      });
    }

    // ── Validation gap ─────────────────────────────────────────────────────
    if (hasNoValidation && totalFields > 2) {
      candidates.push({
        key: 'suggestValidation',
        label: t('chips.suggestValidation'),
        prompt:
          'Use listFields to read all fields, then use proposeValidation to suggest appropriate validation rules for each field based on its label and type.',
        category: 'edit',
        icon: 'ShieldCheck',
      });
    }

    // ── Full analysis (most valuable when form has content) ────────────────
    if (totalFields > 0) {
      candidates.push({
        key: 'analyseForm',
        label: t('chips.analyseForm'),
        prompt: `Please analyse this form. Use listFields to read all pages and fields first, then give structured feedback on: (1) field order and logical flow, (2) missing fields for this type of form, (3) unclear or confusing labels, (4) fields that should be required but aren't. Be concise and actionable.`,
        category: 'ai',
        icon: 'ScanSearch',
      });
    }

    // ── Page structure (multi-page forms) ─────────────────────────────────
    if (multiPage) {
      candidates.push({
        key: 'reorganisePages',
        label: t('chips.reorganisePages'),
        prompt:
          'Review the page structure of this form and suggest a better organisation. Reorder pages if needed and rename them to be clearer.',
        category: 'structure',
        icon: 'LayoutDashboard',
      });
    }

    // ── Merge pages (multi-page with few fields each) ──────────────────────
    const avgFieldsPerPage = totalPages > 0 ? totalFields / totalPages : 0;
    if (multiPage && avgFieldsPerPage < 3 && totalPages > 2) {
      candidates.push({
        key: 'mergePages',
        label: t('chips.mergePages') ?? 'Consolidate pages',
        prompt:
          'This form has many pages with few fields each. Consolidate them into fewer, more logical pages by moving related fields together, then delete empty pages.',
        category: 'structure',
        icon: 'Layers',
      });
    }

    // ── Remix / transform ──────────────────────────────────────────────────
    if (totalFields > 2) {
      candidates.push({
        key: 'remixForm',
        label: t('chips.remixForm'),
        prompt: 'I want to transform this form for a different purpose. Please remix it into: ',
        category: 'style',
        icon: 'Shuffle',
      });
    }

    // ── Make all required ──────────────────────────────────────────────────
    if (hasOptional && totalFields > 0) {
      candidates.push({
        key: 'makeAllRequired',
        label: t('chips.makeAllRequired'),
        prompt: 'Make every field on every page required.',
        category: 'edit',
        icon: 'Asterisk',
      });
    }

    // ── Fallback: always show at least one chip ────────────────────────────
    if (candidates.length === 0) {
      candidates.push({
        key: 'analyseForm',
        label: t('chips.analyseForm'),
        prompt: `Please analyse this form. Use listFields to read all pages and fields first, then give structured feedback on: (1) field order and logical flow, (2) missing fields for this type of form, (3) unclear or confusing labels, (4) fields that should be required but aren't. Be concise and actionable.`,
        category: 'ai',
        icon: 'ScanSearch',
      });
    }

    // Return top 4 (up from 3) — more context = more useful options
    return candidates.slice(0, 4);
  }, [pages, t]);
}

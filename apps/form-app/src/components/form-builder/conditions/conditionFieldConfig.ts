/**
 * Per-field-type condition trigger configuration for the rule editor.
 *
 * Mirrors the operator table locked in docs/conditional-logic-v1-strategy.md
 * §3.1 — the evaluator (packages/types/src/conditions.ts) enforces the same
 * table at runtime; this module only drives which choices the editor offers
 * and which VALUE input it renders.
 */

import {
  ConditionOperator,
  ConditionalRule,
  FieldType,
  FillableFormField,
  FormField,
  FormPage,
  RichTextFormField,
} from '@dculus/types';

export const TRIGGER_OPERATORS: Partial<Record<FieldType, ConditionOperator[]>> = {
  [FieldType.TEXT_INPUT_FIELD]: [
    'equals',
    'notEquals',
    'contains',
    'notContains',
    'startsWith',
    'endsWith',
    'isEmpty',
    'isFilled',
  ],
  [FieldType.TEXT_AREA_FIELD]: [
    'equals',
    'notEquals',
    'contains',
    'notContains',
    'startsWith',
    'endsWith',
    'isEmpty',
    'isFilled',
  ],
  [FieldType.EMAIL_FIELD]: [
    'equals',
    'notEquals',
    'contains',
    'notContains',
    'startsWith',
    'endsWith',
    'isEmpty',
    'isFilled',
  ],
  [FieldType.PHONE_NUMBER_FIELD]: ['equals', 'notEquals', 'startsWith', 'isEmpty', 'isFilled'],
  [FieldType.NUMBER_FIELD]: ['equals', 'notEquals', 'lessThan', 'greaterThan', 'isEmpty', 'isFilled'],
  [FieldType.DATE_FIELD]: ['equals', 'notEquals', 'before', 'after', 'isEmpty', 'isFilled'],
  [FieldType.SELECT_FIELD]: ['equals', 'notEquals', 'isEmpty', 'isFilled'],
  [FieldType.RADIO_FIELD]: ['equals', 'notEquals', 'isEmpty', 'isFilled'],
  [FieldType.CHECKBOX_FIELD]: ['contains', 'notContains', 'isEmpty', 'isFilled'],
  [FieldType.FILE_UPLOAD_FIELD]: ['isEmpty', 'isFilled'],
};

export type ConditionValueInputKind = 'none' | 'text' | 'number' | 'date' | 'option';

/** Which VALUE editor the term row renders (JotForm-style STATE/VALUE morphing). */
export const getValueInputKind = (
  fieldType: FieldType,
  operator: ConditionOperator
): ConditionValueInputKind => {
  if (operator === 'isEmpty' || operator === 'isFilled') return 'none';
  switch (fieldType) {
    case FieldType.NUMBER_FIELD:
      return 'number';
    case FieldType.DATE_FIELD:
      return 'date';
    case FieldType.SELECT_FIELD:
    case FieldType.RADIO_FIELD:
    case FieldType.CHECKBOX_FIELD:
      return 'option';
    default:
      return 'text';
  }
};

export interface TriggerFieldOption {
  field: FillableFormField;
  page: FormPage;
  pageIndex: number;
}

/** Every field usable on the IF side — fillable fields only, RichText excluded. */
export const getTriggerFieldOptions = (pages: FormPage[]): TriggerFieldOption[] => {
  const options: TriggerFieldOption[] = [];
  pages.forEach((page, pageIndex) => {
    page.fields.forEach((field) => {
      if (field instanceof RichTextFormField) return;
      if (!(field.type in TRIGGER_OPERATORS)) return;
      options.push({ field: field as FillableFormField, page, pageIndex });
    });
  });
  return options;
};

export interface TargetFieldOption {
  field: FormField;
  label: string;
  page: FormPage;
  pageIndex: number;
}

export const fieldDisplayLabel = (field: FormField): string => {
  const labelled = field as { label?: string };
  if (labelled.label && labelled.label.trim() !== '') return labelled.label;
  if (field instanceof RichTextFormField) {
    const text = field.content.replace(/<[^>]*>/g, ' ').trim();
    if (text) return text.length > 40 ? `${text.slice(0, 40)}…` : text;
  }
  return field.id;
};

/** Every field targetable on the DO side — including RichText info blocks. */
export const getTargetFieldOptions = (pages: FormPage[]): TargetFieldOption[] => {
  const options: TargetFieldOption[] = [];
  pages.forEach((page, pageIndex) => {
    page.fields.forEach((field) => {
      options.push({ field, label: fieldDisplayLabel(field), page, pageIndex });
    });
  });
  return options;
};

export interface RuleReferenceCheck {
  /** Term fieldIds that no longer exist in the schema */
  missingTermFieldIds: string[];
  /** Term values no longer among a choice field's options */
  staleOptionValues: Array<{ fieldId: string; value: string }>;
  /** Action field targets that no longer exist */
  missingActionFieldIds: string[];
  /** Action page targets that no longer exist */
  missingActionPageIds: string[];
  hasBrokenReferences: boolean;
}

/**
 * Detects dangling references (deleted fields/pages, renamed options) so the
 * rule list can badge them. The evaluator already treats these as inert
 * (locked decision §9.9) — this is purely a builder-side surfacing concern.
 */
export const checkRuleReferences = (
  rule: ConditionalRule,
  pages: FormPage[]
): RuleReferenceCheck => {
  const fieldsById = new Map<string, FormField>();
  const pageIds = new Set<string>();
  pages.forEach((page) => {
    pageIds.add(page.id);
    page.fields.forEach((field) => fieldsById.set(field.id, field));
  });

  const missingTermFieldIds: string[] = [];
  const staleOptionValues: Array<{ fieldId: string; value: string }> = [];
  for (const term of rule.terms) {
    const field = fieldsById.get(term.fieldId);
    if (!field) {
      missingTermFieldIds.push(term.fieldId);
      continue;
    }
    if (
      typeof term.value === 'string' &&
      getValueInputKind(field.type, term.operator) === 'option'
    ) {
      const options = (field as { options?: string[] }).options ?? [];
      if (!options.includes(term.value)) {
        staleOptionValues.push({ fieldId: term.fieldId, value: term.value });
      }
    }
  }

  const missingActionFieldIds: string[] = [];
  const missingActionPageIds: string[] = [];
  for (const action of rule.actions) {
    if ('fieldIds' in action) {
      for (const fieldId of action.fieldIds) {
        if (!fieldsById.has(fieldId)) missingActionFieldIds.push(fieldId);
      }
    } else if (!pageIds.has(action.pageId)) {
      missingActionPageIds.push(action.pageId);
    }
  }

  return {
    missingTermFieldIds,
    staleOptionValues,
    missingActionFieldIds,
    missingActionPageIds,
    hasBrokenReferences:
      missingTermFieldIds.length > 0 ||
      staleOptionValues.length > 0 ||
      missingActionFieldIds.length > 0 ||
      missingActionPageIds.length > 0,
  };
};

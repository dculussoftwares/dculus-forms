/**
 * Conditional logic (field & page conditions) — v1 data model.
 *
 * Rules are a flat, form-level list stored on `FormSchema.conditions` as plain
 * JSON (no classes), so they serialize through `serializeFormSchema` /
 * `deserializeFormSchema` and Y.js untouched. Design and locked decisions:
 * docs/conditional-logic-research.md §3 and docs/conditional-logic-v1-strategy.md.
 */

import { FieldType, type FormPage } from './index.js';

export type ConditionOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'isEmpty'
  | 'isFilled'
  | 'lessThan'
  | 'greaterThan' // number
  | 'before'
  | 'after'; // date

export interface ConditionTerm {
  fieldId: string;
  operator: ConditionOperator;
  value?: string | number | string[]; // omitted for isEmpty/isFilled
}

export type ConditionAction =
  | { type: 'showField' | 'hideField'; fieldIds: string[] }
  | { type: 'showPage' | 'hidePage'; pageId: string }
  | { type: 'skipToPage'; pageId: string }; // reserved for v1.5 — ignored by the v1 evaluator

export interface ConditionalRule {
  id: string;
  enabled: boolean;
  combinator: 'any' | 'all';
  terms: ConditionTerm[];
  actions: ConditionAction[];
}

/** Answer state as held by useFormResponseStore: pageId → fieldId → value. */
export type FormResponsesByPage = Record<string, Record<string, unknown>>;

export interface ConditionEvaluationResult {
  hiddenFieldIds: Set<string>;
  hiddenPageIds: Set<string>;
}

// Rule-side value coercion. A term whose value is missing or of the wrong
// shape for its operator evaluates to false (misconfigured rules never match,
// regardless of operator polarity — a broken notEquals must not fire).
const termString = (value: ConditionTerm['value']): string | null => {
  if (typeof value === 'string') return value.trim() === '' ? null : value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
};

const termNumber = (value: ConditionTerm['value']): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

// Trimmed + lowercased (locked decision §9.1: text compares are
// trim + case-insensitive); non-string response values read as empty.
const textValue = (raw: unknown): string =>
  typeof raw === 'string'
    ? raw.trim().toLowerCase()
    : typeof raw === 'number' && Number.isFinite(raw)
      ? String(raw)
      : '';

const evaluateTextTerm = (
  operator: ConditionOperator,
  value: ConditionTerm['value'],
  raw: unknown
): boolean => {
  const s = textValue(raw);
  if (operator === 'isEmpty') return s === '';
  if (operator === 'isFilled') return s !== '';
  const rv = termString(value);
  if (rv === null) return false;
  const r = rv.trim().toLowerCase();
  switch (operator) {
    case 'equals':
      return s === r;
    case 'notEquals':
      return s !== r;
    case 'contains':
      return s.includes(r);
    case 'notContains':
      return !s.includes(r);
    case 'startsWith':
      return s.startsWith(r);
    case 'endsWith':
      return s.endsWith(r);
    default:
      return false;
  }
};

// Raw E.164 comparison — exact digits, no trim/case games (strategy §3.1).
const evaluatePhoneTerm = (
  operator: ConditionOperator,
  value: ConditionTerm['value'],
  raw: unknown
): boolean => {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (operator === 'isEmpty') return s === '';
  if (operator === 'isFilled') return s !== '';
  const rv = termString(value);
  if (rv === null) return false;
  const r = rv.trim();
  switch (operator) {
    case 'equals':
      return s === r;
    case 'notEquals':
      return s !== r;
    case 'startsWith':
      return s !== '' && s.startsWith(r);
    default:
      return false;
  }
};

const evaluateNumberTerm = (
  operator: ConditionOperator,
  value: ConditionTerm['value'],
  raw: unknown
): boolean => {
  // Store shape is number | '' | undefined; 0 is a filled value (§9.3)
  const n =
    typeof raw === 'number' && Number.isFinite(raw)
      ? raw
      : typeof raw === 'string' && raw.trim() !== '' && Number.isFinite(Number(raw))
        ? Number(raw)
        : null;
  if (operator === 'isEmpty') return n === null;
  if (operator === 'isFilled') return n !== null;
  const rv = termNumber(value);
  if (rv === null) return false;
  switch (operator) {
    case 'equals':
      return n !== null && n === rv;
    case 'notEquals':
      return n === null || n !== rv;
    case 'lessThan':
      return n !== null && n < rv;
    case 'greaterThan':
      return n !== null && n > rv;
    default:
      return false;
  }
};

// Both sides are 'YYYY-MM-DD', so lexicographic compare is chronological and
// timezone-proof (§9.2) — never construct Date objects here.
const evaluateDateTerm = (
  operator: ConditionOperator,
  value: ConditionTerm['value'],
  raw: unknown
): boolean => {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (operator === 'isEmpty') return s === '';
  if (operator === 'isFilled') return s !== '';
  const rv = termString(value);
  if (rv === null) return false;
  const r = rv.trim();
  switch (operator) {
    case 'equals':
      return s !== '' && s === r;
    case 'notEquals':
      return s !== r;
    case 'before':
      return s !== '' && s < r;
    case 'after':
      return s !== '' && s > r;
    default:
      return false;
  }
};

// Select/Radio — exact match against canonical option strings.
const evaluateChoiceTerm = (
  operator: ConditionOperator,
  value: ConditionTerm['value'],
  raw: unknown
): boolean => {
  const s = typeof raw === 'string' ? raw : '';
  if (operator === 'isEmpty') return s === '';
  if (operator === 'isFilled') return s !== '';
  const rv = typeof value === 'string' && value !== '' ? value : null;
  if (rv === null) return false;
  switch (operator) {
    case 'equals':
      return s === rv;
    case 'notEquals':
      return s !== rv;
    default:
      return false;
  }
};

const evaluateCheckboxTerm = (
  operator: ConditionOperator,
  value: ConditionTerm['value'],
  raw: unknown
): boolean => {
  const arr = Array.isArray(raw) ? raw : [];
  if (operator === 'isEmpty') return arr.length === 0;
  if (operator === 'isFilled') return arr.length > 0;
  const rv = typeof value === 'string' && value !== '' ? value : null;
  if (rv === null) return false;
  switch (operator) {
    case 'contains':
      return arr.includes(rv);
    case 'notContains':
      return !arr.includes(rv); // includes the empty array (strategy §3.1)
    default:
      return false;
  }
};

// Works on both File[] (while filling) and uploaded R2 keys (at submit).
const evaluateFileTerm = (operator: ConditionOperator, raw: unknown): boolean => {
  const arr = Array.isArray(raw) ? raw : [];
  if (operator === 'isEmpty') return arr.length === 0;
  if (operator === 'isFilled') return arr.length > 0;
  return false;
};

const evaluateTerm = (
  term: ConditionTerm,
  fieldType: FieldType,
  raw: unknown
): boolean => {
  switch (fieldType) {
    case FieldType.TEXT_INPUT_FIELD:
    case FieldType.TEXT_AREA_FIELD:
    case FieldType.EMAIL_FIELD:
      return evaluateTextTerm(term.operator, term.value, raw);
    case FieldType.PHONE_NUMBER_FIELD:
      return evaluatePhoneTerm(term.operator, term.value, raw);
    case FieldType.NUMBER_FIELD:
      return evaluateNumberTerm(term.operator, term.value, raw);
    case FieldType.DATE_FIELD:
      return evaluateDateTerm(term.operator, term.value, raw);
    case FieldType.SELECT_FIELD:
    case FieldType.RADIO_FIELD:
      return evaluateChoiceTerm(term.operator, term.value, raw);
    case FieldType.CHECKBOX_FIELD:
      return evaluateCheckboxTerm(term.operator, term.value, raw);
    case FieldType.FILE_UPLOAD_FIELD:
      return evaluateFileTerm(term.operator, raw);
    default:
      // RichText and unknown types are never valid triggers
      return false;
  }
};

const setEquals = (a: ReadonlySet<string>, b: ReadonlySet<string>): boolean => {
  if (a.size !== b.size) return false;
  for (const item of a) if (!b.has(item)) return false;
  return true;
};

/**
 * Pure, total evaluator for conditional rules (strategy doc §6).
 *
 * - A field/page targeted by any show* action of an active rule starts hidden
 *   until a matched rule shows it; everything else starts visible.
 * - Hidden fields (and every field on a hidden page) read as empty while
 *   evaluating terms, so hiding a trigger auto-deactivates dependent rules.
 * - Matched rules apply their actions in list order — later rules win on
 *   conflict. Fixed-point iteration with a hard cap of activeRules + 1 passes;
 *   on an oscillating cycle the last computed state is returned (never loops).
 * - A page is also hidden when it has ≥1 field and all of them are hidden
 *   (auto-skip, §9.8). Terms referencing unknown/deleted fields are false;
 *   disabled, term-less, or action-less rules are inactive (§9.9).
 */
export const evaluateConditions = (
  rules: ConditionalRule[] | null | undefined,
  responses: FormResponsesByPage,
  schema: { pages: FormPage[] }
): ConditionEvaluationResult => {
  const fieldInfo = new Map<string, { type: FieldType; pageId: string }>();
  const pageFieldIds = new Map<string, string[]>();
  for (const page of schema.pages ?? []) {
    const ids: string[] = [];
    for (const field of page.fields ?? []) {
      if (field.deleted) continue;
      fieldInfo.set(field.id, { type: field.type, pageId: page.id });
      ids.push(field.id);
    }
    pageFieldIds.set(page.id, ids);
  }

  const activeRules = (rules ?? []).filter(
    (rule) =>
      rule.enabled &&
      Array.isArray(rule.terms) &&
      rule.terms.length > 0 &&
      Array.isArray(rule.actions) &&
      rule.actions.length > 0
  );

  const defaultHiddenFields = new Set<string>();
  const defaultHiddenPages = new Set<string>();
  for (const rule of activeRules) {
    for (const action of rule.actions) {
      if (action.type === 'showField') {
        for (const id of action.fieldIds ?? []) defaultHiddenFields.add(id);
      } else if (action.type === 'showPage') {
        defaultHiddenPages.add(action.pageId);
      }
    }
  }

  const evaluateOnce = (
    hiddenFields: ReadonlySet<string>,
    hiddenPages: ReadonlySet<string>
  ): { fields: Set<string>; pages: Set<string> } => {
    const termMatches = (term: ConditionTerm): boolean => {
      const info = fieldInfo.get(term.fieldId);
      if (!info) return false;
      const raw =
        hiddenFields.has(term.fieldId) || hiddenPages.has(info.pageId)
          ? undefined // hidden = empty (§9.4)
          : responses[info.pageId]?.[term.fieldId];
      return evaluateTerm(term, info.type, raw);
    };

    const nextFields = new Set(defaultHiddenFields);
    const nextPages = new Set(defaultHiddenPages);

    for (const rule of activeRules) {
      const matched =
        rule.combinator === 'any'
          ? rule.terms.some(termMatches)
          : rule.terms.every(termMatches);
      if (!matched) continue;
      for (const action of rule.actions) {
        switch (action.type) {
          case 'showField':
            for (const id of action.fieldIds ?? []) nextFields.delete(id);
            break;
          case 'hideField':
            for (const id of action.fieldIds ?? []) nextFields.add(id);
            break;
          case 'showPage':
            nextPages.delete(action.pageId);
            break;
          case 'hidePage':
            nextPages.add(action.pageId);
            break;
          default:
            // skipToPage (v1.5) and unknown types from newer clients — no-op
            break;
        }
      }
    }

    for (const [pageId, ids] of pageFieldIds) {
      if (ids.length > 0 && ids.every((id) => nextFields.has(id))) {
        nextPages.add(pageId);
      }
    }

    return { fields: nextFields, pages: nextPages };
  };

  let current = {
    fields: new Set(defaultHiddenFields),
    pages: new Set(defaultHiddenPages),
  };
  const maxIterations = activeRules.length + 1;
  for (let i = 0; i < maxIterations; i++) {
    const next = evaluateOnce(current.fields, current.pages);
    const stable =
      setEquals(next.fields, current.fields) && setEquals(next.pages, current.pages);
    current = next;
    if (stable) break;
  }

  return { hiddenFieldIds: current.fields, hiddenPageIds: current.pages };
};

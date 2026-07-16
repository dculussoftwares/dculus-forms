/**
 * Conditional logic (field & page conditions) — v1 data model.
 *
 * Rules are a flat, form-level list stored on `FormSchema.conditions` as plain
 * JSON (no classes), so they serialize through `serializeFormSchema` /
 * `deserializeFormSchema` and Y.js untouched. Design and locked decisions:
 * docs/conditional-logic-research.md §3 and docs/conditional-logic-v1-strategy.md.
 */

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

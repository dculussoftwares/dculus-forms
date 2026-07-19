/**
 * Conditional logic (field & page conditions) — v1 data model.
 *
 * Rules are a flat, form-level list stored on `FormSchema.conditions` as plain
 * JSON (no classes), so they serialize through `serializeFormSchema` /
 * `deserializeFormSchema` and Y.js untouched. Design and locked decisions:
 * docs/conditional-logic-research.md §3 and docs/conditional-logic-v1-strategy.md.
 */

import { z } from 'zod';
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
  | { type: 'skipToPage'; pageId: string } // v1.5 forward-only page skip
  | { type: 'requireField' | 'unrequireField'; fieldIds: string[] }; // v2 conditional required

export interface ConditionalRule {
  id: string;
  enabled: boolean;
  combinator: 'any' | 'all';
  terms: ConditionTerm[];
  actions: ConditionAction[];
}

// Runtime (Zod) schemas for the persisted rule shape. Used to sanitize
// conditions at trust boundaries — Y.js deserialization and
// deserializeFormSchema — so downstream code only ever sees valid rules.
export const conditionTermSchema = z.object({
  fieldId: z.string().min(1),
  operator: z.enum([
    'equals',
    'notEquals',
    'contains',
    'notContains',
    'startsWith',
    'endsWith',
    'isEmpty',
    'isFilled',
    'lessThan',
    'greaterThan',
    'before',
    'after',
  ]),
  value: z.union([z.string(), z.number(), z.array(z.string())]).optional(),
});

export const conditionActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.enum(['showField', 'hideField']),
    fieldIds: z.array(z.string().min(1)),
  }),
  z.object({
    type: z.enum(['showPage', 'hidePage', 'skipToPage']),
    pageId: z.string().min(1),
  }),
  z.object({
    type: z.enum(['requireField', 'unrequireField']),
    fieldIds: z.array(z.string().min(1)),
  }),
]);

export const conditionalRuleSchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean(),
  combinator: z.enum(['any', 'all']),
  terms: z.array(conditionTermSchema),
  actions: z.array(conditionActionSchema),
});

/**
 * Validates untrusted persisted data into a clean ConditionalRule[].
 * Invalid rules are dropped (not thrown) — collab races and hand-edited JSON
 * must never take the whole schema down. Returns undefined when the input is
 * not an array or nothing survives, preserving "absent = no conditions".
 */
export const sanitizeConditions = (
  input: unknown
): ConditionalRule[] | undefined => {
  if (!Array.isArray(input)) return undefined;
  const valid: ConditionalRule[] = [];
  for (const candidate of input) {
    const parsed = conditionalRuleSchema.safeParse(candidate);
    if (parsed.success) valid.push(parsed.data as ConditionalRule);
  }
  return valid.length > 0 ? valid : undefined;
};

/** Answer state as held by useFormResponseStore: pageId → fieldId → value. */
export type FormResponsesByPage = Record<string, Record<string, unknown>>;

export interface ConditionEvaluationResult {
  hiddenFieldIds: Set<string>;
  hiddenPageIds: Set<string>;
  /** Fields that should be required/unrequired by conditional logic.
   *  true = required, false = not required (unrequired).
   *  Last matched rule wins per field. Hidden fields NEVER end up required. */
  requiredOverrides: Map<string, boolean>;
}

const isWellFormedAction = (action: unknown): action is ConditionAction => {
  if (!action || typeof action !== 'object') return false;
  const candidate = action as { type?: unknown; fieldIds?: unknown; pageId?: unknown };
  switch (candidate.type) {
    case 'showField':
    case 'hideField':
    case 'requireField':
    case 'unrequireField':
      return (
        Array.isArray(candidate.fieldIds) &&
        candidate.fieldIds.every((id) => typeof id === 'string')
      );
    case 'showPage':
    case 'hidePage':
    case 'skipToPage':
      return typeof candidate.pageId === 'string';
    default:
      return false;
  }
};

// Rule-side value coercion. A term whose value is missing or of the wrong
// shape for its operator evaluates to false (misconfigured rules never match,
// regardless of operator polarity — a broken notEquals must not fire).
// Text fields coerce numbers to strings; phone/date fields take strings only.
const textTermString = (value: ConditionTerm['value']): string | null => {
  if (typeof value === 'string') return value.trim() === '' ? null : value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
};

const strictTermString = (value: ConditionTerm['value']): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null;

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
  const rv = textTermString(value);
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
  const rv = strictTermString(value);
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
  const rv = strictTermString(value);
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

/**
 * Removes hidden fields' values — and every value on hidden pages — from a
 * page-keyed response map. This is the submit-time enforcement gate
 * (strategy doc §5): values are kept in the store while filling and stripped
 * exactly once here, before upload/validation/submission see them.
 * Returns a new map; the input is not mutated.
 */
export const stripHiddenResponses = (
  responses: FormResponsesByPage,
  visibility: ConditionEvaluationResult
): FormResponsesByPage => {
  const stripped: FormResponsesByPage = {};
  for (const [pageId, pageResponses] of Object.entries(responses ?? {})) {
    if (visibility.hiddenPageIds.has(pageId)) continue;
    const kept: Record<string, unknown> = {};
    for (const [fieldId, value] of Object.entries(pageResponses ?? {})) {
      if (!visibility.hiddenFieldIds.has(fieldId)) kept[fieldId] = value;
    }
    stripped[pageId] = kept;
  }
  return stripped;
};

/**
 * Pure, total evaluator for conditional rules (strategy doc §6).
 *
 * - A field/page targeted by any show* action of an active rule starts hidden
 *   until a matched rule shows it; everything else starts visible.
 * - Hidden fields (and every field on a hidden page) read as empty while
 *   evaluating terms, so hiding a trigger auto-deactivates dependent rules.
 * - Matched rules apply their actions in list order — later rules win on
 *   conflict. Fixed-point iteration stops when the visibility state stabilizes
 *   or a previously seen state repeats (an oscillating show/hide cycle). Cycle
 *   resolution is per-item-type:
 *     • Fields: intersection of cycle states → VISIBLE when oscillating.
 *       Contradictory field rules are usually a misconfiguration; visibility is
 *       the safer default.
 *     • Pages: union of cycle states → HIDDEN when oscillating. A self-hiding
 *       page rule (trigger field on the same page as the action) is intentional
 *       by design — the user wants the page gone. The PageRenderer clamp guard
 *       handles the resulting "current page hidden" state safely.
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
  const pageOrderMap = new Map<string, number>();
  const pages = schema.pages ?? [];
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    pageOrderMap.set(page.id, i);
    const ids: string[] = [];
    for (const field of page.fields ?? []) {
      if (field.deleted) continue;
      fieldInfo.set(field.id, { type: field.type, pageId: page.id });
      ids.push(field.id);
    }
    pageFieldIds.set(page.id, ids);
  }

  const activeRules = (Array.isArray(rules) ? rules : [])
    .filter(
      (rule) =>
        !!rule &&
        typeof rule === 'object' &&
        rule.enabled &&
        Array.isArray(rule.terms) &&
        rule.terms.length > 0 &&
        Array.isArray(rule.actions) &&
        rule.actions.some(isWellFormedAction)
    )
    .map((rule) => ({ ...rule, actions: rule.actions.filter(isWellFormedAction) }));

  const defaultHiddenFields = new Set<string>();
  const defaultHiddenPages = new Set<string>();
  for (const rule of activeRules) {
    for (const action of rule.actions) {
      if (action.type === 'showField') {
        for (const id of action.fieldIds) defaultHiddenFields.add(id);
      } else if (action.type === 'showPage') {
        defaultHiddenPages.add(action.pageId);
      }
    }
  }

  const termMatches = (
    term: ConditionTerm,
    hiddenFields: ReadonlySet<string>,
    hiddenPages: ReadonlySet<string>
  ): boolean => {
    if (!term || typeof term.fieldId !== 'string') return false;
    const info = fieldInfo.get(term.fieldId);
    if (!info) return false;
    const raw =
      hiddenFields.has(term.fieldId) || hiddenPages.has(info.pageId)
        ? undefined // hidden = empty (§9.4)
        : responses[info.pageId]?.[term.fieldId];
    return evaluateTerm(term, info.type, raw);
  };

  const evaluateOnce = (
    hiddenFields: ReadonlySet<string>,
    hiddenPages: ReadonlySet<string>
  ): { fields: Set<string>; pages: Set<string> } => {
    const nextFields = new Set(defaultHiddenFields);
    const nextPages = new Set(defaultHiddenPages);
    const maxSkipTargetByTriggerPage = new Map<number, number>();

    for (const rule of activeRules) {
      const matched =
        rule.combinator === 'any'
          ? rule.terms.some((term) => termMatches(term, hiddenFields, hiddenPages))
          : rule.terms.every((term) => termMatches(term, hiddenFields, hiddenPages));
      if (!matched) continue;
      for (const action of rule.actions) {
        switch (action.type) {
          case 'showField':
            for (const id of action.fieldIds) nextFields.delete(id);
            break;
          case 'hideField':
            for (const id of action.fieldIds) nextFields.add(id);
            break;
          case 'showPage':
            nextPages.delete(action.pageId);
            break;
          case 'hidePage':
            nextPages.add(action.pageId);
            break;
          case 'skipToPage': {
            const targetIdx = pageOrderMap.get(action.pageId);
            if (targetIdx === undefined) break;
            let triggerIdx: number | undefined = undefined;
            for (const term of rule.terms) {
              if (!term || typeof term.fieldId !== 'string') continue;
              const info = fieldInfo.get(term.fieldId);
              if (!info) continue;
              const pIdx = pageOrderMap.get(info.pageId);
              if (pIdx !== undefined) {
                triggerIdx = triggerIdx === undefined ? pIdx : Math.max(triggerIdx, pIdx);
              }
            }
            if (triggerIdx !== undefined && targetIdx > triggerIdx) {
              const currentMax = maxSkipTargetByTriggerPage.get(triggerIdx);
              maxSkipTargetByTriggerPage.set(
                triggerIdx,
                currentMax === undefined ? targetIdx : Math.max(currentMax, targetIdx)
              );
            }
            break;
          }
          default:
            break;
        }
      }
    }

    for (const [triggerIdx, targetIdx] of maxSkipTargetByTriggerPage) {
      for (let k = triggerIdx + 1; k < targetIdx; k++) {
        const page = pages[k];
        if (page) {
          nextPages.add(page.id);
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

  type VisibilityState = { fields: Set<string>; pages: Set<string> };

  const stateSignature = (state: VisibilityState): string =>
    `${[...state.fields].sort().join('\u0001')}\u0002${[...state.pages].sort().join('\u0001')}`;

  // Iterate to a fixed point. Visibility states are finite so the trajectory
  // must revisit a state: a repeat of the previous state is stability, any
  // earlier repeat closes an oscillating show/hide cycle. Cycle policy: an
  // item (field/page) that oscillates anywhere within the cycle resolves to
  // VISIBLE; only items hidden in every cycle state stay hidden (intersection
  // of the cycle states). Prefer-visibility is resolved per item, so
  // independent cycles - whatever their phase - can never influence each
  // other's outcome. The safety cap scales with form size: a legitimate
  // cascade chain needs one iteration per chained rule, so it can only be hit
  // by adversarial rule sets, in which case the last computed state returns.
  let current: VisibilityState = {
    fields: new Set(defaultHiddenFields),
    pages: new Set(defaultHiddenPages),
  };
  const seenIndex = new Map<string, number>([[stateSignature(current), 0]]);
  const history: VisibilityState[] = [current];
  const maxIterations = activeRules.length + fieldInfo.size + pageFieldIds.size + 2;
  for (let i = 0; i < maxIterations; i++) {
    const next = evaluateOnce(current.fields, current.pages);
    const signature = stateSignature(next);
    const firstSeenAt = seenIndex.get(signature);
    if (firstSeenAt !== undefined) {
      const cycle = history.slice(firstSeenAt);
      current = {
        // Fields: intersection → prefer VISIBLE (contradictory rules = misconfiguration)
        fields: new Set(
          [...next.fields].filter((id) => cycle.every((s) => s.fields.has(id)))
        ),
        // Pages: union → prefer HIDDEN (self-hiding page rule is intentional)
        pages: new Set(cycle.flatMap((s) => [...s.pages])),
      };
      break;
    }
    seenIndex.set(signature, history.length);
    history.push(next);
    current = next;
  }

  // Compute requiredOverrides: evaluate active rules' requireField/unrequireField
  // actions in list order. Last matched rule wins per field. Hidden fields NEVER
  // end up required (hidden-beats-required invariant).
  const requiredOverrides = new Map<string, boolean>();
  for (const rule of activeRules) {
    const matched =
      rule.combinator === 'any'
        ? rule.terms.some((term) => termMatches(term, current.fields, current.pages))
        : rule.terms.every((term) => termMatches(term, current.fields, current.pages));
    if (!matched) continue;
    for (const action of rule.actions) {
      if (action.type === 'requireField') {
        for (const id of action.fieldIds) {
          if (fieldInfo.has(id)) requiredOverrides.set(id, true);
        }
      } else if (action.type === 'unrequireField') {
        for (const id of action.fieldIds) {
          if (fieldInfo.has(id)) requiredOverrides.set(id, false);
        }
      }
    }
  }

  // Hidden-beats-required: strip any override for hidden fields
  for (const fieldId of current.fields) {
    requiredOverrides.delete(fieldId);
  }

  return { hiddenFieldIds: current.fields, hiddenPageIds: current.pages, requiredOverrides };
};

export interface ConditionCycle {
  ruleIds: string[];
}

/**
 * Detects circular dependencies (strongly-connected components with ≥1 edge)
 * among active conditional rules.
 *
 * Rule R depends on field F if F is in R.terms.
 * Rule R affects field G / page P via its actions (page actions affect all non-deleted fields on that page).
 * An edge R1 -> R2 exists when R1 affects a field R2 depends on.
 * Reports strongly-connected components with ≥1 edge (self-loops count: a rule whose action affects its own trigger).
 * Disabled rules (enabled === false) and invalid rules are excluded.
 */
export const detectConditionCycles = (
  rules: ConditionalRule[] | null | undefined,
  schema?: { pages?: FormPage[] }
): ConditionCycle[] => {
  if (!Array.isArray(rules) || rules.length === 0) return [];

  // 1. Build map of pageId -> set of non-deleted fieldIds, and fieldId -> pageId
  const pageFieldMap = new Map<string, string[]>();
  const fieldPageMap = new Map<string, string>();
  const pageOrderMap = new Map<string, number>();

  const pages = schema?.pages ?? [];
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    pageOrderMap.set(page.id, i);
    const fieldIds: string[] = [];
    for (const field of page.fields ?? []) {
      if (field.deleted) continue;
      fieldIds.push(field.id);
      fieldPageMap.set(field.id, page.id);
    }
    pageFieldMap.set(page.id, fieldIds);
  }

  // 2. Filter active rules
  const activeRules = rules.filter(
    (rule): rule is ConditionalRule =>
      !!rule &&
      typeof rule === 'object' &&
      rule.enabled === true &&
      Array.isArray(rule.terms) &&
      rule.terms.length > 0 &&
      Array.isArray(rule.actions) &&
      rule.actions.some(isWellFormedAction)
  );

  if (activeRules.length === 0) return [];

  // 3. For each active rule, determine dependsOnFields & affectedFields
  const ruleDependsOn = activeRules.map((rule) => {
    const set = new Set<string>();
    for (const term of rule.terms) {
      if (term && typeof term.fieldId === 'string' && term.fieldId.length > 0) {
        set.add(term.fieldId);
      }
    }
    return set;
  });

  const ruleAffects = activeRules.map((rule) => {
    const set = new Set<string>();
    for (const action of rule.actions) {
      if (!isWellFormedAction(action)) continue;
      if (action.type === 'showField' || action.type === 'hideField' || action.type === 'requireField' || action.type === 'unrequireField') {
        for (const fid of action.fieldIds) {
          if (typeof fid === 'string' && fid.length > 0) {
            set.add(fid);
          }
        }
      } else if (action.type === 'showPage' || action.type === 'hidePage') {
        const fieldsOnPage = pageFieldMap.get(action.pageId);
        if (fieldsOnPage) {
          for (const fid of fieldsOnPage) set.add(fid);
        }
      } else if (action.type === 'skipToPage') {
        const targetIdx = pageOrderMap.get(action.pageId);
        let triggerIdx: number | undefined = undefined;
        for (const term of rule.terms) {
          if (!term || typeof term.fieldId !== 'string') continue;
          const pId = fieldPageMap.get(term.fieldId);
          if (pId !== undefined) {
            const pIdx = pageOrderMap.get(pId);
            if (pIdx !== undefined) {
              triggerIdx = triggerIdx === undefined ? pIdx : Math.max(triggerIdx, pIdx);
            }
          }
        }
        if (targetIdx !== undefined && triggerIdx !== undefined && targetIdx > triggerIdx) {
          for (let k = triggerIdx + 1; k < targetIdx; k++) {
            const intermediatePage = pages[k];
            if (intermediatePage) {
              const fieldsOnPage = pageFieldMap.get(intermediatePage.id);
              if (fieldsOnPage) {
                for (const fid of fieldsOnPage) set.add(fid);
              }
            }
          }
        } else if (action.pageId) {
          const fieldsOnPage = pageFieldMap.get(action.pageId);
          if (fieldsOnPage) {
            for (const fid of fieldsOnPage) set.add(fid);
          }
        }
      }
    }
    return set;
  });

  // 4. Build graph edges
  const n = activeRules.length;
  const adj: number[][] = Array.from({ length: n }, () => []);
  const selfLoops = new Set<number>();

  for (let i = 0; i < n; i++) {
    const affects = ruleAffects[i];
    for (let j = 0; j < n; j++) {
      const depends = ruleDependsOn[j];
      let hasEdge = false;
      for (const fieldId of affects) {
        if (depends.has(fieldId)) {
          hasEdge = true;
          break;
        }
      }
      if (hasEdge) {
        adj[i].push(j);
        if (i === j) {
          selfLoops.add(i);
        }
      }
    }
  }

  // 5. Find SCCs using Tarjan's algorithm
  let index = 0;
  const indices = new Map<number, number>();
  const lowlink = new Map<number, number>();
  const onStack = new Map<number, boolean>();
  const stack: number[] = [];
  const rawSCCs: number[][] = [];

  function strongConnect(u: number) {
    indices.set(u, index);
    lowlink.set(u, index);
    index++;
    stack.push(u);
    onStack.set(u, true);

    for (const v of adj[u]) {
      if (!indices.has(v)) {
        strongConnect(v);
        lowlink.set(u, Math.min(lowlink.get(u)!, lowlink.get(v)!));
      } else if (onStack.get(v)) {
        lowlink.set(u, Math.min(lowlink.get(u)!, indices.get(v)!));
      }
    }

    if (lowlink.get(u) === indices.get(u)) {
      const scc: number[] = [];
      let popDone = false;
      while (!popDone) {
        const w = stack.pop()!;
        onStack.set(w, false);
        scc.push(w);
        if (w === u) popDone = true;
      }
      rawSCCs.push(scc);
    }
  }

  for (let i = 0; i < n; i++) {
    if (!indices.has(i)) {
      strongConnect(i);
    }
  }

  // 6. Filter SCCs with >= 1 edge: scc.length > 1 OR (scc.length === 1 && selfLoops.has(scc[0]))
  const cycles: ConditionCycle[] = [];
  for (const scc of rawSCCs) {
    if (scc.length > 1 || (scc.length === 1 && selfLoops.has(scc[0]))) {
      scc.sort((a, b) => a - b);
      const ruleIds = scc.map((idx) => activeRules[idx].id);
      cycles.push({ ruleIds });
    }
  }

  // Sort cycles by min rule index in original activeRules array
  cycles.sort((a, b) => {
    const minA = Math.min(...a.ruleIds.map((id) => activeRules.findIndex((r) => r.id === id)));
    const minB = Math.min(...b.ruleIds.map((id) => activeRules.findIndex((r) => r.id === id)));
    return minA - minB;
  });

  return cycles;
};

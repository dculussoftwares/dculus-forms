/**
 * Pure draft logic for the rule inspector: signatures, validity, remote
 * reconciliation and the commit plan. Kept free of React and i18n so the save
 * model is unit-testable.
 */
import type {
  ConditionAction,
  ConditionOperator,
  ConditionTerm,
  ConditionalRule,
  FieldType,
} from '@dculus/types';
import { TRIGGER_OPERATORS, getValueInputKind } from './conditionFieldConfig';

export type EditorActionType =
  | 'showField'
  | 'hideField'
  | 'hidePage'
  | 'skipToPage'
  | 'requireField'
  | 'unrequireField';

export interface EditorAction {
  type: EditorActionType;
  fieldIds: string[];
  pageId: string;
}

export const ACTION_TYPES: EditorActionType[] = [
  'showField',
  'hideField',
  'requireField',
  'unrequireField',
  'hidePage',
  'skipToPage',
];

export interface RuleDraftSeed {
  terms?: ConditionTerm[];
  actions?: Array<Partial<EditorAction> & { type: EditorActionType }>;
  combinator?: 'any' | 'all';
}

export interface RuleDraft {
  terms: ConditionTerm[];
  actions: EditorAction[];
  combinator: 'any' | 'all';
}

/** A stored number, or a numeric string the editor is willing to coerce. */
export const isFiniteNumeric = (value: unknown): boolean =>
  (typeof value === 'number' && Number.isFinite(value)) ||
  (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)));

export const emptyTerm = (): ConditionTerm => ({ fieldId: '', operator: 'equals' });
export const emptyAction = (): EditorAction => ({ type: 'showField', fieldIds: [], pageId: '' });

// Actions this editor can't edit (showPage from newer clients) are preserved
// verbatim on save rather than silently dropped.
export const preservedActions = (rule: ConditionalRule | null | undefined): ConditionAction[] =>
  (rule?.actions ?? []).filter(
    (action) =>
      !('fieldIds' in action) && action.type !== 'hidePage' && action.type !== 'skipToPage'
  );

export const toEditorActions = (rule: ConditionalRule | null): EditorAction[] => {
  if (!rule) return [emptyAction()];
  const actions: EditorAction[] = [];
  for (const action of rule.actions) {
    if ('fieldIds' in action) {
      actions.push({ type: action.type, fieldIds: [...action.fieldIds], pageId: '' });
    } else if (action.type === 'hidePage' || action.type === 'skipToPage') {
      actions.push({ type: action.type, fieldIds: [], pageId: action.pageId });
    }
  }
  // A rule holding only preserved actions must stay savable — start with no
  // editable rows instead of an unsatisfiable empty placeholder.
  if (actions.length === 0 && preservedActions(rule).length > 0) return [];
  return actions.length > 0 ? actions : [emptyAction()];
};

export const initialDraftFor = (
  initialRule: ConditionalRule | null,
  seed?: RuleDraftSeed | null
): RuleDraft => {
  if (initialRule) {
    return {
      terms: initialRule.terms.map((term) => ({ ...term })),
      actions: toEditorActions(initialRule),
      combinator: initialRule.combinator ?? 'all',
    };
  }
  return {
    terms: seed?.terms?.length ? seed.terms.map((term) => ({ ...term })) : [emptyTerm()],
    actions: seed?.actions?.length
      ? seed.actions.map((action) => ({ ...emptyAction(), ...action }))
      : [emptyAction()],
    combinator: seed?.combinator ?? 'all',
  };
};

/** Key-order independent, so rules authored elsewhere compare equal to the same draft. */
export const draftSignature = (draft: RuleDraft): string =>
  JSON.stringify({
    c: draft.combinator,
    t: draft.terms.map((term) => [term.fieldId, term.operator, term.value ?? null]),
    a: draft.actions.map((action) => [action.type, [...action.fieldIds], action.pageId]),
  });

export const ruleSignature = (rule: ConditionalRule): string =>
  draftSignature(initialDraftFor(rule));

// ── Validity gate ──────────────────────────────────────────────────────────

export type TermIssue = 'selectField' | 'selectOperator' | 'enterNumber' | 'enterValue';
export type ActionIssue = 'selectPage' | 'selectTarget' | 'missingPage' | 'missingTarget';

export interface DraftIssues {
  terms: (TermIssue | null)[];
  actions: (ActionIssue | null)[];
  noTerms: boolean;
  noActions: boolean;
  /** Total blocking issues; 0 means the draft can be saved. */
  count: number;
}

export interface DraftIssueContext {
  /** Fillable fields usable on the IF side, by id. */
  triggerFieldById: Map<string, { type: FieldType }>;
  existingFieldIds: Set<string>;
  existingPageIds: Set<string>;
  preservedCount: number;
}

export const getTermIssue = (
  term: ConditionTerm,
  triggerFieldById: DraftIssueContext['triggerFieldById']
): TermIssue | null => {
  const field = triggerFieldById.get(term.fieldId);
  if (!field) return 'selectField';
  if (!(TRIGGER_OPERATORS[field.type] ?? []).includes(term.operator)) return 'selectOperator';
  const kind = getValueInputKind(field.type, term.operator as ConditionOperator);
  if (kind === 'none') return null;
  // The number input tolerates a numeric string (e.g. an AI-authored rule).
  if (kind === 'number') return isFiniteNumeric(term.value) ? null : 'enterNumber';
  return typeof term.value === 'string' && term.value.trim() !== '' ? null : 'enterValue';
};

export const getActionIssue = (
  action: EditorAction,
  ctx: Pick<DraftIssueContext, 'existingFieldIds' | 'existingPageIds'>
): ActionIssue | null => {
  if (action.type === 'hidePage' || action.type === 'skipToPage') {
    if (action.pageId === '') return 'selectPage';
    return ctx.existingPageIds.has(action.pageId) ? null : 'missingPage';
  }
  if (action.fieldIds.length === 0) return 'selectTarget';
  return action.fieldIds.every((id) => ctx.existingFieldIds.has(id)) ? null : 'missingTarget';
};

export const getDraftIssues = (draft: RuleDraft, ctx: DraftIssueContext): DraftIssues => {
  const terms = draft.terms.map((term) => getTermIssue(term, ctx.triggerFieldById));
  const actions = draft.actions.map((action) => getActionIssue(action, ctx));
  const noTerms = draft.terms.length === 0;
  const noActions = draft.actions.length + ctx.preservedCount === 0;
  const count =
    terms.filter(Boolean).length +
    actions.filter(Boolean).length +
    (noTerms ? 1 : 0) +
    (noActions ? 1 : 0);
  return { terms, actions, noTerms, noActions, count };
};

// ── Remote reconciliation ──────────────────────────────────────────────────

export type RemoteState = 'in-sync' | 'rebase' | 'conflict' | 'deleted';

export const reconcileWithLive = (args: {
  mode: 'create' | 'edit';
  baseSignature: string;
  draftSignature: string;
  liveRule: ConditionalRule | undefined;
}): RemoteState => {
  if (args.mode === 'create') return 'in-sync';
  if (!args.liveRule) return 'deleted';
  const liveSig = ruleSignature(args.liveRule);
  if (liveSig === args.baseSignature) return 'in-sync';
  // Both sides made the same change, or we have nothing of our own to lose.
  if (liveSig === args.draftSignature || args.draftSignature === args.baseSignature) {
    return 'rebase';
  }
  return 'conflict';
};

// ── Commit plan ────────────────────────────────────────────────────────────

export type CommitIntent = 'create' | 'update' | 'recreate';

export type CommitPlan =
  | { kind: 'add'; rule: ConditionalRule }
  | { kind: 'update'; rule: ConditionalRule }
  | { kind: 'blocked'; reason: 'deleted' };

const toRuleActions = (actions: EditorAction[]): ConditionAction[] =>
  actions.map((action) =>
    action.type === 'hidePage' || action.type === 'skipToPage'
      ? ({ type: action.type, pageId: action.pageId } as ConditionAction)
      : ({ type: action.type, fieldIds: [...action.fieldIds] } as ConditionAction)
  );

/** Builds a rule from a draft; `id` and `enabled` come from the caller. */
export const draftToRule = (
  draft: RuleDraft,
  id: string,
  enabled: boolean,
  preserved: ConditionAction[]
): ConditionalRule => ({
  id,
  enabled,
  combinator: draft.combinator,
  terms: draft.terms.map((term) => ({ ...term })),
  actions: [...toRuleActions(draft.actions), ...preserved.map((action) => ({ ...action }))],
});

export const planCommit = (args: {
  intent: CommitIntent;
  ruleId: string;
  draft: RuleDraft;
  baseEnabled: boolean;
  basePreserved: ConditionAction[];
  liveRules: ConditionalRule[];
}): CommitPlan => {
  const live = args.liveRules.find((rule) => rule.id === args.ruleId);

  // The live rule wins for `enabled` (the card toggle) and for actions this
  // editor can't render, so neither is overwritten by a stale base.
  const updateLive = (existing: ConditionalRule): CommitPlan => ({
    kind: 'update',
    rule: draftToRule(args.draft, args.ruleId, existing.enabled, preservedActions(existing)),
  });

  if (args.intent === 'update') {
    // Never resurrect a rule that was deleted while the draft was open.
    return live ? updateLive(live) : { kind: 'blocked', reason: 'deleted' };
  }
  // A double submit or id collision becomes an update instead of a duplicate.
  if (live) return updateLive(live);
  return {
    kind: 'add',
    rule: draftToRule(args.draft, args.ruleId, args.baseEnabled, args.basePreserved),
  };
};

// ── Broken-reference cleanup (draft only) ──────────────────────────────────

export const cleanupDraftReferences = (
  draft: RuleDraft,
  ctx: Pick<DraftIssueContext, 'existingFieldIds' | 'existingPageIds' | 'preservedCount'>
): { draft: RuleDraft; removed: number } => {
  let removed = 0;

  let terms = draft.terms.filter((term) => {
    const keep = term.fieldId === '' || ctx.existingFieldIds.has(term.fieldId);
    if (!keep) removed += 1;
    return keep;
  });
  if (terms.length === 0) terms = [emptyTerm()];

  let actions: EditorAction[] = [];
  for (const action of draft.actions) {
    if (action.type === 'hidePage' || action.type === 'skipToPage') {
      if (action.pageId !== '' && !ctx.existingPageIds.has(action.pageId)) {
        removed += 1;
        continue;
      }
      actions.push(action);
      continue;
    }
    const fieldIds = action.fieldIds.filter((id) => ctx.existingFieldIds.has(id));
    removed += action.fieldIds.length - fieldIds.length;
    // A row emptied by cleanup is dropped; a row the user left blank is kept.
    if (fieldIds.length === 0 && action.fieldIds.length > 0) continue;
    actions.push({ ...action, fieldIds });
  }
  if (actions.length === 0 && ctx.preservedCount === 0) actions = [emptyAction()];

  return {
    draft: { terms, actions, combinator: draft.combinator },
    removed,
  };
};

// ── Status line ────────────────────────────────────────────────────────────

export type SaveStatus =
  | 'readOnly'
  | 'offline'
  | 'error'
  | 'deleted'
  | 'conflict'
  | 'createIdle'
  | 'clean'
  | 'invalid'
  | 'incomplete'
  | 'dirty';

export const deriveSaveStatus = (args: {
  canEdit: boolean;
  isConnected: boolean;
  mode: 'create' | 'edit';
  isDirty: boolean;
  isComplete: boolean;
  showErrors: boolean;
  remote: RemoteState;
  writeFailed: boolean;
}): SaveStatus => {
  if (!args.canEdit) return 'readOnly';
  if (!args.isConnected) return 'offline';
  if (args.writeFailed) return 'error';
  if (args.remote === 'deleted') return 'deleted';
  if (args.remote === 'conflict') return 'conflict';
  if (!args.isDirty) return args.mode === 'create' ? 'createIdle' : 'clean';
  if (!args.isComplete) return args.showErrors ? 'invalid' : 'incomplete';
  return 'dirty';
};

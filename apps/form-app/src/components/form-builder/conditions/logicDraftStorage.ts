/**
 * Per-form, per-tab stash of an unsaved rule draft.
 *
 * The builder uses BrowserRouter, so route changes (tab switch, back) can't be
 * blocked. Instead the draft survives them here and is restored with a banner
 * when the Logic tab mounts again. Storage content is untrusted: it is
 * size-capped and schema-validated on read, and every access is best-effort.
 */
import { z } from 'zod';
import type { ConditionAction, ConditionOperator } from '@dculus/types';
import { ACTION_TYPES, type RuleDraft } from './ruleDraft';

export interface LogicDraftStash {
  v: 1;
  mode: 'create' | 'edit';
  /** The rule id when editing, the provisional draft id when creating. */
  ruleId: string;
  baseSignature: string;
  baseEnabled: boolean;
  basePreserved: ConditionAction[];
  draft: RuleDraft;
  savedAt: number;
}

const MAX_RAW_LENGTH = 200_000;

const termSchema = z.object({
  fieldId: z.string().max(200),
  operator: z.string().max(50),
  value: z.union([z.string(), z.number(), z.array(z.string()).max(500)]).optional(),
});

const actionSchema = z.object({
  type: z.enum(ACTION_TYPES as [string, ...string[]]),
  fieldIds: z.array(z.string().max(200)).max(500),
  pageId: z.string().max(200),
});

const stashSchema = z.object({
  v: z.literal(1),
  mode: z.enum(['create', 'edit']),
  ruleId: z.string().min(1).max(200),
  baseSignature: z.string().max(MAX_RAW_LENGTH),
  baseEnabled: z.boolean(),
  basePreserved: z.array(z.record(z.string(), z.unknown())).max(20),
  draft: z.object({
    terms: z.array(termSchema).max(50),
    actions: z.array(actionSchema).max(50),
    combinator: z.enum(['any', 'all']),
  }),
  savedAt: z.number(),
});

const storageKey = (formId: string) => `dculus:logic-draft:${formId}`;

export function clearLogicDraft(formId: string): void {
  try {
    sessionStorage.removeItem(storageKey(formId));
  } catch {
    // best-effort only
  }
}

export function writeLogicDraft(formId: string, stash: LogicDraftStash): void {
  try {
    sessionStorage.setItem(storageKey(formId), JSON.stringify(stash));
  } catch {
    // best-effort only (private mode, quota)
  }
}

export function readLogicDraft(formId: string): LogicDraftStash | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(storageKey(formId));
  } catch {
    return null;
  }
  if (!raw) return null;

  if (raw.length > MAX_RAW_LENGTH) {
    clearLogicDraft(formId);
    return null;
  }
  try {
    const parsed = stashSchema.safeParse(JSON.parse(raw));
    if (parsed.success) {
      const data = parsed.data;
      return {
        ...data,
        basePreserved: data.basePreserved as unknown as ConditionAction[],
        draft: {
          combinator: data.draft.combinator,
          terms: data.draft.terms.map((term) => ({
            fieldId: term.fieldId,
            operator: term.operator as ConditionOperator,
            ...(term.value !== undefined ? { value: term.value } : {}),
          })),
          actions: data.draft.actions as unknown as RuleDraft['actions'],
        },
      };
    }
  } catch {
    // fall through to removal
  }
  clearLogicDraft(formId);
  return null;
}

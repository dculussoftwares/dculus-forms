/**
 * Frontend mirror of apps/backend/src/services/automation/types.ts — the graph JSON
 * shape persisted on Automation.graph. Kept as a separate copy (not a shared package
 * import) since the backend module lives outside form-app's build graph; the shapes
 * must stay in sync by hand.
 */

export type DelayUnit = 'minutes' | 'hours' | 'days';

export interface AutomationTriggerNodeData {
  triggerType: string;
  [key: string]: unknown;
}

export interface AutomationDelayNodeData {
  amount: number;
  unit: DelayUnit;
  [key: string]: unknown;
}

export type ConditionCombinator = 'AND' | 'OR';

/** Mirrors apps/backend/src/services/automation/types.ts ConditionRule — operator values
 * are the 22-operator FilterOperator set from responseFilterService (kept as `string` here,
 * not an enum, for the same reason the backend does: the field picker's available operators
 * are derived at runtime from the selected field's type). */
export interface ConditionRule {
  fieldId: string;
  operator: string;
  value?: string;
  values?: string[];
  dateRange?: { from?: string; to?: string };
  numberRange?: { min?: number; max?: number };
}

export interface AutomationConditionNodeData {
  rules: ConditionRule[];
  combinator: ConditionCombinator;
  [key: string]: unknown;
}

export interface AutomationActionNodeData {
  actionType: string;
  config: Record<string, any>;
  /** Optional friendly label shown on the node card; not required by the backend schema. */
  name?: string;
  [key: string]: unknown;
}

/** Schedule-trigger-only node: queries responses submitted since the automation's digest watermark. */
export interface AutomationDigestNodeData {
  /** Max responses to embed (default 50, hard cap 1000 — enforced server-side by graphValidator). */
  maxResponses?: number;
  /** Additional narrowing filters ANDed with the mandatory window filter. Only AND is
   * supported — the app's filter model has no nested AND/OR grouping, so a filterLogic toggle
   * here would be misleading given the window filter is always ANDed in regardless. */
  filters?: ConditionRule[];
  /** Opt-in backfill. Activation normally seeds the watermark to "now", so the first run only
   * picks up responses submitted after the automation went live; true makes the first run cover
   * the form's existing responses too. See backend automationService.setAutomationStatus. */
  includeExistingResponses?: boolean;
  [key: string]: unknown;
}

export type AutomationEndNodeData = Record<string, never>;

export type AutomationNodeType = 'trigger' | 'delay' | 'condition' | 'action' | 'digest' | 'end';

export type AutomationNodeData =
  | AutomationTriggerNodeData
  | AutomationDelayNodeData
  | AutomationConditionNodeData
  | AutomationActionNodeData
  | AutomationDigestNodeData
  | AutomationEndNodeData;

/** Reserved __digest* scalar keys a digest node merges into triggerData — see backend
 * graphValidator.ts DIGEST_SCALAR_MENTION_KEYS. The only fields a schedule automation's
 * condition rules / mention placeholders may reference downstream of a digest node. */
export const DIGEST_SCALAR_MENTION_KEYS = [
  '__digestCount',
  '__digestSince',
  '__digestUntil',
  '__digestTruncated',
] as const;

export interface AutomationEdgeData {
  [key: string]: unknown;
}

export interface ValidationErrorEntry {
  nodeId?: string;
  code: string;
  message: string;
}

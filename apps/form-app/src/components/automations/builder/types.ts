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

export type AutomationEndNodeData = Record<string, never>;

export type AutomationNodeType = 'trigger' | 'delay' | 'condition' | 'action' | 'end';

export type AutomationNodeData =
  | AutomationTriggerNodeData
  | AutomationDelayNodeData
  | AutomationConditionNodeData
  | AutomationActionNodeData
  | AutomationEndNodeData;

export interface AutomationEdgeData {
  [key: string]: unknown;
}

export interface ValidationErrorEntry {
  nodeId?: string;
  code: string;
  message: string;
}

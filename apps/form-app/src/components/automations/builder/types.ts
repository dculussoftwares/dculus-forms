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

export interface AutomationActionNodeData {
  actionType: string;
  config: Record<string, any>;
  /** Optional friendly label shown on the node card; not required by the backend schema. */
  name?: string;
  [key: string]: unknown;
}

export type AutomationEndNodeData = Record<string, never>;

export type AutomationNodeType = 'trigger' | 'delay' | 'action' | 'end';

export type AutomationNodeData =
  | AutomationTriggerNodeData
  | AutomationDelayNodeData
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

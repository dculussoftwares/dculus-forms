// Graph JSON shape stored on Automation.graph / AutomationRun.graphSnapshot.
// Mirrors docs/automations-strategy.md §4 (React Flow node/edge shape).

export type DelayUnit = 'minutes' | 'hours' | 'days';

export interface ConditionRule {
  fieldId: string;
  operator: string;
  value?: string;
  values?: string[];
  dateRange?: { from?: string; to?: string };
  numberRange?: { min?: number; max?: number };
}

export type ConditionCombinator = 'AND' | 'OR';

export interface AutomationTriggerNode {
  id: string;
  type: 'trigger';
  data: { triggerType: string };
}

export interface AutomationDelayNode {
  id: string;
  type: 'delay';
  data: { amount: number; unit: DelayUnit };
}

export interface AutomationConditionNode {
  id: string;
  type: 'condition';
  data: { rules: ConditionRule[]; combinator: ConditionCombinator };
}

export interface AutomationActionNode {
  id: string;
  type: 'action';
  data: { actionType: string; config: Record<string, any> };
}

/** Schedule-trigger-only node: queries responses since the automation's last completed run. */
export interface AutomationDigestNode {
  id: string;
  type: 'digest';
  data: {
    /** How many full response records to embed (default 50, hard cap 1000 — enforced by graphValidator). */
    maxResponses?: number;
    /**
     * Additional narrowing filters ANDed with the mandatory "since last completed run" window —
     * same ResponseFilter shape/engine the Responses page and condition nodes use. Only AND is
     * supported (matching the always-ANDed since-filter); the app's filter model has no nested
     * AND/OR grouping anywhere, so a filterLogic toggle here would be misleading.
     */
    filters?: ConditionRule[];
  };
}

export interface AutomationEndNode {
  id: string;
  type: 'end';
}

export type AutomationNode =
  | AutomationTriggerNode
  | AutomationDelayNode
  | AutomationConditionNode
  | AutomationActionNode
  | AutomationDigestNode
  | AutomationEndNode;

/** One response embedded in a digest node's output — a bounded subset of the full Response row. */
export interface DigestResponseSummary {
  id: string;
  submittedAt: string;
  data: Record<string, any>;
}

/**
 * Digest node output — written to AutomationStepRun.output and merged into both
 * AutomationRunContext.triggerData (reserved __digest* keys, the only channel buildPluginEvent
 * forwards to action handlers) and .stepOutputs[nodeId] (run-history UI parity only).
 */
export interface DigestNodeOutput {
  count: number;
  since: string;
  until: string;
  truncated: boolean;
  responses: DigestResponseSummary[];
}

export interface AutomationEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: 'true' | 'false';
}

export interface AutomationGraph {
  nodes: AutomationNode[];
  edges: AutomationEdge[];
}

export interface AutomationRunContext {
  /** Set by the testAutomation mutation (#195); the engine fast-forwards delay nodes when true. */
  test?: boolean;
  triggerData?: Record<string, any>;
  stepOutputs?: Record<string, any>;
  [key: string]: any;
}

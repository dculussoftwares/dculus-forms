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

export interface AutomationEndNode {
  id: string;
  type: 'end';
}

export type AutomationNode =
  | AutomationTriggerNode
  | AutomationDelayNode
  | AutomationConditionNode
  | AutomationActionNode
  | AutomationEndNode;

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

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

/** Schedule-trigger-only node: queries responses submitted since the automation's digest watermark. */
export interface AutomationDigestNode {
  id: string;
  type: 'digest';
  data: {
    /** How many full response records to embed (default 50, hard cap 1000 — enforced by graphValidator). */
    maxResponses?: number;
    /**
     * Additional narrowing filters ANDed with the mandatory "since the watermark" window —
     * same ResponseFilter shape/engine the Responses page and condition nodes use. Only AND is
     * supported (matching the always-ANDed since-filter); the app's filter model has no nested
     * AND/OR grouping anywhere, so a filterLogic toggle here would be misleading.
     */
    filters?: ConditionRule[];
    /**
     * Opt-in backfill. Activation normally seeds `Automation.lastDigestedAt` to the moment of
     * activation, so the first tick only picks up responses submitted *after* the automation went
     * live — otherwise activating a weekly digest on a form with thousands of existing responses
     * processes (and, with a per-response email action, emails) all of them on the first tick.
     * Setting this true leaves the watermark unset so the first run deliberately covers the
     * form's entire history instead.
     */
    includeExistingResponses?: boolean;
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
  /**
   * True on a test run only: the node ignored the watermark and took a small slice of the most
   * recent responses instead, so the tester sees realistic data without a test either processing
   * the whole pending batch or being reported an empty window on an automation that is up to date.
   */
  sampled?: boolean;
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
  /**
   * Set by the testAutomation mutation (#195). A test run: fast-forwards delay nodes, executes
   * action nodes regardless of the automation's DRAFT/PAUSED status, redirects email deliveries
   * to `testUserEmail` instead of real respondents, samples the digest node rather than draining
   * the pending window, and never advances the digest watermark.
   */
  test?: boolean;
  /**
   * Email address of the user who pressed "Test automation" — every email action in a test run is
   * redirected here. Absent (e.g. a run created before this existed) means the engine has nowhere
   * safe to send, so it skips the delivery rather than falling back to the real recipient.
   */
  testUserEmail?: string;
  triggerData?: Record<string, any>;
  stepOutputs?: Record<string, any>;
  [key: string]: any;
}

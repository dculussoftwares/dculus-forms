import { z } from 'zod';
import type { DelayUnit } from './types.js';

export interface GraphValidationError {
  nodeId?: string;
  code: string;
  message: string;
}

export interface GraphValidationResult {
  valid: boolean;
  errors: GraphValidationError[];
}

export interface ValidateAutomationGraphOptions {
  /** Registered plugin/action types, e.g. getAvailablePluginTypes() from plugins/core/registry.ts. */
  pluginTypes: string[];
  /**
   * The automation's triggerType (#201). When 'schedule', condition nodes and action configs
   * that reference response data are rejected — a cron-triggered run has no response
   * (responseId: null, empty triggerData), so those nodes could never behave correctly.
   */
  triggerType?: string;
}

/** Stable error codes surfaced to the builder UI (#197) for node-level badges. */
export const GRAPH_ERROR_CODES = {
  INVALID_GRAPH_SHAPE: 'INVALID_GRAPH_SHAPE',
  MISSING_TRIGGER: 'MISSING_TRIGGER',
  MULTIPLE_TRIGGERS: 'MULTIPLE_TRIGGERS',
  INVALID_TRIGGER_CONFIG: 'INVALID_TRIGGER_CONFIG',
  INVALID_EDGE: 'INVALID_EDGE',
  GRAPH_CYCLE: 'GRAPH_CYCLE',
  ORPHAN_NODE: 'ORPHAN_NODE',
  NO_REACHABLE_END: 'NO_REACHABLE_END',
  INVALID_CONDITION_BRANCH: 'INVALID_CONDITION_BRANCH',
  INVALID_CONDITION_CONFIG: 'INVALID_CONDITION_CONFIG',
  INVALID_DELAY: 'INVALID_DELAY',
  DELAY_LIMIT_EXCEEDED: 'DELAY_LIMIT_EXCEEDED',
  UNKNOWN_ACTION_TYPE: 'UNKNOWN_ACTION_TYPE',
  INVALID_ACTION_CONFIG: 'INVALID_ACTION_CONFIG',
  RESPONSE_DEPENDENT_ON_SCHEDULE: 'RESPONSE_DEPENDENT_ON_SCHEDULE',
  INVALID_DIGEST_CONFIG: 'INVALID_DIGEST_CONFIG',
  MULTIPLE_DIGEST_NODES: 'MULTIPLE_DIGEST_NODES',
  DIGEST_REQUIRES_SCHEDULE_TRIGGER: 'DIGEST_REQUIRES_SCHEDULE_TRIGGER',
  DIGEST_MUST_FOLLOW_TRIGGER: 'DIGEST_MUST_FOLLOW_TRIGGER',
  RESPONSE_FIELD_NOT_AVAILABLE_IN_DIGEST: 'RESPONSE_FIELD_NOT_AVAILABLE_IN_DIGEST',
} as const;

// Mirrors the 22-operator FilterOperator enum in graphql/schema.ts / responseFilterService.ts.
const FILTER_OPERATORS = [
  'EQUALS', 'NOT_EQUALS', 'CONTAINS', 'NOT_CONTAINS', 'STARTS_WITH', 'ENDS_WITH',
  'IN', 'NOT_IN', 'CONTAINS_ALL',
  'GREATER_THAN', 'GREATER_THAN_OR_EQUAL', 'LESS_THAN', 'LESS_THAN_OR_EQUAL', 'BETWEEN',
  'IS_EMPTY', 'IS_NOT_EMPTY',
  'DATE_EQUALS', 'DATE_BEFORE', 'DATE_AFTER', 'DATE_BETWEEN', 'DATE_TODAY', 'DATE_LAST_N_DAYS',
] as const;

const MAX_DELAY_DAYS = 30;
const DELAY_UNIT_TO_MINUTES: Record<DelayUnit, number> = {
  minutes: 1,
  hours: 60,
  days: 24 * 60,
};

const RawNodeSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['trigger', 'delay', 'condition', 'action', 'digest', 'end']),
  data: z.record(z.string(), z.any()).default({}),
});

const RawEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  sourceHandle: z.enum(['true', 'false']).optional(),
});

const RawGraphSchema = z.object({
  nodes: z.array(RawNodeSchema),
  edges: z.array(RawEdgeSchema),
});

type RawNode = z.infer<typeof RawNodeSchema>;
type RawEdge = z.infer<typeof RawEdgeSchema>;

const ConditionRuleSchema = z.object({
  fieldId: z.string().min(1),
  operator: z.enum(FILTER_OPERATORS),
  value: z.any().optional(),
  values: z.array(z.any()).optional(),
  dateRange: z.object({ from: z.string().optional(), to: z.string().optional() }).optional(),
  numberRange: z.object({ min: z.number().optional(), max: z.number().optional() }).optional(),
});

const TriggerDataSchema = z.object({ triggerType: z.string().min(1) });

const DelayDataSchema = z.object({
  amount: z.number().positive(),
  unit: z.enum(['minutes', 'hours', 'days']),
});

const ConditionDataSchema = z.object({
  rules: z.array(ConditionRuleSchema).min(1),
  combinator: z.enum(['AND', 'OR']),
});

const ActionDataSchema = z.object({
  actionType: z.string().min(1),
  config: z.record(z.string(), z.any()),
});

// Internal safety ceiling, not user-configurable — the "Filter Responses" node no longer
// exposes a "max responses" input (removed in favor of always processing everything that
// matches). This exists purely to bound a single execution's Postgres JSON payload / per-tick
// work, not as a feature users tune. Kept as a named constant (not just a literal inside
// DigestDataSchema) since engine.ts's fetchDigestResponses also needs it when clamping
// node.data.maxResponses, which now only matters for a manually-constructed graph (e.g. a
// direct API caller) — the builder UI never sets it.
export const DIGEST_RESPONSE_SAFETY_CEILING = 5000;

const DigestDataSchema = z.object({
  maxResponses: z.number().int().positive().max(DIGEST_RESPONSE_SAFETY_CEILING).optional(),
  // Same ConditionRule shape as condition nodes — ANDed at execution time (engine.ts) with the
  // window filter derived from Automation.lastDigestedAt. No filterLogic here: only AND is
  // supported, matching that since-filter (see AutomationDigestNode's data doc comment in
  // types.ts).
  filters: z.array(ConditionRuleSchema).optional(),
  // Opt-in backfill: activation seeds the watermark to "now" unless this is true, so the default
  // first tick covers only responses submitted after the automation went live rather than the
  // form's entire history (see automationService.setAutomationStatus).
  includeExistingResponses: z.boolean().optional(),
});

/**
 * Reserved __digest* scalar keys a digest node merges into triggerData (see engine.ts
 * mergeDigestIntoTriggerData) — the only fields a schedule automation's condition rules /
 * mention placeholders may reference downstream of a digest node. __digestResponses is
 * deliberately excluded: it's an array, and substituteMentions()/evaluateCondition() both do
 * flat scalar lookups, so exposing it as a mention would silently stringify to garbage rather
 * than error.
 */
const DIGEST_SCALAR_MENTION_KEYS = new Set([
  '__digestCount',
  '__digestSince',
  '__digestUntil',
  '__digestTruncated',
]);

// Per-type action config schemas — mirror what plugins/*/handler.ts reads from plugin.config.
// Types without a dedicated schema here (quiz-grading, google-sheets, ai-tagger, …) still get
// the generic ActionDataSchema.config check above; only well-known automation actions get
// stricter per-type validation. quiz-grading is deprecated (#303 — native quiz mode replaces
// it) and isn't even in AUTOMATION_ACTION_TYPES on the frontend, so it never reaches here in
// practice; the schema is left generic rather than adding dedicated validation for it.
const EmailActionConfigSchema = z
  .object({
    recipientEmail: z.email().optional(),
    recipientFieldId: z.string().optional(),
    recipientFieldLabel: z.string().optional(),
    subject: z.string().min(1),
    message: z.string().min(1),
    sendToSubmitter: z.boolean().optional(),
    attachPdfTemplateId: z.string().optional(),
    attachPdfTemplateName: z.string().optional(),
  })
  .refine((cfg) => Boolean(cfg.recipientEmail?.trim() || cfg.recipientFieldId), {
    message: 'Add a recipient — either a fixed email address or a form field to pull it from',
  });

const WebhookActionConfigSchema = z.object({
  url: z.url(),
  secret: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
});

// Slack has no backend plugin handler yet (packages/plugins/src/manifests/slack.ts marks it
// comingSoon); this schema documents the intended config shape ahead of that handler landing.
const SlackActionConfigSchema = z.object({
  webhookUrl: z.url(),
  channel: z.string().optional(),
  message: z.string().min(1),
});

const ACTION_CONFIG_SCHEMAS: Record<string, z.ZodTypeAny> = {
  email: EmailActionConfigSchema,
  webhook: WebhookActionConfigSchema,
  slack: SlackActionConfigSchema,
};

// Matches the same {{field-id}} placeholder syntax substituteMentions() resolves against
// response data (packages/utils/src/mentionSubstitution.ts) — any config string containing
// one is response-dependent regardless of action type.
const MENTION_PLACEHOLDER_REGEX = /\{\{[^}]{1,500}\}\}/;

/** Extracts every `{{key}}` mention key referenced in a string, e.g. "Hi {{name}}" -> ["name"]. */
function extractMentionKeys(value: string): string[] {
  const regex = /\{\{([^}]{1,500})\}\}/g;
  const keys: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(value)) !== null) {
    keys.push(match[1].trim());
  }
  return keys;
}

type ResponseDependency = 'recipientField' | 'sendToSubmitter' | 'mention' | null;

/**
 * Detects whether an action node's config references response data — either via a
 * `{{field-id}}` mention placeholder anywhere in its (possibly nested) values, or via the
 * email action's response-sourced recipient fields (recipientFieldId / sendToSubmitter). Returns
 * WHICH kind of dependency was found (or null) so the caller can pick the right error code/copy.
 *
 * `recipientFieldId` on a schedule automation with an upstream digest node is a special case
 * for the EMAIL action specifically: it signals PER-RESPONSE send mode (engine.ts's
 * handleActionNode + email/handler.ts's per-response loop) — the email action sends once for
 * EACH matched response, using that response's own field value as the recipient, rather than
 * once for the whole batch. In that mode a real `{{field-id}}` mention is also legitimate (each
 * send genuinely has one bound response to substitute against), so ALL mentions are allowed, not
 * just DIGEST_SCALAR_MENTION_KEYS. `actionType` is checked here to mirror engine.ts's own gate
 * exactly (`actionType === 'email' && config.recipientFieldId && ...`) — webhook/slack configs
 * don't declare a `recipientFieldId` field in their schemas, but ActionDataSchema's `config` is
 * an open `z.record()` that doesn't strip unknown keys, so without this check a stray
 * `recipientFieldId` on a non-email action's raw config would incorrectly pass validation as
 * "per-response mode" while the engine (which DOES check actionType) would never treat it that
 * way — a validator/runtime mismatch, not just a cosmetic gap.
 *
 * Without `recipientFieldId` (the static/aggregate case — one summary email for the whole
 * batch), only the four __digest* scalar keys are legitimate mentions, matching the plain
 * "no per-response context" semantics. `sendToSubmitter` has no handler implementation at all
 * (dead config field) and stays unconditionally flagged — there's no per-response mode for it
 * to enable. `allowDigestMentions` false (no digest node at all) keeps every prior behavior:
 * recipientFieldId, sendToSubmitter, and any mention are all response-dependent.
 */
function findResponseDependency(
  actionType: string,
  config: Record<string, any>,
  allowDigestMentions: boolean
): ResponseDependency {
  const isPerResponseMode = allowDigestMentions && actionType === 'email' && Boolean(config.recipientFieldId);

  if (config.recipientFieldId) return isPerResponseMode ? null : 'recipientField';
  if (config.sendToSubmitter) return 'sendToSubmitter';

  const scan = (value: any): boolean => {
    if (typeof value === 'string') {
      if (!MENTION_PLACEHOLDER_REGEX.test(value)) return false;
      if (isPerResponseMode) return false;
      if (!allowDigestMentions) return true;
      return extractMentionKeys(value).some((key) => !DIGEST_SCALAR_MENTION_KEYS.has(key));
    }
    if (Array.isArray(value)) return value.some(scan);
    if (value && typeof value === 'object') return Object.values(value).some(scan);
    return false;
  };

  return scan(config) ? 'mention' : null;
}

// Friendly labels for the trigger/delay/condition/action-config field names referenced by the
// schemas above. Falls back to a space-separated version of the raw camelCase key for any field
// added later without an entry here, so new plugin config fields still degrade gracefully rather
// than crashing or reverting to raw JSON.
const FIELD_LABELS: Record<string, string> = {
  triggerType: 'Trigger type',
  actionType: 'Action type',
  amount: 'Wait time',
  unit: 'Time unit',
  rules: 'Condition rules',
  combinator: 'Match type',
  fieldId: 'Field',
  operator: 'Comparison',
  recipientEmail: 'Recipient email',
  recipientFieldId: 'Recipient field',
  subject: 'Subject',
  message: 'Message',
  url: 'Webhook URL',
  webhookUrl: 'Slack webhook URL',
  channel: 'Slack channel',
  maxResponses: 'Max responses',
};

function fieldLabel(path: PropertyKey[]): string | null {
  const key = path.find((segment) => typeof segment === 'string');
  if (typeof key !== 'string') return null;
  return FIELD_LABELS[key] ?? key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
}

/** Turns one ZodIssue into a plain-English sentence fragment instead of its raw code/path/message shape. */
function humanizeZodIssue(issue: z.ZodError['issues'][number]): string {
  const label = fieldLabel(issue.path);

  // A schema-level .refine() (e.g. the email action's "needs a recipient" rule) attaches to the
  // root path and already carries a hand-written, user-facing message — use it verbatim.
  if (!label) return issue.message;

  if (issue.code === 'invalid_type') return `${label} is required`;
  if (issue.code === 'too_small') {
    const origin = (issue as { origin?: string }).origin;
    if (origin === 'number') return `${label} must be greater than 0`;
    if (origin === 'array') return `Add at least one item to ${label.toLowerCase()}`;
    return `${label} is required`;
  }
  if (issue.code === 'invalid_format') {
    const format = (issue as { format?: string }).format;
    if (format === 'email') return `${label} must be a valid email address`;
    if (format === 'url') return `${label} must be a valid URL`;
  }
  return `${label}: ${issue.message}`;
}

/**
 * Renders a ZodError as a human-readable sentence list instead of the raw JSON-stringified
 * issues array `ZodError.message` produces — used everywhere a schema failure is surfaced in a
 * GraphValidationError, so every node/action type (not just email) gets a readable message on
 * the canvas tooltip.
 */
function formatZodError(error: z.ZodError): string {
  return error.issues.map(humanizeZodIssue).join('; ');
}

function detectCycle(nodeIds: string[], adjacency: Map<string, string[]>): string[] {
  const UNVISITED = 0;
  const IN_PROGRESS = 1;
  const DONE = 2;
  const state = new Map<string, number>(nodeIds.map((id) => [id, UNVISITED]));
  const stack: string[] = [];

  function visit(nodeId: string): string[] | null {
    state.set(nodeId, IN_PROGRESS);
    stack.push(nodeId);
    for (const next of adjacency.get(nodeId) ?? []) {
      const nextState = state.get(next);
      if (nextState === IN_PROGRESS) {
        const cycleStart = stack.indexOf(next);
        return [...stack.slice(cycleStart), next];
      }
      if (nextState === UNVISITED) {
        const found = visit(next);
        if (found) return found;
      }
    }
    stack.pop();
    state.set(nodeId, DONE);
    return null;
  }

  for (const id of nodeIds) {
    if (state.get(id) === UNVISITED) {
      const found = visit(id);
      if (found) return found;
    }
  }
  return [];
}

function bfsReachable(startId: string, adjacency: Map<string, string[]>): Set<string> {
  const visited = new Set<string>([startId]);
  const queue = [startId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of adjacency.get(current) ?? []) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return visited;
}

/**
 * Longest (worst-case) cumulative delay in minutes across any path from the trigger,
 * assuming the reachable subgraph is acyclic (callers must skip this when a cycle exists).
 */
function computeMaxPathDelayMinutes(
  reachableIds: Set<string>,
  nodesById: Map<string, RawNode>,
  edges: RawEdge[]
): number {
  const predecessors = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  for (const id of reachableIds) {
    predecessors.set(id, []);
    inDegree.set(id, 0);
    adjacency.set(id, []);
  }
  for (const edge of edges) {
    if (!reachableIds.has(edge.source) || !reachableIds.has(edge.target)) continue;
    predecessors.get(edge.target)!.push(edge.source);
    adjacency.get(edge.source)!.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const id of reachableIds) if ((inDegree.get(id) ?? 0) === 0) queue.push(id);

  const order: string[] = [];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    order.push(nodeId);
    for (const next of adjacency.get(nodeId) ?? []) {
      inDegree.set(next, (inDegree.get(next) ?? 0) - 1);
      if (inDegree.get(next) === 0) queue.push(next);
    }
  }

  const dp = new Map<string, number>();
  for (const nodeId of order) {
    const preds = predecessors.get(nodeId) ?? [];
    const maxIncoming = preds.length === 0 ? 0 : Math.max(...preds.map((p) => dp.get(p) ?? 0));
    const node = nodesById.get(nodeId);
    const delayMinutes =
      node?.type === 'delay' &&
      typeof node.data?.amount === 'number' &&
      typeof node.data?.unit === 'string'
        ? node.data.amount * (DELAY_UNIT_TO_MINUTES[node.data.unit as DelayUnit] ?? 0)
        : 0;
    dp.set(nodeId, maxIncoming + delayMinutes);
  }

  return Math.max(0, ...Array.from(dp.values()));
}

/**
 * Validates an automation graph (JSON shape stored on Automation.graph / AutomationRun.graphSnapshot)
 * against every structural and per-node-type rule from issue #193. Pure and injectable: pluginTypes
 * is passed in (e.g. getAvailablePluginTypes()) rather than imported, so this stays unit-testable
 * without the plugin registry's runtime registration state.
 */
export function validateAutomationGraph(
  graph: unknown,
  options: ValidateAutomationGraphOptions
): GraphValidationResult {
  const parsed = RawGraphSchema.safeParse(graph);
  if (!parsed.success) {
    return {
      valid: false,
      errors: [
        {
          code: GRAPH_ERROR_CODES.INVALID_GRAPH_SHAPE,
          message: "This automation's saved structure looks corrupted and can't be checked. Try reloading the page — if it keeps happening, contact support.",
        },
      ],
    };
  }

  const { nodes, edges } = parsed.data;
  const errors: GraphValidationError[] = [];
  const nodeIds = new Set(nodes.map((n) => n.id));
  const nodesById = new Map(nodes.map((n) => [n.id, n]));

  const triggerNodes = nodes.filter((n) => n.type === 'trigger');
  const delayNodes = nodes.filter((n) => n.type === 'delay');
  const conditionNodes = nodes.filter((n) => n.type === 'condition');
  const actionNodes = nodes.filter((n) => n.type === 'action');
  const digestNodes = nodes.filter((n) => n.type === 'digest');
  const hasDigestNode = digestNodes.length > 0;

  if (triggerNodes.length === 0) {
    errors.push({
      code: GRAPH_ERROR_CODES.MISSING_TRIGGER,
      message: 'This automation needs a starting trigger — add one to begin the flow.',
    });
  } else if (triggerNodes.length > 1) {
    errors.push({
      code: GRAPH_ERROR_CODES.MULTIPLE_TRIGGERS,
      message: 'This automation has more than one starting trigger — remove all but one.',
    });
  }

  for (const node of triggerNodes) {
    const result = TriggerDataSchema.safeParse(node.data);
    if (!result.success) {
      errors.push({
        nodeId: node.id,
        code: GRAPH_ERROR_CODES.INVALID_TRIGGER_CONFIG,
        message: `This trigger isn't fully set up yet: ${formatZodError(result.error)}`,
      });
    }
  }

  for (const node of delayNodes) {
    const result = DelayDataSchema.safeParse(node.data);
    if (!result.success) {
      errors.push({
        nodeId: node.id,
        code: GRAPH_ERROR_CODES.INVALID_DELAY,
        message: `This delay step needs a wait time greater than zero and a unit (minutes, hours, or days): ${formatZodError(result.error)}`,
      });
    }
  }

  for (const node of conditionNodes) {
    const result = ConditionDataSchema.safeParse(node.data);
    if (!result.success) {
      errors.push({
        nodeId: node.id,
        code: GRAPH_ERROR_CODES.INVALID_CONDITION_CONFIG,
        message: `This condition step needs at least one complete rule (a field, a comparison, and a value): ${formatZodError(result.error)}`,
      });
      continue;
    }

    // Condition rules always evaluate a response field (ConditionDataSchema requires >=1 rule
    // with a fieldId) — a schedule trigger has no single response, so a condition node is only
    // valid there when a digest node exists upstream AND every rule reads one of the digest's
    // own scalar pseudo-fields (__digestCount etc.) rather than a real form field.
    if (options.triggerType === 'schedule') {
      if (!hasDigestNode) {
        errors.push({
          nodeId: node.id,
          code: GRAPH_ERROR_CODES.RESPONSE_DEPENDENT_ON_SCHEDULE,
          // Mirrors the plain-language phrasing already used in the builder UI's schedule-trigger
          // hint (automations.json "builder.panel.trigger.descriptionSchedule") — no node IDs or
          // internal field names (fieldId, cron), since the tooltip is already anchored to this
          // exact node on the canvas.
          message: `This step checks an answer from a submission, but this automation doesn't have a triggering response — it runs on a schedule, so steps can't reference response data.`,
        });
      } else if (result.data.rules.some((rule) => !DIGEST_SCALAR_MENTION_KEYS.has(rule.fieldId))) {
        errors.push({
          nodeId: node.id,
          code: GRAPH_ERROR_CODES.RESPONSE_FIELD_NOT_AVAILABLE_IN_DIGEST,
          message: `This step checks a specific submission's field, but this schedule automation only has a batch of new responses (from the Digest step), not a single one — check the digest summary instead (like the number of new responses).`,
        });
      }
    }
  }

  for (const node of actionNodes) {
    const result = ActionDataSchema.safeParse(node.data);
    if (!result.success) {
      errors.push({
        nodeId: node.id,
        code: GRAPH_ERROR_CODES.INVALID_ACTION_CONFIG,
        message: `This step isn't fully set up yet: ${formatZodError(result.error)}`,
      });
      continue;
    }

    const { actionType, config } = result.data;
    if (!options.pluginTypes.includes(actionType)) {
      errors.push({
        nodeId: node.id,
        code: GRAPH_ERROR_CODES.UNKNOWN_ACTION_TYPE,
        message: `This step's action type ("${actionType}") isn't available anymore — remove this step and choose a different action.`,
      });
      continue;
    }

    const configSchema = ACTION_CONFIG_SCHEMAS[actionType];
    if (configSchema) {
      const configResult = configSchema.safeParse(config);
      if (!configResult.success) {
        errors.push({
          nodeId: node.id,
          code: GRAPH_ERROR_CODES.INVALID_ACTION_CONFIG,
          message: `This ${actionType} step has missing or invalid details: ${formatZodError(configResult.error)}`,
        });
      }
    }

    if (options.triggerType === 'schedule') {
      const dependency = findResponseDependency(actionType, config, hasDigestNode);
      if (dependency === 'mention' && hasDigestNode) {
        errors.push({
          nodeId: node.id,
          code: GRAPH_ERROR_CODES.RESPONSE_FIELD_NOT_AVAILABLE_IN_DIGEST,
          message: `This step references a specific submission's field, but this schedule automation only has a batch of new responses (from the Digest step), not a single one — reference the digest summary instead (like the number of new responses).`,
        });
      } else if (dependency) {
        errors.push({
          nodeId: node.id,
          code: GRAPH_ERROR_CODES.RESPONSE_DEPENDENT_ON_SCHEDULE,
          message: `This step is set up to use an answer from a submission (e.g. a recipient pulled from a field, or "send to submitter"), but this automation doesn't have a triggering response — it runs on a schedule, so steps can't reference response data.`,
        });
      }
    }
  }

  if (digestNodes.length > 1) {
    errors.push({
      code: GRAPH_ERROR_CODES.MULTIPLE_DIGEST_NODES,
      message: 'This automation has more than one Digest step — only one is allowed. Remove the extra one(s).',
    });
  }

  for (const node of digestNodes) {
    const result = DigestDataSchema.safeParse(node.data);
    if (!result.success) {
      errors.push({
        nodeId: node.id,
        code: GRAPH_ERROR_CODES.INVALID_DIGEST_CONFIG,
        message: `This digest step's settings aren't valid: ${formatZodError(result.error)}`,
      });
      continue;
    }

    if (options.triggerType !== 'schedule') {
      errors.push({
        nodeId: node.id,
        code: GRAPH_ERROR_CODES.DIGEST_REQUIRES_SCHEDULE_TRIGGER,
        message: `A digest step only makes sense on a schedule trigger — it collects responses since the last scheduled run, which has no meaning on this trigger type.`,
      });
    }

    // "Since last run" only has one unambiguous meaning if nothing can execute between the
    // schedule tick firing and the digest querying — enforced by requiring the digest to be the
    // trigger's sole, immediate successor (a delay node before it is out of scope for v1).
    if (triggerNodes.length === 1) {
      const triggerOutgoing = edges.filter((e) => e.source === triggerNodes[0].id);
      const isImmediateSuccessor =
        triggerOutgoing.length === 1 && triggerOutgoing[0].target === node.id;
      if (!isImmediateSuccessor) {
        errors.push({
          nodeId: node.id,
          code: GRAPH_ERROR_CODES.DIGEST_MUST_FOLLOW_TRIGGER,
          message: `A digest step must come directly after the trigger, with nothing else in between — this keeps "since last run" accurate.`,
        });
      }
    }
  }

  const validEdges: RawEdge[] = [];
  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      errors.push({
        code: GRAPH_ERROR_CODES.INVALID_EDGE,
        message: 'Two steps in this automation are connected incorrectly — try reconnecting them or removing the connection.',
      });
      continue;
    }
    validEdges.push(edge);
  }

  for (const node of conditionNodes) {
    const outgoing = validEdges.filter((e) => e.source === node.id);
    const trueEdges = outgoing.filter((e) => e.sourceHandle === 'true');
    const falseEdges = outgoing.filter((e) => e.sourceHandle === 'false');
    const untaggedEdges = outgoing.filter((e) => e.sourceHandle === undefined);
    if (trueEdges.length > 1 || falseEdges.length > 1 || untaggedEdges.length > 0) {
      errors.push({
        nodeId: node.id,
        code: GRAPH_ERROR_CODES.INVALID_CONDITION_BRANCH,
        message: "This condition step has too many outgoing paths — it should have at most one \"Yes\" path and one \"No\" path, and every path must be labeled.",
      });
    }
  }

  const adjacency = new Map<string, string[]>();
  for (const node of nodes) adjacency.set(node.id, []);
  for (const edge of validEdges) adjacency.get(edge.source)?.push(edge.target);

  const cycleNodeIds = detectCycle(
    nodes.map((n) => n.id),
    adjacency
  );
  if (cycleNodeIds.length > 0) {
    errors.push({
      code: GRAPH_ERROR_CODES.GRAPH_CYCLE,
      message: 'This automation loops back on itself, which would run forever — remove the connection that leads back to an earlier step.',
    });
  }

  if (triggerNodes.length === 1) {
    const triggerId = triggerNodes[0].id;
    const reachable = bfsReachable(triggerId, adjacency);

    const orphanNodes = nodes.filter((n) => !reachable.has(n.id));
    for (const orphan of orphanNodes) {
      errors.push({
        nodeId: orphan.id,
        code: GRAPH_ERROR_CODES.ORPHAN_NODE,
        message: "This step isn't connected to the flow starting from the trigger — connect it to the automation or remove it.",
      });
    }

    // A node with no successor is an implicit end (the chosen convention — see #193).
    // On a purely cyclic reachable subgraph every node has >=1 outgoing edge, so this
    // is the only way "no sink exists" can happen; it's reported alongside GRAPH_CYCLE
    // rather than gated behind it, since both BFS and the Kahn's-algorithm delay walk
    // below terminate safely regardless of cycles (cyclic nodes just never get visited).
    const hasReachableEnd = Array.from(reachable).some(
      (id) => (adjacency.get(id)?.length ?? 0) === 0
    );
    if (!hasReachableEnd) {
      errors.push({
        code: GRAPH_ERROR_CODES.NO_REACHABLE_END,
        message: "This automation's flow never ends — every path from the trigger should eventually reach a step with nothing after it.",
      });
    }

    const maxDelayMinutes = computeMaxPathDelayMinutes(reachable, nodesById, validEdges);
    if (maxDelayMinutes > MAX_DELAY_DAYS * 24 * 60) {
      errors.push({
        code: GRAPH_ERROR_CODES.DELAY_LIMIT_EXCEEDED,
        message: `One of the paths in this automation waits more than ${MAX_DELAY_DAYS} days in total — shorten the delays so it finishes sooner.`,
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

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
  type: z.enum(['trigger', 'delay', 'condition', 'action', 'end']),
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

// Per-type action config schemas — mirror what plugins/*/handler.ts reads from plugin.config.
// Types without a dedicated schema here (quiz-grading, google-sheets, ai-tagger, …) still get
// the generic ActionDataSchema.config check above; only well-known automation actions get
// stricter per-type validation.
const EmailActionConfigSchema = z
  .object({
    recipientEmail: z.string().email().optional(),
    recipientFieldId: z.string().optional(),
    recipientFieldLabel: z.string().optional(),
    subject: z.string().min(1),
    message: z.string().min(1),
    sendToSubmitter: z.boolean().optional(),
    attachPdfTemplateId: z.string().optional(),
    attachPdfTemplateName: z.string().optional(),
  })
  .refine((cfg) => Boolean(cfg.recipientEmail?.trim() || cfg.recipientFieldId), {
    message: 'Email action requires recipientEmail or recipientFieldId',
  });

const WebhookActionConfigSchema = z.object({
  url: z.string().url(),
  secret: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
});

// Slack has no backend plugin handler yet (packages/plugins/src/manifests/slack.ts marks it
// comingSoon); this schema documents the intended config shape ahead of that handler landing.
const SlackActionConfigSchema = z.object({
  webhookUrl: z.string().url(),
  channel: z.string().optional(),
  message: z.string().min(1),
});

const ACTION_CONFIG_SCHEMAS: Record<string, z.ZodTypeAny> = {
  email: EmailActionConfigSchema,
  webhook: WebhookActionConfigSchema,
  slack: SlackActionConfigSchema,
};

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
          message: `Automation graph does not match the expected shape: ${parsed.error.message}`,
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

  if (triggerNodes.length === 0) {
    errors.push({
      code: GRAPH_ERROR_CODES.MISSING_TRIGGER,
      message: 'Automation graph must have exactly one trigger node',
    });
  } else if (triggerNodes.length > 1) {
    errors.push({
      code: GRAPH_ERROR_CODES.MULTIPLE_TRIGGERS,
      message: 'Automation graph must have exactly one trigger node',
    });
  }

  for (const node of triggerNodes) {
    const result = TriggerDataSchema.safeParse(node.data);
    if (!result.success) {
      errors.push({
        nodeId: node.id,
        code: GRAPH_ERROR_CODES.INVALID_TRIGGER_CONFIG,
        message: `Trigger node ${node.id} has invalid data: ${result.error.message}`,
      });
    }
  }

  for (const node of delayNodes) {
    const result = DelayDataSchema.safeParse(node.data);
    if (!result.success) {
      errors.push({
        nodeId: node.id,
        code: GRAPH_ERROR_CODES.INVALID_DELAY,
        message: `Delay node ${node.id} must have a positive amount and unit in minutes|hours|days: ${result.error.message}`,
      });
    }
  }

  for (const node of conditionNodes) {
    const result = ConditionDataSchema.safeParse(node.data);
    if (!result.success) {
      errors.push({
        nodeId: node.id,
        code: GRAPH_ERROR_CODES.INVALID_CONDITION_CONFIG,
        message: `Condition node ${node.id} must have non-empty rules with valid operators and an AND|OR combinator: ${result.error.message}`,
      });
    }
  }

  for (const node of actionNodes) {
    const result = ActionDataSchema.safeParse(node.data);
    if (!result.success) {
      errors.push({
        nodeId: node.id,
        code: GRAPH_ERROR_CODES.INVALID_ACTION_CONFIG,
        message: `Action node ${node.id} has invalid data: ${result.error.message}`,
      });
      continue;
    }

    const { actionType, config } = result.data;
    if (!options.pluginTypes.includes(actionType)) {
      errors.push({
        nodeId: node.id,
        code: GRAPH_ERROR_CODES.UNKNOWN_ACTION_TYPE,
        message: `Action node ${node.id} references unregistered action type: ${actionType}`,
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
          message: `Action node ${node.id} (${actionType}) has an invalid config: ${configResult.error.message}`,
        });
      }
    }
  }

  const validEdges: RawEdge[] = [];
  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      errors.push({
        code: GRAPH_ERROR_CODES.INVALID_EDGE,
        message: `Edge ${edge.id} references a non-existent node (source: ${edge.source}, target: ${edge.target})`,
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
        message: `Condition node ${node.id} must have at most one 'true' and one 'false' outgoing edge, and no untagged edges`,
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
      message: `Automation graph contains a cycle: ${cycleNodeIds.join(' -> ')}`,
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
        message: `Node ${orphan.id} is unreachable from the trigger`,
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
        message: 'Automation graph has no reachable end (a node with no outgoing edges)',
      });
    }

    const maxDelayMinutes = computeMaxPathDelayMinutes(reachable, nodesById, validEdges);
    if (maxDelayMinutes > MAX_DELAY_DAYS * 24 * 60) {
      errors.push({
        code: GRAPH_ERROR_CODES.DELAY_LIMIT_EXCEEDED,
        message: `Total delay along at least one path exceeds ${MAX_DELAY_DAYS} days`,
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

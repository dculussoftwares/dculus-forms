import { describe, it, expect } from 'vitest';
import { validateAutomationGraph, GRAPH_ERROR_CODES } from '../graphValidator.js';
import type { AutomationGraph } from '../types.js';

const PLUGIN_TYPES = ['email', 'webhook', 'slack', 'quiz-grading'];

function validate(graph: unknown, pluginTypes: string[] = PLUGIN_TYPES) {
  return validateAutomationGraph(graph, { pluginTypes });
}

function codesOf(result: ReturnType<typeof validate>): string[] {
  return result.errors.map((e) => e.code);
}

const validGraph: AutomationGraph = {
  nodes: [
    { id: 'trigger-1', type: 'trigger', data: { triggerType: 'form.submitted' } },
    { id: 'delay-1', type: 'delay', data: { amount: 1, unit: 'hours' } },
    {
      id: 'condition-1',
      type: 'condition',
      data: {
        rules: [{ fieldId: 'age', operator: 'GREATER_THAN', value: '18' }],
        combinator: 'AND',
      },
    },
    {
      id: 'action-email',
      type: 'action',
      data: {
        actionType: 'email',
        config: { recipientEmail: 'a@b.com', subject: 'Hi', message: 'Hello' },
      },
    },
    { id: 'end-1', type: 'end' },
  ],
  edges: [
    { id: 'e1', source: 'trigger-1', target: 'delay-1' },
    { id: 'e2', source: 'delay-1', target: 'condition-1' },
    { id: 'e3', source: 'condition-1', target: 'action-email', sourceHandle: 'true' },
    { id: 'e4', source: 'condition-1', target: 'end-1', sourceHandle: 'false' },
    { id: 'e5', source: 'action-email', target: 'end-1' },
  ],
};

describe('validateAutomationGraph', () => {
  it('accepts a well-formed graph with no errors', () => {
    const result = validate(validGraph);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('INVALID_GRAPH_SHAPE: rejects malformed graph structure', () => {
    const result = validate({ nodes: 'not-an-array', edges: [] });
    expect(result.valid).toBe(false);
    expect(codesOf(result)).toEqual([GRAPH_ERROR_CODES.INVALID_GRAPH_SHAPE]);
  });

  it('INVALID_GRAPH_SHAPE: rejects an unknown node type', () => {
    const result = validate({
      nodes: [{ id: 'n1', type: 'not-a-real-type', data: {} }],
      edges: [],
    });
    expect(codesOf(result)).toContain(GRAPH_ERROR_CODES.INVALID_GRAPH_SHAPE);
  });

  it('MISSING_TRIGGER: rejects a graph with zero trigger nodes', () => {
    const graph: AutomationGraph = { nodes: [{ id: 'end-1', type: 'end' }], edges: [] };
    const result = validate(graph);
    expect(codesOf(result)).toContain(GRAPH_ERROR_CODES.MISSING_TRIGGER);
  });

  it('MULTIPLE_TRIGGERS: rejects a graph with more than one trigger node', () => {
    const graph: AutomationGraph = {
      nodes: [
        { id: 't1', type: 'trigger', data: { triggerType: 'form.submitted' } },
        { id: 't2', type: 'trigger', data: { triggerType: 'form.submitted' } },
        { id: 'end-1', type: 'end' },
      ],
      edges: [
        { id: 'e1', source: 't1', target: 'end-1' },
        { id: 'e2', source: 't2', target: 'end-1' },
      ],
    };
    const result = validate(graph);
    expect(codesOf(result)).toContain(GRAPH_ERROR_CODES.MULTIPLE_TRIGGERS);
  });

  it('INVALID_TRIGGER_CONFIG: rejects a trigger node missing triggerType', () => {
    const graph: AutomationGraph = {
      nodes: [
        { id: 't1', type: 'trigger', data: {} as any },
        { id: 'end-1', type: 'end' },
      ],
      edges: [{ id: 'e1', source: 't1', target: 'end-1' }],
    };
    const result = validate(graph);
    expect(codesOf(result)).toContain(GRAPH_ERROR_CODES.INVALID_TRIGGER_CONFIG);
  });

  it('INVALID_EDGE: rejects an edge referencing a non-existent node', () => {
    const graph: AutomationGraph = {
      nodes: [
        { id: 't1', type: 'trigger', data: { triggerType: 'form.submitted' } },
        { id: 'end-1', type: 'end' },
      ],
      edges: [{ id: 'e1', source: 't1', target: 'does-not-exist' }],
    };
    const result = validate(graph);
    expect(codesOf(result)).toContain(GRAPH_ERROR_CODES.INVALID_EDGE);
  });

  it('GRAPH_CYCLE: rejects a graph containing a cycle', () => {
    const graph: AutomationGraph = {
      nodes: [
        { id: 't1', type: 'trigger', data: { triggerType: 'form.submitted' } },
        { id: 'd1', type: 'delay', data: { amount: 1, unit: 'minutes' } },
        { id: 'd2', type: 'delay', data: { amount: 1, unit: 'minutes' } },
      ],
      edges: [
        { id: 'e1', source: 't1', target: 'd1' },
        { id: 'e2', source: 'd1', target: 'd2' },
        { id: 'e3', source: 'd2', target: 'd1' },
      ],
    };
    const result = validate(graph);
    expect(codesOf(result)).toContain(GRAPH_ERROR_CODES.GRAPH_CYCLE);
  });

  it('ORPHAN_NODE: rejects a node unreachable from the trigger', () => {
    const graph: AutomationGraph = {
      nodes: [
        { id: 't1', type: 'trigger', data: { triggerType: 'form.submitted' } },
        { id: 'end-1', type: 'end' },
        { id: 'orphan', type: 'end' },
      ],
      edges: [{ id: 'e1', source: 't1', target: 'end-1' }],
    };
    const result = validate(graph);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ nodeId: 'orphan', code: GRAPH_ERROR_CODES.ORPHAN_NODE })
    );
  });

  it('NO_REACHABLE_END: rejects a graph where every reachable node has a successor (pure cycle)', () => {
    // With a valid (acyclic) reachable subgraph a sink always exists by pigeonhole, so the
    // only way to have zero reachable nodes with no successor is a cycle in the reachable
    // set itself — this co-occurs with GRAPH_CYCLE rather than being mutually exclusive.
    const graph: AutomationGraph = {
      nodes: [
        { id: 't1', type: 'trigger', data: { triggerType: 'form.submitted' } },
        { id: 'd1', type: 'delay', data: { amount: 1, unit: 'minutes' } },
        { id: 'd2', type: 'delay', data: { amount: 1, unit: 'minutes' } },
      ],
      edges: [
        { id: 'e1', source: 't1', target: 'd1' },
        { id: 'e2', source: 'd1', target: 'd2' },
        { id: 'e3', source: 'd2', target: 'd1' },
      ],
    };
    const result = validate(graph);
    expect(codesOf(result)).toContain(GRAPH_ERROR_CODES.GRAPH_CYCLE);
    expect(codesOf(result)).toContain(GRAPH_ERROR_CODES.NO_REACHABLE_END);
  });

  it('INVALID_CONDITION_BRANCH: rejects a condition node with two true edges', () => {
    const graph: AutomationGraph = {
      nodes: [
        { id: 't1', type: 'trigger', data: { triggerType: 'form.submitted' } },
        {
          id: 'c1',
          type: 'condition',
          data: { rules: [{ fieldId: 'f', operator: 'IS_EMPTY' }], combinator: 'AND' },
        },
        { id: 'end-1', type: 'end' },
        { id: 'end-2', type: 'end' },
      ],
      edges: [
        { id: 'e1', source: 't1', target: 'c1' },
        { id: 'e2', source: 'c1', target: 'end-1', sourceHandle: 'true' },
        { id: 'e3', source: 'c1', target: 'end-2', sourceHandle: 'true' },
      ],
    };
    const result = validate(graph);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ nodeId: 'c1', code: GRAPH_ERROR_CODES.INVALID_CONDITION_BRANCH })
    );
  });

  it('INVALID_CONDITION_BRANCH: rejects a condition node with an untagged outgoing edge', () => {
    const graph: AutomationGraph = {
      nodes: [
        { id: 't1', type: 'trigger', data: { triggerType: 'form.submitted' } },
        {
          id: 'c1',
          type: 'condition',
          data: { rules: [{ fieldId: 'f', operator: 'IS_EMPTY' }], combinator: 'AND' },
        },
        { id: 'end-1', type: 'end' },
      ],
      edges: [
        { id: 'e1', source: 't1', target: 'c1' },
        { id: 'e2', source: 'c1', target: 'end-1' },
      ],
    };
    const result = validate(graph);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ nodeId: 'c1', code: GRAPH_ERROR_CODES.INVALID_CONDITION_BRANCH })
    );
  });

  it('INVALID_CONDITION_CONFIG: rejects a condition node with empty rules', () => {
    const graph: AutomationGraph = {
      nodes: [
        { id: 't1', type: 'trigger', data: { triggerType: 'form.submitted' } },
        { id: 'c1', type: 'condition', data: { rules: [], combinator: 'AND' } },
        { id: 'end-1', type: 'end' },
      ],
      edges: [
        { id: 'e1', source: 't1', target: 'c1' },
        { id: 'e2', source: 'c1', target: 'end-1', sourceHandle: 'true' },
      ],
    };
    const result = validate(graph);
    expect(codesOf(result)).toContain(GRAPH_ERROR_CODES.INVALID_CONDITION_CONFIG);
  });

  it('INVALID_CONDITION_CONFIG: rejects a condition node with an unknown operator', () => {
    const graph: AutomationGraph = {
      nodes: [
        { id: 't1', type: 'trigger', data: { triggerType: 'form.submitted' } },
        {
          id: 'c1',
          type: 'condition',
          data: { rules: [{ fieldId: 'f', operator: 'NOT_A_REAL_OP' }], combinator: 'AND' },
        },
        { id: 'end-1', type: 'end' },
      ],
      edges: [
        { id: 'e1', source: 't1', target: 'c1' },
        { id: 'e2', source: 'c1', target: 'end-1', sourceHandle: 'true' },
      ],
    };
    const result = validate(graph);
    expect(codesOf(result)).toContain(GRAPH_ERROR_CODES.INVALID_CONDITION_CONFIG);
  });

  it('INVALID_DELAY: rejects a delay node with a non-positive amount', () => {
    const graph: AutomationGraph = {
      nodes: [
        { id: 't1', type: 'trigger', data: { triggerType: 'form.submitted' } },
        { id: 'd1', type: 'delay', data: { amount: 0, unit: 'minutes' } },
        { id: 'end-1', type: 'end' },
      ],
      edges: [
        { id: 'e1', source: 't1', target: 'd1' },
        { id: 'e2', source: 'd1', target: 'end-1' },
      ],
    };
    const result = validate(graph);
    expect(codesOf(result)).toContain(GRAPH_ERROR_CODES.INVALID_DELAY);
  });

  it('INVALID_DELAY: rejects a delay node with an unsupported unit', () => {
    const graph: AutomationGraph = {
      nodes: [
        { id: 't1', type: 'trigger', data: { triggerType: 'form.submitted' } },
        { id: 'd1', type: 'delay', data: { amount: 5, unit: 'weeks' } as any },
        { id: 'end-1', type: 'end' },
      ],
      edges: [
        { id: 'e1', source: 't1', target: 'd1' },
        { id: 'e2', source: 'd1', target: 'end-1' },
      ],
    };
    const result = validate(graph);
    expect(codesOf(result)).toContain(GRAPH_ERROR_CODES.INVALID_DELAY);
  });

  it('DELAY_LIMIT_EXCEEDED: rejects a path whose cumulative delay exceeds 30 days', () => {
    const graph: AutomationGraph = {
      nodes: [
        { id: 't1', type: 'trigger', data: { triggerType: 'form.submitted' } },
        { id: 'd1', type: 'delay', data: { amount: 20, unit: 'days' } },
        { id: 'd2', type: 'delay', data: { amount: 15, unit: 'days' } },
        { id: 'end-1', type: 'end' },
      ],
      edges: [
        { id: 'e1', source: 't1', target: 'd1' },
        { id: 'e2', source: 'd1', target: 'd2' },
        { id: 'e3', source: 'd2', target: 'end-1' },
      ],
    };
    const result = validate(graph);
    expect(codesOf(result)).toContain(GRAPH_ERROR_CODES.DELAY_LIMIT_EXCEEDED);
  });

  it('allows a single delay node at exactly the 30-day cap', () => {
    const graph: AutomationGraph = {
      nodes: [
        { id: 't1', type: 'trigger', data: { triggerType: 'form.submitted' } },
        { id: 'd1', type: 'delay', data: { amount: 30, unit: 'days' } },
        { id: 'end-1', type: 'end' },
      ],
      edges: [
        { id: 'e1', source: 't1', target: 'd1' },
        { id: 'e2', source: 'd1', target: 'end-1' },
      ],
    };
    const result = validate(graph);
    expect(codesOf(result)).not.toContain(GRAPH_ERROR_CODES.DELAY_LIMIT_EXCEEDED);
  });

  it('UNKNOWN_ACTION_TYPE: rejects an actionType not in the registered plugin types', () => {
    const graph: AutomationGraph = {
      nodes: [
        { id: 't1', type: 'trigger', data: { triggerType: 'form.submitted' } },
        { id: 'a1', type: 'action', data: { actionType: 'carrier-pigeon', config: {} } },
        { id: 'end-1', type: 'end' },
      ],
      edges: [
        { id: 'e1', source: 't1', target: 'a1' },
        { id: 'e2', source: 'a1', target: 'end-1' },
      ],
    };
    const result = validate(graph);
    expect(codesOf(result)).toContain(GRAPH_ERROR_CODES.UNKNOWN_ACTION_TYPE);
  });

  describe('INVALID_ACTION_CONFIG', () => {
    it('rejects an email action missing both recipientEmail and recipientFieldId', () => {
      const graph: AutomationGraph = {
        nodes: [
          { id: 't1', type: 'trigger', data: { triggerType: 'form.submitted' } },
          {
            id: 'a1',
            type: 'action',
            data: { actionType: 'email', config: { subject: 'Hi', message: 'Hello' } },
          },
          { id: 'end-1', type: 'end' },
        ],
        edges: [
          { id: 'e1', source: 't1', target: 'a1' },
          { id: 'e2', source: 'a1', target: 'end-1' },
        ],
      };
      const result = validate(graph);
      expect(codesOf(result)).toContain(GRAPH_ERROR_CODES.INVALID_ACTION_CONFIG);
    });

    it('rejects a webhook action with a non-URL url', () => {
      const graph: AutomationGraph = {
        nodes: [
          { id: 't1', type: 'trigger', data: { triggerType: 'form.submitted' } },
          { id: 'a1', type: 'action', data: { actionType: 'webhook', config: { url: 'not-a-url' } } },
          { id: 'end-1', type: 'end' },
        ],
        edges: [
          { id: 'e1', source: 't1', target: 'a1' },
          { id: 'e2', source: 'a1', target: 'end-1' },
        ],
      };
      const result = validate(graph);
      expect(codesOf(result)).toContain(GRAPH_ERROR_CODES.INVALID_ACTION_CONFIG);
    });

    it('rejects a slack action missing a message', () => {
      const graph: AutomationGraph = {
        nodes: [
          { id: 't1', type: 'trigger', data: { triggerType: 'form.submitted' } },
          {
            id: 'a1',
            type: 'action',
            data: { actionType: 'slack', config: { webhookUrl: 'https://hooks.slack.com/x' } },
          },
          { id: 'end-1', type: 'end' },
        ],
        edges: [
          { id: 'e1', source: 't1', target: 'a1' },
          { id: 'e2', source: 'a1', target: 'end-1' },
        ],
      };
      const result = validate(graph);
      expect(codesOf(result)).toContain(GRAPH_ERROR_CODES.INVALID_ACTION_CONFIG);
    });

    it('accepts a valid webhook action config', () => {
      const graph: AutomationGraph = {
        nodes: [
          { id: 't1', type: 'trigger', data: { triggerType: 'form.submitted' } },
          {
            id: 'a1',
            type: 'action',
            data: { actionType: 'webhook', config: { url: 'https://example.com/hook' } },
          },
          { id: 'end-1', type: 'end' },
        ],
        edges: [
          { id: 'e1', source: 't1', target: 'a1' },
          { id: 'e2', source: 'a1', target: 'end-1' },
        ],
      };
      const result = validate(graph);
      expect(result.valid).toBe(true);
    });

    it('does not apply per-type config validation to action types without a dedicated schema', () => {
      const graph: AutomationGraph = {
        nodes: [
          { id: 't1', type: 'trigger', data: { triggerType: 'form.submitted' } },
          { id: 'a1', type: 'action', data: { actionType: 'quiz-grading', config: {} } },
          { id: 'end-1', type: 'end' },
        ],
        edges: [
          { id: 'e1', source: 't1', target: 'a1' },
          { id: 'e2', source: 'a1', target: 'end-1' },
        ],
      };
      const result = validate(graph);
      expect(result.valid).toBe(true);
    });
  });

  it('collects multiple independent errors in a single pass', () => {
    const graph: AutomationGraph = { nodes: [], edges: [] };
    const result = validate(graph);
    expect(result.valid).toBe(false);
    expect(codesOf(result)).toContain(GRAPH_ERROR_CODES.MISSING_TRIGGER);
  });

  describe('RESPONSE_DEPENDENT_ON_SCHEDULE (#201)', () => {
    function validateSchedule(graph: unknown) {
      return validateAutomationGraph(graph, { pluginTypes: PLUGIN_TYPES, triggerType: 'schedule' });
    }

    it('rejects any condition node on a scheduled automation (rules always reference response fields)', () => {
      const graph: AutomationGraph = {
        nodes: [
          { id: 't1', type: 'trigger', data: { triggerType: 'schedule' } },
          {
            id: 'c1',
            type: 'condition',
            data: { rules: [{ fieldId: 'age', operator: 'GREATER_THAN', value: '18' }], combinator: 'AND' },
          },
          { id: 'end-1', type: 'end' },
        ],
        edges: [
          { id: 'e1', source: 't1', target: 'c1' },
          { id: 'e2', source: 'c1', target: 'end-1', sourceHandle: 'true' },
          { id: 'e3', source: 'c1', target: 'end-1', sourceHandle: 'false' },
        ],
      };
      const result = validateSchedule(graph);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ nodeId: 'c1', code: GRAPH_ERROR_CODES.RESPONSE_DEPENDENT_ON_SCHEDULE })
      );
    });

    it('rejects an email action using recipientFieldId on a scheduled automation', () => {
      const graph: AutomationGraph = {
        nodes: [
          { id: 't1', type: 'trigger', data: { triggerType: 'schedule' } },
          {
            id: 'a1',
            type: 'action',
            data: { actionType: 'email', config: { recipientFieldId: 'email-field', subject: 'Hi', message: 'Hello' } },
          },
          { id: 'end-1', type: 'end' },
        ],
        edges: [
          { id: 'e1', source: 't1', target: 'a1' },
          { id: 'e2', source: 'a1', target: 'end-1' },
        ],
      };
      const result = validateSchedule(graph);
      expect(codesOf(result)).toContain(GRAPH_ERROR_CODES.RESPONSE_DEPENDENT_ON_SCHEDULE);
    });

    it('rejects an email action using sendToSubmitter on a scheduled automation', () => {
      const graph: AutomationGraph = {
        nodes: [
          { id: 't1', type: 'trigger', data: { triggerType: 'schedule' } },
          {
            id: 'a1',
            type: 'action',
            data: { actionType: 'email', config: { sendToSubmitter: true, subject: 'Hi', message: 'Hello' } },
          },
          { id: 'end-1', type: 'end' },
        ],
        edges: [
          { id: 'e1', source: 't1', target: 'a1' },
          { id: 'e2', source: 'a1', target: 'end-1' },
        ],
      };
      const result = validateSchedule(graph);
      expect(codesOf(result)).toContain(GRAPH_ERROR_CODES.RESPONSE_DEPENDENT_ON_SCHEDULE);
    });

    it('rejects any action config containing a {{field}} mention placeholder on a scheduled automation', () => {
      const graph: AutomationGraph = {
        nodes: [
          { id: 't1', type: 'trigger', data: { triggerType: 'schedule' } },
          {
            id: 'a1',
            type: 'action',
            data: {
              actionType: 'webhook',
              config: { url: 'https://example.com/hook', headers: { 'X-Name': '{{full-name}}' } },
            },
          },
          { id: 'end-1', type: 'end' },
        ],
        edges: [
          { id: 'e1', source: 't1', target: 'a1' },
          { id: 'e2', source: 'a1', target: 'end-1' },
        ],
      };
      const result = validateSchedule(graph);
      expect(codesOf(result)).toContain(GRAPH_ERROR_CODES.RESPONSE_DEPENDENT_ON_SCHEDULE);
    });

    it('accepts a scheduled automation with only static action configs (no response dependency)', () => {
      const graph: AutomationGraph = {
        nodes: [
          { id: 't1', type: 'trigger', data: { triggerType: 'schedule' } },
          {
            id: 'a1',
            type: 'action',
            data: {
              actionType: 'email',
              config: { recipientEmail: 'ops@example.com', subject: 'Daily digest', message: 'Good morning' },
            },
          },
          { id: 'end-1', type: 'end' },
        ],
        edges: [
          { id: 'e1', source: 't1', target: 'a1' },
          { id: 'e2', source: 'a1', target: 'end-1' },
        ],
      };
      const result = validateSchedule(graph);
      expect(result.valid).toBe(true);
    });

    it('does not reject response-dependent nodes for non-schedule triggerTypes', () => {
      const graph: AutomationGraph = {
        nodes: [
          { id: 't1', type: 'trigger', data: { triggerType: 'form.submitted' } },
          {
            id: 'c1',
            type: 'condition',
            data: { rules: [{ fieldId: 'age', operator: 'GREATER_THAN', value: '18' }], combinator: 'AND' },
          },
          { id: 'end-1', type: 'end' },
        ],
        edges: [
          { id: 'e1', source: 't1', target: 'c1' },
          { id: 'e2', source: 'c1', target: 'end-1', sourceHandle: 'true' },
          { id: 'e3', source: 'c1', target: 'end-1', sourceHandle: 'false' },
        ],
      };
      const result = validate(graph);
      expect(result.valid).toBe(true);
    });
  });
});

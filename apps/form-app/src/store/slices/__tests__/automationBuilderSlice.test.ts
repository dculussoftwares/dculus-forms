/**
 * Unit tests for the condition-node graph mutations added in #200: inserting a condition on
 * an edge (true branch keeps the previous successor, false branch wires to End) and deleting
 * a condition node (keeps the `true` branch by convention, discards the `false` branch's
 * entire subtree, reconnects the incoming edge — see automationBuilderSlice.ts removeNode).
 *
 * src/setupTests.ts globally mocks 'zustand' (`create: jest.fn(() => jest.fn())`) for
 * component tests that stub the whole store — that mock makes any real store unusable, so
 * this suite opts back into the real implementation. ts-jest doesn't hoist `jest.mock`/
 * `jest.unmock` calls above `import` statements the way babel-jest does (TS instead hoists
 * all `import`-derived `require`s to the top regardless of source position), so the store
 * must be pulled in via a plain `require()` call placed after `jest.unmock`, not an `import`.
 */
jest.unmock('zustand');

// jest-environment-jsdom doesn't expose Node's built-in structuredClone, which
// @dagrejs/dagre (invoked by layoutAutomationGraph on every store mutation) relies on. Our
// graph data is plain JSON-safe objects, so a JSON round-trip polyfill is sufficient here.
if (typeof (global as any).structuredClone !== 'function') {
  (global as any).structuredClone = (value: unknown) => JSON.parse(JSON.stringify(value));
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useAutomationBuilderStore } = require('../../useAutomationBuilderStore') as typeof import('../../useAutomationBuilderStore');

const loadTestGraph = (
  automationId: string,
  nodes: { id: string; type: string; data?: any }[],
  edges: { id: string; source: string; target: string; sourceHandle?: 'true' | 'false' }[]
) => {
  useAutomationBuilderStore.getState().loadGraph({
    automationId,
    formTitle: 'Test form',
    formFields: [],
    graph: { nodes, edges },
    isReadOnly: false,
  });
};

const findEdge = (source: string, sourceHandle?: 'true' | 'false') =>
  useAutomationBuilderStore
    .getState()
    .edges.find((e) => e.source === source && e.sourceHandle === sourceHandle);

beforeEach(() => {
  sessionStorage.clear();
});

describe('automationBuilderSlice — insertStepOnEdge(condition)', () => {
  test('attaches the previous successor to the true branch and wires the false branch to End', () => {
    // trigger -> action -> end
    loadTestGraph(
      'automation-1',
      [
        { id: 'trigger', type: 'trigger', data: { triggerType: 'form.submitted' } },
        { id: 'action', type: 'action', data: { actionType: 'email', config: {} } },
        { id: 'end', type: 'end' },
      ],
      [
        { id: 'e1', source: 'trigger', target: 'action' },
        { id: 'e2', source: 'action', target: 'end' },
      ]
    );

    const newNodeId = useAutomationBuilderStore.getState().insertStepOnEdge('e1', 'condition', {
      rules: [],
      combinator: 'AND',
    });

    expect(newNodeId).not.toBeNull();
    const state = useAutomationBuilderStore.getState();

    expect(state.nodes.map((n) => n.id).sort()).toEqual(['action', 'end', newNodeId, 'trigger'].sort());

    const incoming = state.edges.find((e) => e.target === newNodeId);
    expect(incoming?.source).toBe('trigger');
    expect(incoming?.sourceHandle).toBeUndefined();

    const trueEdge = findEdge(newNodeId!, 'true');
    const falseEdge = findEdge(newNodeId!, 'false');
    expect(trueEdge?.target).toBe('action'); // previous successor
    expect(falseEdge?.target).toBe('end'); // the graph's single End node

    // The original action -> end edge is untouched.
    expect(state.edges.find((e) => e.source === 'action' && e.target === 'end')).toBeDefined();

    expect(state.selectedNodeId).toBe(newNodeId);
    expect(state.isDirty).toBe(true);
  });

  test('inserting directly on the trigger -> end edge points both branches at End', () => {
    loadTestGraph(
      'automation-2',
      [
        { id: 'trigger', type: 'trigger', data: { triggerType: 'form.submitted' } },
        { id: 'end', type: 'end' },
      ],
      [{ id: 'e1', source: 'trigger', target: 'end' }]
    );

    const newNodeId = useAutomationBuilderStore.getState().insertStepOnEdge('e1', 'condition', {
      rules: [],
      combinator: 'AND',
    });

    expect(findEdge(newNodeId!, 'true')?.target).toBe('end');
    expect(findEdge(newNodeId!, 'false')?.target).toBe('end');
  });

  test('throws rather than silently wiring the false branch to the old successor when the graph has no End node', () => {
    // Malformed on purpose — the real app always has exactly one End node (buildDefaultGraph,
    // and EndNode is never user-deletable), but a corrupted session draft could theoretically
    // violate that. insertStepOnEdge must fail loudly instead of producing an inert branch.
    loadTestGraph(
      'automation-no-end',
      [
        { id: 'trigger', type: 'trigger', data: { triggerType: 'form.submitted' } },
        { id: 'action', type: 'action', data: { actionType: 'email', config: {} } },
      ],
      [{ id: 'e1', source: 'trigger', target: 'action' }]
    );

    expect(() =>
      useAutomationBuilderStore.getState().insertStepOnEdge('e1', 'condition', { rules: [], combinator: 'AND' })
    ).toThrow(/no End node/);
  });
});

describe('automationBuilderSlice — removeNode(condition) branch-keep convention', () => {
  test('keeps the true branch, discards the false branch subtree, and reconnects the incoming edge', () => {
    // trigger -> condition -> [true: a1 -> a2 -> end] [false: b1 -> end]
    loadTestGraph(
      'automation-3',
      [
        { id: 'trigger', type: 'trigger', data: { triggerType: 'form.submitted' } },
        { id: 'condition', type: 'condition', data: { rules: [{ fieldId: 'f1', operator: 'EQUALS', value: 'x' }], combinator: 'AND' } },
        { id: 'a1', type: 'action', data: { actionType: 'email', config: {} } },
        { id: 'a2', type: 'action', data: { actionType: 'webhook', config: {} } },
        { id: 'b1', type: 'action', data: { actionType: 'webhook', config: {} } },
        { id: 'end', type: 'end' },
      ],
      [
        { id: 'e-trigger-cond', source: 'trigger', target: 'condition' },
        { id: 'e-true', source: 'condition', target: 'a1', sourceHandle: 'true' },
        { id: 'e-a1-a2', source: 'a1', target: 'a2' },
        { id: 'e-a2-end', source: 'a2', target: 'end' },
        { id: 'e-false', source: 'condition', target: 'b1', sourceHandle: 'false' },
        { id: 'e-b1-end', source: 'b1', target: 'end' },
      ]
    );

    useAutomationBuilderStore.getState().removeNode('condition');
    const state = useAutomationBuilderStore.getState();

    // condition and the whole false-branch subtree (b1) are gone.
    expect(state.nodes.map((n) => n.id).sort()).toEqual(['a1', 'a2', 'end', 'trigger'].sort());
    expect(state.edges.some((e) => e.source === 'b1' || e.target === 'b1')).toBe(false);
    expect(state.edges.some((e) => e.source === 'condition' || e.target === 'condition')).toBe(false);

    // trigger now connects straight to a1 (the kept true branch), preserving the original
    // incoming edge's (absent) sourceHandle.
    const reconnected = state.edges.find((e) => e.source === 'trigger');
    expect(reconnected?.target).toBe('a1');
    expect(reconnected?.sourceHandle).toBeUndefined();

    // The rest of the true branch is untouched.
    expect(state.edges.find((e) => e.source === 'a1' && e.target === 'a2')).toBeDefined();
    expect(state.edges.find((e) => e.source === 'a2' && e.target === 'end')).toBeDefined();
  });

  test('recursively deletes a nested condition subtree on the discarded branch', () => {
    // trigger -> c1 -> [true: c2 -> [true: a -> end] [false: end]] [false: b -> end]
    loadTestGraph(
      'automation-4',
      [
        { id: 'trigger', type: 'trigger', data: { triggerType: 'form.submitted' } },
        { id: 'c1', type: 'condition', data: { rules: [], combinator: 'AND' } },
        { id: 'c2', type: 'condition', data: { rules: [], combinator: 'AND' } },
        { id: 'a', type: 'action', data: { actionType: 'email', config: {} } },
        { id: 'b', type: 'action', data: { actionType: 'email', config: {} } },
        { id: 'end', type: 'end' },
      ],
      [
        { id: 'e1', source: 'trigger', target: 'c1' },
        { id: 'e2', source: 'c1', target: 'c2', sourceHandle: 'true' },
        { id: 'e3', source: 'c1', target: 'b', sourceHandle: 'false' },
        { id: 'e4', source: 'c2', target: 'a', sourceHandle: 'true' },
        { id: 'e5', source: 'c2', target: 'end', sourceHandle: 'false' },
        { id: 'e6', source: 'a', target: 'end' },
        { id: 'e7', source: 'b', target: 'end' },
      ]
    );

    useAutomationBuilderStore.getState().removeNode('c1');
    const state = useAutomationBuilderStore.getState();

    // Keeps the whole true subtree (c2, a); discards only b (the false branch).
    expect(state.nodes.map((n) => n.id).sort()).toEqual(['a', 'c2', 'end', 'trigger'].sort());
    expect(state.edges.find((e) => e.source === 'trigger')?.target).toBe('c2');
  });

  test('falls back to keeping the false branch when no true edge exists', () => {
    loadTestGraph(
      'automation-5',
      [
        { id: 'trigger', type: 'trigger', data: { triggerType: 'form.submitted' } },
        { id: 'condition', type: 'condition', data: { rules: [], combinator: 'AND' } },
        { id: 'b1', type: 'action', data: { actionType: 'email', config: {} } },
        { id: 'end', type: 'end' },
      ],
      [
        { id: 'e1', source: 'trigger', target: 'condition' },
        { id: 'e2', source: 'condition', target: 'b1', sourceHandle: 'false' },
        { id: 'e3', source: 'b1', target: 'end' },
      ]
    );

    useAutomationBuilderStore.getState().removeNode('condition');
    const state = useAutomationBuilderStore.getState();

    expect(state.nodes.map((n) => n.id).sort()).toEqual(['b1', 'end', 'trigger'].sort());
    expect(state.edges.find((e) => e.source === 'trigger')?.target).toBe('b1');
  });

  test('clears validation errors and selection for every node removed with the condition', () => {
    loadTestGraph(
      'automation-6',
      [
        { id: 'trigger', type: 'trigger', data: { triggerType: 'form.submitted' } },
        { id: 'condition', type: 'condition', data: { rules: [], combinator: 'AND' } },
        { id: 'a1', type: 'action', data: { actionType: 'email', config: {} } },
        { id: 'b1', type: 'action', data: { actionType: 'webhook', config: {} } },
        { id: 'end', type: 'end' },
      ],
      [
        { id: 'e1', source: 'trigger', target: 'condition' },
        { id: 'e2', source: 'condition', target: 'a1', sourceHandle: 'true' },
        { id: 'e3', source: 'a1', target: 'end' },
        { id: 'e4', source: 'condition', target: 'b1', sourceHandle: 'false' },
        { id: 'e5', source: 'b1', target: 'end' },
      ]
    );

    useAutomationBuilderStore.getState().setSelectedNodeId('b1');
    useAutomationBuilderStore.getState().setValidationErrors([
      { nodeId: 'condition', code: 'INVALID_CONDITION_CONFIG', message: 'bad' },
      { nodeId: 'b1', code: 'INVALID_ACTION_CONFIG', message: 'bad' },
      { nodeId: 'a1', code: 'INVALID_ACTION_CONFIG', message: 'kept' },
    ]);

    useAutomationBuilderStore.getState().removeNode('condition');
    const state = useAutomationBuilderStore.getState();

    expect(state.selectedNodeId).toBeNull(); // b1 was selected and got discarded
    expect(state.validationErrorsByNode.condition).toBeUndefined();
    expect(state.validationErrorsByNode.b1).toBeUndefined();
    expect(state.validationErrorsByNode.a1).toEqual([{ nodeId: 'a1', code: 'INVALID_ACTION_CONFIG', message: 'kept' }]);
  });
});

describe('automationBuilderSlice — removeNode(non-condition) reconnect (regression)', () => {
  test('removing a mid-branch action node reconnects its neighbors, preserving the branch handle', () => {
    // trigger -> condition -> [true: a1 -> end] [false: end]
    loadTestGraph(
      'automation-7',
      [
        { id: 'trigger', type: 'trigger', data: { triggerType: 'form.submitted' } },
        { id: 'condition', type: 'condition', data: { rules: [], combinator: 'AND' } },
        { id: 'a1', type: 'action', data: { actionType: 'email', config: {} } },
        { id: 'end', type: 'end' },
      ],
      [
        { id: 'e1', source: 'trigger', target: 'condition' },
        { id: 'e2', source: 'condition', target: 'a1', sourceHandle: 'true' },
        { id: 'e3', source: 'a1', target: 'end' },
        { id: 'e4', source: 'condition', target: 'end', sourceHandle: 'false' },
      ]
    );

    useAutomationBuilderStore.getState().removeNode('a1');
    const state = useAutomationBuilderStore.getState();

    expect(state.nodes.map((n) => n.id).sort()).toEqual(['condition', 'end', 'trigger'].sort());
    const reconnected = state.edges.find((e) => e.source === 'condition' && e.sourceHandle === 'true');
    expect(reconnected?.target).toBe('end');
  });
});

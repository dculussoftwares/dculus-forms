/**
 * Unit tests for layoutAutomationGraph (LR dagre layout + spacer-node routing for
 * rank-skipping branches + true/false branch-order mirroring). Each of these tests locks
 * in a bug that was previously only caught by manually reproducing a specific click
 * sequence in a browser:
 *
 *  - "Yes"/"No" branches rendering in the wrong vertical order relative to their fixed
 *    handle positions, crossing directly under the condition card (#see layout.ts
 *    conditionsByRank mirror pass).
 *  - A rank-skipping branch's edge routed straight through — and rendered invisible
 *    behind — a sibling branch's node (#see the spacer-node rewrite).
 *  - A branch that no longer skips any rank still rendering via a stale bend route
 *    computed for an earlier, longer graph shape (#see withoutStaleBend).
 *  - The exact same graph topology laying out differently depending only on which
 *    branch's step was added first (edge array order) — layoutAutomationGraph must be
 *    order-independent.
 *
 * jest-environment-jsdom doesn't expose Node's built-in structuredClone, which
 * @dagrejs/dagre relies on internally — see the same polyfill in
 * automationBuilderSlice.test.ts.
 */
if (typeof (global as any).structuredClone !== 'function') {
  (global as any).structuredClone = (value: unknown) => JSON.parse(JSON.stringify(value));
}

import { layoutAutomationGraph, type AutomationNode, type AutomationEdge } from '../layout';

const node = (id: string, type: AutomationNode['type'], width = 280, height = 90): AutomationNode => ({
  id,
  type,
  data: {} as any,
  position: { x: 0, y: 0 },
  measured: { width, height },
});

const edge = (id: string, source: string, target: string, sourceHandle?: 'true' | 'false'): AutomationEdge => ({
  id,
  source,
  target,
  ...(sourceHandle ? { sourceHandle } : {}),
});

const findNode = (nodes: AutomationNode[], id: string) => nodes.find((n) => n.id === id)!;
const findEdge = (edges: AutomationEdge[], id: string) => edges.find((e) => e.id === id)!;
const centerY = (n: AutomationNode) => n.position.y + (n.measured!.height as number) / 2;
const centerX = (n: AutomationNode) => n.position.x + (n.measured!.width as number) / 2;

describe('layoutAutomationGraph — basic LR layout', () => {
  test('lays out a straight chain left-to-right with strictly increasing x and no bend points', () => {
    const nodes = [node('trigger', 'trigger'), node('action', 'action'), node('end', 'end')];
    const edges = [edge('e1', 'trigger', 'action'), edge('e2', 'action', 'end')];

    const { nodes: laidOut, edges: laidOutEdges } = layoutAutomationGraph(nodes, edges);

    const xs = ['trigger', 'action', 'end'].map((id) => centerX(findNode(laidOut, id)));
    expect(xs[0]).toBeLessThan(xs[1]);
    expect(xs[1]).toBeLessThan(xs[2]);
    for (const e of laidOutEdges) expect(e.data?.bendPoints).toBeUndefined();
  });
});

describe('layoutAutomationGraph — true/false branch order', () => {
  test('the "true" branch always renders at or above the "false" branch, regardless of what dagre would naturally pick', () => {
    // A deliberately asymmetric shape: the false branch merges immediately, while the true
    // branch runs through two more steps first — the exact kind of imbalance that, in the
    // real automation this was found on, made dagre's crossing-minimization pass put the
    // false branch's subtree above the true branch's.
    const nodes = [
      node('trigger', 'trigger'),
      node('c1', 'condition'),
      node('t1', 'action'),
      node('t2', 'action'),
      node('f1', 'action'),
      node('end', 'end'),
    ];
    const edges = [
      edge('e1', 'trigger', 'c1'),
      edge('e2', 'c1', 't1', 'true'),
      edge('e3', 't1', 't2'),
      edge('e4', 't2', 'end'),
      edge('e5', 'c1', 'f1', 'false'),
      edge('e6', 'f1', 'end'),
    ];

    const { nodes: laidOut } = layoutAutomationGraph(nodes, edges);
    expect(centerY(findNode(laidOut, 't1'))).toBeLessThanOrEqual(centerY(findNode(laidOut, 'f1')));
  });

  test('holds for nested conditions too', () => {
    // trigger -> c1 -[true]-> c2 -[true]-> t1 -> end
    //                  |          -[false]-> f1 -> end
    //                  -[false]-> b1 -> end
    const nodes = [
      node('trigger', 'trigger'),
      node('c1', 'condition'),
      node('c2', 'condition'),
      node('t1', 'action'),
      node('f1', 'action'),
      node('b1', 'action'),
      node('end', 'end'),
    ];
    const edges = [
      edge('e1', 'trigger', 'c1'),
      edge('e2', 'c1', 'c2', 'true'),
      edge('e3', 'c1', 'b1', 'false'),
      edge('e4', 'b1', 'end'),
      edge('e5', 'c2', 't1', 'true'),
      edge('e6', 'c2', 'f1', 'false'),
      edge('e7', 't1', 'end'),
      edge('e8', 'f1', 'end'),
    ];

    const { nodes: laidOut } = layoutAutomationGraph(nodes, edges);
    expect(centerY(findNode(laidOut, 't1'))).toBeLessThanOrEqual(centerY(findNode(laidOut, 'f1')));
  });
});

describe('layoutAutomationGraph — order independence', () => {
  test('produces the same layout whether the "false" branch or the "true" branch was populated first', () => {
    // Same final topology as the nested-condition case above, but with the false-branch
    // edges listed before the true-branch edges — reproducing "add a step to No, then
    // add a step to Yes" versus "Yes then No". A pure function of graph shape must not
    // care about this.
    const nodes = [
      node('trigger', 'trigger'),
      node('c1', 'condition'),
      node('t1', 'action'),
      node('f1', 'action'),
      node('end', 'end'),
    ];
    const edgesYesFirst = [
      edge('e1', 'trigger', 'c1'),
      edge('e2', 'c1', 't1', 'true'),
      edge('e3', 'c1', 'f1', 'false'),
      edge('e4', 't1', 'end'),
      edge('e5', 'f1', 'end'),
    ];
    const edgesNoFirst = [
      edge('e1', 'trigger', 'c1'),
      edge('e3', 'c1', 'f1', 'false'),
      edge('e2', 'c1', 't1', 'true'),
      edge('e5', 'f1', 'end'),
      edge('e4', 't1', 'end'),
    ];

    const a = layoutAutomationGraph(nodes, edgesYesFirst);
    const b = layoutAutomationGraph(nodes, edgesNoFirst);

    for (const id of ['trigger', 'c1', 't1', 'f1', 'end']) {
      expect(findNode(a.nodes, id).position).toEqual(findNode(b.nodes, id).position);
    }
  });
});

describe('layoutAutomationGraph — rank-skipping branches route through spacer nodes', () => {
  test('a branch skipping past its sibling\'s multi-step chain gets bend points that clear every node in the skipped ranks', () => {
    // c1 -[true]-> t1 -> t2 -> end   (2-step branch)
    // c1 -[false]-> end              (skips t1's and t2's ranks entirely)
    const nodes = [
      node('trigger', 'trigger'),
      node('c1', 'condition'),
      node('t1', 'action'),
      node('t2', 'action'),
      node('end', 'end'),
    ];
    const edges = [
      edge('e1', 'trigger', 'c1'),
      edge('e2', 'c1', 't1', 'true'),
      edge('e3', 't1', 't2'),
      edge('e4', 't2', 'end'),
      edge('e5', 'c1', 'end', 'false'),
    ];

    const { nodes: laidOut, edges: laidOutEdges } = layoutAutomationGraph(nodes, edges);
    const falseEdge = findEdge(laidOutEdges, 'e5');
    const bendPoints = falseEdge.data?.bendPoints as { x: number; y: number }[] | undefined;

    // Skips exactly two ranks (t1's and t2's), so needs exactly two bend points.
    expect(bendPoints).toHaveLength(2);

    const t1 = findNode(laidOut, 't1');
    const t2 = findNode(laidOut, 't2');
    const within = (y: number, n: AutomationNode) => {
      const top = n.position.y;
      const bottom = n.position.y + (n.measured!.height as number);
      return y >= top && y <= bottom;
    };
    for (const point of bendPoints!) {
      expect(within(point.y, t1)).toBe(false);
      expect(within(point.y, t2)).toBe(false);
    }
  });

  test('clears bend points once the graph no longer needs them (sibling branch deleted)', () => {
    const withSibling = [
      node('trigger', 'trigger'),
      node('c1', 'condition'),
      node('t1', 'action'),
      node('end', 'end'),
    ];
    const edgesWithSibling = [
      edge('e1', 'trigger', 'c1'),
      edge('e2', 'c1', 't1', 'true'),
      edge('e3', 't1', 'end'),
      edge('e4', 'c1', 'end', 'false'),
    ];
    const { edges: firstPass } = layoutAutomationGraph(withSibling, edgesWithSibling);
    expect(findEdge(firstPass, 'e4').data?.bendPoints).toHaveLength(1);

    // t1 deleted and its neighbors reconnected — exactly what removeNode does — leaving a
    // trivial trigger -> c1 -> end / end graph where "false" is adjacent-rank again. The
    // edge object being re-fed in still carries last pass's bendPoints in its `data`.
    const withoutSibling = [node('trigger', 'trigger'), node('c1', 'condition'), node('end', 'end')];
    const edgesWithoutSibling = [
      edge('e1', 'trigger', 'c1'),
      edge('e6', 'c1', 'end', 'true'),
      findEdge(firstPass, 'e4'), // still has stale data.bendPoints from the first pass
    ];

    const { edges: secondPass } = layoutAutomationGraph(withoutSibling, edgesWithoutSibling);
    expect(findEdge(secondPass, 'e4').data?.bendPoints).toBeUndefined();
  });
});

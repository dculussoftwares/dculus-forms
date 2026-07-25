import dagre from '@dagrejs/dagre';
import type { Edge, Node } from '@xyflow/react';
import type { AutomationNodeData, AutomationNodeType } from './types';

export type AutomationNode = Node<AutomationNodeData, AutomationNodeType>;
export type AutomationEdge = Edge;

// Fallback dims used before React Flow has measured the actual rendered card
// (node.measured is undefined on the very first layout pass).
const DEFAULT_DIMENSIONS: Record<AutomationNodeType, { width: number; height: number }> = {
  trigger: { width: 300, height: 92 },
  delay: { width: 260, height: 76 },
  condition: { width: 300, height: 116 },
  action: { width: 280, height: 92 },
  end: { width: 180, height: 56 },
};

const RANK_SEP = 96;
const NODE_SEP = 56;

/**
 * Runs dagre's LR (left-to-right) auto-layout over the given nodes/edges and returns new
 * node objects with recomputed `position`, plus the edges enriched with any bend points
 * dagre computed for them. Nodes are never user-draggable in this builder, so this is the
 * single source of truth for node position after every graph mutation (insert/remove/load).
 *
 * Rank progresses left-to-right (dagre's `rankdir: 'LR'`), matching the reference workflow
 * builder's horizontal layout — same-rank nodes share an x, and vary in y. dagre's returned
 * node.x/node.y always mean standard screen-space horizontal/vertical regardless of
 * rankdir; only which axis represents "rank" changes. Every post-processing pass below is
 * the horizontal-layout mirror of what a TB layout would need along the other axis.
 */
export function layoutAutomationGraph(
  nodes: AutomationNode[],
  edges: AutomationEdge[]
): { nodes: AutomationNode[]; edges: AutomationEdge[] } {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: NODE_SEP, ranksep: RANK_SEP });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of nodes) {
    const fallback = DEFAULT_DIMENSIONS[node.type as AutomationNodeType] ?? DEFAULT_DIMENSIONS.action;
    const width = node.measured?.width ?? fallback.width;
    const height = node.measured?.height ?? fallback.height;
    g.setNode(node.id, { width, height });
  }

  for (const edge of edges) {
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      g.setEdge(edge.source, edge.target);
    }
  }

  dagre.layout(g);

  // ConditionNode fixes "Yes" at the card's top handle (30%) and "No" at the bottom handle
  // (70%) — see ConditionNode.tsx — but dagre's crossing-minimization ordering pass has no
  // notion of that convention; it's free to place the "false" branch's subtree above the
  // "true" branch's, purely to minimize crossings elsewhere in the graph. When it does, the
  // Yes edge (leaving from the top handle) has to swing down past the No edge (leaving from
  // the bottom handle) swinging up, crossing directly beside the card. Detect that per
  // condition node and mirror each branch's *exclusive* subtree (nodes reachable only from
  // that branch, not also from the other one — shared merge points like a downstream End
  // node are left untouched) around the condition's own y, swapping which side they render
  // on to match the fixed handle positions.
  const reachableFrom = (startId: string, excludeId: string): Set<string> => {
    const visited = new Set<string>();
    const stack = [startId];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (id === excludeId || visited.has(id)) continue;
      visited.add(id);
      for (const edge of edges) {
        if (edge.source === id) stack.push(edge.target);
      }
    }
    return visited;
  };

  const conditionsByRank = nodes
    .filter((n) => n.type === 'condition')
    .sort((a, b) => (g.node(a.id)?.x ?? 0) - (g.node(b.id)?.x ?? 0));
  for (const condition of conditionsByRank) {
    const trueEdge = edges.find((e) => e.source === condition.id && e.sourceHandle === 'true');
    const falseEdge = edges.find((e) => e.source === condition.id && e.sourceHandle === 'false');
    if (!trueEdge || !falseEdge || !g.hasNode(trueEdge.target) || !g.hasNode(falseEdge.target)) continue;

    const centerY = g.node(condition.id)?.y;
    const trueY = g.node(trueEdge.target)?.y;
    const falseY = g.node(falseEdge.target)?.y;
    if (centerY === undefined || trueY === undefined || falseY === undefined || trueY <= falseY) continue;

    const reachTrue = reachableFrom(trueEdge.target, condition.id);
    const reachFalse = reachableFrom(falseEdge.target, condition.id);
    const onlyTrue = [...reachTrue].filter((id) => !reachFalse.has(id));
    const onlyFalse = [...reachFalse].filter((id) => !reachTrue.has(id));
    for (const id of [...onlyTrue, ...onlyFalse]) {
      const pos = g.node(id);
      if (pos) pos.y = 2 * centerY - pos.y;
    }
  }

  // dagre's within-rank Y-coordinate heuristic (Brandes-Köpf) doesn't always perfectly
  // center a node beside its single parent when that parent's *other* descendants pull the
  // alignment pass toward a different median — even though aligning them costs nothing,
  // since neither end has any other position constraint. The resulting few-pixel offset is
  // too small for the edge curve to resolve cleanly, so it draws as a barely-visible wiggle
  // instead of a straight line. Force an exact y match for every hop that is unambiguously
  // a straight pass-through — the source's only outgoing edge and the target's only
  // incoming edge — leaving every real branch or merge point (anything with siblings)
  // exactly as dagre positioned it. Processed in rank (x) order so a parent snapped from
  // *its* own parent is already resolved before its children are considered.
  const outDegree = new Map<string, number>();
  const inDegree = new Map<string, number>();
  for (const edge of edges) {
    if (!g.hasNode(edge.source) || !g.hasNode(edge.target)) continue;
    outDegree.set(edge.source, (outDegree.get(edge.source) ?? 0) + 1);
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }
  const soleParentOf = new Map<string, string>();
  for (const edge of edges) {
    if (!g.hasNode(edge.source) || !g.hasNode(edge.target)) continue;
    if (outDegree.get(edge.source) === 1 && inDegree.get(edge.target) === 1) {
      soleParentOf.set(edge.target, edge.source);
    }
  }
  const byRank = [...nodes].sort((a, b) => (g.node(a.id)?.x ?? 0) - (g.node(b.id)?.x ?? 0));
  for (const node of byRank) {
    const parentId = soleParentOf.get(node.id);
    if (!parentId) continue;
    const parentPos = g.node(parentId);
    const childPos = g.node(node.id);
    if (parentPos && childPos) childPos.y = parentPos.y;
  }

  const layoutedNodes = nodes.map((node) => {
    const positioned = g.node(node.id);
    if (!positioned) return node;
    return {
      ...node,
      position: {
        x: positioned.x - positioned.width / 2,
        y: positioned.y - positioned.height / 2,
      },
    };
  });

  // Rank is derived from dagre's own computed x (nodes in the same rank always land on
  // an identical x in LR layout) rather than reimplemented as a longest-path-from-root
  // calculation: dagre's network-simplex ranker can push a node meaningfully further
  // along than its shortest/longest incoming path alone would suggest, to minimize total
  // edge length across the *whole* graph (e.g. a branch with one action, feeding into an
  // End node that other, longer branches also feed into, gets pulled forward to align
  // with those siblings). A naive recomputation disagreed with dagre's real placement in
  // exactly that case, so a genuinely multi-rank edge was misclassified as adjacent and
  // drawn as one straight segment cutting across the intervening nodes.
  const rankIndexByX = new Map<number, number>(
    [...new Set(nodes.map((n) => g.node(n.id)?.x).filter((x): x is number => x !== undefined))]
      .sort((a, b) => a - b)
      .map((x, i) => [x, i])
  );
  const rankOf = (nodeId: string): number | undefined => {
    const x = g.node(nodeId)?.x;
    return x === undefined ? undefined : rankIndexByX.get(x);
  };
  const rankXs = [...rankIndexByX.entries()].sort((a, b) => a[1] - b[1]).map(([x]) => x);
  const nodesByRank = new Map<number, AutomationNode[]>();
  for (const node of nodes) {
    const rank = rankOf(node.id);
    if (rank === undefined) continue;
    const list = nodesByRank.get(rank) ?? [];
    list.push(node);
    nodesByRank.set(rank, list);
  }

  // An edge that skips a rank — e.g. a condition branch with a single action, wired
  // straight to a node that also has other, longer incoming paths — needs bend points so
  // it routes around whatever occupies the skipped rank(s) instead of cutting a straight
  // line across it. These are computed here, from nodes' *final* positions (after the
  // true/false mirror and sole-parent snap above), rather than read from dagre's own
  // `edge.points` — dagre computes those once during `dagre.layout()`, before either of
  // those two passes runs, so they'd still reference whatever position a node had *before*
  // it was mirrored/snapped. E.g. if a condition's true branch went straight to a shared
  // End node while its false branch had its own action, the action node could get mirrored
  // to the opposite side of the condition, but the true edge's stale bend point wouldn't
  // move with it — leaving the true edge routed straight through the action node's new
  // position, rendered invisible behind its (opaque) card.
  //
  // Route above everything in a skipped rank for a "true"/Yes edge (top handle) and below
  // for "false"/No (bottom handle), matching ConditionNode's fixed handle sides; a plain
  // (non-condition) edge picks whichever side the source already leans toward.
  const CLEARANCE = 24;
  const layoutedEdges = edges.map((edge) => {
    // An edge that needed bend points in an earlier layout pass (e.g. the sibling branch
    // it was routing around has since been deleted) but doesn't anymore must have that
    // stale `data.bendPoints` cleared here — every early return below hands back
    // `withoutStaleBend`, not the raw `edge`, so a rank change that makes bending
    // unnecessary actually removes the old bend route instead of leaving edges rendered
    // via a route computed for a graph shape that no longer exists.
    const withoutStaleBend: AutomationEdge =
      edge.data?.bendPoints !== undefined ? { ...edge, data: { ...edge.data, bendPoints: undefined } } : edge;

    if (!g.hasNode(edge.source) || !g.hasNode(edge.target)) return withoutStaleBend;
    const sourceRank = rankOf(edge.source);
    const targetRank = rankOf(edge.target);
    if (sourceRank === undefined || targetRank === undefined || targetRank - sourceRank <= 1) return withoutStaleBend;

    const sourcePos = g.node(edge.source);
    const targetPos = g.node(edge.target);
    if (!sourcePos || !targetPos) return withoutStaleBend;

    const routeAbove =
      edge.sourceHandle === 'true' ? true : edge.sourceHandle === 'false' ? false : sourcePos.y <= targetPos.y;

    const bendPoints: { x: number; y: number }[] = [];
    for (let rank = sourceRank + 1; rank < targetRank; rank++) {
      const x = rankXs[rank];
      if (x === undefined) continue;
      const occupants = (nodesByRank.get(rank) ?? []).filter((n) => n.id !== edge.source && n.id !== edge.target);
      if (occupants.length === 0) {
        const t = (rank - sourceRank) / (targetRank - sourceRank);
        bendPoints.push({ x, y: sourcePos.y + (targetPos.y - sourcePos.y) * t });
        continue;
      }
      const occupantBounds = occupants.map((n) => {
        const pos = g.node(n.id);
        return pos ? { top: pos.y - pos.height / 2, bottom: pos.y + pos.height / 2 } : { top: 0, bottom: 0 };
      });
      const y = routeAbove
        ? Math.min(...occupantBounds.map((b) => b.top)) - CLEARANCE
        : Math.max(...occupantBounds.map((b) => b.bottom)) + CLEARANCE;
      bendPoints.push({ x, y });
    }
    if (bendPoints.length === 0) return withoutStaleBend;
    return { ...edge, data: { ...edge.data, bendPoints } };
  });

  return { nodes: layoutedNodes, edges: layoutedEdges };
}

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
  digest: { width: 260, height: 76 },
  end: { width: 180, height: 56 },
};

const RANK_SEP = 96;
const NODE_SEP = 56;
const SPACER_SIZE = 1;
const SPACER_PREFIX = '__spacer_';

/**
 * Runs dagre's LR (left-to-right) auto-layout over the given nodes/edges and returns new
 * node objects with recomputed `position`, plus the edges enriched with any bend points
 * needed to route a rank-skipping edge (e.g. an empty condition branch, wired straight to
 * a node several ranks down past its sibling branch's own steps) around whatever it would
 * otherwise cut straight through. Nodes are never user-draggable in this builder, so this
 * is the single source of truth for node position after every graph mutation
 * (insert/remove/load).
 *
 * A rank-skipping edge is never routed by computing a "safe" detour after the fact —
 * hand-rolled clearance math only knows how to dodge *node boxes*, not the curves of
 * *other edges* passing through the same rank, and a bezier's control-point bulge can
 * still sweep back through a rank it was meant to clear. Instead, every edge that would
 * skip a rank gets small invisible "spacer" nodes inserted into the graph at each skipped
 * rank *before* dagre lays anything out, splitting it into a chain of plain, adjacent-rank
 * hops — exactly what a strict tree would look like. dagre's own crossing-minimization and
 * node separation then keeps every spacer clear of whatever else shares its rank, the same
 * way it already keeps real nodes apart, so there is no bespoke routing logic left that can
 * disagree with what actually got drawn.
 *
 * Rank progresses left-to-right (dagre's `rankdir: 'LR'`) — same-rank nodes share an x, and
 * vary in y. dagre's returned node.x/node.y always mean standard screen-space
 * horizontal/vertical regardless of rankdir; only which axis represents "rank" changes.
 */
export function layoutAutomationGraph(
  nodes: AutomationNode[],
  edges: AutomationEdge[]
): { nodes: AutomationNode[]; edges: AutomationEdge[] } {
  const validEdges = edges.filter((e) => nodes.some((n) => n.id === e.source) && nodes.some((n) => n.id === e.target));

  // Preliminary layout, purely to learn each node's rank — how many spacer hops a given
  // edge needs — before building the real, spacer-expanded graph dagre actually lays out.
  const prelim = new dagre.graphlib.Graph();
  prelim.setGraph({ rankdir: 'LR', nodesep: NODE_SEP, ranksep: RANK_SEP });
  prelim.setDefaultEdgeLabel(() => ({}));
  for (const node of nodes) {
    const fallback = DEFAULT_DIMENSIONS[node.type as AutomationNodeType] ?? DEFAULT_DIMENSIONS.action;
    prelim.setNode(node.id, { width: node.measured?.width ?? fallback.width, height: node.measured?.height ?? fallback.height });
  }
  for (const edge of validEdges) prelim.setEdge(edge.source, edge.target);
  dagre.layout(prelim);

  const prelimRankIndexByX = new Map<number, number>(
    [...new Set(nodes.map((n) => prelim.node(n.id)?.x).filter((x): x is number => x !== undefined))]
      .sort((a, b) => a - b)
      .map((x, i) => [x, i])
  );
  const prelimRankOf = (nodeId: string): number => prelimRankIndexByX.get(prelim.node(nodeId)?.x ?? 0) ?? 0;

  // Build the real graph, splitting any edge that spans more than one rank into a chain of
  // single-rank hops through spacer nodes. `routeNodeIds` records the full node-id path
  // (source, ...spacers, target) per original edge so the final positions can be read back
  // into bend points afterward.
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: NODE_SEP, ranksep: RANK_SEP });
  g.setDefaultEdgeLabel(() => ({}));
  for (const node of nodes) {
    const fallback = DEFAULT_DIMENSIONS[node.type as AutomationNodeType] ?? DEFAULT_DIMENSIONS.action;
    g.setNode(node.id, { width: node.measured?.width ?? fallback.width, height: node.measured?.height ?? fallback.height });
  }

  const routeNodeIds = new Map<string, string[]>();
  const expandedHops: { source: string; target: string }[] = [];
  let spacerCount = 0;
  for (const edge of validEdges) {
    const gap = prelimRankOf(edge.target) - prelimRankOf(edge.source);
    const route = [edge.source];
    let prev = edge.source;
    for (let i = 1; i < gap; i++) {
      const spacerId = `${SPACER_PREFIX}${spacerCount++}`;
      g.setNode(spacerId, { width: SPACER_SIZE, height: SPACER_SIZE });
      g.setEdge(prev, spacerId);
      expandedHops.push({ source: prev, target: spacerId });
      route.push(spacerId);
      prev = spacerId;
    }
    g.setEdge(prev, edge.target);
    expandedHops.push({ source: prev, target: edge.target });
    route.push(edge.target);
    routeNodeIds.set(edge.id, route);
  }

  dagre.layout(g);

  // ConditionNode fixes "Yes" at the card's top handle (30%) and "No" at the bottom handle
  // (70%) — see ConditionNode.tsx — but dagre's crossing-minimization ordering pass has no
  // notion of that convention; it's free to place the "false" branch's subtree above the
  // "true" branch's, purely to minimize crossings elsewhere in the graph. When it does, the
  // Yes edge (leaving from the top handle) has to swing down past the No edge (leaving from
  // the bottom handle) swinging up, crossing directly beside the card. Detect that per
  // condition node and mirror each branch's *exclusive* subtree — including any spacer
  // nodes now standing in for its rank-skipping hops, so they stay consistent with whatever
  // real node they lead to — around the condition's own y, swapping which side they render
  // on to match the fixed handle positions. Shared merge points (and the spacers leading to
  // them) reachable from *both* branches are left untouched.
  const reachableFrom = (startId: string, excludeId: string): Set<string> => {
    const visited = new Set<string>();
    const stack = [startId];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (id === excludeId || visited.has(id)) continue;
      visited.add(id);
      for (const hop of expandedHops) {
        if (hop.source === id) stack.push(hop.target);
      }
    }
    return visited;
  };

  const conditionsByRank = nodes
    .filter((n) => n.type === 'condition')
    .sort((a, b) => (g.node(a.id)?.x ?? 0) - (g.node(b.id)?.x ?? 0));
  for (const condition of conditionsByRank) {
    const trueEdge = validEdges.find((e) => e.source === condition.id && e.sourceHandle === 'true');
    const falseEdge = validEdges.find((e) => e.source === condition.id && e.sourceHandle === 'false');
    if (!trueEdge || !falseEdge) continue;

    const trueNextId = routeNodeIds.get(trueEdge.id)?.[1];
    const falseNextId = routeNodeIds.get(falseEdge.id)?.[1];
    const centerY = g.node(condition.id)?.y;
    const trueY = trueNextId ? g.node(trueNextId)?.y : undefined;
    const falseY = falseNextId ? g.node(falseNextId)?.y : undefined;
    if (centerY === undefined || trueY === undefined || falseY === undefined || trueY <= falseY) continue;

    // Start each side's reachability walk at its *first hop* (a spacer, if the edge skips
    // any ranks, otherwise the real target directly) rather than at trueEdge/falseEdge's
    // real target — starting at the target would skip every spacer standing in for that
    // same edge's own rank-skipping hops, since they sit *before* the target in the route,
    // not reachable by walking forward from it.
    const reachTrue = reachableFrom(trueNextId!, condition.id);
    const reachFalse = reachableFrom(falseNextId!, condition.id);
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
  // instead of a straight line. Force an exact y match for every hop — real or spacer —
  // that is unambiguously a straight pass-through (its only predecessor's only successor),
  // leaving every real branch or merge point (anything with siblings) exactly as dagre
  // positioned it. Processed in rank (x) order so a parent snapped from *its* own parent is
  // already resolved before its children are considered.
  const outDegree = new Map<string, number>();
  const inDegree = new Map<string, number>();
  const allExpandedIds = new Set<string>();
  for (const hop of expandedHops) {
    outDegree.set(hop.source, (outDegree.get(hop.source) ?? 0) + 1);
    inDegree.set(hop.target, (inDegree.get(hop.target) ?? 0) + 1);
    allExpandedIds.add(hop.source);
    allExpandedIds.add(hop.target);
  }
  const soleParentOf = new Map<string, string>();
  for (const hop of expandedHops) {
    if (outDegree.get(hop.source) === 1 && inDegree.get(hop.target) === 1) {
      soleParentOf.set(hop.target, hop.source);
    }
  }
  const byRank = [...allExpandedIds].sort((a, b) => (g.node(a)?.x ?? 0) - (g.node(b)?.x ?? 0));
  for (const id of byRank) {
    const parentId = soleParentOf.get(id);
    if (!parentId) continue;
    const parentPos = g.node(parentId);
    const childPos = g.node(id);
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

  const layoutedEdges = edges.map((edge) => {
    const route = routeNodeIds.get(edge.id);
    const hasStaleBend = edge.data?.bendPoints !== undefined;
    if (!route || route.length <= 2) {
      return hasStaleBend ? { ...edge, data: { ...edge.data, bendPoints: undefined } } : edge;
    }
    const bendPoints = route.slice(1, -1).map((id) => {
      const pos = g.node(id);
      return { x: pos?.x ?? 0, y: pos?.y ?? 0 };
    });
    return { ...edge, data: { ...edge.data, bendPoints } };
  });

  return { nodes: layoutedNodes, edges: layoutedEdges };
}

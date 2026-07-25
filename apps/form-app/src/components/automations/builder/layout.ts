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

const RANK_SEP = 72;
const NODE_SEP = 48;

/**
 * Runs dagre's TB (top-to-bottom) auto-layout over the given nodes/edges and returns
 * new node objects with recomputed `position`, plus the edges enriched with any bend
 * points dagre computed for them. Nodes are never user-draggable in this builder, so
 * this is the single source of truth for node position after every graph mutation
 * (insert/remove/load).
 */
export function layoutAutomationGraph(
  nodes: AutomationNode[],
  edges: AutomationEdge[]
): { nodes: AutomationNode[]; edges: AutomationEdge[] } {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'TB', nodesep: NODE_SEP, ranksep: RANK_SEP });
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

  // dagre's within-rank X-coordinate heuristic (Brandes-Köpf) doesn't always perfectly
  // center a node under its single parent when that parent's *other* descendants pull the
  // alignment pass toward a different median — even though aligning them costs nothing,
  // since neither end has any other position constraint. The resulting few-pixel offset is
  // too small for getSmoothStepPath's corner rounding to resolve into a clean diagonal, so
  // it draws as a barely-visible S-shaped wiggle instead of a straight line. Force an exact
  // x match for every hop that is unambiguously a straight pass-through — the source's only
  // outgoing edge and the target's only incoming edge — leaving every real branch or merge
  // point (anything with siblings) exactly as dagre positioned it. Processed in rank (y)
  // order so a parent snapped from *its* own parent is already resolved before its children
  // are considered.
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
  const byRank = [...nodes].sort((a, b) => (g.node(a.id)?.y ?? 0) - (g.node(b.id)?.y ?? 0));
  for (const node of byRank) {
    const parentId = soleParentOf.get(node.id);
    if (!parentId) continue;
    const parentPos = g.node(parentId);
    const childPos = g.node(node.id);
    if (parentPos && childPos) childPos.x = parentPos.x;
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

  // An edge that skips a rank — e.g. a condition branch with a single action, wired
  // straight to a node that also has other, longer incoming paths — gets dummy chain
  // nodes from dagre, exposed as extra interior points on the edge label. Only treat an
  // edge as needing those bend points when it genuinely spans more than one rank: dagre
  // attaches an interior "edge label" point to every edge it lays out (even a plain
  // adjacent-rank one), so `points.length` alone isn't a reliable signal.
  //
  // Rank is derived from dagre's own computed y (nodes in the same rank always land on
  // an identical y in TB layout) rather than reimplemented as a longest-path-from-root
  // calculation: dagre's network-simplex ranker can push a node meaningfully further
  // down than its shortest/longest incoming path alone would suggest, to minimize total
  // edge length across the *whole* graph (e.g. a branch with one action, feeding into an
  // End node that other, longer branches also feed into, gets pulled down to align with
  // those siblings). A naive recomputation disagreed with dagre's real placement in
  // exactly that case, so a genuinely multi-rank edge was misclassified as adjacent and
  // drawn as one straight segment cutting across the intervening nodes.
  const rankIndexByY = new Map<number, number>(
    [...new Set(nodes.map((n) => g.node(n.id)?.y).filter((y): y is number => y !== undefined))]
      .sort((a, b) => a - b)
      .map((y, i) => [y, i])
  );
  const rankOf = (nodeId: string): number | undefined => {
    const y = g.node(nodeId)?.y;
    return y === undefined ? undefined : rankIndexByY.get(y);
  };

  const layoutedEdges = edges.map((edge) => {
    if (!g.hasNode(edge.source) || !g.hasNode(edge.target)) return edge;
    const sourceRank = rankOf(edge.source);
    const targetRank = rankOf(edge.target);
    const rankGap = sourceRank !== undefined && targetRank !== undefined ? targetRank - sourceRank : 1;
    if (rankGap <= 1) return edge;

    const dagreEdge = g.edge(edge.source, edge.target);
    const bendPoints = dagreEdge?.points?.slice(1, -1);
    if (!bendPoints || bendPoints.length === 0) return edge;
    return { ...edge, data: { ...edge.data, bendPoints } };
  });

  // Sibling branches that reconverge on the same node (e.g. two action nodes on
  // different branches that both feed the shared End node) commonly share an identical
  // source Y (same rank) and, by definition, an identical target point — so
  // getSmoothStepPath's default midpoint-based bend computes the exact same Y for every
  // one of them, and their paths become pixel-identical for the final approach into the
  // node instead of reading as distinct converging lines. Tag each edge with its index
  // among siblings sharing a target (ordered left-to-right by source X, for a stable,
  // deterministic result) so AddStepEdge can stagger each one's bend depth.
  const siblingsByTarget = new Map<string, AutomationEdge[]>();
  for (const edge of layoutedEdges) {
    const list = siblingsByTarget.get(edge.target) ?? [];
    list.push(edge);
    siblingsByTarget.set(edge.target, list);
  }

  const finalEdges = layoutedEdges.map((edge) => {
    const siblings = siblingsByTarget.get(edge.target);
    if (!siblings || siblings.length <= 1) return edge;
    const ordered = [...siblings].sort((a, b) => (g.node(a.source)?.x ?? 0) - (g.node(b.source)?.x ?? 0));
    const mergeIndex = ordered.findIndex((e) => e.id === edge.id);
    return { ...edge, data: { ...edge.data, mergeIndex, mergeCount: siblings.length } };
  });

  return { nodes: layoutedNodes, edges: finalEdges };
}

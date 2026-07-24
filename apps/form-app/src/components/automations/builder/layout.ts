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
  action: { width: 280, height: 92 },
  end: { width: 180, height: 56 },
};

const RANK_SEP = 72;
const NODE_SEP = 48;

/**
 * Runs dagre's TB (top-to-bottom) auto-layout over the given nodes/edges and returns
 * new node objects with recomputed `position`. Nodes are never user-draggable in this
 * builder, so this is the single source of truth for node position after every graph
 * mutation (insert/remove/load).
 */
export function layoutAutomationGraph(
  nodes: AutomationNode[],
  edges: AutomationEdge[]
): AutomationNode[] {
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

  return nodes.map((node) => {
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
}

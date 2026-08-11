import dagre from '@dagrejs/dagre';
import type { Edge, Node } from '@xyflow/react';
import { MarkerType, Position } from '@xyflow/react';
import type { DocDiagram, DocNodeData } from './types';

export type DocsFlowNode = Node<DocNodeData, 'doc'>;

/**
 * Fallback size used before React Flow has measured the real card. Docs nodes
 * are a fixed width by design (see DocsNode) so only the height varies, and it
 * varies little — a one-line label vs. a two-line one plus an optional badge.
 */
const NODE_WIDTH = 220;
const NODE_HEIGHT = 76;

const RANK_SEP = 56;
const NODE_SEP = 28;

/**
 * Lays a doc diagram out with dagre and converts it into React Flow's node/edge
 * shape.
 *
 * Unlike the automation builder's layout (which has to cope with user-authored
 * graphs containing rank-skipping branch merges), doc diagrams are authored by
 * hand and stay small and mostly tree-shaped, so plain dagre with no spacer-node
 * trickery is enough. If a diagram ever needs that, it's a sign the diagram is
 * trying to say too much and should be split.
 */
export function layoutDocDiagram(diagram: DocDiagram): {
  nodes: DocsFlowNode[];
  edges: Edge[];
} {
  const isHorizontal = diagram.direction === 'LR';

  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: diagram.direction, nodesep: NODE_SEP, ranksep: RANK_SEP });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of diagram.nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of diagram.edges) {
    // Skip edges pointing at nodes that don't exist rather than letting dagre
    // invent them — a typo in a hand-authored diagram should drop one arrow,
    // not add a phantom box to the canvas.
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      g.setEdge(edge.source, edge.target);
    }
  }

  dagre.layout(g);

  const nodes: DocsFlowNode[] = diagram.nodes.map((node) => {
    const positioned = g.node(node.id);
    return {
      id: node.id,
      type: 'doc' as const,
      data: node.data,
      position: {
        x: (positioned?.x ?? 0) - NODE_WIDTH / 2,
        y: (positioned?.y ?? 0) - NODE_HEIGHT / 2,
      },
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
    };
  });

  const edges: Edge[] = diagram.edges
    .filter((edge) => g.hasNode(edge.source) && g.hasNode(edge.target))
    .map((edge) => ({
      id: `${edge.source}->${edge.target}`,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      type: 'smoothstep',
      animated: false,
      style: edge.async
        ? { strokeDasharray: '5 4', stroke: 'var(--tf-light-muted)' }
        : { stroke: 'var(--tf-border-strong)' },
      labelStyle: { fontSize: 11, fill: 'var(--tf-light-muted)' },
      labelBgStyle: { fill: 'var(--tf-surface, transparent)' },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 14,
        height: 14,
        color: edge.async ? 'var(--tf-light-muted)' : 'var(--tf-border-strong)',
      },
    }));

  return { nodes, edges };
}

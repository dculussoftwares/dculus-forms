import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  useReactFlow,
  type NodeChange,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useAutomationBuilderStore } from '../../../store/useAutomationBuilderStore';
import { TriggerNode } from './nodes/TriggerNode';
import { DelayNode } from './nodes/DelayNode';
import { ConditionNode } from './nodes/ConditionNode';
import { ActionNode } from './nodes/ActionNode';
import { EndNode } from './nodes/EndNode';
import { AddStepEdge } from './edges/AddStepEdge';
import { NodeConfigPanel } from './NodeConfigPanel';

const nodeTypes = {
  trigger: TriggerNode,
  delay: DelayNode,
  condition: ConditionNode,
  action: ActionNode,
  end: EndNode,
};

const edgeTypes = {
  addStep: AddStepEdge,
};

interface AutomationCanvasProps {
  /** Form record passed through to action config forms (mention fields, PDF templates, ...). */
  form?: any;
}

const AutomationCanvasInner: React.FC<AutomationCanvasProps> = ({ form }) => {
  const nodes = useAutomationBuilderStore((s) => s.nodes);
  const edges = useAutomationBuilderStore((s) => s.edges);
  const selectedNodeId = useAutomationBuilderStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useAutomationBuilderStore((s) => s.setSelectedNodeId);
  const applyMeasuredLayout = useAutomationBuilderStore((s) => s.applyMeasuredLayout);
  const { fitView } = useReactFlow();

  // dagre lays nodes out using DEFAULT_DIMENSIONS (layout.ts) before React Flow has ever
  // rendered them, since real widths depend on label text (condition summaries, i18n) and
  // differ from the fallback per node type. React Flow reports each node's real rendered
  // size as a 'dimensions' NodeChange once its ResizeObserver fires (on mount, and again on
  // any insert/remove); `useNodesInitialized()` cannot substitute for this — it's derived
  // from whatever `.measured` is already sitting on the *external* nodes prop we hand back
  // in, which never happens in a purely store-controlled canvas like this one, so it would
  // never flip true. Feeding real sizes back through here keeps edges landing exactly on
  // each node's rendered handle instead of the dagre-assumed center.
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const dimensionChanges = changes
        .filter((change) => change.type === 'dimensions' && change.dimensions)
        .map((change) => {
          const c = change as Extract<NodeChange, { type: 'dimensions' }>;
          return { id: c.id, width: c.dimensions!.width, height: c.dimensions!.height };
        });
      if (dimensionChanges.length > 0) applyMeasuredLayout(dimensionChanges);
    },
    [applyMeasuredLayout]
  );

  // Automations can grow wide once a few branches/steps are added, easily pushing a
  // freshly-inserted step outside the current viewport with no indication anything
  // changed. insertStepOnEdge always selects the node it just created, so a node id that
  // (a) wasn't present last render and (b) is the current selection can only mean "the
  // user just added a step" — not an existing-node click (no new id) or a fresh
  // automation load (multiple/all ids appear new at once, never exactly one on a graph
  // that always has at least a trigger + End node). Panning only in that specific case
  // avoids fighting the user's manual pan/zoom the rest of the time.
  const previousNodeIdsRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    const currentIds = new Set(nodes.map((n) => n.id));
    const previousIds = previousNodeIdsRef.current;
    previousNodeIdsRef.current = currentIds;
    if (!previousIds) return; // first render — the `fitView` prop already handles this

    const newlyAdded = [...currentIds].filter((id) => !previousIds.has(id));
    if (newlyAdded.length === 1 && newlyAdded[0] === selectedNodeId) {
      fitView({ nodes: [{ id: newlyAdded[0] }], duration: 400, padding: 0.5, maxZoom: 1 });
    }
  }, [nodes, selectedNodeId, fitView]);

  const onNodeClick = useCallback<NodeMouseHandler>(
    (_event, node) => {
      setSelectedNodeId(node.id);
    },
    [setSelectedNodeId]
  );

  const onPaneClick = useCallback(() => setSelectedNodeId(null), [setSelectedNodeId]);

  // A small closed arrowhead just before each node, matching the reference workflow
  // builder's line language — applied here at render time rather than baked into every
  // edge-creation call site in automationBuilderSlice.ts, since it's pure presentation.
  const edgesWithMarkers = useMemo(
    () =>
      edges.map((edge) => ({
        ...edge,
        markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--tf-light-muted)', width: 16, height: 16 },
      })),
    [edges]
  );

  return (
    <div className="flex h-full w-full overflow-hidden">
      <div className="flex-1 min-w-0" data-testid="automation-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edgesWithMarkers}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onNodesChange={onNodesChange}
          nodesDraggable={false}
          nodesConnectable={false}
          edgesFocusable={false}
          panOnDrag
          zoomOnScroll
          fitView
          proOptions={{ hideAttribution: true }}
          minZoom={0.3}
          maxZoom={1.5}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--tf-border-strong)" />
          <Controls showInteractive={false} position="bottom-left" />
          <MiniMap
            position="bottom-right"
            pannable
            zoomable
            nodeColor="var(--tf-light-muted)"
            nodeStrokeWidth={0}
            maskColor="var(--tf-overlay)"
            style={{ border: '1px solid var(--tf-border-medium)', borderRadius: 8 }}
          />
        </ReactFlow>
      </div>
      <NodeConfigPanel form={form} />
    </div>
  );
};

export const AutomationCanvas: React.FC<AutomationCanvasProps> = (props) => (
  <ReactFlowProvider>
    <AutomationCanvasInner {...props} />
  </ReactFlowProvider>
);

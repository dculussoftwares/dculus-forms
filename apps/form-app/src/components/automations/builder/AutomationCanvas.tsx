import React, { useCallback } from 'react';
import { ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Controls, type NodeMouseHandler } from '@xyflow/react';
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
  const setSelectedNodeId = useAutomationBuilderStore((s) => s.setSelectedNodeId);

  const onNodeClick = useCallback<NodeMouseHandler>(
    (_event, node) => {
      setSelectedNodeId(node.id);
    },
    [setSelectedNodeId]
  );

  const onPaneClick = useCallback(() => setSelectedNodeId(null), [setSelectedNodeId]);

  return (
    <div className="flex h-full w-full overflow-hidden">
      <div className="flex-1 min-w-0" data-testid="automation-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
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

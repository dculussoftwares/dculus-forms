import React, { useCallback, useMemo, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { FileCode2, MousePointerClick, Share2, X } from 'lucide-react';
import { Badge } from '@dculus/ui';
import { cn } from '@dculus/utils';
import type { DocDiagram, DocNodeData } from '../types';
import { layoutDocDiagram } from '../layout';
import { DocsNode, NODE_KIND_STYLES } from './DocsNode';

const nodeTypes = { doc: DocsNode };

interface DocsCanvasProps {
  diagram: DocDiagram;
}

/** Explanation for the currently selected node. Empty state doubles as the hint. */
const DetailPanel: React.FC<{ node?: DocNodeData; onClose: () => void }> = ({ node, onClose }) => {
  if (!node) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
        <MousePointerClick className="h-5 w-5 text-slate-300 dark:text-slate-600" />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Click any box to see what it does and which file it lives in.
        </p>
      </div>
    );
  }

  const style = NODE_KIND_STYLES[node.kind] ?? NODE_KIND_STYLES.effect;

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex items-start justify-between gap-2 border-b border-slate-200 dark:border-slate-800 px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{node.label}</h3>
          <span className={cn('text-xs', style.text)}>{style.label}</span>
        </div>
        <button
          onClick={onClose}
          aria-label="Close details"
          className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4 px-4 py-4">
        <div>
          <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            What it does
          </h4>
          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{node.does}</p>
        </div>

        {node.note && (
          <div>
            <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Why it works this way
            </h4>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{node.note}</p>
          </div>
        )}

        {node.shared && (
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3">
            <h4 className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <Share2 className="h-3 w-3" />
              Shared surface
            </h4>
            <p className="text-sm text-slate-600 dark:text-slate-400">{node.shared}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
              Other subsystems depend on this — see “Shared surfaces” below.
            </p>
          </div>
        )}

        {node.file && (
          <div>
            <h4 className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <FileCode2 className="h-3 w-3" />
              Source
            </h4>
            <code className="block break-all rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-1.5 font-mono text-[11px] text-slate-700 dark:text-slate-300">
              {node.file}
              {node.line ? `:${node.line}` : ''}
            </code>
          </div>
        )}
      </div>
    </div>
  );
};

const DocsCanvasInner: React.FC<DocsCanvasProps> = ({ diagram }) => {
  const { nodes, edges } = useMemo(() => layoutDocDiagram(diagram), [diagram]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const onNodeClick = useCallback<NodeMouseHandler>((_event, node) => {
    setSelectedId((current) => (current === node.id ? null : node.id));
  }, []);

  const nodesWithSelection = useMemo(
    () => nodes.map((node) => ({ ...node, selected: node.id === selectedId })),
    [nodes, selectedId]
  );

  const selected = useMemo(
    () => nodes.find((node) => node.id === selectedId)?.data,
    [nodes, selectedId]
  );

  // Only the kinds this diagram actually uses — a legend listing six kinds when
  // the diagram shows three is noise.
  const usedKinds = useMemo(
    () => [...new Set(diagram.nodes.map((node) => node.data.kind))],
    [diagram]
  );

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-slate-200 dark:border-slate-800 px-4 py-2.5">
        {usedKinds.map((kind) => {
          const style = NODE_KIND_STYLES[kind];
          return (
            <span key={kind} className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              <span className={cn('h-2 w-2 rounded-full', style.dot)} />
              {style.label}
            </span>
          );
        })}
        <Badge variant="secondary" className="ml-auto text-[10px] font-normal">
          Dashed = asynchronous
        </Badge>
      </div>

      <div className="flex h-[720px] flex-col lg:flex-row">
        <div className="min-h-[320px] flex-1">
          <ReactFlow
            nodes={nodesWithSelection}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodeClick={onNodeClick}
            onPaneClick={() => setSelectedId(null)}
            nodesDraggable={false}
            nodesConnectable={false}
            edgesFocusable={false}
            panOnDrag
            zoomOnScroll={false}
            zoomOnPinch
            fitView
            fitViewOptions={{ padding: 0.15 }}
            minZoom={0.25}
            maxZoom={1.4}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} className="opacity-60" />
            <Controls showInteractive={false} position="bottom-left" />
          </ReactFlow>
        </div>

        <aside className="w-full shrink-0 border-t border-slate-200 dark:border-slate-800 lg:w-80 lg:border-l lg:border-t-0">
          <DetailPanel node={selected} onClose={() => setSelectedId(null)} />
        </aside>
      </div>
    </div>
  );
};

export const DocsCanvas: React.FC<DocsCanvasProps> = (props) => (
  <ReactFlowProvider>
    <DocsCanvasInner {...props} />
  </ReactFlowProvider>
);

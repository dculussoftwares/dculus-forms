import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Cloud, Database, Play, Save, ShieldCheck, Share2, Zap } from 'lucide-react';
import { cn } from '@dculus/utils';
import type { DocNodeData, DocNodeKind } from '../types';
import type { DocsFlowNode } from '../layout';

/**
 * Colour and icon per node kind. The legend on the canvas is generated from this
 * same map, so a new kind shows up there automatically.
 */
export const NODE_KIND_STYLES: Record<
  DocNodeKind,
  { label: string; icon: React.ElementType; dot: string; ring: string; text: string }
> = {
  entry: {
    label: 'Entry point',
    icon: Play,
    dot: 'bg-blue-500',
    ring: 'border-blue-200 dark:border-blue-900',
    text: 'text-blue-600 dark:text-blue-400',
  },
  gate: {
    label: 'Check that can reject',
    icon: ShieldCheck,
    dot: 'bg-amber-500',
    ring: 'border-amber-200 dark:border-amber-900',
    text: 'text-amber-600 dark:text-amber-400',
  },
  write: {
    label: 'Durable write',
    icon: Save,
    dot: 'bg-emerald-500',
    ring: 'border-emerald-200 dark:border-emerald-900',
    text: 'text-emerald-600 dark:text-emerald-400',
  },
  effect: {
    label: 'Cannot fail the request',
    icon: Zap,
    dot: 'bg-violet-500',
    ring: 'border-violet-200 dark:border-violet-900',
    text: 'text-violet-600 dark:text-violet-400',
  },
  store: {
    label: 'Datastore or queue',
    icon: Database,
    dot: 'bg-slate-400',
    ring: 'border-slate-200 dark:border-slate-700',
    text: 'text-slate-600 dark:text-slate-400',
  },
  external: {
    label: 'Third party',
    icon: Cloud,
    dot: 'bg-rose-500',
    ring: 'border-rose-200 dark:border-rose-900',
    text: 'text-rose-600 dark:text-rose-400',
  },
};

const fileBasename = (file?: string) => (file ? file.split('/').pop() : undefined);

export const DocsNode: React.FC<NodeProps<DocsFlowNode>> = ({
  data,
  selected,
  sourcePosition = Position.Bottom,
  targetPosition = Position.Top,
}) => {
  const node = data as DocNodeData;
  const style = NODE_KIND_STYLES[node.kind] ?? NODE_KIND_STYLES.effect;
  const Icon = style.icon;
  const basename = fileBasename(node.file);

  return (
    <div
      className={cn(
        'w-[220px] rounded-xl border bg-white dark:bg-slate-900 px-3 py-2.5 shadow-sm transition-all',
        'cursor-pointer hover:shadow-md',
        style.ring,
        selected && 'ring-2 ring-offset-1 ring-blue-500 dark:ring-offset-slate-950 shadow-md'
      )}
    >
      {/* One handle per direction, positioned from the layout's rankdir — a second
          unnamed handle of the same type would collide on handle id. */}
      <Handle type="target" position={targetPosition} className="!opacity-0" />

      <div className="flex items-start gap-2">
        <span className={cn('mt-0.5 shrink-0', style.text)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="text-[13px] font-medium leading-snug text-slate-900 dark:text-slate-100">
          {node.label}
        </span>
      </div>

      {basename && (
        <div className="mt-1.5 truncate pl-[22px] font-mono text-[10px] text-slate-400 dark:text-slate-500">
          {basename}
          {node.line ? `:${node.line}` : ''}
        </div>
      )}

      {/* Block rather than inline-flex: these labels are sentences, and an
          inline badge pushes past the card's fixed width once it wraps. */}
      {node.shared && (
        <div className="mt-1.5 ml-[22px] flex items-start gap-1 rounded-md bg-slate-100 dark:bg-slate-800 px-1.5 py-1 text-[10px] font-medium leading-tight text-slate-600 dark:text-slate-300">
          <Share2 className="mt-px h-2.5 w-2.5 shrink-0" />
          <span className="min-w-0">{node.shared}</span>
        </div>
      )}

      <Handle type="source" position={sourcePosition} className="!opacity-0" />
    </div>
  );
};

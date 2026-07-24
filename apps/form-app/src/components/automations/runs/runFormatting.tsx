import React from 'react';
import { Clock, Flag, GitBranch, Loader2, Webhook, Zap, type LucideIcon } from 'lucide-react';
import { ACTION_ICON_MAP, getActionManifest } from '../builder/actionCatalog';

export const ACTIVE_RUN_STATUSES = ['RUNNING', 'WAITING'];

export const isRunActive = (status: string | undefined | null) =>
  !!status && ACTIVE_RUN_STATUSES.includes(status);

export function formatDuration(startedAt: string, endedAt?: string | null): string | null {
  if (!endedAt) return null;
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  if (ms < 1000) return `${ms}ms`;
  const totalSeconds = ms / 1000;
  if (totalSeconds < 60) return `${totalSeconds.toFixed(1)}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return `${minutes}m ${seconds}s`;
}

const RUN_STATUS_STYLE: Record<string, React.CSSProperties> = {
  RUNNING: { backgroundColor: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' },
  WAITING: { backgroundColor: 'rgba(190,153,58,0.08)', color: '#9c7818', border: '1px solid rgba(190,153,58,0.16)' },
  COMPLETED: { backgroundColor: 'var(--tf-green-bg)', color: 'var(--tf-green)', border: '1px solid var(--tf-green-bg-md)' },
  FAILED: { backgroundColor: 'var(--tf-error-bg)', color: 'var(--tf-error)', border: '1px solid var(--tf-error-bg-md)' },
  CANCELLED: { backgroundColor: 'var(--tf-faint)', color: 'var(--tf-muted)', border: '1px solid var(--tf-border)' },
};

export const runStatusStyle = (status: string): React.CSSProperties =>
  RUN_STATUS_STYLE[status] ?? RUN_STATUS_STYLE.CANCELLED;

const STEP_STATUS_STYLE: Record<string, React.CSSProperties> = {
  SUCCESS: { backgroundColor: 'var(--tf-green-bg)', color: 'var(--tf-green)', border: '1px solid var(--tf-green-bg-md)' },
  FAILED: { backgroundColor: 'var(--tf-error-bg)', color: 'var(--tf-error)', border: '1px solid var(--tf-error-bg-md)' },
  SKIPPED: { backgroundColor: 'var(--tf-faint)', color: 'var(--tf-muted)', border: '1px solid var(--tf-border)' },
};

export const stepStatusStyle = (status: string): React.CSSProperties =>
  STEP_STATUS_STYLE[status] ?? STEP_STATUS_STYLE.SKIPPED;

export function getRunStatusIcon(status: string) {
  if (status === 'RUNNING' || status === 'WAITING') return Loader2;
  return null;
}

export function getStepIcon(nodeType: string): LucideIcon {
  if (nodeType === 'trigger') return Zap;
  if (nodeType === 'delay') return Clock;
  if (nodeType === 'condition') return GitBranch;
  if (nodeType === 'end') return Flag;
  if (nodeType.startsWith('action:')) {
    const actionType = nodeType.slice('action:'.length);
    const manifest = getActionManifest(actionType);
    return manifest ? (ACTION_ICON_MAP[manifest.icon] ?? Webhook) : Webhook;
  }
  return Webhook;
}

export function getStepLabel(nodeType: string): string {
  if (nodeType.startsWith('action:')) {
    const actionType = nodeType.slice('action:'.length);
    return getActionManifest(actionType)?.name ?? actionType;
  }
  return nodeType;
}

import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Badge, Tooltip, TooltipContent, TooltipTrigger } from '@dculus/ui';
import { AlertTriangle, X } from 'lucide-react';

interface NodeCardProps {
  selected?: boolean;
  hasError?: boolean;
  errorMessage?: string;
  showTargetHandle?: boolean;
  showSourceHandle?: boolean;
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle?: string;
  setupRequiredLabel?: string;
  showSetupRequired?: boolean;
  onDelete?: () => void;
  deleteLabel?: string;
  width?: number;
  children?: React.ReactNode;
}

/**
 * Shared Typeform-style card shell for every automation node. Handles the
 * selected/error outline states and the left/right connection handles (the canvas lays
 * out left-to-right) — the individual node components (TriggerNode, DelayNode, ...) only
 * supply content.
 */
export const NodeCard: React.FC<NodeCardProps> = ({
  selected,
  hasError,
  errorMessage,
  showTargetHandle = true,
  showSourceHandle = true,
  icon,
  iconBg,
  title,
  subtitle,
  setupRequiredLabel,
  showSetupRequired,
  onDelete,
  deleteLabel,
  width = 280,
  children,
}) => {
  const cardBorder = hasError
    ? '1px solid var(--tf-error)'
    : selected
      ? '1.5px solid var(--tf-dark)'
      : '1px solid var(--tf-border-medium)';

  const card = (
    <div
      className="group relative rounded-xl bg-white dark:bg-card px-4 py-3 transition-shadow"
      style={{
        width,
        border: cardBorder,
        boxShadow: hasError
          ? '0 0 0 3px var(--tf-error-bg-md)'
          : selected
            ? '0 1px 6px var(--tf-overlay)'
            : '0 1px 3px var(--tf-overlay)',
      }}
      data-testid="automation-node-card"
    >
      {showTargetHandle && <Handle type="target" position={Position.Left} className="!bg-[var(--tf-light-muted)]" />}

      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label={deleteLabel}
          className="absolute -top-2.5 -right-2.5 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-white text-muted-foreground shadow hover:text-destructive"
          style={{ border: '1px solid var(--tf-border-medium)' }}
        >
          <X className="h-3 w-3" />
        </button>
      )}

      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: iconBg }}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--tf-dark)' }}>
            {title}
          </p>
          {subtitle && (
            <p className="text-xs truncate" style={{ color: 'var(--tf-muted)' }}>
              {subtitle}
            </p>
          )}
        </div>
        {hasError && <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: 'var(--tf-error)' }} />}
      </div>

      {children}

      {showSetupRequired && (
        <Badge
          variant="outline"
          className="mt-2 text-[10px] border-[var(--tf-error-bg-md)]"
          style={{ backgroundColor: 'var(--tf-error-bg)', color: 'var(--tf-error)' }}
        >
          {setupRequiredLabel}
        </Badge>
      )}

      {showSourceHandle && <Handle type="source" position={Position.Right} className="!bg-[var(--tf-light-muted)]" />}
    </div>
  );

  if (hasError && errorMessage) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{card}</TooltipTrigger>
        <TooltipContent side="right">{errorMessage}</TooltipContent>
      </Tooltip>
    );
  }

  return card;
};

import React, { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Badge, Button, Popover, PopoverContent, PopoverTrigger } from '@dculus/ui';
import { AlertTriangle, Check, Copy, X } from 'lucide-react';
import { useTranslation } from '../../../../hooks/useTranslation';

interface NodeCardProps {
  selected?: boolean;
  hasError?: boolean;
  /** One entry per validation error on this node — shown as separate wrapped lines, not just the first. */
  errorMessages?: string[];
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
  errorMessages,
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
  const { t } = useTranslation('automations');
  const [copied, setCopied] = useState(false);

  const handleCopyErrors = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!errorMessages?.length) return;
    try {
      await navigator.clipboard.writeText(errorMessages.join('\n\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — the text is still visible and
      // selectable in the popover itself, so this failure is silent rather than a toast.
    }
  };

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
        {hasError &&
          (errorMessages?.length ? (
            // A click-to-open popover, not a hover tooltip — a tooltip closes the instant the
            // pointer leaves the trigger, so a long validation message can never be read in full
            // or selected/copied before it vanishes. This stays open until dismissed, wraps
            // every error onto its own line, and offers a one-click copy of the full text.
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0 rounded-full"
                  aria-label={t('builder.nodes.errorDetails')}
                  data-testid="automation-node-error-trigger"
                >
                  <AlertTriangle className="h-4 w-4" style={{ color: 'var(--tf-error)' }} />
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="right"
                align="start"
                className="w-80 space-y-2 p-3"
                data-testid="automation-node-error-popover"
              >
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {errorMessages.map((message, i) => (
                    <p
                      key={i}
                      className="text-xs whitespace-normal break-words leading-relaxed"
                      style={{ color: 'var(--tf-error)' }}
                    >
                      {message}
                    </p>
                  ))}
                </div>
                <Button type="button" variant="outline" size="sm" className="w-full gap-1.5" onClick={handleCopyErrors}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? t('builder.nodes.errorCopied') : t('builder.nodes.copyError')}
                </Button>
              </PopoverContent>
            </Popover>
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: 'var(--tf-error)' }} />
          ))}
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

  return card;
};

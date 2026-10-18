import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@dculus/ui';
import { useTranslation } from '../../../hooks/useTranslation';
import { useAutomationBuilderStore } from '../../../store/useAutomationBuilderStore';

interface IssuesPillProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Set when the popover was opened because a publish was refused, to say why. */
  blockingPublish: boolean;
}

/**
 * "N issues" — everything the server says currently stops this draft from being published, as of
 * its last autosave. Clicking an issue selects the offending step. The draft saves regardless;
 * these only gate Publish.
 */
export const IssuesPill: React.FC<IssuesPillProps> = ({ open, onOpenChange, blockingPublish }) => {
  const { t } = useTranslation('automations');
  const nodes = useAutomationBuilderStore((s) => s.nodes);
  const validationErrorsByNode = useAutomationBuilderStore((s) => s.validationErrorsByNode);
  const structuralErrors = useAutomationBuilderStore((s) => s.structuralErrors);
  const setSelectedNodeId = useAutomationBuilderStore((s) => s.setSelectedNodeId);

  const nodeIssues = Object.entries(validationErrorsByNode).flatMap(([nodeId, errors]) =>
    errors.map((error) => ({ nodeId, error }))
  );
  const total = nodeIssues.length + structuralErrors.length;
  if (total === 0) return null;

  const nodeLabel = (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    const name = (node?.data as { name?: string } | undefined)?.name;
    return name ?? (node ? t(`builder.panel.titles.${node.type}`, { defaultValue: String(node.type) }) : null);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="automation-issues-pill"
          className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium shrink-0"
          style={{ backgroundColor: 'var(--tf-error-bg)', color: 'var(--tf-error)', border: '1px solid var(--tf-error-bg-md)' }}
        >
          <AlertTriangle className="h-3 w-3" />
          {t('builder.header.issuesPill', { values: { count: total } })}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        {blockingPublish && (
          <p className="px-4 pt-3 text-sm font-medium" style={{ color: 'var(--tf-dark)' }}>
            {t('builder.header.issuesBlockingTitle', { values: { count: total } })}
          </p>
        )}
        <ul className="max-h-64 overflow-y-auto py-2">
          {nodeIssues.map(({ nodeId, error }, index) => (
            <li key={`${nodeId}-${error.code}-${index}`}>
              <button
                type="button"
                className="w-full px-4 py-2 text-left text-xs hover:bg-[rgba(87,84,91,0.04)]"
                onClick={() => {
                  setSelectedNodeId(nodeId);
                  onOpenChange(false);
                }}
              >
                {nodeLabel(nodeId) && <span className="block font-medium text-muted-foreground">{nodeLabel(nodeId)}</span>}
                {error.message}
              </button>
            </li>
          ))}
          {structuralErrors.map((error, index) => (
            <li key={`structural-${error.code}-${index}`} className="px-4 py-2 text-xs">
              {error.message}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
};

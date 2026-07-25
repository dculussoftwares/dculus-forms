import React from 'react';
import type { NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import { Flag } from 'lucide-react';
import { useTranslation } from '../../../../hooks/useTranslation';
import type { AutomationNode } from '../layout';

export const EndNode: React.FC<NodeProps<AutomationNode>> = ({ selected }) => {
  const { t } = useTranslation('automations');

  return (
    <div
      className="rounded-full px-4 py-2 flex items-center gap-2 bg-white dark:bg-card"
      style={{
        border: selected ? '1.5px solid var(--tf-dark)' : '1px solid var(--tf-border-medium)',
        boxShadow: '0 1px 3px var(--tf-overlay)',
      }}
      data-testid="automation-node-card"
    >
      <Handle type="target" position={Position.Left} className="!bg-[var(--tf-light-muted)]" />
      <Flag className="h-3.5 w-3.5" style={{ color: 'var(--tf-muted)' }} />
      <span className="text-xs font-medium" style={{ color: 'var(--tf-muted)' }}>
        {t('builder.nodes.end.title')}
      </span>
    </div>
  );
};

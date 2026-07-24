import React from 'react';
import type { NodeProps } from '@xyflow/react';
import { Clock } from 'lucide-react';
import { useTranslation } from '../../../../hooks/useTranslation';
import { useAutomationBuilderStore } from '../../../../store/useAutomationBuilderStore';
import { NodeCard } from './NodeCard';
import type { AutomationNode } from '../layout';
import type { AutomationDelayNodeData } from '../types';

export const DelayNode: React.FC<NodeProps<AutomationNode>> = ({ id, data, selected }) => {
  const { t } = useTranslation('automations');
  const isReadOnly = useAutomationBuilderStore((s) => s.isReadOnly);
  const removeNode = useAutomationBuilderStore((s) => s.removeNode);
  const errors = useAutomationBuilderStore((s) => s.validationErrorsByNode[id]);

  const { amount, unit } = data as AutomationDelayNodeData;
  const safeUnit = unit ?? 'hours';
  const unitKey = amount === 1 ? safeUnit.slice(0, -1) : safeUnit;
  const unitLabel = t(`builder.nodes.delay.units.${unitKey}`);

  return (
    <NodeCard
      selected={selected}
      hasError={Boolean(errors?.length)}
      errorMessage={errors?.[0]?.message}
      icon={<Clock className="h-4 w-4" style={{ color: '#8b6a18' }} />}
      iconBg="#fbe19d"
      title={t('builder.nodes.delay.title')}
      subtitle={t('builder.nodes.delay.subtitle', { values: { amount: amount ?? 1, unit: unitLabel } })}
      width={260}
      onDelete={isReadOnly ? undefined : () => removeNode(id)}
      deleteLabel={t('builder.nodes.removeStep')}
    />
  );
};

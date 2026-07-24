import React from 'react';
import type { NodeProps } from '@xyflow/react';
import { Zap } from 'lucide-react';
import { useTranslation } from '../../../../hooks/useTranslation';
import { useAutomationBuilderStore } from '../../../../store/useAutomationBuilderStore';
import { NodeCard } from './NodeCard';
import type { AutomationNode } from '../layout';

export const TriggerNode: React.FC<NodeProps<AutomationNode>> = ({ selected }) => {
  const { t } = useTranslation('automations');
  const formTitle = useAutomationBuilderStore((s) => s.formTitle);

  return (
    <NodeCard
      selected={selected}
      showTargetHandle={false}
      icon={<Zap className="h-4 w-4" style={{ color: '#3949ab' }} />}
      iconBg="#e8eaf6"
      title={t('builder.nodes.trigger.title')}
      subtitle={t('builder.nodes.trigger.subtitle', { values: { form: formTitle || t('builder.nodes.trigger.thisForm') } })}
    />
  );
};

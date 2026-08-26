import React from 'react';
import type { NodeProps } from '@xyflow/react';
import { Filter } from 'lucide-react';
import { useTranslation } from '../../../../hooks/useTranslation';
import { useAutomationBuilderStore } from '../../../../store/useAutomationBuilderStore';
import { NodeCard } from './NodeCard';
import type { AutomationNode } from '../layout';
import type { AutomationDigestNodeData } from '../types';

export const DigestNode: React.FC<NodeProps<AutomationNode>> = ({ id, data, selected }) => {
  const { t } = useTranslation('automations');
  const isReadOnly = useAutomationBuilderStore((s) => s.isReadOnly);
  const removeNode = useAutomationBuilderStore((s) => s.removeNode);
  const errors = useAutomationBuilderStore((s) => s.validationErrorsByNode[id]);

  const { filters } = data as AutomationDigestNodeData;
  const filterCount = filters?.length ?? 0;

  return (
    <NodeCard
      selected={selected}
      hasError={Boolean(errors?.length)}
      errorMessages={errors?.map((e) => e.message)}
      icon={<Filter className="h-4 w-4" style={{ color: '#0e7490' }} />}
      iconBg="#cffafe"
      title={t('builder.nodes.digest.title')}
      subtitle={
        filterCount > 0
          ? t('builder.nodes.digest.subtitleWithFilters', { values: { count: filterCount } })
          : t('builder.nodes.digest.subtitleNoFilters')
      }
      width={260}
      onDelete={isReadOnly ? undefined : () => removeNode(id)}
      deleteLabel={t('builder.nodes.removeStep')}
    />
  );
};

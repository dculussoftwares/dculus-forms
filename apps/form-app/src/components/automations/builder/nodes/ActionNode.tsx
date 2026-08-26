import React from 'react';
import type { NodeProps } from '@xyflow/react';
import { Webhook } from 'lucide-react';
import { useTranslation } from '../../../../hooks/useTranslation';
import { useAutomationBuilderStore } from '../../../../store/useAutomationBuilderStore';
import { NodeCard } from './NodeCard';
import type { AutomationNode } from '../layout';
import type { AutomationActionNodeData } from '../types';
import { ACTION_ICON_MAP, getActionManifest } from '../actionCatalog';
import { isActionConfigIncomplete } from '../validation';

export const ActionNode: React.FC<NodeProps<AutomationNode>> = ({ id, data, selected }) => {
  const { t } = useTranslation('automations');
  const isReadOnly = useAutomationBuilderStore((s) => s.isReadOnly);
  const removeNode = useAutomationBuilderStore((s) => s.removeNode);
  const errors = useAutomationBuilderStore((s) => s.validationErrorsByNode[id]);

  const actionData = data as AutomationActionNodeData;
  const manifest = getActionManifest(actionData.actionType);
  const Icon = manifest ? (ACTION_ICON_MAP[manifest.icon] ?? Webhook) : Webhook;
  const incomplete = isActionConfigIncomplete(actionData);
  const hasServerError = Boolean(errors?.length);

  return (
    <NodeCard
      selected={selected}
      hasError={hasServerError}
      errorMessages={errors?.map((e) => e.message)}
      icon={<Icon className="h-4 w-4" style={{ color: manifest?.iconColor ?? 'var(--tf-dark)' }} />}
      iconBg={manifest?.iconBgColor ?? 'var(--tf-icon-gray)'}
      title={actionData.name || manifest?.name || actionData.actionType}
      subtitle={t('builder.nodes.action.subtitle')}
      showSetupRequired={!hasServerError && incomplete}
      setupRequiredLabel={t('builder.nodes.action.setupRequired')}
      onDelete={isReadOnly ? undefined : () => removeNode(id)}
      deleteLabel={t('builder.nodes.removeStep')}
    />
  );
};

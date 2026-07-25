import React from 'react';
import type { NodeProps } from '@xyflow/react';
import { Zap, Pencil, Clock as ClockIcon } from 'lucide-react';
import { useTranslation } from '../../../../hooks/useTranslation';
import { useAutomationBuilderStore } from '../../../../store/useAutomationBuilderStore';
import { NodeCard } from './NodeCard';
import type { AutomationNode } from '../layout';
import { describeCron } from '../cronDescription';
import { isValidCronExpression } from '../scheduleCronValidation';
import { triggerTypeI18nKey } from '../../triggerTypes';

const TRIGGER_ICONS: Record<string, { icon: React.ReactNode; bg: string }> = {
  'form.submitted': { icon: <Zap className="h-4 w-4" style={{ color: '#3949ab' }} />, bg: '#e8eaf6' },
  'response.edited': { icon: <Pencil className="h-4 w-4" style={{ color: '#8b6a18' }} />, bg: '#fbe19d' },
  schedule: { icon: <ClockIcon className="h-4 w-4" style={{ color: '#0f766e' }} />, bg: '#ccfbf1' },
};

export const TriggerNode: React.FC<NodeProps<AutomationNode>> = ({ selected }) => {
  const { t } = useTranslation('automations');
  const formTitle = useAutomationBuilderStore((s) => s.formTitle);
  const triggerType = useAutomationBuilderStore((s) => s.triggerType);
  const triggerConfig = useAutomationBuilderStore((s) => s.triggerConfig);

  const { icon, bg } = TRIGGER_ICONS[triggerType] ?? TRIGGER_ICONS['form.submitted'];
  const form = formTitle || t('builder.nodes.trigger.thisForm');

  let subtitle: string;
  let showSetupRequired = false;
  if (triggerType === 'response.edited') {
    subtitle = t('builder.nodes.trigger.subtitleResponseEdited', { values: { form } });
  } else if (triggerType === 'schedule') {
    const cron = triggerConfig?.cron;
    showSetupRequired = !isValidCronExpression(cron);
    subtitle = showSetupRequired
      ? t('builder.nodes.trigger.cron.notConfigured')
      : describeCron(cron, t);
  } else {
    subtitle = t('builder.nodes.trigger.subtitle', { values: { form } });
  }

  return (
    <NodeCard
      selected={selected}
      showTargetHandle={false}
      icon={icon}
      iconBg={bg}
      title={t(`triggerTypes.${triggerTypeI18nKey(triggerType)}`, { defaultValue: t('builder.nodes.trigger.title') })}
      subtitle={subtitle}
      showSetupRequired={showSetupRequired}
      setupRequiredLabel={t('builder.nodes.action.setupRequired')}
    />
  );
};

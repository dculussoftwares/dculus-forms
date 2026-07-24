import React from 'react';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@dculus/ui';
import { X } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import { useAutomationBuilderStore } from '../../../store/useAutomationBuilderStore';
import { getFrontendPlugin } from '../../../plugins/core/registry';
import '../../../plugins/index';
import type { AutomationActionNodeData, AutomationDelayNodeData, DelayUnit } from './types';
import { getActionManifest } from './actionCatalog';

interface NodeConfigPanelProps {
  form?: any;
}

const DelayEditor: React.FC<{ nodeId: string; data: AutomationDelayNodeData; disabled: boolean }> = ({
  nodeId,
  data,
  disabled,
}) => {
  const { t } = useTranslation('automations');
  const updateNodeData = useAutomationBuilderStore((s) => s.updateNodeData);

  return (
    <fieldset disabled={disabled} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="delay-amount">{t('builder.panel.delay.amountLabel')}</Label>
        <Input
          id="delay-amount"
          type="number"
          min={1}
          value={data.amount ?? 1}
          onChange={(e) => updateNodeData(nodeId, { amount: Math.max(1, Number(e.target.value) || 1) })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="delay-unit">{t('builder.panel.delay.unitLabel')}</Label>
        <Select value={data.unit ?? 'hours'} onValueChange={(unit) => updateNodeData(nodeId, { unit: unit as DelayUnit })}>
          <SelectTrigger id="delay-unit">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="minutes">{t('builder.nodes.delay.units.minutes')}</SelectItem>
            <SelectItem value="hours">{t('builder.nodes.delay.units.hours')}</SelectItem>
            <SelectItem value="days">{t('builder.nodes.delay.units.days')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-muted-foreground">{t('builder.panel.delay.hint')}</p>
    </fieldset>
  );
};

export const NodeConfigPanel: React.FC<NodeConfigPanelProps> = ({ form }) => {
  const { t } = useTranslation('automations');
  const selectedNodeId = useAutomationBuilderStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useAutomationBuilderStore((s) => s.setSelectedNodeId);
  const nodes = useAutomationBuilderStore((s) => s.nodes);
  const updateNodeData = useAutomationBuilderStore((s) => s.updateNodeData);
  const isReadOnly = useAutomationBuilderStore((s) => s.isReadOnly);

  const node = nodes.find((n) => n.id === selectedNodeId);
  if (!node) return null;

  const close = () => setSelectedNodeId(null);

  const titleForType: Record<string, string> = {
    trigger: t('builder.panel.titles.trigger'),
    delay: t('builder.panel.titles.delay'),
    action: t('builder.panel.titles.action'),
    end: t('builder.panel.titles.end'),
  };

  let body: React.ReactNode = null;

  if (node.type === 'trigger') {
    body = <p className="text-sm text-muted-foreground">{t('builder.panel.trigger.description')}</p>;
  } else if (node.type === 'end') {
    body = <p className="text-sm text-muted-foreground">{t('builder.panel.end.description')}</p>;
  } else if (node.type === 'delay') {
    body = <DelayEditor nodeId={node.id} data={node.data as AutomationDelayNodeData} disabled={isReadOnly} />;
  } else if (node.type === 'action') {
    const actionData = node.data as AutomationActionNodeData;
    const manifest = getActionManifest(actionData.actionType);
    const ConfigForm = getFrontendPlugin(actionData.actionType)?.ConfigForm;

    if (!ConfigForm) {
      body = <p className="text-sm text-muted-foreground">{t('builder.panel.action.noConfigForm')}</p>;
    } else {
      const hasConfig = actionData.config && Object.keys(actionData.config).length > 0;
      body = (
        <fieldset disabled={isReadOnly} className="contents">
          <ConfigForm
            form={form}
            initialData={{
              name: actionData.name ?? manifest?.name,
              config: actionData.config ?? {},
              events: ['form.submitted'],
            }}
            mode={hasConfig ? 'edit' : 'create'}
            isSaving={false}
            hideEventsSection
            readOnly={isReadOnly}
            onSave={async (result: { name: string; config: Record<string, any> }) => {
              updateNodeData(node.id, { name: result.name, config: result.config });
              close();
            }}
            onCancel={close}
          />
        </fieldset>
      );
    }
  }

  return (
    <div
      className="w-[420px] shrink-0 h-full overflow-y-auto bg-white dark:bg-card"
      style={{ borderLeft: '1px solid var(--tf-border)' }}
      data-testid="automation-node-config-panel"
    >
      <div
        className="flex items-center justify-between px-5 py-4 sticky top-0 bg-white dark:bg-card z-10"
        style={{ borderBottom: '1px solid var(--tf-border-light)' }}
      >
        <h2 className="text-sm font-semibold" style={{ color: 'var(--tf-dark)' }}>
          {titleForType[node.type as string] ?? node.type}
        </h2>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={close} aria-label={t('builder.panel.close')}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="p-5">{body}</div>
    </div>
  );
};

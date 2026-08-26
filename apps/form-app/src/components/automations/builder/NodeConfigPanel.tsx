import React, { useMemo } from 'react';
import {
  Button,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@dculus/ui';
import { X } from 'lucide-react';
import { NumberField, FillableFormFieldValidation, type FillableFormField } from '@dculus/types';
import { useTranslation } from '../../../hooks/useTranslation';
import { useAutomationBuilderStore } from '../../../store/useAutomationBuilderStore';
import { getFrontendPlugin } from '../../../plugins/core/registry';
import '../../../plugins/index';
import type {
  AutomationActionNodeData,
  AutomationConditionNodeData,
  AutomationDelayNodeData,
  AutomationDigestNodeData,
  DelayUnit,
} from './types';
import { getActionManifest } from './actionCatalog';
import { ConditionRulesEditor } from './ConditionRulesEditor';
import { DigestFiltersEditor } from './DigestFiltersEditor';
import { ScheduleTriggerEditor } from './ScheduleTriggerEditor';
import { triggerTypeI18nKey } from '../triggerTypes';

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

const DigestEditor: React.FC<{
  nodeId: string;
  data: AutomationDigestNodeData;
  fields: FillableFormField[];
  formId?: string;
  disabled: boolean;
}> = ({ nodeId, data, fields, formId, disabled }) => {
  const { t } = useTranslation('automations');
  const updateNodeData = useAutomationBuilderStore((s) => s.updateNodeData);

  const includeExisting = data.includeExistingResponses === true;

  return (
    <fieldset disabled={disabled} className="space-y-4">
      <DigestFiltersEditor
        filters={data.filters ?? []}
        fields={fields}
        formId={formId}
        disabled={disabled}
        onChange={(filters) => updateNodeData(nodeId, { filters })}
      />

      <p className="text-xs text-muted-foreground">{t('builder.panel.digest.hint')}</p>

      {/* Opt-in backfill, and unchecked is the safe default. Unchecked sends
          `includeExistingResponses: false`, so activation anchors the first run at that moment.
          Checking it sends `true`, which makes the first run cover every response the form has
          ever received — a per-response email action then messages every one of those people. */}
      <div className="space-y-2 pt-1">
        <div className="flex items-start gap-2.5">
          <Checkbox
            id="digest-include-existing"
            checked={includeExisting}
            disabled={disabled}
            onCheckedChange={(checked) =>
              updateNodeData(nodeId, { includeExistingResponses: checked === true })
            }
          />
          <Label htmlFor="digest-include-existing" className="text-sm font-normal leading-snug cursor-pointer">
            {t('builder.panel.digest.includeExistingLabel')}
          </Label>
        </div>
        <p className="text-xs text-muted-foreground pl-[26px]">
          {includeExisting
            ? t('builder.panel.digest.includeExistingWarning')
            : t('builder.panel.digest.includeExistingHint')}
        </p>
      </div>
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
  const formFields = useAutomationBuilderStore((s) => s.formFields);
  const triggerType = useAutomationBuilderStore((s) => s.triggerType);
  const automationId = useAutomationBuilderStore((s) => s.automationId);

  const node = nodes.find((n) => n.id === selectedNodeId);

  // A digest node, when present, is always the trigger's sole immediate successor
  // (graphValidator's DIGEST_MUST_FOLLOW_TRIGGER rule) — so its mere existence in the graph
  // means it's upstream of every other node, no graph walk needed to determine "downstream of
  // digest" for a given action node.
  const hasDigestNode = nodes.some((n) => n.type === 'digest');

  // On a schedule automation with a digest node, condition rules can gate on the digest's own
  // __digestCount pseudo-field (e.g. "only continue if count > 0") — graphValidator's
  // RESPONSE_FIELD_NOT_AVAILABLE_IN_DIGEST rule accepts any of the four __digest* scalar keys
  // as a condition fieldId, but only __digestCount is exposed in the picker: since/until/
  // truncated aren't meaningful things to *compare against* in a condition (they're fixed
  // per-run context, not a value that varies in a useful way to branch on).
  //
  // Computed unconditionally, ABOVE the `if (!node) return null` guard below — every hook in
  // this component (including this useMemo) must run on every render regardless of whether a
  // node is selected, or React throws "Rendered more hooks than during the previous render"
  // the moment a node goes from selected to unselected (fewer hooks that render) or vice versa.
  const conditionFields = useMemo(() => {
    if (triggerType !== 'schedule' || !hasDigestNode) return formFields;
    const digestCountField = new NumberField(
      '__digestCount',
      t('builder.panel.digest.countFieldLabel'),
      '',
      '',
      '',
      '',
      new FillableFormFieldValidation(false)
    );
    return [...formFields, digestCountField];
  }, [formFields, triggerType, hasDigestNode, t]);

  if (!node) return null;

  const close = () => setSelectedNodeId(null);

  const titleForType: Record<string, string> = {
    trigger: t(`triggerTypes.${triggerTypeI18nKey(triggerType)}`, { defaultValue: t('builder.panel.titles.trigger') }),
    delay: t('builder.panel.titles.delay'),
    condition: t('builder.panel.titles.condition'),
    action: t('builder.panel.titles.action'),
    digest: t('builder.panel.titles.digest'),
    end: t('builder.panel.titles.end'),
  };

  let body: React.ReactNode = null;

  if (node.type === 'trigger') {
    if (triggerType === 'schedule' && automationId) {
      body = (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t('builder.panel.trigger.descriptionSchedule')}</p>
          <ScheduleTriggerEditor automationId={automationId} disabled={isReadOnly} />
        </div>
      );
    } else if (triggerType === 'response.edited') {
      body = <p className="text-sm text-muted-foreground">{t('builder.panel.trigger.descriptionResponseEdited')}</p>;
    } else {
      body = <p className="text-sm text-muted-foreground">{t('builder.panel.trigger.description')}</p>;
    }
  } else if (node.type === 'end') {
    body = <p className="text-sm text-muted-foreground">{t('builder.panel.end.description')}</p>;
  } else if (node.type === 'delay') {
    body = <DelayEditor nodeId={node.id} data={node.data as AutomationDelayNodeData} disabled={isReadOnly} />;
  } else if (node.type === 'digest') {
    body = (
      <DigestEditor
        nodeId={node.id}
        data={node.data as AutomationDigestNodeData}
        fields={formFields}
        formId={form?.id}
        disabled={isReadOnly}
      />
    );
  } else if (node.type === 'condition') {
    body = (
      <ConditionRulesEditor
        nodeId={node.id}
        data={node.data as AutomationConditionNodeData}
        fields={conditionFields}
        disabled={isReadOnly}
      />
    );
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
            instanceKey={node.id}
            mode={hasConfig ? 'edit' : 'create'}
            isSaving={false}
            hideEventsSection
            readOnly={isReadOnly}
            digestContext={{ available: hasDigestNode }}
            submitLabelOverride={t('builder.panel.action.saveButton')}
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

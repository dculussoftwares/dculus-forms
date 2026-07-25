import React from 'react';
import type { NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import { GitBranch } from 'lucide-react';
import { useTranslation } from '../../../../hooks/useTranslation';
import { useAutomationBuilderStore } from '../../../../store/useAutomationBuilderStore';
import { NodeCard } from './NodeCard';
import type { AutomationNode } from '../layout';
import type { AutomationConditionNodeData } from '../types';
import { summarizeConditionRules } from '../conditionSummary';

/**
 * Condition ("if/else") node (#200): summarizes its rules on the card ("If Email contains
 * @acme.com — AND 1 more") and exposes two named source handles — `true`/`false` — so
 * AddStepEdge can render the "Yes"/"No" branch edges and route add-step/insert operations
 * onto the correct branch.
 */
export const ConditionNode: React.FC<NodeProps<AutomationNode>> = ({ id, data, selected }) => {
  const { t } = useTranslation('automations');
  const { t: tFilter } = useTranslation('filterRow');
  const isReadOnly = useAutomationBuilderStore((s) => s.isReadOnly);
  const removeNode = useAutomationBuilderStore((s) => s.removeNode);
  const formFields = useAutomationBuilderStore((s) => s.formFields);
  const errors = useAutomationBuilderStore((s) => s.validationErrorsByNode[id]);

  const { rules, combinator } = data as AutomationConditionNodeData;
  const subtitle = summarizeConditionRules(rules ?? [], combinator ?? 'AND', formFields, t, tFilter);

  return (
    <NodeCard
      selected={selected}
      hasError={Boolean(errors?.length)}
      errorMessage={errors?.[0]?.message}
      showSourceHandle={false}
      icon={<GitBranch className="h-4 w-4" style={{ color: '#5e35b1' }} />}
      iconBg="#ede7f6"
      title={t('builder.nodes.condition.title')}
      subtitle={subtitle}
      width={300}
      onDelete={isReadOnly ? undefined : () => removeNode(id)}
      deleteLabel={t('builder.nodes.removeStep')}
    >
      {/* Two named source handles — the branch labels ("Yes"/"No") render on the outgoing
          edges themselves (AddStepEdge), not here, to avoid duplicating the same text twice
          right next to each other. Absolutely positioned across the card's full height (not
          nested in the normal content flow) so `top: 30%/70%` places them relative to the
          whole card, not just a small inline strip. */}
      <div className="absolute inset-y-0 right-0 w-2" data-testid="condition-branch-handles">
        <Handle type="source" position={Position.Right} id="true" style={{ top: '30%' }} className="!bg-[var(--tf-green)]" />
        <Handle type="source" position={Position.Right} id="false" style={{ top: '70%' }} className="!bg-[var(--tf-error)]" />
      </div>
    </NodeCard>
  );
};

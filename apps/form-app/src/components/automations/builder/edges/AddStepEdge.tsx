import React, { useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react';
import { Popover, PopoverContent, PopoverTrigger, Badge } from '@dculus/ui';
import { Plus, Clock, GitBranch, Webhook, type LucideIcon } from 'lucide-react';
import { useTranslation } from '../../../../hooks/useTranslation';
import { useAutomationBuilderStore } from '../../../../store/useAutomationBuilderStore';
import { automationActionManifests, ACTION_ICON_MAP } from '../actionCatalog';

interface CatalogItemProps {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  disabled?: boolean;
  comingSoonLabel?: string;
  onClick: () => void;
}

const CatalogItem: React.FC<CatalogItemProps> = ({ icon, iconBg, label, disabled, comingSoonLabel, onClick }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-left transition-colors ${
      disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[rgba(87,84,91,0.06)]'
    }`}
  >
    <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: iconBg }}>
      {icon}
    </div>
    <span className="text-xs font-medium flex-1 truncate" style={{ color: 'var(--tf-dark)' }}>
      {label}
    </span>
    {disabled && comingSoonLabel && (
      <Badge variant="secondary" className="text-[9px] shrink-0">
        {comingSoonLabel}
      </Badge>
    )}
  </button>
);

export const AddStepEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
}) => {
  const { t } = useTranslation('automations');
  const [open, setOpen] = useState(false);
  const isReadOnly = useAutomationBuilderStore((s) => s.isReadOnly);
  const insertStepOnEdge = useAutomationBuilderStore((s) => s.insertStepOnEdge);

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
  });

  const handleAddDelay = () => {
    insertStepOnEdge(id, 'delay', { amount: 1, unit: 'hours' });
    setOpen(false);
  };

  const handleAddAction = (actionType: string) => {
    insertStepOnEdge(id, 'action', { actionType, config: {} });
    setOpen(false);
  };

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={{ stroke: 'var(--tf-border-strong)', strokeWidth: 1.5 }} />
      {!isReadOnly && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={t('builder.addStep.buttonLabel')}
                  className="h-6 w-6 rounded-full flex items-center justify-center bg-white hover:bg-[rgba(87,84,91,0.06)] transition-colors"
                  style={{ border: '1.5px solid var(--tf-border-strong)' }}
                >
                  <Plus className="h-3.5 w-3.5" style={{ color: 'var(--tf-muted)' }} />
                </button>
              </PopoverTrigger>
              <PopoverContent align="center" className="w-64 p-2">
                <div className="mb-1.5 px-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--tf-light-muted)' }}>
                    {t('builder.addStep.rulesHeading')}
                  </p>
                </div>
                <CatalogItem
                  icon={<Clock className="h-3.5 w-3.5" style={{ color: '#8b6a18' }} />}
                  iconBg="#fbe19d"
                  label={t('builder.addStep.timeDelay')}
                  onClick={handleAddDelay}
                />
                <CatalogItem
                  icon={<GitBranch className="h-3.5 w-3.5" style={{ color: 'var(--tf-muted)' }} />}
                  iconBg="var(--tf-faint)"
                  label={t('builder.addStep.condition')}
                  disabled
                  comingSoonLabel={t('builder.addStep.comingSoon')}
                  onClick={() => {}}
                />

                <div className="my-2 border-t" style={{ borderColor: 'var(--tf-border-light)' }} />

                <div className="mb-1.5 px-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--tf-light-muted)' }}>
                    {t('builder.addStep.actionsHeading')}
                  </p>
                </div>
                {automationActionManifests.map((manifest) => {
                  const Icon: LucideIcon = ACTION_ICON_MAP[manifest.icon] ?? Webhook;
                  return (
                    <CatalogItem
                      key={manifest.id}
                      icon={<Icon className="h-3.5 w-3.5" style={{ color: manifest.iconColor }} />}
                      iconBg={manifest.iconBgColor}
                      label={manifest.name}
                      disabled={!manifest.available}
                      comingSoonLabel={t('builder.addStep.comingSoon')}
                      onClick={() => handleAddAction(manifest.id)}
                    />
                  );
                })}
              </PopoverContent>
            </Popover>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

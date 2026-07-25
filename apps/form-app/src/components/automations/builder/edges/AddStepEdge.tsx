import React, { useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  Position,
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

/**
 * Draws a smooth curve through `points` (source, any dagre-computed bend points, target)
 * by chaining getBezierPath calls segment-by-segment — matching the reference workflow
 * builder's curved connector language — so a branch edge that skips a rank (e.g. an empty
 * condition branch wired straight past its sibling's node) still reads as visually
 * consistent with the rest of the graph instead of cutting a single straight diagonal
 * across the skipped rank. Interior points are treated as pass-through stops (exiting
 * "Right", entering "Left"), mirroring the dummy chain node dagre itself inserts there.
 */
function buildCurvedPath(
  points: { x: number; y: number }[],
  sourcePosition: Position,
  targetPosition: Position
): { path: string; labelX: number; labelY: number } {
  const segments: string[] = [];
  let labelX = points[0].x;
  let labelY = points[0].y;
  const midSegmentIndex = Math.floor((points.length - 2) / 2);

  for (let i = 0; i < points.length - 1; i++) {
    const isLast = i === points.length - 2;
    const [segPath, segLabelX, segLabelY] = getBezierPath({
      sourceX: points[i].x,
      sourceY: points[i].y,
      sourcePosition: i === 0 ? sourcePosition : Position.Right,
      targetX: points[i + 1].x,
      targetY: points[i + 1].y,
      targetPosition: isLast ? targetPosition : Position.Left,
    });
    segments.push(segPath);
    if (i === midSegmentIndex) {
      labelX = segLabelX;
      labelY = segLabelY;
    }
  }

  return { path: segments.join(' '), labelX, labelY };
}

export const AddStepEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  sourceHandleId,
  markerEnd,
  data,
}) => {
  const { t } = useTranslation('automations');
  const [open, setOpen] = useState(false);
  const isReadOnly = useAutomationBuilderStore((s) => s.isReadOnly);
  const insertStepOnEdge = useAutomationBuilderStore((s) => s.insertStepOnEdge);

  const bendPoints = (data?.bendPoints as { x: number; y: number }[] | undefined) ?? [];
  const pathPoints = [{ x: sourceX, y: sourceY }, ...bendPoints, { x: targetX, y: targetY }];
  const { path: edgePath, labelX, labelY } = buildCurvedPath(pathPoints, sourcePosition, targetPosition);

  const branchLabel =
    sourceHandleId === 'true'
      ? t('builder.nodes.condition.trueLabel')
      : sourceHandleId === 'false'
        ? t('builder.nodes.condition.falseLabel')
        : null;
  const branchColor = sourceHandleId === 'true' ? 'var(--tf-green)' : 'var(--tf-error)';

  const handleAddDelay = () => {
    insertStepOnEdge(id, 'delay', { amount: 1, unit: 'hours' });
    setOpen(false);
  };

  const handleAddCondition = () => {
    insertStepOnEdge(id, 'condition', { rules: [], combinator: 'AND' });
    setOpen(false);
  };

  const handleAddAction = (actionType: string) => {
    insertStepOnEdge(id, 'action', { actionType, config: {} });
    setOpen(false);
  };

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={{ stroke: 'var(--tf-light-muted)', strokeWidth: 1.5 }} />
      {branchLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(0, -50%) translate(${sourceX + 10}px, ${sourceY}px)`,
              pointerEvents: 'none',
            }}
            className="nodrag nopan"
          >
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white"
              style={{ color: branchColor, border: `1px solid ${branchColor}` }}
              data-testid={`automation-branch-label-${sourceHandleId}`}
            >
              {branchLabel}
            </span>
          </div>
        </EdgeLabelRenderer>
      )}
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
                  className="h-6 w-6 rounded-full flex items-center justify-center transition-colors bg-[var(--tf-dark)] hover:bg-[var(--tf-darkest)]"
                  style={{ boxShadow: 'var(--shadow-sm)' }}
                >
                  <Plus className="h-3.5 w-3.5" style={{ color: 'white' }} />
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
                  icon={<GitBranch className="h-3.5 w-3.5" style={{ color: '#5e35b1' }} />}
                  iconBg="#ede7f6"
                  label={t('builder.addStep.condition')}
                  onClick={handleAddCondition}
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

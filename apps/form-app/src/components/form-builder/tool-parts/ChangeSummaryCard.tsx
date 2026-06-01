// apps/form-app/src/components/form-builder/tool-parts/ChangeSummaryCard.tsx
import React from 'react';
import { cn } from '@dculus/utils';
import { useTranslation } from '../../../hooks/useTranslation';
import type { FormEditAgentUIMessage } from '../../../lib/aiAgentTypes';
import { buildOpLabel } from '../../../hooks/useAIChat';

type OpColor = 'green' | 'blue' | 'red';

const MUTATION_OUTPUT_TYPES = new Set([
  'ADD_FIELD', 'UPDATE_FIELD', 'REMOVE_FIELD', 'REORDER_FIELDS',
  'UPDATE_LAYOUT', 'RENAME_PAGE', 'REORDER_PAGES', 'ADD_PAGE', 'REMOVE_PAGE',
]);

const ADD_OPS = new Set(['ADD_FIELD', 'ADD_PAGE']);
const REMOVE_OPS = new Set(['REMOVE_FIELD', 'REMOVE_PAGE']);

function opColor(opType: string): OpColor {
  if (ADD_OPS.has(opType)) return 'green';
  if (REMOVE_OPS.has(opType)) return 'red';
  return 'blue';
}

const COLOR_CLASSES: Record<OpColor, string> = {
  green: 'text-green-600',
  blue: 'text-blue-600',
  red: 'text-red-600',
};

const PREFIX: Record<OpColor, string> = {
  green: '+',
  blue: '~',
  red: '−',
};

interface Props {
  message: FormEditAgentUIMessage;
  onUndo?: () => void;
  canUndo?: boolean;
}

const ChangeSummaryCard: React.FC<Props> = ({ message, onUndo, canUndo }) => {
  const { t } = useTranslation('aiEditDrawer');

  const mutationParts = message.parts.filter(
    (p) =>
      p.type.startsWith('tool-') &&
      (p as any).state === 'output-available' &&
      MUTATION_OUTPUT_TYPES.has((p as any).output?.type)
  );

  if (mutationParts.length === 0) return null;

  return (
    <div className="mt-1.5 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-medium text-muted-foreground">{t('changeSummary.title')}</span>
        {canUndo && onUndo && (
          <button
            onClick={onUndo}
            className="rounded px-1.5 py-0.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            {t('changeSummary.undoThis')}
          </button>
        )}
      </div>
      <div className="space-y-0.5">
        {mutationParts.map((part, i) => {
          const output = (part as any).output;
          const color = opColor(output?.type ?? '');
          return (
            <div key={i} className={cn('font-mono', COLOR_CLASSES[color])}>
              {PREFIX[color]} {buildOpLabel(output)}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ChangeSummaryCard;

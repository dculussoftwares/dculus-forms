import React from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@dculus/ui';
import { cn } from '@dculus/utils';

type Severity = 'warning' | 'error' | 'success' | 'info';

interface AIInsightCardProps {
  tip: string;
  fixPrompt: string;
  severity: Severity;
  insightLabel: string;
  fixButtonLabel: string;
  onFixWithAI: (prompt: string) => void;
}

const SEVERITY_STYLES: Record<Severity, { card: string; label: string; button: string }> = {
  warning: {
    card: 'bg-yellow-50 border-yellow-300',
    label: 'text-yellow-800',
    button: 'bg-yellow-500 hover:bg-yellow-600 text-white',
  },
  error: {
    card: 'bg-red-50 border-red-200',
    label: 'text-red-800',
    button: 'bg-red-500 hover:bg-red-600 text-white',
  },
  success: {
    card: 'bg-green-50 border-green-200',
    label: 'text-green-800',
    button: 'bg-green-500 hover:bg-green-600 text-white',
  },
  info: {
    card: 'bg-[#f0ebff] border-[#c4b5fd]',
    label: 'text-blue-800',
    button: 'bg-[#7C3AAE] hover:bg-[#6d30a0] text-white',
  },
};

export const AIInsightCard: React.FC<AIInsightCardProps> = ({
  tip,
  fixPrompt,
  severity,
  insightLabel,
  fixButtonLabel,
  onFixWithAI,
}) => {
  const styles = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.info;

  return (
    <div className={cn('border rounded-lg px-3 py-2.5 mt-3', styles.card)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className={cn('flex items-center gap-1 text-xs font-bold uppercase tracking-wide mb-1', styles.label)}>
            <Sparkles className="h-3 w-3" />
            {insightLabel}
          </div>
          <p className={cn('text-xs leading-relaxed', styles.label)}>{tip}</p>
        </div>
        <Button
          size="sm"
          className={cn('shrink-0 text-xs h-7 px-2.5 border-0', styles.button)}
          onClick={(e) => {
            e.stopPropagation();
            onFixWithAI(fixPrompt);
          }}
        >
          {fixButtonLabel} ✦
        </Button>
      </div>
    </div>
  );
};

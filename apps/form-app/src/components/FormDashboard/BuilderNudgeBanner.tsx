import React from 'react';
import { PencilLine, ArrowRight } from 'lucide-react';
import { Button } from '@dculus/ui';
import { useTranslation } from '../../hooks/useTranslation';

interface BuilderNudgeBannerProps {
  onOpenBuilder: () => void;
}

export const BuilderNudgeBanner: React.FC<BuilderNudgeBannerProps> = ({ onOpenBuilder }) => {
  const { t } = useTranslation('formDashboard');

  return (
    <div
      className="flex items-center gap-4 px-5 py-4 rounded-xl"
      style={{
        background: 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(99,102,241,0.06) 100%)',
        border: '1.5px solid rgba(59,130,246,0.20)',
      }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: 'rgba(59,130,246,0.14)' }}
      >
        <PencilLine className="w-5 h-5" style={{ color: 'rgb(37,99,235)' }} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-primary leading-snug">
          {t('builderNudge.title')}
        </p>
        <p className="text-xs mt-0.5 text-muted-foreground leading-snug">
          {t('builderNudge.description')}
        </p>
      </div>

      <Button
        onClick={onOpenBuilder}
        size="sm"
        className="flex-shrink-0 gap-1.5 text-xs h-8 px-3"
        data-testid="nudge-open-builder"
      >
        {t('builderNudge.action')}
        <ArrowRight className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
};

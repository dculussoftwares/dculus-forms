import React from 'react';
import { Button } from '@dculus/ui';
import { GradientSparkles } from './GradientSparkles.js';
import { useTranslation } from '../../hooks/useTranslation';

interface AskAIPillProps {
  isOpen: boolean;
  onClick: () => void;
}

/**
 * Bottom-center "✨ Ask AI anything…" pill — the single AI entry point on all three
 * builder tabs (Content, Logic, Automations), opening the root-mounted AIEditDrawer.
 * Replaces the old corner AIFloatingButton, which only lived on Content.
 * See docs/form-builder-redesign.md §2.7 and epic #226 / ticket #232.
 */
export const AskAIPill: React.FC<AskAIPillProps> = ({ isOpen, onClick }) => {
  const { t } = useTranslation('askAI');

  if (isOpen) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-6 z-20 flex justify-center">
      <Button
        type="button"
        variant="outline"
        size="pill"
        onClick={onClick}
        aria-label={t('pill.ariaLabel')}
        aria-expanded={false}
        data-testid="ask-ai-pill"
        className="pointer-events-auto gap-2"
      >
        <GradientSparkles size={15} />
        <span>{t('pill.label')}</span>
      </Button>
    </div>
  );
};

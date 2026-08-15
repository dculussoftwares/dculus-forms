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
 *
 * Wrapped in `.ai-gradient-ring` (index.css) — a spinning conic-gradient
 * border, reused from the old AIFloatingButton — plus a metallic shine sweep
 * on the label, to draw the eye to the single AI entry point.
 */
export const AskAIPill: React.FC<AskAIPillProps> = ({ isOpen, onClick }) => {
  const { t } = useTranslation('askAI');

  if (isOpen) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-6 z-20 flex justify-center">
      <div className="pointer-events-auto rounded-full p-[1.5px] ai-gradient-ring">
        <Button
          type="button"
          variant="outline"
          size="pill"
          onClick={onClick}
          aria-label={t('pill.ariaLabel')}
          aria-expanded={false}
          data-testid="ask-ai-pill"
          className="gap-2 border-0 bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <GradientSparkles size={15} />
          <span
            className="bg-[linear-gradient(110deg,currentColor_40%,#ffffff_50%,currentColor_60%)] bg-[length:200%_100%] bg-clip-text motion-safe:animate-shine"
            style={{ WebkitTextFillColor: 'transparent' }}
          >
            {t('pill.label')}
          </span>
        </Button>
      </div>
    </div>
  );
};

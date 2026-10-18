import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, CloudOff, Loader2, PencilLine } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import { useAutomationBuilderStore } from '../../../store/useAutomationBuilderStore';
import type { SaveState } from '../../../store/slices/automationBuilderSlice';

/** Keeps "Saving…" visible long enough to read, so a fast save doesn't flicker. */
const MIN_SAVING_MS = 400;
/** How long "Saved · just now" shows before it settles to plain "Saved". */
const JUST_NOW_MS = 3000;

function useHeldSaveState(actual: SaveState): SaveState {
  const [shown, setShown] = useState<SaveState>(actual);
  const [savingSince, setSavingSince] = useState<number | null>(null);

  useEffect(() => {
    if (actual === 'saving') {
      setSavingSince((current) => current ?? Date.now());
      setShown('saving');
      return undefined;
    }
    if (shown === 'saving' && savingSince !== null) {
      const remaining = MIN_SAVING_MS - (Date.now() - savingSince);
      setSavingSince(null);
      if (remaining > 0) {
        const timer = setTimeout(() => setShown(actual), remaining);
        return () => clearTimeout(timer);
      }
    }
    setShown(actual);
    return undefined;
  }, [actual]);

  return shown;
}

interface SaveStatusIndicatorProps {
  onRetry: () => void;
}

export const SaveStatusIndicator: React.FC<SaveStatusIndicatorProps> = ({ onRetry }) => {
  const { t, locale } = useTranslation('automations');
  const saveState = useAutomationBuilderStore((s) => s.saveState);
  const lastSavedAt = useAutomationBuilderStore((s) => s.lastSavedAt);
  const shown = useHeldSaveState(saveState);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (shown !== 'saved' || lastSavedAt === null) return undefined;
    const remaining = JUST_NOW_MS - (Date.now() - lastSavedAt);
    if (remaining <= 0) return undefined;
    const timer = setTimeout(() => setNow(Date.now()), remaining + 10);
    return () => clearTimeout(timer);
  }, [shown, lastSavedAt]);

  const justSaved = lastSavedAt !== null && now - lastSavedAt < JUST_NOW_MS;
  const savedAtTitle =
    lastSavedAt !== null
      ? t('builder.saveStatus.savedAt', { values: { time: new Date(lastSavedAt).toLocaleTimeString(locale) } })
      : undefined;

  let content: React.ReactNode;
  switch (shown) {
    case 'pending':
      content = (
        <>
          <PencilLine className="h-3.5 w-3.5" />
          {t('builder.saveStatus.pending')}
        </>
      );
      break;
    case 'saving':
      content = (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t('builder.saveStatus.saving')}
        </>
      );
      break;
    case 'offline':
      content = (
        <>
          <CloudOff className="h-3.5 w-3.5" />
          {t('builder.saveStatus.offline')}
        </>
      );
      break;
    case 'error':
      content = (
        <span className="flex items-center gap-1.5" style={{ color: 'var(--tf-error)' }}>
          <AlertTriangle className="h-3.5 w-3.5" />
          {t('builder.saveStatus.error')}
          <button type="button" className="underline underline-offset-2" onClick={onRetry}>
            {t('builder.saveStatus.retry')}
          </button>
        </span>
      );
      break;
    case 'conflict':
      content = (
        <span className="flex items-center gap-1.5" style={{ color: '#9c7818' }}>
          <AlertTriangle className="h-3.5 w-3.5" />
          {t('builder.saveStatus.conflict')}
        </span>
      );
      break;
    default:
      content = (
        <>
          <CheckCircle2 className="h-3.5 w-3.5" />
          {justSaved ? t('builder.saveStatus.savedJustNow') : t('builder.saveStatus.saved')}
        </>
      );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="automation-save-status"
      data-state={shown}
      title={shown === 'saved' ? savedAtTitle : undefined}
      className="flex items-center gap-1.5 text-xs shrink-0"
      style={{ color: 'var(--tf-light-muted)' }}
    >
      {content}
    </div>
  );
};

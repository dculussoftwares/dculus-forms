import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@dculus/ui';
import { useTranslation } from '../../../hooks/useTranslation';
import { useAuth } from '../../../contexts/AuthContext';
import { useAutomationBuilderStore } from '../../../store/useAutomationBuilderStore';
import { formatRelativeTime } from '../relativeTime';

interface DraftConflictBannerProps {
  onLoadLatest: () => void;
  onKeepMine: () => void;
  busy: boolean;
}

/**
 * Shown when the server draft moved on since this tab last synced (another tab or another editor
 * saved). Autosave is paused until the user chooses, so neither side is silently overwritten.
 */
export const DraftConflictBanner: React.FC<DraftConflictBannerProps> = ({ onLoadLatest, onKeepMine, busy }) => {
  const { t, locale } = useTranslation('automations');
  const { user } = useAuth();
  const conflict = useAutomationBuilderStore((s) => s.conflict);
  if (!conflict) return null;

  const who =
    conflict.draftUpdatedById && conflict.draftUpdatedById === user?.id
      ? t('builder.conflict.youInAnotherTab')
      : t('builder.conflict.anotherEditor');
  const when = conflict.draftUpdatedAt ? formatRelativeTime(conflict.draftUpdatedAt, locale) : '';

  return (
    <div
      role="alert"
      data-testid="automation-conflict-banner"
      className="mx-1 mb-3 flex items-center gap-3 rounded-lg px-4 py-2.5"
      style={{ background: 'rgba(190,153,58,0.08)', border: '1px solid rgba(190,153,58,0.16)' }}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: '#9c7818' }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: 'var(--tf-dark)' }}>
          {t('builder.conflict.title')}
        </p>
        <p className="text-xs text-muted-foreground">{t('builder.conflict.description', { values: { name: who, time: when } })}</p>
      </div>
      <Button variant="outline" size="sm" onClick={onLoadLatest} disabled={busy}>
        {busy && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
        {t('builder.conflict.loadLatest')}
      </Button>
      <Button size="sm" onClick={onKeepMine} disabled={busy}>
        {t('builder.conflict.keepMine')}
      </Button>
    </div>
  );
};

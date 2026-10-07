import { useState } from 'react';
import { Button } from '@dculus/ui';
import { saveProgressLabels as labels } from '../locales/saveProgress';
import type { DraftSaveStatus } from '../hooks/useResponseDraft';
import { formatDate, formatTime } from '../lib/dateFormat';

/** Quiet autosave state, shown in the respondent account header. */
export function DraftSaveStatusText({ status, lastSavedAt }: { status: DraftSaveStatus; lastSavedAt: string | null }) {
  if (status === 'idle' && !lastSavedAt) return null;

  const text =
    status === 'saving'
      ? labels.saving
      : status === 'error'
        ? labels.saveFailed
        : lastSavedAt
          ? labels.savedAt(formatTime(lastSavedAt))
          : labels.saved;

  return (
    <span
      className={`shrink-0 text-xs ${status === 'error' ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}
      data-testid="draft-save-status"
      data-status={status}
    >
      {text}
    </span>
  );
}

interface DraftNoticeProps {
  /** When the restored draft was last saved; null hides the "welcome back" line. */
  restoredAt: string | null;
  /** The form has file fields, which drafts never keep. */
  hasFileFields: boolean;
  /** A newer copy saved elsewhere; non-null shows the conflict prompt instead. */
  conflict: { updatedAt: string } | null;
  embedded?: boolean;
  onStartOver: () => Promise<void>;
  onKeepMine: () => void;
  onUseOther: () => void;
  onDismiss: () => void;
}

/**
 * The strip under the account header that explains save-and-resume state:
 * a "welcome back" note after restoring a draft (with "Start over"), or the
 * conflict prompt when another tab or device saved newer answers.
 */
export default function DraftNotice({
  restoredAt,
  hasFileFields,
  conflict,
  embedded = false,
  onStartOver,
  onKeepMine,
  onUseOther,
  onDismiss,
}: DraftNoticeProps) {
  const [confirming, setConfirming] = useState(false);
  const [clearing, setClearing] = useState(false);

  if (!conflict && !restoredAt) return null;

  const shell = [
    'flex w-full shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b text-sm',
    embedded ? 'px-4 py-2.5' : 'px-4 py-3 sm:px-6',
  ].join(' ');

  if (conflict) {
    return (
      <div
        className={`${shell} border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100`}
        role="alert"
        data-testid="draft-conflict"
      >
        <div className="min-w-0 flex-1">
          <p className="font-medium">{labels.conflictTitle}</p>
          <p className="text-xs opacity-80">{labels.conflictDescription}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onUseOther} data-testid="draft-conflict-use-other">
            {labels.useOther}
          </Button>
          <Button size="sm" onClick={onKeepMine} data-testid="draft-conflict-keep-mine">
            {labels.keepMine}
          </Button>
        </div>
      </div>
    );
  }

  const handleClear = async () => {
    setClearing(true);
    try {
      await onStartOver();
    } finally {
      setClearing(false);
      setConfirming(false);
    }
  };

  return (
    <div
      className={`${shell} border-blue-100 bg-blue-50 text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-100`}
      role="status"
      data-testid="draft-restored"
    >
      <div className="min-w-0 flex-1">
        <p>{confirming ? labels.startOverConfirm : labels.restored(formatDate(restoredAt!))}</p>
        {!confirming && hasFileFields && <p className="text-xs opacity-80">{labels.filesNotSaved}</p>}
      </div>
      {confirming ? (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setConfirming(false)} disabled={clearing}>
            {labels.startOverCancel}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={handleClear}
            disabled={clearing}
            data-testid="draft-start-over-confirm"
          >
            {labels.startOverAction}
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="font-medium underline underline-offset-2"
            data-testid="draft-start-over"
          >
            {labels.startOver}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="text-xs opacity-70 hover:opacity-100"
            aria-label={labels.dismiss}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

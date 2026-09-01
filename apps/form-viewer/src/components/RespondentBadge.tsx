import { useState } from 'react';

interface RespondentBadgeProps {
  /** The signed-in respondent's verified email (from `Form.respondentEmail`). */
  email: string;
  /** The respondent's profile image URL, if their session has one. */
  imageUrl?: string | null;
  /** Slightly more compact padding for the embedded (`/embed/:shortUrl`) frame. */
  embedded?: boolean;
  /**
   * Sign the current respondent out and re-fetch the form. Provided by the
   * parent because the real sign-out (server session invalidation + cookie
   * clear + in-progress answer reset) belongs with the form state it touches.
   * Must reject if the sign-out did not complete, so the header can stay put
   * rather than imply an identity that is still active.
   */
  onSwitchAccount: () => Promise<void>;
}

function InfoIcon() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Google Forms-style respondent account header: a strip at the top of every
 * form that captures respondent identity, naming the signed-in account with
 * its avatar, a "Switch account" link, and a note that the account is recorded
 * with the response. It sits in its own row above the form (not a floating
 * chip) so a returning or second respondent on a shared browser can't miss
 * which account the form will submit under.
 *
 * The email/avatar are never trusted from the client: they come from the
 * server resolver, which reads them from the caller's own validated session.
 */
export default function RespondentBadge({
  email,
  imageUrl,
  embedded = false,
  onSwitchAccount,
}: RespondentBadgeProps) {
  const [isSwitching, setIsSwitching] = useState(false);
  const [failed, setFailed] = useState(false);
  const [imgBroken, setImgBroken] = useState(false);

  const handleSwitch = async () => {
    if (isSwitching) return;
    setFailed(false);
    setIsSwitching(true);
    try {
      await onSwitchAccount();
      // On success the form re-fetches and this header unmounts (the form is
      // now sign-in gated), so there is no success state to render.
    } catch {
      setFailed(true);
      setIsSwitching(false);
    }
  };

  const initial = email.trim().charAt(0).toUpperCase() || '?';
  const showImg = !!imageUrl && !imgBroken;

  return (
    <div
      className={[
        'flex w-full shrink-0 items-center gap-3 border-b',
        embedded ? 'px-4 py-2.5' : 'px-4 py-3 sm:px-6',
        'border-gray-200 bg-white text-gray-900',
        'dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100',
      ].join(' ')}
      data-testid="respondent-badge"
      role="status"
      aria-live="polite"
    >
      {showImg ? (
        <img
          src={imageUrl!}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setImgBroken(true)}
          data-testid="respondent-badge-avatar"
          className="h-9 w-9 shrink-0 rounded-full object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gray-100 text-sm font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300"
        >
          {initial}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{email}</p>

        {failed ? (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
            <span>Couldn&apos;t switch account.</span>
            <button
              type="button"
              onClick={handleSwitch}
              className="font-semibold underline underline-offset-2"
              data-testid="respondent-badge-switch"
            >
              Try again
            </button>
          </p>
        ) : (
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500 dark:text-gray-400">
            <button
              type="button"
              onClick={handleSwitch}
              disabled={isSwitching}
              className="font-medium text-blue-600 hover:underline disabled:no-underline disabled:opacity-60 dark:text-blue-400"
              data-testid="respondent-badge-switch"
            >
              {isSwitching ? 'Switching…' : 'Switch account'}
            </button>
            <span className="inline-flex items-center gap-1">
              <InfoIcon />
              This account is recorded with your response
            </span>
          </p>
        )}
      </div>
    </div>
  );
}

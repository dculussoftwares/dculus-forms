import { useCallback, useEffect, useState } from 'react';

/**
 * localStorage-backed dismissal state for the first-run coach marks (rail,
 * Design button, gear). Follows the same `storage` + same-tab
 * `localStorageChange` custom-event pattern as fieldLibraryStorage.ts so a
 * dismissal in one mount (e.g. StrictMode double-render) is reflected everywhere.
 *
 * Coach marks are shown one at a time in COACH_MARK_ORDER — the first id not
 * yet in the dismissed list is the active one.
 */

export const COACH_MARK_ORDER = ['rail', 'design', 'gear'] as const;
export type CoachMarkId = (typeof COACH_MARK_ORDER)[number];

const DISMISSED_KEY = 'dculus.coachmarks.dismissed';
const STORAGE_EVENT = 'localStorageChange';

const readDismissed = (): CoachMarkId[] => {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CoachMarkId[]) : [];
  } catch {
    return [];
  }
};

const writeDismissed = (ids: CoachMarkId[]) => {
  try {
    const value = JSON.stringify(ids);
    localStorage.setItem(DISMISSED_KEY, value);
    window.dispatchEvent(new CustomEvent(STORAGE_EVENT, { detail: { key: DISMISSED_KEY, value } }));
  } catch {
    // Ignore write failures (e.g. private browsing storage quota)
  }
};

export const dismissCoachMark = (id: CoachMarkId): void => {
  const current = readDismissed();
  if (current.includes(id)) return;
  writeDismissed([...current, id]);
};

/** Active coach mark (first undismissed id in order), or null once all are dismissed. */
export const useActiveCoachMark = (): { activeId: CoachMarkId | null; dismiss: (id: CoachMarkId) => void } => {
  const [dismissed, setDismissed] = useState<CoachMarkId[]>(readDismissed);

  useEffect(() => {
    setDismissed(readDismissed());

    const handleStorage = (e: StorageEvent) => {
      if (e.key === DISMISSED_KEY) setDismissed(readDismissed());
    };
    const handleCustom = (e: Event) => {
      const detail = (e as CustomEvent<{ key: string }>).detail;
      if (detail?.key === DISMISSED_KEY) setDismissed(readDismissed());
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(STORAGE_EVENT, handleCustom);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(STORAGE_EVENT, handleCustom);
    };
  }, []);

  const dismiss = useCallback((id: CoachMarkId) => {
    dismissCoachMark(id);
    setDismissed((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const activeId = COACH_MARK_ORDER.find((id) => !dismissed.includes(id)) ?? null;
  return { activeId, dismiss };
};

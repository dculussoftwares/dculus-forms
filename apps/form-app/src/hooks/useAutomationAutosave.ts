import { useCallback, useEffect, useRef } from 'react';
import { useMutation } from '@apollo/client/react';
import { CombinedGraphQLErrors } from '@apollo/client';
import { SAVE_AUTOMATION_DRAFT } from '../graphql/automations';
import { useAutomationBuilderStore } from '../store/useAutomationBuilderStore';
import type { ValidationErrorEntry } from '../components/automations/builder/types';

export const AUTOSAVE_DEBOUNCE_MS = 800;
/** Continuous typing must not postpone saving forever. */
export const AUTOSAVE_MAX_WAIT_MS = 5000;
export const AUTOSAVE_RETRY_DELAYS_MS = [2000, 4000, 8000];

const CONFLICT_CODE = 'AUTOMATION_DRAFT_CONFLICT';

const conflictExtensions = (error: unknown): Record<string, any> | null => {
  if (!CombinedGraphQLErrors.is(error)) return null;
  const match = error.errors.find((e) => e.extensions?.code === CONFLICT_CODE);
  return match ? (match.extensions as Record<string, any>) : null;
};

interface UseAutomationAutosaveOptions {
  /** False for read-only viewers: nothing is ever sent. */
  enabled: boolean;
}

export interface AutomationAutosave {
  /** Sends any pending edits now. Resolves true when the server has everything on screen. */
  flush: () => Promise<boolean>;
  /** Re-attempts after an error/offline state. */
  retry: () => Promise<boolean>;
  /** Resolves a conflict in favour of this tab's edits, overwriting the other draft. */
  overwriteWithMine: () => Promise<boolean>;
}

/**
 * Debounced, single-flight autosave of the builder's working copy to the server draft.
 *
 * Edits are coalesced: at most one request is ever in flight, and edits made during one simply
 * schedule the next. A request only "covers" the edits that existed when it was sent (see
 * ackSave), so nothing typed mid-request is ever marked saved. The live automation is never
 * touched here — only Publish changes what runs.
 */
export function useAutomationAutosave({ enabled }: UseAutomationAutosaveOptions): AutomationAutosave {
  const [saveDraft] = useMutation(SAVE_AUTOMATION_DRAFT);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstPendingAt = useRef<number | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const retryCount = useRef(0);
  const paused = useRef(false);
  const forceNext = useRef(false);
  const saveDraftRef = useRef(saveDraft);
  saveDraftRef.current = saveDraft;
  // runSave and schedule call each other (retry timers, post-save rounds); refs avoid stale closures.
  const runSaveRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const scheduleRef = useRef<() => void>(() => undefined);

  const clearTimers = () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (retryTimer.current) clearTimeout(retryTimer.current);
    debounceTimer.current = null;
    retryTimer.current = null;
  };

  const runSave = useCallback((): Promise<void> => {
    const store = useAutomationBuilderStore.getState();
    if (!enabled || paused.current || !store.isDirty || store.isPublishing) return Promise.resolve();

    const payload = store.getDraftPayload();
    if (!payload) return Promise.resolve();

    const force = forceNext.current;
    forceNext.current = false;
    store.setSaveState('saving');
    firstPendingAt.current = null;

    const attempt = (async () => {
      try {
        const result = await saveDraftRef.current({
          variables: {
            id: payload.automationId,
            graph: payload.graph,
            triggerConfig: store.triggerType === 'schedule' ? payload.triggerConfig : undefined,
            baseRevision: payload.baseRevision,
            ...(force ? { force: true } : {}),
          },
        });
        if (result.error) throw result.error;

        const saved = result.data?.saveAutomationDraft;
        retryCount.current = 0;
        useAutomationBuilderStore.getState().ackSave({
          automationId: payload.automationId,
          loadEpoch: payload.loadEpoch,
          sentLocalRevision: payload.localRevision,
          draftRevision: saved.automation.draftRevision,
          hasUnpublishedChanges: saved.automation.hasUnpublishedChanges,
          issues: (saved.validationErrors ?? []) as ValidationErrorEntry[],
        });
      } catch (error: unknown) {
        // A reload/switch while the request was in flight: its outcome no longer concerns this state.
        const current = useAutomationBuilderStore.getState();
        if (current.automationId !== payload.automationId || current.loadEpoch !== payload.loadEpoch) return;

        const conflict = conflictExtensions(error);
        if (conflict) {
          paused.current = true;
          current.setConflict({
            draftRevision: conflict.draftRevision ?? null,
            draftUpdatedAt: conflict.draftUpdatedAt ?? null,
            draftUpdatedById: conflict.draftUpdatedById ?? null,
          });
          return;
        }

        // GraphQL errors (auth, not found, too large) won't fix themselves on retry.
        const isNetworkFailure = !CombinedGraphQLErrors.is(error);
        if (isNetworkFailure && typeof navigator !== 'undefined' && navigator.onLine === false) {
          current.setSaveState('offline');
          return;
        }
        if (isNetworkFailure && retryCount.current < AUTOSAVE_RETRY_DELAYS_MS.length) {
          const delay = AUTOSAVE_RETRY_DELAYS_MS[retryCount.current];
          retryCount.current += 1;
          // The retry must still overwrite, or a "keep my version" would turn back into a conflict.
          forceNext.current = force;
          current.setSaveState('pending');
          retryTimer.current = setTimeout(() => {
            retryTimer.current = null;
            void runSaveRef.current();
          }, delay);
          return;
        }
        current.setSaveState('error');
      }
    })();

    // attempt never rejects (every failure is handled above), so awaiting inFlight is always safe.
    const tracked: Promise<void> = attempt.finally(() => {
      if (inFlight.current === tracked) inFlight.current = null;
    });
    inFlight.current = tracked;

    return attempt;
  }, [enabled]);
  runSaveRef.current = runSave;

  const schedule = useCallback(() => {
    if (!enabled || paused.current || useAutomationBuilderStore.getState().isPublishing) return;
    // A backoff retry is already queued.
    if (retryTimer.current) return;
    // A request is in flight: pick the edits it didn't cover up as soon as it settles.
    if (inFlight.current) {
      void inFlight.current.then(() => {
        const state = useAutomationBuilderStore.getState();
        if (state.isDirty && state.saveState === 'pending') scheduleRef.current();
      });
      return;
    }

    const now = Date.now();
    if (firstPendingAt.current === null) firstPendingAt.current = now;
    const waitedSoFar = now - firstPendingAt.current;
    const delay = Math.max(0, Math.min(AUTOSAVE_DEBOUNCE_MS, AUTOSAVE_MAX_WAIT_MS - waitedSoFar));

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      debounceTimer.current = null;
      void runSave();
    }, delay);
  }, [enabled, runSave]);
  scheduleRef.current = schedule;

  const flush = useCallback(async (): Promise<boolean> => {
    clearTimers();
    // Bounded: each pass either saves everything or fails, so this can't spin on a stuck state.
    for (let pass = 0; pass < 5; pass += 1) {
      if (inFlight.current) await inFlight.current;
      const state = useAutomationBuilderStore.getState();
      if (!state.isDirty) return true;
      if (paused.current) return false;
      await runSave();
      const after = useAutomationBuilderStore.getState();
      if (after.saveState === 'error' || after.saveState === 'offline' || after.saveState === 'conflict') return false;
      // 'pending' here means a retry was scheduled after a network failure; flush stops waiting on it.
      if (after.isDirty && retryTimer.current) return false;
    }
    return !useAutomationBuilderStore.getState().isDirty;
  }, [runSave]);

  const retry = useCallback(async () => {
    retryCount.current = 0;
    return flush();
  }, [flush]);

  const overwriteWithMine = useCallback(async () => {
    paused.current = false;
    forceNext.current = true;
    return flush();
  }, [flush]);

  // Every edit (localRevision bump) restarts the debounce; a restored local draft schedules on mount.
  const localRevision = useAutomationBuilderStore((s) => s.localRevision);
  const isDirty = useAutomationBuilderStore((s) => s.isDirty);
  const loadEpoch = useAutomationBuilderStore((s) => s.loadEpoch);
  const saveState = useAutomationBuilderStore((s) => s.saveState);
  const isPublishing = useAutomationBuilderStore((s) => s.isPublishing);

  // Re-evaluated when a publish ends too, so edits made during it are picked up straight after.
  useEffect(() => {
    if (isDirty && saveState === 'pending' && !isPublishing) schedule();
  }, [localRevision, isDirty, saveState, isPublishing, schedule]);

  // A reload of the builder (load latest, discard, another automation) clears any conflict pause.
  useEffect(() => {
    paused.current = false;
    retryCount.current = 0;
    firstPendingAt.current = null;
  }, [loadEpoch]);

  useEffect(() => {
    if (!enabled) return undefined;
    const onOnline = () => {
      const state = useAutomationBuilderStore.getState();
      if (state.saveState === 'offline' || state.saveState === 'error') void retry();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [enabled, retry]);

  // Leaving the builder with an edit still debouncing: send it rather than lose it.
  useEffect(
    () => () => {
      clearTimers();
      const state = useAutomationBuilderStore.getState();
      // A request already in flight covers (or will conflict with) these edits; a second one with
      // the same base revision would only race it.
      if (state.isDirty && !paused.current && !inFlight.current) void runSave();
    },
    []
  );

  return { flush, retry, overwriteWithMine };
}

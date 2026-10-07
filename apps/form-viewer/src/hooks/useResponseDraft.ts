import { useCallback, useEffect, useRef, useState } from 'react';
import { useApolloClient } from '@apollo/client/react';
import { print } from 'graphql';
import { useFormResponseStore } from '@dculus/ui';
import { SAVE_RESPONSE_DRAFT, DISCARD_RESPONSE_DRAFT, type ResponseDraftData } from '../graphql/queries';
import { getGraphQLUrl } from '../lib/config';
import { getRespondentToken } from '../lib/respondentAuth';
import { draftDataKey, pruneDraftData, type DraftData } from '../lib/draftData';

/** Quiet period after the last keystroke before a save goes out. */
export const AUTOSAVE_DEBOUNCE_MS = 2_000;
const RETRY_DELAY_MS = 10_000;

export type ResponseDraft = ResponseDraftData;

export type DraftSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UseResponseDraftOptions {
  formId: string;
  /** False pauses autosave (form not draftable, not yet restored, or a submit is in flight). */
  enabled: boolean;
  /** Replaces the in-progress answers with another copy (conflict: "use those"). */
  applyDraft: (draft: ResponseDraft) => void;
}

const readAnswers = (): DraftData => {
  const flat: Record<string, unknown> = {};
  for (const pageResponses of Object.values(useFormResponseStore.getState().getAllResponses())) {
    Object.assign(flat, pageResponses);
  }
  return pruneDraftData(flat);
};

const EMPTY_KEY = draftDataKey({});

/**
 * Autosaves a signed-in respondent's answers as a server-side draft:
 * debounced while typing, immediately on page navigation, and once more when
 * the tab is hidden or closed. Saves carry the last version this tab saw, so
 * a newer save from another tab or device is surfaced as a conflict instead
 * of being overwritten.
 */
export function useResponseDraft({ formId, enabled, applyDraft }: UseResponseDraftOptions) {
  const client = useApolloClient();
  const [status, setStatus] = useState<DraftSaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ResponseDraft | null>(null);

  const versionRef = useRef<number | null>(null);
  const savedKeyRef = useRef<string>(EMPTY_KEY);
  const savedPageIdRef = useRef<string | null>(null);
  const pageIdRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const queuedRef = useRef(false);
  const activeRef = useRef(enabled);
  const conflictRef = useRef(false);
  activeRef.current = enabled;
  conflictRef.current = conflict !== null;

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  /** What a save would send right now, or null when nothing changed. */
  const pendingChange = useCallback(() => {
    const data = readAnswers();
    const key = draftDataKey(data);
    const answersChanged = key !== savedKeyRef.current;
    // A page move alone is only worth saving once a draft exists.
    const pageChanged = pageIdRef.current !== savedPageIdRef.current && versionRef.current !== null;
    return answersChanged || pageChanged ? { data, key } : null;
  }, []);

  const save = useCallback(async (): Promise<void> => {
    clearTimer();
    if (!activeRef.current || conflictRef.current) return;
    if (inFlightRef.current) {
      queuedRef.current = true;
      return;
    }
    const change = pendingChange();
    if (!change) return;

    let settle!: () => void;
    inFlightRef.current = new Promise<void>((resolve) => (settle = resolve));
    setStatus('saving');
    const pageId = pageIdRef.current;
    try {
      const { data, error } = await client.mutate({
        mutation: SAVE_RESPONSE_DRAFT,
        variables: {
          input: { formId, data: change.data, currentPageId: pageId, baseVersion: versionRef.current },
        },
      });
      if (error || !data?.saveResponseDraft) throw error ?? new Error('Draft save failed');

      const { draft, conflict: isConflict } = data.saveResponseDraft;
      if (isConflict) {
        conflictRef.current = true;
        setConflict(draft);
        setStatus('idle');
        return;
      }
      versionRef.current = draft.version;
      savedKeyRef.current = change.key;
      savedPageIdRef.current = pageId;
      setLastSavedAt(draft.updatedAt);
      setStatus('saved');
    } catch {
      setStatus('error');
      if (activeRef.current) timerRef.current = setTimeout(() => void save(), RETRY_DELAY_MS);
    } finally {
      inFlightRef.current = null;
      settle();
      if (queuedRef.current) {
        queuedRef.current = false;
        void save();
      }
    }
  }, [client, formId, pendingChange]);

  const scheduleSave = useCallback(
    (delay: number) => {
      if (!activeRef.current) return;
      clearTimer();
      timerRef.current = setTimeout(() => void save(), delay);
    },
    [save]
  );

  // Debounced save on every answer change.
  useEffect(() => {
    if (!enabled) return;
    const unsubscribe = useFormResponseStore.subscribe(() => scheduleSave(AUTOSAVE_DEBOUNCE_MS));
    return () => {
      unsubscribe();
      clearTimer();
    };
  }, [enabled, scheduleSave]);

  // Last-chance saves: a hidden tab still runs a normal request; a closing
  // page needs `keepalive` so the request outlives it (with the bearer header,
  // which `sendBeacon` can't carry).
  useEffect(() => {
    if (!enabled) return;
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') void save();
    };
    const onPageHide = () => {
      if (conflictRef.current || inFlightRef.current) return;
      const change = pendingChange();
      if (!change) return;
      const token = getRespondentToken();
      try {
        void fetch(getGraphQLUrl(), {
          method: 'POST',
          keepalive: true,
          credentials: 'include',
          headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({
            query: print(SAVE_RESPONSE_DRAFT),
            variables: {
              input: { formId, data: change.data, currentPageId: pageIdRef.current, baseVersion: versionRef.current },
            },
          }),
        }).catch(() => {});
      } catch {
        // keepalive bodies are capped (~64 KB); the debounced save already covered most edits.
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [enabled, formId, pendingChange, save]);

  /**
   * Cancel pending saves and wait out one already on the wire, so it can't
   * land after a submit or "Start over" and bring a deleted draft back.
   */
  const settle = useCallback(async () => {
    clearTimer();
    queuedRef.current = false;
    await inFlightRef.current;
  }, []);

  /** Record the page the respondent is on; saved right away so they resume there. */
  const setCurrentPage = useCallback(
    (pageId: string) => {
      if (pageIdRef.current === pageId) return;
      pageIdRef.current = pageId;
      scheduleSave(0);
    },
    [scheduleSave]
  );

  /** Conflict: overwrite the other copy with the answers on screen. */
  const keepMine = useCallback(() => {
    if (!conflict) return;
    versionRef.current = conflict.version;
    savedKeyRef.current = draftDataKey(conflict.data);
    savedPageIdRef.current = conflict.currentPageId;
    conflictRef.current = false;
    setConflict(null);
    void save();
  }, [conflict, save]);

  /** Conflict: replace the answers on screen with the other copy. */
  const acceptOther = useCallback(() => {
    if (!conflict) return;
    versionRef.current = conflict.version;
    savedKeyRef.current = draftDataKey(conflict.data);
    savedPageIdRef.current = conflict.currentPageId;
    pageIdRef.current = conflict.currentPageId;
    conflictRef.current = false;
    setConflict(null);
    applyDraft(conflict);
    setLastSavedAt(conflict.updatedAt);
    setStatus('saved');
  }, [applyDraft, conflict]);

  /**
   * Start tracking from a known server state: the draft the form was just
   * restored from, or null for a fresh start (after a submit, a sign-out or
   * "Start over").
   */
  const seed = useCallback((draft: ResponseDraft | null) => {
    clearTimer();
    queuedRef.current = false;
    versionRef.current = draft?.version ?? null;
    savedKeyRef.current = draft ? draftDataKey(draft.data) : EMPTY_KEY;
    savedPageIdRef.current = draft?.currentPageId ?? null;
    pageIdRef.current = draft?.currentPageId ?? null;
    conflictRef.current = false;
    setConflict(null);
    setStatus(draft ? 'saved' : 'idle');
    setLastSavedAt(draft?.updatedAt ?? null);
  }, []);

  /** "Start over": delete the server copy. The caller clears the answers on screen. */
  const discard = useCallback(async () => {
    await settle();
    seed(null);
    await client.mutate({ mutation: DISCARD_RESPONSE_DRAFT, variables: { formId } });
  }, [client, formId, seed, settle]);

  return { status, lastSavedAt, conflict, seed, settle, setCurrentPage, keepMine, acceptOther, discard };
}

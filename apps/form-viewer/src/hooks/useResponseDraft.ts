import { useCallback, useEffect, useRef, useState } from 'react';
import { CombinedGraphQLErrors } from '@apollo/client';
import { useApolloClient } from '@apollo/client/react';
import { print } from 'graphql';
import { useFormResponseStore } from '@dculus/ui';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import {
  SAVE_RESPONSE_DRAFT,
  DISCARD_RESPONSE_DRAFT,
  type ResponseDraftData,
  type SaveResponseDraftResult,
  type SaveResponseDraftVariables,
} from '../graphql/queries';
import { getGraphQLUrl } from '../lib/config';
import { getRespondentToken } from '../lib/respondentAuth';
import { draftDataKey, pruneDraftData, type DraftData } from '../lib/draftData';

/** Quiet period after the last keystroke before a save goes out. */
export const AUTOSAVE_DEBOUNCE_MS = 2_000;
const RETRY_DELAY_MS = 10_000;
const MAX_RETRY_DELAY_MS = 5 * 60_000;

export type ResponseDraft = ResponseDraftData;

/** `stopped`: the server refused the save for good (form closed, access revoked…), so autosave is off. */
export type DraftSaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'stopped';

/**
 * Why autosave paused: another tab or device saved newer answers (`newer`),
 * or the draft was submitted or cleared there (`gone`).
 */
export type DraftConflict = { kind: 'newer'; draft: ResponseDraft } | { kind: 'gone' };

type SaveOutcome = SaveResponseDraftResult['saveResponseDraft'];
type SaveInput = SaveResponseDraftVariables['input'];

/** Rejections a retry can't fix; anything else (network, server hiccup) is retried. */
const PERMANENT_ERROR_CODES = new Set<string>([
  GRAPHQL_ERROR_CODES.FORM_NOT_FOUND,
  GRAPHQL_ERROR_CODES.FORM_NOT_PUBLISHED,
  GRAPHQL_ERROR_CODES.NO_ACCESS,
  GRAPHQL_ERROR_CODES.SIGN_IN_REQUIRED,
  GRAPHQL_ERROR_CODES.EMAIL_DOMAIN_NOT_ALLOWED,
  GRAPHQL_ERROR_CODES.FORM_NOT_YET_OPEN,
  GRAPHQL_ERROR_CODES.FORM_CLOSED,
  GRAPHQL_ERROR_CODES.BAD_USER_INPUT,
]);

class DraftSaveError extends Error {
  constructor(readonly code: string | undefined) {
    super(`Draft save failed${code ? ` (${code})` : ''}`);
  }
}

const errorCodeOf = (error: unknown): string | undefined => {
  if (error instanceof DraftSaveError) return error.code;
  return CombinedGraphQLErrors.is(error) ? (error.errors[0]?.extensions?.code as string | undefined) : undefined;
};

/**
 * Sends a save with `keepalive`, so it outlives a closing page (with the
 * bearer header, which `sendBeacon` can't carry). Bodies over the browser's
 * keepalive cap (~64 KB) make fetch throw; the caller falls back to Apollo.
 */
async function saveWithKeepalive(input: SaveInput): Promise<SaveOutcome> {
  const token = getRespondentToken();
  const response = await fetch(getGraphQLUrl(), {
    method: 'POST',
    keepalive: true,
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ query: print(SAVE_RESPONSE_DRAFT), variables: { input } }),
  });
  const body = (await response.json()) as {
    data?: SaveResponseDraftResult | null;
    errors?: Array<{ extensions?: { code?: string } }>;
  };
  if (body.errors?.length || !body.data?.saveResponseDraft) {
    throw new DraftSaveError(body.errors?.[0]?.extensions?.code);
  }
  return body.data.saveResponseDraft;
}

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
  const [conflict, setConflict] = useState<DraftConflict | null>(null);

  const versionRef = useRef<number | null>(null);
  const savedKeyRef = useRef<string>(EMPTY_KEY);
  const savedPageIdRef = useRef<string | null>(null);
  const pageIdRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const queuedRef = useRef(false);
  const retryDelayRef = useRef(RETRY_DELAY_MS);
  const activeRef = useRef(enabled);
  /** Set by conflicts, permanent rejections and "Start over": saves are skipped until cleared. */
  const pausedRef = useRef(false);
  activeRef.current = enabled;

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

  const send = useCallback(
    async (input: SaveInput, keepalive: boolean): Promise<SaveOutcome> => {
      if (keepalive) {
        try {
          return await saveWithKeepalive(input);
        } catch (error) {
          // A rejected save is final; only a fetch that never went out falls back.
          if (error instanceof DraftSaveError) throw error;
        }
      }
      const { data, error } = await client.mutate({ mutation: SAVE_RESPONSE_DRAFT, variables: { input } });
      if (error || !data?.saveResponseDraft) throw error ?? new Error('Draft save failed');
      return data.saveResponseDraft;
    },
    [client]
  );

  /**
   * Saves what changed since the last save. `keepalive` is for the
   * last-chance saves when the tab is hidden or closed, which must survive
   * the page unloading.
   */
  const save = useCallback(
    async ({ keepalive = false }: { keepalive?: boolean } = {}): Promise<void> => {
      clearTimer();
      if (!activeRef.current || pausedRef.current) return;
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
        const outcome = await send(
          { formId, data: change.data, currentPageId: pageId, baseVersion: versionRef.current },
          keepalive
        );
        retryDelayRef.current = RETRY_DELAY_MS;
        if (outcome.conflict) {
          pausedRef.current = true;
          setConflict(outcome.draft ? { kind: 'newer', draft: outcome.draft } : { kind: 'gone' });
          setStatus('idle');
          return;
        }
        if (!outcome.draft) throw new Error('Draft save returned no draft');
        versionRef.current = outcome.draft.version;
        savedKeyRef.current = change.key;
        savedPageIdRef.current = pageId;
        setLastSavedAt(outcome.draft.updatedAt);
        setStatus('saved');
      } catch (error) {
        const code = errorCodeOf(error);
        if (code && PERMANENT_ERROR_CODES.has(code)) {
          pausedRef.current = true;
          setStatus('stopped');
          return;
        }
        setStatus('error');
        if (activeRef.current) {
          timerRef.current = setTimeout(() => void save(), retryDelayRef.current);
          retryDelayRef.current = Math.min(retryDelayRef.current * 2, MAX_RETRY_DELAY_MS);
        }
      } finally {
        inFlightRef.current = null;
        settle();
        if (queuedRef.current) {
          queuedRef.current = false;
          void save({ keepalive });
        }
      }
    },
    [formId, pendingChange, send]
  );

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

  // Last-chance saves when the tab is hidden or closed. Both use keepalive:
  // `visibilitychange` usually fires first on close, and a save it starts
  // must survive the page unloading, since `pagehide` then finds it in flight.
  useEffect(() => {
    if (!enabled) return;
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') void save({ keepalive: true });
    };
    const onPageHide = () => void save({ keepalive: true });
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [enabled, save]);

  /**
   * Cancel pending saves and wait out one already on the wire, so it can't
   * land after a submit or "Start over" and bring a deleted draft back.
   */
  const settle = useCallback(async () => {
    clearTimer();
    queuedRef.current = false;
    await inFlightRef.current;
  }, []);

  /** Save any pending change now, before the answers on screen are swapped out. */
  const flush = useCallback(async () => {
    while (inFlightRef.current) await inFlightRef.current;
    await save();
  }, [save]);

  /** Record the page the respondent is on; saved right away so they resume there. */
  const setCurrentPage = useCallback(
    (pageId: string) => {
      if (pageIdRef.current === pageId) return;
      pageIdRef.current = pageId;
      scheduleSave(0);
    },
    [scheduleSave]
  );

  /** Track `draft` as the server's current copy (null: no draft stored). */
  const trackServerCopy = useCallback((draft: ResponseDraft | null) => {
    versionRef.current = draft?.version ?? null;
    savedKeyRef.current = draft ? draftDataKey(draft.data) : EMPTY_KEY;
    savedPageIdRef.current = draft?.currentPageId ?? null;
  }, []);

  /**
   * Conflict: save the answers on screen, over the newer copy, or as a new
   * draft when the old one was submitted or cleared elsewhere.
   */
  const keepMine = useCallback(() => {
    if (!conflict) return;
    trackServerCopy(conflict.kind === 'newer' ? conflict.draft : null);
    pausedRef.current = false;
    setConflict(null);
    void save();
  }, [conflict, save, trackServerCopy]);

  /** Conflict: replace the answers on screen with the newer copy. */
  const acceptOther = useCallback(() => {
    if (conflict?.kind !== 'newer') return;
    const { draft } = conflict;
    trackServerCopy(draft);
    pageIdRef.current = draft.currentPageId;
    pausedRef.current = false;
    setConflict(null);
    applyDraft(draft);
    setLastSavedAt(draft.updatedAt);
    setStatus('saved');
  }, [applyDraft, conflict, trackServerCopy]);

  /**
   * Start tracking from a known server state: the draft the form was just
   * restored from, or null for a fresh start (after a submit, a sign-out or
   * "Start over").
   */
  const seed = useCallback((draft: ResponseDraft | null) => {
    clearTimer();
    queuedRef.current = false;
    retryDelayRef.current = RETRY_DELAY_MS;
    trackServerCopy(draft);
    pageIdRef.current = draft?.currentPageId ?? null;
    pausedRef.current = false;
    setConflict(null);
    setStatus(draft ? 'saved' : 'idle');
    setLastSavedAt(draft?.updatedAt ?? null);
  }, [trackServerCopy]);

  /**
   * "Start over": clear the answers on screen (`clearAnswers`), then delete
   * the server copy. Saves stay paused until both are done, so a hidden-tab
   * save can't send the old answers back in between.
   */
  const discard = useCallback(
    async (clearAnswers: () => void) => {
      pausedRef.current = true;
      await settle();
      clearAnswers();
      try {
        await client.mutate({ mutation: DISCARD_RESPONSE_DRAFT, variables: { formId } });
      } finally {
        seed(null);
      }
    },
    [client, formId, seed, settle]
  );

  return { status, lastSavedAt, conflict, seed, settle, flush, setCurrentPage, keepMine, acceptOther, discard };
}

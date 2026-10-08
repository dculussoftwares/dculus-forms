import { useFormResponseStore } from '@dculus/ui';
import { containsFile, pruneDraftData, type DraftData, type PageResponses } from './draftData';

/** The answers currently on screen, flattened and pruned the way drafts store them. */
export function readCurrentAnswers(): DraftData {
  const flat: Record<string, unknown> = {};
  for (const pageResponses of Object.values(useFormResponseStore.getState().getAllResponses())) {
    Object.assign(flat, pageResponses);
  }
  return pruneDraftData(flat);
}

/** Files picked on screen, by page. Drafts never hold files, so they are carried separately. */
export function readCurrentFileAnswers(): PageResponses {
  const files: PageResponses = {};
  for (const [pageId, pageResponses] of Object.entries(useFormResponseStore.getState().getAllResponses())) {
    for (const [fieldId, value] of Object.entries(pageResponses)) {
      if (containsFile(value)) (files[pageId] ??= {})[fieldId] = value;
    }
  }
  return files;
}

const storageKey = (formId: string) => `dculus_pending_answers:${formId}`;
/** A sign-in redirect takes seconds; anything older was abandoned (cancelled or failed sign-in). */
const STASH_MAX_AGE_MS = 15 * 60 * 1000;

/**
 * Keeps the answers on screen across a full-page sign-in (Google redirects away
 * and comes back to a fresh page). sessionStorage, so it never outlives the tab.
 */
export function stashPendingAnswers(formId: string): void {
  try {
    const answers = readCurrentAnswers();
    if (Object.keys(answers).length === 0) return;
    sessionStorage.setItem(storageKey(formId), JSON.stringify({ savedAt: Date.now(), answers }));
  } catch {
    // Storage unavailable (private browsing, quota): the respondent re-types.
  }
}

/** Drops a stash that will not be needed, e.g. once the answers were submitted. */
export function clearPendingAnswers(formId: string): void {
  try {
    sessionStorage.removeItem(storageKey(formId));
  } catch {
    // Nothing to clear.
  }
}

/** Reads and removes the answers stashed before a sign-in redirect, unless they went stale. */
export function takePendingAnswers(formId: string): DraftData {
  try {
    const raw = sessionStorage.getItem(storageKey(formId));
    if (!raw) return {};
    clearPendingAnswers(formId);
    const stash: { savedAt?: unknown; answers?: unknown } | null = JSON.parse(raw);
    const { savedAt, answers } = stash ?? {};
    if (typeof savedAt !== 'number' || Date.now() - savedAt > STASH_MAX_AGE_MS) return {};
    return answers && typeof answers === 'object' && !Array.isArray(answers)
      ? pruneDraftData(answers as DraftData)
      : {};
  } catch {
    return {};
  }
}

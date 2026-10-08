import { useFormResponseStore } from '@dculus/ui';
import { pruneDraftData, type DraftData } from './draftData';

/** The answers currently on screen, flattened and pruned the way drafts store them. */
export function readCurrentAnswers(): DraftData {
  const flat: Record<string, unknown> = {};
  for (const pageResponses of Object.values(useFormResponseStore.getState().getAllResponses())) {
    Object.assign(flat, pageResponses);
  }
  return pruneDraftData(flat);
}

const storageKey = (formId: string) => `dculus_pending_answers:${formId}`;

/**
 * Keeps the answers on screen across a full-page sign-in (Google redirects away
 * and comes back to a fresh page). sessionStorage, so it never outlives the tab.
 */
export function stashPendingAnswers(formId: string): void {
  try {
    const answers = readCurrentAnswers();
    if (Object.keys(answers).length === 0) return;
    sessionStorage.setItem(storageKey(formId), JSON.stringify(answers));
  } catch {
    // Storage unavailable (private browsing, quota): the respondent re-types.
  }
}

/** Reads and removes the answers stashed before a sign-in redirect. */
export function takePendingAnswers(formId: string): DraftData {
  try {
    const raw = sessionStorage.getItem(storageKey(formId));
    if (!raw) return {};
    sessionStorage.removeItem(storageKey(formId));
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? pruneDraftData(parsed as DraftData) : {};
  } catch {
    return {};
  }
}

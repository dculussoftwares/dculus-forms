/**
 * Session-scoped draft persistence for the automation builder.
 *
 * The Google Sheets / Microsoft Sheets action config forms connect via a full-page OAuth
 * redirect (`window.location.href = .../auth?return_to=...`), not a popup — the whole SPA
 * unmounts and remounts on return. Without this, two things get silently lost on that
 * round-trip:
 *   1. Any not-yet-Saved graph edits (e.g. a brand-new action node the user just added and
 *      was in the middle of configuring) — a fresh mount only has the last-*Saved* graph
 *      from the server to fall back on.
 *   2. Which node's config panel was open — `loadGraph` always starts with no selection, so
 *      the panel that was mid-OAuth-connect doesn't reopen, and the ConfigForm's own
 *      hash-token-parsing effect never mounts to catch the returned token.
 *
 * Both are namespaced by automationId in sessionStorage, which survives a same-tab
 * top-level navigation (the OAuth redirect) but not a closed tab — exactly the lifetime
 * this needs. All access is best-effort: sessionStorage can throw in private-browsing or
 * quota-exceeded contexts, and none of this is required for the builder to function.
 */

export interface SerializedGraph {
  nodes: { id: string; type: string; data: any }[];
  edges: { id: string; source: string; target: string; sourceHandle?: 'true' | 'false' }[];
}

const draftKey = (automationId: string) => `dculus:automation-builder:draft:${automationId}`;
const selectionKey = (automationId: string) => `dculus:automation-builder:selection:${automationId}`;

function safeSet(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // ignore — best-effort persistence only
  }
}

function safeGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeRemove(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function persistDraftGraph(automationId: string, graph: SerializedGraph): void {
  safeSet(draftKey(automationId), JSON.stringify(graph));
}

export function readDraftGraph(automationId: string): SerializedGraph | null {
  const raw = safeGet(draftKey(automationId));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearDraftGraph(automationId: string): void {
  safeRemove(draftKey(automationId));
}

export function persistSelectedNodeId(automationId: string, nodeId: string | null): void {
  if (nodeId) {
    safeSet(selectionKey(automationId), nodeId);
  } else {
    safeRemove(selectionKey(automationId));
  }
}

export function readSelectedNodeId(automationId: string): string | null {
  return safeGet(selectionKey(automationId));
}

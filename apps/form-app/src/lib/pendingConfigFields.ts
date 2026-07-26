/**
 * Survives a full-page OAuth "Connect" redirect for a plugin config form's in-progress,
 * not-yet-saved field edits (e.g. a typed Plugin Name or Worksheet Name).
 *
 * The automation builder's session draft (see automations/builder/draftStorage.ts) only
 * covers config that's already been committed via "Save action" — anything still mid-edit in
 * the open config panel is plain React state, which a full page reload discards. Google/
 * Microsoft Sheets' "Connect Account" buttons redirect the current tab (see their ConfigForm's
 * handleConnect*), so without this, typing a name and clicking Connect before saving silently
 * reverts the name once the OAuth flow returns.
 *
 * Keyed by the current pathname: at most one Connect flow is in flight per tab at a time, and
 * the stash is written immediately before navigating away and consumed (read + removed) the
 * moment the redirect returns, so there's no window where a different config panel's pending
 * edits could leak into another one.
 */
const key = (pluginType: string) => `dculus:pending-config-fields:${pluginType}:${window.location.pathname}`;

export function stashPendingConfigFields(pluginType: string, fields: Record<string, unknown>): void {
  try {
    sessionStorage.setItem(key(pluginType), JSON.stringify(fields));
  } catch {
    // best-effort only — sessionStorage can throw in private-browsing or quota-exceeded contexts
  }
}

export function consumePendingConfigFields<T extends Record<string, unknown>>(pluginType: string): T | null {
  const storageKey = key(pluginType);
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return null;
    sessionStorage.removeItem(storageKey);
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

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

/**
 * Binds an OAuth "Connect" round trip to the tab that started it. The nonce rides the
 * `return_to` path the backend hands back after the exchange; a token fragment is only
 * accepted when it returns with the nonce this tab stored, so a crafted link carrying an
 * attacker's token (S16-01) is ignored.
 */
const OAUTH_NONCE_PARAM = 'oauth_nonce';
const nonceKey = (pluginType: string) => `dculus:oauth-connect-nonce:${pluginType}:${window.location.pathname}`;

export function beginOAuthConnect(pluginType: string, returnTo: string): string {
  try {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const nonce = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    sessionStorage.setItem(nonceKey(pluginType), nonce);
    return `${returnTo}${returnTo.includes('?') ? '&' : '?'}${OAUTH_NONCE_PARAM}=${nonce}`;
  } catch {
    return returnTo;
  }
}

/** Single use. Always strips the nonce from the address bar, matching or not. */
export function verifyOAuthReturn(pluginType: string): boolean {
  const params = new URLSearchParams(window.location.search);
  const returned = params.get(OAUTH_NONCE_PARAM);
  let stored: string | null = null;
  try {
    stored = sessionStorage.getItem(nonceKey(pluginType));
    sessionStorage.removeItem(nonceKey(pluginType));
  } catch {
    stored = null;
  }
  if (params.has(OAUTH_NONCE_PARAM)) {
    params.delete(OAUTH_NONCE_PARAM);
    const search = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (search ? `?${search}` : '') + window.location.hash);
  }
  return !!stored && !!returned && stored === returned;
}

/**
 * Decodes the base64url token JSON from the redirect fragment and keeps only the known
 * string fields. Returns null when it isn't an object with a string `accessToken` and an
 * `expiresAt` that parses as a date.
 */
export function parseOAuthTokenFragment<T extends { accessToken: string; expiresAt: string }>(
  raw: string,
  optionalStringKeys: readonly string[]
): T | null {
  try {
    const b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const parsed: unknown = JSON.parse(atob(padded));
    if (!parsed || typeof parsed !== 'object') return null;
    const record = parsed as Record<string, unknown>;
    if (typeof record.accessToken !== 'string' || !record.accessToken) return null;
    if (typeof record.expiresAt !== 'string' || Number.isNaN(new Date(record.expiresAt).getTime())) return null;
    const token: Record<string, string> = { accessToken: record.accessToken, expiresAt: record.expiresAt };
    for (const key of optionalStringKeys) {
      const value = record[key];
      if (value === undefined || value === null) continue;
      if (typeof value !== 'string') return null;
      token[key] = value;
    }
    return token as unknown as T;
  } catch {
    return null;
  }
}

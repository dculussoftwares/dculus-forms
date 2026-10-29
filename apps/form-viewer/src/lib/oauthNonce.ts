const STORAGE_KEY = 'dculus_respondent_oauth_nonce';
export const OAUTH_NONCE_PATTERN = /^[A-Za-z0-9_-]{22,128}$/;

/**
 * Binds a Google sign-in to the tab that started it. The nonce rides the OAuth
 * round trip and is compared on return, so a one-time-token link crafted by someone
 * else (login CSRF) is rejected: this browser never stored a matching nonce.
 */
export function startOAuthNonce(): string | null {
  try {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const nonce = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    sessionStorage.setItem(STORAGE_KEY, nonce);
    return nonce;
  } catch {
    return null;
  }
}

/** Single use: the stored nonce is cleared whether or not it matches. */
export function consumeOAuthNonce(returned: string | null): boolean {
  let stored: string | null = null;
  try {
    stored = sessionStorage.getItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    return false;
  }
  return !!stored && !!returned && OAUTH_NONCE_PATTERN.test(returned) && stored === returned;
}

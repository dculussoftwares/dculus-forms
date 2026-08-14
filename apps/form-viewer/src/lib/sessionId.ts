const SESSION_KEY = 'dculus_form_session_id';
const SESSION_EXPIRY_KEY = 'dculus_form_session_expiry';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Returns the persisted anonymous session ID, creating a new one if it is
 * absent or older than 24 hours. A 24-hour TTL limits how long a single ID
 * can track a user across form views (privacy compliance).
 */
export function getOrCreateSessionId(): string {
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    const expiry = localStorage.getItem(SESSION_EXPIRY_KEY);

    if (stored && expiry && Date.now() < parseInt(expiry, 10)) {
      return stored;
    }

    const sessionId = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, sessionId);
    localStorage.setItem(SESSION_EXPIRY_KEY, String(Date.now() + SESSION_TTL_MS));
    return sessionId;
  } catch {
    // localStorage or crypto.randomUUID may be unavailable (private browsing, HTTP origins)
    if (typeof crypto?.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    if (typeof crypto?.getRandomValues === 'function') {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    }
    // No Web Crypto API available at all — extremely unlikely in a modern browser.
    return `${Date.now().toString(36)}-${performance.now().toString(36)}`;
  }
}

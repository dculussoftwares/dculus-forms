/**
 * S04-05: bounds how much an anonymous caller can inflate a form's view
 * counter. Counting is skipped (the mutation still succeeds) when the same
 * session was already counted recently, or when one client IP has produced
 * too many counted views for the same form. In-process only, so it limits
 * per backend instance.
 */

const SESSION_WINDOW_MS = 30 * 60 * 1000;
const CLIENT_WINDOW_MS = 10 * 60 * 1000;
const MAX_VIEWS_PER_CLIENT_PER_WINDOW = 60;
const MAX_TRACKED_KEYS = 50_000;

const sessionSeen = new Map<string, number>();
const clientViews = new Map<string, { windowStart: number; count: number }>();

const prune = (now: number): void => {
  if (sessionSeen.size + clientViews.size < MAX_TRACKED_KEYS) return;
  for (const [key, seenAt] of sessionSeen) {
    if (now - seenAt >= SESSION_WINDOW_MS) sessionSeen.delete(key);
  }
  for (const [key, entry] of clientViews) {
    if (now - entry.windowStart >= CLIENT_WINDOW_MS) clientViews.delete(key);
  }
  // Still over the cap under a flood of unique keys: drop everything rather than grow unbounded.
  if (sessionSeen.size + clientViews.size >= MAX_TRACKED_KEYS) {
    sessionSeen.clear();
    clientViews.clear();
  }
};

export function shouldCountFormView(
  formId: string,
  sessionId: string,
  clientIp: string | undefined,
  now: number = Date.now()
): boolean {
  prune(now);

  const sessionKey = `${formId}:${sessionId}`;
  const seenAt = sessionSeen.get(sessionKey);
  if (seenAt !== undefined && now - seenAt < SESSION_WINDOW_MS) return false;

  const clientKey = `${formId}:${clientIp ?? 'unknown'}`;
  const entry = clientViews.get(clientKey);
  if (entry && now - entry.windowStart < CLIENT_WINDOW_MS) {
    if (entry.count >= MAX_VIEWS_PER_CLIENT_PER_WINDOW) return false;
    entry.count += 1;
  } else {
    clientViews.set(clientKey, { windowStart: now, count: 1 });
  }

  sessionSeen.set(sessionKey, now);
  return true;
}

export function resetFormViewDedupeForTests(): void {
  sessionSeen.clear();
  clientViews.clear();
}

/**
 * Remembers which public template a visitor picked on dculus.com
 * (forms.dculus.com/signup?template=<slug>) until they are signed in with a
 * workspace, so every sign-up path — email code, magic link, Google — ends in
 * the builder with their copy of that template.
 *
 * localStorage (not sessionStorage) so it survives a magic link opened in a
 * new tab. Expires after a day so a stale pick never surprises a later visit.
 */
const STORAGE_KEY = 'dculus:pendingTemplate';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

interface StoredPendingTemplate {
  slug: string;
  savedAt: number;
}

const safeStorage = (): Storage | null => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
};

export function setPendingTemplate(slug: string, now: number = Date.now()): boolean {
  const normalized = slug.trim().toLowerCase();
  if (!SLUG_PATTERN.test(normalized) || normalized.length > 80) return false;
  try {
    safeStorage()?.setItem(STORAGE_KEY, JSON.stringify({ slug: normalized, savedAt: now }));
    return true;
  } catch {
    return false;
  }
}

export function getPendingTemplate(now: number = Date.now()): string | null {
  try {
    const raw = safeStorage()?.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredPendingTemplate>;
    if (typeof parsed.slug !== 'string' || typeof parsed.savedAt !== 'number') {
      clearPendingTemplate();
      return null;
    }
    if (now - parsed.savedAt > MAX_AGE_MS) {
      clearPendingTemplate();
      return null;
    }
    return parsed.slug;
  } catch {
    return null;
  }
}

export function clearPendingTemplate(): void {
  try {
    safeStorage()?.removeItem(STORAGE_KEY);
  } catch {
    // storage unavailable — nothing to clear
  }
}

/**
 * Read ?template=<slug> from the current URL (any route), remember it, and
 * strip it from the address bar so a refresh or shared link doesn't repeat it.
 */
export function capturePendingTemplateFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  const slug = url.searchParams.get('template');
  if (!slug) return null;

  const saved = setPendingTemplate(slug);
  url.searchParams.delete('template');
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  return saved ? slug.trim().toLowerCase() : null;
}

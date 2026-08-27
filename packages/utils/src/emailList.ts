/**
 * Single email address check — intentionally permissive (not full RFC 5322), matching the
 * lightweight checks already used across the app (backend aiFormEditTools `EMAIL_REGEX`, the
 * email plugin ConfigForm's inline regex). Good enough to catch typos and stray separators;
 * the SMTP server is the real authority on deliverability.
 */
export const EMAIL_ADDRESS_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Splits a free-text recipient string into individual addresses. Accepts comma, semicolon,
 * newline, or plain whitespace as separators, trims each token, drops empties, and
 * de-duplicates case-insensitively (keeping the first-seen casing). Original order is preserved.
 *
 * Used wherever a "fixed address" email field may now hold more than one address — a scheduled
 * summary that needs to reach several people, for example.
 */
export function parseEmailList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const token of raw.split(/[,;\s]+/)) {
    const addr = token.trim();
    if (!addr) continue;
    const key = addr.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(addr);
  }
  return result;
}

/**
 * Parses `raw` with {@link parseEmailList} and partitions the addresses into valid / invalid
 * (per {@link EMAIL_ADDRESS_REGEX}). Both arrays are empty for an empty input — callers decide
 * whether "no addresses at all" is itself an error for their context.
 */
export function validateEmailList(raw: string | null | undefined): {
  valid: string[];
  invalid: string[];
} {
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const addr of parseEmailList(raw)) {
    (EMAIL_ADDRESS_REGEX.test(addr) ? valid : invalid).push(addr);
  }
  return { valid, invalid };
}

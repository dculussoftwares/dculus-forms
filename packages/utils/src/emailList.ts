/**
 * Single email address check — intentionally permissive (not full RFC 5322), matching the
 * lightweight checks already used across the app. Good enough to catch typos and stray
 * separators; the SMTP server is the real authority on deliverability.
 *
 * Implemented with string ops rather than one regex on purpose: the obvious pattern
 * (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) backtracks polynomially on adversarial input like
 * `"!@!.!.!.!."` because `.` isn't excluded from the char classes around `\.`. This runs in
 * linear time on any input.
 */
export function isEmailAddress(value: string): boolean {
  if (!value || /\s/.test(value)) return false;

  const at = value.indexOf('@');
  // Exactly one '@', with a non-empty local part before it.
  if (at <= 0 || at !== value.lastIndexOf('@')) return false;

  const domain = value.slice(at + 1);
  if (!domain) return false;

  // Domain must contain a dot that is neither the first nor the last character
  // (so "a@b.c" passes, "a@.com" / "a@com." / "a@com" do not).
  const dot = domain.lastIndexOf('.');
  return dot > 0 && dot < domain.length - 1;
}

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
 * (per {@link isEmailAddress}). Both arrays are empty for an empty input — callers decide
 * whether "no addresses at all" is itself an error for their context.
 */
export function validateEmailList(raw: string | null | undefined): {
  valid: string[];
  invalid: string[];
} {
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const addr of parseEmailList(raw)) {
    (isEmailAddress(addr) ? valid : invalid).push(addr);
  }
  return { valid, invalid };
}

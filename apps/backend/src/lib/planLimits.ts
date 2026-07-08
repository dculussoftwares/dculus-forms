// Fallback limits used when Chargebee entitlements are unavailable, and as the
// floor a cancelled/expired org's usage enforcement falls back to (it no longer
// holds an active paid entitlement, so it must not keep the last-synced paid
// tier's limits indefinitely).
// Keep in sync with Chargebee entitlement config — the live values take
// precedence once getAvailablePlans() has populated the cache.
export const PLAN_LIMITS_FALLBACK: Record<string, { views: number | null; submissions: number | null }> = {
  free: { views: 10000, submissions: 1000 },
  starter: { views: null, submissions: 10000 },
  advanced: { views: null, submissions: 100000 },
};

// Fallback limits used when Chargebee entitlements are unavailable, and as the
// floor a cancelled/expired org's usage enforcement falls back to (it no longer
// holds an active paid entitlement, so it must not keep the last-synced paid
// tier's limits indefinitely).
// Keep in sync with Chargebee entitlement config — the live values take
// precedence once getAvailablePlans() has populated the cache.
export const PLAN_LIMITS_FALLBACK: Record<
  string,
  { views: number | null; submissions: number | null; emails: number | null }
> = {
  free: { views: 10000, submissions: 1000, emails: 100 },
  starter: { views: null, submissions: 10000, emails: 5000 },
  advanced: { views: null, submissions: 25000, emails: 50000 },
  // Enterprise limits are admin-set directly on the Subscription row (see
  // chargebeeService.setEnterpriseSubscription), not derived from this map — this
  // entry only guards the unlikely case that getPlanLimits('enterprise') is called.
  enterprise: { views: null, submissions: null, emails: null },
};

/**
 * Whether forms owned by an org may hide the "Powered by Dculus" badge.
 * Branding removal is a paid-plan entitlement: every plan except `free` has it,
 * but a cancelled/expired subscription loses it (it is back on the free tier).
 * An org with no subscription row is on the free plan.
 */
export const canRemoveBranding = (
  subscription: { planId: string; status: string } | null | undefined
): boolean => {
  if (!subscription) return false;
  if (subscription.status === 'cancelled' || subscription.status === 'expired') return false;
  return subscription.planId !== 'free';
};

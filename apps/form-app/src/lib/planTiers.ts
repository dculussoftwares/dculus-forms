/**
 * Plan helpers. Plans are defined entirely in Chargebee (ids, prices, limits) and
 * are NOT known at build time, so nothing here may assume particular plan ids other
 * than the two reserved ones: `free` (always the entry tier) and `enterprise`
 * (admin-assigned, never in the public catalog).
 */

export interface PlanFeatureLimits {
  views: number | null;
  submissions: number | null;
  emails: number | null;
  aiCredits: number | null;
}

export interface CatalogPlan {
  id: string;
  name: string;
  description?: string | null;
  prices: { id: string; currency: string; amount: number; period: string }[];
  features: Partial<PlanFeatureLimits>;
}

const lowestPrice = (plan: CatalogPlan): number =>
  plan.prices.length === 0 ? Number.POSITIVE_INFINITY : Math.min(...plan.prices.map((p) => p.amount));

/** Free first, then ascending by lowest price — the tier order everywhere in the UI. */
export const sortPlansByTier = (plans: CatalogPlan[]): CatalogPlan[] =>
  [...plans].sort((a, b) => {
    if (a.id === 'free') return -1;
    if (b.id === 'free') return 1;
    return lowestPrice(a) - lowestPrice(b);
  });

/** The next tier up from `currentPlanId`, or null when already on the top tier / enterprise. */
export const getNextPlanId = (plans: CatalogPlan[], currentPlanId: string): string | null => {
  if (currentPlanId === 'enterprise') return null;
  const ordered = sortPlansByTier(plans);
  const index = ordered.findIndex((p) => p.id === currentPlanId);
  if (index === -1) return ordered.find((p) => p.id !== 'free')?.id ?? null;
  return ordered[index + 1]?.id ?? null;
};

export const getPlanDisplayName = (plans: CatalogPlan[], planId: string): string =>
  plans.find((p) => p.id === planId)?.name ?? planId.charAt(0).toUpperCase() + planId.slice(1);

/** Index of the plan the pricing page should highlight: the middle paid tier. */
export const getRecommendedPlanId = (plans: CatalogPlan[]): string | null => {
  const paid = sortPlansByTier(plans).filter((p) => p.id !== 'free');
  if (paid.length === 0) return null;
  return paid[Math.floor((paid.length - 1) / 2)].id;
};

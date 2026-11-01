import {
  sortPlansByTier,
  getNextPlanId,
  getRecommendedPlanId,
  getPlanDisplayName,
  type CatalogPlan,
} from '../planTiers';

const plan = (id: string, amount: number | null, name = id): CatalogPlan => ({
  id,
  name,
  prices: amount === null ? [] : [{ id: `${id}-usd-monthly`, currency: 'USD', amount, period: 'month' }],
  features: {},
});

// Deliberately shuffled: tier order must come from price, not array order or plan ids.
const plans = [plan('premium', 110), plan('free', 0), plan('standard', 30), plan('starter', 12), plan('professional', 60)];

describe('planTiers', () => {
  it('orders free first, then ascending by price', () => {
    expect(sortPlansByTier(plans).map((p) => p.id)).toEqual(['free', 'starter', 'standard', 'professional', 'premium']);
  });

  it('finds the next tier up, and null at the top tier or for enterprise', () => {
    expect(getNextPlanId(plans, 'free')).toBe('starter');
    expect(getNextPlanId(plans, 'standard')).toBe('professional');
    expect(getNextPlanId(plans, 'premium')).toBeNull();
    expect(getNextPlanId(plans, 'enterprise')).toBeNull();
  });

  it('offers the first paid plan to a plan that is no longer in the catalog (archived/legacy)', () => {
    expect(getNextPlanId(plans, 'advanced')).toBe('starter');
  });

  it('works for catalogs with any plan ids (no hardcoded tier names)', () => {
    const custom = [plan('free', 0), plan('pro-plus', 20), plan('team', 50)];
    expect(getNextPlanId(custom, 'pro-plus')).toBe('team');
  });

  it('recommends the middle paid tier', () => {
    expect(getRecommendedPlanId(plans)).toBe('standard'); // 4 paid -> 2nd
    expect(getRecommendedPlanId([plan('free', 0), plan('a', 5), plan('b', 9)])).toBe('a');
    expect(getRecommendedPlanId([plan('free', 0)])).toBeNull();
  });

  it('falls back to a capitalised id when a plan is not in the catalog', () => {
    expect(getPlanDisplayName(plans, 'standard')).toBe('standard');
    expect(getPlanDisplayName([], 'legacy')).toBe('Legacy');
  });
});

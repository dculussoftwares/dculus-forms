import { useMemo } from 'react';
import { useQuery } from '@apollo/client/react';
import { GET_AVAILABLE_PLANS } from '../graphql/subscription';
import { useTranslation } from './useTranslation';
import {
  getNextPlanId,
  sortPlansByTier,
  type CatalogPlan,
  type PlanFeatureLimits,
} from '../lib/planTiers';

const formatCount = (value: number) => value.toLocaleString('en-US');

/** Public plan catalog (from Chargebee) in tier order, plus upgrade helpers. */
export function usePlanTiers() {
  const { data, loading } = useQuery(GET_AVAILABLE_PLANS);
  const plans = useMemo(
    () => sortPlansByTier((data?.availablePlans ?? []) as CatalogPlan[]),
    [data]
  );
  return {
    plans,
    loading,
    getNextPlanId: (currentPlanId: string) => getNextPlanId(plans, currentPlanId),
    /** False only once the catalog is loaded and `planId` is its top tier (or enterprise). */
    canUpgrade: (planId: string) =>
      planId !== 'enterprise' && (loading || plans.length === 0 || getNextPlanId(plans, planId) !== null),
  };
}

/** Human-readable limit lines ("10,000 submissions / month") from Chargebee entitlements. */
export function usePlanLimitLines() {
  const { t } = useTranslation('planLimits');
  return (features: Partial<PlanFeatureLimits> | undefined | null): string[] => {
    if (!features) return [];
    const line = (key: 'views' | 'submissions' | 'emails' | 'aiCredits'): string | null => {
      const value = features[key];
      if (value === undefined) return null; // meter not defined on this plan
      return value === null
        ? t(`${key}Unlimited`)
        : t(key, { values: { count: formatCount(value) } });
    };
    return (['views', 'submissions', 'emails', 'aiCredits'] as const)
      .map(line)
      .filter((l): l is string => l !== null);
  };
}

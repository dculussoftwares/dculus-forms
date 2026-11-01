/**
 * Plan limits are sourced exclusively from Chargebee entitlements (see
 * chargebeeService.getPlanLimits). There are deliberately NO hardcoded per-plan
 * numbers in code: when Chargebee cannot supply a plan's limits we fail closed
 * with PlanLimitsUnavailableError rather than guessing.
 *
 * `null` means "unlimited" (Chargebee entitlement value "Unlimited").
 */
export interface PlanLimits {
  views: number | null;
  submissions: number | null;
  emails: number | null;
  aiCredits: number | null;
}

export class PlanLimitsUnavailableError extends Error {
  constructor(planId: string, cause?: unknown) {
    super(`Plan limits for "${planId}" are unavailable from Chargebee`);
    this.name = 'PlanLimitsUnavailableError';
    if (cause !== undefined) (this as { cause?: unknown }).cause = cause;
  }
}

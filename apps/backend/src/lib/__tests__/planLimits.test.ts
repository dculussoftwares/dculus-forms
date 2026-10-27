import { describe, it, expect } from 'vitest';
import { canRemoveBranding } from '../planLimits.js';

describe('canRemoveBranding', () => {
  it.each(['starter', 'advanced', 'enterprise'])('is allowed on the active %s plan', (planId) => {
    expect(canRemoveBranding({ planId, status: 'active' })).toBe(true);
  });

  it('is not allowed on the free plan', () => {
    expect(canRemoveBranding({ planId: 'free', status: 'active' })).toBe(false);
  });

  it('is not allowed without a subscription', () => {
    expect(canRemoveBranding(null)).toBe(false);
    expect(canRemoveBranding(undefined)).toBe(false);
  });

  it.each(['cancelled', 'expired'])('is lost once the paid subscription is %s', (status) => {
    expect(canRemoveBranding({ planId: 'advanced', status })).toBe(false);
  });

  it('is kept while a payment is past due', () => {
    expect(canRemoveBranding({ planId: 'starter', status: 'past_due' })).toBe(true);
  });
});

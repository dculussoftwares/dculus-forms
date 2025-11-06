import { vi } from 'vitest';

export const mockChargebeeService = {
  getSubscriptionPlans: vi.fn().mockResolvedValue([
    { id: 'plan-1', name: 'Basic Plan', price: 1000 },
    { id: 'plan-2', name: 'Pro Plan', price: 5000 },
  ]),
  getSubscription: vi.fn().mockResolvedValue({
    id: 'sub-123',
    planId: 'plan-1',
    status: 'active',
  }),
  createSubscription: vi.fn().mockResolvedValue({ id: 'sub-new', status: 'active' }),
  cancelSubscription: vi.fn().mockResolvedValue({ id: 'sub-123', status: 'cancelled' }),
};

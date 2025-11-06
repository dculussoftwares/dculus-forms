import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createChargebeeCustomer,
  createFreeSubscription,
  createCheckoutHostedPage,
  createPortalSession,
  getChargebeeSubscription,
  cancelChargebeeSubscription,
  reactivateChargebeeSubscription,
  syncSubscriptionFromWebhook,
  handleSubscriptionRenewal,
  getAvailablePlans,
} from '../chargebeeService.js';
import Chargebee from 'chargebee';
import { resetUsageCounters } from '../../subscriptions/usageService.js';
import { subscriptionRepository } from '../../repositories/index.js';
import { logger } from '../../lib/logger.js';

// Mock dependencies
vi.mock('chargebee', () => {
  const mockChargebee = {
    customer: {
      create: vi.fn(),
    },
    hostedPage: {
      checkoutNewForItems: vi.fn(),
    },
    portalSession: {
      create: vi.fn(),
    },
    subscription: {
      retrieve: vi.fn(),
      cancel: vi.fn(),
      reactivate: vi.fn(),
    },
    itemPrice: {
      list: vi.fn(),
    },
    entitlement: {
      list: vi.fn(),
    },
    item: {
      retrieve: vi.fn(),
    },
  };
  return {
    default: vi.fn(function() {
      return mockChargebee;
    }),
    __mockChargebee: mockChargebee, // Export for access in tests
  };
});
vi.mock('../../subscriptions/usageService.js');
vi.mock('../../repositories/index.js');

const Chargebee = await import('chargebee') as any;
const mockChargebee = Chargebee.__mockChargebee;

describe('Chargebee Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset all mock functions
    mockChargebee.customer.create.mockReset();
    mockChargebee.hostedPage.checkoutNewForItems.mockReset();
    mockChargebee.portalSession.create.mockReset();
    mockChargebee.subscription.retrieve.mockReset();
    mockChargebee.subscription.cancel.mockReset();
    mockChargebee.subscription.reactivate.mockReset();
    mockChargebee.itemPrice.list.mockReset();
    mockChargebee.entitlement.list.mockReset();
    mockChargebee.item.retrieve.mockReset();

    process.env.CHARGEBEE_SITE = 'test-site';
    process.env.CHARGEBEE_API_KEY = 'test-api-key';
    process.env.FRONTEND_URL = 'https://app.example.com';

    // Clear the module-level cache by reimporting or manipulating time
    // The cache uses Date.now() to check expiration, so we can bust it by using fake timers
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    delete process.env.FRONTEND_URL;
  });

  describe('createChargebeeCustomer', () => {
    it('should create Chargebee customer successfully', async () => {
      mockChargebee.customer.create.mockResolvedValue({
        customer: { id: 'org_123' },
      });

      const result = await createChargebeeCustomer('org-123', 'Acme Corp', 'admin@acme.com');

      expect(mockChargebee.customer.create).toHaveBeenCalledWith({
        id: 'org_org-123',
        email: 'admin@acme.com',
        first_name: 'Acme Corp',
        company: 'Acme Corp',
      });
      expect(result).toBe('org_123');
    });

    it('should handle customer creation errors', async () => {
      const loggerError = vi.spyOn(logger, 'error').mockImplementation(() => {});
      mockChargebee.customer.create.mockRejectedValue(new Error('API error'));

      await expect(
        createChargebeeCustomer('org-123', 'Acme Corp', 'admin@acme.com')
      ).rejects.toThrow('Failed to create Chargebee customer: API error');

      expect(loggerError).toHaveBeenCalled();
      loggerError.mockRestore();
    });
  });

  describe('createFreeSubscription', () => {
    it('should create free subscription successfully', async () => {
      vi.mocked(subscriptionRepository.createSubscription).mockResolvedValue({} as any);

      await createFreeSubscription('org-123', 'cust_123');

      expect(subscriptionRepository.createSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'sub_org-123',
          organizationId: 'org-123',
          chargebeeCustomerId: 'cust_123',
          chargebeeSubscriptionId: null,
          planId: 'free',
          status: 'active',
          viewsUsed: 0,
          submissionsUsed: 0,
          viewsLimit: 10000,
          submissionsLimit: 1000,
        })
      );
    });

    it('should set period end to one month from now', async () => {
      vi.mocked(subscriptionRepository.createSubscription).mockResolvedValue({} as any);

      await createFreeSubscription('org-123', 'cust_123');

      const call = vi.mocked(subscriptionRepository.createSubscription).mock.calls[0][0];
      const periodStart = call.currentPeriodStart;
      const periodEnd = call.currentPeriodEnd;

      const expectedEndDate = new Date(periodStart);
      expectedEndDate.setMonth(expectedEndDate.getMonth() + 1);

      expect(periodEnd.getMonth()).toBe(expectedEndDate.getMonth());
    });

    it('should handle subscription creation errors', async () => {
      const loggerError = vi.spyOn(logger, 'error').mockImplementation(() => {});
      vi.mocked(subscriptionRepository.createSubscription).mockRejectedValue(
        new Error('Database error')
      );

      await expect(createFreeSubscription('org-123', 'cust_123')).rejects.toThrow(
        'Failed to create free subscription: Database error'
      );

      expect(loggerError).toHaveBeenCalled();
      loggerError.mockRestore();
    });
  });

  describe('createCheckoutHostedPage', () => {
    it('should create checkout hosted page with custom URL', async () => {
      mockChargebee.hostedPage.checkoutNewForItems.mockResolvedValue({
        hosted_page: {
          url: 'https://chargebee.com/checkout/abc123',
          id: 'hp_123',
        },
      });

      const result = await createCheckoutHostedPage('cust_123', 'starter-usd-monthly');

      expect(mockChargebee.hostedPage.checkoutNewForItems).toHaveBeenCalledWith({
        subscription_items: [
          {
            item_price_id: 'starter-usd-monthly',
            quantity: 1,
          },
        ],
        customer: {
          id: 'cust_123',
        },
        redirect_url: 'https://app.example.com/subscription/success',
        cancel_url: 'https://app.example.com/subscription/cancel',
      });
      expect(result).toEqual({
        url: 'https://chargebee.com/checkout/abc123',
        id: 'hp_123',
      });
    });

    it('should use default URL when FRONTEND_URL is not set', async () => {
      delete process.env.FRONTEND_URL;
      mockChargebee.hostedPage.checkoutNewForItems.mockResolvedValue({
        hosted_page: {
          url: 'https://chargebee.com/checkout/xyz',
          id: 'hp_456',
        },
      });

      await createCheckoutHostedPage('cust_123', 'advanced-inr-yearly');

      expect(mockChargebee.hostedPage.checkoutNewForItems).toHaveBeenCalledWith(
        expect.objectContaining({
          redirect_url: 'http://localhost:3000/subscription/success',
          cancel_url: 'http://localhost:3000/subscription/cancel',
        })
      );
    });

    it('should handle checkout creation errors', async () => {
      const loggerError = vi.spyOn(logger, 'error').mockImplementation(() => {});
      mockChargebee.hostedPage.checkoutNewForItems.mockRejectedValue(new Error('API error'));

      await expect(
        createCheckoutHostedPage('cust_123', 'starter-usd-monthly')
      ).rejects.toThrow('Failed to create checkout page: API error');

      expect(loggerError).toHaveBeenCalled();
      loggerError.mockRestore();
    });
  });

  describe('createPortalSession', () => {
    it('should create portal session successfully', async () => {
      mockChargebee.portalSession.create.mockResolvedValue({
        portal_session: {
          access_url: 'https://chargebee.com/portal/abc123',
        },
      });

      const result = await createPortalSession('cust_123');

      expect(mockChargebee.portalSession.create).toHaveBeenCalledWith({
        customer: {
          id: 'cust_123',
        },
      });
      expect(result).toBe('https://chargebee.com/portal/abc123');
    });

    it('should handle portal session creation errors', async () => {
      const loggerError = vi.spyOn(logger, 'error').mockImplementation(() => {});
      mockChargebee.portalSession.create.mockRejectedValue(new Error('API error'));

      await expect(createPortalSession('cust_123')).rejects.toThrow(
        'Failed to create portal session: API error'
      );

      expect(loggerError).toHaveBeenCalled();
      loggerError.mockRestore();
    });
  });

  describe('getChargebeeSubscription', () => {
    it('should retrieve subscription successfully', async () => {
      const mockSubscription = {
        id: 'sub_123',
        status: 'active',
        plan_id: 'starter',
      };

      mockChargebee.subscription.retrieve.mockResolvedValue({
        subscription: mockSubscription,
      });

      const result = await getChargebeeSubscription('sub_123');

      expect(mockChargebee.subscription.retrieve).toHaveBeenCalledWith('sub_123');
      expect(result).toEqual(mockSubscription);
    });

    it('should handle subscription retrieval errors', async () => {
      const loggerError = vi.spyOn(logger, 'error').mockImplementation(() => {});
      mockChargebee.subscription.retrieve.mockRejectedValue(new Error('Not found'));

      await expect(getChargebeeSubscription('sub_123')).rejects.toThrow(
        'Failed to retrieve subscription: Not found'
      );

      expect(loggerError).toHaveBeenCalled();
      loggerError.mockRestore();
    });
  });

  describe('cancelChargebeeSubscription', () => {
    it('should cancel subscription at end of term by default', async () => {
      mockChargebee.subscription.cancel.mockResolvedValue({});

      await cancelChargebeeSubscription('sub_123');

      expect(mockChargebee.subscription.cancel).toHaveBeenCalledWith('sub_123', {
        end_of_term: true,
      });
    });

    it('should cancel subscription immediately when specified', async () => {
      mockChargebee.subscription.cancel.mockResolvedValue({});

      await cancelChargebeeSubscription('sub_123', false);

      expect(mockChargebee.subscription.cancel).toHaveBeenCalledWith('sub_123', {
        end_of_term: false,
      });
    });

    it('should handle cancellation errors', async () => {
      const loggerError = vi.spyOn(logger, 'error').mockImplementation(() => {});
      mockChargebee.subscription.cancel.mockRejectedValue(new Error('Cancel failed'));

      await expect(cancelChargebeeSubscription('sub_123')).rejects.toThrow(
        'Failed to cancel subscription: Cancel failed'
      );

      expect(loggerError).toHaveBeenCalled();
      loggerError.mockRestore();
    });
  });

  describe('reactivateChargebeeSubscription', () => {
    it('should reactivate subscription successfully', async () => {
      mockChargebee.subscription.reactivate.mockResolvedValue({});

      await reactivateChargebeeSubscription('sub_123');

      expect(mockChargebee.subscription.reactivate).toHaveBeenCalledWith('sub_123');
    });

    it('should handle reactivation errors', async () => {
      const loggerError = vi.spyOn(logger, 'error').mockImplementation(() => {});
      mockChargebee.subscription.reactivate.mockRejectedValue(new Error('Reactivate failed'));

      await expect(reactivateChargebeeSubscription('sub_123')).rejects.toThrow(
        'Failed to reactivate subscription: Reactivate failed'
      );

      expect(loggerError).toHaveBeenCalled();
      loggerError.mockRestore();
    });
  });

  describe('syncSubscriptionFromWebhook', () => {
    it('should sync subscription with starter plan', async () => {
      const subscriptionData = {
        id: 'sub_123',
        customer_id: 'org_org-123',
        status: 'active',
        subscription_items: [
          {
            item_price_id: 'starter-usd-monthly',
          },
        ],
        current_term_start: 1704067200,
        current_term_end: 1706745600,
      };

      vi.mocked(subscriptionRepository.upsertForOrganization).mockResolvedValue({} as any);

      await syncSubscriptionFromWebhook(subscriptionData);

      expect(subscriptionRepository.upsertForOrganization).toHaveBeenCalledWith(
        'org-123',
        expect.objectContaining({
          planId: 'starter',
          status: 'active',
          viewsLimit: null,
          submissionsLimit: 10000,
        }),
        expect.any(Object)
      );
    });

    it('should sync subscription with advanced plan', async () => {
      const subscriptionData = {
        id: 'sub_456',
        customer_id: 'org_org-456',
        status: 'active',
        subscription_items: [
          {
            item_price_id: 'advanced-inr-yearly',
          },
        ],
        current_term_start: 1704067200,
        current_term_end: 1706745600,
      };

      vi.mocked(subscriptionRepository.upsertForOrganization).mockResolvedValue({} as any);

      await syncSubscriptionFromWebhook(subscriptionData);

      expect(subscriptionRepository.upsertForOrganization).toHaveBeenCalledWith(
        'org-456',
        expect.objectContaining({
          planId: 'advanced',
          viewsLimit: null,
          submissionsLimit: 100000,
        }),
        expect.any(Object)
      );
    });

    it('should map cancelled status correctly', async () => {
      const subscriptionData = {
        id: 'sub_789',
        customer_id: 'org_org-789',
        status: 'cancelled',
        subscription_items: [{ item_price_id: 'starter-usd-monthly' }],
        current_term_start: 1704067200,
        current_term_end: 1706745600,
      };

      vi.mocked(subscriptionRepository.upsertForOrganization).mockResolvedValue({} as any);

      await syncSubscriptionFromWebhook(subscriptionData);

      expect(subscriptionRepository.upsertForOrganization).toHaveBeenCalledWith(
        'org-789',
        expect.objectContaining({
          status: 'cancelled',
        }),
        expect.any(Object)
      );
    });

    it('should map non_renewing status to cancelled', async () => {
      const subscriptionData = {
        id: 'sub_101',
        customer_id: 'org_org-101',
        status: 'non_renewing',
        subscription_items: [{ item_price_id: 'starter-usd-monthly' }],
        current_term_start: 1704067200,
        current_term_end: 1706745600,
      };

      vi.mocked(subscriptionRepository.upsertForOrganization).mockResolvedValue({} as any);

      await syncSubscriptionFromWebhook(subscriptionData);

      expect(subscriptionRepository.upsertForOrganization).toHaveBeenCalledWith(
        'org-101',
        expect.objectContaining({
          status: 'cancelled',
        }),
        expect.any(Object)
      );
    });

    it('should handle sync errors', async () => {
      const loggerError = vi.spyOn(logger, 'error').mockImplementation(() => {});
      vi.mocked(subscriptionRepository.upsertForOrganization).mockRejectedValue(
        new Error('Database error')
      );

      await expect(
        syncSubscriptionFromWebhook({
          id: 'sub_123',
          customer_id: 'org_org-123',
          status: 'active',
          current_term_start: 1704067200,
          current_term_end: 1706745600,
        })
      ).rejects.toThrow('Database error');

      expect(loggerError).toHaveBeenCalled();
      loggerError.mockRestore();
    });
  });

  describe('handleSubscriptionRenewal', () => {
    it('should reset usage counters on renewal', async () => {
      const subscriptionData = {
        customer_id: 'org_org-123',
        current_term_start: 1704067200,
        current_term_end: 1706745600,
      };

      vi.mocked(resetUsageCounters).mockResolvedValue(undefined);

      await handleSubscriptionRenewal(subscriptionData);

      expect(resetUsageCounters).toHaveBeenCalledWith(
        'org-123',
        new Date(1704067200 * 1000),
        new Date(1706745600 * 1000)
      );
    });

    it('should handle renewal errors', async () => {
      const loggerError = vi.spyOn(logger, 'error').mockImplementation(() => {});
      vi.mocked(resetUsageCounters).mockRejectedValue(new Error('Reset failed'));

      await expect(
        handleSubscriptionRenewal({
          customer_id: 'org_org-123',
          current_term_start: 1704067200,
          current_term_end: 1706745600,
        })
      ).rejects.toThrow('Reset failed');

      expect(loggerError).toHaveBeenCalled();
      loggerError.mockRestore();
    });
  });

  describe('getAvailablePlans', () => {
    // Track the base time for each test
    let testStartTime = 0;

    beforeEach(() => {
      // Each test starts 10 minutes after the previous one to ensure cache expiry
      testStartTime += 10 * 60 * 1000;
      vi.setSystemTime(new Date(testStartTime));
    });

    it('should fetch plans from Chargebee API', async () => {

      mockChargebee.itemPrice.list.mockResolvedValue({
        list: [
          {
            item_price: {
              id: 'starter-usd-monthly',
              item_id: 'starter-plan',
              item_type: 'plan',
              price: 600,
              currency_code: 'USD',
              period_unit: 'month',
            },
          },
        ],
        next_offset: undefined,
      });

      mockChargebee.entitlement.list.mockResolvedValue({
        list: [
          {
            entitlement: {
              entity_id: 'starter-usd-monthly',
              feature_id: 'form_views',
              value: 'unlimited',
            },
          },
          {
            entitlement: {
              entity_id: 'starter-usd-monthly',
              feature_id: 'form_submissions',
              value: '10000',
            },
          },
        ],
        next_offset: undefined,
      });

      mockChargebee.item.retrieve.mockResolvedValue({
        item: {
          id: 'starter-plan',
          name: 'Starter Plan',
          external_name: 'starter',
          description: 'For growing teams',
        },
      });

      const result = await getAvailablePlans();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'starter',
        name: 'Starter Plan',
        description: 'For growing teams',
      });
      expect(result[0].prices[0]).toMatchObject({
        amount: 6,
        currency: 'USD',
        period: 'month',
      });
      expect(result[0].features).toMatchObject({
        views: null,
        submissions: 10000,
      });
    });

    it('should handle pagination for item prices', async () => {
      mockChargebee.itemPrice.list
        .mockResolvedValueOnce({
          list: [
            {
              item_price: {
                id: 'plan1-usd-monthly',
                item_id: 'plan1',
                item_type: 'plan',
                price: 1000,
                currency_code: 'USD',
                period_unit: 'month',
              },
            },
          ],
          next_offset: 'offset1',
        })
        .mockResolvedValueOnce({
          list: [
            {
              item_price: {
                id: 'plan2-usd-monthly',
                item_id: 'plan2',
                item_type: 'plan',
                price: 2000,
                currency_code: 'USD',
                period_unit: 'month',
              },
            },
          ],
          next_offset: undefined,
        });

      mockChargebee.entitlement.list.mockResolvedValue({ list: [], next_offset: undefined });
      mockChargebee.item.retrieve
        .mockResolvedValueOnce({
          item: { id: 'plan1', name: 'Plan 1', external_name: 'plan1' },
        })
        .mockResolvedValueOnce({
          item: { id: 'plan2', name: 'Plan 2', external_name: 'plan2' },
        });

      await getAvailablePlans();

      expect(mockChargebee.itemPrice.list).toHaveBeenCalledTimes(2);
    });

    it('should return cached plans within cache duration', async () => {
      // First call - needs all three API methods mocked
      mockChargebee.itemPrice.list.mockResolvedValue({ list: [], next_offset: undefined });
      mockChargebee.entitlement.list.mockResolvedValue({ list: [], next_offset: undefined });
      // No item.retrieve calls needed since list is empty

      // First call - hits API
      await getAvailablePlans();
      expect(mockChargebee.itemPrice.list).toHaveBeenCalledTimes(1);
      expect(mockChargebee.entitlement.list).toHaveBeenCalledTimes(1);

      // Advance time by 1 minute (still within 5 minute cache duration)
      vi.advanceTimersByTime(60 * 1000);

      // Second call - should use cache (no API calls)
      mockChargebee.itemPrice.list.mockClear();
      mockChargebee.entitlement.list.mockClear();
      await getAvailablePlans();
      expect(mockChargebee.itemPrice.list).not.toHaveBeenCalled();
      expect(mockChargebee.entitlement.list).not.toHaveBeenCalled();
    });

    it('should fallback to hardcoded plans on error', async () => {
      const loggerError = vi.spyOn(logger, 'error').mockImplementation(() => {});
      const loggerWarn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
      mockChargebee.itemPrice.list.mockRejectedValue(new Error('API error'));

      const result = await getAvailablePlans();

      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('free');
      expect(result[1].id).toBe('starter');
      expect(result[2].id).toBe('advanced');
      expect(loggerError).toHaveBeenCalled();
      expect(loggerWarn).toHaveBeenCalledWith(
        '[Chargebee Service] Falling back to hardcoded plans'
      );

      loggerError.mockRestore();
      loggerWarn.mockRestore();
    });

    it('should skip non-plan items', async () => {
      mockChargebee.itemPrice.list.mockResolvedValue({
        list: [
          {
            item_price: {
              id: 'addon1',
              item_id: 'addon-item',
              item_type: 'addon',
              price: 500,
              currency_code: 'USD',
              period_unit: 'month',
            },
          },
          {
            item_price: {
              id: 'charge1',
              item_id: 'charge-item',
              item_type: 'charge',
              price: 100,
              currency_code: 'USD',
              period_unit: 'month',
            },
          },
        ],
        next_offset: undefined,
      });

      mockChargebee.entitlement.list.mockResolvedValue({ list: [], next_offset: undefined });
      // item.retrieve should NOT be called since items are filtered out

      const result = await getAvailablePlans();

      expect(result).toEqual([]);
      expect(mockChargebee.item.retrieve).not.toHaveBeenCalled();
    });
  });
});

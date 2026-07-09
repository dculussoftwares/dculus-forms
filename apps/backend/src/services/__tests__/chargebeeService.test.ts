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
  setEnterpriseSubscription,
  invalidatePlansCache,
  getAdminPlanCatalog,
  createPlan,
  updatePlan,
  archivePlan,
  unarchivePlan,
  applyPlanLimitsToOrganizations,
  changeOrganizationPlan,
} from '../chargebeeService.js';
import { resetUsageCounters } from '../../subscriptions/usageService.js';
import { subscriptionRepository } from '../../repositories/index.js';
import { logger } from '../../lib/logger.js';
import { invalidateAIBudgetCache } from '../aiUsageService.js';
import * as Sentry from '@sentry/node';

// Mock dependencies
vi.mock('chargebee', () => {
  const mockChargebee = {
    customer: {
      create: vi.fn(),
      retrieve: vi.fn(),
    },
    hostedPage: {
      checkoutNewForItems: vi.fn(),
      checkoutExistingForItems: vi.fn(),
    },
    portalSession: {
      create: vi.fn(),
    },
    subscription: {
      retrieve: vi.fn(),
      cancel: vi.fn(),
      reactivate: vi.fn(),
      createWithItems: vi.fn(),
      updateForItems: vi.fn(),
    },
    itemPrice: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    entitlement: {
      list: vi.fn(),
      create: vi.fn(),
    },
    item: {
      retrieve: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      list: vi.fn(),
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
vi.mock('../aiUsageService.js', () => ({ invalidateAIBudgetCache: vi.fn() }));
vi.mock('@sentry/node', () => ({ captureException: vi.fn() }));
// The enterprise checkout flow looks up the org owner (to email the payment
// link) via raw prisma and sends via emailService — mock both so tests stay
// hermetic (no DB, no SMTP).
vi.mock('../../lib/prisma.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/prisma.js')>();
  return {
    ...actual,
    prisma: {
      organization: { findUnique: vi.fn().mockResolvedValue(null) },
      subscription: { update: vi.fn() },
    },
  };
});
vi.mock('../emailService.js', () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));

const Chargebee = await import('chargebee') as any;
const mockChargebee = Chargebee.__mockChargebee;

describe('Chargebee Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset all mock functions
    mockChargebee.customer.create.mockReset();
    mockChargebee.customer.retrieve.mockReset();
    mockChargebee.hostedPage.checkoutNewForItems.mockReset();
    mockChargebee.hostedPage.checkoutExistingForItems.mockReset();
    mockChargebee.portalSession.create.mockReset();
    mockChargebee.subscription.retrieve.mockReset();
    mockChargebee.subscription.cancel.mockReset();
    mockChargebee.subscription.reactivate.mockReset();
    mockChargebee.subscription.createWithItems.mockReset();
    mockChargebee.subscription.updateForItems.mockReset();
    mockChargebee.itemPrice.list.mockReset();
    mockChargebee.itemPrice.create.mockReset();
    mockChargebee.itemPrice.update.mockReset();
    mockChargebee.entitlement.list.mockReset();
    mockChargebee.entitlement.create.mockReset();
    mockChargebee.item.retrieve.mockReset();
    mockChargebee.item.create.mockReset();
    mockChargebee.item.update.mockReset();
    mockChargebee.item.list.mockReset();

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
    it('should create a real $0 Chargebee subscription and use its id locally', async () => {
      mockChargebee.subscription.createWithItems.mockResolvedValue({
        subscription: { id: 'chargebee_sub_free_1' },
      });
      vi.mocked(subscriptionRepository.createSubscription).mockResolvedValue({} as any);

      await createFreeSubscription('org-123', 'cust_123');

      expect(mockChargebee.subscription.createWithItems).toHaveBeenCalledWith(
        'cust_123',
        expect.objectContaining({
          subscription_items: [{ item_price_id: 'free-usd-monthly', quantity: 1 }],
          auto_collection: 'off',
        })
      );

      expect(subscriptionRepository.createSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'sub_org-123',
          organizationId: 'org-123',
          chargebeeCustomerId: 'cust_123',
          chargebeeSubscriptionId: 'chargebee_sub_free_1',
          planId: 'free',
          status: 'active',
          viewsUsed: 0,
          submissionsUsed: 0,
          viewsLimit: 10000,
          submissionsLimit: 1000,
          aiCreditsLimit: 200,
        })
      );
    });

    it('should set period end to one month from now when Chargebee does not return term dates', async () => {
      mockChargebee.subscription.createWithItems.mockResolvedValue({
        subscription: { id: 'chargebee_sub_free_2' },
      });
      vi.mocked(subscriptionRepository.createSubscription).mockResolvedValue({} as any);

      await createFreeSubscription('org-123', 'cust_123');

      const call = vi.mocked(subscriptionRepository.createSubscription).mock.calls[0][0];
      const periodStart = call.currentPeriodStart;
      const periodEnd = call.currentPeriodEnd;

      const expectedEndDate = new Date(periodStart);
      expectedEndDate.setMonth(expectedEndDate.getMonth() + 1);

      expect(new Date(periodEnd).getMonth()).toBe(expectedEndDate.getMonth());
    });

    it('should use Chargebee current_term_start/end when present', async () => {
      mockChargebee.subscription.createWithItems.mockResolvedValue({
        subscription: {
          id: 'chargebee_sub_free_3',
          current_term_start: 1704067200,
          current_term_end: 1706745600,
        },
      });
      vi.mocked(subscriptionRepository.createSubscription).mockResolvedValue({} as any);

      await createFreeSubscription('org-123', 'cust_123');

      expect(subscriptionRepository.createSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          chargebeeSubscriptionId: 'chargebee_sub_free_3',
          currentPeriodStart: new Date(1704067200 * 1000),
          currentPeriodEnd: new Date(1706745600 * 1000),
        })
      );
    });

    it('should fail open: keep creating the local record when Chargebee is unreachable', async () => {
      const loggerError = vi.spyOn(logger, 'error').mockImplementation(() => {});
      mockChargebee.subscription.createWithItems.mockRejectedValue(new Error('Chargebee down'));
      vi.mocked(subscriptionRepository.createSubscription).mockResolvedValue({} as any);

      await createFreeSubscription('org-123', 'cust_123');

      expect(vi.mocked(Sentry.captureException)).toHaveBeenCalled();
      expect(subscriptionRepository.createSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          chargebeeSubscriptionId: null,
          planId: 'free',
          aiCreditsLimit: 200,
        })
      );

      loggerError.mockRestore();
    });

    it('should handle subscription creation errors', async () => {
      const loggerError = vi.spyOn(logger, 'error').mockImplementation(() => {});
      mockChargebee.subscription.createWithItems.mockResolvedValue({
        subscription: { id: 'chargebee_sub_free_4' },
      });
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
          aiCreditsLimit: 2000,
        }),
        expect.objectContaining({
          aiCreditsLimit: 2000,
        })
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
          aiCreditsLimit: 20000,
        }),
        expect.objectContaining({
          aiCreditsLimit: 20000,
        })
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

    it('should recognize the enterprise plan and preserve existing limits instead of overwriting from the catalog', async () => {
      vi.mocked(subscriptionRepository.upsertForOrganization).mockResolvedValue({} as any);

      const subscriptionData = {
        id: 'sub_ent_1',
        customer_id: 'org_org-ent',
        status: 'active',
        subscription_items: [{ item_id: 'enterprise', item_price_id: 'enterprise-usd-monthly' }],
        current_term_start: 1704067200,
        current_term_end: 1706745600,
      };

      await syncSubscriptionFromWebhook(subscriptionData);

      const [orgId, updateArg, createArg] = vi.mocked(subscriptionRepository.upsertForOrganization).mock.calls[0];
      expect(orgId).toBe('org-ent');
      expect(updateArg).toMatchObject({ planId: 'enterprise', status: 'active' });
      // The negotiated limits are admin-set — a webhook sync must never overwrite them.
      expect(updateArg).not.toHaveProperty('viewsLimit');
      expect(updateArg).not.toHaveProperty('submissionsLimit');
      expect(updateArg).not.toHaveProperty('aiCreditsLimit');
      // The create branch (no existing row) has no limits to preserve — defaults to unlimited.
      expect(createArg).toMatchObject({ viewsLimit: null, submissionsLimit: null, aiCreditsLimit: null });
    });

    it('should resolve any dynamic item_id as the planId (no hardcoded whitelist)', async () => {
      vi.mocked(subscriptionRepository.upsertForOrganization).mockResolvedValue({} as any);

      await syncSubscriptionFromWebhook({
        id: 'sub_dyn_1',
        customer_id: 'org_org-dyn',
        status: 'active',
        subscription_items: [{ item_id: 'pro-plus', item_price_id: 'pro-plus-usd-monthly' }],
        current_term_start: 1704067200,
        current_term_end: 1706745600,
      });

      expect(subscriptionRepository.upsertForOrganization).toHaveBeenCalledWith(
        'org-dyn',
        expect.objectContaining({ planId: 'pro-plus' }),
        expect.any(Object)
      );
    });

    it('should strip the -{currency}-{period} suffix from item_price_id for multi-word plan ids', async () => {
      vi.mocked(subscriptionRepository.upsertForOrganization).mockResolvedValue({} as any);

      await syncSubscriptionFromWebhook({
        id: 'sub_dyn_2',
        customer_id: 'org_org-dyn-2',
        status: 'active',
        subscription_items: [{ item_price_id: 'pro-plus-inr-yearly' }],
        current_term_start: 1704067200,
        current_term_end: 1706745600,
      });

      expect(subscriptionRepository.upsertForOrganization).toHaveBeenCalledWith(
        'org-dyn-2',
        expect.objectContaining({ planId: 'pro-plus' }),
        expect.any(Object)
      );
    });

    it('should recognize enterprise via item_price_id prefix when item_id is absent', async () => {
      vi.mocked(subscriptionRepository.upsertForOrganization).mockResolvedValue({} as any);

      const subscriptionData = {
        id: 'sub_ent_2',
        customer_id: 'org_org-ent-2',
        status: 'active',
        subscription_items: [{ item_price_id: 'enterprise-inr-yearly' }],
        current_term_start: 1704067200,
        current_term_end: 1706745600,
      };

      await syncSubscriptionFromWebhook(subscriptionData);

      expect(subscriptionRepository.upsertForOrganization).toHaveBeenCalledWith(
        'org-ent-2',
        expect.objectContaining({ planId: 'enterprise' }),
        expect.any(Object)
      );
    });

    it('should skip webhooks from the previous plan while an enterprise checkout is pending', async () => {
      // Pending deal: admin set enterprise, customer has not paid yet.
      vi.mocked(subscriptionRepository.findUnique).mockResolvedValueOnce({
        organizationId: 'org-pending',
        planId: 'enterprise',
        status: 'past_due',
      } as any);
      vi.mocked(subscriptionRepository.upsertForOrganization).mockResolvedValue({} as any);

      // A renewal webhook from the org's OLD free subscription arrives.
      await syncSubscriptionFromWebhook({
        id: 'sub_old_free',
        customer_id: 'org_org-pending',
        status: 'active',
        subscription_items: [{ item_id: 'free', item_price_id: 'free-usd-monthly' }],
        current_term_start: 1704067200,
        current_term_end: 1706745600,
      });

      // It must not re-enable the org or clobber the staged enterprise deal.
      expect(subscriptionRepository.upsertForOrganization).not.toHaveBeenCalled();
    });

    it('should still process the enterprise webhook that completes a pending checkout', async () => {
      // No findUnique stub needed: the pending-deal guard only runs for
      // non-enterprise webhooks, and this one carries the enterprise item.
      vi.mocked(subscriptionRepository.upsertForOrganization).mockResolvedValue({} as any);

      await syncSubscriptionFromWebhook({
        id: 'sub_now_ent',
        customer_id: 'org_org-pending',
        status: 'active',
        subscription_items: [{ item_id: 'enterprise', item_price_id: 'enterprise-usd-monthly' }],
        current_term_start: 1704067200,
        current_term_end: 1706745600,
      });

      const [, updateArg] = vi.mocked(subscriptionRepository.upsertForOrganization).mock.calls[0];
      // Checkout completed: org activates, negotiated limits stay untouched.
      expect(updateArg).toMatchObject({ planId: 'enterprise', status: 'active' });
      expect(updateArg).not.toHaveProperty('viewsLimit');
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

    it('should invalidate the AI budget cache on renewal, so a mid-cycle upgrade limit or new-period reset is not masked by a stale cached result', async () => {
      const subscriptionData = {
        customer_id: 'org_org-123',
        current_term_start: 1704067200,
        current_term_end: 1706745600,
      };

      vi.mocked(resetUsageCounters).mockResolvedValue(undefined);

      await handleSubscriptionRenewal(subscriptionData);

      expect(invalidateAIBudgetCache).toHaveBeenCalledWith('org-123');
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

    it('should treat capital-U "Unlimited" as unlimited (null)', async () => {
      mockChargebee.itemPrice.list.mockResolvedValue({
        list: [
          {
            item_price: {
              id: 'advanced-usd-monthly',
              item_id: 'advanced-plan',
              item_type: 'plan',
              price: 1500,
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
              entity_id: 'advanced-usd-monthly',
              feature_id: 'form_views',
              value: 'Unlimited',
            },
          },
          {
            entitlement: {
              entity_id: 'advanced-usd-monthly',
              feature_id: 'form_submissions',
              value: '100000',
            },
          },
        ],
        next_offset: undefined,
      });

      mockChargebee.item.retrieve.mockResolvedValue({
        item: {
          id: 'advanced-plan',
          name: 'Advanced Plan',
          external_name: 'advanced',
          description: 'For enterprises',
        },
      });

      const result = await getAvailablePlans();

      expect(result[0].features).toMatchObject({
        views: null,
        submissions: 100000,
      });
    });

    it('should map ai_credits entitlement to aiCredits, and default to null when absent', async () => {
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
          {
            item_price: {
              id: 'advanced-usd-monthly',
              item_id: 'advanced-plan',
              item_type: 'plan',
              price: 1500,
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
          {
            entitlement: {
              entity_id: 'starter-usd-monthly',
              feature_id: 'ai_credits',
              value: '2000',
            },
          },
          // advanced-usd-monthly has no ai_credits entitlement at all
          {
            entitlement: {
              entity_id: 'advanced-usd-monthly',
              feature_id: 'form_views',
              value: 'unlimited',
            },
          },
        ],
        next_offset: undefined,
      });

      mockChargebee.item.retrieve.mockImplementation(async (id: string) => {
        if (id === 'starter-plan') {
          return { item: { id: 'starter-plan', name: 'Starter Plan', external_name: 'starter' } };
        }
        return { item: { id: 'advanced-plan', name: 'Advanced Plan', external_name: 'advanced' } };
      });

      const result = await getAvailablePlans();

      const starter = result.find((p: any) => p.id === 'starter');
      const advanced = result.find((p: any) => p.id === 'advanced');

      expect(starter.features).toMatchObject({ aiCredits: 2000 });
      expect(advanced.features).toMatchObject({ aiCredits: null });
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

    it('should exclude the enterprise item so it never reaches the public Pricing page', async () => {
      mockChargebee.itemPrice.list.mockResolvedValue({
        list: [
          {
            item_price: {
              id: 'enterprise-usd-monthly',
              item_id: 'enterprise',
              item_type: 'plan',
              price: 0,
              currency_code: 'USD',
              period_unit: 'month',
            },
          },
        ],
        next_offset: undefined,
      });
      mockChargebee.entitlement.list.mockResolvedValue({ list: [], next_offset: undefined });

      const result = await getAvailablePlans();

      expect(result).toEqual([]);
      expect(mockChargebee.item.retrieve).not.toHaveBeenCalled();
    });

    it('should exclude plans hidden from the pricing page (enabled_for_checkout false) and archived plans', async () => {
      mockChargebee.itemPrice.list.mockResolvedValue({
        list: [
          {
            item_price: {
              id: 'hidden-usd-monthly',
              item_id: 'hidden',
              item_type: 'plan',
              price: 900,
              currency_code: 'USD',
              period_unit: 'month',
              status: 'active',
            },
          },
          {
            item_price: {
              id: 'retired-usd-monthly',
              item_id: 'retired',
              item_type: 'plan',
              price: 500,
              currency_code: 'USD',
              period_unit: 'month',
              status: 'active',
            },
          },
        ],
        next_offset: undefined,
      });
      mockChargebee.entitlement.list.mockResolvedValue({ list: [], next_offset: undefined });
      mockChargebee.item.retrieve.mockImplementation(async (id: string) => {
        if (id === 'hidden') {
          return { item: { id: 'hidden', name: 'Hidden Plan', enabled_for_checkout: false, status: 'active' } };
        }
        return { item: { id: 'retired', name: 'Retired Plan', enabled_for_checkout: true, status: 'archived' } };
      });

      const result = await getAvailablePlans();

      expect(result).toEqual([]);
    });

    it('should skip archived item prices while keeping the plan\'s active prices', async () => {
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
              status: 'active',
            },
          },
          {
            item_price: {
              id: 'starter-inr-monthly',
              item_id: 'starter-plan',
              item_type: 'plan',
              price: 48900,
              currency_code: 'INR',
              period_unit: 'month',
              status: 'archived',
            },
          },
        ],
        next_offset: undefined,
      });
      mockChargebee.entitlement.list.mockResolvedValue({ list: [], next_offset: undefined });
      mockChargebee.item.retrieve.mockResolvedValue({
        item: { id: 'starter-plan', name: 'Starter Plan', external_name: 'starter', enabled_for_checkout: true },
      });

      const result = await getAvailablePlans();

      expect(result).toHaveLength(1);
      expect(result[0].prices).toHaveLength(1);
      expect(result[0].prices[0].id).toBe('starter-usd-monthly');
    });
  });

  describe('setEnterpriseSubscription', () => {
    const baseParams = {
      currency: 'USD' as const,
      period: 'monthly' as const,
      priceInSmallestUnit: 250000,
      viewsLimit: null,
      submissionsLimit: 50000,
      aiCreditsLimit: null,
    };

    it('creates a hosted checkout for a paid deal and disables the org until payment (past_due)', async () => {
      vi.mocked(subscriptionRepository.findUnique).mockResolvedValue({
        organizationId: 'org-ent',
        chargebeeSubscriptionId: 'chargebee_sub_ent',
        currentPeriodStart: new Date('2026-01-01'),
        currentPeriodEnd: new Date('2026-02-01'),
      } as any);
      mockChargebee.hostedPage.checkoutExistingForItems.mockResolvedValue({
        hosted_page: { url: 'https://test-site.chargebee.com/pages/v4/checkout123' },
      });
      vi.mocked(subscriptionRepository.update).mockResolvedValue({} as any);

      const result = await setEnterpriseSubscription('org-ent', baseParams);

      expect(result).toEqual({ checkoutUrl: 'https://test-site.chargebee.com/pages/v4/checkout123' });
      expect(mockChargebee.hostedPage.checkoutExistingForItems).toHaveBeenCalledWith(
        expect.objectContaining({
          // auto_collection 'on' so the card saved at checkout auto-charges renewals
          subscription: { id: 'chargebee_sub_ent', auto_collection: 'on' },
          subscription_items: [
            { item_price_id: 'enterprise-usd-monthly', unit_price: 250000, quantity: 1 },
          ],
          replace_items_list: true,
        })
      );
      // The Chargebee subscription itself must NOT be switched until the customer pays.
      expect(mockChargebee.subscription.updateForItems).not.toHaveBeenCalled();
      // Locally the org is blocked (past_due) with the negotiated limits pre-staged.
      expect(subscriptionRepository.update).toHaveBeenCalledWith({
        where: { organizationId: 'org-ent' },
        data: {
          planId: 'enterprise',
          status: 'past_due',
          viewsLimit: null,
          submissionsLimit: 50000,
          aiCreditsLimit: null,
        },
      });
    });

    it('activates a $0 deal immediately via updateForItems with no checkout', async () => {
      vi.mocked(subscriptionRepository.findUnique).mockResolvedValue({
        organizationId: 'org-ent-0',
        chargebeeSubscriptionId: 'chargebee_sub_ent_0',
        currentPeriodStart: new Date('2026-01-01'),
        currentPeriodEnd: new Date('2026-02-01'),
      } as any);
      mockChargebee.subscription.updateForItems.mockResolvedValue({ subscription: {} });
      vi.mocked(subscriptionRepository.update).mockResolvedValue({} as any);

      const result = await setEnterpriseSubscription('org-ent-0', { ...baseParams, priceInSmallestUnit: 0 });

      expect(result).toEqual({ checkoutUrl: null });
      expect(mockChargebee.hostedPage.checkoutExistingForItems).not.toHaveBeenCalled();
      expect(mockChargebee.subscription.updateForItems).toHaveBeenCalledWith(
        'chargebee_sub_ent_0',
        expect.objectContaining({ auto_collection: 'off' })
      );
      expect(subscriptionRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ planId: 'enterprise', status: 'active' }),
        })
      );
    });

    it('throws and never touches Postgres if the org has no Chargebee subscription', async () => {
      vi.mocked(subscriptionRepository.findUnique).mockResolvedValue({
        organizationId: 'org-no-sub',
        chargebeeSubscriptionId: null,
      } as any);

      await expect(setEnterpriseSubscription('org-no-sub', baseParams)).rejects.toThrow(
        'Organization has no Chargebee subscription to convert to enterprise'
      );

      expect(mockChargebee.hostedPage.checkoutExistingForItems).not.toHaveBeenCalled();
      expect(subscriptionRepository.update).not.toHaveBeenCalled();
    });

    it('does not update Postgres if creating the checkout page fails', async () => {
      const loggerError = vi.spyOn(logger, 'error').mockImplementation(() => {});
      vi.mocked(subscriptionRepository.findUnique).mockResolvedValue({
        organizationId: 'org-ent-fail',
        chargebeeSubscriptionId: 'chargebee_sub_ent_fail',
        currentPeriodStart: new Date('2026-01-01'),
        currentPeriodEnd: new Date('2026-02-01'),
      } as any);
      mockChargebee.hostedPage.checkoutExistingForItems.mockRejectedValue(new Error('Chargebee down'));

      await expect(setEnterpriseSubscription('org-ent-fail', baseParams)).rejects.toThrow(
        'Failed to create enterprise checkout page: Chargebee down'
      );

      expect(subscriptionRepository.update).not.toHaveBeenCalled();
      loggerError.mockRestore();
    });

    it('does not update Postgres if the $0 Chargebee call fails', async () => {
      const loggerError = vi.spyOn(logger, 'error').mockImplementation(() => {});
      vi.mocked(subscriptionRepository.findUnique).mockResolvedValue({
        organizationId: 'org-ent-0-fail',
        chargebeeSubscriptionId: 'chargebee_sub_ent_0_fail',
        currentPeriodStart: new Date('2026-01-01'),
        currentPeriodEnd: new Date('2026-02-01'),
      } as any);
      mockChargebee.subscription.updateForItems.mockRejectedValue(new Error('Chargebee down'));

      await expect(
        setEnterpriseSubscription('org-ent-0-fail', { ...baseParams, priceInSmallestUnit: 0 })
      ).rejects.toThrow('Failed to update Chargebee subscription: Chargebee down');

      expect(subscriptionRepository.update).not.toHaveBeenCalled();
      loggerError.mockRestore();
    });
  });

  // Mocks the full catalog reads used by getAdminPlanCatalog: two catalog plans
  // (free + starter, starter with USD monthly and INR yearly prices) plus the
  // admin-only enterprise item.
  const setupCatalogMocks = () => {
    mockChargebee.item.list.mockResolvedValue({
      list: [
        { item: { id: 'free', name: 'Free Plan', description: '', status: 'active', enabled_for_checkout: true } },
        { item: { id: 'starter', name: 'Starter Plan', description: 'For growing teams', status: 'active', enabled_for_checkout: true } },
        { item: { id: 'enterprise', name: 'Enterprise', description: '', status: 'active', enabled_for_checkout: false } },
      ],
      next_offset: undefined,
    });
    mockChargebee.itemPrice.list.mockResolvedValue({
      list: [
        { item_price: { id: 'free-usd-monthly', item_id: 'free', item_type: 'plan', price: 0, currency_code: 'USD', period_unit: 'month', status: 'active' } },
        { item_price: { id: 'starter-usd-monthly', item_id: 'starter', item_type: 'plan', price: 600, currency_code: 'USD', period_unit: 'month', status: 'active' } },
        { item_price: { id: 'starter-inr-yearly', item_id: 'starter', item_type: 'plan', price: 540000, currency_code: 'INR', period_unit: 'year', status: 'active' } },
      ],
      next_offset: undefined,
    });
    mockChargebee.entitlement.list.mockResolvedValue({
      list: [
        { entitlement: { entity_id: 'starter-usd-monthly', feature_id: 'form_views', value: 'Unlimited' } },
        { entitlement: { entity_id: 'starter-usd-monthly', feature_id: 'form_submissions', value: '10000' } },
        { entitlement: { entity_id: 'starter-usd-monthly', feature_id: 'ai_credits', value: '2000' } },
      ],
      next_offset: undefined,
    });
  };

  describe('getAdminPlanCatalog', () => {
    it('returns every plan including hidden and enterprise, with smallest-unit prices and limits', async () => {
      setupCatalogMocks();

      const catalog = await getAdminPlanCatalog();

      expect(catalog.map((p) => p.id).sort()).toEqual(['enterprise', 'free', 'starter']);

      const starter = catalog.find((p) => p.id === 'starter')!;
      expect(starter).toMatchObject({
        name: 'Starter Plan',
        status: 'active',
        visibleOnPricingPage: true,
        limits: { views: null, submissions: 10000, aiCredits: 2000 },
      });
      expect(starter.prices).toEqual([
        { id: 'starter-usd-monthly', currency: 'USD', period: 'monthly', priceInSmallestUnit: 600, status: 'active' },
        { id: 'starter-inr-yearly', currency: 'INR', period: 'yearly', priceInSmallestUnit: 540000, status: 'active' },
      ]);

      // Enterprise is reported hidden regardless of its Chargebee checkout flag.
      const enterprise = catalog.find((p) => p.id === 'enterprise')!;
      expect(enterprise.visibleOnPricingPage).toBe(false);
    });
  });

  describe('createPlan', () => {
    const validParams = {
      id: 'pro',
      name: 'Pro Plan',
      description: 'A new tier',
      prices: [
        { currency: 'USD' as const, period: 'monthly' as const, priceInSmallestUnit: 900 },
        { currency: 'INR' as const, period: 'yearly' as const, priceInSmallestUnit: 720000 },
      ],
      limits: { views: null, submissions: 25000, aiCredits: 5000 },
    };

    beforeEach(() => {
      process.env.CHARGEBEE_ITEM_FAMILY_ID = 'dculus-forms';
      mockChargebee.item.create.mockResolvedValue({ item: { id: 'pro' } });
      mockChargebee.itemPrice.create.mockResolvedValue({ item_price: {} });
      mockChargebee.entitlement.create.mockResolvedValue({ entitlement: {} });
    });

    afterEach(() => {
      delete process.env.CHARGEBEE_ITEM_FAMILY_ID;
    });

    it('creates the item, one price per combination, and upserts entitlements (hidden by default)', async () => {
      await createPlan(validParams);

      expect(mockChargebee.item.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'pro',
          name: 'Pro Plan',
          type: 'plan',
          item_family_id: 'dculus-forms',
          enabled_for_checkout: false,
        })
      );
      expect(mockChargebee.itemPrice.create).toHaveBeenCalledTimes(2);
      expect(mockChargebee.itemPrice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'pro-usd-monthly',
          item_id: 'pro',
          currency_code: 'USD',
          price: 900,
          pricing_model: 'per_unit',
          period: 1,
          period_unit: 'month',
        })
      );
      expect(mockChargebee.itemPrice.create).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'pro-inr-yearly', period_unit: 'year', price: 720000 })
      );

      const entitlementCall = mockChargebee.entitlement.create.mock.calls[0][0];
      expect(entitlementCall.action).toBe('upsert');
      expect(entitlementCall.entitlements).toContainEqual({
        entity_id: 'pro-usd-monthly',
        entity_type: 'plan_price',
        feature_id: 'form_views',
        value: 'Unlimited',
      });
      expect(entitlementCall.entitlements).toContainEqual({
        entity_id: 'pro-inr-yearly',
        entity_type: 'plan_price',
        feature_id: 'form_submissions',
        value: '25000',
      });
    });

    it('rejects the reserved enterprise plan id and invalid ids without calling Chargebee', async () => {
      await expect(createPlan({ ...validParams, id: 'enterprise' })).rejects.toThrow('reserved');
      await expect(createPlan({ ...validParams, id: 'Bad ID!' })).rejects.toThrow('Plan id must be');
      expect(mockChargebee.item.create).not.toHaveBeenCalled();
    });

    it('repairs a duplicate price by updating its amount instead of failing', async () => {
      mockChargebee.itemPrice.create.mockRejectedValueOnce({
        api_error_code: 'duplicate_entry',
        message: 'Item price already exists',
      });
      mockChargebee.itemPrice.update.mockResolvedValue({ item_price: {} });

      await createPlan(validParams);

      expect(mockChargebee.itemPrice.update).toHaveBeenCalledWith('pro-usd-monthly', { price: 900 });
    });

    it('surfaces a partial-creation error when a price fails after the item was created', async () => {
      const loggerError = vi.spyOn(logger, 'error').mockImplementation(() => {});
      mockChargebee.itemPrice.create.mockRejectedValue(new Error('rate limited'));

      await expect(createPlan(validParams)).rejects.toThrow('partially created');
      loggerError.mockRestore();
    });
  });

  describe('updatePlan', () => {
    beforeEach(() => {
      setupCatalogMocks();
      mockChargebee.item.update.mockResolvedValue({ item: {} });
      mockChargebee.itemPrice.create.mockResolvedValue({ item_price: {} });
      mockChargebee.itemPrice.update.mockResolvedValue({ item_price: {} });
      mockChargebee.entitlement.create.mockResolvedValue({ entitlement: {} });
      vi.mocked(subscriptionRepository.updateManyByPlan).mockResolvedValue({ count: 3 } as any);
    });

    it('updates an existing price sending only the amount (currency/period are Chargebee-locked)', async () => {
      await updatePlan({
        id: 'starter',
        prices: [{ currency: 'USD', period: 'monthly', priceInSmallestUnit: 700 }],
      });

      expect(mockChargebee.itemPrice.update).toHaveBeenCalledWith('starter-usd-monthly', { price: 700 });
      expect(mockChargebee.itemPrice.create).not.toHaveBeenCalled();
    });

    it('creates missing currency/period combinations and attaches the plan\'s current limits to them', async () => {
      await updatePlan({
        id: 'starter',
        prices: [{ currency: 'USD', period: 'yearly', priceInSmallestUnit: 6600 }],
      });

      expect(mockChargebee.itemPrice.create).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'starter-usd-yearly', period_unit: 'year', price: 6600 })
      );
      const entitlementCall = mockChargebee.entitlement.create.mock.calls[0][0];
      expect(entitlementCall.entitlements).toContainEqual(
        expect.objectContaining({ entity_id: 'starter-usd-yearly', feature_id: 'form_submissions', value: '10000' })
      );
    });

    it('upserts entitlements for all active prices and backfills subscribed organizations when limits change', async () => {
      const result = await updatePlan({
        id: 'starter',
        limits: { views: 50000, submissions: null, aiCredits: 4000 },
      });

      const entitlementCall = mockChargebee.entitlement.create.mock.calls[0][0];
      const entitledPriceIds = [...new Set(entitlementCall.entitlements.map((e: any) => e.entity_id))];
      expect(entitledPriceIds.sort()).toEqual(['starter-inr-yearly', 'starter-usd-monthly']);
      expect(entitlementCall.entitlements).toContainEqual(
        expect.objectContaining({ feature_id: 'form_views', value: '50000' })
      );
      expect(entitlementCall.entitlements).toContainEqual(
        expect.objectContaining({ feature_id: 'form_submissions', value: 'Unlimited' })
      );

      expect(subscriptionRepository.updateManyByPlan).toHaveBeenCalledWith('starter', {
        viewsLimit: 50000,
        submissionsLimit: null,
        aiCreditsLimit: 4000,
      });
      expect(result.backfilledOrganizations).toBe(3);
    });

    it('rejects making the enterprise plan visible on the pricing page', async () => {
      await expect(
        updatePlan({ id: 'enterprise', visibleOnPricingPage: true })
      ).rejects.toThrow('never be visible');
      expect(mockChargebee.item.update).not.toHaveBeenCalled();
    });

    it('invalidates the public plans cache so the pricing page reflects changes immediately', async () => {
      // Prime the cache via the public path (uses the same list mocks).
      mockChargebee.item.retrieve.mockResolvedValue({
        item: { id: 'starter', name: 'Starter Plan', external_name: 'starter', enabled_for_checkout: true },
      });
      await getAvailablePlans();
      const callsAfterPrime = mockChargebee.itemPrice.list.mock.calls.length;

      await updatePlan({ id: 'starter', name: 'Starter Plan v2' });

      await getAvailablePlans();
      // The second getAvailablePlans must re-fetch (cache invalidated), not serve the cache.
      expect(mockChargebee.itemPrice.list.mock.calls.length).toBeGreaterThan(callsAfterPrime + 1);
    });
  });

  describe('archivePlan / unarchivePlan', () => {
    beforeEach(() => {
      mockChargebee.item.update.mockResolvedValue({ item: {} });
      mockChargebee.itemPrice.update.mockResolvedValue({ item_price: {} });
      mockChargebee.itemPrice.list.mockResolvedValue({
        list: [
          { item_price: { id: 'pro-usd-monthly', item_id: 'pro', status: 'active' } },
          { item_price: { id: 'pro-inr-yearly', item_id: 'pro', status: 'archived' } },
        ],
        next_offset: undefined,
      });
    });

    it('archives the item (hiding it from checkout) and its active prices only', async () => {
      await archivePlan('pro');

      expect(mockChargebee.item.update).toHaveBeenCalledWith('pro', {
        status: 'archived',
        enabled_for_checkout: false,
      });
      expect(mockChargebee.itemPrice.update).toHaveBeenCalledTimes(1);
      expect(mockChargebee.itemPrice.update).toHaveBeenCalledWith('pro-usd-monthly', { status: 'archived' });
    });

    it('refuses to archive the free and enterprise plans', async () => {
      await expect(archivePlan('free')).rejects.toThrow('cannot be archived');
      await expect(archivePlan('enterprise')).rejects.toThrow('cannot be archived');
      expect(mockChargebee.item.update).not.toHaveBeenCalled();
    });

    it('restores an archived plan and its archived prices', async () => {
      await unarchivePlan('pro');

      expect(mockChargebee.item.update).toHaveBeenCalledWith('pro', { status: 'active' });
      expect(mockChargebee.itemPrice.update).toHaveBeenCalledWith('pro-inr-yearly', { status: 'active' });
    });
  });

  describe('applyPlanLimitsToOrganizations', () => {
    it('bulk-updates all subscription rows on the plan and returns the count', async () => {
      vi.mocked(subscriptionRepository.updateManyByPlan).mockResolvedValue({ count: 5 } as any);

      const count = await applyPlanLimitsToOrganizations('starter', {
        views: null,
        submissions: 20000,
        aiCredits: 3000,
      });

      expect(count).toBe(5);
      expect(subscriptionRepository.updateManyByPlan).toHaveBeenCalledWith('starter', {
        viewsLimit: null,
        submissionsLimit: 20000,
        aiCreditsLimit: 3000,
      });
    });

    it('refuses to run for enterprise (limits are per-org, never catalog-driven)', async () => {
      await expect(
        applyPlanLimitsToOrganizations('enterprise', { views: null, submissions: null, aiCredits: null })
      ).rejects.toThrow('per organization');
      expect(subscriptionRepository.updateManyByPlan).not.toHaveBeenCalled();
    });
  });

  describe('changeOrganizationPlan', () => {
    beforeEach(() => {
      setupCatalogMocks();
      vi.mocked(subscriptionRepository.findUnique).mockResolvedValue({
        organizationId: 'org-1',
        chargebeeCustomerId: 'org_org-1',
        chargebeeSubscriptionId: 'cb_sub_1',
        currentPeriodStart: new Date('2026-01-01'),
        currentPeriodEnd: new Date('2026-02-01'),
      } as any);
      vi.mocked(subscriptionRepository.update).mockResolvedValue({} as any);
      mockChargebee.subscription.retrieve.mockResolvedValue({
        subscription: { subscription_items: [{ item_price_id: 'free-usd-monthly' }] },
      });
      mockChargebee.customer.retrieve.mockResolvedValue({ customer: {} });
      mockChargebee.subscription.updateForItems.mockResolvedValue({
        subscription: { current_term_start: 1704067200, current_term_end: 1706745600 },
      });
    });

    it('switches the Chargebee subscription without a unit_price override and syncs catalog limits to Postgres', async () => {
      await changeOrganizationPlan('org-1', 'starter');

      expect(mockChargebee.subscription.updateForItems).toHaveBeenCalledWith('cb_sub_1', {
        subscription_items: [{ item_price_id: 'starter-usd-monthly', quantity: 1 }],
        replace_items_list: true,
        auto_collection: 'off', // no payment source on file
      });
      expect(subscriptionRepository.update).toHaveBeenCalledWith({
        where: { organizationId: 'org-1' },
        data: expect.objectContaining({
          planId: 'starter',
          status: 'active',
          viewsLimit: null,
          submissionsLimit: 10000,
          aiCreditsLimit: 2000,
        }),
      });
    });

    it('carries over the org\'s current currency and period when the target plan offers it', async () => {
      mockChargebee.subscription.retrieve.mockResolvedValue({
        subscription: { subscription_items: [{ item_price_id: 'advanced-inr-yearly' }] },
      });

      await changeOrganizationPlan('org-1', 'starter');

      expect(mockChargebee.subscription.updateForItems).toHaveBeenCalledWith(
        'cb_sub_1',
        expect.objectContaining({
          subscription_items: [{ item_price_id: 'starter-inr-yearly', quantity: 1 }],
        })
      );
    });

    it('auto-charges when the customer has a payment source on file', async () => {
      mockChargebee.customer.retrieve.mockResolvedValue({
        customer: { primary_payment_source_id: 'pm_1' },
      });

      await changeOrganizationPlan('org-1', 'starter');

      expect(mockChargebee.subscription.updateForItems).toHaveBeenCalledWith(
        'cb_sub_1',
        expect.objectContaining({ auto_collection: 'on' })
      );
    });

    it('turns collection off for a $0 target without checking the payment method', async () => {
      await changeOrganizationPlan('org-1', 'free');

      expect(mockChargebee.customer.retrieve).not.toHaveBeenCalled();
      expect(mockChargebee.subscription.updateForItems).toHaveBeenCalledWith(
        'cb_sub_1',
        expect.objectContaining({ auto_collection: 'off' })
      );
    });

    it('repairs a missing Chargebee subscription by creating one instead of updating', async () => {
      vi.mocked(subscriptionRepository.findUnique).mockResolvedValue({
        organizationId: 'org-1',
        chargebeeCustomerId: 'org_org-1',
        chargebeeSubscriptionId: null,
        currentPeriodStart: new Date('2026-01-01'),
        currentPeriodEnd: new Date('2026-02-01'),
      } as any);
      mockChargebee.subscription.createWithItems.mockResolvedValue({
        subscription: { id: 'cb_sub_new', current_term_start: 1704067200, current_term_end: 1706745600 },
      });

      await changeOrganizationPlan('org-1', 'starter');

      expect(mockChargebee.subscription.createWithItems).toHaveBeenCalledWith(
        'org_org-1',
        expect.objectContaining({
          subscription_items: [{ item_price_id: 'starter-usd-monthly', quantity: 1 }],
        })
      );
      expect(subscriptionRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ chargebeeSubscriptionId: 'cb_sub_new' }),
        })
      );
    });

    it('rejects enterprise and archived/unknown plans', async () => {
      await expect(changeOrganizationPlan('org-1', 'enterprise')).rejects.toThrow('enterprise flow');
      await expect(changeOrganizationPlan('org-1', 'nonexistent')).rejects.toThrow('does not exist');
      expect(mockChargebee.subscription.updateForItems).not.toHaveBeenCalled();
    });

    it('leaves Postgres untouched when the Chargebee call fails', async () => {
      const loggerError = vi.spyOn(logger, 'error').mockImplementation(() => {});
      mockChargebee.subscription.updateForItems.mockRejectedValue(new Error('Chargebee down'));

      await expect(changeOrganizationPlan('org-1', 'starter')).rejects.toThrow(
        'Failed to update Chargebee subscription: Chargebee down'
      );
      expect(subscriptionRepository.update).not.toHaveBeenCalled();
      loggerError.mockRestore();
    });
  });

  describe('invalidatePlansCache', () => {
    it('forces the next getAvailablePlans call to re-fetch from Chargebee', async () => {
      setupCatalogMocks();
      mockChargebee.item.retrieve.mockResolvedValue({
        item: { id: 'starter', name: 'Starter Plan', external_name: 'starter', enabled_for_checkout: true },
      });

      await getAvailablePlans();
      const callsAfterFirst = mockChargebee.itemPrice.list.mock.calls.length;

      // Cached — no new fetch.
      await getAvailablePlans();
      expect(mockChargebee.itemPrice.list.mock.calls.length).toBe(callsAfterFirst);

      invalidatePlansCache();
      await getAvailablePlans();
      expect(mockChargebee.itemPrice.list.mock.calls.length).toBeGreaterThan(callsAfterFirst);
    });
  });
});

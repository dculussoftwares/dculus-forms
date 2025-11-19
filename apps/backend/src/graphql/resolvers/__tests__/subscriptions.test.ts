import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { subscriptionResolvers } from '../subscriptions.js';
import { GraphQLError } from '#graphql-errors';
import { prisma } from '../../../lib/prisma.js';
import * as chargebeeService from '../../../services/chargebeeService.js';
import * as betterAuthMiddleware from '../../../middleware/better-auth-middleware.js';

// Mock all dependencies
vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    subscription: {
      findUnique: vi.fn(),
    },
    organization: {
      findUnique: vi.fn(),
    },
    member: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('../../../services/chargebeeService.js', () => ({
  getAvailablePlans: vi.fn(),
  createCheckoutHostedPage: vi.fn(),
  createPortalSession: vi.fn(),
  createChargebeeCustomer: vi.fn(),
  createFreeSubscription: vi.fn(),
}));

vi.mock('../../../middleware/better-auth-middleware.js', () => ({
  requireAuth: vi.fn(),
  requireOrganizationMembership: vi.fn(),
}));

vi.mock('../../../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('Subscription Resolvers', () => {
  const mockContext = {
    auth: {
      user: {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      },
      session: {
        id: 'session-123',
        activeOrganizationId: 'org-123',
      },
      isAuthenticated: true,
    },
  };

  const mockSubscription = {
    id: 'sub-123',
    organizationId: 'org-123',
    chargebeeCustomerId: 'cust_123',
    chargebeeSubscriptionId: 'cb_sub_123',
    planId: 'free',
    status: 'active',
    viewsUsed: 100,
    viewsLimit: 10000,
    submissionsUsed: 50,
    submissionsLimit: 1000,
    currentPeriodStart: new Date('2024-01-01'),
    currentPeriodEnd: new Date('2024-02-01'),
  };

  const mockOrganization = {
    id: 'org-123',
    name: 'Test Organization',
    slug: 'test-org',
    logo: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockMember = {
    id: 'member-123',
    userId: 'user-123',
    organizationId: 'org-123',
    role: 'owner',
    createdAt: new Date('2024-01-01'),
    user: {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Query: availablePlans', () => {
    it('should return available plans from Chargebee', async () => {
      const mockPlans = [
        {
          id: 'free',
          name: 'Free Plan',
          price: 0,
          currency: 'USD',
          interval: 'month',
          features: ['10,000 views', '1,000 submissions'],
        },
        {
          id: 'starter',
          name: 'Starter Plan',
          price: 29,
          currency: 'USD',
          interval: 'month',
          features: ['Unlimited views', '10,000 submissions'],
        },
      ];

      vi.mocked(chargebeeService.getAvailablePlans).mockResolvedValue(mockPlans);

      const result = await subscriptionResolvers.Query.availablePlans();

      expect(result).toEqual(mockPlans);
      expect(chargebeeService.getAvailablePlans).toHaveBeenCalledTimes(1);
    });

    it('should handle errors from Chargebee service', async () => {
      vi.mocked(chargebeeService.getAvailablePlans).mockRejectedValue(
        new Error('Chargebee API error')
      );

      await expect(subscriptionResolvers.Query.availablePlans()).rejects.toThrow(
        'Chargebee API error'
      );
    });
  });

  describe('Mutation: createCheckoutSession', () => {
    it('should create checkout session successfully', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockResolvedValue(
        mockMember as any
      );
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(mockSubscription as any);
      vi.mocked(chargebeeService.createCheckoutHostedPage).mockResolvedValue({
        url: 'https://chargebee.com/checkout/12345',
        id: 'hosted_page_123',
      });

      const result = await subscriptionResolvers.Mutation.createCheckoutSession(
        {},
        { itemPriceId: 'starter-monthly' },
        mockContext
      );

      expect(result).toEqual({
        url: 'https://chargebee.com/checkout/12345',
        hostedPageId: 'hosted_page_123',
      });
      expect(betterAuthMiddleware.requireAuth).toHaveBeenCalledWith(mockContext.auth);
      expect(betterAuthMiddleware.requireOrganizationMembership).toHaveBeenCalledWith(
        mockContext.auth,
        'org-123'
      );
      expect(prisma.subscription.findUnique).toHaveBeenCalledWith({
        where: { organizationId: 'org-123' },
      });
      expect(chargebeeService.createCheckoutHostedPage).toHaveBeenCalledWith(
        'cust_123',
        'starter-monthly'
      );
    });

    it('should throw error when user is not authenticated', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockImplementation(() => {
        throw new GraphQLError('Authentication required');
      });

      await expect(
        subscriptionResolvers.Mutation.createCheckoutSession(
          {},
          { itemPriceId: 'starter-monthly' },
          mockContext
        )
      ).rejects.toThrow('Authentication required');
    });

    it('should throw error when no active organization', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);

      const contextWithoutOrg = {
        auth: {
          user: mockContext.auth.user,
          session: { id: 'session-123' },
          isAuthenticated: true,
        },
      };

      await expect(
        subscriptionResolvers.Mutation.createCheckoutSession(
          {},
          { itemPriceId: 'starter-monthly' },
          contextWithoutOrg
        )
      ).rejects.toThrow('No active organization');
    });

    it('should throw error when user is not organization member', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockRejectedValue(
        new GraphQLError('Not a member of this organization')
      );

      await expect(
        subscriptionResolvers.Mutation.createCheckoutSession(
          {},
          { itemPriceId: 'starter-monthly' },
          mockContext
        )
      ).rejects.toThrow('Not a member of this organization');
    });

    it('should throw error when subscription not found', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockResolvedValue(
        mockMember as any
      );
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null);

      await expect(
        subscriptionResolvers.Mutation.createCheckoutSession(
          {},
          { itemPriceId: 'starter-monthly' },
          mockContext
        )
      ).rejects.toThrow('No subscription found for organization');
    });

    it('should handle Chargebee service errors gracefully', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockResolvedValue(
        mockMember as any
      );
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(mockSubscription as any);
      vi.mocked(chargebeeService.createCheckoutHostedPage).mockRejectedValue(
        new Error('Payment gateway error')
      );

      await expect(
        subscriptionResolvers.Mutation.createCheckoutSession(
          {},
          { itemPriceId: 'starter-monthly' },
          mockContext
        )
      ).rejects.toThrow('Failed to create checkout session: Payment gateway error');
    });
  });

  describe('Mutation: createPortalSession', () => {
    it('should create portal session successfully', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockResolvedValue(
        mockMember as any
      );
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(mockSubscription as any);
      vi.mocked(chargebeeService.createPortalSession).mockResolvedValue(
        'https://chargebee.com/portal/12345'
      );

      const result = await subscriptionResolvers.Mutation.createPortalSession(
        {},
        {},
        mockContext
      );

      expect(result).toEqual({
        url: 'https://chargebee.com/portal/12345',
      });
      expect(betterAuthMiddleware.requireAuth).toHaveBeenCalledWith(mockContext.auth);
      expect(betterAuthMiddleware.requireOrganizationMembership).toHaveBeenCalledWith(
        mockContext.auth,
        'org-123'
      );
      expect(prisma.subscription.findUnique).toHaveBeenCalledWith({
        where: { organizationId: 'org-123' },
      });
      expect(chargebeeService.createPortalSession).toHaveBeenCalledWith('cust_123');
    });

    it('should throw error when user is not authenticated', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockImplementation(() => {
        throw new GraphQLError('Authentication required');
      });

      await expect(
        subscriptionResolvers.Mutation.createPortalSession({}, {}, mockContext)
      ).rejects.toThrow('Authentication required');
    });

    it('should throw error when no active organization', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);

      const contextWithoutOrg = {
        auth: {
          user: mockContext.auth.user,
          session: { id: 'session-123' },
          isAuthenticated: true,
        },
      };

      await expect(
        subscriptionResolvers.Mutation.createPortalSession({}, {}, contextWithoutOrg)
      ).rejects.toThrow('No active organization');
    });

    it('should throw error when user is not organization member', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockRejectedValue(
        new GraphQLError('Not a member of this organization')
      );

      await expect(
        subscriptionResolvers.Mutation.createPortalSession({}, {}, mockContext)
      ).rejects.toThrow('Not a member of this organization');
    });

    it('should throw error when subscription not found', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockResolvedValue(
        mockMember as any
      );
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null);

      await expect(
        subscriptionResolvers.Mutation.createPortalSession({}, {}, mockContext)
      ).rejects.toThrow('No subscription found for organization');
    });

    it('should handle Chargebee service errors gracefully', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockResolvedValue(
        mockMember as any
      );
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(mockSubscription as any);
      vi.mocked(chargebeeService.createPortalSession).mockRejectedValue(
        new Error('Portal access denied')
      );

      await expect(
        subscriptionResolvers.Mutation.createPortalSession({}, {}, mockContext)
      ).rejects.toThrow('Failed to create portal session: Portal access denied');
    });
  });

  describe('Mutation: initializeOrganizationSubscription', () => {
    it('should initialize subscription successfully', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
      vi.mocked(prisma.subscription.findUnique)
        .mockResolvedValueOnce(null) // First check - no existing subscription
        .mockResolvedValueOnce(mockSubscription as any); // After creation
      vi.mocked(prisma.organization.findUnique).mockResolvedValue(mockOrganization as any);
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockResolvedValue(
        mockMember as any
      );
      vi.mocked(prisma.member.findFirst).mockResolvedValue(mockMember as any);
      vi.mocked(chargebeeService.createChargebeeCustomer).mockResolvedValue('cust_123');
      vi.mocked(chargebeeService.createFreeSubscription).mockResolvedValue(undefined);

      const result = await subscriptionResolvers.Mutation.initializeOrganizationSubscription(
        {},
        { organizationId: 'org-123' },
        mockContext
      );

      expect(result).toEqual({
        success: true,
        subscription: mockSubscription,
        message: 'Free subscription created successfully',
      });
      expect(betterAuthMiddleware.requireAuth).toHaveBeenCalledWith(mockContext.auth);
      expect(prisma.subscription.findUnique).toHaveBeenCalledWith({
        where: { organizationId: 'org-123' },
      });
      expect(prisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: 'org-123' },
      });
      expect(betterAuthMiddleware.requireOrganizationMembership).toHaveBeenCalledWith(
        mockContext.auth,
        'org-123'
      );
      expect(chargebeeService.createChargebeeCustomer).toHaveBeenCalledWith(
        'org-123',
        'Test Organization',
        'test@example.com'
      );
      expect(chargebeeService.createFreeSubscription).toHaveBeenCalledWith('org-123', 'cust_123');
    });

    it('should return existing subscription if already initialized', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(mockSubscription as any);

      const result = await subscriptionResolvers.Mutation.initializeOrganizationSubscription(
        {},
        { organizationId: 'org-123' },
        mockContext
      );

      expect(result).toEqual({
        success: true,
        subscription: mockSubscription,
        message: 'Subscription already exists',
      });
      expect(prisma.organization.findUnique).not.toHaveBeenCalled();
      expect(chargebeeService.createChargebeeCustomer).not.toHaveBeenCalled();
    });

    it('should throw error when user is not authenticated', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockImplementation(() => {
        throw new GraphQLError('Authentication required');
      });

      await expect(
        subscriptionResolvers.Mutation.initializeOrganizationSubscription(
          {},
          { organizationId: 'org-123' },
          mockContext
        )
      ).rejects.toThrow('Authentication required');
    });

    it('should return error when organization not found', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.organization.findUnique).mockResolvedValue(null);

      const result = await subscriptionResolvers.Mutation.initializeOrganizationSubscription(
        {},
        { organizationId: 'org-123' },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.subscription).toBeNull();
      expect(result.message).toBe('Organization not found');
    });

    it('should return error when user is not organization member', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.organization.findUnique).mockResolvedValue(mockOrganization as any);
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockRejectedValue(
        new GraphQLError('Not a member of this organization')
      );

      const result = await subscriptionResolvers.Mutation.initializeOrganizationSubscription(
        {},
        { organizationId: 'org-123' },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.subscription).toBeNull();
      expect(result.message).toBe('Not a member of this organization');
    });

    it('should return error when user is not organization owner', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.organization.findUnique).mockResolvedValue(mockOrganization as any);
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockResolvedValue({
        ...mockMember,
        role: 'member',
      } as any);

      const result = await subscriptionResolvers.Mutation.initializeOrganizationSubscription(
        {},
        { organizationId: 'org-123' },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.subscription).toBeNull();
      expect(result.message).toBe('Only organization owner can initialize subscription');
    });

    it('should return error when organization owner not found', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.organization.findUnique).mockResolvedValue(mockOrganization as any);
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockResolvedValue(
        mockMember as any
      );
      vi.mocked(prisma.member.findFirst).mockResolvedValue(null);

      const result = await subscriptionResolvers.Mutation.initializeOrganizationSubscription(
        {},
        { organizationId: 'org-123' },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.subscription).toBeNull();
      expect(result.message).toBe('Organization owner not found');
    });

    it('should handle Chargebee customer creation errors', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.organization.findUnique).mockResolvedValue(mockOrganization as any);
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockResolvedValue(
        mockMember as any
      );
      vi.mocked(prisma.member.findFirst).mockResolvedValue(mockMember as any);
      vi.mocked(chargebeeService.createChargebeeCustomer).mockRejectedValue(
        new Error('Chargebee API error')
      );

      const result = await subscriptionResolvers.Mutation.initializeOrganizationSubscription(
        {},
        { organizationId: 'org-123' },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.subscription).toBeNull();
      expect(result.message).toBe('Chargebee API error');
    });

    it('should handle subscription creation errors', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.organization.findUnique).mockResolvedValue(mockOrganization as any);
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockResolvedValue(
        mockMember as any
      );
      vi.mocked(prisma.member.findFirst).mockResolvedValue(mockMember as any);
      vi.mocked(chargebeeService.createChargebeeCustomer).mockResolvedValue('cust_123');
      vi.mocked(chargebeeService.createFreeSubscription).mockRejectedValue(
        new Error('Database error')
      );

      const result = await subscriptionResolvers.Mutation.initializeOrganizationSubscription(
        {},
        { organizationId: 'org-123' },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.subscription).toBeNull();
      expect(result.message).toBe('Database error');
    });
  });

  describe('Organization: subscription', () => {
    it('should return subscription for organization', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(mockSubscription as any);

      const result = await subscriptionResolvers.Organization.subscription({
        id: 'org-123',
      });

      expect(result).toEqual(mockSubscription);
      expect(prisma.subscription.findUnique).toHaveBeenCalledWith({
        where: { organizationId: 'org-123' },
      });
    });

    it('should return null when subscription not found', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null);

      const result = await subscriptionResolvers.Organization.subscription({
        id: 'org-123',
      });

      expect(result).toBeNull();
    });
  });

  describe('Subscription: organization', () => {
    it('should return organization for subscription', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue(mockOrganization as any);

      const result = await subscriptionResolvers.Subscription.organization(
        mockSubscription as any
      );

      expect(result).toEqual(mockOrganization);
      expect(prisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: 'org-123' },
      });
    });

    it('should return null when organization not found', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue(null);

      const result = await subscriptionResolvers.Subscription.organization(
        mockSubscription as any
      );

      expect(result).toBeNull();
    });
  });

  describe('Subscription: usage', () => {
    it('should calculate usage with limited views and submissions', () => {
      const subscription = {
        viewsUsed: 1000,
        viewsLimit: 10000,
        submissionsUsed: 100,
        submissionsLimit: 1000,
      };

      const result = subscriptionResolvers.Subscription.usage(subscription as any);

      expect(result).toEqual({
        views: {
          used: 1000,
          limit: 10000,
          unlimited: false,
          percentage: 10,
          exceeded: false,
        },
        submissions: {
          used: 100,
          limit: 1000,
          unlimited: false,
          percentage: 10,
          exceeded: false,
        },
      });
    });

    it('should calculate usage with unlimited views', () => {
      const subscription = {
        viewsUsed: 50000,
        viewsLimit: null,
        submissionsUsed: 500,
        submissionsLimit: 10000,
      };

      const result = subscriptionResolvers.Subscription.usage(subscription as any);

      expect(result).toEqual({
        views: {
          used: 50000,
          limit: null,
          unlimited: true,
          percentage: null,
          exceeded: false,
        },
        submissions: {
          used: 500,
          limit: 10000,
          unlimited: false,
          percentage: 5,
          exceeded: false,
        },
      });
    });

    it('should detect exceeded views limit', () => {
      const subscription = {
        viewsUsed: 11000,
        viewsLimit: 10000,
        submissionsUsed: 500,
        submissionsLimit: 1000,
      };

      const result = subscriptionResolvers.Subscription.usage(subscription as any);

      expect(result.views.exceeded).toBe(true);
      expect(result.views.percentage).toBeCloseTo(110, 5);
      expect(result.submissions.exceeded).toBe(false);
    });

    it('should detect exceeded submissions limit', () => {
      const subscription = {
        viewsUsed: 5000,
        viewsLimit: 10000,
        submissionsUsed: 1500,
        submissionsLimit: 1000,
      };

      const result = subscriptionResolvers.Subscription.usage(subscription as any);

      expect(result.views.exceeded).toBe(false);
      expect(result.submissions.exceeded).toBe(true);
      expect(result.submissions.percentage).toBe(150);
    });

    it('should handle zero usage', () => {
      const subscription = {
        viewsUsed: 0,
        viewsLimit: 10000,
        submissionsUsed: 0,
        submissionsLimit: 1000,
      };

      const result = subscriptionResolvers.Subscription.usage(subscription as any);

      expect(result).toEqual({
        views: {
          used: 0,
          limit: 10000,
          unlimited: false,
          percentage: 0,
          exceeded: false,
        },
        submissions: {
          used: 0,
          limit: 1000,
          unlimited: false,
          percentage: 0,
          exceeded: false,
        },
      });
    });

    it('should handle at-limit usage', () => {
      const subscription = {
        viewsUsed: 10000,
        viewsLimit: 10000,
        submissionsUsed: 1000,
        submissionsLimit: 1000,
      };

      const result = subscriptionResolvers.Subscription.usage(subscription as any);

      expect(result.views.exceeded).toBe(true);
      expect(result.views.percentage).toBe(100);
      expect(result.submissions.exceeded).toBe(true);
      expect(result.submissions.percentage).toBe(100);
    });

    it('should handle unlimited submissions', () => {
      const subscription = {
        viewsUsed: 5000,
        viewsLimit: 10000,
        submissionsUsed: 500000,
        submissionsLimit: null,
      };

      const result = subscriptionResolvers.Subscription.usage(subscription as any);

      expect(result).toEqual({
        views: {
          used: 5000,
          limit: 10000,
          unlimited: false,
          percentage: 50,
          exceeded: false,
        },
        submissions: {
          used: 500000,
          limit: null,
          unlimited: true,
          percentage: null,
          exceeded: false,
        },
      });
    });

    it('should handle both unlimited views and submissions', () => {
      const subscription = {
        viewsUsed: 999999,
        viewsLimit: null,
        submissionsUsed: 999999,
        submissionsLimit: null,
      };

      const result = subscriptionResolvers.Subscription.usage(subscription as any);

      expect(result).toEqual({
        views: {
          used: 999999,
          limit: null,
          unlimited: true,
          percentage: null,
          exceeded: false,
        },
        submissions: {
          used: 999999,
          limit: null,
          unlimited: true,
          percentage: null,
          exceeded: false,
        },
      });
    });

    it('should calculate correct percentage for high usage', () => {
      const subscription = {
        viewsUsed: 9500,
        viewsLimit: 10000,
        submissionsUsed: 950,
        submissionsLimit: 1000,
      };

      const result = subscriptionResolvers.Subscription.usage(subscription as any);

      expect(result.views.percentage).toBe(95);
      expect(result.views.exceeded).toBe(false);
      expect(result.submissions.percentage).toBe(95);
      expect(result.submissions.exceeded).toBe(false);
    });
  });
});

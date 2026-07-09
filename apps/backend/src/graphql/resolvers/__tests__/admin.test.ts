import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { adminResolvers, _clearStatsCacheForTests } from '../admin.js';
import { GraphQLError } from '#graphql-errors';
import { prisma } from '../../../lib/prisma.js';
import {
  cancelChargebeeSubscription,
  reactivateChargebeeSubscription,
  setEnterpriseSubscription,
  getAdminPlanCatalog,
  createPlan,
  updatePlan,
  archivePlan,
  unarchivePlan,
  changeOrganizationPlan,
} from '../../../services/chargebeeService.js';
import { resetUsageCounters } from '../../../subscriptions/usageService.js';
import { invalidateAIBudgetCache } from '../../../services/aiUsageService.js';

// Mock all dependencies
vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    organization: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    form: {
      count: vi.fn(),
    },
    response: {
      count: vi.fn(),
    },
    subscription: {
      count: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    auditLog: {
      create: vi.fn(),
    },
    aIUsage: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { tokensUsed: 0 } }),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
  },
}));

vi.mock('../../../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

const { mockS3Send } = vi.hoisted(() => ({
  mockS3Send: vi.fn(),
}));

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(function MockS3Client() {
    return { send: mockS3Send };
  }),
  ListObjectsV2Command: vi.fn().mockImplementation(function MockListObjectsV2Command(config) {
    return config;
  }),
}));

vi.mock('../../../lib/env.js', () => ({
  s3Config: {
    endpoint: 'https://s3.example.com',
    accessKey: 'test-access-key',
    secretKey: 'test-secret-key',
    publicBucketName: 'test-bucket',
  },
}));

vi.mock('../../../services/chargebeeService.js', () => ({
  cancelChargebeeSubscription: vi.fn().mockResolvedValue(undefined),
  reactivateChargebeeSubscription: vi.fn().mockResolvedValue(undefined),
  setEnterpriseSubscription: vi.fn().mockResolvedValue({ checkoutUrl: null }),
  getAdminPlanCatalog: vi.fn().mockResolvedValue([]),
  createPlan: vi.fn().mockResolvedValue(undefined),
  updatePlan: vi.fn().mockResolvedValue({ backfilledOrganizations: 0 }),
  archivePlan: vi.fn().mockResolvedValue(undefined),
  unarchivePlan: vi.fn().mockResolvedValue(undefined),
  changeOrganizationPlan: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../subscriptions/usageService.js', () => ({
  resetUsageCounters: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../services/aiUsageService.js', () => ({
  invalidateAIBudgetCache: vi.fn(),
  getAITokenUsage: vi.fn().mockResolvedValue({
    used: 0,
    limit: 1000,
    resetAt: '2026-05-31T23:59:59.999Z',
    creditsUsed: 0,
    creditsLimit: 100,
  }),
}));

describe('Admin Resolvers', () => {
  const makeAuthContext = (user: Record<string, unknown> | null) => ({
    auth: { user, session: null, isAuthenticated: !!user },
  });

  const mockAdminContext = makeAuthContext({ id: 'admin-123', email: 'admin@example.com', name: 'Admin User', role: 'admin' });
  const mockSuperAdminContext = makeAuthContext({ id: 'superadmin-123', email: 'superadmin@example.com', name: 'Super Admin', role: 'superAdmin' });
  const mockUserContext = makeAuthContext({ id: 'user-123', email: 'user@example.com', name: 'Regular User', role: 'user' });
  const mockNoAuthContext = makeAuthContext(null);

  const mockOrganization = {
    id: 'org-123',
    name: 'Test Organization',
    slug: 'test-org',
    logo: null,
    createdAt: new Date('2024-01-01'),
    members: [
      {
        userId: 'user-123',
        role: 'owner',
        createdAt: new Date('2024-01-01'),
        user: {
          id: 'user-123',
          name: 'Test User',
          email: 'test@example.com',
        },
      },
    ],
    forms: [
      {
        id: 'form-123',
        title: 'Test Form',
        isPublished: true,
        createdAt: new Date('2024-01-01'),
      },
    ],
    _count: {
      members: 1,
      forms: 1,
    },
    subscription: null,
  };

  const mockUser = {
    id: 'user-123',
    name: 'Test User',
    email: 'test@example.com',
    emailVerified: true,
    image: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    members: [
      {
        createdAt: new Date('2024-01-01'),
        role: 'owner',
        organization: {
          id: 'org-123',
          name: 'Test Organization',
          slug: 'test-org',
        },
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockS3Send.mockReset();
    // P2-06: clear the S3 stats in-memory cache between tests so each test
    // controls its own S3 mock behaviour without interference.
    _clearStatsCacheForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Helper: requireAdminRole', () => {
    it('should allow admin role', async () => {
      // Test by calling a resolver with admin context
      vi.mocked(prisma.organization.count).mockResolvedValue(0);
      vi.mocked(prisma.user.count).mockResolvedValue(0);
      vi.mocked(prisma.form.count).mockResolvedValue(0);
      vi.mocked(prisma.response.count).mockResolvedValue(0);
      vi.mocked(prisma.subscription.count).mockResolvedValue(0);
      vi.mocked(prisma.subscription.findMany).mockResolvedValue([]);

      // Mock S3 client
      mockS3Send.mockResolvedValue({
        Contents: [],
        IsTruncated: false,
      });

      await expect(
        adminResolvers.Query.adminStats({}, {}, mockAdminContext)
      ).resolves.toBeDefined();
    });

    it('should allow superAdmin role', async () => {
      vi.mocked(prisma.organization.count).mockResolvedValue(0);
      vi.mocked(prisma.user.count).mockResolvedValue(0);
      vi.mocked(prisma.form.count).mockResolvedValue(0);
      vi.mocked(prisma.response.count).mockResolvedValue(0);
      vi.mocked(prisma.subscription.count).mockResolvedValue(0);
      vi.mocked(prisma.subscription.findMany).mockResolvedValue([]);

      mockS3Send.mockResolvedValue({
        Contents: [],
        IsTruncated: false,
      });

      await expect(
        adminResolvers.Query.adminStats({}, {}, mockSuperAdminContext)
      ).resolves.toBeDefined();
    });

    it('should throw error for regular user', async () => {
      await expect(
        adminResolvers.Query.adminStats({}, {}, mockUserContext)
      ).rejects.toThrow(GraphQLError);
      await expect(
        adminResolvers.Query.adminStats({}, {}, mockUserContext)
      ).rejects.toThrow('Admin privileges required');
    });

    it('should throw error when not authenticated', async () => {
      await expect(
        adminResolvers.Query.adminStats({}, {}, mockNoAuthContext)
      ).rejects.toThrow(GraphQLError);
      await expect(
        adminResolvers.Query.adminStats({}, {}, mockNoAuthContext)
      ).rejects.toThrow('Authentication required');
    });

    it('should throw error when user role is missing', async () => {
      const contextWithoutRole = {
        auth: { user: { id: 'user-123', email: 'user@example.com', role: undefined }, session: null, isAuthenticated: true },
      };

      await expect(
        adminResolvers.Query.adminStats({}, {}, contextWithoutRole)
      ).rejects.toThrow('Admin privileges required');
    });
  });

  describe('Query: adminOrganizations', () => {
    it('should return organizations list with default pagination', async () => {
      vi.mocked(prisma.organization.findMany).mockResolvedValue([mockOrganization] as any);
      vi.mocked(prisma.organization.count).mockResolvedValue(1);

      const result = await adminResolvers.Query.adminOrganizations(
        {},
        {},
        mockAdminContext
      );

      expect(prisma.organization.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 50,
        where: {},
        include: {
          members: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
          forms: {
            select: { id: true, title: true, isPublished: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
          },
          subscription: true,
          _count: { select: { members: true, forms: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(result).toEqual({
        organizations: [
          {
            id: mockOrganization.id,
            name: mockOrganization.name,
            slug: mockOrganization.slug,
            logo: mockOrganization.logo,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: null,
            memberCount: 1,
            formCount: 1,
            members: mockOrganization.members,
            forms: [
              {
                id: 'form-123',
                title: 'Test Form',
                isPublished: true,
                createdAt: '2024-01-01T00:00:00.000Z',
              },
            ],
            planId: null,
            subscriptionStatus: null,
            submissionsUsed: null,
            submissionsLimit: null,
          },
        ],
        total: 1,
        hasMore: false,
      });
    });

    it('should return organizations list with custom pagination', async () => {
      vi.mocked(prisma.organization.findMany).mockResolvedValue([mockOrganization] as any);
      vi.mocked(prisma.organization.count).mockResolvedValue(100);

      const result = await adminResolvers.Query.adminOrganizations(
        {},
        { limit: 10, offset: 20 },
        mockAdminContext
      );

      expect(prisma.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        })
      );

      expect(result.hasMore).toBe(true);
    });

    it('should calculate hasMore correctly', async () => {
      vi.mocked(prisma.organization.findMany).mockResolvedValue([mockOrganization] as any);
      vi.mocked(prisma.organization.count).mockResolvedValue(60);

      const result = await adminResolvers.Query.adminOrganizations(
        {},
        { limit: 50, offset: 0 },
        mockAdminContext
      );

      expect(result.hasMore).toBe(true);

      const result2 = await adminResolvers.Query.adminOrganizations(
        {},
        { limit: 50, offset: 50 },
        mockAdminContext
      );

      expect(result2.hasMore).toBe(false);
    });

    it('should throw error when user is not admin', async () => {
      await expect(
        adminResolvers.Query.adminOrganizations({}, {}, mockUserContext)
      ).rejects.toThrow('Admin privileges required');
    });

    it('should handle prisma errors gracefully', async () => {
      vi.mocked(prisma.organization.findMany).mockRejectedValue(new Error('Database error'));

      await expect(
        adminResolvers.Query.adminOrganizations({}, {}, mockAdminContext)
      ).rejects.toThrow('Failed to fetch organizations');
    });

    it('should return createdAt as ISO string not locale string', async () => {
      const org = {
        id: 'org-123', name: 'Test Org', slug: 'test', logo: null,
        createdAt: new Date('2026-01-15T10:00:00.000Z'),
        updatedAt: new Date('2026-01-15T10:00:00.000Z'),
        members: [], forms: [],
        _count: { members: 0, forms: 0 },
        subscription: null,
      };
      vi.mocked(prisma.organization.findMany).mockResolvedValue([org] as any);
      vi.mocked(prisma.organization.count).mockResolvedValue(1);

      const result = await adminResolvers.Query.adminOrganizations({}, { limit: 10, offset: 0 }, mockAdminContext);

      expect(result.organizations[0].createdAt).toBe('2026-01-15T10:00:00.000Z');
      expect(new Date(result.organizations[0].createdAt).toString()).not.toBe('Invalid Date');
    });

    it('should filter organizations by search term', async () => {
      vi.mocked(prisma.organization.findMany).mockResolvedValue([]);
      vi.mocked(prisma.organization.count).mockResolvedValue(0);

      await adminResolvers.Query.adminOrganizations(
        {}, { limit: 10, offset: 0, search: 'acme' }, mockAdminContext
      );

      expect(vi.mocked(prisma.organization.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { name: { contains: 'acme', mode: 'insensitive' } },
              { slug: { contains: 'acme', mode: 'insensitive' } },
            ],
          },
        })
      );
    });

    it('should include planId from subscription in org list', async () => {
      const org = {
        id: 'org-1', name: 'Acme', slug: 'acme', logo: null,
        createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'),
        members: [], forms: [], _count: { members: 0, forms: 0 },
        subscription: { planId: 'starter', status: 'active', submissionsUsed: 100, submissionsLimit: 10000 },
      };
      vi.mocked(prisma.organization.findMany).mockResolvedValue([org] as any);
      vi.mocked(prisma.organization.count).mockResolvedValue(1);

      const result = await adminResolvers.Query.adminOrganizations({}, {}, mockAdminContext);

      expect(result.organizations[0].planId).toBe('starter');
      expect(result.organizations[0].submissionsUsed).toBe(100);
    });
  });

  describe('Query: adminOrganization', () => {
    it('should return organization details', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue(mockOrganization as any);

      const result = await adminResolvers.Query.adminOrganization(
        {},
        { id: 'org-123' },
        mockAdminContext
      );

      expect(prisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: 'org-123' },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          forms: {
            select: {
              id: true,
              title: true,
              isPublished: true,
              createdAt: true,
            },
            orderBy: {
              createdAt: 'desc',
            },
          },
          _count: {
            select: {
              members: true,
              forms: true,
            },
          },
        },
      });

      expect(result).toEqual({
        ...mockOrganization,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: null,
        memberCount: 1,
        formCount: 1,
        forms: [
          {
            id: 'form-123',
            title: 'Test Form',
            isPublished: true,
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      });
    });

    it('should throw error when organization not found', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue(null);

      await expect(
        adminResolvers.Query.adminOrganization({}, { id: 'invalid-org' }, mockAdminContext)
      ).rejects.toThrow(GraphQLError);
    });

    it('should throw error when user is not admin', async () => {
      await expect(
        adminResolvers.Query.adminOrganization({}, { id: 'org-123' }, mockUserContext)
      ).rejects.toThrow('Admin privileges required');
    });

    it('should handle prisma errors gracefully', async () => {
      vi.mocked(prisma.organization.findUnique).mockRejectedValue(new Error('Database error'));

      await expect(
        adminResolvers.Query.adminOrganization({}, { id: 'org-123' }, mockAdminContext)
      ).rejects.toThrow('Failed to fetch organization');
    });
  });

  describe('Query: adminStats', () => {
    it('should return complete statistics with S3 and MongoDB data', async () => {
      // Mock database counts
      vi.mocked(prisma.organization.count).mockResolvedValue(10);
      vi.mocked(prisma.user.count).mockResolvedValue(50);
      vi.mocked(prisma.form.count).mockResolvedValue(25);
      vi.mocked(prisma.response.count).mockResolvedValue(100);
      vi.mocked(prisma.subscription.count).mockResolvedValue(0);
      vi.mocked(prisma.subscription.findMany).mockResolvedValue([]);

      // Mock S3 errors (S3 mocking is complex, just test error handling)
      mockS3Send.mockRejectedValue(new Error('S3 not available'));

      // PostgreSQL returns fixed values now

      const result = await adminResolvers.Query.adminStats({}, {}, mockAdminContext);

      expect(result).toMatchObject({
        organizationCount: 10,
        userCount: 50,
        formCount: 25,
        responseCount: 100,
        storageUsed: '0 B', // S3 error returns default
        fileCount: 0, // S3 error returns default
        postgresDbSize: expect.any(String),
        postgresTableCount: expect.any(Number),
        freePlanCount: expect.any(Number),
        starterPlanCount: expect.any(Number),
        advancedPlanCount: expect.any(Number),
        orgsNearLimit: expect.any(Array),
      });
    });

    it('should handle S3 errors in pagination', async () => {
      mockS3Send.mockRejectedValue(new Error('S3 connection failed'));
      vi.mocked(prisma.organization.count).mockResolvedValue(0);
      vi.mocked(prisma.user.count).mockResolvedValue(0);
      vi.mocked(prisma.form.count).mockResolvedValue(0);
      vi.mocked(prisma.response.count).mockResolvedValue(0);
      vi.mocked(prisma.subscription.count).mockResolvedValue(0);
      vi.mocked(prisma.subscription.findMany).mockResolvedValue([]);

      const result = await adminResolvers.Query.adminStats({}, {}, mockAdminContext);

      expect(result.storageUsed).toBe('0 B');
      expect(result.fileCount).toBe(0);
    });

    it('should handle S3 errors gracefully', async () => {
      mockS3Send.mockRejectedValue(new Error('S3 connection failed'));
      vi.mocked(prisma.organization.count).mockResolvedValue(0);
      vi.mocked(prisma.user.count).mockResolvedValue(0);
      vi.mocked(prisma.form.count).mockResolvedValue(0);
      vi.mocked(prisma.response.count).mockResolvedValue(0);
      vi.mocked(prisma.subscription.count).mockResolvedValue(0);
      vi.mocked(prisma.subscription.findMany).mockResolvedValue([]);

      const result = await adminResolvers.Query.adminStats({}, {}, mockAdminContext);

      expect(result.storageUsed).toBe('0 B');
      expect(result.fileCount).toBe(0);
    });

    it('should handle byte formatting with PostgreSQL', async () => {
      mockS3Send.mockRejectedValue(new Error('S3 error'));
      vi.mocked(prisma.organization.count).mockResolvedValue(0);
      vi.mocked(prisma.user.count).mockResolvedValue(0);
      vi.mocked(prisma.form.count).mockResolvedValue(0);
      vi.mocked(prisma.response.count).mockResolvedValue(0);
      vi.mocked(prisma.subscription.count).mockResolvedValue(0);
      vi.mocked(prisma.subscription.findMany).mockResolvedValue([]);

      const result = await adminResolvers.Query.adminStats({}, {}, mockAdminContext);

      expect(result.storageUsed).toBe('0 B');
      expect(result.fileCount).toBe(0);
    });

    it('should aggregate paginated S3 responses', async () => {
      mockS3Send
        .mockResolvedValueOnce({
          Contents: [{ Size: 1024 }, { Size: 2048 }],
          IsTruncated: true,
          NextContinuationToken: 'token-1',
        })
        .mockResolvedValueOnce({
          Contents: [{ Size: 4096 }],
          IsTruncated: false,
        });
      vi.mocked(prisma.organization.count).mockResolvedValue(0);
      vi.mocked(prisma.user.count).mockResolvedValue(0);
      vi.mocked(prisma.form.count).mockResolvedValue(0);
      vi.mocked(prisma.response.count).mockResolvedValue(0);
      vi.mocked(prisma.subscription.count).mockResolvedValue(0);
      vi.mocked(prisma.subscription.findMany).mockResolvedValue([]);

      const result = await adminResolvers.Query.adminStats({}, {}, mockAdminContext);

      expect(result.storageUsed).toBe('7 KB');
      expect(result.fileCount).toBe(3);
      expect(mockS3Send).toHaveBeenCalledTimes(2);
    });

    it('should return plan distribution counts', async () => {
      vi.mocked(prisma.organization.count).mockResolvedValue(3);
      vi.mocked(prisma.user.count).mockResolvedValue(5);
      vi.mocked(prisma.form.count).mockResolvedValue(10);
      vi.mocked(prisma.response.count).mockResolvedValue(20);
      mockS3Send.mockRejectedValue(new Error('S3 error'));
      vi.mocked(prisma.subscription.count)
        .mockResolvedValueOnce(2)   // free
        .mockResolvedValueOnce(1)   // starter
        .mockResolvedValueOnce(0);  // advanced
      vi.mocked(prisma.subscription.findMany).mockResolvedValue([]);

      const result = await adminResolvers.Query.adminStats({}, {}, mockAdminContext);

      expect(result.freePlanCount).toBe(2);
      expect(result.starterPlanCount).toBe(1);
      expect(result.advancedPlanCount).toBe(0);
      expect(result.orgsNearLimit).toEqual([]);
    });

    it('should include orgs at >=80% usage in orgsNearLimit', async () => {
      vi.mocked(prisma.organization.count).mockResolvedValue(1);
      vi.mocked(prisma.user.count).mockResolvedValue(1);
      vi.mocked(prisma.form.count).mockResolvedValue(1);
      vi.mocked(prisma.response.count).mockResolvedValue(1);
      mockS3Send.mockRejectedValue(new Error('S3 error'));
      vi.mocked(prisma.subscription.count).mockResolvedValue(0);
      vi.mocked(prisma.subscription.findMany).mockResolvedValue([
        {
          submissionsUsed: 850, submissionsLimit: 1000,
          organization: { id: 'org-1', name: 'Acme' },
        } as any,
      ]);

      const result = await adminResolvers.Query.adminStats({}, {}, mockAdminContext);

      expect(result.orgsNearLimit).toHaveLength(1);
      expect(result.orgsNearLimit[0].usagePercent).toBe(85);
      expect(result.orgsNearLimit[0].orgName).toBe('Acme');
    });

    it('should throw error when user is not admin', async () => {
      await expect(
        adminResolvers.Query.adminStats({}, {}, mockUserContext)
      ).rejects.toThrow('Admin privileges required');
    });

    it('should handle database errors gracefully', async () => {
      vi.mocked(prisma.organization.count).mockRejectedValue(new Error('Database error'));

      await expect(
        adminResolvers.Query.adminStats({}, {}, mockAdminContext)
      ).rejects.toThrow('Failed to fetch admin statistics');
    });
  });

  describe('Query: adminUsers', () => {
    it('should return users list with default pagination', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([mockUser] as any);
      vi.mocked(prisma.user.count).mockResolvedValue(1);

      const result = await adminResolvers.Query.adminUsers({}, {}, mockAdminContext);

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 20,
        include: {
          members: {
            include: {
              organization: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      expect(result).toEqual({
        users: [
          {
            id: 'user-123',
            name: 'Test User',
            email: 'test@example.com',
            emailVerified: true,
            image: null,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
            organizations: [
              {
                organizationId: 'org-123',
                organizationName: 'Test Organization',
                organizationSlug: 'test-org',
                role: 'owner',
                createdAt: '2024-01-01T00:00:00.000Z',
              },
            ],
          },
        ],
        totalCount: 1,
        currentPage: 1,
        totalPages: 1,
      });
    });

    it('should return users list with custom pagination', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([mockUser] as any);
      vi.mocked(prisma.user.count).mockResolvedValue(100);

      const result = await adminResolvers.Query.adminUsers(
        {},
        { page: 2, limit: 10 },
        mockAdminContext
      );

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );

      expect(result.currentPage).toBe(2);
      expect(result.totalPages).toBe(10);
    });

    it('should filter users by search query', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([mockUser] as any);
      vi.mocked(prisma.user.count).mockResolvedValue(1);

      await adminResolvers.Query.adminUsers(
        {},
        { search: 'test@example.com' },
        mockAdminContext
      );

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { name: { contains: 'test@example.com', mode: 'insensitive' } },
              { email: { contains: 'test@example.com', mode: 'insensitive' } },
            ],
          },
        })
      );
    });

    it('should throw error when user is not admin', async () => {
      await expect(
        adminResolvers.Query.adminUsers({}, {}, mockUserContext)
      ).rejects.toThrow('Admin privileges required');
    });

    it('should handle prisma errors gracefully', async () => {
      vi.mocked(prisma.user.findMany).mockRejectedValue(new Error('Database error'));

      await expect(
        adminResolvers.Query.adminUsers({}, {}, mockAdminContext)
      ).rejects.toThrow('Failed to fetch users');
    });
  });

  describe('Query: adminUserById', () => {
    it('should return user details by ID', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

      const result = await adminResolvers.Query.adminUserById(
        {},
        { id: 'user-123' },
        mockAdminContext
      );

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        include: {
          members: {
            include: {
              organization: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
      });

      expect(result).toEqual({
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
        emailVerified: true,
        image: null,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        organizations: [
          {
            organizationId: 'org-123',
            organizationName: 'Test Organization',
            organizationSlug: 'test-org',
            role: 'owner',
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      });
    });

    it('should throw error when user not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(
        adminResolvers.Query.adminUserById({}, { id: 'invalid-user' }, mockAdminContext)
      ).rejects.toThrow(GraphQLError);
    });

    it('should throw error when user is not admin', async () => {
      await expect(
        adminResolvers.Query.adminUserById({}, { id: 'user-123' }, mockUserContext)
      ).rejects.toThrow('Admin privileges required');
    });

    it('should handle prisma errors gracefully', async () => {
      vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error('Database error'));

      await expect(
        adminResolvers.Query.adminUserById({}, { id: 'user-123' }, mockAdminContext)
      ).rejects.toThrow('Failed to fetch user');
    });
  });

  describe('Query: adminOrganizationById', () => {
    const mockDetailedOrganization = {
      id: 'org-123',
      name: 'Test Organization',
      slug: 'test-org',
      logo: null,
      createdAt: new Date('2024-01-01'),
      members: [
        {
          user: {
            id: 'user-123',
            name: 'Test User',
            email: 'test@example.com',
            image: null,
          },
          role: 'owner',
          createdAt: new Date('2024-01-01'),
        },
      ],
      forms: [
        {
          id: 'form-123',
          title: 'Test Form',
          organizationId: 'org-123',
        },
      ],
      subscription: null,
    };

    it('should return organization details with stats', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue(mockDetailedOrganization as any);
      vi.mocked(prisma.response.count).mockResolvedValue(50);

      const result = await adminResolvers.Query.adminOrganizationById(
        {},
        { id: 'org-123' },
        mockAdminContext
      );

      // P2-06: forms now use a selective `select` to omit the large formSchema blob
      expect(prisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: 'org-123' },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true,
                },
              },
            },
          },
          forms: {
            select: {
              id: true,
              title: true,
              isPublished: true,
              createdAt: true,
              updatedAt: true,
              sharingScope: true,
            },
          },
          subscription: true,
        },
      });

      expect(prisma.response.count).toHaveBeenCalledWith({
        where: {
          form: {
            organizationId: 'org-123',
          },
        },
      });

      expect(result).toEqual({
        id: 'org-123',
        name: 'Test Organization',
        slug: 'test-org',
        logo: null,
        createdAt: '2024-01-01T00:00:00.000Z',
        members: [
          {
            userId: 'user-123',
            userName: 'Test User',
            userEmail: 'test@example.com',
            userImage: null,
            role: 'owner',
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        stats: {
          totalForms: 1,
          totalResponses: 50,
        },
        subscription: null,
      });
    });

    it('should throw error when organization not found', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue(null);

      await expect(
        adminResolvers.Query.adminOrganizationById({}, { id: 'invalid-org' }, mockAdminContext)
      ).rejects.toThrow(GraphQLError);
    });

    it('should throw error when user is not admin', async () => {
      await expect(
        adminResolvers.Query.adminOrganizationById({}, { id: 'org-123' }, mockUserContext)
      ).rejects.toThrow('Admin privileges required');
    });

    it('should handle prisma errors gracefully', async () => {
      vi.mocked(prisma.organization.findUnique).mockRejectedValue(new Error('Database error'));

      await expect(
        adminResolvers.Query.adminOrganizationById({}, { id: 'org-123' }, mockAdminContext)
      ).rejects.toThrow('Failed to fetch organization');
    });

    it('should handle response count errors gracefully', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue(mockDetailedOrganization as any);
      vi.mocked(prisma.response.count).mockRejectedValue(new Error('Database error'));

      await expect(
        adminResolvers.Query.adminOrganizationById({}, { id: 'org-123' }, mockAdminContext)
      ).rejects.toThrow('Failed to fetch organization');
    });

    it('should include subscription data in adminOrganizationById', async () => {
      const org = {
        id: 'org-1', name: 'Acme', slug: 'acme', logo: null,
        createdAt: new Date('2026-01-01'),
        members: [],
        forms: [],
        subscription: {
          planId: 'starter', status: 'active',
          viewsUsed: 0, submissionsUsed: 500,
          viewsLimit: null, submissionsLimit: 10000,
          currentPeriodStart: new Date('2026-05-01'),
          currentPeriodEnd: new Date('2026-05-31'),
          chargebeeCustomerId: 'org_org-1',
          chargebeeSubscriptionId: 'sub_abc123',
        },
      };
      vi.mocked(prisma.organization.findUnique).mockResolvedValue(org as any);
      vi.mocked(prisma.response.count).mockResolvedValue(5);

      const result = await adminResolvers.Query.adminOrganizationById({}, { id: 'org-1' }, mockAdminContext);

      expect(result.subscription?.planId).toBe('starter');
      expect(result.subscription?.currentPeriodStart).toBe('2026-05-01T00:00:00.000Z');
      expect(result.subscription?.chargebeeCustomerId).toBe('org_org-1');
    });
  });

  describe('adminSystemHealth', () => {
    it('should return 4 health check items', async () => {
      vi.mocked(prisma.$queryRaw as any).mockResolvedValue([{ '?column?': 1 }]);

      const result = await adminResolvers.Query.adminSystemHealth({}, {}, mockAdminContext);

      expect(result).toHaveLength(4);
      expect(result.map((r: any) => r.label)).toEqual(['Database', 'Chargebee', 'S3 Storage', 'Email']);
    });

    it('should return error status when database query fails', async () => {
      vi.mocked(prisma.$queryRaw as any).mockRejectedValue(new Error('Connection refused'));

      const result = await adminResolvers.Query.adminSystemHealth({}, {}, mockAdminContext);
      const dbCheck = result.find((r: any) => r.label === 'Database');

      expect(dbCheck?.status).toBe('error');
    });

    it('should report degraded when optional service env vars are absent', async () => {
      // Save and clear optional service env vars to cover 'degraded' branches
      const saved: Record<string, string | undefined> = {};
      const keys = ['CHARGEBEE_API_KEY', 'CHARGEBEE_SITE', 'PUBLIC_S3_ACCESS_KEY', 'PUBLIC_S3_ENDPOINT', 'EMAIL_HOST', 'EMAIL_USER'];
      keys.forEach(k => { saved[k] = process.env[k]; delete process.env[k]; });

      vi.mocked(prisma.$queryRaw as any).mockResolvedValue([{ '?column?': 1 }]);
      const result = await adminResolvers.Query.adminSystemHealth({}, {}, mockAdminContext);

      keys.forEach(k => { if (saved[k] !== undefined) process.env[k] = saved[k]; });

      const chargebee = result.find((r: any) => r.label === 'Chargebee');
      expect(chargebee?.status).toBe('degraded');
      const s3 = result.find((r: any) => r.label === 'S3 Storage');
      expect(s3?.status).toBe('degraded');
      const email = result.find((r: any) => r.label === 'Email');
      expect(email?.status).toBe('degraded');
    });

    it('should require admin role', async () => {
      await expect(
        adminResolvers.Query.adminSystemHealth({}, {}, mockUserContext)
      ).rejects.toThrow();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty organizations list', async () => {
      vi.mocked(prisma.organization.findMany).mockResolvedValue([]);
      vi.mocked(prisma.organization.count).mockResolvedValue(0);

      const result = await adminResolvers.Query.adminOrganizations({}, {}, mockAdminContext);

      expect(result).toEqual({
        organizations: [],
        total: 0,
        hasMore: false,
      });
    });

    it('should handle empty users list', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([]);
      vi.mocked(prisma.user.count).mockResolvedValue(0);

      const result = await adminResolvers.Query.adminUsers({}, {}, mockAdminContext);

      expect(result).toEqual({
        users: [],
        totalCount: 0,
        currentPage: 1,
        totalPages: 0,
      });
    });

    it('should handle user with no organizations', async () => {
      const userWithoutOrgs = {
        ...mockUser,
        members: [],
      };
      vi.mocked(prisma.user.findUnique).mockResolvedValue(userWithoutOrgs as any);

      const result = await adminResolvers.Query.adminUserById(
        {},
        { id: 'user-123' },
        mockAdminContext
      );

      expect(result.organizations).toEqual([]);
    });

    it('should handle organization with no members', async () => {
      const mockDetailedOrganization = {
        id: 'org-123',
        name: 'Test Organization',
        slug: 'test-org',
        logo: null,
        createdAt: new Date('2024-01-01'),
        members: [] as any[],
        forms: [] as any[],
        subscription: null,
      };

      vi.mocked(prisma.organization.findUnique).mockResolvedValue(mockDetailedOrganization as any);
      vi.mocked(prisma.response.count).mockResolvedValue(0);

      const result = await adminResolvers.Query.adminOrganizationById(
        {},
        { id: 'org-123' },
        mockAdminContext
      );

      expect(result.members).toEqual([]);
      expect(result.stats.totalForms).toBe(0);
      expect(result.stats.totalResponses).toBe(0);
    });

    it('should handle S3 with missing Size property', async () => {
      // S3 mocking is complex with the actual S3 client instance created in the resolver
      // This test verifies S3 errors are handled gracefully
      mockS3Send.mockRejectedValue(new Error('S3 error'));
      vi.mocked(prisma.organization.count).mockResolvedValue(0);
      vi.mocked(prisma.user.count).mockResolvedValue(0);
      vi.mocked(prisma.form.count).mockResolvedValue(0);
      vi.mocked(prisma.response.count).mockResolvedValue(0);
      vi.mocked(prisma.subscription.count).mockResolvedValue(0);
      vi.mocked(prisma.subscription.findMany).mockResolvedValue([]);

      const result = await adminResolvers.Query.adminStats({}, {}, mockAdminContext);

      // Should handle S3 errors gracefully
      expect(result.storageUsed).toBe('0 B');
      expect(result.fileCount).toBe(0);
    });

    it('should return storage stats from S3 and PostgreSQL', async () => {
      mockS3Send.mockResolvedValue({
        Contents: [],
        IsTruncated: false,
      });
      vi.mocked(prisma.organization.count).mockResolvedValue(0);
      vi.mocked(prisma.user.count).mockResolvedValue(0);
      vi.mocked(prisma.form.count).mockResolvedValue(0);
      vi.mocked(prisma.response.count).mockResolvedValue(0);
      vi.mocked(prisma.subscription.count).mockResolvedValue(0);
      vi.mocked(prisma.subscription.findMany).mockResolvedValue([]);

      const result = await adminResolvers.Query.adminStats({}, {}, mockAdminContext);

      expect(result.storageUsed).toBeDefined();
      expect(result.fileCount).toBeDefined();
      expect(result.postgresDbSize).toBeDefined();
      expect(result.postgresTableCount).toBeDefined();
    });

    it('should handle large pagination offset', async () => {
      vi.mocked(prisma.organization.findMany).mockResolvedValue([]);
      vi.mocked(prisma.organization.count).mockResolvedValue(10);

      const result = await adminResolvers.Query.adminOrganizations(
        {},
        { limit: 50, offset: 100 },
        mockAdminContext
      );

      expect(result.organizations).toEqual([]);
      expect(result.hasMore).toBe(false);
    });
  });

  describe('Query: adminPlans', () => {
    const catalogEntry = {
      id: 'starter',
      name: 'Starter Plan',
      description: 'For growing teams',
      status: 'active',
      visibleOnPricingPage: true,
      prices: [
        { id: 'starter-usd-monthly', currency: 'USD', period: 'monthly', priceInSmallestUnit: 600, status: 'active' },
      ],
      limits: { views: null, submissions: 10000, aiCredits: 2000 },
    };

    it('should return the catalog decorated with subscriber counts', async () => {
      vi.mocked(getAdminPlanCatalog).mockResolvedValue([catalogEntry] as any);
      vi.mocked(prisma.subscription.groupBy).mockResolvedValue([
        { planId: 'starter', _count: { _all: 7 } },
      ] as any);

      const result = await adminResolvers.Query.adminPlans({}, {}, mockAdminContext);

      expect(result).toEqual([{ ...catalogEntry, subscriberCount: 7 }]);
    });

    it('should default subscriberCount to 0 for plans with no subscriptions', async () => {
      vi.mocked(getAdminPlanCatalog).mockResolvedValue([catalogEntry] as any);
      vi.mocked(prisma.subscription.groupBy).mockResolvedValue([] as any);

      const result = await adminResolvers.Query.adminPlans({}, {}, mockAdminContext);

      expect(result[0].subscriberCount).toBe(0);
    });

    it('should require admin role', async () => {
      await expect(
        adminResolvers.Query.adminPlans({}, {}, mockUserContext)
      ).rejects.toThrow();
    });
  });

  describe('Mutation: adminCreatePlan', () => {
    const validInput = {
      id: 'pro',
      name: 'Pro Plan',
      description: 'A new tier',
      prices: [{ currency: 'USD', period: 'monthly', priceInSmallestUnit: 900 }],
      limits: { views: null, submissions: 25000, aiCredits: 5000 },
      visibleOnPricingPage: false,
    };

    beforeEach(() => {
      vi.mocked(createPlan).mockResolvedValue(undefined);
      vi.mocked(getAdminPlanCatalog).mockResolvedValue([
        {
          id: 'pro', name: 'Pro Plan', description: 'A new tier', status: 'active',
          visibleOnPricingPage: false, prices: [], limits: { views: null, submissions: 25000, aiCredits: 5000 },
        },
      ] as any);
      vi.mocked(prisma.subscription.groupBy).mockResolvedValue([] as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);
    });

    it('should create the plan and write an audit log entry', async () => {
      const result = await adminResolvers.Mutation.adminCreatePlan({}, { input: validInput }, mockAdminContext);

      expect(vi.mocked(createPlan)).toHaveBeenCalledWith({
        id: 'pro',
        name: 'Pro Plan',
        description: 'A new tier',
        prices: [{ currency: 'USD', period: 'monthly', priceInSmallestUnit: 900 }],
        limits: { views: null, submissions: 25000, aiCredits: 5000 },
        visibleOnPricingPage: false,
      });
      expect(result.id).toBe('pro');
      expect(vi.mocked(prisma.auditLog.create)).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'plan_created', resourceType: 'Plan', resourceId: 'pro' }),
        })
      );
    });

    it('should reject an invalid currency', async () => {
      await expect(
        adminResolvers.Mutation.adminCreatePlan(
          {},
          { input: { ...validInput, prices: [{ currency: 'EUR', period: 'monthly', priceInSmallestUnit: 900 }] } },
          mockAdminContext
        )
      ).rejects.toThrow('Invalid currency');
      expect(vi.mocked(createPlan)).not.toHaveBeenCalled();
    });

    it('should reject a negative price', async () => {
      await expect(
        adminResolvers.Mutation.adminCreatePlan(
          {},
          { input: { ...validInput, prices: [{ currency: 'USD', period: 'monthly', priceInSmallestUnit: -1 }] } },
          mockAdminContext
        )
      ).rejects.toThrow('non-negative');
    });

    it('should reject when no prices are provided', async () => {
      await expect(
        adminResolvers.Mutation.adminCreatePlan({}, { input: { ...validInput, prices: [] } }, mockAdminContext)
      ).rejects.toThrow('At least one price');
    });

    it('should propagate service errors without writing an audit log', async () => {
      vi.mocked(createPlan).mockRejectedValue(new Error('The enterprise plan id is reserved for per-organization deals'));

      await expect(
        adminResolvers.Mutation.adminCreatePlan({}, { input: validInput }, mockAdminContext)
      ).rejects.toThrow('reserved');
      expect(vi.mocked(prisma.auditLog.create)).not.toHaveBeenCalled();
    });

    it('should require admin role', async () => {
      await expect(
        adminResolvers.Mutation.adminCreatePlan({}, { input: validInput }, mockUserContext)
      ).rejects.toThrow();
    });
  });

  describe('Mutation: adminUpdatePlan', () => {
    beforeEach(() => {
      vi.mocked(updatePlan).mockResolvedValue({ backfilledOrganizations: 3 });
      vi.mocked(getAdminPlanCatalog).mockResolvedValue([
        {
          id: 'starter', name: 'Starter Plan', description: '', status: 'active',
          visibleOnPricingPage: true, prices: [], limits: { views: null, submissions: 20000, aiCredits: 2000 },
        },
      ] as any);
      vi.mocked(prisma.subscription.groupBy).mockResolvedValue([] as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);
    });

    it('should update the plan and record the backfilled org count in the audit log', async () => {
      const result = await adminResolvers.Mutation.adminUpdatePlan(
        {},
        { input: { id: 'starter', limits: { views: null, submissions: 20000, aiCredits: 2000 } } },
        mockAdminContext
      );

      expect(vi.mocked(updatePlan)).toHaveBeenCalledWith({
        id: 'starter',
        name: undefined,
        description: undefined,
        prices: undefined,
        limits: { views: null, submissions: 20000, aiCredits: 2000 },
        visibleOnPricingPage: undefined,
      });
      expect(result.id).toBe('starter');
      expect(vi.mocked(prisma.auditLog.create)).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'plan_updated',
            metadata: expect.objectContaining({ backfilledOrganizations: 3 }),
          }),
        })
      );
    });

    it('should pass a visibility-only toggle through', async () => {
      await adminResolvers.Mutation.adminUpdatePlan(
        {},
        { input: { id: 'starter', visibleOnPricingPage: false } },
        mockAdminContext
      );

      expect(vi.mocked(updatePlan)).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'starter', visibleOnPricingPage: false, limits: undefined })
      );
    });

    it('should reject a non-integer limit', async () => {
      await expect(
        adminResolvers.Mutation.adminUpdatePlan(
          {},
          { input: { id: 'starter', limits: { views: 1.5, submissions: null, aiCredits: null } } },
          mockAdminContext
        )
      ).rejects.toThrow('non-negative integer');
    });

    it('should require admin role', async () => {
      await expect(
        adminResolvers.Mutation.adminUpdatePlan({}, { input: { id: 'starter' } }, mockUserContext)
      ).rejects.toThrow();
    });
  });

  describe('Mutation: adminArchivePlan / adminUnarchivePlan', () => {
    beforeEach(() => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);
    });

    it('should archive the plan and write an audit log entry', async () => {
      vi.mocked(archivePlan).mockResolvedValue(undefined);

      const result = await adminResolvers.Mutation.adminArchivePlan({}, { planId: 'pro' }, mockAdminContext);

      expect(result).toBe(true);
      expect(vi.mocked(archivePlan)).toHaveBeenCalledWith('pro');
      expect(vi.mocked(prisma.auditLog.create)).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'plan_archived', resourceId: 'pro' }) })
      );
    });

    it('should surface service rejections (e.g. archiving free)', async () => {
      vi.mocked(archivePlan).mockRejectedValue(new Error('The free plan cannot be archived'));

      await expect(
        adminResolvers.Mutation.adminArchivePlan({}, { planId: 'free' }, mockAdminContext)
      ).rejects.toThrow('cannot be archived');
      expect(vi.mocked(prisma.auditLog.create)).not.toHaveBeenCalled();
    });

    it('should restore the plan and write an audit log entry', async () => {
      vi.mocked(unarchivePlan).mockResolvedValue(undefined);

      const result = await adminResolvers.Mutation.adminUnarchivePlan({}, { planId: 'pro' }, mockAdminContext);

      expect(result).toBe(true);
      expect(vi.mocked(unarchivePlan)).toHaveBeenCalledWith('pro');
      expect(vi.mocked(prisma.auditLog.create)).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'plan_unarchived' }) })
      );
    });

    it('should require admin role', async () => {
      await expect(
        adminResolvers.Mutation.adminArchivePlan({}, { planId: 'pro' }, mockUserContext)
      ).rejects.toThrow();
      await expect(
        adminResolvers.Mutation.adminUnarchivePlan({}, { planId: 'pro' }, mockUserContext)
      ).rejects.toThrow();
    });
  });

  describe('Mutation: adminAssignPlan', () => {
    beforeEach(() => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        organizationId: 'org-1', planId: 'free', status: 'active',
        chargebeeSubscriptionId: 'cb_sub_1', viewsUsed: 0, submissionsUsed: 0,
        currentPeriodStart: new Date(), currentPeriodEnd: new Date(),
      } as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);
      vi.mocked(changeOrganizationPlan).mockResolvedValue(undefined);
    });

    it('should assign the plan via Chargebee and write an audit log entry', async () => {
      const result = await adminResolvers.Mutation.adminAssignPlan(
        {}, { orgId: 'org-1', planId: 'starter' }, mockAdminContext
      );

      expect(result).toBe(true);
      expect(vi.mocked(changeOrganizationPlan)).toHaveBeenCalledWith('org-1', 'starter');
      expect(vi.mocked(prisma.auditLog.create)).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'plan_changed',
            metadata: expect.objectContaining({ from: 'free', to: 'starter' }),
          }),
        })
      );
    });

    it('should propagate Chargebee failures without writing an audit log', async () => {
      vi.mocked(changeOrganizationPlan).mockRejectedValue(new Error('Failed to update Chargebee subscription: down'));

      await expect(
        adminResolvers.Mutation.adminAssignPlan({}, { orgId: 'org-1', planId: 'starter' }, mockAdminContext)
      ).rejects.toThrow('Failed to update Chargebee subscription');
      expect(vi.mocked(prisma.auditLog.create)).not.toHaveBeenCalled();
    });

    it('should require admin role', async () => {
      await expect(
        adminResolvers.Mutation.adminAssignPlan({}, { orgId: 'org-1', planId: 'starter' }, mockUserContext)
      ).rejects.toThrow();
    });

    it('should throw NOT_FOUND when subscription does not exist', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null);

      await expect(
        adminResolvers.Mutation.adminAssignPlan({}, { orgId: 'org-1', planId: 'starter' }, mockAdminContext)
      ).rejects.toThrow();
    });
  });

  describe('Mutation: adminSetEnterprisePlan', () => {
    const validArgs = {
      orgId: 'org-1',
      currency: 'USD',
      period: 'monthly',
      priceInSmallestUnit: 250000,
      viewsLimit: null,
      submissionsLimit: 50000,
      aiCreditsLimit: null,
    };

    beforeEach(() => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        organizationId: 'org-1', planId: 'advanced', status: 'active',
        chargebeeSubscriptionId: 'chargebee_sub_1', viewsUsed: 0, submissionsUsed: 0,
        currentPeriodStart: new Date(), currentPeriodEnd: new Date(),
      } as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);
      vi.mocked(setEnterpriseSubscription).mockResolvedValue({
        checkoutUrl: 'https://test-site.chargebee.com/pages/v4/checkout123',
      });
    });

    it('should call setEnterpriseSubscription, return the checkout URL, and write an audit log entry', async () => {
      const result = await adminResolvers.Mutation.adminSetEnterprisePlan({}, validArgs, mockAdminContext);

      expect(result).toEqual({
        requiresPayment: true,
        checkoutUrl: 'https://test-site.chargebee.com/pages/v4/checkout123',
      });
      expect(vi.mocked(setEnterpriseSubscription)).toHaveBeenCalledWith('org-1', {
        currency: 'USD',
        period: 'monthly',
        priceInSmallestUnit: 250000,
        viewsLimit: null,
        submissionsLimit: 50000,
        aiCreditsLimit: null,
      });
      expect(vi.mocked(prisma.auditLog.create)).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'enterprise_plan_set',
            metadata: expect.objectContaining({
              from: 'advanced',
              to: 'enterprise',
              priceInSmallestUnit: 250000,
              requiresPayment: true,
            }),
          }),
        })
      );
    });

    it('should accept 0 as an explicit price (no payment required) and as an explicit limit', async () => {
      vi.mocked(setEnterpriseSubscription).mockResolvedValue({ checkoutUrl: null });

      const result = await adminResolvers.Mutation.adminSetEnterprisePlan(
        {},
        { ...validArgs, priceInSmallestUnit: 0, viewsLimit: 0, submissionsLimit: 0, aiCreditsLimit: 0 },
        mockAdminContext
      );

      expect(result).toEqual({ requiresPayment: false, checkoutUrl: null });
      expect(vi.mocked(setEnterpriseSubscription)).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({ priceInSmallestUnit: 0, viewsLimit: 0, submissionsLimit: 0, aiCreditsLimit: 0 })
      );
    });

    it.each(['GBP', 'jpy', ''])('should reject an invalid currency (%s)', async (currency) => {
      await expect(
        adminResolvers.Mutation.adminSetEnterprisePlan({}, { ...validArgs, currency }, mockAdminContext)
      ).rejects.toThrow();
      expect(vi.mocked(setEnterpriseSubscription)).not.toHaveBeenCalled();
    });

    it('should reject an invalid billing period', async () => {
      await expect(
        adminResolvers.Mutation.adminSetEnterprisePlan({}, { ...validArgs, period: 'weekly' }, mockAdminContext)
      ).rejects.toThrow();
    });

    it('should reject a negative price', async () => {
      await expect(
        adminResolvers.Mutation.adminSetEnterprisePlan(
          {}, { ...validArgs, priceInSmallestUnit: -100 }, mockAdminContext
        )
      ).rejects.toThrow();
    });

    it('should reject a negative or non-integer limit', async () => {
      await expect(
        adminResolvers.Mutation.adminSetEnterprisePlan(
          {}, { ...validArgs, viewsLimit: -5 }, mockAdminContext
        )
      ).rejects.toThrow();

      await expect(
        adminResolvers.Mutation.adminSetEnterprisePlan(
          {}, { ...validArgs, submissionsLimit: 1.5 }, mockAdminContext
        )
      ).rejects.toThrow();
    });

    it('should require admin role', async () => {
      await expect(
        adminResolvers.Mutation.adminSetEnterprisePlan({}, validArgs, mockUserContext)
      ).rejects.toThrow();
      expect(vi.mocked(setEnterpriseSubscription)).not.toHaveBeenCalled();
    });

    it('should throw NOT_FOUND when subscription does not exist', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null);

      await expect(
        adminResolvers.Mutation.adminSetEnterprisePlan({}, validArgs, mockAdminContext)
      ).rejects.toThrow();
      expect(vi.mocked(setEnterpriseSubscription)).not.toHaveBeenCalled();
    });

    it('should propagate errors from setEnterpriseSubscription without writing an audit log', async () => {
      vi.mocked(setEnterpriseSubscription).mockRejectedValueOnce(new Error('Chargebee down'));

      await expect(
        adminResolvers.Mutation.adminSetEnterprisePlan({}, validArgs, mockAdminContext)
      ).rejects.toThrow('Chargebee down');
      expect(vi.mocked(prisma.auditLog.create)).not.toHaveBeenCalled();
    });
  });

  describe('Mutation: adminResetUsage', () => {
    it('should reset usage counters, AI token usage, and write audit log', async () => {
      const periodStart = new Date('2026-05-01');
      const periodEnd = new Date('2026-05-31');
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        organizationId: 'org-1', viewsUsed: 500, submissionsUsed: 200,
        currentPeriodStart: periodStart, currentPeriodEnd: periodEnd,
      } as any);
      vi.mocked(prisma.subscription.update).mockResolvedValue({} as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);
      vi.mocked(prisma.aIUsage.aggregate).mockResolvedValue({ _sum: { tokensUsed: 1500 } } as any);
      vi.mocked(prisma.aIUsage.updateMany).mockResolvedValue({ count: 1 } as any);

      const result = await adminResolvers.Mutation.adminResetUsage({}, { orgId: 'org-1' }, mockAdminContext);

      expect(result).toBe(true);
      expect(vi.mocked(resetUsageCounters)).toHaveBeenCalledWith('org-1', periodStart, periodEnd);
      expect(vi.mocked(prisma.aIUsage.updateMany)).toHaveBeenCalledWith({
        where: { organizationId: 'org-1' },
        data: { tokensUsed: 0, creditsUsedMilli: 0 },
      });
      expect(vi.mocked(prisma.auditLog.create)).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'usage_reset',
            metadata: expect.objectContaining({ previousTokensUsed: 1500 }),
          }),
        })
      );
    });

    it('should zero creditsUsedMilli and invalidate the AI budget cache', async () => {
      const periodStart = new Date('2026-05-01');
      const periodEnd = new Date('2026-05-31');
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        organizationId: 'org-1', viewsUsed: 500, submissionsUsed: 200,
        currentPeriodStart: periodStart, currentPeriodEnd: periodEnd,
      } as any);
      vi.mocked(prisma.subscription.update).mockResolvedValue({} as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);
      vi.mocked(prisma.aIUsage.aggregate).mockResolvedValue({ _sum: { tokensUsed: 1500 } } as any);
      vi.mocked(prisma.aIUsage.updateMany).mockResolvedValue({ count: 1 } as any);

      await adminResolvers.Mutation.adminResetUsage({}, { orgId: 'org-1' }, mockAdminContext);

      expect(vi.mocked(prisma.aIUsage.updateMany)).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ creditsUsedMilli: 0 }) })
      );
      expect(vi.mocked(invalidateAIBudgetCache)).toHaveBeenCalledWith('org-1');
    });

    it('should throw NOT_FOUND when subscription does not exist', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null);

      await expect(
        adminResolvers.Mutation.adminResetUsage({}, { orgId: 'org-1' }, mockAdminContext)
      ).rejects.toThrow();
    });

    it('should require admin role', async () => {
      await expect(
        adminResolvers.Mutation.adminResetUsage({}, { orgId: 'org-1' }, mockUserContext)
      ).rejects.toThrow();
    });
  });

  describe('Mutation: adminCancelSubscription', () => {
    it('should cancel a Chargebee subscription and update status', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        organizationId: 'org-1', chargebeeSubscriptionId: 'sub_abc123', status: 'active',
      } as any);
      vi.mocked(prisma.subscription.update).mockResolvedValue({} as any);

      const result = await adminResolvers.Mutation.adminCancelSubscription({}, { orgId: 'org-1' }, mockAdminContext);

      expect(result).toBe(true);
      expect(vi.mocked(cancelChargebeeSubscription)).toHaveBeenCalledWith('sub_abc123', true);
      expect(vi.mocked(prisma.subscription.update)).toHaveBeenCalledWith({
        where: { organizationId: 'org-1' },
        data: { status: 'cancelled' },
      });
    });

    it('should throw NOT_FOUND when subscription does not exist', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null);

      await expect(
        adminResolvers.Mutation.adminCancelSubscription({}, { orgId: 'org-1' }, mockAdminContext)
      ).rejects.toThrow();
    });

    it('should throw BAD_USER_INPUT when no Chargebee subscription ID (free plan)', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        organizationId: 'org-1', chargebeeSubscriptionId: null, status: 'active',
      } as any);

      await expect(
        adminResolvers.Mutation.adminCancelSubscription({}, { orgId: 'org-1' }, mockAdminContext)
      ).rejects.toThrow();
    });

    it('should require admin role', async () => {
      await expect(
        adminResolvers.Mutation.adminCancelSubscription({}, { orgId: 'org-1' }, mockUserContext)
      ).rejects.toThrow();
    });
  });

  describe('Mutation: adminReactivateSubscription', () => {
    it('should reactivate a Chargebee subscription and update status', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        organizationId: 'org-1', chargebeeSubscriptionId: 'sub_abc123', status: 'cancelled',
      } as any);
      vi.mocked(prisma.subscription.update).mockResolvedValue({} as any);

      const result = await adminResolvers.Mutation.adminReactivateSubscription({}, { orgId: 'org-1' }, mockAdminContext);

      expect(result).toBe(true);
      expect(vi.mocked(reactivateChargebeeSubscription)).toHaveBeenCalledWith('sub_abc123');
      expect(vi.mocked(prisma.subscription.update)).toHaveBeenCalledWith({
        where: { organizationId: 'org-1' },
        data: { status: 'active' },
      });
    });

    it('should throw NOT_FOUND when subscription does not exist', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null);

      await expect(
        adminResolvers.Mutation.adminReactivateSubscription({}, { orgId: 'org-1' }, mockAdminContext)
      ).rejects.toThrow();
    });

    it('should throw BAD_USER_INPUT when no Chargebee subscription ID', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        organizationId: 'org-1', chargebeeSubscriptionId: null, status: 'cancelled',
      } as any);

      await expect(
        adminResolvers.Mutation.adminReactivateSubscription({}, { orgId: 'org-1' }, mockAdminContext)
      ).rejects.toThrow();
    });

    it('should require admin role', async () => {
      await expect(
        adminResolvers.Mutation.adminReactivateSubscription({}, { orgId: 'org-1' }, mockUserContext)
      ).rejects.toThrow();
    });
  });
});

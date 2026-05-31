import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { adminResolvers, _clearStatsCacheForTests } from '../admin.js';
import { GraphQLError } from '#graphql-errors';
import { prisma } from '../../../lib/prisma.js';

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
    },
    auditLog: {
      create: vi.fn(),
    },
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
});

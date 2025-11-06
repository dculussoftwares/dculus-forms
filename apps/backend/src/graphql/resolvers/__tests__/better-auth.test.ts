import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { betterAuthResolvers } from '../better-auth.js';
import { GraphQLError } from 'graphql';
import * as betterAuthMiddleware from '../../../middleware/better-auth-middleware.js';
import * as chargebeeService from '../../../services/chargebeeService.js';
import { prisma } from '../../../lib/prisma.js';

// Mock all dependencies
vi.mock('../../../middleware/better-auth-middleware.js');
vi.mock('../../../services/chargebeeService.js');
vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    member: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    organization: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));
vi.mock('../../../lib/better-auth.js', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
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
vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'generated-nano-id'),
}));

describe('Better-Auth Resolvers', () => {
  const mockContext = {
    auth: {
      user: {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
      },
      session: {
        id: 'session-123',
        activeOrganizationId: 'org-123',
      },
      isAuthenticated: true,
    },
  };

  const mockContextNoActiveOrg = {
    auth: {
      user: {
        id: 'user-456',
        email: 'newuser@example.com',
        name: 'New User',
        role: 'user',
      },
      session: {
        id: 'session-456',
        activeOrganizationId: null,
      },
      isAuthenticated: true,
    },
  };

  const mockOrganization = {
    id: 'org-123',
    name: 'Test Organization',
    slug: 'test-organization',
    logo: null,
    createdAt: new Date('2024-01-01'),
    members: [
      {
        id: 'member-123',
        organizationId: 'org-123',
        userId: 'user-123',
        role: 'owner',
        createdAt: new Date('2024-01-01'),
        user: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
        },
      },
    ],
  };

  const mockMembership = {
    id: 'member-123',
    organizationId: 'org-123',
    userId: 'user-123',
    role: 'owner',
    createdAt: new Date('2024-01-01'),
    organization: mockOrganization,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('User: organizations', () => {
    it('should return user organizations with members', async () => {
      vi.mocked(prisma.member.findMany).mockResolvedValue([mockMembership] as any);

      const result = await betterAuthResolvers.User.organizations({
        id: 'user-123',
        email: 'test@example.com',
      });

      expect(result).toEqual([mockOrganization]);
      expect(prisma.member.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        include: {
          organization: {
            include: {
              members: {
                include: {
                  user: true,
                },
              },
            },
          },
        },
      });
    });

    it('should return empty array when user has no organizations', async () => {
      vi.mocked(prisma.member.findMany).mockResolvedValue([]);

      const result = await betterAuthResolvers.User.organizations({
        id: 'user-789',
        email: 'noorg@example.com',
      });

      expect(result).toEqual([]);
    });

    it('should return multiple organizations for user', async () => {
      const mockOrg2 = {
        ...mockOrganization,
        id: 'org-456',
        name: 'Second Organization',
      };
      vi.mocked(prisma.member.findMany).mockResolvedValue([
        mockMembership,
        { ...mockMembership, id: 'member-456', organization: mockOrg2 },
      ] as any);

      const result = await betterAuthResolvers.User.organizations({
        id: 'user-123',
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(mockOrganization);
      expect(result[1]).toEqual(mockOrg2);
    });
  });

  describe('Query: me', () => {
    it('should return authenticated user', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);

      const result = await betterAuthResolvers.Query.me({}, {}, mockContext);

      expect(result).toEqual(mockContext.auth.user);
      expect(betterAuthMiddleware.requireAuth).toHaveBeenCalledWith(mockContext.auth);
    });

    it('should throw error when not authenticated', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockImplementation(() => {
        throw new Error('Authentication required');
      });

      await expect(
        betterAuthResolvers.Query.me({}, {}, mockContext)
      ).rejects.toThrow('Authentication required');
    });
  });

  describe('Query: activeOrganization', () => {
    it('should return active organization when user is member', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockResolvedValue({
        role: 'owner',
      });
      vi.mocked(prisma.organization.findUnique).mockResolvedValue(mockOrganization as any);

      const result = await betterAuthResolvers.Query.activeOrganization(
        {},
        {},
        mockContext
      );

      expect(result).toEqual(mockOrganization);
      expect(betterAuthMiddleware.requireOrganizationMembership).toHaveBeenCalledWith(
        mockContext.auth,
        'org-123'
      );
      expect(prisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: 'org-123' },
        include: {
          members: {
            include: {
              user: true,
            },
          },
        },
      });
    });

    it('should return null when no active organization in session', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(
        mockContextNoActiveOrg.auth
      );

      const result = await betterAuthResolvers.Query.activeOrganization(
        {},
        {},
        mockContextNoActiveOrg
      );

      expect(result).toBeNull();
    });

    it('should return null when user is not a member of active organization', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockRejectedValue(
        new GraphQLError('Access denied: You are not a member of this organization')
      );

      const result = await betterAuthResolvers.Query.activeOrganization(
        {},
        {},
        mockContext
      );

      expect(result).toBeNull();
    });

    it('should return null when organization not found', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockResolvedValue({
        role: 'owner',
      });
      vi.mocked(prisma.organization.findUnique).mockResolvedValue(null);

      const result = await betterAuthResolvers.Query.activeOrganization(
        {},
        {},
        mockContext
      );

      expect(result).toBeNull();
    });

    it('should throw error for authentication errors', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockImplementation(() => {
        throw new Error('Authentication required');
      });

      await expect(
        betterAuthResolvers.Query.activeOrganization({}, {}, mockContext)
      ).rejects.toThrow('Authentication required');
    });

    it('should return null for access denied errors with "not a member" message', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockRejectedValue(
        new Error('User is not a member of this organization')
      );

      const result = await betterAuthResolvers.Query.activeOrganization(
        {},
        {},
        mockContext
      );

      expect(result).toBeNull();
    });
  });

  describe('Mutation: createOrganization', () => {
    it('should create organization with owner membership', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
      vi.mocked(prisma.member.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.organization.create).mockResolvedValue({
        id: 'generated-nano-id',
        name: 'New Organization',
        slug: 'new-organization',
        logo: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: null,
      });
      vi.mocked(prisma.member.create).mockResolvedValue({
        id: 'generated-nano-id',
        organizationId: 'generated-nano-id',
        userId: 'user-123',
        role: 'owner',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(prisma.organization.findUnique).mockResolvedValue(mockOrganization as any);
      vi.mocked(chargebeeService.createChargebeeCustomer).mockResolvedValue('cb-customer-123');
      vi.mocked(chargebeeService.createFreeSubscription).mockResolvedValue(undefined);

      const result = await betterAuthResolvers.Mutation.createOrganization(
        {},
        { name: 'New Organization' },
        mockContext
      );

      expect(result).toEqual(mockOrganization);
      expect(betterAuthMiddleware.requireAuth).toHaveBeenCalledWith(mockContext.auth);
      expect(prisma.member.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      });
      expect(prisma.organization.create).toHaveBeenCalledWith({
        data: {
          id: 'generated-nano-id',
          name: 'New Organization',
          slug: 'new-organization',
          logo: null,
        },
      });
      expect(prisma.member.create).toHaveBeenCalledWith({
        data: {
          id: 'generated-nano-id',
          organizationId: 'generated-nano-id',
          userId: 'user-123',
          role: 'owner',
        },
      });
    });

    it('should create free subscription with Chargebee', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
      vi.mocked(prisma.member.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.organization.create).mockResolvedValue({
        id: 'org-new',
        name: 'Test Org',
        slug: 'test-org',
        logo: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: null,
      });
      vi.mocked(prisma.member.create).mockResolvedValue({
        id: 'member-new',
        organizationId: 'org-new',
        userId: 'user-123',
        role: 'owner',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(prisma.organization.findUnique).mockResolvedValue(mockOrganization as any);
      vi.mocked(chargebeeService.createChargebeeCustomer).mockResolvedValue('cb-customer-789');
      vi.mocked(chargebeeService.createFreeSubscription).mockResolvedValue(undefined);

      await betterAuthResolvers.Mutation.createOrganization(
        {},
        { name: 'Test Org' },
        mockContext
      );

      expect(chargebeeService.createChargebeeCustomer).toHaveBeenCalledWith(
        'org-new',
        'Test Org',
        'test@example.com'
      );
      expect(chargebeeService.createFreeSubscription).toHaveBeenCalledWith(
        'org-new',
        'cb-customer-789'
      );
    });

    it('should continue when Chargebee subscription creation fails', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
      vi.mocked(prisma.member.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.organization.create).mockResolvedValue({
        id: 'org-new',
        name: 'Test Org',
        slug: 'test-org',
        logo: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: null,
      });
      vi.mocked(prisma.member.create).mockResolvedValue({
        id: 'member-new',
        organizationId: 'org-new',
        userId: 'user-123',
        role: 'owner',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(prisma.organization.findUnique).mockResolvedValue(mockOrganization as any);
      vi.mocked(chargebeeService.createChargebeeCustomer).mockRejectedValue(
        new Error('Chargebee API error')
      );

      const result = await betterAuthResolvers.Mutation.createOrganization(
        {},
        { name: 'Test Org' },
        mockContext
      );

      expect(result).toEqual(mockOrganization);
    });

    it('should throw error when user already belongs to organization', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
      vi.mocked(prisma.member.findFirst).mockResolvedValue({
        id: 'member-existing',
        organizationId: 'org-existing',
        userId: 'user-123',
        role: 'member',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        betterAuthResolvers.Mutation.createOrganization(
          {},
          { name: 'Another Org' },
          mockContext
        )
      ).rejects.toThrow('User can only belong to one organization. You are already a member of an organization.');
    });

    it('should sanitize organization name for slug', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
      vi.mocked(prisma.member.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.organization.create).mockResolvedValue({
        id: 'org-id',
        name: 'My Org! @#$ 123',
        slug: 'my-org--123',
        logo: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: null,
      });
      vi.mocked(prisma.member.create).mockResolvedValue({
        id: 'member-id',
        organizationId: 'org-id',
        userId: 'user-123',
        role: 'owner',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(prisma.organization.findUnique).mockResolvedValue(mockOrganization as any);
      vi.mocked(chargebeeService.createChargebeeCustomer).mockResolvedValue('cb-customer-456');
      vi.mocked(chargebeeService.createFreeSubscription).mockResolvedValue(undefined);

      await betterAuthResolvers.Mutation.createOrganization(
        {},
        { name: 'My Org! @#$ 123' },
        mockContext
      );

      expect(prisma.organization.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          slug: 'my-org--123',
        }),
      });
    });

    it('should require authentication', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockImplementation(() => {
        throw new Error('Authentication required');
      });

      await expect(
        betterAuthResolvers.Mutation.createOrganization(
          {},
          { name: 'New Org' },
          mockContext
        )
      ).rejects.toThrow('Authentication required');
    });
  });

  describe('Mutation: setActiveOrganization', () => {
    it('should set active organization when user is member', async () => {
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockResolvedValue({
        id: 'member-123',
        role: 'owner',
      });
      vi.mocked(prisma.organization.findUnique).mockResolvedValue(mockOrganization as any);

      const result = await betterAuthResolvers.Mutation.setActiveOrganization(
        {},
        { organizationId: 'org-123' },
        mockContext
      );

      expect(result).toEqual(mockOrganization);
      expect(betterAuthMiddleware.requireOrganizationMembership).toHaveBeenCalledWith(
        mockContext.auth,
        'org-123'
      );
      expect(prisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: 'org-123' },
        include: {
          members: {
            include: {
              user: true,
            },
          },
        },
      });
    });

    it('should throw error when user is not a member', async () => {
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockRejectedValue(
        new GraphQLError('Access denied: You are not a member of this organization')
      );

      await expect(
        betterAuthResolvers.Mutation.setActiveOrganization(
          {},
          { organizationId: 'org-456' },
          mockContext
        )
      ).rejects.toThrow('Access denied: You are not a member of this organization');
    });

    it('should throw error when organization not found', async () => {
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockResolvedValue({
        id: 'member-123',
        role: 'owner',
      });
      vi.mocked(prisma.organization.findUnique).mockResolvedValue(null);

      await expect(
        betterAuthResolvers.Mutation.setActiveOrganization(
          {},
          { organizationId: 'org-nonexistent' },
          mockContext
        )
      ).rejects.toThrow('Organization not found');
    });

    it('should work for members with different roles', async () => {
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockResolvedValue({
        id: 'member-456',
        role: 'member',
      });
      vi.mocked(prisma.organization.findUnique).mockResolvedValue(mockOrganization as any);

      const result = await betterAuthResolvers.Mutation.setActiveOrganization(
        {},
        { organizationId: 'org-123' },
        mockContext
      );

      expect(result).toEqual(mockOrganization);
    });

    it('should require authentication', async () => {
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockImplementation(() => {
        throw new Error('Authentication required');
      });

      await expect(
        betterAuthResolvers.Mutation.setActiveOrganization(
          {},
          { organizationId: 'org-123' },
          mockContext
        )
      ).rejects.toThrow('Authentication required');
    });
  });
});

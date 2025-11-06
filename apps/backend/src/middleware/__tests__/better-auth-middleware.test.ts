import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GraphQLError } from 'graphql';
import {
  createBetterAuthContext,
  requireAuth,
  requireOrganization,
  requireOrganizationMembership,
  requireOrganizationRole,
  checkOrganizationMembership,
  type BetterAuthContext,
} from '../better-auth-middleware.js';
import type { Request } from 'express';

// Mock dependencies
vi.mock('../../lib/better-auth.js', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    member: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('better-auth/node', () => ({
  fromNodeHeaders: vi.fn((headers) => headers),
}));

import { auth } from '../../lib/better-auth.js';
import { prisma } from '../../lib/prisma.js';

describe('Better Auth Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console logs in tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('createBetterAuthContext', () => {
    it('should create authenticated context with user and session', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com', role: 'user' };
      const mockSession = { id: 'session-123', activeOrganizationId: 'org-123' };

      vi.mocked(auth.api.getSession).mockResolvedValue({
        user: mockUser,
        session: mockSession,
      } as any);

      const mockReq = { headers: {} } as Request;
      const result = await createBetterAuthContext(mockReq);

      expect(result.user).toEqual(mockUser);
      expect(result.session).toEqual(mockSession);
      expect(result.isAuthenticated).toBe(true);
    });

    it('should create unauthenticated context when no session', async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(null as any);

      const mockReq = { headers: {} } as Request;
      const result = await createBetterAuthContext(mockReq);

      expect(result.user).toBeNull();
      expect(result.session).toBeNull();
      expect(result.isAuthenticated).toBe(false);
    });

    it('should handle errors and return unauthenticated context', async () => {
      vi.mocked(auth.api.getSession).mockRejectedValue(new Error('Auth error'));

      const mockReq = { headers: {} } as Request;
      const result = await createBetterAuthContext(mockReq);

      expect(result.user).toBeNull();
      expect(result.session).toBeNull();
      expect(result.isAuthenticated).toBe(false);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('requireAuth', () => {
    it('should return context when authenticated', () => {
      const mockContext: BetterAuthContext = {
        user: { id: 'user-123' },
        session: { id: 'session-123' },
        isAuthenticated: true,
      };

      const result = requireAuth(mockContext);
      expect(result).toEqual(mockContext);
    });

    it('should throw error when not authenticated', () => {
      const mockContext: BetterAuthContext = {
        user: null,
        session: null,
        isAuthenticated: false,
      };

      expect(() => requireAuth(mockContext)).toThrow('Authentication required');
    });

    it('should throw error when user is null even if isAuthenticated is true', () => {
      const mockContext: BetterAuthContext = {
        user: null,
        session: { id: 'session-123' },
        isAuthenticated: true,
      };

      expect(() => requireAuth(mockContext)).toThrow('Authentication required');
    });
  });

  describe('requireOrganization', () => {
    it('should return context when user has active organization', () => {
      const mockContext: BetterAuthContext = {
        user: { id: 'user-123' },
        session: { id: 'session-123', activeOrganizationId: 'org-123' },
        isAuthenticated: true,
      };

      const result = requireOrganization(mockContext);
      expect(result).toEqual(mockContext);
    });

    it('should throw error when not authenticated', () => {
      const mockContext: BetterAuthContext = {
        user: null,
        session: null,
        isAuthenticated: false,
      };

      expect(() => requireOrganization(mockContext)).toThrow('Authentication required');
    });

    it('should throw error when no active organization', () => {
      const mockContext: BetterAuthContext = {
        user: { id: 'user-123' },
        session: { id: 'session-123', activeOrganizationId: null },
        isAuthenticated: true,
      };

      expect(() => requireOrganization(mockContext)).toThrow('Active organization required');
    });
  });

  describe('requireOrganizationMembership', () => {
    it('should return membership when user is a member', async () => {
      const mockContext: BetterAuthContext = {
        user: { id: 'user-123' },
        session: { id: 'session-123' },
        isAuthenticated: true,
      };

      const mockMembership = { role: 'owner' };
      vi.mocked(prisma.member.findFirst).mockResolvedValue(mockMembership as any);

      const result = await requireOrganizationMembership(mockContext, 'org-123');

      expect(result).toEqual(mockMembership);
      expect(prisma.member.findFirst).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-123',
          userId: 'user-123',
        },
        select: {
          role: true,
        },
      });
    });

    it('should throw error when user is not authenticated', async () => {
      const mockContext: BetterAuthContext = {
        user: null,
        session: null,
        isAuthenticated: false,
      };

      await expect(
        requireOrganizationMembership(mockContext, 'org-123')
      ).rejects.toThrow('Authentication required');
    });

    it('should throw GraphQLError when user is not a member', async () => {
      const mockContext: BetterAuthContext = {
        user: { id: 'user-123' },
        session: { id: 'session-123' },
        isAuthenticated: true,
      };

      vi.mocked(prisma.member.findFirst).mockResolvedValue(null);

      await expect(
        requireOrganizationMembership(mockContext, 'org-123')
      ).rejects.toThrow(GraphQLError);

      await expect(
        requireOrganizationMembership(mockContext, 'org-123')
      ).rejects.toThrow('Access denied: You are not a member of this organization');
    });
  });

  describe('requireOrganizationRole', () => {
    it('should return membership when user has required role', async () => {
      const mockContext: BetterAuthContext = {
        user: { id: 'user-123' },
        session: { id: 'session-123' },
        isAuthenticated: true,
      };

      const mockMembership = { role: 'owner' };
      vi.mocked(prisma.member.findFirst).mockResolvedValue(mockMembership as any);

      const result = await requireOrganizationRole(mockContext, 'org-123', 'owner');

      expect(result).toEqual(mockMembership);
    });

    it('should throw GraphQLError when user does not have required role', async () => {
      const mockContext: BetterAuthContext = {
        user: { id: 'user-123' },
        session: { id: 'session-123' },
        isAuthenticated: true,
      };

      const mockMembership = { role: 'member' };
      vi.mocked(prisma.member.findFirst).mockResolvedValue(mockMembership as any);

      await expect(
        requireOrganizationRole(mockContext, 'org-123', 'owner')
      ).rejects.toThrow(GraphQLError);

      await expect(
        requireOrganizationRole(mockContext, 'org-123', 'owner')
      ).rejects.toThrow('Access denied: owner role required for this operation');
    });

    it('should throw error when user is not a member', async () => {
      const mockContext: BetterAuthContext = {
        user: { id: 'user-123' },
        session: { id: 'session-123' },
        isAuthenticated: true,
      };

      vi.mocked(prisma.member.findFirst).mockResolvedValue(null);

      await expect(
        requireOrganizationRole(mockContext, 'org-123', 'owner')
      ).rejects.toThrow('Access denied: You are not a member of this organization');
    });
  });

  describe('checkOrganizationMembership', () => {
    it('should return membership when user is a member', async () => {
      const mockMembership = {
        role: 'owner',
        organization: { id: 'org-123', name: 'Test Org' },
        user: { id: 'user-123', email: 'test@example.com' },
      };

      vi.mocked(prisma.member.findFirst).mockResolvedValue(mockMembership as any);

      const result = await checkOrganizationMembership('user-123', 'org-123');

      expect(result).toEqual(mockMembership);
      expect(prisma.member.findFirst).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-123',
          userId: 'user-123',
        },
        include: {
          organization: true,
          user: true,
        },
      });
    });

    it('should return null when user is not a member', async () => {
      vi.mocked(prisma.member.findFirst).mockResolvedValue(null);

      const result = await checkOrganizationMembership('user-123', 'org-123');

      expect(result).toBeNull();
    });
  });
});

import {
  BetterAuthContext,
  requireAuth,
  requireOrganizationMembership,
} from '../../middleware/better-auth-middleware.js';
import { prisma } from '../../lib/prisma.js';
import { nanoid } from 'nanoid';
import { auth } from '../../lib/better-auth.js';
import { fromNodeHeaders } from 'better-auth/node';
import { GraphQLError } from 'graphql';

export const betterAuthResolvers = {
  User: {
    organizations: async (user: any) => {
      // Get user's organizations through Prisma
      const memberships = await prisma.member.findMany({
        where: { userId: user.id },
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

      return memberships.map((membership: any) => membership.organization);
    },
  },

  Query: {
    me: async (_: any, __: any, context: { auth: BetterAuthContext }) => {
      requireAuth(context.auth);
      return context.auth.user;
    },

    activeOrganization: async (
      _: any,
      __: any,
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);

      if (!context.auth.session?.activeOrganizationId) {
        return null;
      }

      try {
        // 🔒 SECURITY FIX: Verify user is actually a member of the active organization
        // This prevents returning organization data if session was compromised
        await requireOrganizationMembership(
          context.auth,
          context.auth.session.activeOrganizationId
        );

        // User is verified member - return full organization with members
        const organization = await prisma.organization.findUnique({
          where: { id: context.auth.session.activeOrganizationId },
          include: {
            members: {
              include: {
                user: true,
              },
            },
          },
        });

        // If organization not found, return null
        if (!organization) {
          return null;
        }

        return organization;
      } catch (error: any) {
        // If user is not a member of the organization, return null instead of throwing
        // This allows the frontend to handle the case gracefully
        if (error.message.includes('Access denied') || error.message.includes('not a member')) {
          return null;
        }
        // Re-throw other errors (like authentication errors)
        throw error;
      }
    },
  },

  Mutation: {
    createOrganization: async (
      _: any,
      { name }: { name: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);

      const organizationId = nanoid();
      const memberId = nanoid();

      // Create organization first
      const organization = await prisma.organization.create({
        data: {
          id: organizationId,
          name,
          slug: name
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, ''),
          logo: null,
        },
      });

      // Create membership separately
      await prisma.member.create({
        data: {
          id: memberId,
          organizationId: organization.id,
          userId: context.auth.user!.id,
          role: 'companyOwner',
        },
      });

      return await prisma.organization.findUnique({
        where: { id: organization.id },
        include: {
          members: {
            include: {
              user: true,
            },
          },
        },
      });
    },

    setActiveOrganization: async (
      _: any,
      { organizationId }: { organizationId: string },
      context: { auth: BetterAuthContext; req: any }
    ) => {
      // 🔒 SECURITY FIX: Use centralized middleware to verify organization membership
      await requireOrganizationMembership(context.auth, organizationId);

      // User is verified member - return full organization with members
      // (maintaining compatibility with existing GraphQL schema expectations)
      return await prisma.organization.findUnique({
        where: { id: organizationId },
        include: {
          members: {
            include: {
              user: true,
            },
          },
        },
      });
    },
  },
};

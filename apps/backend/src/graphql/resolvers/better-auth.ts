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
  Query: {
    me: async (_: any, __: any, context: { auth: BetterAuthContext }) => {
      requireAuth(context.auth);
      return context.auth.user;
    },

    myOrganizations: async (
      _: any,
      __: any,
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);

      // Get user's organizations through Prisma since Better Auth API might not have the exact method
      const memberships = await prisma.member.findMany({
        where: { userId: context.auth.user!.id },
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

    activeOrganization: async (
      _: any,
      __: any,
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);

      if (!context.auth.session?.activeOrganizationId) {
        return null;
      }

      // 🔒 SECURITY FIX: Verify user is actually a member of the active organization
      // This prevents returning organization data if session was compromised
      const membership = await requireOrganizationMembership(
        context.auth,
        context.auth.session.activeOrganizationId
      );

      // Return organization from membership data to ensure it's properly verified
      return membership.organization;
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

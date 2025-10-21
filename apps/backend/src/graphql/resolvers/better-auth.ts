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
import {
  createChargebeeCustomer,
  createFreeSubscription,
} from '../../services/chargebeeService.js';

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

      // Check if user already belongs to an organization (single organization rule)
      const existingMembership = await prisma.member.findFirst({
        where: { userId: context.auth.user!.id },
      });

      if (existingMembership) {
        throw new GraphQLError('User can only belong to one organization. You are already a member of an organization.');
      }

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
          role: 'owner',
        },
      });

      // Auto-create free subscription for new organization
      try {
        console.log('[Organization] Creating Chargebee customer and free subscription...');

        const customerId = await createChargebeeCustomer(
          organization.id,
          organization.name,
          context.auth.user!.email
        );

        await createFreeSubscription(organization.id, customerId);

        console.log(`[Organization] ✅ Created free subscription for "${organization.name}"`);
      } catch (error: any) {
        console.error('[Organization] ⚠️  Failed to create subscription:', error.message);
        // Don't throw - organization is already created
        // User can still use the system, admin can manually fix subscription later
        // This prevents organization creation from failing due to Chargebee issues
      }

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
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);

      // Verify user is a member of the requested organization
      const membership = await requireOrganizationMembership(context.auth, organizationId);

      // Update user's session to set the active organization
      // For now, we'll just return the organization as the session update
      // would typically be handled by better-auth's session management
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        include: {
          members: {
            include: {
              user: true,
            },
          },
        },
      });

      if (!organization) {
        throw new GraphQLError('Organization not found');
      }

      return organization;
    },

  },
};

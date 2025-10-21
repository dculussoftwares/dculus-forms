import { prisma } from '../../lib/prisma.js';
import type { Subscription as PrismaSubscription } from '@prisma/client';
import {
  createCheckoutHostedPage,
  createPortalSession,
  getAvailablePlans,
} from '../../services/chargebeeService.js';
import { requireAuth, type BetterAuthContext } from '../../middleware/better-auth-middleware.js';
import { GraphQLError } from 'graphql';

/**
 * Subscription GraphQL Resolvers
 * Handles subscription data for organizations
 */

export const subscriptionResolvers = {
  Query: {
    /**
     * Get available subscription plans with pricing
     */
    availablePlans: () => {
      return getAvailablePlans();
    },
  },

  Mutation: {
    /**
     * Create a Chargebee checkout session
     * Returns a hosted page URL for the user to complete payment
     */
    createCheckoutSession: async (
      _: any,
      { itemPriceId }: { itemPriceId: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);

      // Get active organization
      const session = context.auth.session;
      if (!session?.activeOrganizationId) {
        throw new GraphQLError('No active organization');
      }

      // Get subscription to find Chargebee customer ID
      const subscription = await prisma.subscription.findUnique({
        where: { organizationId: session.activeOrganizationId },
      });

      if (!subscription) {
        throw new GraphQLError('No subscription found for organization');
      }

      try {
        const result = await createCheckoutHostedPage(
          subscription.chargebeeCustomerId,
          itemPriceId
        );

        return {
          url: result.url,
          hostedPageId: result.id,
        };
      } catch (error: any) {
        console.error('[Subscription Resolver] Error creating checkout session:', error);
        throw new GraphQLError(`Failed to create checkout session: ${error.message}`);
      }
    },

    /**
     * Create a Chargebee portal session
     * Returns a portal URL for the user to manage their subscription
     */
    createPortalSession: async (
      _: any,
      __: any,
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);

      // Get active organization
      const session = context.auth.session;
      if (!session?.activeOrganizationId) {
        throw new GraphQLError('No active organization');
      }

      // Get subscription to find Chargebee customer ID
      const subscription = await prisma.subscription.findUnique({
        where: { organizationId: session.activeOrganizationId },
      });

      if (!subscription) {
        throw new GraphQLError('No subscription found for organization');
      }

      try {
        const url = await createPortalSession(subscription.chargebeeCustomerId);

        return { url };
      } catch (error: any) {
        console.error('[Subscription Resolver] Error creating portal session:', error);
        throw new GraphQLError(`Failed to create portal session: ${error.message}`);
      }
    },
  },
  Organization: {
    /**
     * Fetch subscription for an organization
     */
    subscription: async (organization: any) => {
      const subscription = await prisma.subscription.findUnique({
        where: { organizationId: organization.id },
      });

      return subscription;
    },
  },

  Subscription: {
    /**
     * Resolve organization relation
     */
    organization: async (subscription: PrismaSubscription) => {
      return await prisma.organization.findUnique({
        where: { id: subscription.organizationId },
      });
    },

    /**
     * Calculate usage information with percentages and exceeded status
     */
    usage: (subscription: PrismaSubscription) => {
      // Calculate views usage
      const viewsInfo = {
        used: subscription.viewsUsed,
        limit: subscription.viewsLimit,
        unlimited: subscription.viewsLimit === null,
        percentage:
          subscription.viewsLimit !== null
            ? (subscription.viewsUsed / subscription.viewsLimit) * 100
            : null,
        exceeded:
          subscription.viewsLimit !== null &&
          subscription.viewsUsed >= subscription.viewsLimit,
      };

      // Calculate submissions usage
      const submissionsInfo = {
        used: subscription.submissionsUsed,
        limit: subscription.submissionsLimit,
        unlimited: subscription.submissionsLimit === null,
        percentage:
          subscription.submissionsLimit !== null
            ? (subscription.submissionsUsed / subscription.submissionsLimit) * 100
            : null,
        exceeded:
          subscription.submissionsLimit !== null &&
          subscription.submissionsUsed >= subscription.submissionsLimit,
      };

      return {
        views: viewsInfo,
        submissions: submissionsInfo,
      };
    },
  },
};

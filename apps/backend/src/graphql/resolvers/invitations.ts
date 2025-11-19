import { GraphQLError } from '#graphql-errors';
import { prisma } from '../../lib/prisma.js';
import { isDateExpired } from '../../utils/dateHelpers.js';
import { logger } from '../../lib/logger.js';

export const invitationResolvers = {
  Query: {
    // Public resolver that doesn't require authentication
    getInvitationPublic: async (_: any, { id }: { id: string }) => {
      try {
        if (!id) {
          throw new GraphQLError('Invitation ID is required');
        }

        // Find invitation with related data
        const invitation = await prisma.invitation.findUnique({
          where: { id },
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            inviter: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        });

        if (!invitation) {
          throw new GraphQLError('Invitation not found');
        }

        // Check if invitation is expired
        const isExpired = isDateExpired(invitation.expiresAt.toISOString());
        
        // Check if invitation is already accepted or cancelled
        if (invitation.status !== 'pending') {
          throw new GraphQLError(`Invitation has already been ${invitation.status}`);
        }

        if (isExpired) {
          throw new GraphQLError('Invitation has expired');
        }

        // Return only safe, public information
        return {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          status: invitation.status,
          expiresAt: invitation.expiresAt.toISOString(),
          createdAt: invitation.createdAt.toISOString(),
          organization: invitation.organization ? {
            id: invitation.organization.id,
            name: invitation.organization.name,
            slug: invitation.organization.slug,
          } : null,
          inviter: invitation.inviter ? {
            id: invitation.inviter.id,
            name: invitation.inviter.name,
            email: invitation.inviter.email,
          } : null,
        };
      } catch (error) {
        logger.error('Error fetching invitation:', error);
        
        // Re-throw GraphQLError as is
        if (error instanceof GraphQLError) {
          throw error;
        }
        
        // Convert other errors to GraphQLError
        throw new GraphQLError('Failed to fetch invitation');
      }
    },
  },
};

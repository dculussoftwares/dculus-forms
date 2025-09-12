import { prisma } from '../../lib/prisma.js';
import { GraphQLError } from 'graphql';

export const invitationsResolvers = {
  Query: {
    // Public query - no authentication required
    invitation: async (_: any, { id }: { id: string }) => {
      try {
        const invitation = await prisma.invitation.findUnique({
          where: { id },
          include: {
            organization: {
              select: { name: true }
            },
            inviter: {
              select: { name: true }
            }
          }
        });

        if (!invitation) {
          throw new GraphQLError('Invitation not found', {
            extensions: { code: 'INVITATION_NOT_FOUND' }
          });
        }

        // Check if invitation is expired
        if (new Date() > invitation.expiresAt) {
          throw new GraphQLError('Invitation has expired', {
            extensions: { code: 'INVITATION_EXPIRED' }
          });
        }

        // Check if invitation is already accepted or rejected
        if (invitation.status !== 'pending') {
          throw new GraphQLError(`Invitation has already been ${invitation.status}`, {
            extensions: { code: 'INVITATION_NOT_PENDING' }
          });
        }

        return {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          status: invitation.status,
          expiresAt: invitation.expiresAt.toISOString(),
          organizationName: invitation.organization.name,
          inviterName: invitation.inviter.name,
        };
      } catch (error) {
        if (error instanceof GraphQLError) {
          throw error;
        }
        console.error('Error fetching invitation:', error);
        throw new GraphQLError('Failed to fetch invitation', {
          extensions: { code: 'INTERNAL_ERROR' }
        });
      }
    },
  },
};
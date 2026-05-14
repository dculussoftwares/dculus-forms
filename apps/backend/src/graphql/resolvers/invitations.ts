import { createGraphQLError, GraphQLError } from '#graphql-errors';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import { prisma } from '../../lib/prisma.js';
import { isDateExpired } from '../../utils/dateHelpers.js';
import { logger } from '../../lib/logger.js';

// Rejects obviously invalid IDs before hitting the DB (reduces enumeration surface)
const INVITATION_ID_RE = /^[a-zA-Z0-9_-]{8,128}$/;

export const invitationResolvers = {
  Query: {
    getInvitationPublic: async (_: any, { id }: { id: string }) => {
      try {
        if (!id || !INVITATION_ID_RE.test(id)) {
          throw createGraphQLError('Invalid invitation ID', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
        }

        const invitation = await prisma.invitation.findUnique({
          where: { id },
          include: {
            organization: { select: { id: true, name: true, slug: true } },
            inviter:      { select: { id: true, name: true, email: true } },
          },
        });

        if (!invitation) {
          throw createGraphQLError('Invitation not found or has expired', GRAPHQL_ERROR_CODES.NOT_FOUND);
        }

        if (invitation.status !== 'pending') {
          throw createGraphQLError('Invitation is no longer valid', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
        }

        if (isDateExpired(invitation.expiresAt.toISOString())) {
          throw createGraphQLError('Invitation not found or has expired', GRAPHQL_ERROR_CODES.NOT_FOUND);
        }

        return {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          status: invitation.status,
          expiresAt: invitation.expiresAt.toISOString(),
          createdAt: invitation.createdAt.toISOString(),
          organization: invitation.organization
            ? { id: invitation.organization.id, name: invitation.organization.name, slug: invitation.organization.slug }
            : null,
          inviter: invitation.inviter
            ? { id: invitation.inviter.id, name: invitation.inviter.name, email: invitation.inviter.email }
            : null,
        };
      } catch (error) {
        logger.error('Error fetching invitation:', error);
        if (error instanceof GraphQLError) throw error;
        throw createGraphQLError('Failed to fetch invitation', GRAPHQL_ERROR_CODES.INTERNAL_SERVER_ERROR);
      }
    },
  },
};

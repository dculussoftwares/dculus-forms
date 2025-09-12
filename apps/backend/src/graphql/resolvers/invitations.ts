import { GraphQLError } from 'graphql';
import { nanoid } from 'nanoid';
import { BetterAuthContext, requireAuth } from '../../middleware/better-auth-middleware.js';
import { prisma } from '../../lib/prisma.js';
import { sendInvitationEmail } from '../../services/emailService.js';

export interface InviteUserInput {
  organizationId: string;
  email: string;
  role: string;
}

export const invitationResolvers = {
  Query: {
    organizationInvitations: async (
      _: any,
      { organizationId }: { organizationId: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);

      // Check if user is a member of the organization
      const membership = await prisma.member.findFirst({
        where: {
          userId: context.auth.user!.id,
          organizationId,
        },
      });

      if (!membership) {
        throw new GraphQLError('You are not a member of this organization');
      }

      // Only organization owners can view invitations
      if (membership.role !== 'companyOwner') {
        throw new GraphQLError('Only organization owners can view invitations');
      }

      return await prisma.invitation.findMany({
        where: {
          organizationId,
          status: 'pending', // Only show pending invitations
        },
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
          inviter: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    },

    invitation: async (
      _: any,
      { id }: { id: string },
      context: { auth: BetterAuthContext }
    ) => {
      // This query allows unauthenticated access for invitation acceptance flow
      const invitation = await prisma.invitation.findUnique({
        where: { id },
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
          inviter: true,
        },
      });

      if (!invitation) {
        throw new GraphQLError('Invitation not found');
      }

      // Check if invitation is expired
      if (new Date() > invitation.expiresAt) {
        throw new GraphQLError('This invitation has expired');
      }

      // Check if invitation is still pending
      if (invitation.status !== 'pending') {
        throw new GraphQLError('This invitation is no longer valid');
      }

      return invitation;
    },
  },

  Mutation: {
    inviteUser: async (
      _: any,
      { input }: { input: InviteUserInput },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);

      const { organizationId, email, role } = input;

      // Validate role
      if (!['companyMember', 'companyOwner'].includes(role)) {
        throw new GraphQLError('Invalid role. Must be companyMember or companyOwner');
      }

      // Check if user is a member of the organization
      const membership = await prisma.member.findFirst({
        where: {
          userId: context.auth.user!.id,
          organizationId,
        },
      });

      if (!membership) {
        throw new GraphQLError('You are not a member of this organization');
      }

      // Only organization owners can invite users
      if (membership.role !== 'companyOwner') {
        throw new GraphQLError('Only organization owners can invite users');
      }

      // Check if user is already a member of the organization
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        const existingMembership = await prisma.member.findFirst({
          where: {
            userId: existingUser.id,
            organizationId,
          },
        });

        if (existingMembership) {
          throw new GraphQLError('This user is already a member of the organization');
        }
      }

      // Check for existing pending invitation
      const existingInvitation = await prisma.invitation.findFirst({
        where: {
          email,
          organizationId,
          status: 'pending',
        },
      });

      if (existingInvitation) {
        throw new GraphQLError('There is already a pending invitation for this email');
      }

      // Get organization details for email
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
      });

      if (!organization) {
        throw new GraphQLError('Organization not found');
      }

      // Create invitation
      const invitationId = nanoid();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 2); // 2 days from now

      const invitation = await prisma.invitation.create({
        data: {
          id: invitationId,
          organizationId,
          email,
          role,
          status: 'pending',
          inviterId: context.auth.user!.id,
          expiresAt,
        },
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
          inviter: true,
        },
      });

      // Send invitation email
      try {
        await sendInvitationEmail({
          to: email,
          invitationId: invitation.id,
          organizationName: organization.name,
          inviterName: context.auth.user!.name,
        });
      } catch (error) {
        console.error('Failed to send invitation email:', error);
        // Don't throw error here - invitation is still created
      }

      return invitation;
    },

    acceptInvitation: async (
      _: any,
      { invitationId }: { invitationId: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);

      const invitation = await prisma.invitation.findUnique({
        where: { id: invitationId },
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
          inviter: true,
        },
      });

      if (!invitation) {
        throw new GraphQLError('Invitation not found');
      }

      // Check if invitation is expired
      if (new Date() > invitation.expiresAt) {
        throw new GraphQLError('This invitation has expired');
      }

      // Check if invitation is still pending
      if (invitation.status !== 'pending') {
        throw new GraphQLError('This invitation is no longer valid');
      }

      // Check if the user's email matches the invitation
      if (context.auth.user!.email !== invitation.email) {
        throw new GraphQLError('You can only accept invitations sent to your email address');
      }

      // Check if user is already a member
      const existingMembership = await prisma.member.findFirst({
        where: {
          userId: context.auth.user!.id,
          organizationId: invitation.organizationId,
        },
      });

      if (existingMembership) {
        throw new GraphQLError('You are already a member of this organization');
      }

      // Create membership and update invitation status in a transaction
      await prisma.$transaction(async (tx) => {
        // Create membership
        await tx.member.create({
          data: {
            id: nanoid(),
            organizationId: invitation.organizationId,
            userId: context.auth.user!.id,
            role: invitation.role,
          },
        });

        // Update invitation status
        await tx.invitation.update({
          where: { id: invitationId },
          data: { status: 'accepted' },
        });
      });

      // Return updated invitation
      return await prisma.invitation.findUnique({
        where: { id: invitationId },
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
          inviter: true,
        },
      });
    },

    rejectInvitation: async (
      _: any,
      { invitationId }: { invitationId: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);

      const invitation = await prisma.invitation.findUnique({
        where: { id: invitationId },
      });

      if (!invitation) {
        throw new GraphQLError('Invitation not found');
      }

      // Check if invitation is expired
      if (new Date() > invitation.expiresAt) {
        throw new GraphQLError('This invitation has expired');
      }

      // Check if invitation is still pending
      if (invitation.status !== 'pending') {
        throw new GraphQLError('This invitation is no longer valid');
      }

      // Check if the user's email matches the invitation
      if (context.auth.user!.email !== invitation.email) {
        throw new GraphQLError('You can only reject invitations sent to your email address');
      }

      // Update invitation status
      const updatedInvitation = await prisma.invitation.update({
        where: { id: invitationId },
        data: { status: 'rejected' },
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
          inviter: true,
        },
      });

      return updatedInvitation;
    },

    cancelInvitation: async (
      _: any,
      { invitationId }: { invitationId: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);

      const invitation = await prisma.invitation.findUnique({
        where: { id: invitationId },
        include: {
          organization: true,
        },
      });

      if (!invitation) {
        throw new GraphQLError('Invitation not found');
      }

      // Check if user is a member of the organization
      const membership = await prisma.member.findFirst({
        where: {
          userId: context.auth.user!.id,
          organizationId: invitation.organizationId,
        },
      });

      if (!membership) {
        throw new GraphQLError('You are not a member of this organization');
      }

      // Only organization owners and the inviter can cancel invitations
      if (membership.role !== 'companyOwner' && invitation.inviterId !== context.auth.user!.id) {
        throw new GraphQLError('Only organization owners or the inviter can cancel invitations');
      }

      // Check if invitation is still pending
      if (invitation.status !== 'pending') {
        throw new GraphQLError('Only pending invitations can be cancelled');
      }

      // Update invitation status
      const updatedInvitation = await prisma.invitation.update({
        where: { id: invitationId },
        data: { status: 'cancelled' },
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
          inviter: true,
        },
      });

      return updatedInvitation;
    },
  },
};
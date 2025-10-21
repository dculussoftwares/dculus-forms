import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { organization, bearer, admin, emailOTP } from 'better-auth/plugins';
import { prisma } from './prisma.js';
import { authConfig } from './env.js';
import { sendOTPEmail, sendResetPasswordEmail, sendInvitationEmail } from '../services/emailService.js';
import { createChargebeeCustomer, createFreeSubscription } from '../services/chargebeeService.js';

export const auth: ReturnType<typeof betterAuth> = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'mongodb',
  }),

  baseURL: authConfig.baseUrl,
  secret: authConfig.secret,
  trustedOrigins: [
    'http://localhost:3000', // Form app
    'http://localhost:3001', // Form viewer
    'http://localhost:3002', // Admin app
    'http://localhost:4000', // Backend (for GraphQL playground)
    'http://localhost:5173', // Form viewer (Vite dev server)
  ],

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // For development
    sendResetPassword: async ({ user, url }, request) => {
      await sendResetPasswordEmail({
        to: user.email,
        resetUrl: url,
        expiresInHours: 1,
      });
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 24 hours
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60 * 24 * 7, // 7 days
    },
  },

  plugins: [
    bearer(),
    organization({
      allowUserToCreateOrganization: true,
      organizationLimit: 1, // Restrict users to only one organization
      creatorRole: 'owner',
      membershipLimit: 100,
      sendInvitationEmail: async ({ email, invitation, organization, inviter }) => {
        await sendInvitationEmail({
          to: email,
          invitationId: invitation.id,
          organizationName: organization.name,
          inviterName: inviter.user.name,
        });
      },
      invitationExpiresIn: 60 * 60 * 24 * 2, // 2 days
    }),
    admin({
      defaultRole: 'user',
      adminRoles: ['admin', 'superAdmin'],
    }),
    emailOTP({
      otpLength: 6,
      expiresIn: 5 * 60, // 5 minutes
      allowedAttempts: 3,
      async sendVerificationOTP({ email, otp, type }) {
        await sendOTPEmail({
          to: email,
          otp,
          type,
        });
      },
    }),
  ],

  // CORS configuration for development
  advanced: {
    crossSubDomainCookies: {
      enabled: false,
    },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          console.log('Creating session for user:', session.userId);

          const member = await prisma.member.findFirst({
            where: {
              userId: session.userId,
            },
          });

          console.log('Member found:', member?.id || 'none');

          return {
            data: {
              ...session,
              activeOrganizationId: member?.organizationId || null,
            },
          };
        },
      },
    },
    member: {
      create: {
        before: async (member: any) => {
          console.log('Creating member for user:', member.userId);

          // Check if user already belongs to an organization (single organization rule)
          const existingMembership = await prisma.member.findFirst({
            where: { userId: member.userId },
          });

          if (existingMembership) {
            const { APIError } = await import('better-auth/api');
            throw new APIError('BAD_REQUEST', {
              message: 'User can only belong to one organization. You are already a member of an organization.',
            });
          }

          return { data: member };
        },
      },
    },
    organization: {
      create: {
        after: async (organization: any) => {
          // Auto-create free subscription for new organization
          try {
            console.log('[Organization Hook] Creating Chargebee customer and free subscription...');

            // Get the user who created the organization (owner)
            const owner = await prisma.member.findFirst({
              where: {
                organizationId: organization.id,
                role: 'owner',
              },
              include: {
                user: true,
              },
            });

            if (!owner) {
              console.error('[Organization Hook] ⚠️  Could not find owner for organization:', organization.id);
              return;
            }

            const customerId = await createChargebeeCustomer(
              organization.id,
              organization.name,
              owner.user.email
            );

            await createFreeSubscription(organization.id, customerId);

            console.log(`[Organization Hook] ✅ Created free subscription for "${organization.name}"`);
          } catch (error: any) {
            console.error('[Organization Hook] ⚠️  Failed to create subscription:', error.message);
            // Don't throw - organization is already created
            // User can still use the system, admin can manually fix subscription later
          }
        },
      },
    },
  },
});

// Types will be inferred from API responses
export type BetterAuthUser = {
  id: string;
  name: string;
  email: string;
  role?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type BetterAuthSession = {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { admin, bearer, emailOTP, organization } from 'better-auth/plugins';
import { prisma } from './prisma.js';
import { authConfig } from './env.js';
import { logger } from '../lib/logger.js';
import {
  sendInvitationEmail,
  sendOTPEmail,
  sendResetPasswordEmail,
} from '../services/emailService.js';

// Parse trusted origins from environment variable, with fallback to localhost
const getTrustedOrigins = (): string[] => {
  const corsOrigins = process.env.CORS_ORIGINS?.split(',').map(origin => origin.trim()) || [];

  // Default localhost origins for development
  const defaultOrigins = [
    'http://localhost:3000', // Form app
    'http://localhost:3001', // Form viewer
    'http://localhost:3002', // Admin app
    'http://localhost:4000', // Backend (for GraphQL playground)
    'http://localhost:5173', // Form viewer (Vite dev server),
    'http://localhost:4173', // Form App (Prod)
    'http://localhost:4174', // Form Viewer (Prod)
    'http://localhost:4175', // Admin App (Prod)
  ];

  // Combine environment-specific origins with defaults (removing duplicates)
  const allOrigins = [...new Set([...corsOrigins, ...defaultOrigins])];

  logger.info('🔐 Better Auth trusted origins:', allOrigins);

  return allOrigins;
};

export const auth: ReturnType<typeof betterAuth> = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),

  baseURL: authConfig.baseUrl,
  secret: authConfig.secret,
  trustedOrigins: getTrustedOrigins(),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // For development
    sendResetPassword: async ({ user, url }, _request) => {
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
      organizationLimit: process.env.NODE_ENV === 'test' ? 100 : 1, // Allow multiple orgs in test environment
      creatorRole: 'owner',
      membershipLimit: 100,
      sendInvitationEmail: async ({
        email,
        invitation,
        organization,
        inviter,
      }) => {
        await sendInvitationEmail({
          to: email,
          invitationId: invitation.id,
          organizationName: organization.name,
          inviterName: inviter.user.name,
        });
      },
      invitationExpiresIn: 60 * 60 * 24 * 2, // 2 days
      organizationHooks: {
        afterCreateOrganization: async ({ organization, user }: any) => {
          // Update active sessions with the new organizationId
          try {
            await prisma.session.updateMany({
              where: {
                userId: user.id,
                expiresAt: { gt: new Date() },
              },
              data: {
                activeOrganizationId: organization.id,
              },
            });
          } catch (error) {
            logger.error('Error updating sessions with organizationId:', error);
          }
        },
      },
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
          logger.info('Creating session for user:', session.userId);

          const member = await prisma.member.findFirst({
            where: {
              userId: session.userId,
            },
          });

          logger.info('Member found:', member?.id || 'none');

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
          logger.info('Creating member for user:', member.userId);

          // Check if user already belongs to an organization (single organization rule)
          const existingMembership = await prisma.member.findFirst({
            where: { userId: member.userId },
          });

          if (existingMembership) {
            const { APIError } = await import('better-auth/api');
            throw new APIError('BAD_REQUEST', {
              message:
                'User can only belong to one organization. You are already a member of an organization.',
            });
          }

          return { data: member };
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

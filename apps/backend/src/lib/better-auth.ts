import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { organization, bearer, admin, emailOTP } from 'better-auth/plugins';
import { prisma } from './prisma.js';
import { authConfig } from './env.js';
import { sendOTPEmail, sendResetPasswordEmail, sendInvitationEmail } from '../services/emailService.js';

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
      organizationLimit: 5,
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

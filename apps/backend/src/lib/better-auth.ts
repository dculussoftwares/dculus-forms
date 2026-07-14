import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { admin, bearer, emailOTP, haveIBeenPwned, magicLink, oneTimeToken, organization } from 'better-auth/plugins';
import { adminAc } from 'better-auth/plugins/admin/access';
import { prisma } from './prisma.js';
import { authConfig, googleConfig } from './env.js';
import { logger } from '../lib/logger.js';
import {
  sendInvitationEmail,
  sendMagicLinkEmail,
  sendOTPEmail,
  sendResetPasswordEmail,
} from '../services/emailService.js';

export const DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:4000',
  'http://localhost:4173',
  'http://localhost:4174',
  'http://localhost:4175',
  'http://localhost:5173',
];

const getTrustedOrigins = (): string[] => {
  const corsOrigins = process.env.CORS_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean) ?? [];
  const isProduction = process.env.NODE_ENV === 'production';
  const allOrigins = [...new Set([...corsOrigins, ...(isProduction ? [] : DEV_ORIGINS)])];
  logger.info('🔐 Better Auth trusted origins:', allOrigins);
  return allOrigins;
};

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),

  baseURL: authConfig.baseUrl,
  secret: authConfig.secret,
  trustedOrigins: getTrustedOrigins(),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: process.env.NODE_ENV !== 'test', // Skip verification in test environment
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

  ...(googleConfig.clientId && googleConfig.clientSecret
    ? {
        socialProviders: {
          google: {
            clientId: googleConfig.clientId,
            clientSecret: googleConfig.clientSecret,
          },
        },
      }
    : {}),

  plugins: [
    bearer(),
    // Bridges form-viewer's respondent sign-in across sites: the
    // /respondent-oauth-callback route (see index.ts) generates a token here
    // server-side, right after the OAuth callback sets its own-domain cookie,
    // and hands it to form-viewer via a redirect query param.
    oneTimeToken(),
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
      roles: {
        admin: adminAc,
        superAdmin: adminAc, // superAdmin inherits full admin permissions
      },
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
    ...(process.env.NODE_ENV !== 'test' ? [haveIBeenPwned({
      customPasswordCompromisedMessage:
        'This password has appeared in a data breach. Please choose a different password to keep your account secure.',
    })] : []),
    magicLink({
      expiresIn: 5 * 60, // 5 minutes
      disableSignUp: true, // New users must go through /signup to create an org + billing
      async sendMagicLink({ email, token }) {
        // Point the email link at the frontend callback page with the token.
        // The frontend will call magicLink.verify() as a JSON fetch (no redirect),
        // which lets the bearer plugin return set-auth-token in the response body
        // so sessionStorage can store it — the redirect-based backend flow loses
        // the header before the frontend ever sees it.
        const formAppUrl = process.env.FORM_APP_URL || 'http://localhost:3000';
        const magicLinkUrl = `${formAppUrl}/magic-link/verify?token=${token}`;
        await sendMagicLinkEmail({ to: email, url: magicLinkUrl });
      },
    }),
  ],

  // CORS configuration for development
  // P2-10: Explicit cookie security flags — httpOnly prevents XSS access,
  // secure ensures cookies are only sent over HTTPS in production, and
  // sameSite=lax guards against CSRF while allowing top-level navigations.
  advanced: {
    crossSubDomainCookies: {
      enabled: false,
    },
    cookies: {
      session_token: {
        attributes: {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax' as const,
        },
      },
    },
  },
  databaseHooks: {
    user: {
      delete: {
        // P2-09: GDPR compliance — null out PII in edit history when a user is
        // deleted so personal data (IP address, user agent) is no longer retained
        // in the audit trail after account removal.
        after: async (user) => {
          try {
            await prisma.responseEditHistory.updateMany({
              where: { editedById: user.id },
              data: { ipAddress: null, userAgent: null },
            });
            logger.info(`Nulled out PII in edit history for deleted user: ${user.id}`);
          } catch (error) {
            logger.error(`Failed to null PII in edit history for user ${user.id}:`, error);
          }
        },
      },
    },
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

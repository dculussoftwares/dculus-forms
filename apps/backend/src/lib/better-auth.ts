import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { createAuthMiddleware, getSessionFromCtx, isAPIError } from 'better-auth/api';
import { admin, bearer, emailOTP, haveIBeenPwned, magicLink, oneTimeToken, organization } from 'better-auth/plugins';
import { prisma } from './prisma.js';
import { authConfig, googleConfig, proxyConfig } from './env.js';
import { authAdminRoles, authRateLimitRules } from './authAccess.js';
import { logger } from '../lib/logger.js';
import { audit } from './audit.js';
import { buildAuthAuditEvent, isAuditedAuthPath } from './authAudit.js';
import { assertUserOwnsNoForms } from './userDeletionGuard.js';
import { anonymizeUserData } from './userDataErasure.js';
import { checkInvitationEmailLimit, recordInvitationEmail } from './invitationRateLimit.js';
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
    // A stolen session must not survive the owner resetting their password.
    revokeSessionsOnPasswordReset: true,
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
    // Keep this short: while the signed cookie cache is valid, revocations,
    // bans and role changes are not seen (the database is skipped).
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },

  account: {
    // Social-login access/refresh tokens are encrypted with the auth secret.
    // Rows stored before this was enabled are still read as-is.
    encryptOAuthTokens: true,
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
      // Deleting an organization cascades every form, response and subscription row
      // while billing keeps running and nothing is audited. No client uses the
      // endpoint, so it stays off until an audited, billing-aware flow exists.
      disableOrganizationDeletion: true,
      organizationLimit: process.env.NODE_ENV === 'test' ? 100 : 1, // Allow multiple orgs in test environment
      creatorRole: 'owner',
      membershipLimit: 100,
      // Pending invitations per organization (library default is 100).
      invitationLimit: 50,
      sendInvitationEmail: async ({
        email,
        invitation,
        organization,
        inviter,
      }) => {
        // S24-04: cooldown and caps so the invite endpoint cannot be used as a mail relay. better-auth
        // swallows errors thrown here, so an exceeded limit silently skips the email (resend path).
        const limitKey = {
          recipientEmail: email,
          organizationId: organization.id,
          inviterId: inviter.user.id,
        };
        const exceeded = checkInvitationEmailLimit(limitKey);
        if (exceeded) {
          logger.warn(`Invitation email suppressed (${exceeded}) for organization ${organization.id}`);
          return;
        }
        recordInvitationEmail(limitKey);
        await sendInvitationEmail({
          to: email,
          invitationId: invitation.id,
          organizationName: organization.name,
          inviterName: inviter.user.name,
        });
      },
      invitationExpiresIn: 60 * 60 * 24 * 2, // 2 days
      organizationHooks: {
        // Reject new invitations that exceed the abuse limits with a visible error.
        beforeCreateInvitation: async ({ invitation, organization }: any) => {
          const exceeded = checkInvitationEmailLimit({
            recipientEmail: invitation.email,
            organizationId: organization.id,
            inviterId: invitation.inviterId,
          });
          if (exceeded) {
            const { APIError } = await import('better-auth/api');
            throw new APIError('TOO_MANY_REQUESTS', {
              message: 'Too many invitations sent. Please try again later.',
            });
          }
        },
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
      // Only superAdmin may use set-role / set-password / ban / delete.
      roles: authAdminRoles,
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
  // Explicitly on outside test: better-auth otherwise only enables its limiter
  // when NODE_ENV === 'production', leaving dev/staging unthrottled.
  rateLimit: {
    enabled: process.env.NODE_ENV !== 'test',
    customRules: authRateLimitRules,
  },
  advanced: {
    // The client IP keys the rate limiter. Set AUTH_IP_ADDRESS_HEADERS to the
    // header the edge overwrites (e.g. cf-connecting-ip); otherwise the
    // leftmost, client-spoofable x-forwarded-for value is used.
    ...(proxyConfig.authIpAddressHeaders
      ? { ipAddress: { ipAddressHeaders: proxyConfig.authIpAddressHeaders } }
      : {}),
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
  hooks: {
    // S14-03: privileged admin/organization actions leave an audit trail. Failed
    // calls are skipped, and audit() is non-fatal so it never breaks the request.
    after: createAuthMiddleware(async (ctx) => {
      if (!isAuditedAuthPath(ctx.path)) return;
      const returned = ctx.context.returned as { user?: { id?: string } } | undefined;
      if (returned instanceof Error || isAPIError(returned)) return;
      try {
        const session = ctx.context.session ?? (await getSessionFromCtx(ctx));
        const event = buildAuthAuditEvent(ctx.path, ctx.body, {
          actorId: session?.user?.id,
          sessionOrganizationId: (session?.session as { activeOrganizationId?: string | null } | undefined)
            ?.activeOrganizationId,
          returnedId: typeof returned?.user?.id === 'string' ? returned.user.id : undefined,
        });
        if (!event) return;
        await audit(
          event.action,
          event.resourceType,
          event.resourceId,
          session?.user?.id,
          event.metadata,
          event.organizationId
        );
      } catch (error) {
        logger.warn('Auth audit hook failed (non-fatal):', error);
      }
    }),
  },
  databaseHooks: {
    user: {
      delete: {
        // S14-01: never let a user deletion take the user's forms (and every
        // response collected through them) with it.
        before: async (user) => {
          await assertUserOwnsNoForms(user.id);
          // S24-01: the SET NULL foreign keys fire at deletion, so identity must be detached first.
          await anonymizeUserData(user.id);
        },
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

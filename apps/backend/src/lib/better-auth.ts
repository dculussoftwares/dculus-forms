import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { organization, bearer, admin, emailOTP } from 'better-auth/plugins';
import { prisma } from './prisma.js';
import { authConfig } from './env.js';
import { sendOTPEmail, sendEmail } from '../services/emailService.js';

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
      await sendEmail({
        to: user.email,
        subject: '🔑 Reset your password - Dculus Forms',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reset Your Password</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc; }
              .container { background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); padding: 40px; }
              .header { text-align: center; margin-bottom: 30px; }
              .logo { font-size: 24px; font-weight: bold; color: #3b82f6; margin-bottom: 20px; }
              .title { font-size: 28px; font-weight: bold; color: #1f2937; margin-bottom: 10px; }
              .subtitle { font-size: 16px; color: #6b7280; margin-bottom: 30px; }
              .cta-button { display: inline-block; background-color: #3b82f6; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; margin: 20px 0; }
              .cta-button:hover { background-color: #2563eb; }
              .footer { text-align: center; margin-top: 40px; padding-top: 30px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="logo">🔐 Dculus Forms</div>
                <h1 class="title">Reset Your Password</h1>
                <p class="subtitle">Click the button below to reset your password</p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${url}" class="cta-button">Reset Password</a>
              </div>
              
              <p>If you didn't request a password reset, you can safely ignore this email. The reset link will expire in 1 hour.</p>
              
              <div class="footer">
                <p>This email was sent from Dculus Forms.</p>
                <p><a href="https://dculus.com" style="color: #3b82f6;">Visit Dculus</a></p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `Reset your password for Dculus Forms. Click this link: ${url}. If you didn't request this, ignore this email.`
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
      creatorRole: 'companyOwner',
      membershipLimit: 100,
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

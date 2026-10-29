import { Request } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../lib/better-auth.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import {
  GRAPHQL_ERROR_CODES,
  type GraphQLErrorCode,
} from '@dculus/types/graphql.js';
import { createGraphQLError } from '../lib/graphqlErrors.js';

export interface BetterAuthContext {
  user: any | null;
  session: any | null;
  isAuthenticated: boolean;
}

const PRIVILEGED_ROLES = ['admin', 'superAdmin'];

/**
 * Role and ban state come from better-auth's signed session cookie cache, which
 * can lag behind the database (demotions, bans, deletions). Privileged
 * (admin/superAdmin) sessions are therefore re-validated against the database
 * so system-role gates never trust a cached role.
 */
export async function resolveFreshUser(user: any): Promise<any | null> {
  if (!PRIVILEGED_ROLES.includes(user?.role)) {
    return user;
  }

  const fresh = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true, banned: true },
  });
  if (!fresh || fresh.banned) {
    return null;
  }
  return { ...user, role: fresh.role, banned: fresh.banned };
}

export async function createBetterAuthContext(req: Request): Promise<BetterAuthContext> {
  try {
    const sessionData = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    const freshUser = sessionData?.user ? await resolveFreshUser(sessionData.user) : null;
    if (sessionData?.user && !freshUser) {
      return { user: null, session: null, isAuthenticated: false };
    }

    // P3-08: Log user ID instead of email to avoid PII in log output
    logger.info('Auth context - User:', freshUser?.id || 'none', 'Role:', freshUser?.role || 'none');

    return {
      user: freshUser,
      session: sessionData?.session || null,
      isAuthenticated: !!freshUser,
    };
  } catch (error) {
    logger.error('Error getting session:', error);
    return {
      user: null,
      session: null,
      isAuthenticated: false,
    };
  }
}

export function requireAuth(context: BetterAuthContext) {
  if (!context.isAuthenticated || !context.user) {
    throwGraphQLAccessError(
      'Authentication required',
      GRAPHQL_ERROR_CODES.AUTHENTICATION_REQUIRED
    );
  }
  return context;
}

export function requireOrganization(context: BetterAuthContext) {
  requireAuth(context);
  if (!context.session?.activeOrganizationId) {
    throwGraphQLAccessError(
      'Active organization required',
      GRAPHQL_ERROR_CODES.BAD_USER_INPUT
    );
  }
  return context;
}

/**
 * Verify that a user is a member of a specific organization
 * Uses Prisma to check membership in alignment with better-auth data model
 */
const throwGraphQLAccessError = (
  message: string,
  code: GraphQLErrorCode
): never => {
  throw createGraphQLError(message, code);
};

export async function requireOrganizationMembership(
  context: BetterAuthContext,
  organizationId: string
): Promise<any> {
  requireAuth(context);

  // ⚡ PERFORMANCE: Select only the 'role' field - it's the only field used by callers
  // All other callers only use this function for membership validation (throw if null)
  const membership = await prisma.member.findFirst({
    where: {
      organizationId,
      userId: context.user!.id
    },
    select: {
      role: true  // Only field accessed by requireOrganizationRole()
    }
  });

  if (!membership) {
    throwGraphQLAccessError(
      'Access denied: You are not a member of this organization',
      GRAPHQL_ERROR_CODES.NO_ACCESS
    );
  }

  return membership;
}

/**
 * Verify that a user has a specific role within an organization
 */
export async function requireOrganizationRole(
  context: BetterAuthContext,
  organizationId: string,
  requiredRole: 'owner' | 'member'
): Promise<any> {
  const membership = await requireOrganizationMembership(context, organizationId);

  if (membership.role !== requiredRole) {
    throwGraphQLAccessError(
      `Access denied: ${requiredRole} role required for this operation`,
      GRAPHQL_ERROR_CODES.NO_ACCESS
    );
  }

  return membership;
}

/**
 * Check organization membership without throwing error
 * Returns membership object or null
 */
export async function checkOrganizationMembership(
  userId: string,
  organizationId: string
): Promise<any | null> {
  return await prisma.member.findFirst({
    where: {
      organizationId,
      userId
    },
    include: {
      organization: true,
      user: true
    }
  });
}

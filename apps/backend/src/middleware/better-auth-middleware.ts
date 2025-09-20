import { Request } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../lib/better-auth.js';
import { prisma } from '../lib/prisma.js';
import { GraphQLError } from 'graphql';

export interface BetterAuthContext {
  user: any | null;
  session: any | null;
  isAuthenticated: boolean;
}

export async function createBetterAuthContext(req: Request): Promise<BetterAuthContext> {
  try {
    const sessionData = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    console.log('Auth context - User:', sessionData?.user?.email || 'none', 'Role:', (sessionData?.user as any)?.role || 'none');

    return {
      user: sessionData?.user || null,
      session: sessionData?.session || null,
      isAuthenticated: !!sessionData?.user,
    };
  } catch (error) {
    console.error('Error getting session:', error);
    return {
      user: null,
      session: null,
      isAuthenticated: false,
    };
  }
}

export function requireAuth(context: BetterAuthContext) {
  if (!context.isAuthenticated || !context.user) {
    throw new Error('Authentication required');
  }
  return context;
}

export function requireOrganization(context: BetterAuthContext) {
  requireAuth(context);
  if (!context.session?.activeOrganizationId) {
    throw new Error('Active organization required');
  }
  return context;
}

/**
 * Verify that a user is a member of a specific organization
 * Uses Prisma to check membership in alignment with better-auth data model
 */
export async function requireOrganizationMembership(
  context: BetterAuthContext,
  organizationId: string
): Promise<any> {
  requireAuth(context);

  const membership = await prisma.member.findFirst({
    where: {
      organizationId,
      userId: context.user!.id
    },
    include: {
      organization: true,
      user: true
    }
  });

  if (!membership) {
    throw new GraphQLError('Access denied: You are not a member of this organization');
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
    throw new GraphQLError(`Access denied: ${requiredRole} role required for this operation`);
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

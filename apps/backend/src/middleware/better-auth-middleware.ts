import { Request } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../lib/better-auth.js';

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

    console.log('Auth context - User:', sessionData?.user?.email || 'none', 'Role:', sessionData?.user?.role || 'none');

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

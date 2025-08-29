import { GraphQLError } from 'graphql';

export interface AuthContext {
  user?: {
    id: string;
    role: 'user' | 'admin' | 'superAdmin';
    email: string;
    name?: string;
  };
}

/**
 * Helper function to check if user has admin privileges (system-level roles)
 */
export function requireAdminRole(context: AuthContext) {
  if (!context.user) {
    throw new GraphQLError('Authentication required');
  }

  const userRole = context.user.role;
  if (!userRole || (userRole !== 'admin' && userRole !== 'superAdmin')) {
    throw new GraphQLError('Admin privileges required');
  }

  return context.user;
}

/**
 * Helper function to check if user is authenticated (any role)
 */
export function requireAuthentication(context: AuthContext) {
  if (!context.user) {
    throw new GraphQLError('Authentication required');
  }

  return context.user;
}

/**
 * Helper function to check if user has super admin privileges
 */
export function requireSuperAdminRole(context: AuthContext) {
  if (!context.user) {
    throw new GraphQLError('Authentication required');
  }

  const userRole = context.user.role;
  if (!userRole || userRole !== 'superAdmin') {
    throw new GraphQLError('Super admin privileges required');
  }

  return context.user;
}

/**
 * Helper function to check if user has system-level roles (admin or superAdmin)
 * This is an alias for requireAdminRole for semantic clarity
 */
export function requireSystemLevelRole(context: AuthContext) {
  return requireAdminRole(context);
}
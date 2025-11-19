import {
  GRAPHQL_ERROR_CODES,
  type GraphQLErrorCode,
} from '@dculus/types/graphql.js';
import { createGraphQLError } from '../lib/graphqlErrors.js';

export interface AuthenticatedUser {
  id: string;
  role: 'user' | 'admin' | 'superAdmin';
  email: string;
  name?: string;
}

export interface AuthContext {
  user?: AuthenticatedUser;
}

/**
 * Helper function to check if user has admin privileges (system-level roles)
 */
const throwAuthError = (code: GraphQLErrorCode, message: string): never => {
  throw createGraphQLError(message, code);
};

export function requireAdminRole(context: AuthContext): AuthenticatedUser {
  if (!context.user) {
    throwAuthError(
      GRAPHQL_ERROR_CODES.AUTHENTICATION_REQUIRED,
      'Authentication required'
    );
  }

  const user = context.user!;
  const userRole = user.role;
  if (!userRole || (userRole !== 'admin' && userRole !== 'superAdmin')) {
    throwAuthError(GRAPHQL_ERROR_CODES.FORBIDDEN, 'Admin privileges required');
  }

  return user;
}

/**
 * Helper function to check if user is authenticated (any role)
 */
export function requireAuthentication(context: AuthContext): AuthenticatedUser {
  if (!context.user) {
    throwAuthError(
      GRAPHQL_ERROR_CODES.AUTHENTICATION_REQUIRED,
      'Authentication required'
    );
  }

  return context.user!;
}

/**
 * Helper function to check if user has super admin privileges
 */
export function requireSuperAdminRole(
  context: AuthContext
): AuthenticatedUser {
  if (!context.user) {
    throwAuthError(
      GRAPHQL_ERROR_CODES.AUTHENTICATION_REQUIRED,
      'Authentication required'
    );
  }

  const user = context.user!;
  const userRole = user.role;
  if (!userRole || userRole !== 'superAdmin') {
    throwAuthError(
      GRAPHQL_ERROR_CODES.FORBIDDEN,
      'Super admin privileges required'
    );
  }

  return user;
}

/**
 * Helper function to check if user has system-level roles (admin or superAdmin)
 * This is an alias for requireAdminRole for semantic clarity
 */
export function requireSystemLevelRole(context: AuthContext): AuthenticatedUser {
  return requireAdminRole(context);
}

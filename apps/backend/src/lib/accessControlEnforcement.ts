import type { AccessControlSettings } from '@dculus/types';
import { createGraphQLError } from '#graphql-errors';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import type { BetterAuthContext } from '../middleware/better-auth-middleware.js';

export type FormAccessStatus = 'OPEN' | 'SIGN_IN_REQUIRED' | 'DOMAIN_REJECTED';

function emailDomainAllowed(email: string, allowedDomains: string[]): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;
  return allowedDomains.some(allowed => allowed.toLowerCase() === domain);
}

/**
 * Pure decision function — no throw — so `formByShortUrl`'s field resolvers
 * can use it to decide what DATA to return (gate vs full form), not just
 * whether to error out. Shared with `enforceAccessControlForSubmission`
 * below so viewing and submitting a form are gated identically.
 */
export function resolveAccessStatus(
  accessControl: AccessControlSettings | undefined | null,
  auth: BetterAuthContext
): FormAccessStatus {
  if (!accessControl?.enabled) return 'OPEN';

  if (!auth.isAuthenticated || !auth.user?.email) {
    return 'SIGN_IN_REQUIRED';
  }

  if (accessControl.allowedDomains?.length) {
    if (!emailDomainAllowed(auth.user.email, accessControl.allowedDomains)) {
      return 'DOMAIN_REJECTED';
    }
  }

  return 'OPEN';
}

/**
 * The actual security boundary — called from `submitResponse`, which is a
 * public mutation callable directly regardless of what the UI showed.
 */
export function enforceAccessControlForSubmission(
  accessControl: AccessControlSettings,
  auth: BetterAuthContext
): void {
  const status = resolveAccessStatus(accessControl, auth);

  if (status === 'SIGN_IN_REQUIRED') {
    throw createGraphQLError(
      'Sign-in is required to submit this form',
      GRAPHQL_ERROR_CODES.SIGN_IN_REQUIRED
    );
  }

  if (status === 'DOMAIN_REJECTED') {
    throw createGraphQLError(
      'Your email domain is not allowed to submit this form',
      GRAPHQL_ERROR_CODES.EMAIL_DOMAIN_NOT_ALLOWED
    );
  }
}

import { describe, it, expect } from 'vitest';
import { resolveAccessStatus, enforceAccessControlForSubmission } from '../accessControlEnforcement.js';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import type { BetterAuthContext } from '../../middleware/better-auth-middleware.js';

const unauthenticated: BetterAuthContext = { user: null, session: null, isAuthenticated: false };

function authenticatedAs(email: string): BetterAuthContext {
  return { user: { email }, session: {}, isAuthenticated: true };
}

describe('resolveAccessStatus', () => {
  it('returns OPEN when access control is disabled and email collection is off', () => {
    expect(resolveAccessStatus({ enabled: false, requireSignIn: false }, false, unauthenticated)).toBe('OPEN');
  });

  it('returns OPEN when access control is undefined/null', () => {
    expect(resolveAccessStatus(undefined, undefined, unauthenticated)).toBe('OPEN');
    expect(resolveAccessStatus(null, undefined, unauthenticated)).toBe('OPEN');
  });

  it('returns SIGN_IN_REQUIRED when enabled and the requester is not authenticated', () => {
    expect(resolveAccessStatus({ enabled: true, requireSignIn: true }, false, unauthenticated)).toBe('SIGN_IN_REQUIRED');
  });

  it('returns SIGN_IN_REQUIRED when authenticated but the session has no email', () => {
    const auth: BetterAuthContext = { user: {}, session: {}, isAuthenticated: true };
    expect(resolveAccessStatus({ enabled: true, requireSignIn: true }, false, auth)).toBe('SIGN_IN_REQUIRED');
  });

  it('returns OPEN when authenticated and no domain restriction is configured', () => {
    const auth = authenticatedAs('respondent@example.com');
    expect(resolveAccessStatus({ enabled: true, requireSignIn: true }, false, auth)).toBe('OPEN');
  });

  it('returns OPEN when the verified email domain is in the allowlist', () => {
    const auth = authenticatedAs('respondent@example.com');
    const settings = { enabled: true, requireSignIn: true, allowedDomains: ['example.com'] };
    expect(resolveAccessStatus(settings, false, auth)).toBe('OPEN');
  });

  it('matches the domain allowlist case-insensitively', () => {
    const auth = authenticatedAs('respondent@Example.COM');
    const settings = { enabled: true, requireSignIn: true, allowedDomains: ['EXAMPLE.com'] };
    expect(resolveAccessStatus(settings, false, auth)).toBe('OPEN');
  });

  it('returns DOMAIN_REJECTED when the verified email domain is not in the allowlist', () => {
    const auth = authenticatedAs('respondent@other.com');
    const settings = { enabled: true, requireSignIn: true, allowedDomains: ['example.com'] };
    expect(resolveAccessStatus(settings, false, auth)).toBe('DOMAIN_REJECTED');
  });

  it('returns DOMAIN_REJECTED when the email has no domain part', () => {
    const auth = authenticatedAs('not-an-email');
    const settings = { enabled: true, requireSignIn: true, allowedDomains: ['example.com'] };
    expect(resolveAccessStatus(settings, false, auth)).toBe('DOMAIN_REJECTED');
  });

  it('treats an empty allowedDomains array as no restriction', () => {
    const auth = authenticatedAs('respondent@anywhere.com');
    const settings = { enabled: true, requireSignIn: true, allowedDomains: [] };
    expect(resolveAccessStatus(settings, false, auth)).toBe('OPEN');
  });

  describe('collectRespondentEmail (independent of accessControl)', () => {
    it('returns SIGN_IN_REQUIRED when collectRespondentEmail is on and accessControl is off/absent', () => {
      expect(resolveAccessStatus(undefined, true, unauthenticated)).toBe('SIGN_IN_REQUIRED');
      expect(resolveAccessStatus({ enabled: false, requireSignIn: false }, true, unauthenticated)).toBe('SIGN_IN_REQUIRED');
    });

    it('returns OPEN once signed in, with no domain restriction applied', () => {
      const auth = authenticatedAs('anyone@anywhere.com');
      expect(resolveAccessStatus(undefined, true, auth)).toBe('OPEN');
      expect(resolveAccessStatus({ enabled: false, requireSignIn: false }, true, auth)).toBe('OPEN');
    });

    it('does not add a domain restriction when accessControl is disabled but has stale allowedDomains', () => {
      const auth = authenticatedAs('anyone@anywhere.com');
      const settings = { enabled: false, requireSignIn: false, allowedDomains: ['example.com'] };
      expect(resolveAccessStatus(settings, true, auth)).toBe('OPEN');
    });
  });
});

describe('enforceAccessControlForSubmission', () => {
  const settings = { enabled: true, requireSignIn: true, allowedDomains: ['example.com'] };

  it('does not throw when the requester is authenticated and the domain is allowed', () => {
    expect(() => enforceAccessControlForSubmission(settings, false, authenticatedAs('respondent@example.com'))).not.toThrow();
  });

  it('throws SIGN_IN_REQUIRED when not authenticated', () => {
    try {
      enforceAccessControlForSubmission(settings, false, unauthenticated);
      expect.unreachable('expected enforceAccessControlForSubmission to throw');
    } catch (error: any) {
      expect(error.extensions.code).toBe(GRAPHQL_ERROR_CODES.SIGN_IN_REQUIRED);
    }
  });

  it('throws EMAIL_DOMAIN_NOT_ALLOWED when the domain is not allowed', () => {
    try {
      enforceAccessControlForSubmission(settings, false, authenticatedAs('respondent@other.com'));
      expect.unreachable('expected enforceAccessControlForSubmission to throw');
    } catch (error: any) {
      expect(error.extensions.code).toBe(GRAPHQL_ERROR_CODES.EMAIL_DOMAIN_NOT_ALLOWED);
    }
  });

  it('throws SIGN_IN_REQUIRED for collectRespondentEmail alone when not authenticated', () => {
    try {
      enforceAccessControlForSubmission(undefined, true, unauthenticated);
      expect.unreachable('expected enforceAccessControlForSubmission to throw');
    } catch (error: any) {
      expect(error.extensions.code).toBe(GRAPHQL_ERROR_CODES.SIGN_IN_REQUIRED);
    }
  });

  it('does not throw for collectRespondentEmail alone once authenticated', () => {
    expect(() => enforceAccessControlForSubmission(undefined, true, authenticatedAs('anyone@anywhere.com'))).not.toThrow();
  });
});

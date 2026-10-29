import { describe, it, expect } from 'vitest';
import { authAdminRoles, authRateLimitRules, buildAuthRateLimitRules } from '../authAccess.js';

describe('auth access control (S01-02)', () => {
  it('does not give the admin role destructive user permissions', () => {
    const userStatements = authAdminRoles.admin.statements.user as readonly string[];
    expect(userStatements).toEqual(expect.arrayContaining(['list', 'get']));
    for (const action of ['set-role', 'ban', 'delete', 'set-password', 'impersonate']) {
      expect(userStatements).not.toContain(action);
    }
  });

  it('keeps the full permission set for superAdmin', () => {
    const userStatements = authAdminRoles.superAdmin.statements.user as readonly string[];
    expect(userStatements).toEqual(expect.arrayContaining(['set-role', 'ban', 'delete']));
  });
});

describe('auth rate-limit rules (S01-04)', () => {
  it('throttles OTP verification and password reset endpoints', () => {
    expect(Object.keys(authRateLimitRules)).toEqual(
      expect.arrayContaining(['/email-otp/verify-email', '/reset-password'])
    );
    for (const rule of Object.values(authRateLimitRules)) {
      expect(rule).toMatchObject({ window: expect.any(Number), max: expect.any(Number) });
    }
  });

  it('relaxes the sign-in limit only for the dev environment', () => {
    expect(buildAuthRateLimitRules('dev')).toHaveProperty('/sign-in/email');
    expect(buildAuthRateLimitRules('staging')).not.toHaveProperty('/sign-in/email');
    expect(buildAuthRateLimitRules('production')).not.toHaveProperty('/sign-in/email');
    expect(buildAuthRateLimitRules(undefined)).not.toHaveProperty('/sign-in/email');
  });
});

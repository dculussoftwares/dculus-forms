import { adminAc, defaultAc } from 'better-auth/plugins/admin/access';

// `admin` is read-only inside better-auth's admin endpoints. The plugin's
// set-role / set-password / ban / delete handlers only check the caller's own
// permission, not the target's role, so granting them to `admin` would let any
// admin promote themselves or take over a `superAdmin` account.
export const adminRole = defaultAc.newRole({
  user: ['list', 'get'],
  session: ['list'],
});

export const superAdminRole = adminAc;

export const authAdminRoles = {
  admin: adminRole,
  superAdmin: superAdminRole,
};

// better-auth already throttles sign-in/sign-up (3 per 10s) and the
// email-sending endpoints (3 per 60s) by default. These add limits for the
// token/OTP verification endpoints it leaves on the generic bucket, so OTPs
// cannot be guessed by cycling new codes. Per client IP; see proxyConfig.
export const authRateLimitRules = {
  '/email-otp/verify-email': { window: 60, max: 10 },
  '/email-otp/check-verification-otp': { window: 60, max: 10 },
  '/email-otp/reset-password': { window: 60, max: 10 },
  '/reset-password': { window: 60, max: 10 },
  '/magic-link/verify': { window: 60, max: 10 },
};

import { beforeEach, describe, expect, it } from 'vitest';
import {
  INVITATION_LIMITS,
  checkInvitationEmailLimit,
  recordInvitationEmail,
  resetInvitationRateLimits,
} from '../invitationRateLimit.js';

const base = { recipientEmail: 'victim@example.com', organizationId: 'org1', inviterId: 'u1' };
const T0 = 1_000_000_000_000;

describe('invitation email rate limits', () => {
  beforeEach(() => resetInvitationRateLimits());

  it('allows the first email and blocks an immediate resend to the same address', () => {
    expect(checkInvitationEmailLimit(base, T0)).toBeNull();
    recordInvitationEmail(base, T0);
    expect(checkInvitationEmailLimit(base, T0 + 1000)).toBe('recipient-cooldown');
    expect(
      checkInvitationEmailLimit(
        { ...base, recipientEmail: 'VICTIM@example.com' },
        T0 + 1000
      )
    ).toBe('recipient-cooldown');
  });

  it('allows a resend after the cooldown', () => {
    recordInvitationEmail(base, T0);
    expect(
      checkInvitationEmailLimit(base, T0 + INVITATION_LIMITS.recipientOrgCooldownMs + 1)
    ).toBeNull();
  });

  it('caps emails to one address across organizations per day', () => {
    for (let i = 0; i < INVITATION_LIMITS.recipientPerDay; i++) {
      recordInvitationEmail({ ...base, organizationId: `org${i}`, inviterId: `u${i}` }, T0 + i);
    }
    expect(
      checkInvitationEmailLimit({ ...base, organizationId: 'other', inviterId: 'x' }, T0 + 60_000_0)
    ).toBe('recipient-daily-cap');
  });

  it('caps emails per inviter per hour', () => {
    for (let i = 0; i < INVITATION_LIMITS.inviterPerHour; i++) {
      recordInvitationEmail({ ...base, recipientEmail: `r${i}@example.com` }, T0 + i);
    }
    expect(
      checkInvitationEmailLimit({ ...base, recipientEmail: 'new@example.com' }, T0 + 1000)
    ).toBe('inviter-hourly-cap');
  });

  it('caps emails per organization per day', () => {
    for (let i = 0; i < INVITATION_LIMITS.organizationPerDay; i++) {
      recordInvitationEmail(
        { recipientEmail: `r${i}@example.com`, organizationId: 'org1', inviterId: `u${i}` },
        T0 + i
      );
    }
    expect(
      checkInvitationEmailLimit(
        { recipientEmail: 'new@example.com', organizationId: 'org1', inviterId: 'fresh' },
        T0 + 1000
      )
    ).toBe('organization-daily-cap');
  });

  it('forgets sends after the rolling window', () => {
    recordInvitationEmail(base, T0);
    expect(checkInvitationEmailLimit(base, T0 + 25 * 60 * 60 * 1000)).toBeNull();
  });
});

/**
 * Abuse limits for organization invitation emails (S24-04).
 *
 * better-auth only caps pending invitations per organization and lets `resend` re-send to the same
 * address with no cooldown, so the invite endpoint could be used as a mail relay. These limits are
 * kept in process memory: they are defense in depth per backend replica, not a global quota.
 */

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export const INVITATION_LIMITS = {
  /** Minimum gap between two emails to the same address from the same organization. */
  recipientOrgCooldownMs: 10 * MINUTE_MS,
  /** Emails to one address, across all organizations, per rolling day. */
  recipientPerDay: 5,
  /** Emails sent by one inviter per rolling hour. */
  inviterPerHour: 20,
  /** Emails sent by one organization per rolling day. */
  organizationPerDay: 100,
} as const;

export type InvitationRateLimitReason =
  | 'recipient-cooldown'
  | 'recipient-daily-cap'
  | 'inviter-hourly-cap'
  | 'organization-daily-cap';

export interface InvitationEmailKey {
  recipientEmail: string;
  organizationId: string;
  inviterId: string;
}

const sentAt = new Map<string, number[]>();

function recent(key: string, windowMs: number, now: number): number[] {
  const kept = (sentAt.get(key) ?? []).filter((t) => now - t < windowMs);
  if (kept.length > 0) sentAt.set(key, kept);
  else sentAt.delete(key);
  return kept;
}

function keys({ recipientEmail, organizationId, inviterId }: InvitationEmailKey) {
  const recipient = recipientEmail.trim().toLowerCase();
  return {
    pair: `pair:${organizationId}:${recipient}`,
    recipient: `recipient:${recipient}`,
    inviter: `inviter:${inviterId}`,
    organization: `org:${organizationId}`,
  };
}

/** Returns the limit that would be exceeded by sending now, or null when sending is allowed. */
export function checkInvitationEmailLimit(
  input: InvitationEmailKey,
  now: number = Date.now()
): InvitationRateLimitReason | null {
  const k = keys(input);
  const pair = recent(k.pair, INVITATION_LIMITS.recipientOrgCooldownMs, now);
  if (pair.length > 0) return 'recipient-cooldown';
  if (recent(k.recipient, DAY_MS, now).length >= INVITATION_LIMITS.recipientPerDay) {
    return 'recipient-daily-cap';
  }
  if (recent(k.inviter, HOUR_MS, now).length >= INVITATION_LIMITS.inviterPerHour) {
    return 'inviter-hourly-cap';
  }
  if (recent(k.organization, DAY_MS, now).length >= INVITATION_LIMITS.organizationPerDay) {
    return 'organization-daily-cap';
  }
  return null;
}

/** Records a send; call only after {@link checkInvitationEmailLimit} returned null. */
export function recordInvitationEmail(input: InvitationEmailKey, now: number = Date.now()): void {
  if (sentAt.size > 10_000) {
    for (const key of [...sentAt.keys()]) recent(key, DAY_MS, now);
  }
  const k = keys(input);
  for (const key of Object.values(k)) {
    const list = sentAt.get(key) ?? [];
    list.push(now);
    sentAt.set(key, list);
  }
}

/** Test helper. */
export function resetInvitationRateLimits(): void {
  sentAt.clear();
}

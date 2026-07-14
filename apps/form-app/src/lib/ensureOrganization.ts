import { slugify } from '@dculus/utils';
import { authClient, organization } from './auth-client';

/**
 * Shared by OAuthCallback.tsx and SignUp.tsx: whichever sign-in path got the
 * user authenticated (Google, or the session-first email-OTP flow), this is
 * the one place that checks whether their session already has an active
 * organization and creates one if not — so a returning respondent-only
 * account (no org) converges on the same "create my org" step as a genuinely
 * new user, instead of each caller re-implementing the check.
 */
export async function ensureOrganization(
  orgNameIfCreating: string
): Promise<{ organizationId: string; created: boolean } | null> {
  const { data, error } = await authClient.getSession();
  if (error || !data?.session) return null;

  if (data.session.activeOrganizationId) {
    return { organizationId: data.session.activeOrganizationId, created: false };
  }

  const orgSlug = slugify(orgNameIfCreating);
  const orgResult = await authClient.organization.create({ name: orgNameIfCreating, slug: orgSlug });
  if (!orgResult.data) return null;

  await organization.setActive({ organizationId: orgResult.data.id });
  return { organizationId: orgResult.data.id, created: true };
}

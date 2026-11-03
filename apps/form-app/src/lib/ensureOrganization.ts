import { slugify } from '@dculus/utils';
import { authClient, organization } from './auth-client';

const MAX_CREATE_ATTEMPTS = 4;

const randomSuffix = () => Math.random().toString(36).slice(2, 8);

/**
 * Workspace slugs must be unique and non-empty. Names that slugify to nothing
 * (e.g. Tamil) fall back to "workspace"; retries add a random suffix so two
 * people with the same name never block each other.
 */
export function workspaceSlugCandidates(name: string, attempts = MAX_CREATE_ATTEMPTS): string[] {
  const base = slugify(name).slice(0, 40).replace(/-+$/, '') || 'workspace';
  return [base, ...Array.from({ length: attempts - 1 }, () => `${base}-${randomSuffix()}`)];
}

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

  const name = orgNameIfCreating.trim() || 'My workspace';
  for (const slug of workspaceSlugCandidates(name)) {
    const orgResult = await authClient.organization.create({ name, slug });
    if (orgResult.data) {
      await organization.setActive({ organizationId: orgResult.data.id });
      return { organizationId: orgResult.data.id, created: true };
    }
    console.warn('[ensureOrganization] Could not create workspace with slug', slug, orgResult.error);
  }
  return null;
}

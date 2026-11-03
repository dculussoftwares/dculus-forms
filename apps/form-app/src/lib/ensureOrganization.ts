import { slugify } from '@dculus/utils';
import { authClient, organization } from './auth-client';

const MAX_CREATE_ATTEMPTS = 4;
// better-auth's organization.create reports a taken slug with this code.
const SLUG_TAKEN_CODES = new Set(['ORGANIZATION_ALREADY_EXISTS', 'ORGANIZATION_SLUG_ALREADY_TAKEN']);

const randomSuffix = () => Math.random().toString(36).slice(2, 8);

/**
 * Workspace slugs must be unique and non-empty. Names that slugify to nothing
 * (e.g. Tamil) use "workspace" as the slug base; retries add a random suffix so
 * two people with the same name never block each other.
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
 *
 * Only a taken slug is retried; any other failure stops immediately, so a
 * request that may already have created a workspace is never repeated.
 */
export async function ensureOrganization(
  orgNameIfCreating: string
): Promise<{ organizationId: string; created: boolean } | null> {
  const name = orgNameIfCreating.trim();
  if (!name) return null;

  const { data, error } = await authClient.getSession();
  if (error || !data?.session) return null;

  if (data.session.activeOrganizationId) {
    return { organizationId: data.session.activeOrganizationId, created: false };
  }

  for (const slug of workspaceSlugCandidates(name)) {
    const orgResult = await authClient.organization.create({ name, slug });
    if (orgResult.data) {
      await organization.setActive({ organizationId: orgResult.data.id });
      return { organizationId: orgResult.data.id, created: true };
    }
    const code = (orgResult.error as { code?: string } | null)?.code;
    if (!code || !SLUG_TAKEN_CODES.has(code)) {
      console.error('[ensureOrganization] Could not create workspace:', orgResult.error);
      return null;
    }
  }
  return null;
}

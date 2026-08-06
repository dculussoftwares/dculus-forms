import type { DocDiagram } from '../types';

/**
 * Companion diagram for `docs/architecture/09-authorization.md`.
 *
 * Drawn as the actual fall-through order rather than as three stacked "layers",
 * because the order is the design — membership before ownership is what stops a
 * removed member keeping access to forms they created.
 *
 * The respondent-side gate hangs off the entry node as a separate branch: it
 * shares nothing with the builder-side chain, and drawing it inline would imply
 * a relationship that does not exist.
 */
export const authorization: DocDiagram = {
  direction: 'TB',
  nodes: [
    {
      id: 'request',
      data: {
        label: 'Someone asks for a form',
        kind: 'entry',
        file: 'apps/backend/src/middleware/better-auth-middleware.ts',
        line: 18,
        does: 'The auth context is populated for every request — including anonymous ones.',
        note: 'Populated, never enforced. A resolver with no permission check is a public resolver, and it compiles fine.',
      },
    },
    {
      id: 'membership',
      data: {
        label: '1. Org membership',
        kind: 'gate',
        file: 'apps/backend/src/services/formSharingService.ts',
        line: 60,
        does: 'Denies immediately if the user is not a member of the form organization.',
        note: 'Checked before ownership on purpose — otherwise someone removed from the org would keep full access to every form they created.',
      },
    },
    {
      id: 'owner',
      data: {
        label: '2. Form ownership',
        kind: 'gate',
        file: 'apps/backend/src/services/formSharingService.ts',
        line: 69,
        does: 'createdById matching the user resolves to OWNER.',
        note: 'Only reachable once membership has passed, which is why form owners are not permanent.',
      },
    },
    {
      id: 'explicit',
      data: {
        label: '3. Explicit FormPermission',
        kind: 'gate',
        file: 'apps/backend/prisma/schema.prisma',
        line: 362,
        does: 'A row for this user and form decides, compared numerically: NO_ACCESS 0, VIEWER 1, EDITOR 2, OWNER 3.',
        note: 'An explicit NO_ACCESS beats a permissive sharing scope, because this step returns before the scope is consulted. That is the exclusion mechanism.',
      },
    },
    {
      id: 'scope',
      data: {
        label: '4. Sharing scope fallback',
        kind: 'gate',
        file: 'apps/backend/src/services/formSharingService.ts',
        line: 88,
        does: 'Only ALL_ORG_MEMBERS grants anything here, at the form defaultPermission.',
        note: 'PRIVATE and SPECIFIC_MEMBERS resolve identically — both fall through to no access. The difference between them is which sharing UI is shown.',
      },
    },
    {
      id: 'result',
      data: {
        label: 'Effective permission',
        kind: 'effect',
        file: 'apps/backend/src/services/formSharingService.ts',
        line: 47,
        does: 'Returns { hasAccess, permission, form } to the resolver, or to the WebSocket upgrade.',
        note: 'Throws for a missing form but returns for a denied one — two different shapes from one function.',
        shared: 'Used by resolvers and by Hocuspocus',
      },
    },
    {
      id: 'respondent',
      data: {
        label: 'Respondent-side gate',
        kind: 'gate',
        file: 'apps/backend/src/lib/accessControlEnforcement.ts',
        does: 'A separate system: OPEN, SIGN_IN_REQUIRED or DOMAIN_REJECTED, from per-form settings.',
        note: 'accessControl.enabled restricts who may respond; collectRespondentEmail restricts nobody and only asks for sign-in to capture a verified email.',
        shared: 'Non-throwing for the viewer, throwing for submit',
      },
    },
  ],
  edges: [
    { source: 'request', target: 'membership', label: 'builder side' },
    { source: 'membership', target: 'owner' },
    { source: 'owner', target: 'explicit' },
    { source: 'explicit', target: 'scope' },
    { source: 'scope', target: 'result' },
    { source: 'request', target: 'respondent', label: 'respondent side' },
  ],
};

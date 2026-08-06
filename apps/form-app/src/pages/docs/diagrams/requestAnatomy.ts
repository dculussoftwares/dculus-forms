import type { DocDiagram } from '../types';

/**
 * Companion diagram for `docs/architecture/03-request-anatomy.md`.
 *
 * Top-to-bottom because it is a stack, not a flow. The two extra entry points on
 * the left (Hocuspocus, pg-boss) are the reason services must not accept
 * request-shaped arguments: both reach the service layer with no HTTP request in
 * sight.
 */
export const requestAnatomy: DocDiagram = {
  direction: 'TB',
  nodes: [
    {
      id: 'http',
      data: {
        label: 'HTTP request',
        kind: 'entry',
        file: 'apps/backend/src/index.ts',
        does: 'Arrives at Express — GraphQL at /graphql, or one of the few REST routes.',
        note: 'REST exists only for what GraphQL cannot do: upload, OAuth callbacks, webhooks, health.',
      },
    },
    {
      id: 'ws',
      data: {
        label: 'Hocuspocus WebSocket',
        kind: 'entry',
        file: 'apps/backend/src/services/hocuspocus.ts',
        does: 'Collaborative form editing, authenticated on the WebSocket upgrade.',
        note: 'Accepts a bearer token or a session cookie — direct URL navigation has no bearer token in sessionStorage.',
      },
    },
    {
      id: 'worker',
      data: {
        label: 'pg-boss worker',
        kind: 'entry',
        file: 'apps/backend/src/services/automation/engine.ts',
        does: 'Executes automation steps in the background, with no HTTP request involved.',
      },
    },
    {
      id: 'middleware',
      data: {
        label: 'Middleware',
        kind: 'gate',
        file: 'apps/backend/src/middleware/edge-geolocation.ts',
        does: 'CORS, body parsing, rate limiting, and edge geolocation from Cloudflare headers.',
        note: 'Order matters: req.visitorGeo has to be attached before any router that records analytics.',
      },
    },
    {
      id: 'auth',
      data: {
        label: 'Auth context',
        kind: 'gate',
        file: 'apps/backend/src/middleware/better-auth-middleware.ts',
        line: 18,
        does: 'Resolves the session once per request into { user, session, isAuthenticated }.',
        note: 'Populated, not enforced — an anonymous request still gets a context. Enforcing is the resolver job.',
        shared: 'Used by every resolver and by Hocuspocus',
      },
    },
    {
      id: 'resolver',
      data: {
        label: 'Resolver',
        kind: 'gate',
        file: 'apps/backend/src/graphql/resolvers/forms.ts',
        does: 'Checks permissions, validates input, calls a service, shapes the result. Nothing else.',
        note: 'There is no implicit guard. A resolver with no requireAuth call is a public resolver, and it compiles fine.',
      },
    },
    {
      id: 'service',
      data: {
        label: 'Service',
        kind: 'effect',
        file: 'apps/backend/src/services/formService.ts',
        does: 'Business rules and orchestration across repositories. Emits events.',
        note: 'Must not know it came from GraphQL — the same services are called by pg-boss workers and the Hocuspocus server.',
      },
    },
    {
      id: 'repo',
      data: {
        label: 'Repository',
        kind: 'effect',
        file: 'apps/backend/src/repositories/baseRepository.ts',
        does: 'Every Prisma query in the codebase lives at this layer.',
        note: 'Prisma calls outside this folder are the most common review comment on this codebase.',
        shared: 'Query helpers reused by exports and PDF filters',
      },
    },
    {
      id: 'db',
      data: {
        label: 'Postgres',
        kind: 'store',
        file: 'apps/backend/src/lib/prisma.ts',
        does: 'Reached through PgBouncer via DATABASE_URL; DIRECT_URL bypasses the pooler for migrations.',
        note: 'The app-side pool is capped at 2 in production on purpose — PgBouncer does the real pooling.',
      },
    },
  ],
  edges: [
    { source: 'http', target: 'middleware' },
    { source: 'middleware', target: 'auth' },
    { source: 'auth', target: 'resolver' },
    { source: 'resolver', target: 'service' },
    { source: 'ws', target: 'service', label: 'no HTTP request' },
    { source: 'worker', target: 'service', label: 'no HTTP request' },
    { source: 'service', target: 'repo' },
    { source: 'repo', target: 'db' },
  ],
};

# Request Anatomy

Where does a GraphQL request actually go? This page traces one from the HTTP
socket down to Postgres and back, and names the four things the backend process
is running at once.

Read this before writing your first resolver. The layering isn't complicated,
but the *rules* about which layer may do what are what code review will hold you
to.

## At a glance

| | |
|---|---|
| **Entry point** | `apps/backend/src/index.ts` — Express + Apollo setup |
| **Trigger** | Any HTTP request to the backend |
| **Execution** | Synchronous request/response |
| **Outcome** | A GraphQL response, or a coded error |
| **Fails loudly?** | Yes — errors surface to the caller with a `GRAPHQL_ERROR_CODES` code |

## Four things in one process

The backend isn't only an API server. One `node` process runs all of these:

| Runtime | Purpose |
|---|---|
| **Express + Apollo** (`:4000/graphql`) | The GraphQL API — most of the product |
| **Hocuspocus WebSocket** | Real-time collaborative editing of form schemas |
| **pg-boss workers** | Automation steps, delays, and cron triggers |
| **Express REST routes** | Auth callbacks, file upload, OAuth, webhooks, health |

REST is deliberately a short list. It exists only where GraphQL can't go —
multipart upload, third-party callbacks that post form-encoded bodies, and
health checks. Everything else is GraphQL.

## The layers

```
   HTTP request
        │
        ▼
   ┌─────────────────────────────────────┐
   │  Middleware                         │
   │   · CORS, compression, logging      │
   │   · edge geolocation (Cloudflare)   │
   │   · rate limiting                   │
   │   · better-auth → BetterAuthContext │
   └──────────────┬──────────────────────┘
                  ▼
   ┌─────────────────────────────────────┐
   │  Resolver        graphql/resolvers/ │
   │   · requireAuth(...)                │
   │   · requireOrganizationMembership   │
   │   · checkFormAccess                 │
   │   · shape input / shape output      │
   └──────────────┬──────────────────────┘
                  ▼
   ┌─────────────────────────────────────┐
   │  Service         services/          │
   │   · business rules                  │
   │   · orchestration across repos      │
   │   · emits events                    │
   └──────────────┬──────────────────────┘
                  ▼
   ┌─────────────────────────────────────┐
   │  Repository      repositories/      │
   │   · all Prisma queries live here    │
   └──────────────┬──────────────────────┘
                  ▼
              Postgres
             (via PgBouncer)
```

## Walkthrough

**Middleware** — `index.ts:230` onwards

Runs in order: CORS, body parsing (10 MB cap), edge geolocation, then the routers.
`edgeGeolocationMiddleware` reads Cloudflare headers (`cf-ipcity`,
`cf-ipcountry`, …) and attaches `req.visitorGeo`, which is how analytics gets
location without doing its own lookup.

**Auth context** — `middleware/better-auth-middleware.ts:18`

`createBetterAuthContext` resolves the session once per request and produces:

```ts
interface BetterAuthContext {
  user: any | null;
  session: any | null;
  isAuthenticated: boolean;
}
```

Every resolver receives this as `context.auth`. Note it's *populated*, not
*enforced* — an unauthenticated request still gets a context, just with
`isAuthenticated: false`. Enforcement is the resolver's job.

**Resolver** — `graphql/resolvers/*.ts`

Twenty resolver files, one per feature. A resolver should do four things and
stop: check permissions, validate input shape, call a service, shape the result.

Permission checks are explicit, never implied:

```ts
requireAuth(context.auth);
await requireOrganizationMembership(context.auth, organizationId);
```

and for anything form-scoped, `checkFormAccess(userId, formId, PermissionLevel.X)`.
There is no automatic guard — a resolver with no check is a public resolver.
See the authorization model page for what the three permission layers mean.

Errors use coded throws so clients can branch on them:

```ts
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import { createGraphQLError } from '../lib/graphqlErrors.js';

throw createGraphQLError('Form not found', GRAPHQL_ERROR_CODES.FORM_NOT_FOUND);
```

**Service** — `services/*.ts`

Business rules and orchestration. Services may call several repositories, call
other services, and emit events. They should not know they were reached from
GraphQL — no `context`, no request objects. That's what makes them reusable from
the pg-boss workers and the Hocuspocus server, both of which have no HTTP request
at all.

**Repository** — `repositories/*.ts`

Every Prisma query. If you're writing `prisma.something.findMany` outside this
folder, that's the thing to move. Repositories are also where the read/write
patterns get shared — this is why `applyResponseFilters` can be reused by the
responses table, PDF generators, and export without three divergent query
builders.

**Postgres** — via PgBouncer

`DATABASE_URL` is the pooled connection; `DIRECT_URL` bypasses the pooler for
migrations. The app-side pool is deliberately capped small in production
(`max: 2`) because PgBouncer does the real pooling.

## Invariants & design decisions

- **Prisma stays in repositories.** The layering only pays off if the boundary
  holds. A resolver reaching for Prisma directly is the most common review
  comment on this codebase.
- **Services don't know about HTTP.** They're called from resolvers, from
  pg-boss workers, and from the Hocuspocus server. Anything request-shaped in a
  service signature will eventually block one of those callers.
- **Every resolver declares its own permission checks.** There is no
  "authenticated by default". This is verbose on purpose — a missing check is
  visible in review, whereas a missing exemption from an implicit guard is not.
- **Errors carry codes, not just messages.** Frontends branch on
  `GRAPHQL_ERROR_CODES`; message strings are for humans and may change.
- **REST is for what GraphQL can't do.** Upload, OAuth callbacks, webhooks,
  health. Adding a REST route for ordinary CRUD means the GraphQL schema is
  missing something.

## Shared surfaces

What this layer exposes:

| Exported surface | Consumed by | Contract they rely on | Breaks them if… |
|---|---|---|---|
| `BetterAuthContext` | Every resolver, Hocuspocus auth | `{ user, session, isAuthenticated }` | Fields are renamed or become async |
| `requireAuth` / `requireOrganizationMembership` | All resolvers | Throw on failure, return void on success | They start returning booleans instead of throwing |
| `GRAPHQL_ERROR_CODES` | form-app, form-viewer, admin-app | Code strings are stable | You rename an existing code |
| `baseRepository` / `withPrisma` | Every repository, automation engine | Shared client + transaction helper | Connection handling changes shape |
| `req.visitorGeo` | Analytics services | Populated before routers run | Middleware order changes |

What this depends on:

| Depends on | Owned by | Why |
|---|---|---|
| better-auth | `lib/better-auth.ts` | Sessions, org membership, admin roles |
| Prisma client | `src/generated/prisma` (gitignored) | Must be regenerated after schema changes |
| Sentry | `instrument.ts` | Error capture, GraphQL transaction naming |

## Data touched

All of it — this is the path everything else uses.

## Failure & retry behavior

No retry at this layer. Errors propagate to Apollo, get a code attached, and
reach the client. `errorHandler.ts` catches anything that escapes on the REST
side. Sentry captures both, with GraphQL transactions named
`GraphQL {operation}: {operationName}`.

## Configuration

| Variable | Effect |
|---|---|
| `DATABASE_URL` | Pooled Postgres connection (PgBouncer) |
| `DIRECT_URL` | Unpooled connection, migrations only |
| `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` | Session signing and callback base |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `SENTRY_DSN` | Enables Sentry when set |

## Related pages

- [The Life of a Submission](./01-submission-lifecycle.md) — the most involved
  resolver in the codebase, and a good worked example of these rules.
- [One Event, Three Listeners](./02-event-fanout.md) — how work escapes the
  request/response cycle.

## Gotchas

- **Startup order matters and fails silently.** `initializePluginSystem()`,
  `initializeAutomationTriggers()`, `initializeSubscriptionSystem()`, and
  `initializeAutomationEngine()` all run in sequence at boot (`index.ts:330`
  onwards). Drop one during a refactor and that feature simply never runs — no
  error, no log line, nothing.
- **The Prisma client is generated into the repo and gitignored.** Pulling a
  schema change does *not* refresh it. Run `pnpm db:generate` and `pnpm db:push`,
  or you'll get "Cannot return null for non-nullable field" from a stale client,
  or `P2022: column does not exist` from a database that never got the column.
- **A resolver with no permission check compiles fine.** Nothing enforces this
  but review.

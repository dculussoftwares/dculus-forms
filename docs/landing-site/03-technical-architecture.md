# Technical Architecture ("How It's Built")

Material for a technical credibility / engineering-deep-dive section of the landing site. Grounded in the code as of 2026-07-05.

## Stack at a glance

- **Monorepo**: pnpm workspaces, Node ≥22, TypeScript throughout
- **Backend**: Express + Apollo Server v5 GraphQL, ESM, layered Resolvers → Services → Repositories → Prisma
- **Frontends**: 3 Vite + React 18 SPAs (form builder, public form viewer, admin dashboard), Zustand for state, Apollo Client, Tailwind + shadcn/Radix
- **Database**: PostgreSQL via Prisma ORM, driver adapters (no native query-engine binary — see below)
- **Real-time**: Y.js CRDT + Hocuspocus for live multiplayer form editing
- **Auth**: better-auth (bearer, organization, admin, email OTP, magic link plugins)
- **Storage**: Cloudflare R2 (S3-compatible), two-bucket public/private model
- **AI**: Vercel AI SDK (OpenAI + Azure) powering a tool-calling form-editing agent
- **Billing**: Chargebee
- **Observability**: Sentry (error + profiling) on backend and both frontends, structured Pino logging

## The flagship differentiator: real multiplayer form editing

Most form builders (Typeform, Tally) use single-editor-at-a-time or last-write-wins saves. dculus-forms runs an actual CRDT-backed collaborative document per form:

1. A user edits a field → Y.js applies a local CRDT operation to a shared `Y.Doc`.
2. The change streams over WebSocket via `HocuspocusProvider` to the backend Hocuspocus server.
3. The server merges the update into the authoritative document, broadcasts it to every other connected editor for that form, and — debounced — persists a **compacted** snapshot (`Y.encodeStateAsUpdate`) to Postgres (`CollaborativeDocument` table), which prevents the classic CRDT problem of an ever-growing update log.
4. Every other connected client's Y.js observers fire, the change is deserialized back into the app's typed `FormField`/`FormPage` model, and Zustand re-renders — no polling, no manual refresh.
5. If everyone disconnects, the next person to open the form re-hydrates the full document from that same Postgres row.

Permissions are enforced at the protocol level, not just in the UI: the same `checkFormAccess()` function used by GraphQL resolvers also gates the Hocuspocus WebSocket handshake, so a **Viewer**-permission connection is put into read-only mode and its writes are rejected by the server — one source of truth for "who can edit this form," whether they're calling the API or typing live in the editor.

## Backend architecture

Strict layering, applied consistently across ~16 feature areas (forms, responses, analytics, field analytics, templates, plugins, subscriptions, sharing, invitations, tags, AI chat, file upload...):

```
GraphQL Resolvers  →  Services (business logic)  →  Repositories (Prisma access)  →  Postgres
```

- Repositories are built from a shared `createXxxRepository(context?)` factory so tests can inject a mock Prisma client per repository without touching call sites.
- REST is deliberately minimal — file uploads, OAuth callbacks (Google/Microsoft Sheets), health checks, and the Chargebee webhook receiver. Everything else is GraphQL, validated with a query-depth limit.

## Data model highlights

Key relationships in a ~580-line Prisma schema:

- **Form** — canonical schema JSON + settings, soft-deletable, with sharing scope (Private / Specific Members / All Org Members) and a default permission.
- **FormPermission** — per-user ACL rows (Owner/Editor/Viewer/No Access).
- **Response** → **ResponseEditHistory** → **ResponseFieldChange** — a full, field-level audit trail of every manual edit, including who/when/IP/user-agent, with PII (IP/UA) automatically stripped when the editing user's account is deleted (GDPR-driven hook).
- **CollaborativeDocument** — one row per form holding the compacted Y.js binary state.
- **FormMetadata** — a small cache table (page/field counts) updated by a debounced Hocuspocus hook, so the dashboard never has to deserialize a full Y.Doc just to show a count.
- **FormViewAnalytics / FormSubmissionAnalytics** — anonymous, session-based rows enriched with parsed device/browser/OS and geolocation.
- **Subscription** — a local usage cache (views/submissions used vs. limit) in front of Chargebee, so quota checks don't require an API round-trip on every request.
- Several enum-like columns are deliberately still plain strings with tracked TODOs to migrate — a documented tradeoff, not an oversight (Postgres enum migrations need data validation first).

## File storage (Cloudflare R2)

- Two buckets by upload type: **public** (CDN-served — templates, backgrounds, avatars, logos) vs. **private** (respondent-uploaded response files, accessed only via short-lived presigned URLs).
- A hard-coded MIME blocklist (HTML, JS, PHP, shell scripts, executables) is enforced regardless of per-field config, closing a stored-XSS/RCE path via the CDN.
- Temporary export files (Excel/CSV) live in the private bucket with a 5-hour expiry and a background cleanup job that also catches files orphaned by a crash.

## Auth & the 3-layer permission model

better-auth handles identity (email/password with breach screening, email OTP, magic link, Google OAuth). Authorization is layered and checked server-side on every request:

1. **System role** (user / admin / superAdmin)
2. **Organization membership** (must belong to the org — checked even for form owners, closing an org-removal bypass)
3. **Per-form permission** (explicit grant, or the org's default permission if the form is shared org-wide)

The same resolution function backs both the GraphQL API and the Hocuspocus WebSocket handshake.

## Deployment

- **Multi-cloud, Terraform-driven**: backend on Azure Container Apps; each frontend (builder, viewer, admin) as its own Cloudflare Pages project; Cloudflare DNS in front; Cloudflare R2 for storage.
- Release-driven CI/CD: pushing a `v*` tag builds and auto-deploys to production; pushes to `main` auto-deploy to `dev`; manual dispatch supported per environment.
- **Connection pooling**: a dedicated PgBouncer instance sits in front of a small (B1ms, ~50 connection cap) shared Postgres server, added after production usage hit 88% of the hard connection cap — a real capacity problem solved with a small, cheap fix rather than an oversized database upgrade.
- Sentry error tracking + profiling wired into the backend and both user-facing frontends.

## Recent engineering work worth highlighting

- **Modern Prisma setup**: migrated off the classic native query-engine binary to Prisma's `engineType: "client"` — a WASM query compiler paired with a real `pg.Pool`-backed driver adapter. No native binary to ship, and connection pooling is now handled directly in application code (`max: 2` in production) rather than through engine-specific connection-string flags — a cleaner fit for the PgBouncer setup above.
- **Isolated pool for usage/billing checks**: the subscription usage service intentionally runs its own small, separately-capped connection pool so billing-critical checks can't be starved by (or starve) the rest of the app's database traffic.
- **Zero-latency geolocation**: analytics reads Cloudflare's edge geolocation headers directly off each request instead of doing a runtime GeoIP database lookup — free, accurate, no added latency on every form view/submission.
- **Extensible plugin core**: a typed registry decouples the "form submitted" event dispatch from individual integrations (webhook, email, Sheets, quiz grading, AI tagging) — adding a new integration means registering a handler, not touching the dispatch pipeline. Every invocation is durably logged for debugging.
- **One field taxonomy, three serialization surfaces**: the same typed field-class hierarchy round-trips through Postgres JSON, the Y.js CRDT tree, and the GraphQL API — validation rules defined once apply everywhere a field is touched.

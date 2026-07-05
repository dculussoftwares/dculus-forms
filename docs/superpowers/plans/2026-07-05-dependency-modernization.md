# Dependency Modernization (better-auth, react-router, Prisma) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace three outdated dependency patterns identified via a Context7 doc audit: bump `better-auth` to its latest 1.6.x patch, migrate all three frontend apps from `react-router-dom` (v6, soon-EOL package name) to `react-router` v7, and migrate the backend from the legacy `prisma-client-js` generator to the current `prisma-client` generator with a `@prisma/adapter-pg` driver adapter.

**Architecture:** Three independent phases, each ending in a working, fully-verified state, committed separately. Phase 1 (better-auth) is a pure version bump. Phase 2 (react-router) is a mechanical package-name + import-specifier swap across three Vite React apps — no API surface changes, since `react-router` v7 in library mode (`<BrowserRouter>`/`<Routes>`/`<Route>`) is a drop-in for `react-router-dom` v6. Phase 3 (Prisma) is the highest-risk change: it replaces the native query-engine binary with a WASM query compiler + a `pg.Pool`-backed driver adapter, which changes how the app's PgBouncer connection pooling is configured (query-string params → `pg.Pool` options). It reuses the codebase's existing `#subpath-import` convention (see `#graphql-errors` in `apps/backend/package.json`/`tsconfig.json`/`vitest.config.ts`) so the ~16 files that import from `@prisma/client` only need a single specifier swap each.

**Tech Stack:** pnpm workspaces, TypeScript (Node16 module resolution, ESM), Vite 7, React 18, `@apollo/client` v4, `@apollo/server` v5, `better-auth` v1.6, `react-router` v6→v7, Prisma 6.13→6.19 with `prisma-client` generator + `@prisma/adapter-pg`, Vitest.

## Global Constraints

- Public repo (`dculus-forms`) — never commit `.env` files, API keys, or credentials; verify `git status`/`git diff` before every commit.
- Node `>=22.12.0`, pnpm `>=8.0.0` (from root `package.json` `engines`).
- Backend TypeScript config uses `"module": "Node16"` / `"moduleResolution": "Node16"` — all relative imports use explicit `.js` extensions even though source is `.ts`; new code must follow this.
- Backend has an established Node subpath-import convention for cross-cutting singletons: `tsconfig.json` `paths` maps `#name` → `./src/...ts` (for tsc/tsx dev), `package.json` `imports` maps the same key → `./dist/apps/backend/src/....js` (for the compiled `node dist/...` production runtime), and `vitest.config.ts` `resolve.alias` maps the same key → the `.ts` source (for tests). All three must be kept in sync — see the existing `#graphql-errors` entries in each file.
- Each phase must end with `pnpm --filter <app> type-check` (or `pnpm type-check` for phase 3) and the relevant test suite passing before moving to the next phase. Do not fold phases into a single commit.
- Don't refactor beyond what's required to complete the migration (e.g., do not consolidate `usageService.ts`'s separate `PrismaClient` instantiation into the shared singleton in `lib/prisma.ts` — that's a pre-existing pattern, out of scope here).

---

## Phase 1: better-auth patch bump

### Task 1: Bump better-auth 1.6.14 → 1.6.23

**Files:**
- Modify: `apps/backend/package.json:` the `"better-auth": "^1.6.14"` dependency line
- Modify: `package.json` (root) — the `"better-auth": ">=1.6.14"` line inside `pnpm.overrides` (around line 143)

**Interfaces:** None — this phase has no code changes, only version bumps. No breaking changes exist between 1.6.14 and 1.6.23 per the upstream changelog (the only 1.6.0 breaking changes — `freshAge` keying off `createdAt`, and default-on SAML `InResponseTo` validation — predate 1.6.14 and are already in effect on this codebase).

- [ ] **Step 1: Update the version in `apps/backend/package.json`**

Change:
```json
    "better-auth": "^1.6.14",
```
to:
```json
    "better-auth": "^1.6.23",
```

- [ ] **Step 2: Update the pnpm override floor in root `package.json`**

Change:
```json
      "better-auth": ">=1.6.14",
```
to:
```json
      "better-auth": ">=1.6.23",
```

- [ ] **Step 3: Reinstall and verify the resolved version**

Run: `pnpm install`
Then run: `pnpm why better-auth`
Expected: all resolved `better-auth` entries show `1.6.23` (or a newer patch if `^1.6.23` resolves higher — acceptable).

- [ ] **Step 4: Run backend auth tests and type-check**

Run: `pnpm --filter backend type-check`
Run: `pnpm --filter backend test -- better-auth`
Expected: both pass with no new errors.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/package.json package.json pnpm-lock.yaml
git commit -m "chore(deps): bump better-auth to 1.6.23"
```

---

## Phase 2: react-router-dom → react-router v7

`react-router` v7's library-mode API (`BrowserRouter`, `Routes`, `Route`, `Link`, `NavLink`, `useNavigate`, `useParams`, `useSearchParams`, `useLocation`, `Navigate`, `Outlet`) is unchanged from v6 — everything still exports from a single package, just renamed from `react-router-dom` to `react-router` (the `react-router-dom` re-export shim is removed in the *next* major, v8, so migrating now avoids a second forced migration later). `apps/form-app/src/main.tsx` already opts into the `v7_startTransition`/`v7_relativeSplatPath` future flags, confirming this app was already prepared for this exact bump.

### Task 2: Migrate form-app to react-router v7

**Files:**
- Modify: `apps/form-app/package.json` — dependency
- Modify: 41 files under `apps/form-app/src/` that import from `'react-router-dom'` (full list below)

**Interfaces:** No signature changes — every named export used (`BrowserRouter`, `Routes`, `Route`, `Link`, `NavLink`, `useNavigate`, `useLocation`, `useParams`, `useSearchParams`, `Navigate`, `Outlet`) is re-exported identically from `react-router` v7.

- [ ] **Step 1: Swap the dependency**

In `apps/form-app/package.json`, change:
```json
    "react-router-dom": "^6.30.4",
```
to:
```json
    "react-router": "^7.9.4",
```
(keep it alphabetically sorted in the dependencies block if the file is currently sorted)

- [ ] **Step 2: Replace the import specifier across all form-app source files**

Run:
```bash
grep -rl "from 'react-router-dom'" apps/form-app/src | xargs sed -i '' "s/from 'react-router-dom'/from 'react-router'/g"
```

This must touch exactly these 41 files:
```
apps/form-app/src/App.tsx
apps/form-app/src/main.tsx
apps/form-app/src/contexts/AuthContext.tsx
apps/form-app/src/utils/createResponsesColumns.tsx
apps/form-app/src/components/settings/SettingsNav.tsx
apps/form-app/src/components/settings/ProfileSettings.tsx
apps/form-app/src/components/ProtectedRoute.tsx
apps/form-app/src/components/Dashboard.tsx
apps/form-app/src/components/team-switcher.tsx
apps/form-app/src/components/nav-main.tsx
apps/form-app/src/components/Responses/ResponseDetailPanel.tsx
apps/form-app/src/components/nav-user.tsx
apps/form-app/src/components/app-sidebar.tsx
apps/form-app/src/components/FormDashboard/QuickActions.tsx
apps/form-app/src/components/FormDashboard/RecentResponses.tsx
apps/form-app/src/components/UseTemplatePopover.tsx
apps/form-app/src/components/form-builder/tabs/TabNavigation.tsx
apps/form-app/src/components/form-builder/FormBuilderHeader.tsx
apps/form-app/src/components/Header.tsx
apps/form-app/src/components/CreateFormPopover.tsx
apps/form-app/src/components/form-settings/FormSettingsContainer.tsx
apps/form-app/src/components/Analytics/FieldAnalytics/FieldAnalyticsViewer.tsx
apps/form-app/src/hooks/useFormDashboard.ts
apps/form-app/src/pages/Settings.tsx
apps/form-app/src/pages/Pricing.tsx
apps/form-app/src/pages/ResponseEditHistory.tsx
apps/form-app/src/pages/CreateFormWizard.tsx
apps/form-app/src/pages/ResponseEdit.tsx
apps/form-app/src/pages/ResponsesAnalytics.tsx
apps/form-app/src/pages/EmailVerification.tsx
apps/form-app/src/pages/FormDashboard.tsx
apps/form-app/src/pages/PluginConfiguration.tsx
apps/form-app/src/pages/InviteAcceptance.tsx
apps/form-app/src/pages/subscription/cancel.tsx
apps/form-app/src/pages/subscription/success.tsx
apps/form-app/src/pages/MagicLinkCallback.tsx
apps/form-app/src/pages/SignUp.tsx
apps/form-app/src/pages/OAuthCallback.tsx
apps/form-app/src/pages/CollaborativeFormBuilder.tsx
apps/form-app/src/pages/FormSettings.tsx
apps/form-app/src/pages/ResponsesIndividual.tsx
apps/form-app/src/pages/Integrations.tsx
apps/form-app/src/pages/FormAnalytics.tsx
apps/form-app/src/pages/Responses.tsx
```

- [ ] **Step 3: Verify no stale references remain**

Run: `grep -rl "react-router-dom" apps/form-app/src`
Expected: no output.

- [ ] **Step 4: Install and type-check**

Run: `pnpm install && pnpm --filter form-app type-check`
Expected: no errors.

- [ ] **Step 5: Build and smoke-test in the browser**

Run: `pnpm --filter form-app build`
Then run: `pnpm form-app:dev` and manually verify: sign-in redirect, dashboard navigation, opening a form builder page, and the settings nav (all exercise `Link`/`useNavigate`/`useParams`/`<Routes>`).

- [ ] **Step 6: Commit**

```bash
git add apps/form-app
git commit -m "chore(form-app): migrate react-router-dom to react-router v7"
```

### Task 3: Migrate form-viewer to react-router v7

**Files:**
- Modify: `apps/form-viewer/package.json`
- Modify: `apps/form-viewer/src/App.tsx`, `apps/form-viewer/src/components/Header.tsx`, `apps/form-viewer/src/pages/FormViewer.tsx`, `apps/form-viewer/src/pages/Home.tsx`

**Interfaces:** Same as Task 2.

- [ ] **Step 1: Swap the dependency**

In `apps/form-viewer/package.json`, change:
```json
    "react-router-dom": "^6.30.4"
```
to:
```json
    "react-router": "^7.9.4"
```

- [ ] **Step 2: Replace the import specifier**

Run:
```bash
grep -rl "from 'react-router-dom'" apps/form-viewer/src | xargs sed -i '' "s/from 'react-router-dom'/from 'react-router'/g"
```

- [ ] **Step 3: Verify and type-check**

Run: `grep -rl "react-router-dom" apps/form-viewer/src` — expect no output.
Run: `pnpm install && pnpm --filter form-viewer type-check` — expect no errors.

- [ ] **Step 4: Build and smoke-test**

Run: `pnpm --filter form-viewer build`
Then run: `pnpm form-viewer:dev` and load `/f/:shortUrl` for an existing test form to confirm routing still resolves (this app's primary route is param-based, exercising `useParams`).

- [ ] **Step 5: Commit**

```bash
git add apps/form-viewer
git commit -m "chore(form-viewer): migrate react-router-dom to react-router v7"
```

### Task 4: Migrate admin-app to react-router v7

**Files:**
- Modify: `apps/admin-app/package.json`
- Modify: `apps/admin-app/src/App.tsx`, `apps/admin-app/src/main.tsx`, `apps/admin-app/src/components/AdminLayout.tsx`, `apps/admin-app/src/components/users/UsersList.tsx`, `apps/admin-app/src/pages/organizations/OrganizationDetailPage.tsx`, `apps/admin-app/src/pages/OrganizationsPage.tsx`, `apps/admin-app/src/pages/users/UserDetailPage.tsx`, `apps/admin-app/src/pages/DashboardPage.tsx`

**Interfaces:** Same as Task 2.

- [ ] **Step 1: Swap the dependency**

In `apps/admin-app/package.json`, change:
```json
    "react-router-dom": "^6.30.4",
```
to:
```json
    "react-router": "^7.9.4",
```

- [ ] **Step 2: Replace the import specifier**

Run:
```bash
grep -rl "from 'react-router-dom'" apps/admin-app/src | xargs sed -i '' "s/from 'react-router-dom'/from 'react-router'/g"
```

- [ ] **Step 3: Verify and type-check**

Run: `grep -rl "react-router-dom" apps/admin-app/src` — expect no output.
Run: `pnpm install && pnpm --filter admin-app type-check` — expect no errors.

- [ ] **Step 4: Build and smoke-test**

Run: `pnpm --filter admin-app build`
Then run: `pnpm admin-app:dev` and verify navigation between Dashboard, Organizations, OrganizationDetail, Users, UserDetail.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-app
git commit -m "chore(admin-app): migrate react-router-dom to react-router v7"
```

### Task 5: Update root pnpm overrides for react-router

**Files:**
- Modify: root `package.json` — `pnpm.overrides` block (around line 125-126)

**Interfaces:** None — dependency resolution metadata only.

- [ ] **Step 1: Update the react-router override version floor**

Change:
```json
      "react-router": "^6.30.4",
      "@remix-run/router": "^1.23.2",
```
to:
```json
      "react-router": "^7.9.4",
```
(Drop the `@remix-run/router` line — v7's routing core is bundled into the `react-router` package itself rather than pulled in as a separate `@remix-run/router` dependency.)

- [ ] **Step 2: Verify `@remix-run/router` is no longer resolved**

Run: `pnpm install`
Then run: `pnpm why @remix-run/router`
Expected: "No projects found" / not found. If it IS still found as a transitive dependency of something unrelated, put the override line back with an updated floor version instead of removing it — do not leave a dangling override for a package nothing depends on only if pnpm errors on an unused override (pnpm does not error on this, so removing is safe either way; re-add only if `pnpm install` fails with an "override not used" strict check).

- [ ] **Step 3: Full workspace build**

Run: `pnpm build`
Expected: all packages build cleanly (this is the first point all three frontend apps + shared packages compile together after the router swap).

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(deps): update react-router pnpm override to v7"
```

---

## Phase 3: Prisma `prisma-client-js` → `prisma-client` generator + driver adapter

This phase changes how the backend talks to Postgres: the legacy generator ships a native Rust query-engine binary and lets you override the connection URL's query-string (`pgbouncer=true&connection_limit=2`) at runtime; the new generator has no binary — it runs a WASM query compiler and requires you to supply a **driver adapter** wrapping a real `pg.Pool`. This is why the plan bumps `prisma`/`@prisma/client` to 6.19.2 first (driver-adapter support stabilized as non-preview in 6.15+, so 6.13 would still need a `previewFeatures` flag) and stays within Prisma **6.x** — jumping to the Prisma 7 major is a separate, larger decision not in scope here.

### Task 6: Bump Prisma and add driver-adapter dependencies

**Files:**
- Modify: `apps/backend/package.json` — `dependencies` and `devDependencies`

**Interfaces:**
- Produces: `@prisma/adapter-pg` (`PrismaPg` class) and `pg` (`Pool`) available for Task 10/11 to import.

- [ ] **Step 1: Bump prisma and @prisma/client**

In `apps/backend/package.json`, change:
```json
    "@prisma/client": "6.13.0",
```
to:
```json
    "@prisma/client": "6.19.2",
```
and change:
```json
    "prisma": "6.13.0",
```
to:
```json
    "prisma": "6.19.2",
```

- [ ] **Step 2: Add the driver adapter and pg**

Add to `dependencies` (same version as Prisma core, per Prisma's version-lockstep requirement for adapter packages):
```json
    "@prisma/adapter-pg": "6.19.2",
    "pg": "^8.13.1",
```

Add to `devDependencies`:
```json
    "@types/pg": "^8.11.10",
```

- [ ] **Step 3: Install**

Run: `pnpm install`
Expected: no peer-dependency conflicts. If pnpm reports a peer mismatch between `@prisma/adapter-pg` and `@prisma/client`, pin both to the exact same resolved version and retry.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/package.json pnpm-lock.yaml
git commit -m "chore(backend): bump prisma to 6.19.2, add @prisma/adapter-pg"
```

### Task 7: Switch the generator and regenerate the client

**Files:**
- Modify: `apps/backend/prisma/schema.prisma:4-6` (generator block)
- Modify: `apps/backend/.gitignore:5`
- Create (generated, not hand-written): `apps/backend/src/generated/prisma/*`

**Interfaces:**
- Produces: generated client at `apps/backend/src/generated/prisma/client.ts`, exporting `PrismaClient` and the `Prisma` namespace — verified in Step 3 below. Placing the output **inside `src/`** (not a sibling `apps/backend/generated/`) is deliberate: it keeps the generated `.ts` files under the existing `tsconfig.json` `"include": ["src/**/*", ...]` glob and inside the directory tsc already infers as `rootDir`, avoiding a change to the compiled `dist/` layout that `apps/backend/package.json`'s `"start": "node dist/apps/backend/src/index.js"` script depends on.

- [ ] **Step 1: Update the generator block**

In `apps/backend/prisma/schema.prisma`, change:
```prisma
generator client {
  provider = "prisma-client-js"
}
```
to:
```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}
```
Leave the `datasource db` block untouched — `url`/`directUrl` are still required there for `prisma migrate`/`prisma db push` CLI operations, independent of the runtime driver adapter added in Task 10.

- [ ] **Step 2: Regenerate**

Run: `pnpm --filter backend db:generate`
Expected: completes without error, and `apps/backend/src/generated/prisma/` now exists.

- [ ] **Step 3: Confirm the generated entry point and exports**

Run: `ls apps/backend/src/generated/prisma/`
Run: `grep -n "^export" apps/backend/src/generated/prisma/client.ts | grep -E "PrismaClient|Prisma"`
Expected: `client.ts` exists and the grep shows both `export class PrismaClient` (or similar) and `export namespace Prisma` (or `export * as Prisma`). If the entry file has a different name (e.g. `index.ts`) or the `Prisma` namespace lives in a different file, use that actual filename in place of `client.ts` in every step below — treat this as the authoritative source of truth over this plan's assumption.

- [ ] **Step 4: Update `.gitignore`**

In `apps/backend/.gitignore`, change:
```
/generated/prisma
```
to:
```
/src/generated/prisma
```

- [ ] **Step 5: Commit**

```bash
git add apps/backend/prisma/schema.prisma apps/backend/.gitignore
git commit -m "feat(backend): switch prisma generator to prisma-client with pg driver adapter output"
```
(The generated `src/generated/prisma/` directory itself is gitignored and not committed.)

### Task 8: Wire up the `#prisma-client` subpath import

**Files:**
- Modify: `apps/backend/tsconfig.json` — `compilerOptions.paths`
- Modify: `apps/backend/package.json` — `imports`
- Modify: `apps/backend/vitest.config.ts` — `resolve.alias`

**Interfaces:**
- Consumes: `apps/backend/src/generated/prisma/client.ts` from Task 7.
- Produces: the `#prisma-client` specifier, importable from any backend source or test file as `import { PrismaClient, Prisma } from '#prisma-client'`. This is what Tasks 9-11 use.

- [ ] **Step 1: Add the tsconfig path**

In `apps/backend/tsconfig.json`, inside `compilerOptions.paths`, add (alongside the existing `#graphql-errors` entry):
```json
      "#prisma-client": ["./src/generated/prisma/client.ts"],
```

- [ ] **Step 2: Add the package.json runtime import**

In `apps/backend/package.json`, inside `"imports"`, add:
```json
    "#graphql-errors": "./dist/apps/backend/src/lib/graphqlErrors.js",
    "#prisma-client": "./dist/apps/backend/src/generated/prisma/client.js"
```

- [ ] **Step 3: Add the vitest alias**

In `apps/backend/vitest.config.ts`, inside `resolve.alias`, add:
```ts
      '@': path.resolve(__dirname, './src'),
      '#graphql-errors': path.resolve(__dirname, './src/lib/graphqlErrors.ts'),
      '#prisma-client': path.resolve(__dirname, './src/generated/prisma/client.ts'),
```

- [ ] **Step 4: Smoke-test the mapping**

Run: `pnpm --filter backend type-check`
Expected: no "cannot find module '#prisma-client'" errors yet (nothing imports it until Task 9, so this just confirms the config parses).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/tsconfig.json apps/backend/package.json apps/backend/vitest.config.ts
git commit -m "feat(backend): add #prisma-client subpath import mapping"
```

### Task 9: Rewrite `lib/prisma.ts` to use the driver adapter

**Files:**
- Modify: `apps/backend/src/lib/prisma.ts` (full rewrite)

**Interfaces:**
- Consumes: `PrismaClient` from `#prisma-client` (Task 8), `PrismaPg` from `@prisma/adapter-pg` (Task 6).
- Produces: `export { prisma }` — unchanged signature, still a singleton `PrismaClient` instance. Every downstream repository/service that does `import { prisma } from '../lib/prisma.js'` keeps working with no changes.

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `apps/backend/src/lib/prisma.ts` with:

```typescript
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '#prisma-client';
import { appConfig } from './env.js';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

function isLocalDatabase(url: string): boolean {
  return url.includes('localhost') || url.includes('127.0.0.1');
}

/**
 * Build the pg driver adapter.
 *
 * In production (PgBouncer transaction mode) we keep the app-side pool small
 * (max: 2) — PgBouncer handles real server-side pooling. The adapter does not
 * send named/prepared statements unless a statementNameGenerator is supplied
 * (we don't supply one), which is required for PgBouncer transaction mode
 * compatibility — this replaces the old `pgbouncer=true` query-string flag
 * that the removed query-engine binary used to read.
 */
function buildAdapter(): PrismaPg {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const max = isLocalDatabase(connectionString) ? undefined : 2;

  return new PrismaPg({ connectionString, max });
}

const prisma = globalThis.prisma || new PrismaClient({ adapter: buildAdapter() });

if (!appConfig.isProduction) {
  globalThis.prisma = prisma;
}

export { prisma };
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter backend type-check`
Expected: no errors in `lib/prisma.ts`. (Other files still importing `@prisma/client` directly will still resolve at this point since that package remains installed — they get fixed in Task 11 — but if tsc errors here because `#prisma-client` can't be found, re-check Task 8's `tsconfig.json` path entry.)

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/lib/prisma.ts
git commit -m "feat(backend): use @prisma/adapter-pg driver adapter in lib/prisma.ts"
```

### Task 10: Update the two standalone `PrismaClient` instantiations

**Files:**
- Modify: `apps/backend/src/subscriptions/usageService.ts:1,12`
- Modify: `apps/backend/src/scripts/migrate-deploy.ts:5,47-49`

**Interfaces:**
- Consumes: same `PrismaPg`/`#prisma-client` as Task 9.

- [ ] **Step 1: Update `usageService.ts`**

Change the top of `apps/backend/src/subscriptions/usageService.ts` from:
```typescript
import { PrismaClient } from '@prisma/client';
import {
  emitUsageLimitReached,
  emitUsageLimitExceeded,
  getSubscriptionEventEmitter,
} from './events.js';
import { SubscriptionEventType } from './types.js';
import type { FormViewedEvent, FormSubmittedEvent } from './types.js';
import { logger } from '../lib/logger.js';
import { subscriptionRepository } from '../repositories/subscriptionRepository.js';

const prisma = new PrismaClient();
```
to:
```typescript
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '#prisma-client';
import {
  emitUsageLimitReached,
  emitUsageLimitExceeded,
  getSubscriptionEventEmitter,
} from './events.js';
import { SubscriptionEventType } from './types.js';
import type { FormViewedEvent, FormSubmittedEvent } from './types.js';
import { logger } from '../lib/logger.js';
import { subscriptionRepository } from '../repositories/subscriptionRepository.js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
```
Leave the rest of the file (all the `prisma.subscription.*` calls below) untouched.

- [ ] **Step 2: Update `migrate-deploy.ts`**

Change the import line:
```typescript
import { PrismaClient } from '@prisma/client';
```
to:
```typescript
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '#prisma-client';
```
And change:
```typescript
  const prisma = new PrismaClient({
    datasources: { db: { url: MIGRATION_URL } },
  });
```
to:
```typescript
  const adapter = new PrismaPg({ connectionString: MIGRATION_URL });
  const prisma = new PrismaClient({ adapter });
```
Leave the rest of the file (the `$queryRaw` migration-resolution logic) untouched.

- [ ] **Step 3: Type-check**

Run: `pnpm --filter backend type-check`
Expected: no errors in either file.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/subscriptions/usageService.ts apps/backend/src/scripts/migrate-deploy.ts
git commit -m "feat(backend): use driver adapter in usageService and migrate-deploy scripts"
```

### Task 11: Swap the remaining `@prisma/client` imports to `#prisma-client`

**Files:**
- Modify (type-only or `Prisma` namespace imports, same one-line change in each):
  - `apps/backend/src/plugins/core/context.ts:1`
  - `apps/backend/src/repositories/collaborativeDocumentRepository.ts`
  - `apps/backend/src/repositories/subscriptionRepository.ts`
  - `apps/backend/src/repositories/formMetadataRepository.ts`
  - `apps/backend/src/repositories/formRepository.ts:1`
  - `apps/backend/src/repositories/formViewAnalyticsRepository.ts`
  - `apps/backend/src/repositories/baseRepository.ts:1`
  - `apps/backend/src/repositories/responseRepository.ts`
  - `apps/backend/src/repositories/formSubmissionAnalyticsRepository.ts`
  - `apps/backend/src/repositories/formTemplateRepository.ts`
  - `apps/backend/src/graphql/resolvers/subscriptions.ts`
  - `apps/backend/src/graphql/resolvers/responses.ts:10`
  - `apps/backend/src/services/responseService.ts:11`
  - `apps/backend/src/services/responseEditTrackingService.ts`
- Modify (test infra):
  - `apps/backend/test/helpers/mockPrisma.ts:1`
  - `apps/backend/src/subscriptions/__tests__/usageService.test.ts`

**Interfaces:**
- Consumes: `#prisma-client` from Task 8.

- [ ] **Step 1: Bulk-replace the import specifier in all 14 source files**

Run:
```bash
sed -i '' "s/from '@prisma\/client'/from '#prisma-client'/g" \
  apps/backend/src/plugins/core/context.ts \
  apps/backend/src/repositories/collaborativeDocumentRepository.ts \
  apps/backend/src/repositories/subscriptionRepository.ts \
  apps/backend/src/repositories/formMetadataRepository.ts \
  apps/backend/src/repositories/formRepository.ts \
  apps/backend/src/repositories/formViewAnalyticsRepository.ts \
  apps/backend/src/repositories/baseRepository.ts \
  apps/backend/src/repositories/responseRepository.ts \
  apps/backend/src/repositories/formSubmissionAnalyticsRepository.ts \
  apps/backend/src/repositories/formTemplateRepository.ts \
  apps/backend/src/graphql/resolvers/subscriptions.ts \
  apps/backend/src/graphql/resolvers/responses.ts \
  apps/backend/src/services/responseService.ts \
  apps/backend/src/services/responseEditTrackingService.ts
```
This changes lines like `import type { Prisma } from '@prisma/client';` to `import type { Prisma } from '#prisma-client';` — only the specifier changes, named imports are untouched.

- [ ] **Step 2: Update the two test-infra files**

Run:
```bash
sed -i '' "s/from '@prisma\/client'/from '#prisma-client'/g" \
  apps/backend/test/helpers/mockPrisma.ts \
  apps/backend/src/subscriptions/__tests__/usageService.test.ts
```

- [ ] **Step 3: Verify no source file still imports the raw package**

Run: `grep -rln "from '@prisma/client'" apps/backend/src apps/backend/test`
Expected: no output. (`@prisma/client` stays in `package.json` as a dependency — the generated client's runtime still uses it internally — it's just no longer imported directly anywhere in application code.)

- [ ] **Step 4: Full type-check and unit test run**

Run: `pnpm --filter backend type-check`
Run: `pnpm --filter backend test`
Expected: both pass. If `vitest-mock-extended`'s `mockDeep<PrismaClient>()` in `mockPrisma.ts` errors because the generated `PrismaClient` type shape differs from the old one, inspect the actual error — it's almost always a missing model on the mock, not a structural incompatibility — and adjust the specific broken test's mock setup (not this file wholesale).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src apps/backend/test
git commit -m "feat(backend): migrate remaining @prisma/client imports to #prisma-client"
```

### Task 12: Full backend build and local Postgres verification

**Files:** none (verification only)

**Interfaces:** none

- [ ] **Step 1: Full backend build**

Run: `pnpm --filter backend build`
Then run: `ls apps/backend/dist/apps/backend/src/generated/prisma/`
Expected: build succeeds and the generated client's compiled `.js`/`.d.ts` files exist at that path, confirming the `rootDir`/`outDir` layout was not disturbed and `dist/apps/backend/src/index.js` (the `start` script's entry point) still exists.

- [ ] **Step 2: Start local Postgres and push the schema**

Run: `docker-compose up -d postgres` (or the project's existing local Postgres command — see root `docker-compose.yml`, port 5433)
Run: `pnpm db:push`
Expected: schema pushes cleanly against the local database using the new generator + adapter.

- [ ] **Step 3: Run the backend against local Postgres**

Run: `pnpm backend:dev`
Then exercise, via the form-app or a GraphQL client at `http://localhost:4000/graphql`: sign in (exercises `better-auth` + Prisma), create/list forms (repositories), submit a form response (triggers `usageService.trackFormSubmission`, exercising the standalone `PrismaClient` instance from Task 10).
Expected: no `P2038` ("PrismaClient requires a driver adapter") or connection errors in the logs.

- [ ] **Step 4: Run the full backend test suite and integration tests**

Run: `pnpm test:unit`
Run: `pnpm test:integration`
Expected: both pass.

- [ ] **Step 5: Verify migrate-deploy still works**

Run: `pnpm db:migrate:deploy` against the local database (safe — it's idempotent per the script's own resolve-as-applied logic).
Expected: completes without error, confirming the adapter-based `PrismaClient` in `migrate-deploy.ts` connects correctly.

- [ ] **Step 6: Final commit**

If any fixes were needed during verification, commit them now with a descriptive message (e.g. `fix(backend): correct mockPrisma model coverage after prisma-client migration`). If nothing needed fixing, this task produces no commit — Task 11's commit already stands as the completion point.

---

## Post-plan note

Do not proceed to a Prisma 7 major-version upgrade as a follow-on to this plan without a fresh scoping conversation — Prisma 7 removes the query-engine binary path entirely (no fallback) and changes the schema file format further; this plan intentionally stops at Prisma 6.19 + the new generator, which already captures the "outdated approach" fix without taking on a major-version migration.

# Major Version Migrations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade 5 packages to their latest major versions — Vite v5→v7, Nodemailer v7→v8, @apollo/server v4→v5, @apollo/client v3→v4, @hocuspocus/server+extension-database v3→v4 — with one commit per migration.

**Architecture:** Tasks 1–5 run as parallel agents in isolated worktrees. Each agent edits ONLY its assigned package.json version entries and any required source code — no `pnpm install`. After all 5 complete, a single integration pass merges the diffs, runs `pnpm install`, fixes remaining type errors, runs tests, and pushes.

**Tech Stack:** pnpm workspaces, TypeScript, Vite 7, Apollo Server 5 + Apollo Client 4, Hocuspocus 4, Nodemailer 8

---

## File Map

| Task | package.json lines | Source files |
|---|---|---|
| 1 — Vite | form-app `vite ^5.4.21`, admin-app `vite ^5.4.21` | None expected |
| 2 — Nodemailer | backend `nodemailer ^7.0.13` | None expected |
| 3 — Apollo Server | backend `@apollo/server ^4.13.0` | `apps/backend/src/index.ts` |
| 4 — Apollo Client | form-app, admin-app, form-viewer `@apollo/client ^3.14.1`; remove form-app/admin-app `apollo-upload-client` (unused in source) | `apps/*/src/services/apolloClient.ts` |
| 5 — Hocuspocus | backend `@hocuspocus/server ^3.4.4`, `@hocuspocus/extension-database ^3.4.4` | `apps/backend/src/services/hocuspocus.ts` |
| 6 — Integration | `pnpm-lock.yaml` | Any residual type errors |

---

## Task 1 — Vite v5 → v7 (form-app + admin-app)

**Files:** `apps/form-app/package.json`, `apps/admin-app/package.json`

No source changes needed — both vite.config.ts files use only stable APIs (`defineConfig`, `react()`, `resolve.alias`, `server.proxy`, `build.rollupOptions`). form-viewer is already on Vite v7.3.5 with identical `@vitejs/plugin-react@^4.7.0`.

- [ ] **Step 1: Bump vite in form-app**

In `apps/form-app/package.json`, change:
```json
"vite": "^5.4.21"
```
to:
```json
"vite": "^7.3.5"
```

- [ ] **Step 2: Bump vite in admin-app**

In `apps/admin-app/package.json`, change:
```json
"vite": "^5.4.21"
```
to:
```json
"vite": "^7.3.5"
```

- [ ] **Step 3: Commit**

```bash
git add apps/form-app/package.json apps/admin-app/package.json
git commit -m "chore(deps): bump vite from 5.4.21 to 7.3.5 in form-app and admin-app"
```

---

## Task 2 — Nodemailer v7 → v8 (backend)

**Files:** `apps/backend/package.json`

Current usage in `apps/backend/src/services/emailService.ts`:
- `nodemailer.createTransport({ host, port, secure, requireTLS, auth })` — unchanged in v8
- `await transporter.sendMail({ from, to, subject, html, text })` — unchanged in v8
- `@types/nodemailer` stays at `^6.4.23` (v8 still ships no bundled types; DefinitelyTyped covers it)

Before making the change, fetch the nodemailer v8 changelog to confirm no transport API breaks:
```bash
curl -s https://raw.githubusercontent.com/nodemailer/nodemailer/master/CHANGELOG.md | head -80
```
If `createTransport` or `sendMail` API signatures changed, fix `apps/backend/src/services/emailService.ts` accordingly before committing.

- [ ] **Step 1: Bump nodemailer in backend**

In `apps/backend/package.json`, change:
```json
"nodemailer": "^7.0.13",
```
to:
```json
"nodemailer": "^8.0.5",
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/package.json
git commit -m "chore(deps): bump nodemailer from 7.0.13 to 8.0.5"
```

---

## Task 3 — @apollo/server v4 → v5 (backend)

**Files:** `apps/backend/package.json`, `apps/backend/src/index.ts`

The backend already uses `expressMiddleware` (not `startStandaloneServer`), so the biggest v5 breaking change does not apply. Known v5 changes to address:

**a) `ApolloServerPluginLandingPageLocalDefault` embed options restructured in v5:**
The `embed.initialState` field was removed; options moved to the top level.

**b) `formatError` callback signature:** Verify after bumping — TypeScript will catch any mismatch.

**c) Import paths:** `@apollo/server/express4` and `@apollo/server/plugin/landingPage/default` and `@apollo/server/plugin/disabled` — verify these subpath exports still exist in v5; if they moved, the TypeScript compiler will report the error.

- [ ] **Step 1: Bump @apollo/server in backend**

In `apps/backend/package.json`, change:
```json
"@apollo/server": "^4.13.0",
```
to:
```json
"@apollo/server": "^5.5.0",
```

- [ ] **Step 2: Install and find type errors**

```bash
pnpm install --filter backend
pnpm --filter backend exec tsc --noEmit 2>&1 | head -60
```

Read every error. The TypeScript output will show exactly which imports or call signatures changed.

- [ ] **Step 3: Fix `ApolloServerPluginLandingPageLocalDefault` options**

If the compiler reports errors on `embed.initialState`, `embed.endpointIsEditable`, `embed.runTelemetry`, update the block in `apps/backend/src/index.ts` (around line 237–248).

v5 signature — move initialState options to top level:
```typescript
ApolloServerPluginLandingPageLocalDefault({
  footer: false,
  includeCookies: true,
  embed: true,
})
```
If v5 removed `embed` entirely, replace with just:
```typescript
ApolloServerPluginLandingPageLocalDefault({
  footer: false,
  includeCookies: true,
})
```

- [ ] **Step 4: Fix any other type errors**

Address each remaining compiler error in `index.ts`. Common v5 changes:
- If `@apollo/server/express4` subpath no longer exists, change to `@apollo/server/express4` (same) or whatever the compiler suggests
- If `formatError` signature changed, update the callback at line 250

- [ ] **Step 5: Verify tests pass**

```bash
pnpm --filter backend test 2>&1 | tail -5
```
Expected: `Test Files  81 passed (81)`

- [ ] **Step 6: Commit**

```bash
git add apps/backend/package.json apps/backend/src/index.ts
git commit -m "chore(deps): bump @apollo/server from 4.13.0 to 5.5.0"
```

---

## Task 4 — @apollo/client v3 → v4 (all frontend apps)

**Files:** `apps/form-app/package.json`, `apps/admin-app/package.json`, `apps/form-viewer/package.json`, and their `apolloClient.ts` files.

Apollo Client v4 is largely API-compatible with v3. The main items to verify:
- `@apollo/client/link/error` and `@apollo/client/link/context` subpath imports still exist
- `apollo-upload-client@18` is listed in form-app and admin-app dependencies but **not used anywhere in source** — remove it

- [ ] **Step 1: Bump @apollo/client in all three apps**

`apps/form-app/package.json`: change `"@apollo/client": "^3.14.1"` → `"^4.2.2"`
`apps/admin-app/package.json`: change `"@apollo/client": "^3.14.1"` → `"^4.2.2"`
`apps/form-viewer/package.json`: change `"@apollo/client": "^3.14.1"` → `"^4.2.2"`

- [ ] **Step 2: Remove unused apollo-upload-client from form-app and admin-app**

`apps/form-app/package.json` — delete the line:
```json
"apollo-upload-client": "18.0.1",
```

`apps/admin-app/package.json` — delete the line:
```json
"apollo-upload-client": "18.0.1",
```

- [ ] **Step 3: Install and find type errors**

```bash
pnpm install --filter form-app --filter admin-app --filter form-viewer
pnpm --filter form-app exec tsc --noEmit 2>&1 | head -40
pnpm --filter admin-app exec tsc --noEmit 2>&1 | head -40
pnpm --filter form-viewer exec tsc --noEmit 2>&1 | head -40
```

- [ ] **Step 4: Fix any link import path changes**

If `@apollo/client/link/error` or `@apollo/client/link/context` no longer exist as subpath exports, update `apps/form-app/src/services/apolloClient.ts`:

Current (lines 1–3):
```typescript
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
```

If subpaths moved in v4, the compiler will report `Cannot find module '@apollo/client/link/error'`. In that case update to whatever the v4 package exports (check `node_modules/@apollo/client/package.json` for `exports` field).

- [ ] **Step 5: Fix any other type errors**

Address each remaining error. The `ApolloClient` constructor, `InMemoryCache`, `useQuery`, `useMutation`, `useApolloClient` APIs are unchanged in v4.

- [ ] **Step 6: Run form-viewer unit tests**

```bash
pnpm --filter form-viewer test:unit 2>&1 | tail -5
```
Expected: `Test Files  3 passed (3)`

- [ ] **Step 7: Commit**

```bash
git add apps/form-app/package.json apps/admin-app/package.json apps/form-viewer/package.json
git add apps/form-app/src/services/apolloClient.ts apps/admin-app/src/services/apolloClient.ts apps/form-viewer/src/services/apolloClient.ts
git commit -m "chore(deps): bump @apollo/client from 3.14.1 to 4.2.2 and remove unused apollo-upload-client"
```

---

## Task 5 — @hocuspocus/server + extension-database v3 → v4 (backend)

**Files:** `apps/backend/package.json`, `apps/backend/src/services/hocuspocus.ts`

The hocuspocus service is critical to real-time collaboration. Do NOT guess — let TypeScript errors guide every change.

Current usage in `hocuspocus.ts`:
- `new Hocuspocus({ quiet, extensions, onAuthenticate, onConnect, onDisconnect, onChange })`
- `new Database({ fetch, store })` extension
- `onAuthenticate` receives `{ documentName, token, requestHeaders, requestParameters, connectionConfig }`
- `onChange` receives `{ documentName, document, context }`

- [ ] **Step 1: Bump both hocuspocus packages**

`apps/backend/package.json`:
```json
"@hocuspocus/extension-database": "^4.1.0",
"@hocuspocus/server": "^4.1.0",
```

- [ ] **Step 2: Install and find type errors**

```bash
pnpm install --filter backend
pnpm --filter backend exec tsc --noEmit 2>&1 | grep -E "hocuspocus|onAuthenticate|onChange|onConnect|Database" | head -40
```

Read every error. The TypeScript output is the authoritative guide to what changed in v4.

- [ ] **Step 3: Fix `onAuthenticate` parameter shape**

If v4 renamed or restructured `connectionConfig` or the return value shape, update the `onAuthenticate` callback in `apps/backend/src/services/hocuspocus.ts` (lines 160–243).

The return value `{ user: { id, email, permission, formId } }` shape — update if TypeScript reports an incompatible return type.

- [ ] **Step 4: Fix `Database` extension callback shapes**

If v4 changed `fetch` or `store` callback parameters (e.g., added required fields or renamed `documentName`), update the callbacks in `hocuspocus.ts` (lines 73–157).

- [ ] **Step 5: Fix any remaining type errors in hocuspocus.ts**

Work through the full `tsc --noEmit` output. Every error must be fixed — do NOT add `as any` casts to silence type errors from the migration; they hide real breaking changes.

- [ ] **Step 6: Verify backend tests pass**

```bash
pnpm --filter backend test 2>&1 | tail -5
```
Expected: `Test Files  81 passed (81)`

- [ ] **Step 7: Commit**

```bash
git add apps/backend/package.json apps/backend/src/services/hocuspocus.ts
git commit -m "chore(deps): bump @hocuspocus/server and extension-database from 3.4.4 to 4.1.0"
```

---

## Task 6 — Integration Pass

> This task runs AFTER all 5 migration tasks complete. Run in the main working tree (not a worktree).

- [ ] **Step 1: Verify the 5 commits are all staged but not pushed**

```bash
git log --oneline -8
```
Expect to see the 5 migration commits on top plus the previous main commits.

- [ ] **Step 2: Run full pnpm install**

```bash
pnpm install
```

Expected: resolves cleanly, no peer dependency errors except the pre-existing `@ai-sdk/react` zod warning.

- [ ] **Step 3: Run full type-check**

```bash
pnpm type-check 2>&1
```

Fix any errors not already handled in tasks 1–5. Common integration-only issues:
- Version range collisions in the lock file (rare)
- A package depending on another upgraded package needing a type tweak

- [ ] **Step 4: Run unit tests**

```bash
pnpm test:unit 2>&1 | tail -6
```

Expected: `Test Files  81 passed (81)`, `Tests  2165 passed (2165)`

- [ ] **Step 5: Run form-viewer unit tests**

```bash
pnpm --filter form-viewer test:unit 2>&1 | tail -4
```

Expected: `Test Files  3 passed (3)`

- [ ] **Step 6: Push all commits**

```bash
git push origin main
```

The pre-push hook runs: form-viewer tests, backend coverage (≥79%), full type-check. All must pass.

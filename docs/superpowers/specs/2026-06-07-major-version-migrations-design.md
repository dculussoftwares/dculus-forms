# Major Version Migrations Design

**Date:** 2026-06-07  
**Approach:** 5 parallel agents (Approach A) — each edits package.json + source only, no `pnpm install`. One install + validate pass in main thread after all 5 complete.  
**Commit strategy:** One commit per migration, all pushed together.

---

## Migration 1 — Vite v5 → v7 (form-app + admin-app)

**Target version:** `^7.3.2` (matching form-viewer which is already there and passing)

**Files changed:**
- `apps/form-app/package.json`: `"vite": "^5.4.20"` → `"^7.3.2"`
- `apps/admin-app/package.json`: `"vite": "^5.4.20"` → `"^7.3.2"`
- Update `@vitejs/plugin-react` to latest v4.x if needed

**Code changes:** None expected. Both configs use only stable APIs:
- `defineConfig`, `react()` plugin, `resolve.alias`, `server.proxy`, `build.rollupOptions.manualChunks`
- Agent confirms no breaking changes in vite.config.ts files before committing

**Success criteria:** `pnpm type-check` passes for form-app and admin-app; `pnpm build` produces output without errors.

---

## Migration 2 — Nodemailer v7 → v8 (backend)

**Target version:** `^8.0.5`

**Files changed:**
- `apps/backend/package.json`: `"nodemailer": "^7.0.11"` → `"^8.0.5"`

**Code changes:** Agent reads nodemailer v8 changelog to confirm API stability. Current usage is:
- `nodemailer.createTransport({ host, port, secure, requireTLS, auth })`
- `await transporter.sendMail({ from, to, subject, html, text })`

Both APIs are stable in v8. No code changes expected unless changelog shows otherwise.

**`@types/nodemailer`** stays at `^6.4.14` (v8 still does not bundle types).

**Success criteria:** `pnpm test:unit` passes; emailService tests pass.

---

## Migration 3 — @apollo/server v4 → v5 (backend)

**Target version:** `^5.5.0`

**Files changed:**
- `apps/backend/package.json`: `"@apollo/server": "^4.13.0"` → `"^5.5.0"`
- `apps/backend/src/index.ts`: API fixes (see below)

**Known breaking changes to fix in `index.ts`:**
1. `formatError` signature: v5 changed to a single `GraphQLFormattedError` object — update callback
2. `ApolloServerPluginLandingPageLocalDefault` options: verify `embed.initialState` shape changed in v5
3. Plugin hook: verify `requestDidStart` / `didResolveOperation` hook names unchanged
4. Import path `@apollo/server/express4` — unchanged in v5 ✓
5. `server.start()` / `server.stop()` — unchanged in v5 ✓

The backend already uses `expressMiddleware` (not `startStandaloneServer`), so the biggest v5 breaking change does not affect this codebase.

**Success criteria:** Backend starts without error; `pnpm test:unit` passes; `pnpm type-check` passes.

---

## Migration 4 — @apollo/client v3 → v4 (all 3 frontend apps)

**Target version:** `^4.2.2`

**Files changed:**
- `apps/form-app/package.json`, `apps/admin-app/package.json`, `apps/form-viewer/package.json`
- `apps/*/src/services/apolloClient.ts` (3 files) — link import path verification

**Known surface to verify:**
- `@apollo/client/link/error` — verify subpath still exists in v4
- `@apollo/client/link/context` — verify subpath still exists in v4
- `InMemoryCache()` constructor — stable
- `useQuery`, `useMutation`, `useApolloClient` hooks — API unchanged
- `apollo-upload-client@18` — check v4 compatibility; if broken, remove and note

The 96 files that use `gql` template literals require no changes (tagged template API is unchanged).

**Success criteria:** `pnpm type-check` passes for all frontend apps; form-viewer unit tests (16) pass.

---

## Migration 5 — @hocuspocus/server + extension-database v3 → v4 (backend)

**Target versions:** `"@hocuspocus/server": "^4.1.0"`, `"@hocuspocus/extension-database": "^4.1.0"`

**Files changed:**
- `apps/backend/package.json`: both packages bumped
- `apps/backend/src/services/hocuspocus.ts`: hook parameter shape updates

**Known API surface to verify (all in `hocuspocus.ts`):**
1. `Database` extension: `fetch({ documentName })` and `store({ documentName, state, document })` callback shapes
2. `onAuthenticate` hook: parameter structure — v4 may have renamed fields in the auth context object
3. `onConnect` / `onDisconnect`: `documentName` still top-level
4. `onChange`: `{ documentName, document, context }` shape
5. `connectionConfig.readOnly` — flag for viewer-only access

Agent reads the hocuspocus v4 changelog/migration guide before making changes.

**Risk:** Medium-high — powers real-time collaborative editing. Incorrect hook parameters would silently fail auth or corrupt documents.

**Success criteria:** `pnpm test:unit` passes; hocuspocus service compiles cleanly; `pnpm type-check` passes.

---

## Integration Pass (after all 5 agents complete)

1. Merge all 5 sets of package.json edits + source changes into main working tree
2. Run `pnpm install` once
3. Run `pnpm type-check` — fix any remaining issues
4. Run `pnpm test:unit` — fix any test failures
5. Push all 5 commits (one per migration) to main

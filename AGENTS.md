# AGENTS.md

Compact guide for AI agents. Deeper, domain-specific guidance already exists in these files — read the relevant one(s) before non-trivial work:

- `CLAUDE.md` — full architecture, conventions, env vars, authorization model
- `.github/copilot-instructions.md` — architecture + patterns (mirrors `CLAUDE.md`)
- `.github/instructions/*.md` — per-domain guides with `applyTo` globs: `backend`, `frontend`, `graphql`, `database`, `authentication`, `i18n`, `shared-packages`, `testing`
- `.github/agents/*.agent.md` — specialized agent personas (code-reviewer, debugger, feature-developer, field-type-developer, deployment-guide)
- `apps/backend/prisma/schema.prisma` — canonical data model

This file captures only what those don't make obvious.

## Trust executable sources, not the README

- `README.md` is stale and wrong in dangerous ways: it claims the DB is **MongoDB** + Mongo Express, but the real DB is **PostgreSQL** (`docker-compose.yml`: `postgres:16`). It says Node >=18; the real requirement is **Node 22**. Its "Future Enhancements" list items (auth, DB, file upload, etc.) are all already built.
- Always verify commands/capabilities against `package.json` scripts and config, not README prose.

## Runtime

- Node **22.14.0** (`.nvmrc`; `engines` needs `>=22.12.0`). pnpm `8.15.0`.
- Local Postgres via `pnpm docker:up` → port `:5433` (user `dculus`, db `dculus_forms`, trust auth). pgAdmin on `:5050`.
- Backend env in `apps/backend/.env`; each frontend app has its own `.env` with `VITE_*` vars. Full lists in `CLAUDE.md`.
- `pnpm backend:dev` auto-runs `prisma generate` first (`predev` hook).

## Shared packages: source vs dist (easy to get wrong)

`@dculus/types`, `@dculus/ui`, `@dculus/utils` declare `main: dist/index.js`.

- **Frontend apps alias `@dculus/*` to package SOURCE** (see each `apps/*/vite.config.ts`). Editing a shared package is picked up by frontend dev/build immediately — no package build needed.
- **Backend resolves `@dculus/types` / `@dculus/utils` to built `dist/`** (node module resolution). After editing a shared package, rebuild it (`pnpm --filter @dculus/types build`) before backend dev/build/start will see the change.
- `pnpm dev` does **not** build or watch the shared packages — the `ui` filter starts Storybook, and `types`/`utils` aren't watched at all. Run `pnpm --filter @dculus/<pkg> build` (or `dev` for `@dculus/types`) manually.
- Import only via package names (`@dculus/ui`, `@dculus/utils`, `@dculus/types`); never relative paths into `packages/*/src`.

## Verification — what actually runs locally

- **pre-commit (lefthook)**: `lint-staged` only (eslint --fix on staged files).
- **pre-push (lefthook, parallel)**: `backend test:coverage`, `form-viewer test:unit`, and `build` of form-viewer + form-app + admin-app. This mirrors CI.
- NOT run by hooks: root `pnpm type-check`, full `pnpm lint`, backend `build`, form-app unit tests. Run these manually when you touch those areas.
- `pnpm test` (recursive) runs **only** backend (vitest) + form-app (jest). form-viewer uses `test:unit`, admin-app has no tests.

## Test runners differ per app (don't assume one)

- backend → **vitest**. `pnpm test:unit` / `:watch` / `:coverage` / `:ui`. Tests: `src/**/*.{test,spec}.ts`.
- form-app → **jest** (ts-jest). `pnpm --filter form-app test`.
- form-viewer → **vitest**. `pnpm --filter form-viewer test:unit`.
- admin-app → none.
- Backend coverage thresholds are enforced (fail CI): lines/functions/statements **80%**, branches **78%** (vitest 4.1 v8 instrumentation quirk; see `apps/backend/vitest.config.ts`).
- Integration tests (`test/integration/`, Cucumber.js) hit a **real running backend**, no mocks — start the backend first or set `TEST_BASE_URL`. By-tag helper: `./test-integration-by-tags.sh`.
- E2E (`test/e2e/`, Playwright + Cucumber) needs all services up (:4000 / :3000 / :5173); creds + URLs via `E2E_*` env vars (defaults baked into the `test:e2e` script). Default run **excludes** `@mass-responses`, `@persistence`, `@skip-ci`. Single tag: `pnpm test:e2e --tags '@tagname'`.

## Backend quirks

- Backend is **ESM** (`"type": "module"`). Intra-backend TS imports must use **`.js` extensions** (e.g. `from '../lib/graphqlErrors.js'`) even though the source file is `.ts`. Omitting them breaks the build.
- `#graphql-errors` is a subpath import (`apps/backend/package.json` `imports` + vitest alias). Prefer it over hardcoding the path.
- In resolvers, throw via `createGraphQLError(msg, GRAPHQL_ERROR_CODES.X)` from `@dculus/types/graphql.js` — never `throw new Error()`.
- `db:migrate:deploy` runs a custom script (`src/scripts/migrate-deploy.ts`), not `prisma migrate deploy` directly.
- Layering: Resolvers (thin) → Services → Repositories → Prisma. Don't call Prisma directly from resolvers.

## Conventions that differ from defaults

- **i18n is mandatory** in form-app: English (`en`) + Tamil (`ta`). Every user-facing string goes through `useTranslation('namespace')`; register new namespaces in `apps/form-app/src/locales/index.ts`. Hardcoded strings fail review.
- FormField instances in `@dculus/types` must be (de)serialized (`serializeFormSchema` / `deserializeFormSchema`) before DB or Y.js storage — never persist raw class instances.
- Public repo: never commit `.env`, keys, or tokens. Check `git status` / `git diff` before committing.

## Infra / deploy

- Infra-as-code lives in `infrastructure/` (Terraform). Use `gh` and `az` CLIs for **read/debug only** — create Azure resources via Terraform, not the CLI.
- Deploy targets: backend → Azure Container Apps; frontend apps → Cloudflare Pages. Guides in `docs/deployment/`.

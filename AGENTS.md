# AGENTS.md

Compact guide for AI agents. Deeper, domain-specific guidance already exists in these files — read the relevant one(s) before non-trivial work:

- `CLAUDE.md` — full architecture, commands, conventions, env vars, authorization model, worktree setup
- `.github/copilot-instructions.md` and `.github/instructions/*.md` — per-domain guides: `backend`, `frontend`, `graphql`, `database`, `authentication`, `i18n`, `shared-packages`, `testing`
- `.github/agents/*.agent.md` (`code-reviewer`, `debugger`, `feature-developer`, `deployment-guide`, `Explore`) and `.claude/agents/*.md` (feature personas: `pdf-template-expert`, `plugin-generator`, `new-field-generator`, `subscription-billing-expert`, `auth-permission-auditor`, `response-filter-auditor`, `e2e-test-writer`)
- `docs/architecture/` — 12 end-to-end walkthroughs (submission lifecycle, event fan-out, automations, plugins, PDF, collaboration, AI editor, authorization, billing, storage)
- `apps/backend/prisma/schema.prisma` — canonical data model

This file captures only what those don't make obvious.

## Trust executable sources, not the README

- `README.md` is stale and wrong in dangerous ways: it claims the DB is **MongoDB** + Mongo Express; the real DB is **PostgreSQL 16** (`docker-compose.yml`). It says Node >=18; the real requirement is **Node 22**. Its "Future Enhancements" (auth, database, file upload…) are all already built.
- The tracked `.agent/*.md` docs are also partly stale (Node 18+, links to removed root-level guides). Verify against `package.json` scripts and config.

## Repo map / ports

- `apps/backend` — Express + Apollo GraphQL (code-first) + Hocuspocus Y.js collaboration server, :4000
- `apps/form-app` — main React form builder, :3000 (dev-proxies `/api` + `/graphql` → :4000)
- `apps/form-viewer` — public form submission app, :5173
- `apps/admin-app` — admin dashboard, :3002
- `packages/{types,ui,utils,plugins}` — shared packages
- `pnpm dev` starts backend + all three apps + `@dculus/ui` Storybook (:6006)

## Runtime

- Node **22.14.0** (`.nvmrc`; `engines` needs >=22.12.0). pnpm **8.15.0** (`packageManager`).
- Local Postgres via `pnpm docker:up` → port `:5433` (user/db `dculus` / `dculus_forms`, trust auth). pgAdmin on `:5050`.
- Backend env in `apps/backend/.env`; each frontend app has its own `.env` with `VITE_*` vars. Full lists in `CLAUDE.md`.
- `pnpm backend:dev` auto-runs `prisma generate` first (`predev` hook).
- **New git worktree?** Run `./scripts/setup-worktree.sh` once before anything else. Worktrees lack `.env` files, `node_modules`, built package dists, and the generated Prisma client — dev/type-check/tests fail confusingly until you do.

## Shared packages: source vs dist (easy to get wrong)

`@dculus/types`, `@dculus/ui`, `@dculus/utils`, `@dculus/plugins` all declare `main: dist/index.js`.

- **Frontend apps alias `@dculus/*` to package SOURCE** (see each `apps/*/vite.config.ts`; form-app also aliases `@dculus/plugins`). Editing a shared package is picked up by frontend dev/build immediately — no package build needed.
- **Backend resolves `@dculus/types` / `@dculus/utils` to built `dist/`** (node module resolution). After editing those, rebuild (`pnpm --filter @dculus/types build`) before backend dev/build/start will see the change.
- `pnpm dev` does **not** build or watch the shared packages — the `ui` filter starts Storybook; `types`/`utils`/`plugins` aren't watched at all. Run `pnpm --filter @dculus/<pkg> build` (or `dev` for `@dculus/types`) manually.
- Import only via package names (`@dculus/ui`, `@dculus/utils`, `@dculus/types`); never relative paths into `packages/*/src`.

## Verification — what actually runs where

- **pre-commit (lefthook)**: `lint-staged` only (eslint --fix on staged files).
- **pre-push (lefthook, parallel)**: backend `test:coverage` (thresholds enforced), form-viewer `test:unit`, and builds of form-viewer + form-app + admin-app.
- **CI (`build.yml`) additionally**: `pnpm lint` + `pnpm type-check`, backend `build`, `@dculus/types` + `@dculus/ui` unit tests, integration tests, E2E (sharded).
- **Never run automatically**: form-app jest tests — not in hooks and not in CI. Run `pnpm --filter form-app test` yourself after touching form-app logic.

## Test runners and suites (differ per app — don't assume one)

- backend → **vitest**: `pnpm --filter backend test` / `test:watch` / `test:ui` / `test:coverage` (root `pnpm test:unit` = backend test). Tests: `src/**/*.{test,spec}.ts`. Coverage thresholds enforced: lines/functions/statements **80%**, branches **78%** (vitest 4.1 v8 instrumentation quirk; see `apps/backend/vitest.config.ts`).
- form-app → **jest**; form-viewer → **vitest** (`test:unit`); admin-app → none.
- Root `pnpm test` (recursive) runs the `test` scripts of backend + form-app + `@dculus/types` + `@dculus/ui` only.
- **Integration** (`test/integration/`, Cucumber — real backend + Postgres, mock SMTP/S3):
  - Build the backend first: `pnpm db:generate && pnpm --filter backend build` (the harness imports the compiled Prisma client and throws if `dist/` is missing).
  - The harness starts its own Postgres (`:5543`, `test/integration/docker-compose.postgres.yml`) and spawns the backend itself — no need to run `pnpm dev` first. Point `TEST_BASE_URL` at an already-running/remote backend instead.
  - By-tag runner: `./test-integration-by-tags.sh` (`--help` lists tags).
- **E2E** (`test/e2e/`, Playwright + Cucumber): needs form-app :3000, form-viewer :5173, backend :4000 up (or `E2E_*` overrides; defaults baked into the `test:e2e` script). Default run **excludes** `@mass-responses`, `@persistence`, `@skip-ci`, `@collaboration`; use the dedicated scripts (`test:e2e:collab`, `:embed`, `:max-responses`, `:mass-responses`) or `pnpm test:e2e --tags '@tagname'`.
- **AI evals**: `pnpm --filter backend eval:ai` runs live-model evals (`apps/backend/src/evals/*.live.eval.ts`) against real provider deployments — opt-in, nightly in CI, never part of `pnpm test`.

## Backend quirks

- Backend is **ESM** (`"type": "module"`). Intra-backend TS imports must use **`.js` extensions** (e.g. `from '../lib/graphqlErrors.js'`) even though the source file is `.ts`. Omitting them breaks the build.
- Subpath imports (`apps/backend/package.json` `imports` + vitest aliases): `#graphql-errors` → `src/lib/graphqlErrors.ts`, `#prisma-client` → generated client. Prefer them over hardcoded paths.
- In resolvers, throw via `createGraphQLError(msg, GRAPHQL_ERROR_CODES.X)` from `@dculus/types/graphql.js` — never `throw new Error()`.
- Prisma uses the `prisma-client` generator (not `prisma-client-js`) outputting to `apps/backend/src/generated/prisma` (gitignored, ESM, requires the `@prisma/adapter-pg` driver adapter). Pulling code does **not** refresh it: run `pnpm db:generate` + `pnpm db:push` after schema changes. Stale client → silent missing fields ("Cannot return null for non-nullable field…"); missing column → `P2022`.
- Schema changes also need a **committed migration** under `apps/backend/prisma/migrations/`; deploys run `db:migrate:deploy`, a custom script (`src/scripts/migrate-deploy.ts`) — never `db push` in deploy paths.
- Layering: Resolvers (thin) → Services → Repositories → Prisma. Don't call Prisma directly from resolvers.

## Subsystems worth knowing

**PDF templates & generators (pdfme)** — form-scoped designer: drag form fields onto an uploaded PDF to render filled copies. Read `.claude/agents/pdf-template-expert.md` + `docs/pdf-template-designer-redesign.md` before non-trivial work.

- Backend: `src/graphql/resolvers/pdfTemplates.ts` → `src/services/pdfTemplateService.ts`; bulk/repeatable generators via `resolvers/pdfGenerators.ts`. Prisma models `PdfTemplate` (`pdf_template`) / `PdfGenerator` (`pdf_generator`); template schemas stored as JSONB.
- Frontend (form-app): designer in `src/components/pdf-designer/`; pages `src/pages/PdfTemplateDesigner.tsx`, `PdfTemplates.tsx`; bulk UI `src/components/PdfGenerators/`; per-response button `src/components/Responses/GeneratePdfButton.tsx`; i18n namespaces `pdfTemplates` + `pdfGenerators`.
- Worker asset gotcha: `@pdfme/converter`'s PDF-render worker is served via a Vite fallback (`vite-pdfme-worker-fallback.ts`) in dev — don't delete it expecting pdfme to "just work."

**Plugins** — manifests (UI metadata, used by form-app's plugin gallery): `packages/plugins/src/manifests/*`; backend handlers: `apps/backend/src/plugins/{type}/`, registered via `apps/backend/src/plugins/core/registry.ts`. Only two events exist: `form.submitted`, `plugin.test`. Plugins for a form run sequentially (intentional — avoids response-metadata write races); don't parallelize. The `slack` manifest is a UI-only "coming soon" placeholder with no backend handler — don't use it as a scaffold template. Read `.claude/agents/plugin-generator.md` before adding one.

**Automations** — backend `src/services/automation/` + `resolvers/automations.ts`; builder UI `apps/form-app/src/components/automations/`; see `docs/architecture/04-automations.md`.

## Conventions that differ from defaults

- **i18n is mandatory** in form-app: English (`en`) + Tamil (`ta`). Every user-facing string goes through `useTranslation('namespace')`; register new namespaces in `apps/form-app/src/locales/index.ts`. Hardcoded strings fail review.
- FormField instances in `@dculus/types` must be (de)serialized (`serializeFormSchema` / `deserializeFormSchema`) before DB or Y.js storage — never persist raw class instances.
- Commits follow Conventional Commits (`feat:`, `fix:`, `chore:`…); branch names like `feature/…`, `fix/…`.
- Public repo: never commit `.env`, keys, or tokens. Check `git status` / `git diff` before committing.

## Infra / deploy

- Infra-as-code lives in `infrastructure/` (Terraform). Use `gh` / `az` for **read/debug only** — create Azure resources via Terraform, not the CLI.
- Deploy targets: backend → Azure Container Apps; frontends → Cloudflare Pages. `main` pushes auto-deploy to dev; `release.yml` promotes the dev-verified image to production. Guides in `docs/deployment/`.

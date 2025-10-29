# Repository Guidelines

## Project Structure & Module Organization
- `apps/backend`: Express + Apollo GraphQL API; core logic sits in `src/graphql`, `src/services`, and Prisma schema in `prisma/`.
- `apps/form-app`: React form builder client with Vite; features in `src/components`, routes in `src/pages`.
- Other frontends (`apps/form-viewer`, `apps/admin-app`) follow the same pattern: features in `src/components`, routes in `src/pages`.
- Shared packages (`packages/ui`, `packages/utils`, `packages/types`) deliver reusable UI primitives, utilities, and contracts; update these before duplicating logic.
- Acceptance coverage lives under `test/integration` (Cucumber + supertest) and `test/e2e` (Playwright); bash harnesses in repo root help with CI parity.

## Build, Test, and Development Commands
- `pnpm install` resolves workspace deps; rerun after shared package bumps.
- `pnpm dev` boots backend + all clients (form-app, form-viewer, admin-app).
- `pnpm form-app:dev`, `pnpm form-viewer:dev`, and `pnpm admin-app:dev` run individual apps.
- `pnpm build` and app-specific preview commands validate production bundles.
- `pnpm lint`, `pnpm type-check`, and `pnpm clean` (from repo root) cover linting, project references, and cache resets. Combine `pnpm lint && pnpm type-check` before PRs.
- Backend-only flows rely on `pnpm backend:dev`, `pnpm backend:build`, and the database helpers (`pnpm db:generate`, `pnpm db:push`, `pnpm db:seed`).

## Coding Style & Naming Conventions
- TypeScript everywhere; Prettier enforces 2-space indentation, 80 char wrap, single quotes, and semicolons (`pnpm prettier --write` if you need a nudge).
- ESLint (`.eslintrc.js`) errors on unused vars and warns on `any`; prefix `_` for intentional omissions.
- Components live in PascalCase files; hooks stay camelCase; context providers end with `Provider`. GraphQL operations use intent-first names like `UpdateFormMutation`.

## Testing Guidelines
- Add behavior specs under `test/integration/features/*.feature`; steps live in `test/integration/step-definitions/`. Run with `pnpm test:integration` or scope via `pnpm test:integration:by-tags "@auth"`.
- UI flows go into `test/e2e/features`; validate with `pnpm test:e2e` and switch to `pnpm test:e2e:headed` for Playwright debugging.
- Capture screenshots or fixtures in `test-results/` when behavior differs from baseline; clean up temporary assets before submitting.

## Commit & Pull Request Guidelines
- Follow the observed conventional commits (`feat:`, `fix:`, `chore:`); keep subject lines imperative and ≤72 chars, elaborating in the body for multi-package changes.
- PRs should call out impacted apps, linked issues, env or schema updates, and include lint/test command output. Attach animated GIFs/screenshots for front-end UX changes for reviewer verification.

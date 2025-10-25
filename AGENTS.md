# Repository Guidelines

## Project Structure & Module Organization
- `apps/backend`: Express + Apollo GraphQL API; core logic sits in `src/graphql`, `src/services`, and Prisma schema in `prisma/`.
- `apps/form-app-v2`: Vite + React 18 client that relies on `@dculus/ui-v2` for Shadcn components and Tailwind presets. New UI work lands here.
- `apps/form-app`: Legacy Next.js-style client still serving production flows; keep parity when V2 features depend on it.
- Other frontends (`apps/form-viewer`, `apps/admin-app`) follow the same pattern: features in `src/components`, routes in `src/pages`.
- Shared packages (`packages/ui`, `packages/ui-v2`, `packages/utils`, `packages/types`) deliver reusable UI primitives, utilities, and contracts; update these before duplicating logic.
- Acceptance coverage lives under `test/integration` (Cucumber + supertest) and `test/e2e` (Playwright); bash harnesses in repo root help with CI parity.

## Build, Test, and Development Commands
- `pnpm install` resolves workspace deps; rerun after shared package bumps.
- `pnpm form-app-v2:dev` runs the V2 Vite server on port 3001; use `pnpm dev` to boot backend + all clients.
- `pnpm form-app-v2:build` and `pnpm form-app-v2:preview` validate production bundles.
- `pnpm lint`, `pnpm type-check`, and `pnpm clean` (from repo root) cover linting, project references, and cache resets. Combine `pnpm lint && pnpm type-check` before PRs.
- Backend-only flows rely on `pnpm backend:dev`, `pnpm backend:build`, and the database helpers (`pnpm db:generate`, `pnpm db:push`, `pnpm db:seed`).

## Coding Style & Naming Conventions
- TypeScript everywhere; Prettier enforces 2-space indentation, 80 char wrap, single quotes, and semicolons (`pnpm prettier --write` if you need a nudge).
- ESLint (`.eslintrc.js`) errors on unused vars and warns on `any`; prefix `_` for intentional omissions.
- V2 components live in PascalCase files; hooks stay camelCase; context providers end with `Provider`. GraphQL operations use intent-first names like `UpdateFormMutation`.

## Testing Guidelines
- Add behavior specs under `test/integration/features/*.feature`; steps live in `test/integration/step-definitions/`. Run with `pnpm test:integration` or scope via `pnpm test:integration:by-tags "@auth"`.
- UI flows go into `test/e2e/features`; validate with `pnpm test:e2e` and switch to `pnpm test:e2e:headed` for Playwright debugging.
- Capture screenshots or fixtures in `test-results/` when behavior differs from baseline; clean up temporary assets before submitting.

## Commit & Pull Request Guidelines
- Follow the observed conventional commits (`feat:`, `fix:`, `chore:`); keep subject lines imperative and ≤72 chars, elaborating in the body for multi-package changes.
- PRs should call out impacted apps, linked issues, env or schema updates, and include lint/test command output. Attach animated GIFs/screenshots for front-end UX changes so reviewers can verify parity between `form-app` and `form-app-v2`.

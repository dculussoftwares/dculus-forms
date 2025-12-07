# AGENTS.md

> **Note**: This file provides quick repository guidelines. For comprehensive context, see **[CLAUDE.md](./CLAUDE.md)**.

## Quick Reference

### Project Structure
- `apps/backend`: Express + Apollo GraphQL API with Prisma ORM
- `apps/form-app`: React form builder (Vite + shadcn/ui)
- `apps/form-viewer`: Public form viewer
- `apps/admin-app`: System administration dashboard
- `packages/ui`: Shared UI components (@dculus/ui)
- `packages/types`: TypeScript types and form field classes (@dculus/types)
- `packages/utils`: Shared utilities (@dculus/utils)

### Essential Commands
```bash
pnpm dev                    # Start all services
pnpm build                  # Build all packages
pnpm lint && pnpm type-check # Validate before PR
pnpm test:e2e               # E2E tests (Playwright + Cucumber)
pnpm test:integration       # API integration tests
```

### Key Patterns
- Import UI components **only** from `@dculus/ui`
- Import utilities **only** from `@dculus/utils`
- All user-facing strings must use i18n translations
- GraphQL-first (no REST except auth endpoints)

### Coding Style
- TypeScript with strict mode
- Functional programming (except FormField classes)
- Prettier: 2-space indent, single quotes, semicolons
- ESLint errors on unused vars; prefix `_` for intentional omissions
- Components: PascalCase; hooks: camelCase; providers: end with `Provider`

### Commit Guidelines
- Conventional commits: `feat:`, `fix:`, `chore:`
- Subject ≤72 chars, imperative mood
- Note impacted apps, schema changes, env updates in PR description

---

**Full documentation**: [CLAUDE.md](./CLAUDE.md)

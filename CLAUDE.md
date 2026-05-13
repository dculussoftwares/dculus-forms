# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Commands

```bash
# Development
pnpm dev                    # Start all services concurrently
pnpm backend:dev            # Backend only (:4000)
pnpm form-app:dev           # Form builder only (:3000)
pnpm form-viewer:dev        # Form viewer only (:5173)
pnpm admin-app:dev          # Admin dashboard only (:3002)

# Database (Prisma)
pnpm db:generate            # Regenerate Prisma client after schema changes
pnpm db:push                # Push schema changes to PostgreSQL (dev)
pnpm db:studio              # Open Prisma Studio
pnpm db:seed                # Seed sample data
pnpm admin:setup            # Create/update admin user from env vars

# Validation
pnpm build                  # Build all packages
pnpm type-check             # TypeScript strict check
pnpm lint                   # ESLint

# Testing
pnpm test:unit              # Backend unit tests (vitest)
pnpm test:unit:watch        # Watch mode
pnpm test:unit:coverage     # Coverage report
pnpm test:integration       # Cucumber BDD API tests (local)
pnpm test:integration:production  # Against production
pnpm test:e2e               # Playwright + Cucumber E2E
pnpm test:e2e -- --tags "@tagname"  # Run specific tagged scenarios
```

**Test credentials** (E2E): `sivam2@mailinator.com` / `password`  
**Admin credentials**: `admin@dculus.com` / `admin123!@#` (role: `superAdmin`)

---

## Architecture

### Monorepo Layout

```
apps/
  backend/          Express.js + Apollo GraphQL + Hocuspocus (:4000)
  form-app/         Form builder React app (:3000)
  form-viewer/      Public form submission React app (:5173)
  admin-app/        Admin dashboard React app (:3002)
packages/
  types/            @dculus/types — field classes, FormSchema, serialization
  ui/               @dculus/ui — all shadcn/ui components + custom components
  utils/            @dculus/utils — generateId, cn, formatters, constants
  plugins/          shared plugin types
test/
  integration/      Cucumber BDD API tests
  e2e/              Playwright + Cucumber E2E tests
```

### Backend Architecture

The backend uses a layered pattern: **Resolvers → Services → Repositories → Prisma**.

- `apps/backend/src/graphql/` — code-first GraphQL schema + resolvers (14 resolver files by feature)
- `apps/backend/src/services/` — business logic
- `apps/backend/src/repositories/` — data access
- `apps/backend/src/plugins/` — plugin handlers; register new plugins in `registry.ts`
- `apps/backend/src/lib/prisma.ts` — Prisma client singleton
- `apps/backend/src/lib/better-auth.js` — auth setup (organization + admin plugins)
- `apps/backend/src/services/hocuspocus.ts` — Y.js WebSocket server

REST routes exist only for auth callbacks, file uploads, and health checks. All other API surface is GraphQL.

### Form App State Management (Zustand)

The form builder uses Zustand with slice architecture at `apps/form-app/src/store/`:

```
useFormBuilderStore.ts      main store hook
slices/
  fieldsSlice.ts            field CRUD + field analytics
  pagesSlice.ts             multi-page management
  layoutSlice.ts            theme/spacing/background
  selectionSlice.ts         selected field state
  collaborationSlice.ts     Y.js sync state
```

Real-time collaboration syncs store state to Y.js documents via `apps/form-app/src/hooks/useYjsSync.ts`. Y.js document names use the format `form:{formId}`.

### Field Class Hierarchy (`@dculus/types`)

All fields extend a class hierarchy — do not use plain objects:

```
FormField (base)
├── FillableFormField
│   ├── TextInputField       TextFieldValidation (minLength, maxLength)
│   ├── TextAreaField        same as TextInputField
│   ├── EmailField           same + email validation
│   ├── NumberField          + min, max
│   ├── DateField            + minDate, maxDate
│   ├── SelectField          + options[], multiple
│   ├── RadioField           + options[]
│   ├── CheckboxField        CheckboxFieldValidation (minSelections, maxSelections)
│   └── FileUploadField
└── NonFillableFormField
    └── RichTextFormField
```

Fields are stored as plain JSON (database + Y.js). Always use the serialization helpers when persisting or syncing:

```typescript
import { serializeFormSchema, deserializeFormSchema, serializeFormField, deserializeFormField } from '@dculus/types';
```

---

## Key Conventions

### Import Rules

```typescript
import { Button, Card } from '@dculus/ui';          // UI components ONLY from here
import { generateId, cn, formatDate } from '@dculus/utils';  // utils ONLY from here
import type { FormSchema } from '@dculus/types';
import { TextInputField } from '@dculus/types';
```

### Internationalization (mandatory)

All user-facing strings in `form-app` must be translated. Hardcoded strings will fail review.

```typescript
// 1. Create: apps/form-app/src/locales/en/yourComponent.json
// 2. Register in apps/form-app/src/locales/index.ts
// 3. Use in component:
const { t } = useTranslation('yourComponent');
<p>{t('loading.fieldAnalytics')}</p>
<p>{t('count', { values: { count: 10 } })}</p>
```

### Toast Notifications

```typescript
import { toastSuccess, toastError } from '@dculus/ui';
toastSuccess('Title', 'Description');
toastError('Title', 'Description');
```

### Icon in Card/Header Pattern

```tsx
<div className="bg-blue-50 p-3 rounded-xl">
  <YourIcon className="h-5 w-5 text-blue-600" />
</div>
```

---

## Authorization Model

Permission checks layer three systems — all three must pass:

1. **System role** (`User.role`): `user` | `admin` | `superAdmin`
2. **Org membership** (`Member.role`): `member` | `owner`
3. **Form permission** (`FormPermission.permission`): `VIEWER` | `EDITOR` | `OWNER` | `NO_ACCESS`

Form sharing scopes control the default access:
- `PRIVATE` — explicit `FormPermission` rows only
- `SPECIFIC_MEMBERS` — selected org members
- `ALL_ORG_MEMBERS` — whole org gets `defaultPermission`

---

## Plugin System

Plugins are event-driven. Available events: `form.submitted`, `plugin.test`.  
Plugin types: `webhook`, `email`, `quiz-grading`.

Adding a new plugin:
1. Create `apps/backend/src/plugins/{type}/handler.ts`
2. Register in `apps/backend/src/plugins/registry.ts`
3. Add frontend config UI in `apps/form-app/src/components/plugins/`

Quiz grading results and webhook status are stored in `Response.metadata` as JSON keyed by plugin type.

---

## Environment Variables

Backend needs `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, S3 credentials (`PUBLIC_S3_ACCESS_KEY`, `PUBLIC_S3_SECRET_KEY`, `PUBLIC_S3_ENDPOINT`, `PUBLIC_S3_CDN_URL`, `PUBLIC_S3_BUCKET_NAME`, `PRIVATE_S3_BUCKET_NAME`), and optionally `CORS_ORIGINS`.

Frontend apps need `VITE_API_URL`, `VITE_GRAPHQL_URL`, `VITE_FORM_VIEWER_URL`.

See each app's `.env.example` for the full list.

---

## Reference

- `docs/deployment/` — Azure and Cloudflare deployment guides
- `apps/backend/prisma/schema.prisma` — canonical source for all data models

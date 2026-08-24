# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **IMPORTANT — Public Repository**: `dculus-forms` is publicly visible on GitHub. Never commit `.env` files, API keys, passwords, tokens, or any credentials. Before every commit, verify no secrets are staged. Refuse to commit them even if asked, and warn the user immediately if any appear in `git status` or `git diff`.

---

## Commands

See `package.json` scripts for the full list (`dev`, `backend:dev`, `db:generate`, `build`, `test:unit`, `test:integration`, `test:e2e`, etc.). Notable non-obvious usage: `pnpm test:e2e -- --tags "@tagname"` runs specific tagged Cucumber scenarios.

**Test credentials** (E2E): set via environment variables — do not hardcode in this file.  
The shared dev/E2E login (email **and** password) is the `E2E_EMAIL` / `E2E_PASSWORD` **fallback values baked into the `test:e2e` script in `package.json`** — read them from there. This is a deliberately public, disposable test account for local/E2E environments only: it must never hold real data, and its password must never be reused anywhere. Use it for manual sign-in at `http://localhost:3000` when verifying changes in the browser; do not register new accounts and do not commit any other credentials.  
**Admin credentials**: set via `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars and `pnpm admin:setup` — do not hardcode in this file.

---

## Git Worktrees — read this FIRST if your working directory is a worktree

Worktrees (created under `.claude/worktrees/` or via `git worktree add`) share git history but **not** gitignored files. A fresh worktree has no `.env` files, no `node_modules`, no built `@dculus/*` package dist output, and no generated Prisma client — so `pnpm dev`, type-check, and tests all fail confusingly.

Before doing anything else in a worktree, run once:

```bash
./scripts/setup-worktree.sh
```

It copies `.env` files and `.claude/settings.local.json` from the main checkout, runs `pnpm install` if needed, builds the workspace packages, and generates the Prisma client. Failure signatures when skipped: `Cannot find module '@dculus/types'` (packages not built), Prisma client import errors (`db:generate` not run), backend exiting on missing env vars.

---

## Architecture

### Backend Architecture

The backend uses a layered pattern: **Resolvers → Services → Repositories → Prisma**.

**Entry point**: `apps/backend/src/index.ts` — Express + Apollo + Hocuspocus setup, Sentry init, plugin/subscription system init.

**GraphQL** (`apps/backend/src/graphql/`):
- `schema.ts` — code-first type definitions
- `resolvers.ts` — combines all resolver modules
- `resolvers/` — 15 resolver files by feature:
  `admin`, `analytics`, `better-auth`, `fieldAnalytics`, `fileUpload`, `formFiles`, `forms`, `formSharing`, `invitations`, `plugins`, `responses`, `subscriptions`, `templates`, `unifiedExport`

**Services** (`apps/backend/src/services/`):
- `analyticsService.ts` — form view/submission tracking
- `chargebeeService.ts` — Chargebee billing integration
- `emailService.ts` — transactional email (invite, OTP, reset password)
- `fieldAnalyticsService.ts` + `fieldAnalytics/` — per-field response analytics processors (text, number, selection, checkbox, date, email, file upload)
- `fileUploadService.ts` — S3/R2 upload/presigned URL logic
- `formMetadataService.ts` — caches page/field counts in `FormMetadata`
- `formService.ts` — form CRUD business logic
- `pdfTemplateService.ts` — pdfme template validation + per-response PDF generation (PDF Templates feature)
- `hocuspocus.ts` — Y.js WebSocket collaboration server
- `responseEditTrackingService.ts` — tracks field-level diffs on response edits
- `responseFilterService.ts` + `responseQueryBuilder.ts` — complex response filtering/querying
- `responseService.ts` — response CRUD
- `templateService.ts` — form template management
- `temporaryFileService.ts` — temporary export files in private R2 bucket (5h TTL)
- `unifiedExportService.ts` — Excel/CSV export with plugin columns via ExcelJS

**Repositories** (`apps/backend/src/repositories/`):
- `baseRepository.ts`, `collaborativeDocumentRepository.ts`, `formMetadataRepository.ts`, `formRepository.ts`, `formSubmissionAnalyticsRepository.ts`, `formTemplateRepository.ts`, `formViewAnalyticsRepository.ts`, `responseRepository.ts`, `subscriptionRepository.ts`

**Plugins** (`apps/backend/src/plugins/`):
- `registry.ts` — Map-based plugin type registry
- `executor.ts` — runs matching plugins for a form event
- `events.ts` — EventEmitter singleton; `emitFormSubmitted`, `emitPluginTest`
- `exportRegistry.ts` — plugins register custom Excel/CSV columns here
- `email/` — email notification plugin handler
- `quiz/` — quiz grading plugin handler + export column registration
- `webhooks/` — outbound webhook plugin handler

**Subscriptions** (`apps/backend/src/subscriptions/`):
- Event-driven usage tracking via `SubscriptionEventType` enum
- Events: `FORM_VIEWED`, `FORM_SUBMITTED`, `USAGE_LIMIT_REACHED`, `USAGE_LIMIT_EXCEEDED`
- Plan limits: `free` (10k views / 1k submissions), `starter` (unlimited views / 10k submissions), `advanced` (unlimited / 100k submissions)

**REST routes** (auth callbacks, file uploads, and health checks only):
- `POST /upload` — file upload with auth/permission check (allowed types: `FormTemplate`, `FormBackground`, `UserAvatar`, `OrganizationLogo`, `FormResponse`, `PdfTemplateAsset`)
- `/api/auth/*` — better-auth handlers
- `/health` — health check
- `/debug` — debug info
- `/chargebee-webhooks` — billing webhook handler

**Middleware**:
- `better-auth-middleware.ts` — populates GraphQL context with user/session; exports `requireAuth`, `requireOrganizationMembership`
- `edge-geolocation.ts` — reads Cloudflare edge headers (`cf-ipcity`, `cf-ipcountry`, etc.) for analytics
- `errorHandler.ts` — global error handler

**Monitoring**: Sentry (`@sentry/node`) initialized via `instrument.ts` if `SENTRY_DSN` is set.

**Auth library**: `better-auth` with plugins: `bearer`, `organization`, `admin`, `emailOTP`. Config at `apps/backend/src/lib/better-auth.ts`.
- Sessions: 7 days, cookie cache enabled
- Org limit: 1 per user (100 in test env)
- Email verification required in non-test environments

### Form App State Management (Zustand)

The form builder uses Zustand with slice architecture at `apps/form-app/src/store/`:

```
useFormBuilderStore.ts      main store hook (devtools + subscribeWithSelector)
slices/
  fieldsSlice.ts            field CRUD + field analytics
  pagesSlice.ts             multi-page management
  layoutSlice.ts            theme/spacing/background
  selectionSlice.ts         selected field state
  collaborationSlice.ts     Y.js sync state
```

Real-time collaboration syncs store state to Y.js documents. Y.js document names use the format `form:{formId}`. The Hocuspocus server at `:4000` persists Y.js state in the `CollaborativeDocument` table.

**Contexts**: `AuthContext`, `FormPermissionContext`, `LocaleContext`

**Key hooks** (`apps/form-app/src/hooks/`):
- `useFieldAnalytics`, `useFormAnalytics` — analytics data fetching
- `useFormPermissions` — permission-aware builder access
- `useResponseEditHistory`, `useResponsesState` — response management
- `useTranslation` — i18n (wraps locale context)
- `useDragAndDrop`, `useCollisionDetection` — builder drag-and-drop

**Form app pages** (`apps/form-app/src/pages/`):
- Auth: `SignIn`, `SignUp`, `EmailVerification`, `ForgotPassword`, `InviteAcceptance`
- Builder: `CollaborativeFormBuilder`, `FormDashboard`, `FormSettings`, `FormsList`
- Analytics: `FormAnalytics`, `ResponsesAnalytics`, `ResponsesIndividual`
- Responses: `Responses`, `ResponseEdit`, `ResponseEditHistory`
- Plugins: `Plugins`, `PluginConfiguration`
- Subscription: `Pricing`, `subscription/success`, `subscription/cancel`
- Admin views: `Templates`, `Settings`

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

### Form Viewer App

Public form submission app (`apps/form-viewer/src/`). No authentication required. Uses Apollo Client.

Routes: `/f/:shortUrl` (primary) and `/:shortUrl` (legacy).  
Components: `FormViewer`, `Header`, `ThankYouDisplay`, `DemoPage`.

### Admin App

System administration dashboard (`apps/admin-app/src/`). Requires `admin` or `superAdmin` role.

Pages: Dashboard, Organizations, OrganizationDetail, Users, UserDetail, Templates.  
Has its own auth hook, locale support, and translation namespace.

---

## Key Conventions

### Prisma Schema Changes

Any change to `apps/backend/prisma/schema.prisma` requires **both** of these — the schema edit alone is not enough:

1. **A committed migration** in `apps/backend/prisma/migrations/<timestamp>_<name>/migration.sql`. Deployments run `db:migrate:deploy`, which only applies checked-in migrations — never `db push`. Use `ADD COLUMN IF NOT EXISTS` guards, since dev databases may already have the columns via `pnpm db:push`.
2. **After pulling a schema change** into a checkout: run `pnpm db:generate` and `pnpm db:push`. The Prisma client is generated into `apps/backend/src/generated/prisma` (inside the repo, gitignored), so pulling code does **not** refresh it.

Failure signatures when this is skipped:
- **Stale generated client** → silent missing fields: GraphQL throws `"Cannot return null for non-nullable field ..."` because the old client never selects the new column.
- **Missing DB column** (client regenerated but DB not pushed) → loud Prisma error `P2022: column does not exist`.

### Import Rules

```typescript
import { Button, Card } from '@dculus/ui';          // UI components ONLY from here
import { generateId, cn, formatDate } from '@dculus/utils';  // utils ONLY from here
import type { FormSchema } from '@dculus/types';
import { TextInputField } from '@dculus/types';
```

### Internationalization (mandatory)

`form-app` supports **English** (`en`) and **Tamil** (`ta`). All user-facing strings must be translated. Hardcoded strings will fail review.

```typescript
// 1. Create: apps/form-app/src/locales/en/yourComponent.json
//            apps/form-app/src/locales/ta/yourComponent.json
// 2. Register both in apps/form-app/src/locales/index.ts (add to enTranslations AND taTranslations)
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

### GraphQL Context Pattern

```typescript
// All resolvers receive: (_: any, args: {...}, context: { auth: BetterAuthContext })
// Always guard with:
requireAuth(context.auth);
await requireOrganizationMembership(context.auth, organizationId);
```

### GraphQL Error Codes

Use `GRAPHQL_ERROR_CODES` from `@dculus/types/graphql.js` for all error throws:

```typescript
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import { createGraphQLError } from '../lib/graphqlErrors.js';
throw createGraphQLError('Form not found', GRAPHQL_ERROR_CODES.FORM_NOT_FOUND);
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
2. Register in `apps/backend/src/plugins/registry.ts` via `registerPlugin()`
3. Add frontend config UI in `apps/form-app/src/components/plugins/`

Quiz grading results and webhook status are stored in `Response.metadata` as JSON keyed by plugin type.

**Plugin Export Columns**: To add custom columns to Excel/CSV exports, register in `exportRegistry.ts`:
```typescript
import { registerPluginExport } from '../exportRegistry.js';
registerPluginExport({ pluginType, getColumns(), getValues(metadata) });
```

---

## File Storage (Cloudflare R2)

Two buckets with distinct access models:
- **Public bucket** (`PUBLIC_S3_BUCKET_NAME`) — served via CDN, no auth. Used for: `FormTemplate`, `FormBackground`, `UserAvatar`, `OrganizationLogo` uploads.
- **Private bucket** (`PRIVATE_S3_BUCKET_NAME`) — no public access, requires pre-signed URLs. Used for: `FormResponse` file fields, `PdfTemplateAsset` base PDFs (PDF Templates), and temporary export files.

Pre-signed download URLs are generated by `fileUploadService.ts` and `temporaryFileService.ts`.  
Temporary export files expire after 5 hours and use the key pattern `temp-exports/{timestamp}-{uuid}-{filename}`.

---

## Subscription / Billing (Chargebee)

Plans defined in `chargebeeService.ts`:
- `free`: 10,000 views / 1,000 submissions per period
- `starter`: unlimited views / 10,000 submissions
- `advanced`: unlimited views / 100,000 submissions

Usage counters are cached in the `Subscription` table and reset at billing period start. The subscription event system (`apps/backend/src/subscriptions/`) fires `USAGE_LIMIT_REACHED` (80% threshold) and `USAGE_LIMIT_EXCEEDED` events.

Checkout via Chargebee hosted pages; webhooks handled at `/chargebee-webhooks`.

---

## Analytics Features

**Form view analytics** (`FormViewAnalytics`): Tracks per-session views with device, browser, OS, geolocation (via Cloudflare edge headers or MaxMind GeoIP2), language, timezone.

**Form submission analytics** (`FormSubmissionAnalytics`): Same geo/device data plus `completionTimeSeconds` (time from first interaction to submission).

**Field analytics**: Per-field response statistics with type-specific processors:
- Text/Email: response count, average length, common patterns
- Number: min, max, mean, distribution
- Selection/Radio: option frequency counts
- Checkbox: selection frequency counts
- Date: earliest, latest, distribution
- File Upload: total files, responses with/without files

Analytics visualizations in form-app: `ViewsOverTimeChart`, `GeographicChart`, `WorldMapVisualization`, `BrowserOSCharts`, `CompletionTimeChart`, `CompletionTimePercentiles`, `FieldAnalytics/*`.

---

## Response Edit Tracking

When a form response is edited, `responseEditTrackingService.ts` records:
- `ResponseEditHistory`: who edited, when, reason, IP, user agent, field change count
- `ResponseFieldChange`: per-field `previousValue` / `newValue` / `changeType` (ADD/UPDATE/DELETE)

Edit types: `MANUAL`, `SYSTEM`, `BULK`.

---

## Environment Variables

### Backend (`apps/backend/.env`)

```
DATABASE_URL=             # PostgreSQL connection URL (pooled, e.g. PgBouncer)
DIRECT_URL=               # Direct PostgreSQL connection URL (for migrations)
BETTER_AUTH_SECRET=       # Auth signing secret
BETTER_AUTH_URL=          # Backend base URL (e.g. http://localhost:4000)
CORS_ORIGINS=             # Comma-separated allowed origins (optional)

# Cloudflare R2 / S3-compatible storage
PUBLIC_S3_ACCESS_KEY=
PUBLIC_S3_SECRET_KEY=
PUBLIC_S3_ENDPOINT=
PUBLIC_S3_CDN_URL=        # CDN base URL for public bucket files
PUBLIC_S3_BUCKET_NAME=
PRIVATE_S3_BUCKET_NAME=

# Email (SMTP)
EMAIL_HOST=
EMAIL_PORT=               # Default: 587
EMAIL_USER=
EMAIL_PASSWORD=
EMAIL_FROM=               # Default: no-reply@dculus.com

# Chargebee billing
CHARGEBEE_SITE=
CHARGEBEE_API_KEY=

# Error monitoring (optional)
SENTRY_DSN=
```

### Frontend apps (`apps/{form-app,form-viewer,admin-app}/.env`)

```
VITE_API_URL=             # Backend URL (e.g. http://localhost:4000)
VITE_GRAPHQL_URL=         # GraphQL endpoint (e.g. http://localhost:4000/graphql)
VITE_FORM_VIEWER_URL=     # Form viewer app URL (for sharing links)
```

See each app's `.env.example` for the full list.

---

## Reference

- `apps/backend/prisma/schema.prisma` — canonical source for all data models
- `docs/deployment/` — Azure and Cloudflare deployment guides
- `PGBOUNCER-MIGRATION.md` — PgBouncer connection pooling setup notes
- `.github/workflows/` — CI/CD: `build.yml`, `codeql.yml`, `multi-cloud-deployment.yml`
- `docker-compose.yml` — local Postgres (:5433) + pgAdmin (:5050)

> **IMPORTANT ** : Use gh and azure cli for read and debug purpose, don't create resource using azure cli, create resource using terrafrom
---

## GBrain Configuration (configured by /setup-gbrain)
- Mode: local-stdio
- Engine: pglite
- Config file: ~/.gbrain/config.json (mode 0600)
- Setup date: 2026-08-24
- MCP registered: yes (user scope)
- Artifacts sync: off
- Current repo policy: read-write
- Transcript ingest: current-repo-90d (103 sessions ingested)

## GBrain Search Guidance (configured by /sync-gbrain)
<!-- gstack-gbrain-search-guidance:start -->

GBrain is set up and synced on this machine. The agent should prefer gbrain
over Grep when the question is semantic or when you don't know the exact
identifier yet. Two indexed corpora available via the `gbrain` CLI:
- This repo's code (registered as `gstack-code-2bf91bac-46ac99` source).
- `~/.gstack/` curated memory (registered as `gstack-brain-<user>` source via
  the existing federation pipeline).

Prefer gbrain when:
- "Where is X handled?" / semantic intent, no exact string yet:
    `gbrain search "<terms>"` or `gbrain query "<question>"`
- "Where is symbol Y defined?" / symbol-based code questions:
    `gbrain code-def <symbol>` or `gbrain code-refs <symbol>`
- "What calls Y?" / "What does Y depend on?":
    `gbrain code-callers <symbol>` / `gbrain code-callees <symbol>`
- "What did we decide last time?" / past plans, retros, learnings:
    `gbrain search "<terms>" --source gstack-brain-<user>`

Grep is still right for known exact strings, regex, multiline patterns, and
file globs. The brain auto-syncs incrementally on every gstack skill start.
Run `/sync-gbrain` to force-refresh, `/sync-gbrain --full` for full reindex.

<!-- gstack-gbrain-search-guidance:end -->
---
# Dculus Forms — GitHub Copilot Instructions

> **Dculus Forms** is a full-stack, multi-tenant form building & management SaaS platform.  
> Users create, share, and collaborate on forms in real-time. Respondents submit answers via a public viewer. Admins manage organizations system-wide.

---

## Architecture at a Glance

```
┌─────────────── Client Applications ───────────────────┐
│  form-app (:3000)    form-viewer (:5173)    admin-app (:3002)  │
│  React + Vite        React + Vite           React + Vite       │
│  (builder UI)        (public submit)        (system admin)     │
└────────────────────────┬──────────────────────────────┘
                         │ Apollo Client (GraphQL)
                         ▼
              ┌─── Backend (:4000) ───┐
              │  Express.js           │
              │  Apollo Server        │
              │  Hocuspocus (Y.js WS) │
              │  better-auth          │
              └───────┬───────────────┘
        ┌─────────────┼───────────────┐
        ▼             ▼               ▼
   PostgreSQL    Y.js Docs      Plugin System
   (Prisma)      (Collab)       (Event-driven)
```

---

## Monorepo Structure (pnpm workspaces)

```
dculus-forms/
├── apps/
│   ├── backend/              # Express + Apollo GraphQL + Prisma + Hocuspocus
│   │   ├── src/
│   │   │   ├── graphql/      # schema.ts (SDL), resolvers/ (domain-split), resolvers.ts (barrel)
│   │   │   ├── services/     # Business logic layer
│   │   │   ├── repositories/ # Data access layer
│   │   │   ├── plugins/      # Built-in plugin handlers (webhook, email, quiz-grading)
│   │   │   ├── lib/          # prisma.ts, better-auth.ts, env.ts, logger.ts, graphqlErrors.ts
│   │   │   ├── middleware/   # Express middleware
│   │   │   ├── routes/       # REST routes (auth only)
│   │   │   ├── subscriptions/ # Chargebee subscription logic
│   │   │   └── utils/        # Backend utilities
│   │   └── prisma/schema.prisma
│   │
│   ├── form-app/             # Form Builder (authenticated users)
│   │   ├── src/
│   │   │   ├── components/   # Feature-organized React components
│   │   │   ├── pages/        # Route-level page components
│   │   │   ├── hooks/        # Custom React hooks
│   │   │   ├── graphql/      # queries.ts, mutations.ts, plugins.ts, etc.
│   │   │   ├── contexts/     # AuthContext
│   │   │   ├── locales/      # i18n: en/ and ta/ JSON files
│   │   │   ├── services/     # apolloClient.ts
│   │   │   ├── store/        # Local state management
│   │   │   └── config/       # App configuration
│   │
│   ├── form-viewer/          # Public Form Viewer (unauthenticated)
│   │   └── src/
│   │       ├── components/   # DemoPage, Header, ThankYouDisplay
│   │       ├── pages/        # Viewer pages
│   │       ├── hooks/        # Viewer-specific hooks
│   │       ├── graphql/      # Viewer queries
│   │       └── services/     # apolloClient.ts
│   │
│   └── admin-app/            # System Admin Dashboard (superAdmin only)
│       └── src/
│           ├── components/   # AdminLayout, templates/, users/
│           ├── pages/        # Admin pages
│           ├── hooks/        # Admin hooks
│           ├── graphql/      # Admin queries
│           └── locales/      # Admin i18n
│
├── packages/
│   ├── ui/                   # @dculus/ui — ALL shared UI components
│   │   └── src/
│   │       ├── *.tsx         # shadcn/ui components (button, card, dialog, etc.)
│   │       ├── layouts/      # Form layout components (L1–L9)
│   │       ├── renderers/    # PageRenderer, FormFieldRenderer, LayoutRenderer
│   │       ├── rich-text-editor/ # Lexical rich text editor
│   │       ├── stores/       # Zustand stores (formResponseStore)
│   │       ├── hooks/        # Shared hooks
│   │       └── index.ts      # Public API barrel export
│   │
│   ├── types/                # @dculus/types — TypeScript types + FormField classes
│   │   └── src/
│   │       ├── index.ts      # Types + FormField class hierarchy
│   │       ├── validation.ts # Zod validation schemas
│   │       ├── graphql.ts    # GraphQL type helpers
│   │       └── plugins.ts    # Plugin type definitions
│   │
│   ├── utils/                # @dculus/utils — Shared utilities
│   │   └── src/
│   │       ├── index.ts      # generateId, cn, getImageUrl, RendererMode, etc.
│   │       ├── constants.ts  # API_ENDPOINTS, URLs
│   │       └── collaboration/ # Y.js collaboration utilities
│   │
│   └── plugins/              # Plugin package (dist only)
│
├── test/
│   ├── e2e/                  # Playwright + Cucumber BDD tests
│   │   ├── features/         # .feature files (Gherkin)
│   │   └── steps/            # Step definitions
│   └── integration/          # API integration tests
│       ├── features/         # .feature files
│       └── step-definitions/ # Step definitions
│
├── infrastructure/           # Multi-cloud deployment (Azure, AWS, GCP)
├── docs/deployment/          # Deployment guides
└── static-files/             # Uploaded file storage
```

---

## Technology Stack

| Layer          | Technology                                          |
|----------------|-----------------------------------------------------|
| Frontend       | React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui |
| State          | Apollo Client (server), Zustand (local forms)       |
| GraphQL Client | `@apollo/client` with `useQuery` / `useMutation`    |
| Backend        | Express.js, Apollo Server (code-first SDL via `gql`) |
| Database       | PostgreSQL + Prisma ORM                             |
| Auth           | better-auth (cookie + bearer, org plugin, admin)    |
| Realtime       | Y.js + Hocuspocus (WebSocket collab editing)        |
| Subscriptions  | Chargebee (Free, Starter, Advanced plans)           |
| Validation     | Zod (frontend + backend)                            |
| i18n           | Custom hook (`useTranslation`) with JSON files      |
| Testing        | Playwright + Cucumber (E2E), Cucumber.js (API)      |
| CI/CD          | GitHub Actions → Azure Container Apps + Cloudflare  |
| Package Mgr    | pnpm 8+ with workspaces                             |

---

## Critical Rules — ALWAYS Follow

### 1. GraphQL-First
- **All data operations** go through GraphQL. No REST endpoints except `better-auth` routes.
- Schema defined in `apps/backend/src/graphql/schema.ts` using `gql` tagged template.
- Resolvers are domain-split in `apps/backend/src/graphql/resolvers/`.
- Register new resolvers in `apps/backend/src/graphql/resolvers.ts` barrel.

### 2. Import from Shared Packages Only
```typescript
// ✅ CORRECT — always import from shared packages
import { Button, Card, Dialog } from '@dculus/ui';
import { generateId, cn, RendererMode, getImageUrl, API_ENDPOINTS } from '@dculus/utils';
import type { Form, FormSchema, FormPage, User } from '@dculus/types';
import { TextInputField, EmailField, FillableFormField } from '@dculus/types';

// ❌ WRONG — never duplicate or import from relative external paths
import { Button } from '../../../packages/ui/src/button';
```

### 3. TypeScript Strict Mode
- All code fully typed. No `any` unless absolutely necessary.
- Use Zod schemas for runtime validation.
- Use generics and utility types where appropriate.

### 4. Functional Programming
- Prefer pure functions, immutability, and composition.
- Exception: `FormField` class hierarchy in `@dculus/types` uses OOP inheritance.

### 5. Internationalization (i18n)
- **Every user-facing string must be translated.** No hardcoded text in JSX.
- Use: `const { t } = useTranslation('namespace');` then `{t('key.path')}`.
- Translation files: `apps/form-app/src/locales/{en,ta}/*.json`.
- Register new namespaces in `apps/form-app/src/locales/index.ts`.

---

## Database Schema (Prisma + PostgreSQL)

### Core Models

| Model | Key Fields | Notes |
|-------|-----------|-------|
| `User` | id, name, email, role (`user`/`admin`/`superAdmin`), banned | better-auth managed |
| `Organization` | id, name, slug, logo, metadata | Multi-tenant container |
| `Member` | organizationId, userId, role (`member`/`owner`) | Org membership |
| `Form` | id, title, shortUrl, formSchema (JSON), settings (JSON), isPublished, sharingScope, defaultPermission | Core entity |
| `Response` | id, formId, data (JSONB), metadata (JSONB) | Form submissions |
| `FormPermission` | formId, userId, permission (`OWNER`/`EDITOR`/`VIEWER`/`NO_ACCESS`) | ACL |
| `FormPlugin` | formId, type, name, enabled, config (JSON), events[] | Plugin config |
| `PluginDelivery` | pluginId, eventType, status, payload, response | Plugin execution log |
| `CollaborativeDocument` | documentName, state (Bytes) | Y.js persistence |
| `FormViewAnalytics` | formId, sessionId, geo/device fields | Privacy-first views |
| `FormSubmissionAnalytics` | formId, responseId, sessionId, completionTimeSeconds | Submission tracking |
| `Subscription` | organizationId, planId, status, usage counters | Chargebee billing |
| `ResponseEditHistory` | responseId, editedById, fieldChanges[] | Audit trail |

### Sharing Scopes
- `PRIVATE` — Only users with explicit `FormPermission`
- `SPECIFIC_MEMBERS` — Selected org members
- `ALL_ORG_MEMBERS` — All org members get `defaultPermission`

---

## FormSchema & Field System

### Schema Structure
```typescript
interface FormSchema {
  pages: FormPage[];
  layout: FormLayout;        // theme, spacing, backgroundImageKey
  isShuffleEnabled: boolean;
}

interface FormPage {
  id: string; title: string; fields: FormField[]; order: number;
}
```

### Field Class Hierarchy
```
FormField (base: id, type)
├── FillableFormField (label, defaultValue, hint, validation{required, minLength, maxLength})
│   ├── TextInputField
│   ├── TextAreaField
│   ├── EmailField
│   ├── NumberField (min/max)
│   ├── SelectField (options[], multiple)
│   ├── RadioField (options[])
│   ├── CheckboxField (options[], minSelections, maxSelections)
│   └── DateField (minDate/maxDate)
└── NonFillableFormField
    └── RichTextFormField (Lexical editor content)
```

### Serialization (CRITICAL)
```typescript
// Always serialize before storing in DB or Y.js
serializeFormField(field) / serializeFormSchema(schema)

// Always deserialize when reading from DB or Y.js
deserializeFormField(data) / deserializeFormSchema(data)
```

---

## RendererMode System

Forms render differently based on context:

| Mode | Purpose | Labels Editable | Fields Interactive | Validation |
|------|---------|-----------------|-------------------|------------|
| `BUILDER` | Form editing | ✅ (in edit mode) | ❌ | ❌ |
| `PREVIEW` | Read-only | ❌ | ✅ | ✅ |
| `SUBMISSION` | User submits | ❌ | ✅ | ✅ |

Pass mode: `LayoutRenderer` → Layout (L1–L9) → `PageRenderer` → `FormFieldRenderer`.

---

## Authentication & Authorization

### better-auth
- Config: `apps/backend/src/lib/better-auth.ts`
- Plugins: bearer tokens, organization, admin, emailOTP
- Sessions: Cookie-based (7-day) + Bearer token support

### Roles
- **System**: `user` → `admin` → `superAdmin`
- **Org**: `member` → `owner`
- **Form**: `VIEWER` → `EDITOR` → `OWNER`

### Context Pattern (Backend)
```typescript
const { userId, organizationId } = await getUserAndOrgFromContext(context);
if (!userId) throw new Error('Authentication required');
```

### Admin App
- Cookie-based auth (NOT bearer). Apollo uses `credentials: 'include'`.
- Default admin: `admin@dculus.com` / `admin123!@#` (role: `superAdmin`).

---

## Real-Time Collaboration

- **Y.js + Hocuspocus** WebSocket server
- Server: `apps/backend/src/services/hocuspocus.ts`
- Client: `useCollaboration` hook with `WebsocketProvider`
- Document name: `form:{formId}`
- Y.js doc structure: `YDoc.formSchema = YMap { pages: YArray, layout: YMap }`

---

## Plugin System (Event-Driven)

### Built-in Plugin Types
- `webhook` — HTTP POST to external URL
- `email` — Email notifications
- `quiz-grading` — Auto-grade quiz responses

### Events
```typescript
'form.submitted'  // Triggers enabled plugins
'plugin.test'     // Manual test trigger
```

### Adding a New Plugin
1. Create handler: `apps/backend/src/plugins/{type}/handler.ts`
2. Register: `apps/backend/src/plugins/registry.ts`
3. Frontend UI: `apps/form-app/src/components/plugins/`

---

## State Management

### Apollo Client (Server State)
```typescript
const { data } = useQuery(GET_FORM, { variables: { id } });
const [updateForm] = useMutation(UPDATE_FORM);
```

### Zustand Store (Form Responses — `@dculus/ui`)
```typescript
const { setFieldValue, getFieldValue } = useFormResponseStore();
const { getFormattedResponses } = useFormResponseUtils();
```

---

## Development Commands

```bash
# Start all services
pnpm dev

# Individual services
pnpm backend:dev        # :4000
pnpm form-app:dev       # :3000
pnpm form-viewer:dev    # :5173
pnpm admin-app:dev      # :3002

# Database
pnpm db:generate        # Generate Prisma client
pnpm db:push            # Push schema to PostgreSQL
pnpm db:studio          # Visual DB editor
pnpm db:seed            # Seed sample data

# Build & Validate
pnpm build              # Build all
pnpm type-check         # TypeScript validation
pnpm lint               # ESLint

# Testing
pnpm test:integration              # API integration tests
pnpm test:integration:production   # Against production
pnpm test:e2e                      # Playwright + Cucumber E2E
pnpm test:unit                     # Backend unit tests
```

---

## Common Patterns

### Toast Notifications
```typescript
import { toastSuccess, toastError } from '@dculus/ui';
toastSuccess('Form created', 'Ready for editing');
toastError('Permission denied', 'Need EDITOR access');
```

### Icon Design Pattern
```tsx
<div className="bg-blue-50 p-3 rounded-xl">
  <YourIcon className="h-5 w-5 text-blue-600" />
</div>
```

### GraphQL Error Handling
```typescript
try {
  return await businessLogic();
} catch (error) {
  console.error('Error in resolver:', error);
  throw new Error('User-friendly message');
}
```

### File Uploads
- Upload via GraphQL: `uploadFile(input: UploadFileInput!)` returns `{ key, url }`
- URL construction: `getImageUrl(key)` from `@dculus/utils`
- Storage: `static-files/` directory

---

## Deployment

| Component | Platform | URL |
|-----------|----------|-----|
| Backend | Azure Container Apps | `https://dculus-forms-backend.reddune-e5ba9473.eastus.azurecontainerapps.io` |
| Form App | Cloudflare Pages | `https://dculus-forms-app.pages.dev` |
| Form Viewer | Cloudflare Pages | `https://dculus-forms-viewer-app.pages.dev` |
| Database | PostgreSQL (Neon/Azure) | Via `DATABASE_URL` env var |

### Environment Variables (Backend)
```bash
DATABASE_URL="postgresql://..."
BETTER_AUTH_SECRET="..."
BETTER_AUTH_BASE_URL="http://localhost:4000"
```

---

## Quick Reference Table

| Task | Location |
|------|----------|
| Add GraphQL type/query/mutation | `apps/backend/src/graphql/schema.ts` |
| Add GraphQL resolver | `apps/backend/src/graphql/resolvers/{domain}.ts` → register in `resolvers.ts` |
| Add business logic | `apps/backend/src/services/{service}.ts` |
| Create shared UI component | `packages/ui/src/{component}.tsx` → export from `index.ts` |
| Add shared utility | `packages/utils/src/index.ts` |
| Define shared type | `packages/types/src/index.ts` |
| Add new field type | Extend `FillableFormField` in `@dculus/types` |
| Add form layout | `packages/ui/src/layouts/L{N}.tsx` |
| Add page component | `apps/{app}/src/pages/{Page}.tsx` |
| Add translation | `apps/form-app/src/locales/{lang}/{namespace}.json` → register in `index.ts` |
| Add integration test | `test/integration/features/*.feature` + `step-definitions/*.steps.ts` |
| Add E2E test | `test/e2e/features/*.feature` + Playwright steps |
| Add plugin handler | `apps/backend/src/plugins/{type}/handler.ts` → register in `registry.ts` |

---

**Version**: 3.0 | **Last Updated**: 2026-03-31

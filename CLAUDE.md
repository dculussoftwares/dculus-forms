# CLAUDE.md

This file provides comprehensive context for AI coding agents (Claude, Copilot, Cursor, etc.) when working with this repository.

---

## Table of Contents
1. [Quick Start Commands](#quick-start-commands)
2. [Business Context](#business-context)
3. [System Architecture](#system-architecture)
4. [Monorepo Structure](#monorepo-structure)
5. [Technology Stack](#technology-stack)
6. [Database Schema](#database-schema)
7. [Form Schema & Field System](#form-schema--field-system)
8. [Real-time Collaboration](#real-time-collaboration)
9. [Authentication & Authorization](#authentication--authorization)
10. [Plugin System](#plugin-system)
11. [Analytics System](#analytics-system)
12. [Data Flows](#data-flows)
13. [Testing](#testing)
14. [Development Guidelines](#development-guidelines)
15. [Internationalization](#internationalization)

---

## Quick Start Commands

### Development Workflow
```bash
pnpm dev              # Start all services (backend, form-app, form-viewer, admin-app)
pnpm backend:dev      # Express.js + GraphQL API on :4000
pnpm form-app:dev     # React form builder on :3000
pnpm form-viewer:dev  # React form viewer on :5173
pnpm admin-app:dev    # React admin dashboard on :3002
```

### Database Commands
```bash
pnpm db:generate      # Generate Prisma client
pnpm db:push          # Push schema to PostgreSQL
pnpm db:studio        # Open Prisma Studio visual editor
pnpm db:seed          # Seed sample data
```

### Build & Validation
```bash
pnpm build            # Build all packages
pnpm type-check       # TypeScript check
pnpm lint             # ESLint
pnpm test:integration # Run integration tests
pnpm test:e2e         # Run E2E tests (Playwright + Cucumber)
```

### Access Points
| Service | URL |
|---------|-----|
| Form Builder | http://localhost:3000 |
| Form Viewer | http://localhost:5173 |
| Admin Dashboard | http://localhost:3002 |
| GraphQL API | http://localhost:4000/graphql |

---

## Business Context

### What is Dculus Forms?

**Dculus Forms** is a comprehensive form building and management platform that enables:

- 📝 **Create Forms**: Drag-and-drop builder with 10+ field types
- 🤝 **Collaborate**: Real-time collaborative editing with team members
- 📊 **Collect Responses**: Public form viewer for response collection
- 📈 **Analyze Data**: View analytics, statistics, and response insights
- 🔌 **Integrate**: Extend via webhooks, emails, and plugins
- 🎓 **Quiz Assessment**: Auto-grade quiz responses

### Core Features
- Multi-page forms with navigation
- Field validation (required, min/max, character limits)
- Form sharing with granular permissions (Owner/Editor/Viewer)
- Response management (view, filter, edit, export)
- Privacy-first analytics (views, submissions, geographic distribution)
- Subscription plans via Chargebee (Free, Starter, Advanced)

---

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Applications                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  Form App    │  │ Form Viewer  │  │  Admin App   │       │
│  │  (Builder)   │  │  (Public)    │  │  (System)    │       │
│  │    :3000     │  │    :5173     │  │    :3002     │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                  │                 │               │
│         └──────────────────┼─────────────────┘               │
│                            │                                 │
│                     ┌──────┴──────┐                         │
│                     │   Backend   │                         │
│                     │  GraphQL    │                         │
│                     │ + Hocuspocus│                         │
│                     │    :4000    │                         │
│                     └──────┬──────┘                         │
│                            │                                 │
│         ┌──────────────────┼──────────────────┐             │
│         │                  │                   │             │
│  ┌──────┴──────┐    ┌──────┴──────┐    ┌──────┴──────┐     │
│  │ PostgreSQL  │    │    Y.js     │    │  Plugins    │     │
│  │  (Prisma)   │    │  Documents  │    │  (Events)   │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### Key Technical Decisions
- **GraphQL-first**: All business logic via Apollo Server (no REST except auth)
- **PostgreSQL + Prisma**: Type-safe database access
- **Y.js + Hocuspocus**: Real-time collaborative editing
- **better-auth**: Authentication with organization/admin plugins
- **Centralized packages**: UI, types, utils shared across apps

---

## Monorepo Structure

```
dculus-forms/
├── apps/
│   ├── backend/              # Express.js + Apollo GraphQL
│   │   ├── src/
│   │   │   ├── graphql/      # Schema & resolvers
│   │   │   ├── services/     # Business logic
│   │   │   ├── repositories/ # Data access
│   │   │   ├── plugins/      # Plugin handlers
│   │   │   └── lib/          # Prisma, better-auth
│   │   └── prisma/           # Database schema
│   ├── form-app/             # React form builder
│   │   ├── src/
│   │   │   ├── components/   # React components
│   │   │   ├── pages/        # Route pages
│   │   │   ├── hooks/        # Custom hooks
│   │   │   ├── graphql/      # Queries & mutations
│   │   │   └── locales/      # i18n translations
│   ├── form-viewer/          # Public form viewer
│   └── admin-app/            # Admin dashboard
│
├── packages/
│   ├── ui/                   # @dculus/ui - shadcn/ui components
│   ├── types/                # @dculus/types - TypeScript types
│   └── utils/                # @dculus/utils - Utilities
│
├── test/
│   ├── e2e/                  # Playwright + Cucumber E2E tests
│   └── integration/          # API integration tests
│
└── docs/deployment/          # Deployment guides
```

### Import Patterns

```typescript
// UI components (ONLY from @dculus/ui)
import { Button, Card, SidebarProvider } from '@dculus/ui';

// Utilities (ONLY from @dculus/utils)
import { generateId, cn } from '@dculus/utils';

// Types and field classes
import type { Form, FormSchema } from '@dculus/types';
import { TextInputField, EmailField } from '@dculus/types';

// GraphQL
import { useQuery, useMutation } from '@apollo/client';
```

---

## Technology Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| React 18 | UI framework |
| Vite | Build tool |
| TypeScript | Type safety |
| Tailwind CSS | Styling |
| shadcn/ui | Component library |
| Apollo Client | GraphQL client |
| Y.js | Real-time collaboration |
| Zod | Runtime validation |

### Backend
| Technology | Purpose |
|------------|---------|
| Express.js | HTTP server |
| Apollo Server | GraphQL API |
| Prisma | PostgreSQL ORM |
| Hocuspocus | Y.js WebSocket server |
| better-auth | Authentication |
| Chargebee | Subscriptions |

---

## Database Schema

### Core Models

```prisma
User {
  id, name, email, role, banned
  // role: "user" | "admin" | "superAdmin"
}

Organization {
  id, name, slug, logo, metadata
  members[], forms[], subscription
}

Member {
  organizationId, userId, role
  // role: "member" | "owner"
}

Form {
  id, title, shortUrl, formSchema, settings
  isPublished, organizationId, createdById
  sharingScope, defaultPermission
  // sharingScope: "PRIVATE" | "SPECIFIC_MEMBERS" | "ALL_ORG_MEMBERS"
}

Response {
  id, formId, data (JSONB), metadata (JSONB)
  submittedAt
}

FormPermission {
  formId, userId, permission, grantedById
  // permission: "OWNER" | "EDITOR" | "VIEWER" | "NO_ACCESS"
}
```

### Supporting Models
- `CollaborativeDocument`: Y.js document state (binary)
- `FormViewAnalytics` / `FormSubmissionAnalytics`: Privacy-first tracking
- `FormPlugin` / `PluginDelivery`: Plugin configuration and logs
- `Subscription`: Chargebee integration
- `ResponseEditHistory` / `ResponseFieldChange`: Audit trail

---

## Form Schema & Field System

### FormSchema Structure

```typescript
interface FormSchema {
  pages: FormPage[];
  layout: FormLayout;
  isShuffleEnabled: boolean;
}

interface FormPage {
  id: string;
  title: string;
  fields: FormField[];
  order: number;
}

interface FormLayout {
  theme: 'light' | 'dark' | 'auto';
  textColor: string;
  spacing: 'compact' | 'normal' | 'spacious';
  backgroundImageKey: string;
  customBackGroundColor: string;
}
```

### Field Types

| Field Class | Properties |
|-------------|------------|
| `TextInputField` | label, hint, placeholder, prefix, defaultValue, validation (required, minLength, maxLength) |
| `TextAreaField` | Same as TextInputField |
| `EmailField` | Same as TextInputField + email validation |
| `NumberField` | + min, max numeric constraints |
| `DateField` | + minDate, maxDate constraints |
| `SelectField` | + options[], multiple boolean |
| `RadioField` | + options[] |
| `CheckboxField` | + options[], minSelections, maxSelections |

### Serialization
```typescript
// Convert to plain objects for storage/Y.js
serializeFormField(field: FormField): object
serializeFormSchema(schema: FormSchema): object

// Reconstruct class instances
deserializeFormField(data: any): FormField
deserializeFormSchema(data: any): FormSchema
```

---

## Real-time Collaboration

### Y.js + Hocuspocus

- Each Form has a corresponding Y.js document for real-time editing
- Document name format: `form:{formId}`
- Changes sync via WebSocket and persist to PostgreSQL
- Multiple users can simultaneously edit form structure

### Y.js Document Structure

```typescript
YDoc {
  formSchema: YMap {
    pages: YArray<YMap<FormPage>>
    layout: YMap<FormLayout>
    isShuffleEnabled: boolean
  }
}
```

### Key Files
- `apps/backend/src/services/hocuspocus.ts` - WebSocket server
- `apps/form-app/src/hooks/useYjsSync.ts` - Client sync hook

---

## Authentication & Authorization

### System Roles (User.role)
| Role | Access |
|------|--------|
| `user` | Create orgs, join orgs, manage own forms |
| `admin` | + Admin dashboard, view all orgs |
| `superAdmin` | + Create admin users, full system control |

### Organization Roles (Member.role)
| Role | Access |
|------|--------|
| `member` | View org forms, submit responses |
| `owner` | + Create/manage forms, invite members |

### Form Permissions (FormPermission.permission)
| Permission | Can View | Can Edit | Can Share | Can Delete |
|------------|----------|----------|-----------|------------|
| `VIEWER` | ✅ | ❌ | ❌ | ❌ |
| `EDITOR` | ✅ | ✅ | ❌ | ❌ |
| `OWNER` | ✅ | ✅ | ✅ | ✅ |

### Form Sharing Scopes
- `PRIVATE`: Only users with explicit FormPermission
- `SPECIFIC_MEMBERS`: Selected org members
- `ALL_ORG_MEMBERS`: Entire org gets `defaultPermission`

---

## Plugin System

### Event-Driven Architecture

Plugins listen to events and execute actions:

```typescript
// Available events
'form.submitted'  // When user submits response
'plugin.test'     // Manual test trigger

// Plugin types
'webhook'         // HTTP POST to external URL
'email'           // Send email notifications
'quiz-grading'    // Auto-grade quiz responses
```

### Plugin Storage

```typescript
// FormPlugin model
{
  formId, type, name, enabled, config (JSON), events[]
}

// Results stored in Response.metadata
Response.metadata = {
  'quiz-grading': { quizScore: 8, totalMarks: 10, passed: true },
  'webhook': { statusCode: 200 }
}
```

### Adding a New Plugin
1. Create handler in `apps/backend/src/plugins/{type}/handler.ts`
2. Register in `apps/backend/src/plugins/registry.ts`
3. Add frontend UI in `apps/form-app/src/components/plugins/`

---

## Analytics System

### Privacy-First Tracking

- Anonymous session IDs (UUID, no personal data)
- No IP address storage
- Geographic data via timezone/browser fallback

### Models
- `FormViewAnalytics`: Page views with device/geo data
- `FormSubmissionAnalytics`: Submissions with completion time

### GraphQL API
```graphql
query formAnalytics($formId: ID!, $timeRange: TimeRangeInput) {
  formAnalytics(formId: $formId, timeRange: $timeRange) {
    totalViews, uniqueSessions
    topCountries { code, name, count }
    topBrowsers { name, count }
  }
}
```

---

## Data Flows

### Form Creation
1. User clicks "Create Form" → GraphQL `createForm` mutation
2. Backend generates unique `shortUrl`, creates Form record
3. User navigates to `/form/{id}/collaborate`
4. Hocuspocus initializes Y.js document

### Form Submission
1. Respondent navigates to `/f/{shortUrl}`
2. Frontend fetches form via `formByShortUrl` query
3. `trackFormView` mutation records analytics
4. User submits → `submitFormResponse` mutation
5. Backend validates, stores Response
6. Event emitter triggers enabled plugins

### Permission Check
1. GraphQL resolver receives request
2. Check user's organization membership
3. Check form's sharingScope
4. Look up FormPermission or use defaultPermission
5. Return data or throw authorization error

---

## Testing

### E2E Tests (Playwright + Cucumber)
```bash
pnpm test:e2e                              # Run all E2E tests
pnpm test:e2e -- --tags "@persistence"     # Run tagged tests
```

**Test credentials**: `sivam2@mailinator.com` / `password`

**Coverage**: All field types, form creation, publishing, viewer validations

### Integration Tests (API)
```bash
pnpm test:integration                       # Local
pnpm test:integration:production            # Production
```

### Test Structure
```
test/
├── e2e/
│   ├── features/        # Gherkin scenarios
│   │   ├── field-short-text.feature
│   │   ├── field-checkbox.feature
│   │   └── form-viewer-multipage.feature
│   └── steps/           # Step definitions
└── integration/
    ├── features/        # API test scenarios
    └── step-definitions/
```

---

## Development Guidelines

### Code Style
- **Functional programming** preferred (except FormField classes)
- **Full TypeScript** with strict mode
- **Zod schemas** for all validation
- Import UI only from `@dculus/ui`
- Import utils only from `@dculus/utils`

### Backend Patterns
- Resolvers: `apps/backend/src/graphql/resolvers/`
- Services: `apps/backend/src/services/`
- Prisma: `apps/backend/src/lib/prisma.ts`

### Frontend Patterns
- Apollo Client: `apps/form-app/src/services/apolloClient.ts`
- GraphQL: `apps/form-app/src/graphql/`
- Pages: `apps/*/src/pages/`

### Icon Design Pattern
When displaying icons in headers or cards, use this consistent styling:
```tsx
<div className="bg-blue-50 p-3 rounded-xl">
  <YourIcon className="h-5 w-5 text-blue-600" />
</div>
```
Reference: `apps/form-app/src/components/FormDashboard/StatsGrid.tsx`

### Toast Notifications
```typescript
import { toastSuccess, toastError } from '@dculus/ui';

toastSuccess('Form created', 'Ready for editing');
toastError('Permission denied', 'Need EDITOR access');
```

---

## Internationalization

**IMPORTANT**: All user-facing strings MUST be translated.

### Setup
1. Create: `apps/form-app/src/locales/en/yourComponent.json`
2. Register in `apps/form-app/src/locales/index.ts`
3. Use hook: `const { t } = useTranslation('yourComponent');`

### Usage
```typescript
// ❌ WRONG
<p>Loading field analytics...</p>

// ✅ CORRECT
<p>{t('loading.fieldAnalytics')}</p>

// With variables
<p>{t('count', { values: { count: 10 } })}</p>
```

### Translation File Structure
```json
{
  "titles": { "main": "Field Analytics" },
  "buttons": { "save": "Save", "cancel": "Cancel" },
  "errors": { "loadingFailed": "Failed to load" }
}
```

---

## Admin Dashboard

### Features
- Organizations management
- System statistics
- Cross-organization access

### Default Admin Credentials
- Email: `admin@dculus.com`
- Password: `admin123!@#`
- Role: `superAdmin`

### Setup
```bash
pnpm admin:setup  # Create/update admin from env vars
```

---

## Environment Setup

**Prerequisites**: Node.js ≥18.0.0, pnpm ≥8.0.0

```bash
pnpm install                    # Install dependencies
pnpm build                      # Build shared packages
pnpm db:generate && pnpm db:push # Setup database
pnpm dev                        # Start all services
```

---

## Reference Documentation

- `docs/deployment/` - Deployment guides for Azure, Cloudflare

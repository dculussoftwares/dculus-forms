# Copilot Instructions for Dculus Forms

**GraphQL-First Architecture**: Use GraphQL queries/mutations for ALL backend communication. Never create REST endpoints except for `better-auth` APIs. Apollo Server provides context, middlewares, and type-safe resolvers.

## Critical Architecture Principles

1. **Functional Programming**: Prefer pure functions, immutability, and composition over OOP (exception: FormField class hierarchy)
2. **Type Safety**: All code must be fully typed with TypeScript. Use generics, utility types, and inference
3. **Validation**: Use `zod` for all validation (forms, GraphQL inputs, API responses)
4. **Zero Duplication**: Never duplicate UI/utilities - always import from shared packages (`@dculus/*`)
5. **Code-First GraphQL**: Schema defined in TypeScript using `graphql-tag`, not SDL files

## Monorepo Structure

### Applications (`apps/`)
- **`backend/`**: Express + Apollo GraphQL + Prisma ORM + MongoDB (cloud-hosted, no Docker needed)
  - GraphQL resolvers in `src/graphql/resolvers/` (organized by domain: forms, responses, templates, plugins, admin)
  - Business logic in `src/services/` 
  - Prisma client in `src/lib/prisma.ts`
  - Authentication via better-auth in `src/lib/better-auth.ts`
- **`form-app/`**: React form builder (shadcn/ui) on `:3000`
- **`form-viewer/`**: React form viewer/submission app on `:5173`
- **`admin-app/`**: React admin dashboard for cross-org management on `:3002`

### Shared Packages (`packages/`)
- **`@dculus/ui`**: ALL UI components (shadcn/ui + Lexical rich text editor + Zustand stores)
- **`@dculus/utils`**: Shared utilities (`generateId`, `cn`, `API_ENDPOINTS`, `getImageUrl`)
- **`@dculus/types`**: TypeScript types + FormField class hierarchy

## Essential Import Patterns

```typescript
// UI Components (shadcn/ui)
import { Button, Card, Input, SidebarProvider } from '@dculus/ui';

// UI Store (Zustand)
import { useFormResponseStore, useFormResponseUtils } from '@dculus/ui';

// Utilities and Constants
import { generateId, API_ENDPOINTS, cn, getImageUrl, RendererMode } from '@dculus/utils';

// Types and FormField Classes
import type { Form, FormSchema, FormPage, User, Organisation } from '@dculus/types';
import { TextInputField, EmailField, NumberField, FillableFormField } from '@dculus/types';

// Apollo Client
import { useQuery, useMutation, gql } from '@apollo/client';
```

## FormSchema & Field Class Hierarchy

### Core Schema Structure
```typescript
FormSchema {
  pages: FormPage[];           // Multi-page support
  layout: FormLayout;          // Theme, colors, spacing, background
  isShuffleEnabled: boolean;   // Randomize order
}

FormPage {
  id: string;
  title: string;
  fields: FormField[];         // Array of field instances
  order: number;
}

FormLayout {
  theme: 'light' | 'dark' | 'auto';
  spacing: 'compact' | 'normal' | 'spacious';
  code: string;                // Layout identifier (L1, L2, etc.)
  customBackGroundColor: string;
  backgroundImageKey: string;  // Static file key
}
```

### Field Class Hierarchy
```
FormField (base: id, type)
├── FillableFormField (user input fields)
│   ├── label, defaultValue, prefix, hint, validation
│   ├── TextInputField
│   ├── TextAreaField
│   ├── EmailField
│   ├── NumberField (min/max constraints)
│   ├── SelectField (options[], multiple)
│   ├── RadioField (options[])
│   ├── CheckboxField (options[])
│   └── DateField (minDate/maxDate)
└── NonFillableFormField
    └── RichTextFormField (Lexical editor content)
```

**Serialization Pattern**: Use `serializeFormField()`/`deserializeFormField()` when storing/retrieving from DB or YJS.

## RendererMode System

Forms render differently based on mode:

| Mode | Purpose | Text Editable | Field Interactive | Validation | Navigation |
|------|---------|---------------|-------------------|------------|------------|
| **BUILDER** | Form editing | ✅ In edit mode | ❌ Disabled | ❌ Hidden | Always enabled |
| **PREVIEW** | Read-only view | ❌ No | ✅ Interactive | ✅ Shows errors | Requires validation |
| **SUBMISSION** | User submits | ❌ No | ✅ Interactive | ✅ Shows errors | Requires validation |

**Implementation**: Pass `mode` prop through `LayoutRenderer` → layout components (L1-L9) → `PageRenderer` → `FormFieldRenderer`.

## Real-Time Collaboration (YJS)

- **YJS + y-websocket** for real-time collaborative form editing
- **y-mongodb-provider** persists YJS documents to MongoDB (`dculus_forms_yjs` database)
- WebSocket server in `apps/backend/src/services/collaboration.ts`
- Each `Form` has a corresponding YJS document identified by `formId`
- Frontend uses `useCollaboration` hook with `WebsocketProvider`

## External Plugin System

### Architecture
- Plugins installed from URLs (pre-built bundles, not npm packages)
- **Two files per plugin**:
  - `plugin.backend.js`: Event handlers, business logic (Node.js ESM)
  - `plugin.config.js`: Configuration UI component (React UMD/ESM)
- Code stored in database, loaded via dynamic `import()`
- Organization-scoped plugins

### Plugin Events
```typescript
// Form lifecycle events (EventEmitter3)
eventEmitter.on('form.submitted', async (data) => { /* handler */ });
eventEmitter.on('form.created', async (data) => { /* handler */ });
eventEmitter.on('form.updated', async (data) => { /* handler */ });
eventEmitter.on('form.deleted', async (data) => { /* handler */ });
```

### Key Files
- Plugin resolvers: `apps/backend/src/graphql/resolvers/plugins.ts`
- Plugin registry: `apps/backend/src/plugins/registry.ts`
- Plugin schema: `prisma/schema.prisma` (ExternalPlugin model)

## Authentication & Authorization

### better-auth Configuration
- **Multi-tenant**: Organization-based access control
- **Roles**: `user`, `owner`, `admin`, `superAdmin`
- **Plugins**: bearer tokens, organization management, admin, emailOTP
- **Sessions**: Cookie-based (7-day expiry) + bearer token support
- Config in `apps/backend/src/lib/better-auth.ts`

### GraphQL Context Pattern
```typescript
// In resolvers, always extract user/org from context
const { userId, organizationId } = await getUserAndOrgFromContext(context);
if (!userId) throw new Error('Authentication required');
```

### Admin App Specifics
- Cookie-based auth (NOT bearer tokens)
- Apollo Client with `credentials: 'include'`
- Admin queries: `adminOrganizations`, `adminStats`
- Default admin: `admin@dculus.com` / `admin123!@#`

## State Management

### Zustand Store (`@dculus/ui`)
```typescript
// Page-aware form responses
const { setFieldValue, getFieldValue, getPageResponses } = useFormResponseStore();

// Set value for specific page and field
setFieldValue('page-1', 'email-field', 'user@example.com');

// Get formatted responses for submission
const { getFormattedResponses } = useFormResponseUtils();
const responses = getFormattedResponses(); // Flattened object
```

## Analytics System

### Privacy-First Tracking
- Anonymous session UUIDs (stored in localStorage)
- No IP addresses stored
- Geographic detection via timezone/language fallback
- User agent parsing for OS/browser info
- Model: `FormViewAnalytics` in Prisma schema

### Implementation
```typescript
// Client-side (form-viewer)
useFormAnalytics({ formId: form.id, enabled: true });

// Backend mutation
trackFormView(formId, sessionId, userAgent, timezone, language)
```

## Development Workflows

### Essential Commands
```bash
# Development (starts all apps + backend)
pnpm dev

# Individual services
pnpm backend:dev        # Backend on :4000
pnpm form-app:dev       # Form builder on :3000
pnpm form-viewer:dev    # Viewer on :5173
pnpm admin-app:dev      # Admin on :3002

# Database (cloud MongoDB, no Docker needed)
pnpm db:generate        # Generate Prisma client
pnpm db:push            # Push schema changes
pnpm db:studio          # Visual DB editor
pnpm db:seed            # Seed sample data

# Build
pnpm build              # Build all packages/apps
pnpm type-check         # TypeScript validation
pnpm lint               # ESLint
```

### Testing
```bash
# Integration tests (Cucumber.js + better-auth)
pnpm test:integration                  # All tests (local)
pnpm test:integration:production       # Against deployed backend
pnpm test:integration:auth             # Auth tests only
pnpm test:integration:by-tags          # Filter by Cucumber tags

# E2E tests (Playwright + Cucumber)
pnpm test:e2e                          # Automated E2E
pnpm test:e2e:headed                   # With browser UI
pnpm test:e2e:form-creation            # Specific feature

# Test credentials (Playwright)
Email: sivam2@mailinator.com
Password: password
```

### Integration Test Structure
- Feature files: `test/integration/features/*.feature`
- Step definitions: `test/integration/step-definitions/*.steps.ts`
- Auth utilities: `test/integration/utils/auth-utils.ts`
- No mocks - tests against real backend with better-auth

## Backend Resolver Organization

Resolvers are domain-separated in `apps/backend/src/graphql/resolvers/`:
- `forms.ts`: Form CRUD operations
- `responses.ts`: Form submissions and response management
- `templates.ts`: Template gallery
- `plugins.ts`: External plugin installation/management
- `admin.ts`: Admin-only queries (`adminOrganizations`, `adminStats`)
- `analytics.ts`: Form view tracking
- `fileUpload.ts`: File upload mutations
- `formSharing.ts`: Shareable link management
- `invitations.ts`: Organization invitations
- `better-auth.ts`: User/org GraphQL integration

## Common Patterns

### GraphQL Error Handling
```typescript
try {
  // business logic
  return result;
} catch (error) {
  console.error('Error in resolver:', error);
  throw new Error('User-friendly message');
}
```

### Prisma Transactions
```typescript
await prisma.$transaction(async (tx) => {
  await tx.form.update({ /* ... */ });
  await tx.formViewAnalytics.create({ /* ... */ });
});
```

### Layout Component Pattern
```typescript
// All layout components (L1-L9) follow this pattern
interface LayoutProps {
  page: FormPage;
  currentPageIndex: number;
  totalPages: number;
  onNavigate: (direction: 'next' | 'prev') => void;
  layout: FormLayout;
  mode?: RendererMode;
  isEditMode?: boolean;
  onEditModeChange?: (editing: boolean) => void;
}

export const Layout: React.FC<LayoutProps> = ({
  mode = RendererMode.PREVIEW,
  // ... other props
}) => {
  return (
    <div>
      {mode === RendererMode.BUILDER && <EditControls />}
      <LexicalRichTextEditor editable={mode === RendererMode.BUILDER && isEditMode} />
      <PageRenderer mode={mode} page={page} />
    </div>
  );
};
```

## File Upload System

- Static files stored in `static-files/` directory
- GraphQL mutation: `uploadFile(file: Upload!): FileUploadResponse`
- Returns `key`, `url`, `filename`, `mimeType`, `size`
- Use `getImageUrl(key)` from `@dculus/utils` to construct full URLs

## Infrastructure

### Deployment
- Backend: Azure Container Apps (Docker)
- Frontend: Cloudflare Pages
- Database: MongoDB Atlas (cloud)
- Production URL: `https://dculus-forms-backend.reddune-e5ba9473.eastus.azurecontainerapps.io`

### Environment Variables
```bash
# Backend (.env)
DATABASE_URL="mongodb://..."
BETTER_AUTH_SECRET="..."
BETTER_AUTH_BASE_URL="http://localhost:4000"
```

## Key Documentation Files

- `EXTERNAL_PLUGIN_SYSTEM.md`: Plugin architecture and SDK
- `RENDERER_MODE_CHANGES.md`: Layout mode implementation details
- `ANALYTICS.md`: Analytics system (form-viewer)
- `GRAPHQL_AUTHORIZATION_GUIDE.md`: Authorization patterns
- `test/integration/README.md`: Integration testing guide
- `packages/ui/src/stores/README.md`: Zustand store usage

## LLM-Specific Guidance

1. **Always check existing implementations** before creating new patterns
2. **Import from shared packages** - never duplicate UI/utilities
3. **Use GraphQL** - no REST endpoints except better-auth
4. **Follow FormField class hierarchy** - serialize/deserialize properly
5. **Pass `mode` prop** through layout components for correct rendering
6. **Test with integration tests** - use `pnpm test:integration:by-tags`
7. **Document with JSDoc** - all exported functions/types need comments

## Quick Reference

| Task | File/Location |
|------|---------------|
| Add GraphQL resolver | `apps/backend/src/graphql/resolvers/*.ts` |
| Create UI component | `packages/ui/src/*.tsx` (export from index.ts) |
| Add shared utility | `packages/utils/src/index.ts` |
| Define types | `packages/types/src/index.ts` |
| Add field type | Extend FormField class in `@dculus/types` |
| Configure layout | `apps/form-app/src/components/form-builder/layout-renderer/L*.tsx` |
| Add integration test | `test/integration/features/*.feature` + step definitions |
| Add E2E test | `test/e2e/features/*.feature` + Playwright steps |

---

**Version**: 2.0 | **Last Updated**: 2025-01-12

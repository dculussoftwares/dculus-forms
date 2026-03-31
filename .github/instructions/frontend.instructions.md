---
applyTo: "apps/form-app/**,apps/form-viewer/**,apps/admin-app/**"
---

# Frontend Development Instructions

## Overview

Three React + Vite + TypeScript apps share UI components from `@dculus/ui`, utilities from `@dculus/utils`, and types from `@dculus/types`.

| App | Port | Purpose | Auth |
|-----|------|---------|------|
| `form-app` | 3000 | Form Builder (authenticated) | Cookie + Bearer |
| `form-viewer` | 5173 | Public form viewer | Unauthenticated |
| `admin-app` | 3002 | System admin dashboard | Cookie only |

## Import Rules (CRITICAL)

```typescript
// ✅ CORRECT — import from shared packages
import { Button, Card, Dialog, DataTable } from '@dculus/ui';
import { generateId, cn, RendererMode, API_ENDPOINTS } from '@dculus/utils';
import type { Form, FormSchema } from '@dculus/types';
import { TextInputField, deserializeFormField } from '@dculus/types';
import { useQuery, useMutation, gql } from '@apollo/client';

// ❌ NEVER — duplicate components or import from package internals
import { Button } from './components/ui/button';
```

## Component Organization (form-app)

```
src/components/
├── form-builder/           # Builder: DraggableField, FieldSettings, PageCard
│   ├── field-settings/     # Field config panels
│   ├── field-settings-v2/  # V2 field settings
│   └── tabs/               # Builder tabs (PageBuilderTab)
├── form-settings/          # Form-level settings UI
├── Analytics/              # Analytics charts and views
├── Responses/              # Response management UI
├── FormDashboard/          # Dashboard stats grid
├── sharing/                # Form sharing/permission UI
├── plugins/                # Plugin configuration UI
├── subscription/           # Subscription management
├── organization/           # Organization management
├── response-history/       # Response edit history
├── response-metadata/      # Response metadata display
└── ui/                     # App-specific UI utilities
```

## Page Components (form-app)

All page components in `src/pages/`:
- `CollaborativeFormBuilder.tsx` — Main form builder page
- `FormDashboard.tsx` — Form analytics dashboard
- `Responses.tsx` — Response list view
- `ResponsesIndividual.tsx` — Individual response view
- `ResponseEdit.tsx` — Response editing
- `ResponseEditHistory.tsx` — Edit audit trail
- `FormAnalytics.tsx` — Detailed analytics
- `ResponsesAnalytics.tsx` — Response analytics
- `Plugins.tsx` / `PluginConfiguration.tsx` — Plugin management
- `FormSettings.tsx` — Form settings
- `Templates.tsx` — Template gallery
- `SignIn.tsx` / `SignUp.tsx` — Authentication
- `Pricing.tsx` — Subscription pricing
- `InviteAcceptance.tsx` — Org invite flow

## Custom Hooks (form-app)

```typescript
// Form-level
useFormDashboard(formId)      // Dashboard data
useFormSettings(formId)       // Form settings
useFormPermissions(formId)    // Permission checks
useFormAnalytics(formId)      // Analytics data
useFieldAnalytics(formId)     // Per-field analytics

// Builder
useFieldEditor()              // Field editing state
useFieldCreation()            // New field creation
useDragAndDrop()              // DnD logic
useCollisionDetection()       // DnD collision

// State
useResponsesState()           // Response list management
useResponseEditHistory()      // Edit history
usePermissionAwareFormBuilder() // Permission-based builder
usePerformanceMonitor()       // Performance tracking

// i18n
useTranslation(namespace)    // Translation hook
useLocale()                  // Current locale

// Config
useAppConfig()               // App configuration
```

## Apollo Client Setup

```typescript
// Client configured in src/services/apolloClient.ts
// form-app: Cookie + Bearer token auth
// admin-app: Cookie-only auth with credentials: 'include'
// form-viewer: No auth required
```

### GraphQL Query Pattern
```typescript
import { useQuery, useMutation, gql } from '@apollo/client';

const GET_FORM = gql`
  query GetForm($id: ID!) {
    form(id: $id) {
      id title shortUrl formSchema isPublished
      organization { id name }
    }
  }
`;

function MyComponent({ formId }: { formId: string }) {
  const { data, loading, error } = useQuery(GET_FORM, {
    variables: { id: formId },
  });
  // render...
}
```

## Zustand Store (Form Responses)

```typescript
import { useFormResponseStore, useFormResponseUtils } from '@dculus/ui';

// Setting field values (page-aware)
const { setFieldValue, getFieldValue, getPageResponses } = useFormResponseStore();
setFieldValue('page-1', 'email-field', 'user@example.com');

// Getting formatted responses for submission
const { getFormattedResponses } = useFormResponseUtils();
const responses = getFormattedResponses(); // Flattened { fieldId: value }
```

## RendererMode

```typescript
import { RendererMode } from '@dculus/utils';

// Pass mode through component tree
<LayoutRenderer mode={RendererMode.BUILDER} ... />
<LayoutRenderer mode={RendererMode.PREVIEW} ... />
<LayoutRenderer mode={RendererMode.SUBMISSION} ... />
```

## Styling

- Use **Tailwind CSS** utility classes
- Use **shadcn/ui** components from `@dculus/ui`
- Use `cn()` from `@dculus/utils` for conditional classes

```typescript
import { cn } from '@dculus/utils';
<div className={cn("p-4 rounded-lg", isActive && "bg-blue-50 border-blue-200")} />
```

## Toast Notifications

```typescript
import { toastSuccess, toastError } from '@dculus/ui';

toastSuccess('Form created', 'Your form is ready for editing');
toastError('Permission denied', 'You need EDITOR access');
```

## Form Viewer Specifics

The form-viewer is a minimal, unauthenticated app:
- Fetches form via `formByShortUrl` query
- Tracks analytics via `trackFormView` mutation
- Submits via `submitResponse` mutation
- Components: `DemoPage`, `Header`, `ThankYouDisplay`
- Uses shared `LayoutRenderer` from `@dculus/ui`

## Admin App Specifics

- Requires `superAdmin` role
- Cookie-based auth (NOT bearer tokens)
- Apollo Client: `credentials: 'include'`
- Queries: `adminOrganizations`, `adminStats`, `adminUsers`
- Components: `AdminLayout`, templates management, user management

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Development Workflow
- **Start all services**: `pnpm dev` - Starts backend, form-app, form-viewer, and admin-app concurrently
- **Backend only**: `pnpm backend:dev` - Express.js + GraphQL API on :4000
- **Form builder only**: `pnpm form-app:dev` - React form builder app on :3000
- **Form viewer only**: `pnpm form-viewer:dev` - React form viewer app on :5173
- **Admin dashboard only**: `pnpm admin-app:dev` - React admin dashboard on :3002

### Database Commands
- **Setup database schema**: `pnpm db:generate && pnpm db:push` - Generate Prisma client and push schema to cloud MongoDB
- **Database management**: `pnpm db:studio` - Open Prisma Studio visual editor
- **Seed sample data**: `pnpm db:seed`

### Build & Validation
- **Build all**: `pnpm build`
- **Type check**: `pnpm type-check`
- **Lint code**: `pnpm lint`

### Integration Testing
- **Local tests**: `pnpm test:integration` - Run all integration tests against local backend
- **Production tests**: `pnpm test:integration:production` - Run all integration tests against deployed backend
- **Health check**: `pnpm test:integration:health` - Quick health test against deployed backend
- **Auth tests**: `pnpm test:integration:auth` - Authentication tests against deployed backend

### Browser Testing (Playwright)
- **Test credentials for Playwright MCP**: Use `sivam2@mailinator.com` as email and `password` as password for all browser automation tests

## Architecture Overview

This is a **pnpm monorepo** with four main applications and shared packages:

### Applications (`apps/`)
- **`backend/`**: Express.js + Apollo GraphQL server with Prisma ORM and MongoDB
- **`form-app/`**: React form builder application using shadcn/ui components from `@dculus/ui` package
- **`form-viewer/`**: React form viewing and submission application
- **`admin-app/`**: React admin dashboard for system administration and cross-organization management

### Shared Packages (`packages/`)
- **`@dculus/ui`**: All UI components (shadcn/ui), rich text editor components, and layouts
- **`@dculus/utils`**: Shared utilities, constants, helper functions, and API utilities
- **`@dculus/types`**: TypeScript type definitions and form field classes

## Key Technical Decisions

### API Architecture
- **GraphQL-first approach**: All business logic exposed via GraphQL (Apollo Server)
- **No REST endpoints** except for better-auth authentication APIs
- Backend uses **code-first GraphQL** schema approach

### Database & Authentication
- **Cloud MongoDB** with **Prisma ORM** for type-safe database access (no local Docker setup needed)
- **better-auth** for authentication and organization management
- Multi-tenant architecture with organizations, members, and role-based access

### Real-time Collaboration
- **YJS (Yjs)** with **y-websocket** and **y-mongodb-provider** for collaborative form editing
- Separate YJS documents stored in MongoDB for each form's collaborative state

### UI Component Architecture
- **Centralized UI components** in `@dculus/ui` package
- **Shared utilities** in `@dculus/utils` package for constants, helpers, and API utilities
- All applications import shadcn/ui components from the `@dculus/ui` package
- **No component duplication** across apps - everything imports from shared packages

### Import Patterns

```typescript
// Shared UI components
import { Button, Card, SidebarProvider } from '@dculus/ui';

// Shared utilities and constants
import { generateId, API_ENDPOINTS, cn } from '@dculus/utils';

// Shared types and form field classes
import type { Form, FormSchema } from '@dculus/types';
import { TextInputField, EmailField } from '@dculus/types';

// GraphQL with Apollo Client
import { useQuery, useMutation } from '@apollo/client';
```

## Form Schema & Collaborative Form Builder System

### FormSchema Structure
The collaborative form builder is built around a hierarchical **FormSchema** structure:

```typescript
FormSchema {
  pages: FormPage[];           // Multi-page form support
  layout: FormLayout;          // Theme, colors, spacing configuration  
  isShuffleEnabled: boolean;   // Randomize page/field order
}

FormPage {
  id: string;                  // Unique page identifier
  title: string;               // Page display title
  fields: FormField[];         // Array of form fields on this page
  order: number;               // Page ordering for multi-page forms
}

FormLayout {
  theme: 'light' | 'dark' | 'auto';
  textColor: string;           // Default text color
  spacing: 'compact' | 'normal' | 'spacious';
  code: string;                // Layout code
  content: string;             // Content string for layout
  customBackGroundColor: string; // Custom background color
  customCTAButtonName?: string;  // Custom call to action name
  backgroundImageKey: string;    // Image key of layout background image
}
```

### Form Field Class Hierarchy

The system uses **class-based form fields** with inheritance:

#### Base Classes
- **`FormField`**: Base class with `id` and `type` properties
- **`FillableFormField`**: Extends FormField with user input capabilities
  - `label`: Display label for the field
  - `defaultValue`: Pre-filled value 
  - `prefix`: Text/icon prefix (e.g., "$" for currency)
  - `hint`: Help text shown to users
  - `validation`: Required/optional validation rules

#### Specialized Field Types
- **`TextInputField`**: Single-line text input
- **`TextAreaField`**: Multi-line text input
- **`EmailField`**: Email validation with input type="email" 
- **`NumberField`**: Numeric input with optional `min`/`max` constraints
- **`SelectField`**: Dropdown selection with `options[]` and `multiple` support
- **`RadioField`**: Single-choice selection from `options[]`
- **`CheckboxField`**: Multi-choice selection from `options[]` 
- **`DateField`**: Date picker with optional `minDate`/`maxDate` constraints

### Serialization & Database Storage

Forms are serialized for database storage and YJS collaboration:

```typescript
// Convert class instances to plain objects for storage
serializeFormField(field: FormField): object
serializeFormSchema(schema: FormSchema): object

// Reconstruct class instances from stored data  
deserializeFormField(data: any): FormField
deserializeFormSchema(data: any): FormSchema
```

### Real-time Collaboration Integration

- Each `Form` has a corresponding **YJS document** for real-time collaborative editing
- FormSchema changes are synchronized via **y-websocket** and **y-mongodb-provider**
- Collaborative state is separate from the persisted Form record in MongoDB
- Multiple users can simultaneously edit form structure, fields, and layout

### Field Validation System

Each `FillableFormField` contains a `validation` object:
```typescript
FillableFormFieldValidation {
  required: boolean;  // Whether field must be filled
  type: FieldType;    // Field type for validation rules
}
```

Additional field-specific constraints:
- **NumberField**: `min`, `max` numeric ranges
- **DateField**: `minDate`, `maxDate` date ranges  
- **SelectField**: `options[]` array and `multiple` boolean
- **RadioField/CheckboxField**: `options[]` for available choices

## Development Guidelines

### Code Style & Architecture
- **Functional programming** preferred over OOP (except FormField classes)
- **Full TypeScript** type safety throughout
- **Zod schemas** for all validation (forms, API responses, database)
- Import UI components **only** from `@dculus/ui`
- Import utilities and constants **only** from `@dculus/utils`

### Backend Patterns
- GraphQL resolvers in `apps/backend/src/graphql/resolvers/`
- Business logic in `apps/backend/src/services/`
- Prisma client configured in `apps/backend/src/lib/prisma.ts`

### Frontend Patterns
- Apollo Client setup in `apps/form-app/src/services/apolloClient.ts`
- GraphQL queries/mutations in `apps/form-app/src/graphql/`
- Page components in respective `pages/` directories

### Internationalization & Translation Guidelines

**IMPORTANT**: All user-facing strings MUST be internationalized using the translation system.

#### Translation System Architecture
- **Translation files location**: `apps/form-app/src/locales/en/*.json`
- **Namespace pattern**: One JSON file per component/feature (e.g., `fieldAnalyticsViewer.json`)
- **Translation hook**: `useTranslation('namespaceName')` returns `{ t }` function
- **Variable interpolation**: Use `{{variableName}}` syntax in JSON, pass via `values` parameter

#### Never Hardcode Strings
**❌ WRONG** - Hardcoded strings:
```typescript
<p>Loading field analytics...</p>
<h1>Field Analytics</h1>
<div title={`"${word}" appears ${count} times`}>
```

**✅ CORRECT** - Using translations:
```typescript
<p>{t('loading.fieldAnalytics')}</p>
<h1>{t('titles.fieldAnalytics')}</h1>
<div title={t('tooltips.wordAppears', { values: { word, count } })}>
```

#### Translation File Structure
Organize translations logically with nested objects:
```json
{
  "titles": {
    "main": "Field Analytics",
    "details": "Field Insights"
  },
  "buttons": {
    "refresh": "Refresh",
    "save": "Save"
  },
  "tooltips": {
    "responseRate": {
      "title": "Response Rate",
      "description": "Percentage of form submissions..."
    }
  },
  "errors": {
    "loadingFailed": "Failed to load data"
  }
}
```

#### Using Translations in Components
```typescript
// 1. Import translation hook
import { useTranslation } from '../../hooks/useTranslation';

// 2. Use hook with namespace
const { t } = useTranslation('fieldAnalyticsViewer');

// 3. Simple translation
<h1>{t('titles.main')}</h1>

// 4. Translation with variables
<p>{t('description.count', { values: { count: 10 } })}</p>

// 5. Nested translation keys
<p>{t('tooltips.responseRate.description')}</p>
```

#### When Adding New Components
1. **Create translation file**: `apps/form-app/src/locales/en/yourComponent.json`
2. **Import in index.ts**: Add import and export in `apps/form-app/src/locales/index.ts`
3. **Register namespace**: Add to translations object with camelCase key
4. **Use in component**: `useTranslation('yourComponent')`

#### Translation Best Practices
- **Use descriptive keys**: `error.loadingFailed` not `err1`
- **Group related strings**: Use nested objects for organization
- **Variable interpolation**: Use `{{varName}}` for dynamic content
- **Reusable strings**: Share common strings under `common` namespace
- **No UI logic in translations**: Keep translations as pure text, no HTML
- **Consistent naming**: Use camelCase for keys, match component structure

#### Example: Complete Translation Setup
**File**: `apps/form-app/src/locales/en/userProfile.json`
```json
{
  "title": "User Profile",
  "fields": {
    "name": "Full Name",
    "email": "Email Address"
  },
  "buttons": {
    "save": "Save Changes",
    "cancel": "Cancel"
  },
  "messages": {
    "saveSuccess": "Profile updated successfully",
    "saveError": "Failed to update profile"
  }
}
```

**Component**: `apps/form-app/src/components/UserProfile.tsx`
```typescript
import { useTranslation } from '../hooks/useTranslation';

export const UserProfile = () => {
  const { t } = useTranslation('userProfile');

  return (
    <div>
      <h1>{t('title')}</h1>
      <input placeholder={t('fields.name')} />
      <input placeholder={t('fields.email')} />
      <button>{t('buttons.save')}</button>
      <button>{t('buttons.cancel')}</button>
    </div>
  );
};
```

**Key Rule**: If a user can see it on screen, it MUST be translated. No exceptions.

## Environment Setup

**Prerequisites**: Node.js >=18.0.0, pnpm >=8.0.0

**Quick setup**:
1. `pnpm install`
2. `pnpm build` (build shared packages)
3. `pnpm db:generate && pnpm db:push` (setup database schema on cloud MongoDB)
4. `pnpm dev` (start all services)

**Access points**:
- Form Builder: http://localhost:3000
- Form Viewer: http://localhost:5173
- Admin Dashboard: http://localhost:3002
- GraphQL API: http://localhost:4000/graphql
- Database Management: `pnpm db:studio` (Prisma Studio)

## Admin Dashboard

The **Admin Dashboard** (`admin-app`) provides system-wide administration capabilities:

### Features
- **Organizations Management**: View and manage all organizations in the system
- **System Statistics**: Dashboard with key metrics (user count, form count, etc.)
- **Cross-Organization Access**: Admin users can access data across all organizations
- **Template Management**: Create and manage form templates (planned)
- **User Management**: System-wide user administration (planned)

### Admin GraphQL Queries
- `adminOrganizations`: Get all organizations with member/form counts
- `adminOrganization(id)`: Get detailed organization info including members and forms
- `adminStats`: Get system-wide statistics

### Authentication & Authorization
- Uses the same better-auth system as other apps with admin plugin
- Requires admin role ('admin' or 'superAdmin') for access
- Role-based access control implemented with proper GraphQL resolver protection
- Super admin setup script available for creating initial admin users

### Admin Credentials
**Default Super Admin Account:**
- Email: `admin@dculus.com`
- Password: `admin123!@#`
- Role: `superAdmin`

**Setup Commands:**
- `pnpm admin:setup` - Create/update super admin user from environment variables

### Development Notes
- Admin app runs on port 3002
- Shares UI components and utilities with other apps
- GraphQL resolvers in `apps/backend/src/graphql/resolvers/admin.ts`
- Admin-specific React components in `apps/admin-app/src/components/`

## Better-Auth Roles & Permissions

This application uses **better-auth** with both **admin** and **organization** plugins to implement a comprehensive role-based access control system.

### System-Level Roles (User.role)

These roles provide global access control across the entire application:

| Role | Description | Permissions | Default | Admin Role |
|------|-------------|-------------|---------|------------|
| `user` | Standard user account | - Create organizations<br>- Join organizations<br>- Create and manage forms within organizations | ✅ | ❌ |
| `admin` | System administrator | - All user permissions<br>- Access admin dashboard<br>- View all organizations<br>- System-wide statistics<br>- Cross-organization data access | ❌ | ✅ |
| `superAdmin` | Super administrator | - All admin permissions<br>- System administration<br>- Create other admin users<br>- Full system control | ❌ | ✅ |

### Organization-Level Roles (Member.role)

These roles control access within specific organizations:

| Role | Description | Permissions | Default | Creator Role |
|------|-------------|-------------|---------|--------------|
| `member` | Regular organization member | - View organization forms<br>- Create form responses<br>- Basic organization access | ✅ | ❌ |
| `owner` | Organization owner/admin | - All member permissions<br>- Create and manage forms<br>- Invite members<br>- Organization management<br>- Access organization settings | ❌ | ✅ |

### Better-Auth Configuration

**Plugin Configuration** (`apps/backend/src/lib/better-auth.ts:36-48`):
```typescript
plugins: [
  bearer(),
  organization({
    allowUserToCreateOrganization: true,
    organizationLimit: 5,
    creatorRole: 'owner',        // Role assigned to organization creators
    membershipLimit: 100,
  }),
  admin({
    defaultRole: 'user',                // Default role for new users
    adminRoles: ['admin', 'superAdmin'], // Roles with admin privileges
  }),
]
```

### Access Control Implementation

**GraphQL Resolver Protection** (`apps/backend/src/graphql/resolvers/admin.ts:26-37`):
```typescript
function requireAdminRole(context: any) {
  if (!context.user) {
    throw new GraphQLError('Authentication required');
  }
  
  const userRole = context.user.role;
  if (!userRole || (userRole !== 'admin' && userRole !== 'superAdmin')) {
    throw new GraphQLError('Admin privileges required');
  }
  
  return context.user;
}
```

**Frontend Role Checks** (`apps/admin-app/src/services/auth.ts:88-92`):
```typescript
isAdmin: (user: any) => {
  return user.role === 'admin' || user.role === 'superAdmin';
},
isSuperAdmin: (user: any) => {
  return user.role === 'superAdmin';
}
```

### Database Schema

**User Model** (`apps/backend/prisma/schema.prisma:15-33`):
- `role` field defaults to `"user"`
- Stores system-level role (`user`, `admin`, `superAdmin`)

**Member Model** (`apps/backend/prisma/schema.prisma:89-102`):
- `role` field defaults to `"member"`
- Stores organization-level role (`member`, `owner`)
- Unique constraint on `[organizationId, userId]`

**Invitation Model** (`apps/backend/prisma/schema.prisma:104-120`):
- `role` field defaults to `"member"`
- Role that will be assigned when invitation is accepted

### Role Migration

The system includes migration script for updating legacy role names:
- `companyMember` → `member`
- `companyOwner` → `owner`

Run with: `apps/backend/src/scripts/migrate-organization-roles.ts`

## Form Viewer Analytics System

The form viewer includes a comprehensive analytics system that tracks form views with privacy-first anonymous data collection.

### Analytics Architecture

**Database Model** (`apps/backend/prisma/schema.prisma:220-242`):
```prisma
model FormViewAnalytics {
  id              String   @id @map("_id")
  formId          String   // Reference to Form
  sessionId       String   // Anonymous UUID session identifier  
  userAgent       String   // Full user agent string
  operatingSystem String?  // Parsed OS (Windows, macOS, Linux, etc.)
  browser         String?  // Parsed browser (Chrome, Firefox, Safari, etc.)
  browserVersion  String?  // Browser version
  countryCode     String?  // ISO 3166-1 alpha-3 (USA, CAN, GBR, etc.)
  regionCode      String?  // State/province code
  city            String?  // City if available
  timezone        String?  // IANA timezone (America/New_York, etc.)
  language        String?  // Browser locale (en-US, fr-CA, etc.)
  viewedAt        DateTime @default(now())
  
  form Form @relation(fields: [formId], references: [id], onDelete: Cascade)
  
  @@index([formId])
  @@index([viewedAt])
  @@index([sessionId])
  @@map("form_view_analytics")
}
```

### Analytics Dependencies

**Latest Libraries Used:**
- `@maxmind/geoip2-node@6.1.0` - IP geolocation (production-ready)
- `ua-parser-js@1.0.41` - User agent parsing
- `country-list@2.4.1` - ISO country code utilities
- `@types/ua-parser-js` & `@types/country-list` - TypeScript definitions

### Privacy-First Data Collection

**Anonymous Session Tracking:**
- Generates UUID session IDs via `crypto.randomUUID()`
- Stored in localStorage as `dculus_form_session_id`
- No personal data collection or IP address storage
- GDPR/CCPA compliant design

**Multi-Source Country Detection:**
1. **Primary**: IP geolocation (when available)
2. **Fallback 1**: Browser language parsing (`en-US` → `USA`)
3. **Fallback 2**: Timezone mapping (`America/New_York` → `USA`)

### GraphQL Analytics API

**Tracking Mutation:**
```graphql
mutation TrackFormView($input: TrackFormViewInput!) {
  trackFormView(input: $input) {
    success
  }
}
```

**Analytics Query** (requires authentication):
```graphql
query GetFormAnalytics($formId: ID!, $timeRange: TimeRangeInput) {
  formAnalytics(formId: $formId, timeRange: $timeRange) {
    totalViews
    uniqueSessions
    topCountries {
      code        # ISO 3-letter code (USA, CAN, GBR)
      name        # Display name (United States, Canada, United Kingdom)
      count
      percentage
    }
    topOperatingSystems {
      name        # Windows, macOS, Linux, etc.
      count
      percentage
    }
    topBrowsers {
      name        # Chrome, Firefox, Safari, etc.
      count
      percentage
    }
  }
}
```

### Client-Side Integration

**Form Viewer Hook** (`apps/form-viewer/src/hooks/useFormAnalytics.ts`):
```typescript
import { useFormAnalytics } from '../hooks/useFormAnalytics';

// Auto-track analytics when form loads
useFormAnalytics({ 
  formId: form.id, 
  enabled: true 
});
```

**Automatic Data Collection:**
- **Browser Info**: User agent, timezone, language
- **Session Management**: Persistent anonymous session IDs
- **Error Handling**: Analytics failures don't disrupt form viewing
- **Privacy**: No personal data sent to server

### Analytics Service

**Backend Service** (`apps/backend/src/services/analyticsService.ts`):
- User agent parsing with latest libraries
- Geographic detection with multiple fallback methods
- Country code standardization (ISO 3166-1 alpha-3)
- Efficient database aggregation queries
- Privacy-compliant data processing

**Key Features:**
- **Real-time tracking**: Analytics recorded on form load
- **Country standardization**: 3-letter ISO codes (USA, CAN, GBR)
- **Browser detection**: OS, browser, and version parsing
- **Session deduplication**: Unique session counting
- **Time-range filtering**: Analytics queries with date ranges

### Implementation Files

**Core Implementation:**
- `apps/backend/src/services/analyticsService.ts` - Analytics processing service
- `apps/backend/src/graphql/resolvers/analytics.ts` - GraphQL resolvers
- `apps/form-viewer/src/hooks/useFormAnalytics.ts` - Client-side tracking hook
- `apps/form-viewer/src/pages/FormViewer.tsx` - Integration point

**Database:**
- New `form_view_analytics` collection in MongoDB
- Indexed on formId, viewedAt, and sessionId for performance
- Connected to existing Form model via foreign key

### Usage Examples

**Check Analytics Data:**
```bash
# View recent analytics for a form
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.formViewAnalytics.findMany({
  where: { formId: 'your-form-id' },
  orderBy: { viewedAt: 'desc' },
  take: 10
}).then(console.log);
"
```

**Analytics Dashboard Integration:**
The GraphQL `formAnalytics` query provides all data needed for building analytics dashboards with charts showing:
- Total views and unique sessions over time
- Geographic distribution (countries with ISO codes)
- Browser and operating system statistics
- Visitor behavior patterns

This system provides comprehensive form analytics while maintaining user privacy and following modern data protection standards.

## Toast Notifications

The application uses **Sonner** for user feedback notifications throughout the interface. All toast notifications are centralized through the `@dculus/ui` package and follow standardized patterns.

### Implementation Reference

For detailed guidance on implementing toast notifications consistently across the application, see:
- **[Toast Implementation Guide](./TOAST_IMPLEMENTATION_GUIDE.md)** - Comprehensive documentation of toast notification patterns, best practices, and implementation examples

### Key Features
- **Centralized imports** from `@dculus/ui` package (`toastSuccess`, `toastError`, `toastInfo`)
- **Consistent patterns** for GraphQL mutations, permission violations, and user actions
- **Contextual messaging** with appropriate success/error details
- **Permission-aware feedback** for unauthorized operations
- **Integration** with Apollo Client, better-auth, and form builder operations

### Common Usage Patterns
```typescript
// Import from centralized UI package
import { toastSuccess, toastError } from '@dculus/ui';

// GraphQL mutation success
toastSuccess('Form created successfully', `"${formTitle}" is ready for editing`);

// Permission violation
toastError('Permission denied', 'You need EDITOR access to perform this action');

// Copy to clipboard
toastSuccess('Copied to clipboard', 'Form link has been copied');
```

The toast system provides immediate user feedback for all major operations including form creation, sharing, permission management, authentication, and collaboration features.

## Plugin System

The application uses an **event-driven plugin system** that allows extending functionality without modifying core code. Plugins listen to events (like `form.submitted`) and can perform actions such as sending webhooks, emails, or auto-grading responses.

### Plugin Metadata System

Plugins can store execution results in `Response.metadata` using a generic, plugin-type-based key system:

```typescript
Response.metadata = {
  'quiz-grading': { quizScore: 8, totalMarks: 10, percentage: 80, ... },
  'email': { deliveryStatus: 'sent', sentAt: '...' },
  'webhook': { statusCode: 200, deliveredAt: '...' },
}
```

**Benefits:**
- No database schema changes needed for new plugins
- Each plugin's data is isolated under its own key
- Type-safe with TypeScript interfaces
- Dynamic frontend metadata viewers based on plugin type

### Available Plugins

**Webhook Plugin** (`webhook`) - Send HTTP POST requests to external URLs
**Email Plugin** (`email`) - Send custom email notifications with @ mention support
**Quiz Auto-Grading Plugin** (`quiz-grading`) - Automatically grade quiz responses

### Quiz Auto-Grading Plugin

Automatically grades form responses containing quiz questions (SelectField/RadioField only):

**Configuration:** All settings in plugin UI (NOT in field settings)
- Select fields to include in quiz
- Set correct answer for each field (from dropdown options)
- Assign marks per question (supports decimals)
- Set pass threshold percentage (default: 60%)

**Grading:** Binary scoring (full marks if correct, 0 if incorrect)

**Storage:** Results stored in `Response.metadata['quiz-grading']`

**Display:**
- Score column in responses table with color-coded badges
- Detailed results viewer with pass/fail status
- Per-question breakdown showing correct/incorrect

**Documentation:**
- [QUIZ_GRADING_PLUGIN.md](./QUIZ_GRADING_PLUGIN.md) - Complete plugin documentation
- [PLUGIN_SYSTEM.md](./PLUGIN_SYSTEM.md) - Plugin system architecture
- [QUIZ_GRADING_IMPLEMENTATION_CHECKLIST.md](./QUIZ_GRADING_IMPLEMENTATION_CHECKLIST.md) - Implementation guide
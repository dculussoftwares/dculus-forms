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
- **Setup database**: `pnpm docker:up && pnpm db:generate && pnpm db:push`
- **Database management**: `pnpm db:studio` - Open Prisma Studio visual editor
- **Seed sample data**: `pnpm db:seed`

### Build & Validation
- **Build all**: `pnpm build`
- **Type check**: `pnpm type-check`
- **Lint code**: `pnpm lint`

## Architecture Overview

This is a **pnpm monorepo** with four main applications and shared packages:

### Applications (`apps/`)
- **`backend/`**: Express.js + Apollo GraphQL server with Prisma ORM and MongoDB
- **`form-app/`**: React form builder application using shadcn/ui components  
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
- **MongoDB** with **Prisma ORM** for type-safe database access
- **better-auth** for authentication and organization management
- Multi-tenant architecture with organizations, members, and role-based access

### Real-time Collaboration
- **YJS (Yjs)** with **y-websocket** and **y-mongodb-provider** for collaborative form editing
- Separate YJS documents stored in MongoDB for each form's collaborative state

### UI Component Architecture
- **Centralized UI components** in `@dculus/ui` package
- **Shared utilities** in `@dculus/utils` package for constants, helpers, and API utilities
- All applications import shadcn/ui components from `@dculus/ui`
- **No component duplication** across apps - everything imports from respective packages

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

## Environment Setup

**Prerequisites**: Node.js >=18.0.0, pnpm >=8.0.0

**Quick setup**:
1. `pnpm install`
2. `pnpm build` (build shared packages)
3. `pnpm docker:up` (start MongoDB)
4. `pnpm db:generate && pnpm db:push`
5. `pnpm dev` (start all services)

**Access points**:
- Form Builder: http://localhost:3000
- Form Viewer: http://localhost:5173  
- Admin Dashboard: http://localhost:3002
- GraphQL API: http://localhost:4000/graphql
- Database UI: http://localhost:8081 (admin/password123)

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
- Uses the same better-auth system as other apps
- Requires admin role for access (role checking implementation pending)
- Planned integration with better-auth admin plugin for role-based access control

### Development Notes
- Admin app runs on port 3002
- Shares UI components and utilities with other apps
- GraphQL resolvers in `apps/backend/src/graphql/resolvers/admin.ts`
- Admin-specific React components in `apps/admin-app/src/components/`
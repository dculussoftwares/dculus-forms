# Dculus Forms - Project Context

## Overview
Dculus Forms is a modern, full-stack form builder and management system designed for creating, managing, and analyzing forms with advanced features including quiz grading, analytics, and subscription management.

## Architecture

### Monorepo Structure
This project uses **pnpm workspaces** to manage a monorepo with multiple applications and shared packages.

```
dculus-forms/
├── apps/                    # Application layer
│   ├── backend/            # Express.js + Apollo GraphQL API
│   ├── form-app/           # React form builder (main app)
│   ├── form-viewer/        # React form viewer/submission app
│   └── admin-app/          # React admin dashboard
├── packages/               # Shared packages
│   ├── ui/                # shadcn/ui components
│   ├── utils/             # Shared utilities
│   ├── types/             # TypeScript type definitions
│   └── plugins/           # Plugin system
└── test/                  # Testing suites
    ├── integration/       # Cucumber integration tests
    └── e2e/              # Playwright E2E tests
```

### Technology Stack

#### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **API**: Apollo GraphQL (code-first with TypeGraphQL patterns)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: better-auth
- **Subscriptions**: Chargebee integration
- **Real-time**: WebSocket subscriptions for collaborative editing

#### Frontend Applications
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Library**: shadcn/ui (Radix UI primitives)
- **Styling**: Tailwind CSS
- **State Management**: Apollo Client (GraphQL), React Context
- **Routing**: React Router v6
- **Rich Text**: Lexical editor

#### Shared Packages
- **@dculus/ui**: Centralized UI components (Button, Card, Input, Sidebar, etc.)
- **@dculus/utils**: Utility functions (generateId, cn, API helpers)
- **@dculus/types**: Shared TypeScript types and interfaces
- **@dculus/plugins**: Plugin system for extensibility

## Core Concepts

### 1. Forms
Forms are the primary entity in the system. Each form consists of:
- **Metadata**: Title, description, settings
- **Fields**: Array of form fields (text, number, choice, etc.)
- **Layout**: Visual arrangement and styling
- **Logic**: Conditional logic, validation rules
- **Plugins**: Quiz grading, analytics, etc.

### 2. Responses
User submissions to forms, including:
- **Field values**: User-entered data
- **Metadata**: Submission time, IP, user agent, location
- **Status**: Draft, submitted, reviewed
- **Scoring**: For quiz-enabled forms

### 3. Templates
Reusable form templates that can be:
- **Public**: Available to all users
- **Private**: Organization-specific
- **Categorized**: By use case (surveys, quizzes, registrations)

### 4. Organizations
Multi-tenant structure where:
- Users belong to organizations
- Forms are scoped to organizations
- Subscriptions are organization-level
- Roles: Owner, Admin, Member, Viewer

### 5. Plugin System
Extensible architecture for adding features:
- **Quiz Grading**: Automatic scoring and feedback
- **Analytics**: Response analytics and insights
- **Custom Plugins**: Extensible via plugin interface

## Data Flow

### Form Creation Flow
1. User creates form in `form-app`
2. GraphQL mutation sent to backend
3. Prisma creates form in PostgreSQL
4. Real-time subscription notifies collaborators
5. Form available in dashboard

### Form Submission Flow
1. User accesses form via `form-viewer`
2. Form fetched via GraphQL query
3. User fills and submits form
4. Validation runs (client + server)
5. Response stored in database
6. Plugins process response (grading, analytics)
7. Confirmation shown to user

### Authentication Flow
1. User signs up/logs in via better-auth
2. Session token stored in cookie
3. GraphQL requests include session
4. Middleware validates and attaches user context
5. Resolvers check permissions

## Key Design Patterns

### 1. Repository Pattern
Business logic separated from data access:
```
Controller/Resolver → Service → Repository → Prisma
```

### 2. GraphQL Code-First
Schema generated from TypeScript types and resolvers, ensuring type safety.

### 3. Shared UI Components
All UI components centralized in `@dculus/ui` to avoid duplication and ensure consistency.

### 4. Plugin Architecture
Extensible system where plugins can hook into form lifecycle events.

## Environment Configuration

### Development
- Backend: `http://localhost:4000`
- Form App: `http://localhost:3000`
- Form Viewer: `http://localhost:5173`
- Admin App: `http://localhost:5174`
- GraphQL Playground: `http://localhost:4000/graphql`

### Production
- Backend: Azure Container Apps
- Frontend Apps: Cloudflare Pages
- Database: Azure PostgreSQL
- File Storage: Azure Blob Storage

## Database Schema Highlights

### Core Tables
- `User`: User accounts and authentication
- `Organization`: Multi-tenant organizations
- `Form`: Form definitions and metadata
- `FormResponse`: User submissions
- `Template`: Reusable form templates
- `Session`: Authentication sessions
- `Subscription`: Chargebee subscription data

### Relationships
- User → Organization (many-to-many via OrganizationMember)
- Organization → Form (one-to-many)
- Form → FormResponse (one-to-many)
- Form → Template (optional one-to-one)

## Testing Strategy

### Unit Tests
- Backend services and utilities
- Run with: `pnpm test:unit`
- Framework: Vitest

### Integration Tests
- API endpoints and GraphQL resolvers
- Run with: `pnpm test:integration`
- Framework: Cucumber + supertest

### E2E Tests
- Full user flows across applications
- Run with: `pnpm test:e2e`
- Framework: Playwright + Cucumber

## Deployment

### CI/CD Pipeline
GitHub Actions workflow:
1. Lint and type-check
2. Run unit tests
3. Run integration tests
4. Build applications
5. Create release artifacts
6. Deploy to Azure/Cloudflare

### Release Process
1. Create annotated git tag: `git tag -a v1.2.0 -m "Release v1.2.0"`
2. Push tag: `git push origin v1.2.0`
3. GitHub Actions builds and creates release
4. Artifacts available for download

## Common Gotchas

1. **Shared Package Changes**: After modifying `@dculus/ui`, `@dculus/utils`, or `@dculus/types`, run `pnpm build` to rebuild packages before testing in apps.

2. **Database Migrations**: Always run `pnpm db:generate` after schema changes, then `pnpm db:push` for development or create migration for production.

3. **GraphQL Schema**: Schema is code-first, so TypeScript changes automatically update GraphQL schema. Restart backend to see changes.

4. **Environment Variables**: Each app has its own `.env` file. Backend requires database URL and auth secrets.

5. **CORS**: Backend configured for specific origins. Update CORS settings when adding new frontend deployments.

## Project History

### Major Milestones
- **MongoDB → PostgreSQL Migration**: Completed migration from MongoDB to PostgreSQL with Prisma
- **Chargebee Integration**: Subscription management with dynamic plans
- **Plugin System**: Extensible architecture for quiz grading and analytics
- **UI Centralization**: Moved all UI components to shared package
- **Testing Infrastructure**: Comprehensive integration and E2E test suites

## Quick Reference

### Most Used Commands
```bash
pnpm dev                    # Start all services
pnpm backend:dev           # Backend only
pnpm form-app:dev          # Form builder only
pnpm db:studio             # Open Prisma Studio
pnpm test:integration      # Run integration tests
pnpm build                 # Build all packages
```

### Important Files
- `apps/backend/prisma/schema.prisma` - Database schema
- `apps/backend/src/graphql/` - GraphQL schema and resolvers
- `packages/ui/src/` - Shared UI components
- `test/integration/features/` - Integration test scenarios
- `DEPLOYMENT_GUIDE.md` - Deployment instructions

## Resources
- [README.md](../README.md) - Getting started guide
- [DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md) - Deployment instructions
- [PLUGIN_SYSTEM.md](../PLUGIN_SYSTEM.md) - Plugin development guide
- [GRAPHQL_AUTHORIZATION_GUIDE.md](../GRAPHQL_AUTHORIZATION_GUIDE.md) - Authorization patterns

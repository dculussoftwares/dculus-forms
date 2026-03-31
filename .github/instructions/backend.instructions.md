---
applyTo: "apps/backend/**"
---

# Backend Development Instructions

## Architecture

The backend is an **Express.js** server with **Apollo Server** providing the GraphQL API and **Hocuspocus** for real-time Y.js collaboration over WebSocket.

### Layer Architecture
```
GraphQL Resolvers (thin — delegate to services)
     ↓
Services (business logic, validation, orchestration)
     ↓
Repositories (Prisma data access)
     ↓
Prisma Client → PostgreSQL
```

## Key Files

| Purpose | Path |
|---------|------|
| Entry point | `src/index.ts` |
| GraphQL SDL schema | `src/graphql/schema.ts` |
| Resolver barrel | `src/graphql/resolvers.ts` |
| Domain resolvers | `src/graphql/resolvers/{domain}.ts` |
| Prisma client | `src/lib/prisma.ts` |
| Auth config | `src/lib/better-auth.ts` |
| Environment vars | `src/lib/env.ts` |
| Error factory | `src/lib/graphqlErrors.ts` |
| Logger | `src/lib/logger.ts` |
| Hocuspocus server | `src/services/hocuspocus.ts` |
| Prisma schema | `prisma/schema.prisma` |

## Resolver Domains

Resolvers in `src/graphql/resolvers/`:
- `forms.ts` — Form CRUD, publishing, duplication
- `responses.ts` — Response submission, editing, pagination, filtering
- `templates.ts` — Template gallery CRUD
- `plugins.ts` — Form plugin management
- `admin.ts` — Admin-only queries (requires `superAdmin` role)
- `analytics.ts` — Form view/submission tracking
- `fieldAnalytics.ts` — Per-field analytics (text, number, selection, etc.)
- `fileUpload.ts` — File upload mutations
- `formFiles.ts` — Form file queries
- `formSharing.ts` — Permission & sharing management
- `invitations.ts` — Org invitation handling
- `better-auth.ts` — User/org GraphQL integration
- `subscriptions.ts` — Chargebee subscription queries/mutations
- `unifiedExport.ts` — Response export (Excel/CSV)

## Adding a New Resolver

1. Create `src/graphql/resolvers/{domain}.ts`:
```typescript
import { prisma } from '../lib/prisma.js';
import { getUserAndOrgFromContext } from './better-auth.js';

export const myResolvers = {
  Query: {
    myQuery: async (_: any, args: { id: string }, context: any) => {
      const { userId, organizationId } = await getUserAndOrgFromContext(context);
      if (!userId) throw new Error('Authentication required');
      // business logic
    },
  },
  Mutation: {
    myMutation: async (_: any, { input }: { input: MyInput }, context: any) => {
      const { userId } = await getUserAndOrgFromContext(context);
      if (!userId) throw new Error('Authentication required');
      // business logic
    },
  },
};
```

2. Add types to `src/graphql/schema.ts`
3. Register in `src/graphql/resolvers.ts`:
```typescript
import { myResolvers } from './resolvers/myDomain.js';
// Add to Query: { ...myResolvers.Query },
// Add to Mutation: { ...myResolvers.Mutation },
```

## Authentication Context

```typescript
// Always use this helper to extract auth info
const { userId, organizationId } = await getUserAndOrgFromContext(context);

// For admin-only endpoints
const user = await prisma.user.findUnique({ where: { id: userId } });
if (user?.role !== 'superAdmin') throw new Error('Admin access required');
```

## Prisma Patterns

```typescript
// Always use transactions for multi-model operations
await prisma.$transaction(async (tx) => {
  const form = await tx.form.update({ where: { id }, data: { ... } });
  await tx.formViewAnalytics.create({ data: { ... } });
  return form;
});

// Include relations
const form = await prisma.form.findUnique({
  where: { id },
  include: { organization: true, createdBy: true, permissions: true },
});
```

## Error Handling

```typescript
import { GraphQLError } from 'graphql';

// Use structured errors
throw new GraphQLError('Form not found', {
  extensions: { code: 'NOT_FOUND' },
});
```

## Service Layer

Services in `src/services/` contain business logic:
- `formService.ts` — Form operations
- `responseService.ts` — Response management
- `analyticsService.ts` — View/submission analytics
- `fieldAnalyticsService.ts` — Per-field statistics
- `hocuspocus.ts` — Y.js collaboration server
- `chargebeeService.ts` — Billing integration
- `emailService.ts` — Email notifications
- `fileUploadService.ts` — File handling
- `unifiedExportService.ts` — Export generation

## Plugin System

Plugin handlers in `src/plugins/`:
- Each plugin type has a `handler.ts`
- Register in `src/plugins/registry.ts`
- Plugins fire on events: `form.submitted`, `plugin.test`
- Results stored in `Response.metadata` JSON field

## Environment Variables

Required in `.env`:
```bash
DATABASE_URL="postgresql://..."
BETTER_AUTH_SECRET="..."
BETTER_AUTH_BASE_URL="http://localhost:4000"
CHARGEBEE_SITE="..."
CHARGEBEE_API_KEY="..."
```

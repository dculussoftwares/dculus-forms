---
applyTo: "prisma/**,**/prisma/**"
---

# Database & Prisma Instructions

## Database: PostgreSQL (via Prisma ORM)

### Schema Location
`apps/backend/prisma/schema.prisma`

### Database Commands
```bash
pnpm db:generate      # Generate Prisma client after schema changes
pnpm db:push          # Push schema to PostgreSQL (dev)
pnpm db:studio        # Visual database editor
pnpm db:seed          # Seed sample data
```

## Schema Overview

### Core Models
```
User ←→ Member ←→ Organization
                    ├── Form ←→ Response
                    │     ├── FormPermission
                    │     ├── FormPlugin ←→ PluginDelivery
                    │     ├── FormFile
                    │     ├── FormViewAnalytics
                    │     ├── FormSubmissionAnalytics
                    │     └── FormMetadata (cache)
                    └── Subscription (Chargebee)

CollaborativeDocument (Y.js persistence)
Response ←→ ResponseEditHistory ←→ ResponseFieldChange
```

### Model Naming Conventions
- Table names: lowercase snake_case (`@@map("form_plugin")`)
- Field names: camelCase
- IDs: `cuid()` (Prisma default)
- Timestamps: `createdAt @default(now())`, `updatedAt @updatedAt`

### JSON Fields
- `Form.formSchema` — Form structure (pages, fields, layout)
- `Form.settings` — Form settings (thankYou, submissionLimits)
- `Response.data` — Submission data `{ fieldId: value }`
- `Response.metadata` — Plugin results (quiz scores, webhook responses)
- `FormPlugin.config` — Plugin-specific config

### Indexes
```prisma
// GIN indexes for JSONB querying
@@index([data(ops: JsonbOps)], type: Gin)

// Standard indexes
@@index([formId])
@@index([sessionId])
@@index([viewedAt])
```

## Adding a New Model

1. Add model to `prisma/schema.prisma`:
```prisma
model MyModel {
  id        String   @id @default(cuid())
  name      String
  formId    String
  data      Json
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  form Form @relation(fields: [formId], references: [id], onDelete: Cascade)

  @@index([formId])
  @@map("my_model")
}
```

2. Add relation to parent model:
```prisma
model Form {
  // ... existing fields
  myModels MyModel[]
}
```

3. Generate and push:
```bash
pnpm db:generate
pnpm db:push
```

## Prisma Usage Patterns

### Transactions
```typescript
await prisma.$transaction(async (tx) => {
  const form = await tx.form.update({ ... });
  await tx.response.create({ ... });
  return form;
});
```

### Pagination
```typescript
const [items, total] = await Promise.all([
  prisma.form.findMany({
    where: { organizationId },
    skip: (page - 1) * limit,
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: { createdBy: true },
  }),
  prisma.form.count({ where: { organizationId } }),
]);
```

### JSON Field Querying
```typescript
// Filter by JSON field
const responses = await prisma.response.findMany({
  where: {
    data: { path: ['fieldId'], equals: 'value' },
  },
});
```

## Cascade Deletes

All relations use `onDelete: Cascade`:
- Deleting an Organization cascades to Members, Forms, Subscriptions
- Deleting a Form cascades to Responses, Permissions, Plugins, Analytics
- Deleting a Response cascades to EditHistory, SubmissionAnalytics

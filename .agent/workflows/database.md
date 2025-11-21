---
description: Database operations and migrations
---

# Database Workflow

This workflow covers database operations, migrations, and management.

## Database Stack

- **Database**: PostgreSQL
- **ORM**: Prisma
- **Schema**: `apps/backend/prisma/schema.prisma`
- **Migrations**: `apps/backend/prisma/migrations/`

## Common Operations

### Start/Stop Database

```bash
# Start PostgreSQL (Docker)
pnpm docker:up

# Stop PostgreSQL
pnpm docker:down

# View PostgreSQL logs
pnpm docker:logs
```

### Prisma Studio (Database GUI)

```bash
# Open Prisma Studio
pnpm db:studio
```

Opens at `http://localhost:5555` - view and edit data visually.

### Generate Prisma Client

```bash
# Generate Prisma client after schema changes
pnpm db:generate
```

Run this after modifying `schema.prisma`.

### Push Schema Changes

```bash
# Push schema to database (development only)
pnpm db:push
```

⚠️ **Warning**: This is for development only. Use migrations for production.

### Seed Database

```bash
# Seed database with sample data
pnpm db:seed
```

Creates:
- Test users
- Sample organizations
- Example forms
- Test responses

## Schema Changes

### Workflow for Schema Changes

1. **Modify Schema**
   ```prisma
   // apps/backend/prisma/schema.prisma
   model Form {
     id          String   @id @default(cuid())
     title       String
     description String?
     // Add new field
     category    String?  @default("general")
   }
   ```

2. **Generate Client**
   ```bash
   pnpm db:generate
   ```

3. **Development: Push Changes**
   ```bash
   pnpm db:push
   ```

4. **Production: Create Migration**
   ```bash
   cd apps/backend
   npx prisma migrate dev --name add_category_to_form
   ```

### Common Schema Patterns

#### Adding a Field

```prisma
model Form {
  // Existing fields...
  
  // New optional field
  category String?
  
  // New required field with default
  status String @default("draft")
  
  // New field with index
  slug String @unique
}
```

#### Adding a Relation

```prisma
model Form {
  id       String   @id @default(cuid())
  // ... other fields
  
  // One-to-many relation
  tags     FormTag[]
}

model FormTag {
  id     String @id @default(cuid())
  name   String
  formId String
  form   Form   @relation(fields: [formId], references: [id], onDelete: Cascade)
  
  @@index([formId])
}
```

#### Adding an Index

```prisma
model FormResponse {
  id        String   @id @default(cuid())
  formId    String
  createdAt DateTime @default(now())
  
  // Add index for performance
  @@index([formId, createdAt])
}
```

## Migrations

### Create Migration

```bash
# Create a new migration
cd apps/backend
npx prisma migrate dev --name descriptive_migration_name
```

Examples:
```bash
npx prisma migrate dev --name add_category_to_form
npx prisma migrate dev --name create_form_tags_table
npx prisma migrate dev --name add_index_to_responses
```

### Apply Migrations

```bash
# Apply pending migrations (production)
cd apps/backend
npx prisma migrate deploy
```

### Reset Database

```bash
# ⚠️ WARNING: This deletes all data!
cd apps/backend
npx prisma migrate reset
```

This will:
1. Drop the database
2. Create a new database
3. Apply all migrations
4. Run seed script

### View Migration Status

```bash
cd apps/backend
npx prisma migrate status
```

## Data Seeding

### Seed Script Location

`apps/backend/src/scripts/seed.ts`

### Customize Seed Data

```typescript
// apps/backend/src/scripts/seed.ts
async function main() {
  // Create users
  const user = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      name: 'Admin User',
    },
  });

  // Create organization
  const org = await prisma.organization.create({
    data: {
      name: 'Test Organization',
      members: {
        create: {
          userId: user.id,
          role: 'OWNER',
        },
      },
    },
  });

  // Create forms
  await prisma.form.createMany({
    data: [
      {
        title: 'Customer Feedback',
        organizationId: org.id,
        createdBy: user.id,
      },
      {
        title: 'Event Registration',
        organizationId: org.id,
        createdBy: user.id,
      },
    ],
  });
}
```

### Run Seed

```bash
pnpm db:seed
```

## Database Queries

### Using Prisma Client

```typescript
// Import Prisma client
import { prisma } from '@/lib/prisma';

// Find one
const form = await prisma.form.findUnique({
  where: { id: formId },
  include: { responses: true },
});

// Find many
const forms = await prisma.form.findMany({
  where: { organizationId: orgId },
  orderBy: { createdAt: 'desc' },
  take: 10,
});

// Create
const newForm = await prisma.form.create({
  data: {
    title: 'New Form',
    organizationId: orgId,
    createdBy: userId,
  },
});

// Update
const updated = await prisma.form.update({
  where: { id: formId },
  data: { title: 'Updated Title' },
});

// Delete
await prisma.form.delete({
  where: { id: formId },
});
```

### Performance Optimization

```typescript
// Select only needed fields
const forms = await prisma.form.findMany({
  select: {
    id: true,
    title: true,
    createdAt: true,
  },
});

// Use pagination
const forms = await prisma.form.findMany({
  skip: (page - 1) * pageSize,
  take: pageSize,
});

// Use indexes (defined in schema)
// Queries on indexed fields are faster
const forms = await prisma.form.findMany({
  where: { organizationId: orgId }, // Uses index
});
```

## Backup and Restore

### Backup Database

```bash
# Using Docker
docker exec dculus-postgres pg_dump -U admin dculus_forms > backup.sql

# Or using pg_dump directly
pg_dump -h localhost -U admin -d dculus_forms > backup.sql
```

### Restore Database

```bash
# Using Docker
docker exec -i dculus-postgres psql -U admin dculus_forms < backup.sql

# Or using psql directly
psql -h localhost -U admin -d dculus_forms < backup.sql
```

## Troubleshooting

### Connection Errors

```bash
# Check if PostgreSQL is running
docker ps

# Check DATABASE_URL in .env
cat apps/backend/.env | grep DATABASE_URL

# Restart PostgreSQL
pnpm docker:down
pnpm docker:up
```

### Migration Errors

```bash
# Check migration status
cd apps/backend
npx prisma migrate status

# If migrations are out of sync, resolve manually
npx prisma migrate resolve --applied "migration_name"
npx prisma migrate resolve --rolled-back "migration_name"
```

### Schema Sync Issues

```bash
# Regenerate Prisma client
pnpm db:generate

# Push schema (development)
pnpm db:push

# Or create migration (production)
cd apps/backend
npx prisma migrate dev
```

### Data Corruption

```bash
# Reset database (⚠️ deletes all data)
cd apps/backend
npx prisma migrate reset

# Reseed
pnpm db:seed
```

## Production Database

### Environment Variables

```bash
# Production DATABASE_URL
DATABASE_URL="postgresql://user:password@host:5432/database?schema=public&sslmode=require"
```

### Apply Migrations

```bash
# In production environment
cd apps/backend
npx prisma migrate deploy
```

### Connection Pooling

For production, use connection pooling:

```prisma
// schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // Add connection pool
  directUrl = env("DIRECT_DATABASE_URL")
}
```

## Quick Reference

```bash
# Docker
pnpm docker:up              # Start PostgreSQL
pnpm docker:down            # Stop PostgreSQL

# Prisma
pnpm db:generate            # Generate client
pnpm db:push                # Push schema (dev)
pnpm db:studio              # Open GUI
pnpm db:seed                # Seed data

# Migrations
npx prisma migrate dev      # Create migration (dev)
npx prisma migrate deploy   # Apply migrations (prod)
npx prisma migrate reset    # Reset database
```

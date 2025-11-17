# Part 5: Phase-by-Phase Schema Migration (Fresh Database)

**Document**: MongoDB to PostgreSQL Migration - Execution Plan (No Data Migration)  
**Last Updated**: November 17, 2025

---

## 🎯 Objective

Convert Prisma schema from **MongoDB** to **PostgreSQL** for a **fresh application** deployment. No existing data migration required.

---

## 📋 Migration Overview

Since we're starting fresh, the migration is **significantly simpler**:

1. **Convert Prisma schema** syntax
2. **Update database provider** configuration
3. **Adjust code for PostgreSQL-specific features**
4. **Test thoroughly** before production deployment

**Estimated Timeline**: 1-2 weeks  
**Risk Level**: LOW (no data loss concerns)  
**Downtime**: None (fresh deployment)

---

## 🔄 Phase 1: Prisma Schema Conversion

### Current MongoDB Schema Changes

**File**: `apps/backend/prisma/schema.prisma`

#### 1.1 Update Datasource Configuration

```prisma
// BEFORE (MongoDB)
datasource db {
  provider = "mongodb"
  url      = env("DATABASE_URL")
}

// AFTER (PostgreSQL)
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

#### 1.2 Change ID Field Mapping

**MongoDB uses `@map("_id")` for IDs, PostgreSQL doesn't need this.**

```prisma
// BEFORE (MongoDB)
model User {
  id String @id @map("_id")
}

// AFTER (PostgreSQL)
model User {
  id String @id @default(cuid())
}
```

**Apply to all models**: User, Account, Session, Organization, Member, Invitation, Form, Response, etc.

#### 1.3 Update Index Syntax

**MongoDB uses `@@map()` for collection names, PostgreSQL uses `@@map()` for table names (same syntax, just different meaning).**

```prisma
// BEFORE (MongoDB)
model User {
  @@map("user")
}

// AFTER (PostgreSQL) - Same syntax!
model User {
  @@map("user")
}
```

**No changes needed** - Prisma handles this consistently.

#### 1.4 Convert Array Fields

**MongoDB allows `String[]`, PostgreSQL requires explicit array syntax.**

```prisma
// BEFORE (MongoDB)
model FormPlugin {
  events String[]  // MongoDB array
}

// AFTER (PostgreSQL)
model FormPlugin {
  events String[]  // PostgreSQL also supports this!
}
```

**No changes needed** - Prisma handles array types for both databases.

#### 1.5 Handle Binary Data (BYTEA)

**MongoDB `Bytes` → PostgreSQL `Bytes` (Prisma abstracts this).**

```prisma
// BEFORE (MongoDB)
model CollaborativeDocument {
  state Bytes
}

// AFTER (PostgreSQL)
model CollaborativeDocument {
  state Bytes  // Prisma maps to BYTEA automatically
}
```

**No changes needed** - Prisma handles binary types.

#### 1.6 Add Default Values for IDs

**PostgreSQL needs default ID generation strategy.**

```prisma
// AFTER (PostgreSQL) - Add @default() to all ID fields
model User {
  id String @id @default(cuid())
}

model Organization {
  id String @id @default(cuid())
}

model Form {
  id String @id @default(cuid())
}

// For all models...
```

---

## 📝 Complete PostgreSQL Schema

**File**: `apps/backend/prisma/schema.prisma`

### Full Converted Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================================================
// AUTHENTICATION & USER MANAGEMENT (better-auth)
// ============================================================================

model User {
  id            String   @id @default(cuid())
  name          String
  email         String   @unique
  emailVerified Boolean?
  image         String?
  role          String?  @default("user")
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  // Relations
  accounts           Account[]
  sessions           Session[]
  members            Member[]
  invitations        Invitation[]     @relation("InvitedBy")
  forms              Form[]
  formPermissions    FormPermission[]
  grantedPermissions FormPermission[] @relation("GrantedPermissions")
  responseEdits      ResponseEditHistory[]

  @@map("user")
}

model Account {
  id                    String    @id @default(cuid())
  accountId             String
  providerId            String
  userId                String
  accessToken           String?
  refreshToken          String?
  idToken               String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  password              String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("account")
}

model Session {
  id                   String   @id @default(cuid())
  expiresAt            DateTime
  token                String   @unique
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
  ipAddress            String?
  userAgent            String?
  userId               String
  activeOrganizationId String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("session")
}

model Organization {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  logo      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  metadata  String?

  // Relations
  members      Member[]
  invitations  Invitation[]
  forms        Form[]
  subscription Subscription?

  @@map("organization")
}

model Member {
  id             String   @id @default(cuid())
  organizationId String
  userId         String
  role           String   @default("member")
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([organizationId, userId])
  @@map("member")
}

model Invitation {
  id             String   @id @default(cuid())
  organizationId String
  email          String
  role           String   @default("member")
  status         String   @default("pending")
  inviterId      String
  expiresAt      DateTime
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  inviter      User         @relation("InvitedBy", fields: [inviterId], references: [id], onDelete: Cascade)

  @@map("invitation")
}

// ============================================================================
// FORM MANAGEMENT
// ============================================================================

model Form {
  id                String   @id @default(cuid())
  title             String
  description       String?
  shortUrl          String   @unique
  formSchema        Json
  settings          Json?
  isPublished       Boolean  @default(false)
  organizationId    String
  createdById       String
  sharingScope      String   @default("PRIVATE")
  defaultPermission String   @default("VIEWER")
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  // Relations
  organization        Organization              @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  createdBy           User                      @relation(fields: [createdById], references: [id], onDelete: Cascade)
  responses           Response[]
  files               FormFile[]
  analytics           FormViewAnalytics[]
  submissionAnalytics FormSubmissionAnalytics[]
  permissions         FormPermission[]
  plugins             FormPlugin[]

  @@map("form")
}

model Response {
  id          String   @id @default(cuid())
  formId      String
  data        Json
  metadata    Json?
  submittedAt DateTime @default(now())

  form                    Form                     @relation(fields: [formId], references: [id], onDelete: Cascade)
  formSubmissionAnalytics FormSubmissionAnalytics?
  editHistory             ResponseEditHistory[]

  @@map("response")
}

model FormTemplate {
  id          String   @id @default(cuid())
  name        String
  description String?
  category    String?
  formSchema  Json
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("form_template")
}

model Verification {
  id         String    @id @default(cuid())
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime?
  updatedAt  DateTime?

  @@map("verification")
}

// ============================================================================
// REAL-TIME COLLABORATION (YJS)
// ============================================================================

model CollaborativeDocument {
  id           String   @id @default(cuid())
  documentName String   @unique
  state        Bytes
  updatedAt    DateTime @updatedAt

  @@map("collaborative_document")
}

// ============================================================================
// FORM METADATA & FILES
// ============================================================================

model FormMetadata {
  id                 String   @id @default(cuid())
  formId             String   @unique
  pageCount          Int      @default(0)
  fieldCount         Int      @default(0)
  backgroundImageKey String?
  lastUpdated        DateTime @updatedAt

  @@map("form_metadata")
}

model FormFile {
  id           String   @id @default(cuid())
  key          String   @unique
  type         String
  formId       String
  originalName String
  url          String
  size         Int
  mimeType     String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  form Form @relation(fields: [formId], references: [id], onDelete: Cascade)

  @@map("form_file")
}

// ============================================================================
// ANALYTICS
// ============================================================================

model FormViewAnalytics {
  id              String    @id @default(cuid())
  formId          String
  sessionId       String
  userAgent       String
  operatingSystem String?
  browser         String?
  browserVersion  String?
  countryCode     String?
  countryAlpha2   String?
  regionCode      String?
  region          String?
  city            String?
  longitude       Float?
  latitude        Float?
  timezone        String?
  language        String?
  viewedAt        DateTime  @default(now())
  startedAt       DateTime?

  form Form @relation(fields: [formId], references: [id], onDelete: Cascade)

  @@index([formId])
  @@index([viewedAt])
  @@index([sessionId])
  @@map("form_view_analytics")
}

model FormSubmissionAnalytics {
  id                    String   @id @default(cuid())
  formId                String
  responseId            String   @unique
  sessionId             String
  userAgent             String
  operatingSystem       String?
  browser               String?
  browserVersion        String?
  countryCode           String?
  countryAlpha2         String?
  regionCode            String?
  region                String?
  city                  String?
  longitude             Float?
  latitude              Float?
  timezone              String?
  language              String?
  submittedAt           DateTime @default(now())
  completionTimeSeconds Int?

  form     Form     @relation(fields: [formId], references: [id], onDelete: Cascade)
  response Response @relation(fields: [responseId], references: [id], onDelete: Cascade)

  @@index([formId])
  @@index([submittedAt])
  @@index([sessionId])
  @@index([completionTimeSeconds])
  @@map("form_submission_analytics")
}

// ============================================================================
// FORM SHARING & PERMISSIONS
// ============================================================================

model FormPermission {
  id          String   @id @default(cuid())
  formId      String
  userId      String
  permission  String
  grantedById String
  grantedAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  form      Form @relation(fields: [formId], references: [id], onDelete: Cascade)
  user      User @relation(fields: [userId], references: [id], onDelete: Cascade)
  grantedBy User @relation("GrantedPermissions", fields: [grantedById], references: [id])

  @@unique([formId, userId])
  @@index([formId])
  @@index([userId])
  @@map("form_permission")
}

// ============================================================================
// RESPONSE EDIT TRACKING
// ============================================================================

model ResponseEditHistory {
  id             String   @id @default(cuid())
  responseId     String
  editedById     String
  editedAt       DateTime @default(now())
  editType       String   @default("MANUAL")
  editReason     String?
  ipAddress      String?
  userAgent      String?
  totalChanges   Int      @default(0)
  changesSummary String?

  response     Response              @relation(fields: [responseId], references: [id], onDelete: Cascade)
  editedBy     User                  @relation(fields: [editedById], references: [id])
  fieldChanges ResponseFieldChange[]

  @@index([responseId])
  @@index([editedById])
  @@index([editedAt])
  @@map("response_edit_history")
}

model ResponseFieldChange {
  id              String  @id @default(cuid())
  editHistoryId   String
  fieldId         String
  fieldLabel      String
  fieldType       String
  previousValue   Json?
  newValue        Json?
  changeType      String
  valueChangeSize Int?

  editHistory ResponseEditHistory @relation(fields: [editHistoryId], references: [id], onDelete: Cascade)

  @@index([editHistoryId])
  @@index([fieldId])
  @@index([changeType])
  @@map("response_field_change")
}

// ============================================================================
// PLUGIN SYSTEM
// ============================================================================

model FormPlugin {
  id        String   @id @default(cuid())
  formId    String
  type      String
  name      String
  enabled   Boolean  @default(true)
  config    Json
  events    String[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  form       Form             @relation(fields: [formId], references: [id], onDelete: Cascade)
  deliveries PluginDelivery[]

  @@index([formId])
  @@index([type])
  @@index([enabled])
  @@map("form_plugin")
}

model PluginDelivery {
  id           String   @id @default(cuid())
  pluginId     String
  eventType    String
  status       String
  payload      Json
  response     Json?
  errorMessage String?
  deliveredAt  DateTime @default(now())

  plugin FormPlugin @relation(fields: [pluginId], references: [id], onDelete: Cascade)

  @@index([pluginId])
  @@index([eventType])
  @@index([status])
  @@index([deliveredAt])
  @@map("plugin_delivery")
}

// ============================================================================
// SUBSCRIPTION MANAGEMENT (Chargebee)
// ============================================================================

model Subscription {
  id                      String   @id @default(cuid())
  organizationId          String   @unique
  chargebeeCustomerId     String
  chargebeeSubscriptionId String?
  planId                  String
  status                  String
  viewsUsed               Int      @default(0)
  submissionsUsed         Int      @default(0)
  viewsLimit              Int?
  submissionsLimit        Int?
  currentPeriodStart      DateTime
  currentPeriodEnd        DateTime
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([status])
  @@index([planId])
  @@map("subscription")
}
```

---

## 🔧 Phase 2: Code Changes

### 2.1 Repository Layer (No Changes Needed!)

The repository layer using Prisma is **database-agnostic**. No changes required.

```typescript
// This code works for both MongoDB and PostgreSQL!
export const userRepository = {
  findUnique: (args: Prisma.UserFindUniqueArgs) => 
    prisma.user.findUnique(args),
  
  create: (args: Prisma.UserCreateArgs) => 
    prisma.user.create(args),
};
```

### 2.2 Response Query Builder Changes

**File**: `apps/backend/src/services/responseQueryBuilder.ts`

#### Remove MongoDB-Specific Code

```typescript
// DELETE: MongoDB raw query functions
export function buildMongoDBFilter() { /* ... */ }
export function canFilterAtDatabase() { /* ... */ }
```

#### Add PostgreSQL JSONB Queries

```typescript
// NEW: Use Prisma's JSONB filtering (works out of the box!)
export function buildResponseFilter(
  formId: string,
  filters?: ResponseFilter[]
): Prisma.ResponseWhereInput {
  if (!filters || filters.length === 0) {
    return { formId };
  }

  const conditions = filters.map(filter => {
    return buildFilterCondition(filter);
  });

  return {
    formId,
    AND: conditions,
  };
}

function buildFilterCondition(filter: ResponseFilter): Prisma.ResponseWhereInput {
  const fieldPath = ['data', filter.fieldId];

  switch (filter.operator) {
    case 'EQUALS':
      return {
        data: {
          path: fieldPath,
          equals: filter.value,
        },
      };

    case 'CONTAINS':
      return {
        data: {
          path: fieldPath,
          string_contains: filter.value,
        },
      };

    case 'GREATER_THAN':
      return {
        data: {
          path: fieldPath,
          gt: parseFloat(filter.value || '0'),
        },
      };

    // ... other operators
  }
}
```

### 2.3 Response Service Simplification

**File**: `apps/backend/src/services/responseService.ts`

```typescript
// BEFORE: Complex MongoDB strategy with memory fallback
export const getResponsesByFormId = async (/* ... */) => {
  if (canFilterAtDatabase(filters)) {
    // MongoDB raw queries
  } else {
    // Memory filtering fallback
  }
};

// AFTER: Simple PostgreSQL queries (all database-level!)
export const getResponsesByFormId = async (
  formId: string,
  page: number = 1,
  limit: number = 10,
  sortBy: string = 'submittedAt',
  sortOrder: string = 'desc',
  filters?: ResponseFilter[]
): Promise<PaginatedResponses> => {
  const skip = (page - 1) * limit;
  
  // Build filter conditions
  const where = buildResponseFilter(formId, filters);
  
  // Count total
  const total = await prisma.response.count({ where });
  
  // Fetch paginated results
  const responses = await prisma.response.findMany({
    where,
    orderBy: { [sortBy]: sortOrder },
    skip,
    take: limit,
  });
  
  return {
    data: responses.map(formatResponse),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};
```

### 2.4 Remove Memory Filtering Service

**File**: `apps/backend/src/services/responseFilterService.ts`

```typescript
// DELETE THIS ENTIRE FILE
// PostgreSQL handles all filtering at database level
```

---

## 🧪 Phase 3: Testing

### 3.1 Generate Prisma Client

```bash
cd apps/backend
pnpm db:generate
```

### 3.2 Create PostgreSQL Database

```bash
# Local development
createdb dculus_forms_dev

# Or use Docker
docker run --name postgres-dev \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=dculus_forms_dev \
  -p 5432:5432 \
  -d postgres:16
```

### 3.3 Update Environment Variables

```bash
# apps/backend/.env
DATABASE_URL="postgresql://username:password@localhost:5432/dculus_forms_dev?schema=public"
```

### 3.4 Push Schema to Database

```bash
pnpm db:push
```

### 3.5 Run Tests

```bash
# Unit tests
pnpm test

# Integration tests
pnpm test:integration

# E2E tests
pnpm test:e2e
```

---

## 🚀 Phase 4: Deployment

### 4.1 Cloud PostgreSQL Setup

**Recommended Providers**:
- **Neon** (Serverless PostgreSQL)
- **Supabase** (PostgreSQL + extras)
- **Railway** (Simple deployment)
- **Azure Database for PostgreSQL**
- **AWS RDS PostgreSQL**

### 4.2 Production Environment Variables

```bash
# Production .env
DATABASE_URL="postgresql://user:password@host:5432/dculus_forms_prod?schema=public&sslmode=require"
BETTER_AUTH_SECRET="your-secret"
BETTER_AUTH_BASE_URL="https://your-domain.com"
```

### 4.3 Run Migrations in Production

```bash
# From CI/CD or manually
cd apps/backend
pnpm prisma migrate deploy
```

### 4.4 Seed Initial Data (Optional)

```bash
pnpm db:seed
```

---

## ✅ Verification Checklist

### Schema Verification
- [ ] `pnpm db:generate` runs successfully
- [ ] `pnpm db:push` creates all tables
- [ ] All 20 tables created in PostgreSQL
- [ ] All indexes created correctly
- [ ] Foreign key constraints working

### Code Verification
- [ ] All TypeScript compilation passes
- [ ] No MongoDB-specific code remains
- [ ] Prisma client imports work
- [ ] GraphQL resolvers compile

### Functionality Verification
- [ ] User authentication works
- [ ] Organization creation works
- [ ] Form creation works
- [ ] Response submission works
- [ ] Response filtering works
- [ ] Analytics queries work
- [ ] Real-time collaboration works
- [ ] Plugin system works
- [ ] File uploads work

### Performance Verification
- [ ] Response queries < 500ms
- [ ] Analytics queries < 2s
- [ ] Collaboration sync < 100ms
- [ ] Form listing < 300ms

---

## 🔄 Rollback Plan

Since this is a fresh deployment with no data, rollback is simple:

1. **Change datasource** back to MongoDB in `schema.prisma`
2. **Revert code changes** (use git)
3. **Regenerate Prisma client**: `pnpm db:generate`
4. **Redeploy** application

**No data loss risk** - this is a fresh start!

---

## 📊 Estimated Timeline

| Phase | Duration | Tasks |
|-------|----------|-------|
| **Phase 1**: Schema Conversion | 1-2 days | Update Prisma schema, add defaults |
| **Phase 2**: Code Changes | 2-3 days | Update query builders, simplify services |
| **Phase 3**: Testing | 2-3 days | Unit, integration, E2E tests |
| **Phase 4**: Deployment | 1 day | Cloud setup, deployment, verification |

**Total**: 6-9 days (1-2 weeks)

---

## 🎯 Success Criteria

- ✅ All tests passing
- ✅ PostgreSQL schema deployed
- ✅ Application running on PostgreSQL
- ✅ No regressions in functionality
- ✅ Performance meets or exceeds expectations
- ✅ Team confident with new database

---

**Next Document**: [MIGRATION_PART_6_CODE_CHANGES.md](./MIGRATION_PART_6_CODE_CHANGES.md)

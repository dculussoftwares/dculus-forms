# Part 2: Database Schema Deep Dive

**Document**: MongoDB to PostgreSQL Migration - Schema Analysis  
**Last Updated**: November 17, 2025

---

## 📋 Table of Contents

1. [Schema Overview](#schema-overview)
2. [Data Type Mappings](#data-type-mappings)
3. [Table-by-Table Analysis](#table-by-table-analysis)
4. [Index Strategy](#index-strategy)
5. [Constraint Definitions](#constraint-definitions)

---

## 🗄️ Schema Overview

### Current MongoDB Collections (20 total)

| Collection | Purpose | Relationships | Complexity |
|-----------|---------|---------------|------------|
| `user` | Authentication & user profiles | → accounts, sessions, members | Medium |
| `account` | OAuth & credential storage | ← user | Low |
| `session` | Active user sessions | ← user | Low |
| `organization` | Multi-tenant organizations | → members, forms, subscription | Medium |
| `member` | Organization membership | ← organization, user | Low |
| `invitation` | Pending org invitations | ← organization, user | Low |
| `form` | Form definitions & schema | ← organization, user → responses, permissions | High |
| `response` | Form submissions | ← form → editHistory, analytics | Very High |
| `form_template` | Pre-built form templates | None | Low |
| `verification` | Email/phone verification | None | Low |
| `collaborative_document` | YJS real-time sync state | None (linked by formId) | High |
| `form_metadata` | Cached form statistics | Related to form | Low |
| `form_file` | Uploaded files & images | ← form | Low |
| `form_view_analytics` | Form view tracking | ← form | High |
| `form_submission_analytics` | Submission tracking | ← form, response | High |
| `form_permission` | Sharing & access control | ← form, user | Medium |
| `response_edit_history` | Response edit tracking | ← response, user → fieldChanges | Medium |
| `response_field_change` | Field-level edit details | ← editHistory | Low |
| `form_plugin` | Automation plugins | ← form → deliveries | Medium |
| `plugin_delivery` | Plugin execution logs | ← plugin | Low |
| `subscription` | Billing & usage tracking | ← organization | Medium |

---

## 🔄 Data Type Mappings

### MongoDB → PostgreSQL Type Conversion

| MongoDB Type | PostgreSQL Type | Notes |
|-------------|----------------|-------|
| `ObjectId` | `TEXT` / `UUID` | Using TEXT (Prisma default for MongoDB) |
| `String` | `TEXT` / `VARCHAR` | TEXT for flexibility |
| `Int` / `Number` | `INTEGER` | 32-bit integers |
| `Float` / `Double` | `DOUBLE PRECISION` | Geographic coordinates |
| `Boolean` | `BOOLEAN` | Native support |
| `Date` | `TIMESTAMP(3)` | Millisecond precision |
| `Object` / `Document` | `JSONB` | Indexed JSON with operators |
| `Array` | `TEXT[]` | For simple arrays |
| `Binary` / `Buffer` | `BYTEA` | For YJS documents |

### JSON/JSONB Strategy

**MongoDB Flexible Schema → PostgreSQL JSONB**

```prisma
// MongoDB (current)
model Response {
  data Json  // Any structure allowed
}

// PostgreSQL (target)
model Response {
  data JSONB  // Queryable with operators
}
```

**Key Advantages:**
- GIN indexes on JSONB columns
- Operators: `@>`, `?`, `?&`, `?|`, `#>`, `#>>`
- Better query performance than MongoDB's nested field access

---

## 📊 Table-by-Table Analysis

### 1. User Table

**Purpose**: Core authentication and user profiles (better-auth)

**Current MongoDB Schema:**
```prisma
model User {
  id            String   @id @map("_id")
  name          String
  email         String   @unique
  emailVerified Boolean?
  image         String?
  role          String?  @default("user")
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

**PostgreSQL Schema:**
```sql
CREATE TABLE "user" (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  email_verified BOOLEAN DEFAULT NULL,
  image         TEXT,
  role          TEXT DEFAULT 'user',
  created_at    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP(3) NOT NULL
);

CREATE INDEX idx_user_email ON "user"(email);
CREATE INDEX idx_user_role ON "user"(role);
```

**Migration Considerations:**
- ✅ Straightforward 1:1 mapping
- ✅ No complex data transformations
- ⚠️ Validate email uniqueness during migration
- ⚠️ Check for null/empty string inconsistencies

**Estimated Records**: 1,000 - 10,000 users  
**Migration Complexity**: LOW  
**Downtime Risk**: LOW

---

### 2. Organization Table

**Purpose**: Multi-tenant organization management

**Current MongoDB Schema:**
```prisma
model Organization {
  id        String   @id @map("_id")
  name      String
  slug      String   @unique
  logo      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  metadata  String?
}
```

**PostgreSQL Schema:**
```sql
CREATE TABLE organization (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  slug       TEXT UNIQUE NOT NULL,
  logo       TEXT,
  metadata   TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX idx_org_slug ON organization(slug);
CREATE INDEX idx_org_created ON organization(created_at DESC);
```

**Migration Considerations:**
- ✅ Simple structure
- ⚠️ Validate slug uniqueness
- ⚠️ Check for special characters in slugs
- ✅ Metadata field rarely used

**Estimated Records**: 500 - 5,000 organizations  
**Migration Complexity**: LOW  
**Downtime Risk**: LOW

---

### 3. Form Table

**Purpose**: Form definitions with real-time collaborative schema

**Current MongoDB Schema:**
```prisma
model Form {
  id               String   @id @map("_id")
  title            String
  description      String?
  shortUrl         String   @unique
  formSchema       Json     // Complex nested structure
  settings         Json?
  isPublished      Boolean  @default(false)
  organizationId   String
  createdById      String
  sharingScope     String   @default("PRIVATE")
  defaultPermission String  @default("VIEWER")
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}
```

**PostgreSQL Schema:**
```sql
CREATE TABLE form (
  id                 TEXT PRIMARY KEY,
  title              TEXT NOT NULL,
  description        TEXT,
  short_url          TEXT UNIQUE NOT NULL,
  form_schema        JSONB NOT NULL,  -- GIN indexed
  settings           JSONB,
  is_published       BOOLEAN NOT NULL DEFAULT FALSE,
  organization_id    TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  created_by_id      TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  sharing_scope      TEXT NOT NULL DEFAULT 'PRIVATE',
  default_permission TEXT NOT NULL DEFAULT 'VIEWER',
  created_at         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP(3) NOT NULL
);

-- Indexes
CREATE UNIQUE INDEX idx_form_short_url ON form(short_url);
CREATE INDEX idx_form_org ON form(organization_id);
CREATE INDEX idx_form_creator ON form(created_by_id);
CREATE INDEX idx_form_published ON form(is_published) WHERE is_published = TRUE;
CREATE INDEX idx_form_created ON form(created_at DESC);

-- GIN index for JSONB queries
CREATE INDEX idx_form_schema_gin ON form USING GIN (form_schema jsonb_path_ops);
```

**formSchema Structure** (stored as JSONB):
```json
{
  "pages": [
    {
      "id": "page-1",
      "title": "Page 1",
      "order": 0,
      "fields": [
        {
          "id": "field-1",
          "type": "text_input_field",
          "label": "Name",
          "defaultValue": "",
          "validation": {...}
        }
      ]
    }
  ],
  "layout": {
    "theme": "light",
    "code": "L1",
    "spacing": "normal"
  },
  "isShuffleEnabled": false
}
```

**Migration Considerations:**
- ⚠️ **HIGH COMPLEXITY** - formSchema is deeply nested
- ✅ JSONB handles nested structure well
- ⚠️ Validate JSON structure during migration
- ⚠️ Check for serialization issues
- ⚠️ Linked to YJS collaborative documents
- ✅ Foreign keys enforce referential integrity

**Estimated Records**: 5,000 - 50,000 forms  
**Migration Complexity**: HIGH  
**Downtime Risk**: MEDIUM

---

### 4. Response Table ⚡ CRITICAL

**Purpose**: Form submission data with dynamic field values

**Current MongoDB Schema:**
```prisma
model Response {
  id          String   @id @map("_id")
  formId      String
  data        Json     // Dynamic form field data
  metadata    Json?    // Plugin metadata
  submittedAt DateTime @default(now())
}
```

**PostgreSQL Schema:**
```sql
CREATE TABLE response (
  id           TEXT PRIMARY KEY,
  form_id      TEXT NOT NULL REFERENCES form(id) ON DELETE CASCADE,
  data         JSONB NOT NULL,  -- Form field responses
  metadata     JSONB,           -- Plugin execution results
  submitted_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Performance-critical indexes
CREATE INDEX idx_response_form ON response(form_id);
CREATE INDEX idx_response_submitted ON response(submitted_at DESC);
CREATE INDEX idx_response_form_submitted ON response(form_id, submitted_at DESC);

-- GIN indexes for JSONB filtering (CRITICAL for performance)
CREATE INDEX idx_response_data_gin ON response USING GIN (data jsonb_path_ops);
CREATE INDEX idx_response_metadata_gin ON response USING GIN (metadata jsonb_path_ops);
```

**Response Data Structure** (JSONB):
```json
{
  "field-1": "John Doe",
  "field-2": "john@example.com",
  "field-3": "2024-01-15T10:30:00Z",
  "field-4": ["option1", "option2"],
  "field-5": 42
}
```

**Response Metadata Structure** (JSONB):
```json
{
  "quiz-grading": {
    "quizScore": 8,
    "totalMarks": 10,
    "percentage": 80,
    "answers": [...]
  },
  "email": {
    "deliveryStatus": "sent",
    "sentAt": "2024-01-15T10:31:00Z"
  }
}
```

**Migration Considerations:**
- 🔥 **CRITICAL** - Core business feature
- ⚠️ **VERY HIGH COMPLEXITY** - Dynamic JSONB queries
- ⚠️ Current MongoDB uses mixed database/memory filtering
- ✅ PostgreSQL JSONB operators enable pure database filtering
- ⚠️ Date fields must be stored correctly for filtering
- ⚠️ Array fields need special handling
- ⚠️ Performance testing essential
- ⚠️ Data volume can be very large (millions of records)

**Current Query Patterns:**
```typescript
// MongoDB (current) - using raw queries
prisma.response.findRaw({
  filter: {
    formId: "form-123",
    "data.email": { $regex: "@gmail.com", $options: "i" },
    "data.age": { $gt: 18, $lt: 65 },
    "data.date": { $gte: ISODate("2024-01-01") }
  }
})
```

**PostgreSQL Query Patterns:**
```sql
-- PostgreSQL (target) - using JSONB operators
SELECT * FROM response
WHERE form_id = 'form-123'
  AND data->>'email' ILIKE '%@gmail.com%'
  AND (data->>'age')::INTEGER > 18
  AND (data->>'age')::INTEGER < 65
  AND (data->>'date')::TIMESTAMP >= '2024-01-01'::TIMESTAMP;
```

**Estimated Records**: 100,000 - 10,000,000 responses  
**Migration Complexity**: VERY HIGH  
**Downtime Risk**: HIGH

---

### 5. CollaborativeDocument Table (YJS Binary Storage)

**Purpose**: Store YJS CRDT documents for real-time collaboration

**Current MongoDB Schema:**
```prisma
model CollaborativeDocument {
  id           String   @id @map("_id")
  documentName String   @unique
  state        Bytes    // Binary YJS state
  updatedAt    DateTime @updatedAt
}
```

**PostgreSQL Schema:**
```sql
CREATE TABLE collaborative_document (
  id            TEXT PRIMARY KEY,
  document_name TEXT UNIQUE NOT NULL,
  state         BYTEA NOT NULL,  -- Binary data
  updated_at    TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX idx_collab_doc_name ON collaborative_document(document_name);
CREATE INDEX idx_collab_doc_updated ON collaborative_document(updated_at DESC);
```

**Migration Considerations:**
- 🔥 **CRITICAL** - Data corruption would break collaboration
- ⚠️ **HIGH COMPLEXITY** - Binary data must be exact
- ⚠️ Byte-level validation required
- ⚠️ Document name is formId (must match)
- ✅ PostgreSQL BYTEA handles binary data well
- ⚠️ Size can be large (100KB - 10MB per document)
- ⚠️ Must test YJS document reconstruction

**Validation Strategy:**
```typescript
// Compare byte-by-byte
const mongoBuffer = await getMongoDocument(formId);
const pgBuffer = await getPostgreSQLDocument(formId);

if (!Buffer.compare(mongoBuffer, pgBuffer) === 0) {
  throw new Error('YJS document corruption detected!');
}
```

**Estimated Records**: Equal to number of forms (5,000 - 50,000)  
**Migration Complexity**: HIGH  
**Downtime Risk**: HIGH

---

### 6. FormViewAnalytics Table

**Purpose**: Track form views with geographic and device information

**Current MongoDB Schema:**
```prisma
model FormViewAnalytics {
  id              String   @id @map("_id")
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
  viewedAt        DateTime @default(now())
  startedAt       DateTime?

  @@index([formId])
  @@index([viewedAt])
  @@index([sessionId])
}
```

**PostgreSQL Schema:**
```sql
CREATE TABLE form_view_analytics (
  id               TEXT PRIMARY KEY,
  form_id          TEXT NOT NULL REFERENCES form(id) ON DELETE CASCADE,
  session_id       TEXT NOT NULL,
  user_agent       TEXT NOT NULL,
  operating_system TEXT,
  browser          TEXT,
  browser_version  TEXT,
  country_code     TEXT,       -- ISO 3166-1 alpha-3
  country_alpha2   TEXT,       -- ISO 3166-1 alpha-2
  region_code      TEXT,
  region           TEXT,
  city             TEXT,
  longitude        DOUBLE PRECISION,
  latitude         DOUBLE PRECISION,
  timezone         TEXT,
  language         TEXT,
  viewed_at        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at       TIMESTAMP(3)
);

-- Performance indexes for analytics queries
CREATE INDEX idx_view_form ON form_view_analytics(form_id);
CREATE INDEX idx_view_viewed ON form_view_analytics(viewed_at DESC);
CREATE INDEX idx_view_session ON form_view_analytics(session_id);
CREATE INDEX idx_view_country ON form_view_analytics(country_code) WHERE country_code IS NOT NULL;
CREATE INDEX idx_view_form_time ON form_view_analytics(form_id, viewed_at DESC);

-- Composite index for time-range queries
CREATE INDEX idx_view_form_time_range ON form_view_analytics(form_id, viewed_at) WHERE viewed_at IS NOT NULL;
```

**Migration Considerations:**
- ⚠️ Large data volume (millions of records)
- ✅ Straightforward structure
- ⚠️ Geographic data validation
- ⚠️ Time-series data (date range queries common)
- ✅ No complex relationships
- ⚠️ Performance testing for aggregations

**Common Query Patterns:**
```sql
-- Top countries by views
SELECT country_code, COUNT(*) as views
FROM form_view_analytics
WHERE form_id = 'form-123'
  AND viewed_at >= NOW() - INTERVAL '30 days'
GROUP BY country_code
ORDER BY views DESC
LIMIT 10;

-- Daily view trends
SELECT DATE(viewed_at) as date, COUNT(*) as views
FROM form_view_analytics
WHERE form_id = 'form-123'
GROUP BY DATE(viewed_at)
ORDER BY date DESC;
```

**Estimated Records**: 500,000 - 50,000,000 views  
**Migration Complexity**: MEDIUM  
**Downtime Risk**: LOW

---

### 7. FormSubmissionAnalytics Table

**Purpose**: Track submission-specific analytics with completion time

**Current MongoDB Schema:**
```prisma
model FormSubmissionAnalytics {
  id                    String   @id @map("_id")
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

  @@index([formId])
  @@index([submittedAt])
  @@index([sessionId])
  @@index([completionTimeSeconds])
}
```

**PostgreSQL Schema:**
```sql
CREATE TABLE form_submission_analytics (
  id                      TEXT PRIMARY KEY,
  form_id                 TEXT NOT NULL REFERENCES form(id) ON DELETE CASCADE,
  response_id             TEXT UNIQUE NOT NULL REFERENCES response(id) ON DELETE CASCADE,
  session_id              TEXT NOT NULL,
  user_agent              TEXT NOT NULL,
  operating_system        TEXT,
  browser                 TEXT,
  browser_version         TEXT,
  country_code            TEXT,
  country_alpha2          TEXT,
  region_code             TEXT,
  region                  TEXT,
  city                    TEXT,
  longitude               DOUBLE PRECISION,
  latitude                DOUBLE PRECISION,
  timezone                TEXT,
  language                TEXT,
  submitted_at            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completion_time_seconds INTEGER
);

-- Indexes for analytics queries
CREATE INDEX idx_submission_form ON form_submission_analytics(form_id);
CREATE INDEX idx_submission_time ON form_submission_analytics(submitted_at DESC);
CREATE INDEX idx_submission_session ON form_submission_analytics(session_id);
CREATE INDEX idx_submission_completion ON form_submission_analytics(completion_time_seconds) WHERE completion_time_seconds IS NOT NULL;
CREATE UNIQUE INDEX idx_submission_response ON form_submission_analytics(response_id);

-- Composite for time-range queries
CREATE INDEX idx_submission_form_time ON form_submission_analytics(form_id, submitted_at DESC);
```

**Migration Considerations:**
- ⚠️ One-to-one relationship with Response
- ✅ Straightforward structure
- ⚠️ Response_id foreign key must be valid
- ⚠️ Completion time statistics important
- ⚠️ Geographic data similar to view analytics

**Estimated Records**: Equal to responses (100,000 - 10,000,000)  
**Migration Complexity**: MEDIUM  
**Downtime Risk**: LOW

---

### 8. FormPermission Table

**Purpose**: Fine-grained sharing and access control

**Current MongoDB Schema:**
```prisma
model FormPermission {
  id          String   @id @map("_id")
  formId      String
  userId      String
  permission  String   // OWNER, EDITOR, VIEWER, NO_ACCESS
  grantedById String
  grantedAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([formId, userId])
  @@index([formId])
  @@index([userId])
}
```

**PostgreSQL Schema:**
```sql
CREATE TABLE form_permission (
  id           TEXT PRIMARY KEY,
  form_id      TEXT NOT NULL REFERENCES form(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  permission   TEXT NOT NULL,  -- OWNER, EDITOR, VIEWER, NO_ACCESS
  granted_by_id TEXT NOT NULL REFERENCES "user"(id),
  granted_at   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX idx_permission_form_user ON form_permission(form_id, user_id);
CREATE INDEX idx_permission_form ON form_permission(form_id);
CREATE INDEX idx_permission_user ON form_permission(user_id);
CREATE INDEX idx_permission_level ON form_permission(permission);

-- Check constraint for permission values
ALTER TABLE form_permission ADD CONSTRAINT check_permission_value 
  CHECK (permission IN ('OWNER', 'EDITOR', 'VIEWER', 'NO_ACCESS'));
```

**Migration Considerations:**
- ✅ Simple structure
- ⚠️ Unique constraint on (formId, userId)
- ⚠️ Foreign key validation required
- ⚠️ Permission enum validation
- ✅ No complex data

**Estimated Records**: 10,000 - 100,000 permissions  
**Migration Complexity**: LOW  
**Downtime Risk**: LOW

---

## 📑 Remaining Tables Summary

### 9-21. Other Tables (Lower Complexity)

For brevity, here's a summary of remaining tables:

| Table | Complexity | Key Changes | Risk |
|-------|-----------|-------------|------|
| Account | LOW | Standard fields | LOW |
| Session | LOW | Token unique index | LOW |
| Member | LOW | Unique (orgId, userId) | LOW |
| Invitation | LOW | Email + org validation | LOW |
| FormTemplate | LOW | Static data | LOW |
| Verification | LOW | Temp data | LOW |
| FormMetadata | LOW | Cache (can rebuild) | LOW |
| FormFile | LOW | File references | LOW |
| ResponseEditHistory | MEDIUM | Relations to response | MEDIUM |
| ResponseFieldChange | LOW | Simple structure | LOW |
| FormPlugin | MEDIUM | JSONB config | MEDIUM |
| PluginDelivery | LOW | Logs only | LOW |
| Subscription | MEDIUM | Usage counters (atomic) | MEDIUM |

---

## 🔍 Index Strategy

### MongoDB vs PostgreSQL Indexing

**MongoDB Approach:**
- Indexes defined via `@@index` in Prisma
- Limited to basic field indexes
- No advanced index types

**PostgreSQL Approach:**
- Rich index type support (B-tree, GIN, GiST, BRIN)
- Partial indexes
- Expression indexes
- Covering indexes

### Critical Indexes for Performance

#### 1. JSONB GIN Indexes (Response Filtering)
```sql
-- Essential for response filtering performance
CREATE INDEX idx_response_data_gin ON response USING GIN (data jsonb_path_ops);

-- Allows fast queries like:
-- WHERE data->>'email' = 'john@example.com'
-- WHERE data @> '{"status": "completed"}'
```

#### 2. Composite Indexes (Analytics Time Ranges)
```sql
-- Optimize time-range queries
CREATE INDEX idx_view_form_time ON form_view_analytics(form_id, viewed_at DESC);
CREATE INDEX idx_submission_form_time ON form_submission_analytics(form_id, submitted_at DESC);
```

#### 3. Partial Indexes (Published Forms)
```sql
-- Index only published forms for public queries
CREATE INDEX idx_form_published ON form(is_published) WHERE is_published = TRUE;
```

#### 4. Covering Indexes (List Queries)
```sql
-- Include commonly selected fields in index
CREATE INDEX idx_form_list_covering ON form(organization_id, created_at DESC) 
  INCLUDE (id, title, is_published);
```

---

## 🔗 Constraint Definitions

### Foreign Key Constraints

```sql
-- Form relationships
ALTER TABLE form
  ADD CONSTRAINT fk_form_organization FOREIGN KEY (organization_id) 
    REFERENCES organization(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_form_creator FOREIGN KEY (created_by_id) 
    REFERENCES "user"(id) ON DELETE CASCADE;

-- Response relationships
ALTER TABLE response
  ADD CONSTRAINT fk_response_form FOREIGN KEY (form_id) 
    REFERENCES form(id) ON DELETE CASCADE;

-- Analytics relationships
ALTER TABLE form_view_analytics
  ADD CONSTRAINT fk_view_form FOREIGN KEY (form_id) 
    REFERENCES form(id) ON DELETE CASCADE;

ALTER TABLE form_submission_analytics
  ADD CONSTRAINT fk_submission_form FOREIGN KEY (form_id) 
    REFERENCES form(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_submission_response FOREIGN KEY (response_id) 
    REFERENCES response(id) ON DELETE CASCADE;
```

### Unique Constraints

```sql
-- Ensure data integrity
ALTER TABLE "user" ADD CONSTRAINT uk_user_email UNIQUE (email);
ALTER TABLE organization ADD CONSTRAINT uk_org_slug UNIQUE (slug);
ALTER TABLE form ADD CONSTRAINT uk_form_short_url UNIQUE (short_url);
ALTER TABLE collaborative_document ADD CONSTRAINT uk_collab_doc_name UNIQUE (document_name);
ALTER TABLE form_permission ADD CONSTRAINT uk_permission_form_user UNIQUE (form_id, user_id);
```

### Check Constraints

```sql
-- Validate enum values
ALTER TABLE form_permission ADD CONSTRAINT check_permission_value 
  CHECK (permission IN ('OWNER', 'EDITOR', 'VIEWER', 'NO_ACCESS'));

ALTER TABLE form ADD CONSTRAINT check_sharing_scope 
  CHECK (sharing_scope IN ('PRIVATE', 'SPECIFIC_MEMBERS', 'ALL_ORG_MEMBERS'));

-- Validate numeric ranges
ALTER TABLE form_submission_analytics ADD CONSTRAINT check_completion_time 
  CHECK (completion_time_seconds IS NULL OR completion_time_seconds >= 0);
```

---

## 📊 Data Volume Estimates

| Table | Estimated Rows | Growth Rate | Storage Estimate |
|-------|---------------|-------------|------------------|
| User | 1K - 10K | Slow | 1-10 MB |
| Organization | 500 - 5K | Slow | 0.5-5 MB |
| Form | 5K - 50K | Medium | 50-500 MB |
| Response | 100K - 10M | Fast | 1-100 GB |
| FormViewAnalytics | 500K - 50M | Fast | 500 MB - 50 GB |
| FormSubmissionAnalytics | 100K - 10M | Fast | 100 MB - 10 GB |
| CollaborativeDocument | 5K - 50K | Medium | 500 MB - 5 GB |
| Other tables | < 100K each | Varies | < 1 GB combined |

**Total Estimated Database Size**: 2 GB - 200 GB (depending on usage)

---

**Next Document**: [MIGRATION_PART_3_RESPONSES_ANALYTICS.md](./MIGRATION_PART_3_RESPONSES_ANALYTICS.md)

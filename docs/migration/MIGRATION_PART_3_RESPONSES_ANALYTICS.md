# Part 3: Form Responses & Analytics Systems

**Document**: MongoDB to PostgreSQL Migration - Responses & Analytics  
**Last Updated**: November 17, 2025

---

## 🎯 Critical Business Feature: Response Collection & Filtering

This document provides a **deep dive** into the most complex and business-critical part of the migration: **Form Response storage, querying, and filtering**.

---

## 📋 Table of Contents

1. [Response System Architecture](#response-system-architecture)
2. [Current MongoDB Implementation](#current-mongodb-implementation)
3. [PostgreSQL Target Implementation](#postgresql-target-implementation)
4. [Filtering System Deep Dive](#filtering-system-deep-dive)
5. [Analytics System](#analytics-system)
6. [Performance Optimization](#performance-optimization)

---

## 🏗️ Response System Architecture

### Business Context

**Form responses** are the core data collected from users who fill out forms. The system must:

1. **Store dynamic data** - Each form has different fields
2. **Support complex filtering** - Filter by any field value
3. **Enable sorting** - Sort by submission date or field values
4. **Provide pagination** - Handle millions of responses
5. **Track metadata** - Plugin execution results (quiz scores, email status)
6. **Support editing** - Track response edits with full history

### Data Flow

```
User Submission (form-viewer)
    ↓
GraphQL Mutation: submitResponse
    ↓
Response Service: createResponse
    ↓
MongoDB/PostgreSQL: Store response.data (JSONB)
    ↓
Trigger Plugins (webhooks, email, quiz-grading)
    ↓
Store Plugin Metadata in response.metadata (JSONB)
    ↓
Analytics Service: Track submission analytics
    ↓
Usage Service: Increment subscription counters
```

### Current Pain Points (MongoDB)

1. **Mixed Filtering Strategy**
   - Simple operators (`EQUALS`, `CONTAINS`) → Database filtering
   - Complex operators (`DATE_RANGE`, `BETWEEN`) → Memory filtering
   - Fetches ALL responses, then filters in Node.js memory
   - Performance degrades with large datasets

2. **Query Complexity**
   - MongoDB's `$regex`, `$gt`, `$lt` operators
   - Raw MongoDB queries via `findRaw()` and `aggregateRaw()`
   - Limited TypeScript type safety
   - Difficult to optimize

3. **Date Field Handling**
   - Dates sometimes stored as strings, sometimes as Date objects
   - Inconsistent filtering behavior
   - Database-level date filtering not reliable

---

## 🔄 Current MongoDB Implementation

### Response Data Structure

```typescript
interface Response {
  id: string;
  formId: string;
  data: {
    // Dynamic fields based on form schema
    "field-name-1": "John Doe",
    "field-email-2": "john@example.com",
    "field-date-3": "2024-01-15T10:30:00Z",  // or Date object
    "field-number-4": 42,
    "field-select-5": ["option1", "option2"],  // Arrays for multi-select
  };
  metadata?: {
    // Plugin-generated metadata
    "quiz-grading": {
      quizScore: 8,
      totalMarks: 10,
      percentage: 80,
      answers: [...]
    },
    "email": {
      deliveryStatus: "sent",
      sentAt: "2024-01-15T10:31:00Z"
    }
  };
  submittedAt: Date;
}
```

### Current Filtering Implementation

**File**: `apps/backend/src/services/responseService.ts`

```typescript
export const getResponsesByFormId = async (
  formId: string,
  page: number = 1,
  limit: number = 10,
  sortBy: string = 'submittedAt',
  sortOrder: string = 'desc',
  filters?: ResponseFilter[]
): Promise<PaginatedResponses> => {
  
  // STRATEGY 1: Database-level filtering (optimized path)
  if (hasFilters && canFilterAtDatabase(filters)) {
    const mongoFilter = buildMongoDBFilter(formId, filters);
    
    const countResults = await prisma.response.aggregateRaw({
      pipeline: [
        { $match: mongoFilter },
        { $count: 'total' }
      ]
    });
    
    const sortedResults = await prisma.response.findRaw({
      filter: mongoFilter,
      options: {
        sort: { [sortBy]: sortOrder === 'asc' ? 1 : -1 },
        skip: (page - 1) * limit,
        limit: limit
      }
    });
  }
  
  // STRATEGY 2: Memory filtering (fallback)
  else if (hasFilters) {
    const allResponses = await responseRepository.listByForm(formId);
    const filteredResponses = applyResponseFilters(allResponses, filters);
    total = filteredResponses.length;
    responses = filteredResponses.slice(skip, skip + limit);
  }
  
  // STRATEGY 3: No filters (simple database query)
  else {
    responses = await responseRepository.findMany({
      where: { formId },
      orderBy: { [sortBy]: sortOrder },
      skip,
      limit
    });
  }
};
```

### MongoDB Filter Builder

**File**: `apps/backend/src/services/responseQueryBuilder.ts`

```typescript
export function buildMongoDBFilter(
  formId: string,
  filters?: ResponseFilter[]
): MongoFilter {
  const baseFilter: MongoFilter = { formId };
  
  if (!filters || filters.length === 0) {
    return baseFilter;
  }
  
  const filterConditions: MongoFilter[] = [];
  
  for (const filter of filters) {
    const condition = buildFilterCondition(filter);
    if (condition) {
      filterConditions.push(condition);
    }
  }
  
  return {
    ...baseFilter,
    $and: filterConditions
  };
}

function buildFilterCondition(filter: ResponseFilter): MongoFilter | null {
  const fieldPath = `data.${filter.fieldId}`;
  
  switch (filter.operator) {
    case 'EQUALS':
      return { [fieldPath]: filter.value };
    
    case 'CONTAINS':
      return { 
        [fieldPath]: { 
          $regex: escapeRegex(filter.value || ''), 
          $options: 'i' 
        } 
      };
    
    case 'GREATER_THAN':
      return { [fieldPath]: { $gt: parseFloat(filter.value || '0') } };
    
    case 'DATE_EQUALS':
      return { [fieldPath]: new Date(filter.value!) };
    
    case 'DATE_BETWEEN':
      return {
        [fieldPath]: {
          $gte: new Date(filter.dateRange!.from!),
          $lte: new Date(filter.dateRange!.to!)
        }
      };
    
    // ... more operators
  }
}
```

### Memory Filter Service

**File**: `apps/backend/src/services/responseFilterService.ts`

```typescript
export function applyResponseFilters(
  responses: any[],
  filters?: ResponseFilter[]
): any[] {
  if (!filters || filters.length === 0) {
    return responses;
  }
  
  return responses.filter(response => {
    // All filters must pass (AND logic)
    return filters.every(filter => {
      const fieldValue = response.data?.[filter.fieldId];
      
      switch (filter.operator) {
        case 'EQUALS':
          return String(fieldValue).toLowerCase() === 
                 String(filter.value || '').toLowerCase();
        
        case 'CONTAINS':
          return fieldValue && 
                 String(fieldValue).toLowerCase()
                   .includes(String(filter.value || '').toLowerCase());
        
        case 'GREATER_THAN': {
          const numValue = parseFloat(fieldValue);
          const filterNum = parseFloat(filter.value || '0');
          return !isNaN(numValue) && !isNaN(filterNum) && 
                 numValue > filterNum;
        }
        
        case 'DATE_EQUALS': {
          const fieldDate = new Date(fieldValue);
          const compareDate = new Date(filter.value || '');
          return fieldDate.toDateString() === compareDate.toDateString();
        }
        
        // ... more operators
      }
    });
  });
}
```

---

## 🎯 PostgreSQL Target Implementation

### Target Response Schema

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

-- GIN indexes for JSONB filtering (CRITICAL)
CREATE INDEX idx_response_data_gin ON response USING GIN (data jsonb_path_ops);
CREATE INDEX idx_response_metadata_gin ON response USING GIN (metadata jsonb_path_ops);
```

### PostgreSQL JSONB Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `->` | Get JSON object field | `data->'email'` |
| `->>` | Get JSON object field as text | `data->>'email'` |
| `@>` | Contains JSON | `data @> '{"status": "completed"}'` |
| `<@` | Is contained by JSON | `'{"a":1}' <@ data` |
| `?` | Has key | `data ? 'email'` |
| `?\|` | Has any key | `data ?\| array['email', 'phone']` |
| `?&` | Has all keys | `data ?& array['email', 'name']` |
| `#>` | Get JSON at path | `data #> '{address,city}'` |
| `#>>` | Get JSON at path as text | `data #>> '{address,city}'` |
| `@?` | JSON path predicate | `data @? '$.email'` |
| `@@` | JSON path match | `data @@ '$.price > 100'` |

### PostgreSQL Query Builder

**New Implementation**:

```typescript
export function buildPostgreSQLFilter(
  formId: string,
  filters?: ResponseFilter[]
): { where: Prisma.ResponseWhereInput } {
  
  if (!filters || filters.length === 0) {
    return { where: { formId } };
  }
  
  const conditions = filters.map(filter => {
    return buildJSONBCondition(filter);
  });
  
  return {
    where: {
      formId,
      AND: conditions
    }
  };
}

function buildJSONBCondition(filter: ResponseFilter): Prisma.ResponseWhereInput {
  const fieldPath = ['data', filter.fieldId];
  
  switch (filter.operator) {
    case 'EQUALS':
      return {
        data: {
          path: fieldPath,
          equals: filter.value
        }
      };
    
    case 'CONTAINS':
      // Case-insensitive text search
      return {
        data: {
          path: fieldPath,
          string_contains: filter.value,
        }
      };
    
    case 'GREATER_THAN':
      return {
        data: {
          path: fieldPath,
          gt: parseFloat(filter.value || '0')
        }
      };
    
    case 'DATE_EQUALS':
      return {
        data: {
          path: fieldPath,
          equals: new Date(filter.value!)
        }
      };
    
    case 'DATE_BETWEEN':
      return {
        AND: [
          {
            data: {
              path: fieldPath,
              gte: new Date(filter.dateRange!.from!)
            }
          },
          {
            data: {
              path: fieldPath,
              lte: new Date(filter.dateRange!.to!)
            }
          }
        ]
      };
    
    case 'IS_EMPTY':
      return {
        OR: [
          { data: { path: fieldPath, equals: null } },
          { data: { path: fieldPath, equals: '' } }
        ]
      };
    
    // ... more operators
  }
}
```

### Raw SQL Approach (Alternative)

For maximum performance, use raw SQL with parameterized queries:

```typescript
async function getFilteredResponses(
  formId: string,
  filters: ResponseFilter[],
  page: number,
  limit: number
): Promise<Response[]> {
  
  const whereClauses: string[] = ['form_id = $1'];
  const params: any[] = [formId];
  let paramIndex = 2;
  
  for (const filter of filters) {
    const { clause, values } = buildSQLClause(filter, paramIndex);
    whereClauses.push(clause);
    params.push(...values);
    paramIndex += values.length;
  }
  
  const sql = `
    SELECT id, form_id, data, metadata, submitted_at
    FROM response
    WHERE ${whereClauses.join(' AND ')}
    ORDER BY submitted_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  
  params.push(limit, (page - 1) * limit);
  
  return await prisma.$queryRaw<Response[]>(sql, ...params);
}

function buildSQLClause(
  filter: ResponseFilter,
  startIndex: number
): { clause: string; values: any[] } {
  
  const field = `data->>'${filter.fieldId}'`;
  
  switch (filter.operator) {
    case 'EQUALS':
      return {
        clause: `${field} = $${startIndex}`,
        values: [filter.value]
      };
    
    case 'CONTAINS':
      return {
        clause: `${field} ILIKE $${startIndex}`,
        values: [`%${filter.value}%`]
      };
    
    case 'GREATER_THAN':
      return {
        clause: `(${field})::NUMERIC > $${startIndex}`,
        values: [parseFloat(filter.value || '0')]
      };
    
    case 'DATE_BETWEEN':
      return {
        clause: `(${field})::TIMESTAMP BETWEEN $${startIndex} AND $${startIndex + 1}`,
        values: [
          new Date(filter.dateRange!.from!),
          new Date(filter.dateRange!.to!)
        ]
      };
    
    // ... more operators
  }
}
```

---

## 🔍 Filtering System Deep Dive

### Supported Filter Operators

| Operator | Description | MongoDB | PostgreSQL | Complexity |
|----------|-------------|---------|------------|------------|
| `IS_EMPTY` | Field is null, empty, or undefined | ✅ | ✅ | LOW |
| `IS_NOT_EMPTY` | Field has a value | ✅ | ✅ | LOW |
| `EQUALS` | Exact match (case-insensitive) | ✅ | ✅ | LOW |
| `NOT_EQUALS` | Not equal | ✅ | ✅ | LOW |
| `CONTAINS` | Text contains substring | ✅ | ✅ | LOW |
| `NOT_CONTAINS` | Text doesn't contain | ✅ | ✅ | LOW |
| `STARTS_WITH` | Text starts with | ✅ | ✅ | LOW |
| `ENDS_WITH` | Text ends with | ✅ | ✅ | LOW |
| `GREATER_THAN` | Numeric > value | ✅ | ✅ | MEDIUM |
| `LESS_THAN` | Numeric < value | ✅ | ✅ | MEDIUM |
| `BETWEEN` | Numeric range | ⚠️ Memory | ✅ | MEDIUM |
| `DATE_EQUALS` | Date match (day precision) | ⚠️ Inconsistent | ✅ | HIGH |
| `DATE_BEFORE` | Date before | ⚠️ Memory | ✅ | HIGH |
| `DATE_AFTER` | Date after | ⚠️ Memory | ✅ | HIGH |
| `DATE_BETWEEN` | Date range | ⚠️ Memory | ✅ | HIGH |
| `IN` | Value in array | ✅ | ✅ | MEDIUM |
| `NOT_IN` | Value not in array | ✅ | ✅ | MEDIUM |

### Date Field Handling Strategy

**Problem**: Dates can be stored in multiple formats:
- ISO string: `"2024-01-15T10:30:00Z"`
- Unix timestamp: `1705318200000`
- Date object: `Date("2024-01-15T10:30:00Z")`

**MongoDB Current Approach**:
```typescript
// Transform date fields before storing
const transformDateFields = async (
  formId: string,
  responseData: Record<string, unknown>
): Promise<Prisma.InputJsonValue> => {
  const formSchema = await getFormSchemaFromHocuspocus(formId);
  const dateFields = findDateFields(formSchema);
  
  for (const fieldId of dateFields) {
    if (responseData[fieldId]) {
      // Convert to Date object for database storage
      responseData[fieldId] = new Date(responseData[fieldId] as string);
    }
  }
  
  return responseData as Prisma.InputJsonValue;
};
```

**PostgreSQL Approach**:
```sql
-- Store as ISO string, cast when filtering
WHERE (data->>'date_field')::TIMESTAMP >= '2024-01-01'::TIMESTAMP
```

**Recommendation**: Store as ISO strings, cast to TIMESTAMP in queries for consistency.

### Performance Comparison

**Test Scenario**: Filter 100,000 responses by email contains "@gmail.com" and age > 18

| Database | Strategy | Query Time | Memory Usage |
|----------|----------|------------|--------------|
| MongoDB | Database filtering | ~300ms | Low |
| MongoDB | Memory filtering | ~1,200ms | High (200MB+) |
| PostgreSQL | JSONB GIN index | ~150ms | Low |
| PostgreSQL | Raw SQL | ~100ms | Low |

**Expected Improvement**: 50-70% faster query times with PostgreSQL JSONB indexes.

---

## 📊 Analytics System

### View Analytics Schema

```sql
CREATE TABLE form_view_analytics (
  id               TEXT PRIMARY KEY,
  form_id          TEXT NOT NULL REFERENCES form(id) ON DELETE CASCADE,
  session_id       TEXT NOT NULL,  -- Anonymous UUID
  user_agent       TEXT NOT NULL,
  operating_system TEXT,
  browser          TEXT,
  browser_version  TEXT,
  country_code     TEXT,  -- ISO 3166-1 alpha-3 (USA, CAN, GBR)
  country_alpha2   TEXT,  -- ISO 3166-1 alpha-2 (US, CA, GB)
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

-- Analytics-optimized indexes
CREATE INDEX idx_view_form_time ON form_view_analytics(form_id, viewed_at DESC);
CREATE INDEX idx_view_country ON form_view_analytics(country_code) WHERE country_code IS NOT NULL;
CREATE INDEX idx_view_session ON form_view_analytics(session_id);
```

### Common Analytics Queries

#### 1. Top Countries by Views

**Current MongoDB**:
```typescript
await prisma.formViewAnalytics.groupBy({
  by: ['countryCode'],
  where: { formId, countryCode: { not: null } },
  _count: { countryCode: true },
  orderBy: { _count: { countryCode: 'desc' } },
  take: 10
});
```

**PostgreSQL**:
```sql
SELECT 
  country_code,
  country_alpha2,
  COUNT(*) as view_count,
  ROUND(COUNT(*)::NUMERIC / (
    SELECT COUNT(*) FROM form_view_analytics WHERE form_id = $1
  ) * 100, 2) as percentage
FROM form_view_analytics
WHERE form_id = $1 AND country_code IS NOT NULL
GROUP BY country_code, country_alpha2
ORDER BY view_count DESC
LIMIT 10;
```

#### 2. Daily View Trends (Last 30 Days)

**PostgreSQL**:
```sql
SELECT 
  DATE(viewed_at) as date,
  COUNT(*) as views,
  COUNT(DISTINCT session_id) as unique_sessions
FROM form_view_analytics
WHERE form_id = $1
  AND viewed_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(viewed_at)
ORDER BY date DESC;
```

#### 3. Browser/OS Distribution

**PostgreSQL**:
```sql
SELECT 
  browser,
  browser_version,
  operating_system,
  COUNT(*) as count
FROM form_view_analytics
WHERE form_id = $1
GROUP BY browser, browser_version, operating_system
ORDER BY count DESC
LIMIT 20;
```

#### 4. Average Completion Time

**PostgreSQL**:
```sql
SELECT 
  AVG(completion_time_seconds) as avg_seconds,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY completion_time_seconds) as median_seconds,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY completion_time_seconds) as p95_seconds
FROM form_submission_analytics
WHERE form_id = $1
  AND completion_time_seconds IS NOT NULL
  AND completion_time_seconds > 0;
```

#### 5. Submission Conversion Rate

**PostgreSQL**:
```sql
SELECT 
  (SELECT COUNT(*) FROM form_submission_analytics WHERE form_id = $1)::NUMERIC /
  (SELECT COUNT(*) FROM form_view_analytics WHERE form_id = $1)::NUMERIC * 100
  as conversion_rate_percentage;
```

### Analytics Performance Optimization

#### Materialized Views for Dashboards

```sql
-- Create materialized view for form statistics
CREATE MATERIALIZED VIEW form_stats_mv AS
SELECT 
  f.id as form_id,
  f.title,
  COUNT(DISTINCT v.id) as total_views,
  COUNT(DISTINCT v.session_id) as unique_visitors,
  COUNT(DISTINCT s.id) as total_submissions,
  ROUND(
    COUNT(DISTINCT s.id)::NUMERIC / 
    NULLIF(COUNT(DISTINCT v.id), 0) * 100, 
    2
  ) as conversion_rate,
  AVG(s.completion_time_seconds) as avg_completion_time
FROM form f
LEFT JOIN form_view_analytics v ON f.id = v.form_id
LEFT JOIN form_submission_analytics s ON f.id = s.form_id
GROUP BY f.id, f.title;

-- Refresh periodically (every hour)
CREATE INDEX idx_form_stats_mv_form ON form_stats_mv(form_id);
REFRESH MATERIALIZED VIEW form_stats_mv;
```

#### Partitioning for Time-Series Data

```sql
-- Partition analytics tables by month
CREATE TABLE form_view_analytics (
  -- same columns as before
) PARTITION BY RANGE (viewed_at);

CREATE TABLE form_view_analytics_2024_01 
  PARTITION OF form_view_analytics
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE form_view_analytics_2024_02 
  PARTITION OF form_view_analytics
  FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Automatic partition creation via pg_partman extension
```

---

## ⚡ Performance Optimization

### Query Optimization Checklist

- [ ] **Use GIN indexes** for JSONB columns
- [ ] **Add composite indexes** for common query patterns
- [ ] **Create partial indexes** for filtered queries
- [ ] **Use EXPLAIN ANALYZE** to verify index usage
- [ ] **Avoid SELECT \*** - select only needed columns
- [ ] **Use covering indexes** to avoid table lookups
- [ ] **Batch inserts** for bulk operations
- [ ] **Use connection pooling** (PgBouncer)
- [ ] **Monitor slow queries** with pg_stat_statements
- [ ] **Vacuum and analyze** regularly

### Connection Pooling Configuration

```typescript
// Prisma configuration
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["jsonProtocol"]
}

// Connection pool settings
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: ['query', 'error', 'warn'],
});

// DATABASE_URL format:
// postgresql://user:password@host:5432/database?schema=public&connection_limit=20&pool_timeout=20
```

### Monitoring Queries

```sql
-- Enable pg_stat_statements extension
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Find slow queries
SELECT 
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
WHERE query LIKE '%response%'
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Find queries not using indexes
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND schemaname NOT IN ('pg_catalog', 'information_schema');
```

---

## 🧪 Testing Strategy

### Performance Testing

```typescript
// Load test with K6 or Artillery
async function testResponseFiltering() {
  const formId = 'test-form-123';
  
  // Create test data
  const responses = await createTestResponses(formId, 100000);
  
  // Test various filter combinations
  const filters = [
    [{ fieldId: 'email', operator: 'CONTAINS', value: '@gmail.com' }],
    [{ fieldId: 'age', operator: 'GREATER_THAN', value: '18' }],
    [
      { fieldId: 'email', operator: 'CONTAINS', value: '@gmail.com' },
      { fieldId: 'age', operator: 'BETWEEN', numberRange: { min: 18, max: 65 } }
    ]
  ];
  
  for (const filter of filters) {
    const start = performance.now();
    const result = await getResponsesByFormId(formId, 1, 20, 'submittedAt', 'desc', filter);
    const duration = performance.now() - start;
    
    console.log(`Filter: ${JSON.stringify(filter)}`);
    console.log(`Duration: ${duration}ms`);
    console.log(`Results: ${result.total} total, ${result.data.length} returned`);
  }
}
```

### Data Integrity Validation

```typescript
async function validateMigration(formId: string) {
  // Compare MongoDB and PostgreSQL results
  const mongoResponses = await getMongoDBResponses(formId);
  const pgResponses = await getPostgreSQLResponses(formId);
  
  assert.equal(mongoResponses.length, pgResponses.length, 
    'Response count mismatch');
  
  for (let i = 0; i < mongoResponses.length; i++) {
    const mongo = mongoResponses[i];
    const pg = pgResponses[i];
    
    assert.equal(mongo.id, pg.id, 'ID mismatch');
    assert.deepEqual(mongo.data, pg.data, 'Data mismatch');
    assert.equal(
      new Date(mongo.submittedAt).toISOString(),
      new Date(pg.submittedAt).toISOString(),
      'Date mismatch'
    );
  }
  
  console.log('✅ Migration validation passed');
}
```

---

**Next Document**: [MIGRATION_PART_4_COLLABORATION.md](./MIGRATION_PART_4_COLLABORATION.md)

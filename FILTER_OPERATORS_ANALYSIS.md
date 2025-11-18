# Filter Operators Analysis - All Field Types

Complete analysis of filter operators supported for each field type in Dculus Forms.

**Last Updated:** November 18, 2025

---

## Overview

| Field Type | Total Operators | UI Exposed | Backend Supported | Status |
|-----------|-----------------|------------|-------------------|--------|
| TEXT_INPUT | 8 | 8 | 8 | ✅ Complete |
| TEXT_AREA | 8 | 8 | 8 | ✅ Complete |
| EMAIL | 8 | 8 | 8 | ✅ Complete |
| NUMBER | 7 | 7 | 7 | ✅ Complete |
| DATE | 6 | 6 | 6 | ✅ Complete |
| SELECT | 4 | 4 | 4 | ✅ Complete |
| RADIO | 4 | 4 | 4 | ✅ Complete |
| CHECKBOX | 4 | 4 | 6 | ⚠️ Partial (CONTAINS/NOT_CONTAINS available but not exposed) |

---

## 1. TEXT_INPUT_FIELD

**Field Characteristics:**
- Single-line text input
- Stores string values
- Case-insensitive filtering

### Supported Operators (8)

| Operator | UI Label | Backend | Use Case | Example |
|----------|----------|---------|----------|---------|
| **CONTAINS** | Contains | ✅ | Find partial matches | Name contains "John" |
| **NOT_CONTAINS** | Not Contains | ✅ | Exclude partial matches | Name doesn't contain "spam" |
| **EQUALS** | Equals | ✅ | Exact match (case-insensitive) | Status equals "Active" |
| **NOT_EQUALS** | Not Equals | ✅ | Exclude exact match | Status not "Inactive" |
| **STARTS_WITH** | Starts With | ✅ | Prefix matching | Phone starts with "+1" |
| **ENDS_WITH** | Ends With | ✅ | Suffix matching | Email ends with ".com" |
| **IS_EMPTY** | Is Empty | ✅ | No value entered | Optional field left blank |
| **IS_NOT_EMPTY** | Is Not Empty | ✅ | Has any value | Required field filled |

**Backend Implementation:**
```sql
-- CONTAINS (case-insensitive)
data->>'fieldId' ILIKE '%value%'

-- EQUALS (case-insensitive)
LOWER(data->>'fieldId') = LOWER($1)

-- STARTS_WITH
data->>'fieldId' ILIKE 'value%'

-- IS_EMPTY
data->'fieldId' IS NULL OR data->>'fieldId' = ''
```

---

## 2. TEXT_AREA_FIELD

**Field Characteristics:**
- Multi-line text input
- Stores string values (can be long)
- Same operators as TEXT_INPUT

### Supported Operators (8)

Identical to TEXT_INPUT_FIELD:
- CONTAINS
- NOT_CONTAINS
- EQUALS
- NOT_EQUALS
- STARTS_WITH
- ENDS_WITH
- IS_EMPTY
- IS_NOT_EMPTY

**Common Use Cases:**
- Filter by description content
- Find responses with specific keywords
- Identify blank/filled feedback fields

---

## 3. EMAIL_FIELD

**Field Characteristics:**
- Email address input
- Stores string values
- Same operators as TEXT_INPUT
- Format validation on input (not filter level)

### Supported Operators (8)

Identical to TEXT_INPUT_FIELD:
- CONTAINS
- NOT_CONTAINS
- EQUALS
- NOT_EQUALS
- STARTS_WITH
- ENDS_WITH
- IS_EMPTY
- IS_NOT_EMPTY

**Common Use Cases:**
```
CONTAINS "@gmail.com"     → All Gmail users
ENDS_WITH "@company.com"  → Company employees
NOT_CONTAINS "+"          → No email aliases
IS_NOT_EMPTY              → Provided email address
```

---

## 4. NUMBER_FIELD

**Field Characteristics:**
- Numeric input
- Stores numeric values
- Supports range filtering

### Supported Operators (7)

| Operator | UI Label | Backend | Use Case | Example |
|----------|----------|---------|----------|---------|
| **EQUALS** | Equals | ✅ | Exact number | Age equals 25 |
| **NOT_EQUALS** | Not Equals | ✅ | Exclude number | Score not 0 |
| **GREATER_THAN** | Greater Than | ✅ | Minimum value | Salary > 50000 |
| **LESS_THAN** | Less Than | ✅ | Maximum value | Age < 18 |
| **BETWEEN** | Between | ✅ | Range filtering | Score between 60-100 |
| **IS_EMPTY** | Is Empty | ✅ | No value | Optional number blank |
| **IS_NOT_EMPTY** | Is Not Empty | ✅ | Has value | Number provided |

**Backend Implementation:**
```sql
-- GREATER_THAN (numeric casting)
(data->>'fieldId')::numeric > $1::numeric

-- BETWEEN (range with AND)
(data->>'fieldId')::numeric >= $1::numeric AND 
(data->>'fieldId')::numeric <= $2::numeric
```

**Common Use Cases:**
```
Age GREATER_THAN 18        → Adults only
Score BETWEEN 70-100       → High performers
Price LESS_THAN 1000       → Budget items
Quantity IS_NOT_EMPTY      → Items with stock
```

---

## 5. DATE_FIELD

**Field Characteristics:**
- Date picker input
- Stores date/timestamp values
- Supports date comparisons and ranges

### Supported Operators (6)

| Operator | UI Label | Backend | Use Case | Example |
|----------|----------|---------|----------|---------|
| **DATE_EQUALS** | Equals | ✅ | Exact date match | Born on 1990-01-15 |
| **DATE_BEFORE** | Before | ✅ | Earlier than date | Submitted before deadline |
| **DATE_AFTER** | After | ✅ | Later than date | Events after today |
| **DATE_BETWEEN** | Between | ✅ | Date range | Registrations in Q1 2025 |
| **IS_EMPTY** | Is Empty | ✅ | No date selected | Optional date blank |
| **IS_NOT_EMPTY** | Is Not Empty | ✅ | Date provided | Required date filled |

**Backend Implementation:**
```sql
-- DATE_EQUALS (ignore time)
DATE(data->>'fieldId') = DATE($1::timestamp)

-- DATE_BEFORE
(data->>'fieldId')::timestamp < $1::timestamp

-- DATE_BETWEEN
(data->>'fieldId')::timestamp >= $1::timestamp AND 
(data->>'fieldId')::timestamp <= $2::timestamp
```

**Common Use Cases:**
```
Birth Date DATE_BEFORE 2005-01-01  → Users 20+ years old
Registration DATE_AFTER 2025-01-01 → Recent signups
Event Date DATE_BETWEEN Jan-Mar    → Q1 events
Expiry Date IS_NOT_EMPTY           → Has expiration set
```

---

## 6. SELECT_FIELD (Dropdown)

**Field Characteristics:**
- Single selection from predefined options
- Stores string value (selected option)
- Uses IN/NOT_IN for multiple value matching

### Supported Operators (4)

| Operator | UI Label | Backend | Use Case | Example |
|----------|----------|---------|----------|---------|
| **IN** | Includes | ✅ | Match any of values | Status in ["Active", "Pending"] |
| **NOT_IN** | Not Includes | ✅ | Exclude values | Status not in ["Archived", "Deleted"] |
| **IS_EMPTY** | Is Empty | ✅ | No selection | Optional dropdown blank |
| **IS_NOT_EMPTY** | Is Not Empty | ✅ | Has selection | Required dropdown filled |

**Backend Implementation:**
```sql
-- IN (case-insensitive, string field)
LOWER(data->>'fieldId') = ANY(ARRAY[$1, $2, $3]::text[])

-- For string field (not array)
jsonb_typeof(data->'fieldId') = 'string' AND 
LOWER(data->>'fieldId') = ANY(ARRAY['option1', 'option2']::text[])
```

**Common Use Cases:**
```
Country IN ["USA", "Canada", "UK"]       → North America + UK
Priority NOT_IN ["Low"]                  → High/Medium priority
Department IS_NOT_EMPTY                  → Department selected
```

---

## 7. RADIO_FIELD

**Field Characteristics:**
- Single selection from predefined options (displayed as radio buttons)
- Stores string value (selected option)
- Identical operators to SELECT_FIELD

### Supported Operators (4)

Identical to SELECT_FIELD:
- **IN** - Match any of the selected values
- **NOT_IN** - Exclude selected values
- **IS_EMPTY** - No option selected
- **IS_NOT_EMPTY** - Option selected

**Common Use Cases:**
```
Gender IN ["Female", "Non-binary"]  → Specific genders
Agreement NOT_IN ["Disagree"]       → Positive responses
Experience IS_NOT_EMPTY             → Level selected
```

---

## 8. CHECKBOX_FIELD ⚠️

**Field Characteristics:**
- Multiple selections from predefined options
- Stores **array** of selected values: `["Option 1", "Option 3"]`
- Most complex filtering due to array nature

### Currently Exposed Operators (4)

| Operator | UI Label | Backend | Use Case | Example |
|----------|----------|---------|----------|---------|
| **IN** | Includes | ✅ | Has ANY selected value | Interests includes "Sports" OR "Music" |
| **NOT_IN** | Not Includes | ✅ | Doesn't have ANY value | Skills not including "Python" OR "Java" |
| **IS_EMPTY** | Is Empty | ✅ | No checkboxes selected | Nothing checked |
| **IS_NOT_EMPTY** | Is Not Empty | ✅ | At least one selected | Something checked |

**Backend Implementation:**
```sql
-- IN (array field check with ?| operator)
jsonb_typeof(data->'fieldId') = 'array' AND 
data->'fieldId' ?| ARRAY['Option 1', 'Option 2']

-- This returns TRUE if array contains ANY of the values
-- ["Option 1"] → matches
-- ["Option 1", "Option 3"] → matches
-- ["Option 2", "Option 3"] → matches
-- ["Option 4"] → no match
```

### Backend-Supported But NOT Exposed in UI (2)

| Operator | UI Status | Backend | Use Case | Example |
|----------|-----------|---------|----------|---------|
| **CONTAINS** | ❌ Not in UI | ✅ Working | Has specific single value | Has "Sports" selected |
| **NOT_CONTAINS** | ❌ Not in UI | ✅ Working | Doesn't have specific value | Doesn't have "Other" selected |

**Backend Implementation (Available):**
```sql
-- CONTAINS (array containment check)
jsonb_typeof(data->'fieldId') = 'array' AND 
data->'fieldId' @> '["Sports"]'::jsonb

-- NOT_CONTAINS
jsonb_typeof(data->'fieldId') = 'array' AND 
NOT data->'fieldId' @> '["Sports"]'::jsonb
```

### Potential Additional Operators (Not Implemented)

| Operator | Status | Complexity | Use Case | Example |
|----------|--------|------------|----------|---------|
| **CONTAINS_ALL** | ❌ | Medium | Must have ALL values | Has both "Sports" AND "Music" |
| **EQUALS** | ❌ | Easy | Exact match | Exactly ["Option 1", "Option 2"], no more/less |

**Implementation Examples:**

```sql
-- CONTAINS_ALL (requires all values)
data->'fieldId' @> '["Sports", "Music"]'::jsonb

-- EQUALS (exact array match)
data->'fieldId' = '["Option 1", "Option 2"]'::jsonb
```

---

## Filter Logic Combinations

All field types support **AND/OR logic** when multiple filters are applied:

```typescript
// UI exposes FilterLogic selection
filterLogic: 'AND' | 'OR' = 'AND'

// Backend builds dynamic SQL
WHERE condition1 AND condition2  // All must match
WHERE condition1 OR condition2   // Any must match
```

**Example:**
```
Filter 1: Age GREATER_THAN 18
Filter 2: Country IN ["USA", "Canada"]
Logic: AND → Adults from USA or Canada
Logic: OR  → Anyone 18+ OR from USA/Canada (regardless of age)
```

---

## Recommendations for Improvement

### 1. **Checkbox Field Enhancement** (High Priority)
- ✅ Backend already supports CONTAINS/NOT_CONTAINS
- 🔧 Add to UI dropdown in FilterRow.tsx and FieldFilter.tsx
- 📝 Update translations for new operators

**Code Change Required:**
```typescript
// In FilterRow.tsx and FieldFilter.tsx
case FieldType.CHECKBOX_FIELD:
  return [
    { value: 'IN', label: t('operators.includes') },
    { value: 'NOT_IN', label: t('operators.notIncludes') },
    { value: 'CONTAINS', label: t('operators.contains') },      // ADD
    { value: 'NOT_CONTAINS', label: t('operators.notContains') }, // ADD
    ...baseOptions,
  ];
```

### 2. **Add CONTAINS_ALL for Checkboxes** (Medium Priority)
Useful for "must have all selected values" scenarios.

**Backend Implementation:**
```typescript
case 'CONTAINS_ALL': {
  if (!filter.values || filter.values.length === 0) return { sql: '', values: [] };
  return {
    sql: `data->'${filter.fieldId}' @> $${startIndex}::jsonb`,
    values: [JSON.stringify(filter.values)],
  };
}
```

### 3. **Add EQUALS for Checkboxes** (Low Priority)
For exact array matching scenarios.

### 4. **Numeric Range UI Enhancement**
Consider adding a dedicated range slider UI for NUMBER_FIELD BETWEEN operator.

### 5. **Date Range Presets**
Add quick presets for DATE_BETWEEN: "Last 7 days", "This month", "Last quarter", etc.

---

## Testing Coverage

### Integration Tests Status
- ✅ All operators tested in `test/integration/features/response-filtering.feature`
- ✅ 66/66 scenarios passing (623/623 steps)
- ✅ AND/OR logic fully tested
- ✅ IN/NOT_IN for arrays (checkboxes) fully tested

### Unit Tests Status
- ✅ All backend operators tested in `responseQueryBuilder.test.ts`
- ✅ Memory filtering fallback tested
- ✅ 71/71 test files passing (1849/1849 tests)

---

## Database Performance Notes

### Indexed Fields
All filters use PostgreSQL JSONB operators optimized for:
- GIN indexes on `data` column
- Case-insensitive comparisons (LOWER, ILIKE)
- Native JSONB operators (@>, ?|, etc.)

### Performance Tips
1. **Avoid multiple OR filters** on large datasets - can slow queries
2. **Use IS_NOT_EMPTY** before other operators to filter nulls first
3. **Date filters** are fast with proper timestamp casting
4. **Array operators** (?|, @>) are optimized in PostgreSQL 14+

---

## API Usage Examples

### GraphQL Filter Input
```graphql
query GetFormResponses(
  $formId: ID!
  $filters: [ResponseFilterInput!]
  $filterLogic: FilterLogic
) {
  responsesByForm(
    formId: $formId
    filters: $filters
    filterLogic: $filterLogic
  ) {
    data {
      id
      data
      submittedAt
    }
  }
}
```

### Filter Examples by Field Type

**Text Field:**
```json
{
  "fieldId": "name-field",
  "operator": "CONTAINS",
  "value": "John"
}
```

**Number Field:**
```json
{
  "fieldId": "age-field",
  "operator": "BETWEEN",
  "numberRange": { "min": 18, "max": 65 }
}
```

**Date Field:**
```json
{
  "fieldId": "registration-date",
  "operator": "DATE_BETWEEN",
  "dateRange": {
    "from": "2025-01-01",
    "to": "2025-03-31"
  }
}
```

**Select/Radio Field:**
```json
{
  "fieldId": "country-field",
  "operator": "IN",
  "values": ["USA", "Canada", "UK"]
}
```

**Checkbox Field:**
```json
{
  "fieldId": "interests-field",
  "operator": "IN",
  "values": ["Sports", "Music"]
}
```

---

## Summary Matrix

| Operator | Text | Number | Date | Select | Radio | Checkbox |
|----------|------|--------|------|--------|-------|----------|
| EQUALS | ✅ | ✅ | ✅* | - | - | - |
| NOT_EQUALS | ✅ | ✅ | - | - | - | - |
| CONTAINS | ✅ | - | - | - | - | ⚠️† |
| NOT_CONTAINS | ✅ | - | - | - | - | ⚠️† |
| STARTS_WITH | ✅ | - | - | - | - | - |
| ENDS_WITH | ✅ | - | - | - | - | - |
| GREATER_THAN | - | ✅ | - | - | - | - |
| LESS_THAN | - | ✅ | - | - | - | - |
| BETWEEN | - | ✅ | ✅* | - | - | - |
| IN | - | - | - | ✅ | ✅ | ✅ |
| NOT_IN | - | - | - | ✅ | ✅ | ✅ |
| DATE_BEFORE | - | - | ✅ | - | - | - |
| DATE_AFTER | - | - | ✅ | - | - | - |
| IS_EMPTY | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| IS_NOT_EMPTY | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

*Date operators prefixed with DATE_  
†Backend supported but not exposed in UI

---

**Legend:**
- ✅ Fully implemented and working
- ⚠️ Backend working but not exposed in UI
- ❌ Not implemented
- `-` Not applicable for this field type

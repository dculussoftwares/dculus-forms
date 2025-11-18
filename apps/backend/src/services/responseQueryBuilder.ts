/**
 * Response Query Builder Service - PostgreSQL Version
 * 
 * Builds dynamic PostgreSQL queries for filtering form responses at the database level.
 * Leverages PostgreSQL's JSONB operators and raw SQL for efficient JSON field querying.
 * 
 * Strategy:
 * - Use raw SQL with Prisma's $queryRaw for JSONB filtering
 * - All filtering is done at database level (no memory filtering)
 * - Supports case-insensitive text, numeric comparisons, date ranges, arrays
 * 
 * PostgreSQL JSONB Advantages:
 * - Native JSONB type with specialized operators (@>, ->, ->>, etc.)
 * - LOWER(), CAST(), ILIKE for case-insensitive and type-aware operations
 * - GIN indexes on JSONB columns for fast querying
 * - Full-text search capabilities
 */

import { ResponseFilter } from './responseFilterService.js';

const SAFE_FIELD_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

const ensureSafeFieldId = (fieldId: string): string => {
  if (!SAFE_FIELD_ID_PATTERN.test(fieldId)) {
    throw new Error(`Invalid fieldId "${fieldId}"`);
  }
  return fieldId;
};

// For PostgreSQL, we return SQL conditions and parameters
export interface RawSQLFilter {
  conditions: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any[];
}

/**
 * Determines if filters can be fully executed at database level
 * With raw PostgreSQL queries, ALL filters can be executed at database level
 */
export function canFilterAtDatabase(_filters?: ResponseFilter[]): boolean {
  // All filters can be executed at database level using raw SQL
  return true;
}

/**
 * Builds raw SQL WHERE conditions for response filtering
 * Returns SQL conditions array and parameter values
 * @param filterLogic - 'AND' or 'OR' to combine multiple filter conditions (currently only used in service layer)
 */
export function buildPostgreSQLFilter(
  formId: string,
  filters?: ResponseFilter[],
  _filterLogic: 'AND' | 'OR' = 'AND'
): RawSQLFilter {
  const sqlConditions: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params: any[] = [formId]; // Start with formId as first parameter
  let paramIndex = 2; // PostgreSQL uses $1, $2, etc. ($1 is formId)

  if (!filters || filters.length === 0) {
    return { conditions: [], params: [formId] };
  }

  for (const filter of filters) {
    const { sql, values } = buildRawSQLCondition(filter, paramIndex);
    if (sql) {
      sqlConditions.push(sql);
      params.push(...values);
      paramIndex += values.length;
    }
  }

  return {
    conditions: sqlConditions,
    params,
  };
}

/**
 * Builds raw SQL condition for a single filter
 * Returns SQL string with PostgreSQL placeholders ($1, $2, etc.) and parameter values
 */
function buildRawSQLCondition(
  filter: ResponseFilter,
  startIndex: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): { sql: string; values: any[] } {
  const safeFieldId = ensureSafeFieldId(filter.fieldId);
  const jsonAccessor = `data->'${safeFieldId}'`;
  const textAccessor = `data->>'${safeFieldId}'`;

  switch (filter.operator) {
    case 'IS_EMPTY':
      // Check if field is null, empty string, or empty array
      return {
        sql: `(
          ${jsonAccessor} IS NULL OR 
          ${textAccessor} = '' OR
          (jsonb_typeof(${jsonAccessor}) = 'array' AND jsonb_array_length(${jsonAccessor}) = 0)
        )`,
        values: [],
      };

    case 'IS_NOT_EMPTY':
      // Check if field exists, is not empty, and not an empty array
      return {
        sql: `(
          ${jsonAccessor} IS NOT NULL AND 
          ${textAccessor} != '' AND
          NOT (jsonb_typeof(${jsonAccessor}) = 'array' AND jsonb_array_length(${jsonAccessor}) = 0)
        )`,
        values: [],
      };

    case 'EQUALS':
      // Handle both string equality and array exact match
      if (filter.value === undefined && (!filter.values || filter.values.length === 0)) {
        return { sql: '', values: [] };
      }
      // For string comparison (single value)
      if (filter.value !== undefined) {
        return {
          sql: `LOWER(${textAccessor}) = LOWER($${startIndex})`,
          values: [String(filter.value)],
        };
      }
      // For array exact match (multiple values) - used by checkbox fields
      // Order-independent comparison: array contains exactly these values, no more, no less
      if (filter.values && filter.values.length > 0) {
        const placeholders = filter.values
          .map((_, idx) => `$${startIndex + idx}`)
          .join(', ');
        return {
          sql: `(
            jsonb_typeof(${jsonAccessor}) = 'array' AND
            jsonb_array_length(${jsonAccessor}) = ${filter.values.length} AND
            NOT EXISTS (
              SELECT 1 FROM unnest(ARRAY[${placeholders}]::text[]) AS expected(val)
              WHERE NOT EXISTS (
                SELECT 1 FROM jsonb_array_elements_text(${jsonAccessor}) elem
                WHERE LOWER(elem) = LOWER(expected.val)
              )
            )
          )`,
          values: filter.values.map((value) => String(value)),
        };
      }
      return { sql: '', values: [] };

    case 'NOT_EQUALS':
      if (filter.value === undefined) return { sql: '', values: [] };
      return {
        sql: `LOWER(${textAccessor}) != LOWER($${startIndex})`,
        values: [String(filter.value)],
      };

    case 'CONTAINS':
      if (!filter.value) return { sql: '', values: [] };
      // Handle both string contains (case-insensitive) and array contains
      // For arrays: Check if the value exists in the array
      // For strings: Use ILIKE for case-insensitive substring match
      return {
        sql: `(
          (jsonb_typeof(${jsonAccessor}) = 'array' AND EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(${jsonAccessor}) elem
            WHERE LOWER(elem) = $${startIndex}
          )) OR
          (jsonb_typeof(${jsonAccessor}) = 'string' AND ${textAccessor} ILIKE $${startIndex + 1})
        )`,
        values: [String(filter.value).toLowerCase(), `%${filter.value}%`],
      };

    case 'NOT_CONTAINS':
      if (!filter.value) return { sql: '', values: [] };
      return {
        sql: `(
          ${jsonAccessor} IS NULL OR
          (jsonb_typeof(${jsonAccessor}) = 'array' AND NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(${jsonAccessor}) elem
            WHERE LOWER(elem) = $${startIndex}
          )) OR
          (jsonb_typeof(${jsonAccessor}) = 'string' AND ${textAccessor} NOT ILIKE $${startIndex + 1})
        )`,
        values: [String(filter.value).toLowerCase(), `%${filter.value}%`],
      };

    case 'STARTS_WITH':
      if (!filter.value) return { sql: '', values: [] };
      return {
        sql: `${textAccessor} ILIKE $${startIndex}`,
        values: [`${filter.value}%`],
      };

    case 'ENDS_WITH':
      if (!filter.value) return { sql: '', values: [] };
      return {
        sql: `${textAccessor} ILIKE $${startIndex}`,
        values: [`%${filter.value}`],
      };

    case 'GREATER_THAN':
      if (filter.value === undefined) return { sql: '', values: [] };
      // Safe numeric cast: validate the value is a number before casting
      return {
        sql: `(
          CASE 
            WHEN ${textAccessor} ~ '^-?[0-9]+(\\.[0-9]+)?$' 
            THEN (${textAccessor})::numeric > $${startIndex}::numeric
            ELSE FALSE
          END
        )`,
        values: [filter.value],
      };

    case 'LESS_THAN':
      if (filter.value === undefined) return { sql: '', values: [] };
      // Safe numeric cast: validate the value is a number before casting
      return {
        sql: `(
          CASE 
            WHEN ${textAccessor} ~ '^-?[0-9]+(\\.[0-9]+)?$' 
            THEN (${textAccessor})::numeric < $${startIndex}::numeric
            ELSE FALSE
          END
        )`,
        values: [filter.value],
      };

    case 'BETWEEN': {
      if (!filter.numberRange) return { sql: '', values: [] };
      const conditions: string[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const values: any[] = [];
      let idx = startIndex;
      
      // Safe numeric cast: only process if value matches numeric pattern
      const numericCheck = `${textAccessor} ~ '^-?[0-9]+(\\.[0-9]+)?$'`;
      
      if (filter.numberRange.min !== undefined) {
        conditions.push(`(${textAccessor})::numeric >= $${idx}::numeric`);
        values.push(filter.numberRange.min);
        idx++;
      }
      if (filter.numberRange.max !== undefined) {
        conditions.push(`(${textAccessor})::numeric <= $${idx}::numeric`);
        values.push(filter.numberRange.max);
      }
      
      if (conditions.length === 0) return { sql: '', values: [] };
      return {
        sql: `(
          CASE 
            WHEN ${numericCheck}
            THEN ${conditions.join(' AND ')}
            ELSE FALSE
          END
        )`,
        values,
      };
    }

    case 'IN': {
      if (!filter.values || filter.values.length === 0) return { sql: '', values: [] };
      const loweredValues = filter.values.map((value) => String(value).toLowerCase());
      const placeholders = loweredValues.map((_, idx) => `$${startIndex + idx}`).join(', ');
      return {
        sql: `(
          (jsonb_typeof(${jsonAccessor}) = 'string' AND LOWER(${textAccessor}) = ANY(ARRAY[${placeholders}]::text[])) OR
          (jsonb_typeof(${jsonAccessor}) = 'array' AND EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(${jsonAccessor}) elem
            WHERE LOWER(elem) = ANY(ARRAY[${placeholders}]::text[])
          ))
        )`,
        values: loweredValues,
      };
    }

    case 'NOT_IN': {
      if (!filter.values || filter.values.length === 0) return { sql: '', values: [] };
      const loweredValues = filter.values.map((value) => String(value).toLowerCase());
      const placeholders = loweredValues.map((_, idx) => `$${startIndex + idx}`).join(', ');
      return {
        sql: `(
          ${jsonAccessor} IS NULL OR
          (jsonb_typeof(${jsonAccessor}) = 'string' AND NOT (LOWER(${textAccessor}) = ANY(ARRAY[${placeholders}]::text[]))) OR
          (jsonb_typeof(${jsonAccessor}) = 'array' AND NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(${jsonAccessor}) elem
            WHERE LOWER(elem) = ANY(ARRAY[${placeholders}]::text[])
          ))
        )`,
        values: loweredValues,
      };
    }

    case 'CONTAINS_ALL': {
      if (!filter.values || filter.values.length === 0) return { sql: '', values: [] };
      const loweredValues = filter.values.map((value) => String(value).toLowerCase());
      const placeholders = loweredValues.map((_, idx) => `$${startIndex + idx}`).join(', ');
      return {
        sql: `(
          jsonb_typeof(${jsonAccessor}) = 'array' AND
          NOT EXISTS (
            SELECT 1 FROM unnest(ARRAY[${placeholders}]::text[]) AS expected(val)
            WHERE NOT EXISTS (
              SELECT 1 FROM jsonb_array_elements_text(${jsonAccessor}) elem
              WHERE LOWER(elem) = expected.val
            )
          )
        )`,
        values: loweredValues,
      };
    }

    // Date operators
    case 'DATE_EQUALS': {
      if (!filter.value) return { sql: '', values: [] };
      // Safe date cast: validate timestamp format before casting
      return {
        sql: `(
          CASE 
            WHEN ${textAccessor} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' OR ${textAccessor} ~ '^[0-9]+$'
            THEN DATE((${textAccessor})::timestamp) = DATE($${startIndex}::timestamp)
            ELSE FALSE
          END
        )`,
        values: [filter.value],
      };
    }

    case 'DATE_BEFORE': {
      if (!filter.value) return { sql: '', values: [] };
      // Safe date cast: validate timestamp format before casting
      return {
        sql: `(
          CASE 
            WHEN ${textAccessor} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' OR ${textAccessor} ~ '^[0-9]+$'
            THEN (${textAccessor})::timestamp < $${startIndex}::timestamp
            ELSE FALSE
          END
        )`,
        values: [filter.value],
      };
    }

    case 'DATE_AFTER': {
      if (!filter.value) return { sql: '', values: [] };
      // Safe date cast: validate timestamp format before casting
      return {
        sql: `(
          CASE 
            WHEN ${textAccessor} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' OR ${textAccessor} ~ '^[0-9]+$'
            THEN (${textAccessor})::timestamp > $${startIndex}::timestamp
            ELSE FALSE
          END
        )`,
        values: [filter.value],
      };
    }

    case 'DATE_BETWEEN': {
      if (!filter.dateRange) return { sql: '', values: [] };
      const dateConditions: string[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dateValues: any[] = [];
      let dateIdx = startIndex;
      
      // Safe date cast: validate timestamp format before casting
      const dateCheck = `${textAccessor} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' OR ${textAccessor} ~ '^[0-9]+$'`;
      
      if (filter.dateRange.from) {
        dateConditions.push(`(${textAccessor})::timestamp >= $${dateIdx}::timestamp`);
        dateValues.push(filter.dateRange.from);
        dateIdx++;
      }
      if (filter.dateRange.to) {
        dateConditions.push(`(${textAccessor})::timestamp <= $${dateIdx}::timestamp`);
        dateValues.push(filter.dateRange.to);
      }
      
      if (dateConditions.length === 0) return { sql: '', values: [] };
      return {
        sql: `(
          CASE 
            WHEN ${dateCheck}
            THEN ${dateConditions.join(' AND ')}
            ELSE FALSE
          END
        )`,
        values: dateValues,
      };
    }

    default:
      return { sql: '', values: [] };
  }
}

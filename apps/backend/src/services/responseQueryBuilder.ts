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
  
  switch (filter.operator) {
    case 'IS_EMPTY':
      // Check if field is null, empty string, or doesn't exist
      return {
        sql: `(data->'${filter.fieldId}' IS NULL OR data->>'${filter.fieldId}' = '')`,
        values: [],
      };

    case 'IS_NOT_EMPTY':
      // Check if field exists and is not empty
      return {
        sql: `(data->'${filter.fieldId}' IS NOT NULL AND data->>'${filter.fieldId}' != '')`,
        values: [],
      };

    case 'EQUALS':
      if (filter.value === undefined) return { sql: '', values: [] };
      // Case-insensitive comparison using LOWER()
      return {
        sql: `LOWER(data->>'${filter.fieldId}') = LOWER($${startIndex})`,
        values: [String(filter.value)],
      };

    case 'NOT_EQUALS':
      if (filter.value === undefined) return { sql: '', values: [] };
      return {
        sql: `LOWER(data->>'${filter.fieldId}') != LOWER($${startIndex})`,
        values: [String(filter.value)],
      };

    case 'CONTAINS':
      if (!filter.value) return { sql: '', values: [] };
      // Handle both string contains (case-insensitive) and array contains
      // For arrays: Check if the value exists in the array
      // For strings: Use ILIKE for case-insensitive substring match
      return {
        sql: `(
          (jsonb_typeof(data->'${filter.fieldId}') = 'array' AND data->'${filter.fieldId}' @> $${startIndex}::jsonb) OR
          (jsonb_typeof(data->'${filter.fieldId}') = 'string' AND data->>'${filter.fieldId}' ILIKE $${startIndex + 1})
        )`,
        values: [JSON.stringify([String(filter.value)]), `%${filter.value}%`],
      };

    case 'NOT_CONTAINS':
      if (!filter.value) return { sql: '', values: [] };
      return {
        sql: `(
          (jsonb_typeof(data->'${filter.fieldId}') = 'array' AND NOT data->'${filter.fieldId}' @> $${startIndex}::jsonb) OR
          (jsonb_typeof(data->'${filter.fieldId}') = 'string' AND data->>'${filter.fieldId}' NOT ILIKE $${startIndex + 1})
        )`,
        values: [JSON.stringify([String(filter.value)]), `%${filter.value}%`],
      };

    case 'STARTS_WITH':
      if (!filter.value) return { sql: '', values: [] };
      return {
        sql: `data->>'${filter.fieldId}' ILIKE $${startIndex}`,
        values: [`${filter.value}%`],
      };

    case 'ENDS_WITH':
      if (!filter.value) return { sql: '', values: [] };
      return {
        sql: `data->>'${filter.fieldId}' ILIKE $${startIndex}`,
        values: [`%${filter.value}`],
      };

    case 'GREATER_THAN':
      if (filter.value === undefined) return { sql: '', values: [] };
      // Cast JSONB value to numeric for comparison
      return {
        sql: `(data->>'${filter.fieldId}')::numeric > $${startIndex}::numeric`,
        values: [filter.value],
      };

    case 'LESS_THAN':
      if (filter.value === undefined) return { sql: '', values: [] };
      return {
        sql: `(data->>'${filter.fieldId}')::numeric < $${startIndex}::numeric`,
        values: [filter.value],
      };

    case 'BETWEEN': {
      if (!filter.numberRange) return { sql: '', values: [] };
      const conditions: string[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const values: any[] = [];
      let idx = startIndex;
      
      if (filter.numberRange.min !== undefined) {
        conditions.push(`(data->>'${filter.fieldId}')::numeric >= $${idx}::numeric`);
        values.push(filter.numberRange.min);
        idx++;
      }
      if (filter.numberRange.max !== undefined) {
        conditions.push(`(data->>'${filter.fieldId}')::numeric <= $${idx}::numeric`);
        values.push(filter.numberRange.max);
      }
      
      if (conditions.length === 0) return { sql: '', values: [] };
      return {
        sql: `(${conditions.join(' AND ')})`,
        values,
      };
    }

    case 'IN': {
      if (!filter.values || filter.values.length === 0) return { sql: '', values: [] };
      // Use ANY for case-insensitive IN check
      const inPlaceholders = filter.values.map((_, i) => `$${startIndex + i}`).join(', ');
      return {
        sql: `LOWER(data->>'${filter.fieldId}') = ANY(ARRAY[${inPlaceholders}]::text[])`,
        values: filter.values.map(v => String(v).toLowerCase()),
      };
    }

    case 'NOT_IN': {
      if (!filter.values || filter.values.length === 0) return { sql: '', values: [] };
      const notInPlaceholders = filter.values.map((_, i) => `$${startIndex + i}`).join(', ');
      return {
        sql: `LOWER(data->>'${filter.fieldId}') != ALL(ARRAY[${notInPlaceholders}]::text[])`,
        values: filter.values.map(v => String(v).toLowerCase()),
      };
    }

    // Date operators
    case 'DATE_EQUALS': {
      if (!filter.value) return { sql: '', values: [] };
      // Compare dates ignoring time component
      return {
        sql: `DATE(data->>'${filter.fieldId}') = DATE($${startIndex}::timestamp)`,
        values: [filter.value],
      };
    }

    case 'DATE_BEFORE': {
      if (!filter.value) return { sql: '', values: [] };
      return {
        sql: `(data->>'${filter.fieldId}')::timestamp < $${startIndex}::timestamp`,
        values: [filter.value],
      };
    }

    case 'DATE_AFTER': {
      if (!filter.value) return { sql: '', values: [] };
      return {
        sql: `(data->>'${filter.fieldId}')::timestamp > $${startIndex}::timestamp`,
        values: [filter.value],
      };
    }

    case 'DATE_BETWEEN': {
      if (!filter.dateRange) return { sql: '', values: [] };
      const dateConditions: string[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dateValues: any[] = [];
      let dateIdx = startIndex;
      
      if (filter.dateRange.from) {
        dateConditions.push(`(data->>'${filter.fieldId}')::timestamp >= $${dateIdx}::timestamp`);
        dateValues.push(filter.dateRange.from);
        dateIdx++;
      }
      if (filter.dateRange.to) {
        dateConditions.push(`(data->>'${filter.fieldId}')::timestamp <= $${dateIdx}::timestamp`);
        dateValues.push(filter.dateRange.to);
      }
      
      if (dateConditions.length === 0) return { sql: '', values: [] };
      return {
        sql: `(${dateConditions.join(' AND ')})`,
        values: dateValues,
      };
    }

    default:
      return { sql: '', values: [] };
  }
}

/**
 * Response Query Builder Service - PostgreSQL Version
 * 
 * Builds dynamic PostgreSQL queries for filtering form responses at the database level.
 * Leverages PostgreSQL's JSONB operators for efficient JSON field querying.
 * 
 * Strategy:
 * - Use Prisma's native JSONB path filtering (available in Prisma 4.8+)
 * - All filtering is done at database level (no memory filtering needed)
 * - Superior performance compared to MongoDB implementation
 * 
 * PostgreSQL JSONB Advantages:
 * - Native JSONB type with specialized operators (@>, ->, ->>, etc.)
 * - GIN indexes on JSONB columns for fast querying
 * - Full-text search capabilities
 * - Type-safe queries through Prisma
 */

import { ResponseFilter } from './responseFilterService.js';

// For PostgreSQL, we return Prisma-compatible where clauses
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PostgreSQLFilter = Record<string, any>;

/**
 * Determines if filters can be fully executed at database level
 * With PostgreSQL, ALL filters can be executed at database level!
 */
export function canFilterAtDatabase(_filters?: ResponseFilter[]): boolean {
  // PostgreSQL supports all filter types at database level
  return true;
}

/**
 * Builds a Prisma where clause for response queries using PostgreSQL JSONB operators
 * Returns a filter that can be used directly with Prisma client
 */
export function buildMongoDBFilter(
  formId: string,
  filters?: ResponseFilter[]
): PostgreSQLFilter {
  const baseFilter: PostgreSQLFilter = {
    formId,
  };

  if (!filters || filters.length === 0) {
    return baseFilter;
  }

  // Build filter conditions
  const filterConditions: PostgreSQLFilter[] = [];

  for (const filter of filters) {
    const condition = buildFilterCondition(filter);
    if (condition) {
      filterConditions.push(condition);
    }
  }

  if (filterConditions.length === 0) {
    return baseFilter;
  }

  // Combine with AND logic
  return {
    ...baseFilter,
    AND: filterConditions,
  };
}

/**
 * Builds a single filter condition using PostgreSQL JSONB path expressions
 * Uses Prisma's JSON filter API: https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields
 */
function buildFilterCondition(filter: ResponseFilter): PostgreSQLFilter | null {
  // Path to the field in the JSON data column
  const fieldPath = [filter.fieldId];

  switch (filter.operator) {
    case 'IS_EMPTY':
      // Field is null, undefined, or empty string
      // In PostgreSQL with Prisma, we check if the field equals null or empty string
      return {
        OR: [
          {
            data: {
              path: fieldPath,
              equals: null,
            },
          },
          {
            data: {
              path: fieldPath,
              equals: '',
            },
          },
        ],
      };

    case 'IS_NOT_EMPTY':
      // Field exists and is not null/empty
      return {
        AND: [
          {
            data: {
              path: fieldPath,
              not: null,
            },
          },
          {
            data: {
              path: fieldPath,
              not: '',
            },
          },
        ],
      };

    case 'EQUALS':
      if (filter.value === undefined) return null;
      // For case-insensitive comparison in PostgreSQL JSONB
      // We need to use string_contains which does case-insensitive match
      return {
        data: {
          path: fieldPath,
          equals: filter.value,
        },
      };

    case 'NOT_EQUALS':
      if (filter.value === undefined) return null;
      return {
        data: {
          path: fieldPath,
          not: filter.value,
        },
      };

    case 'CONTAINS':
      if (!filter.value) return null;
      return {
        data: {
          path: fieldPath,
          string_contains: filter.value,
        },
      };

    case 'NOT_CONTAINS':
      if (!filter.value) return null;
      return {
        NOT: {
          data: {
            path: fieldPath,
            string_contains: filter.value,
          },
        },
      };

    case 'STARTS_WITH':
      if (!filter.value) return null;
      return {
        data: {
          path: fieldPath,
          string_starts_with: filter.value,
        },
      };

    case 'ENDS_WITH':
      if (!filter.value) return null;
      return {
        data: {
          path: fieldPath,
          string_ends_with: filter.value,
        },
      };

    case 'GREATER_THAN':
      if (filter.value === undefined) return null;
      return {
        data: {
          path: fieldPath,
          gt: parseFloat(filter.value),
        },
      };

    case 'LESS_THAN':
      if (filter.value === undefined) return null;
      return {
        data: {
          path: fieldPath,
          lt: parseFloat(filter.value),
        },
      };

    case 'BETWEEN': {
      if (!filter.numberRange) return null;
      const conditions: PostgreSQLFilter[] = [];
      
      if (filter.numberRange.min !== undefined) {
        conditions.push({
          data: {
            path: fieldPath,
            gte: filter.numberRange.min,
          },
        });
      }
      if (filter.numberRange.max !== undefined) {
        conditions.push({
          data: {
            path: fieldPath,
            lte: filter.numberRange.max,
          },
        });
      }
      
      // Must have at least one bound
      if (conditions.length === 0) return null;
      
      return {
        AND: conditions,
      };
    }

    case 'IN':
      if (!filter.values || filter.values.length === 0) return null;
      // PostgreSQL - use OR with multiple equals
      return {
        OR: filter.values.map(value => ({
          data: {
            path: fieldPath,
            equals: value,
          },
        })),
      };

    case 'NOT_IN':
      if (!filter.values || filter.values.length === 0) return null;
      return {
        AND: filter.values.map(value => ({
          data: {
            path: fieldPath,
            not: value,
          },
        })),
      };

    // Date operators - PostgreSQL handles date comparisons natively
    case 'DATE_EQUALS': {
      if (!filter.value) return null;
      try {
        const targetDate = new Date(filter.value);
        if (isNaN(targetDate.getTime())) return null;
        
        // Match the date (ignoring time component)
        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(targetDate);
        endOfDay.setHours(23, 59, 59, 999);
        
        return {
          AND: [
            {
              data: {
                path: fieldPath,
                gte: startOfDay.toISOString(),
              },
            },
            {
              data: {
                path: fieldPath,
                lte: endOfDay.toISOString(),
              },
            },
          ],
        };
      } catch {
        return null;
      }
    }

    case 'DATE_BEFORE': {
      if (!filter.value) return null;
      try {
        const targetDate = new Date(filter.value);
        if (isNaN(targetDate.getTime())) return null;
        
        return {
          data: {
            path: fieldPath,
            lt: targetDate.toISOString(),
          },
        };
      } catch {
        return null;
      }
    }

    case 'DATE_AFTER': {
      if (!filter.value) return null;
      try {
        const targetDate = new Date(filter.value);
        if (isNaN(targetDate.getTime())) return null;
        
        return {
          data: {
            path: fieldPath,
            gt: targetDate.toISOString(),
          },
        };
      } catch {
        return null;
      }
    }

    case 'DATE_BETWEEN': {
      if (!filter.dateRange) return null;
      try {
        const conditions: PostgreSQLFilter[] = [];
        
        if (filter.dateRange.from) {
          const fromDate = new Date(filter.dateRange.from);
          if (!isNaN(fromDate.getTime())) {
            conditions.push({
              data: {
                path: fieldPath,
                gte: fromDate.toISOString(),
              },
            });
          }
        }
        
        if (filter.dateRange.to) {
          const toDate = new Date(filter.dateRange.to);
          if (!isNaN(toDate.getTime())) {
            // Set to end of day for inclusive range
            toDate.setHours(23, 59, 59, 999);
            conditions.push({
              data: {
                path: fieldPath,
                lte: toDate.toISOString(),
              },
            });
          }
        }
        
        // Must have at least one bound
        if (conditions.length === 0) return null;
        
        return {
          AND: conditions,
        };
      } catch {
        return null;
      }
    }

    default:
      // Unsupported operator
      return null;
  }
}

/**
 * Response Query Builder Service
 * 
 * Builds dynamic MongoDB queries for filtering form responses at the database level.
 * This improves performance by reducing the amount of data loaded into memory.
 * 
 * Strategy:
 * - Use Prisma's raw MongoDB queries for JSON field filtering
 * - Leverage MongoDB's $ operators for nested field queries
 * - Handle complex filters with a hybrid approach (DB + memory filtering)
 * 
 * Note: Prisma's typed query builder has limited support for JSON field filtering in MongoDB.
 * For optimal performance, we use raw MongoDB queries via Prisma.$runCommandRaw
 */

import { ResponseFilter } from './responseFilterService.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MongoFilter = Record<string, any>;

/**
 * Determines if filters can be fully executed at database level
 */
export function canFilterAtDatabase(filters?: ResponseFilter[]): boolean {
  if (!filters || filters.length === 0) return true;
  
  // Operators that can be executed at database level with MongoDB
  const databaseSupportedOperators = [
    'IS_EMPTY',
    'IS_NOT_EMPTY',
    'EQUALS',
    'NOT_EQUALS',
    'IN',
    'NOT_IN',
    'GREATER_THAN',
    'LESS_THAN',
    'BETWEEN',      // MongoDB supports $gte and $lte
    'CONTAINS',     // MongoDB supports regex
    'NOT_CONTAINS',
    'STARTS_WITH',
    'ENDS_WITH',
  ];
  
  return filters.every(filter => databaseSupportedOperators.includes(filter.operator));
}

/**
 * Builds a MongoDB filter object for response queries
 * 
 * MongoDB query syntax:
 * - "data.fieldId": accesses nested JSON fields
 * - $exists, $ne, $in, $regex - MongoDB operators
 * - $and, $or - logical operators
 */
export function buildMongoDBFilter(
  formId: string,
  filters?: ResponseFilter[]
): MongoFilter {
  const baseFilter: MongoFilter = {
    formId,
  };

  if (!filters || filters.length === 0) {
    return baseFilter;
  }

  // Build filter conditions
  const filterConditions: MongoFilter[] = [];

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
    $and: filterConditions,
  };
}

/**
 * Builds a single filter condition for MongoDB
 */
function buildFilterCondition(filter: ResponseFilter): MongoFilter | null {
  const fieldPath = `data.${filter.fieldId}`;

  switch (filter.operator) {
    case 'IS_EMPTY':
      // Field is null, undefined, empty string, or doesn't exist
      return {
        $or: [
          { [fieldPath]: { $exists: false } },
          { [fieldPath]: null },
          { [fieldPath]: '' },
        ],
      };

    case 'IS_NOT_EMPTY':
      // Field exists and is not null/empty
      return {
        $and: [
          { [fieldPath]: { $exists: true } },
          { [fieldPath]: { $ne: null } },
          { [fieldPath]: { $ne: '' } },
        ],
      };

    case 'EQUALS':
      if (filter.value === undefined) return null;
      // Case-insensitive string match using regex
      return {
        [fieldPath]: {
          $regex: `^${escapeRegex(filter.value)}$`,
          $options: 'i',
        },
      };

    case 'NOT_EQUALS':
      if (filter.value === undefined) return null;
      return {
        [fieldPath]: {
          $not: {
            $regex: `^${escapeRegex(filter.value)}$`,
            $options: 'i',
          },
        },
      };

    case 'CONTAINS':
      if (!filter.value) return null;
      return {
        [fieldPath]: {
          $regex: escapeRegex(filter.value),
          $options: 'i',
        },
      };

    case 'NOT_CONTAINS':
      if (!filter.value) return null;
      return {
        [fieldPath]: {
          $not: {
            $regex: escapeRegex(filter.value),
            $options: 'i',
          },
        },
      };

    case 'STARTS_WITH':
      if (!filter.value) return null;
      return {
        [fieldPath]: {
          $regex: `^${escapeRegex(filter.value)}`,
          $options: 'i',
        },
      };

    case 'ENDS_WITH':
      if (!filter.value) return null;
      return {
        [fieldPath]: {
          $regex: `${escapeRegex(filter.value)}$`,
          $options: 'i',
        },
      };

    case 'GREATER_THAN':
      if (filter.value === undefined) return null;
      return {
        [fieldPath]: { $gt: parseFloat(filter.value) },
      };

    case 'LESS_THAN':
      if (filter.value === undefined) return null;
      return {
        [fieldPath]: { $lt: parseFloat(filter.value) },
      };

    case 'BETWEEN': {
      if (!filter.numberRange) return null;
      const conditions: MongoFilter = {};
      
      if (filter.numberRange.min !== undefined) {
        conditions.$gte = filter.numberRange.min;
      }
      if (filter.numberRange.max !== undefined) {
        conditions.$lte = filter.numberRange.max;
      }
      
      // Must have at least one bound
      if (Object.keys(conditions).length === 0) return null;
      
      return {
        [fieldPath]: conditions,
      };
    }

    case 'IN':
      if (!filter.values || filter.values.length === 0) return null;
      // Case-insensitive IN using multiple regex OR
      return {
        $or: filter.values.map(value => ({
          [fieldPath]: {
            $regex: `^${escapeRegex(value)}$`,
            $options: 'i',
          },
        })),
      };

    case 'NOT_IN':
      if (!filter.values || filter.values.length === 0) return null;
      return {
        $and: filter.values.map(value => ({
          [fieldPath]: {
            $not: {
              $regex: `^${escapeRegex(value)}$`,
              $options: 'i',
            },
          },
        })),
      };

    default:
      // Unsupported at database level
      return null;
  }
}

/**
 * Escapes special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Filters that require in-memory processing (complex operations not supported by basic MongoDB queries)
 * Only date operations need memory processing due to multiple format handling and date-only comparisons
 */
export function getMemoryOnlyFilters(filters?: ResponseFilter[]): ResponseFilter[] {
  if (!filters) return [];
  
  const memoryRequiredOperators = [
    'DATE_EQUALS',    // Needs date parsing and date-only comparison
    'DATE_BEFORE',    // Needs date parsing for multiple formats
    'DATE_AFTER',     // Needs date parsing for multiple formats
    'DATE_BETWEEN',   // Needs date parsing and range comparison
  ];
  
  return filters.filter(filter => memoryRequiredOperators.includes(filter.operator));
}


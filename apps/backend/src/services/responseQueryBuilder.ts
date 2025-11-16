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
    'BETWEEN',        // MongoDB supports $gte and $lte
    'CONTAINS',       // MongoDB supports regex
    'NOT_CONTAINS',
    'STARTS_WITH',
    'ENDS_WITH',
    'DATE_EQUALS',    // Now supported - dates stored as Date objects
    'DATE_BEFORE',    // Now supported - can use $lt on Date objects
    'DATE_AFTER',     // Now supported - can use $gt on Date objects
    'DATE_BETWEEN',   // Now supported - can use $gte/$lte on Date objects
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

    // Date operators - now work at database level since dates are stored as Date objects
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
          [fieldPath]: {
            $gte: startOfDay,
            $lte: endOfDay,
          },
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
          [fieldPath]: { $lt: targetDate },
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
          [fieldPath]: { $gt: targetDate },
        };
      } catch {
        return null;
      }
    }

    case 'DATE_BETWEEN': {
      if (!filter.dateRange) return null;
      try {
        const conditions: MongoFilter = {};
        
        if (filter.dateRange.from) {
          const fromDate = new Date(filter.dateRange.from);
          if (!isNaN(fromDate.getTime())) {
            conditions.$gte = fromDate;
          }
        }
        
        if (filter.dateRange.to) {
          const toDate = new Date(filter.dateRange.to);
          if (!isNaN(toDate.getTime())) {
            // Set to end of day for inclusive range
            toDate.setHours(23, 59, 59, 999);
            conditions.$lte = toDate;
          }
        }
        
        // Must have at least one bound
        if (Object.keys(conditions).length === 0) return null;
        
        return {
          [fieldPath]: conditions,
        };
      } catch {
        return null;
      }
    }

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

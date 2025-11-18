export interface ResponseFilter {
  fieldId: string;
  operator: string;
  value?: string;
  values?: string[];
  dateRange?: { from?: string; to?: string };
  numberRange?: { min?: number; max?: number };
}

/**
 * Applies filters to response data based on various operators
 * @param responses - Array of response objects
 * @param filters - Array of filter criteria to apply
 * @param filterLogic - Logic to combine filters: 'AND' (all must pass) or 'OR' (any can pass)
 * @returns Filtered array of responses that match filter criteria
 */
const isValueEmpty = (value: unknown): boolean => {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === 'string') {
    return value.trim() === '';
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  return false;
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && !isNaN(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
};

const parseFilterNumber = (value?: string): number | null => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const parsed = Number(value);
  return isNaN(parsed) ? null : parsed;
};

export function applyResponseFilters(
  responses: any[],
  filters?: ResponseFilter[],
  filterLogic: 'AND' | 'OR' = 'AND'
): any[] {
  if (!filters || filters.length === 0) {
    return responses;
  }

  return responses.filter(response => {
    // Apply AND or OR logic depending on parameter
    const filterMethod = filterLogic === 'OR' ? 'some' : 'every';
    return filters[filterMethod](filter => {
      // Get field value from response data (handles both 'data' and 'responseData' properties)
      const fieldValue =
        response.responseData?.[filter.fieldId] ??
        response.data?.[filter.fieldId];

      switch (filter.operator) {
        case 'IS_EMPTY':
          return isValueEmpty(fieldValue);

        case 'IS_NOT_EMPTY':
          return !isValueEmpty(fieldValue);

        case 'EQUALS':
          // Handle both string equality and array exact match
          if (Array.isArray(fieldValue) && filter.values && filter.values.length > 0) {
            // Array exact match: same length and same values (order-independent)
            if (fieldValue.length !== filter.values.length) return false;
            const fieldValuesLower = fieldValue.map(v => String(v).toLowerCase()).sort();
            const filterValuesLower = filter.values.map(v => String(v).toLowerCase()).sort();
            return fieldValuesLower.every((val, idx) => val === filterValuesLower[idx]);
          }
          // String equality
          return String(fieldValue).toLowerCase() === String(filter.value || '').toLowerCase();
        
        case 'NOT_EQUALS':
          return String(fieldValue).toLowerCase() !== String(filter.value || '').toLowerCase();
        
        case 'CONTAINS':
          return fieldValue && String(fieldValue).toLowerCase().includes(String(filter.value || '').toLowerCase());
        
        case 'NOT_CONTAINS':
          return !fieldValue || !String(fieldValue).toLowerCase().includes(String(filter.value || '').toLowerCase());
        
        case 'STARTS_WITH':
          return fieldValue && String(fieldValue).toLowerCase().startsWith(String(filter.value || '').toLowerCase());
        
        case 'ENDS_WITH':
          return fieldValue && String(fieldValue).toLowerCase().endsWith(String(filter.value || '').toLowerCase());
        
        case 'GREATER_THAN': {
          const filterNum = parseFilterNumber(filter.value);
          if (filterNum === null) return false;
          const numValue = toNumber(fieldValue);
          return numValue !== null && numValue > filterNum;
        }
        
        case 'LESS_THAN': {
          const filterNum = parseFilterNumber(filter.value);
          if (filterNum === null) return false;
          const numValue = toNumber(fieldValue);
          return numValue !== null && numValue < filterNum;
        }
        
        case 'BETWEEN': {
          if (!filter.numberRange) return false;
          const numValue3 = toNumber(fieldValue);
          const min = filter.numberRange.min;
          const max = filter.numberRange.max;
          if (numValue3 === null) return false;
          return (
                 (min === undefined || numValue3 >= min) && 
                 (max === undefined || numValue3 <= max)
          );
        }
        
        case 'DATE_EQUALS': {
          try {
            const fieldDate = new Date(Number(fieldValue) || fieldValue);
            const compareDate = new Date(filter.value || '');
            // Check for invalid dates
            if (isNaN(fieldDate.getTime()) || isNaN(compareDate.getTime())) {
              return false;
            }
            return fieldDate.toDateString() === compareDate.toDateString();
          } catch {
            return false;
          }
        }
        
        case 'DATE_BEFORE': {
          try {
            const fieldDate = new Date(Number(fieldValue) || fieldValue);
            const compareDate = new Date(filter.value || '');
            // Check for invalid dates
            if (isNaN(fieldDate.getTime()) || isNaN(compareDate.getTime())) {
              return false;
            }
            return fieldDate < compareDate;
          } catch {
            return false;
          }
        }

        case 'DATE_AFTER': {
          try {
            const fieldDate = new Date(Number(fieldValue) || fieldValue);
            const compareDate = new Date(filter.value || '');
            // Check for invalid dates
            if (isNaN(fieldDate.getTime()) || isNaN(compareDate.getTime())) {
              return false;
            }
            return fieldDate > compareDate;
          } catch {
            return false;
          }
        }
        
        case 'DATE_BETWEEN': {
          if (!filter.dateRange) return false;
          try {
            const fieldDate = new Date(Number(fieldValue) || fieldValue);
            // Check for invalid field date
            if (isNaN(fieldDate.getTime())) {
              return false;
            }

            const fromDate = filter.dateRange.from ? new Date(filter.dateRange.from) : null;
            const toDate = filter.dateRange.to ? new Date(filter.dateRange.to) : null;

            // Check for invalid range dates
            if ((fromDate && isNaN(fromDate.getTime())) || (toDate && isNaN(toDate.getTime()))) {
              return false;
            }

            return (!fromDate || fieldDate >= fromDate) &&
                   (!toDate || fieldDate <= toDate);
          } catch {
            return false;
          }
        }
        
        case 'IN': {
          // For arrays (checkbox fields), check if any selected value matches
          if (Array.isArray(fieldValue)) {
            return filter.values?.some(value => 
              fieldValue.some(v => String(v).toLowerCase() === String(value).toLowerCase())
            ) ?? false;
          }
          // For strings (select/radio fields)
          return filter.values?.some(value => 
            String(fieldValue).toLowerCase() === String(value).toLowerCase()
          ) ?? false;
        }
        
        case 'NOT_IN': {
          // For arrays (checkbox fields)
          if (Array.isArray(fieldValue)) {
            return !(filter.values?.some(value => 
              fieldValue.some(v => String(v).toLowerCase() === String(value).toLowerCase())
            ) ?? false);
          }
          // For strings (select/radio fields)
          return !(filter.values?.some(value => 
            String(fieldValue).toLowerCase() === String(value).toLowerCase()
          ) ?? false);
        }
        
        case 'CONTAINS_ALL': {
          // Check if array contains ALL of the specified values
          if (!filter.values || filter.values.length === 0) return false;
          if (!Array.isArray(fieldValue)) return false;
          
          const fieldValuesLower = fieldValue.map(v => String(v).toLowerCase());
          return filter.values.every(value => 
            fieldValuesLower.includes(String(value).toLowerCase())
          );
        }
        
        default:
          return true;
      }
    });
  });
}

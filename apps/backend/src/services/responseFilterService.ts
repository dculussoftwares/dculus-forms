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
 * @returns Filtered array of responses that match ALL filter criteria (AND logic)
 */
export function applyResponseFilters(responses: any[], filters?: ResponseFilter[]): any[] {
  if (!filters || filters.length === 0) {
    return responses;
  }

  return responses.filter(response => {
    // All filters must pass (AND logic)
    return filters.every(filter => {
      // Get field value from response data (handles both 'data' and 'responseData' properties)
      const fieldValue = response.responseData?.[filter.fieldId] || response.data?.[filter.fieldId];
      
      switch (filter.operator) {
        case 'IS_EMPTY':
          return !fieldValue || fieldValue === '' || fieldValue === null || fieldValue === undefined;
        
        case 'IS_NOT_EMPTY':
          return fieldValue && fieldValue !== '' && fieldValue !== null && fieldValue !== undefined;
        
        case 'EQUALS':
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
          const numValue = parseFloat(fieldValue);
          const filterNum = parseFloat(filter.value || '0');
          return !isNaN(numValue) && !isNaN(filterNum) && numValue > filterNum;
        }
        
        case 'LESS_THAN': {
          const numValue2 = parseFloat(fieldValue);
          const filterNum2 = parseFloat(filter.value || '0');
          return !isNaN(numValue2) && !isNaN(filterNum2) && numValue2 < filterNum2;
        }
        
        case 'BETWEEN': {
          if (!filter.numberRange) return false;
          const numValue3 = parseFloat(fieldValue);
          const min = filter.numberRange.min;
          const max = filter.numberRange.max;
          return !isNaN(numValue3) && 
                 (min === undefined || numValue3 >= min) && 
                 (max === undefined || numValue3 <= max);
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
        
        case 'IN':
          return filter.values?.some(value => 
            String(fieldValue).toLowerCase() === String(value).toLowerCase()
          ) ?? false;
        
        case 'NOT_IN':
          return !(filter.values?.some(value => 
            String(fieldValue).toLowerCase() === String(value).toLowerCase()
          ) ?? false);
        
        default:
          return true;
      }
    });
  });
}

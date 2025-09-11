import { FormResponse } from '@dculus/types';
import { prisma } from '../lib/prisma.js';

export const getAllResponses = async (organizationId?: string): Promise<FormResponse[]> => {
  const responses = await prisma.response.findMany({
    where: organizationId ? {
      form: {
        organizationId
      }
    } : {},
    orderBy: { submittedAt: 'desc' },
    include: {
      form: true,
    },
  });
  
  return responses.map((response: any) => ({
    id: response.id,
    formId: response.formId,
    data: (response.data as Record<string, any>) || {},
    submittedAt: response.submittedAt,
  }));
};

export const getResponseById = async (id: string): Promise<FormResponse | null> => {
  try {
    const response = await prisma.response.findUnique({
      where: { id },
      include: {
        form: true,
      },
    });
    
    if (!response) return null;
    
    return {
      id: response.id,
      formId: response.formId,
      data: (response.data as Record<string, any>) || {},
      submittedAt: response.submittedAt,
    };
  } catch (error) {
    console.error('Error fetching response by ID:', error);
    return null;
  }
};

interface ResponseFilter {
  fieldId: string;
  operator: string;
  value?: string;
  values?: string[];
  dateRange?: { from?: string; to?: string };
  numberRange?: { min?: number; max?: number };
}

// Helper function to apply filters to responses
const applyFilters = (responses: any[], filters?: ResponseFilter[]): any[] => {
  if (!filters || filters.length === 0) {
    return responses;
  }

  return responses.filter(response => {
    return filters.every(filter => {
      const fieldData = response.data?.[filter.fieldId];
      
      switch (filter.operator) {
        case 'EQUALS':
          return String(fieldData).toLowerCase() === String(filter.value || '').toLowerCase();
        
        case 'NOT_EQUALS':
          return String(fieldData).toLowerCase() !== String(filter.value || '').toLowerCase();
        
        case 'CONTAINS':
          return String(fieldData).toLowerCase().includes(String(filter.value || '').toLowerCase());
        
        case 'NOT_CONTAINS':
          return !String(fieldData).toLowerCase().includes(String(filter.value || '').toLowerCase());
        
        case 'STARTS_WITH':
          return String(fieldData).toLowerCase().startsWith(String(filter.value || '').toLowerCase());
        
        case 'ENDS_WITH':
          return String(fieldData).toLowerCase().endsWith(String(filter.value || '').toLowerCase());
        
        case 'IS_EMPTY':
          return fieldData === null || fieldData === undefined || String(fieldData).trim() === '';
        
        case 'IS_NOT_EMPTY':
          return fieldData !== null && fieldData !== undefined && String(fieldData).trim() !== '';
        
        case 'IN':
          return filter.values?.some(value => 
            String(fieldData).toLowerCase() === String(value).toLowerCase()
          ) ?? false;
        
        case 'NOT_IN':
          return !(filter.values?.some(value => 
            String(fieldData).toLowerCase() === String(value).toLowerCase()
          ) ?? false);
        
        case 'GREATER_THAN':
          const gtNum = Number(fieldData);
          const gtCompare = Number(filter.value);
          return !isNaN(gtNum) && !isNaN(gtCompare) && gtNum > gtCompare;
        
        case 'LESS_THAN':
          const ltNum = Number(fieldData);
          const ltCompare = Number(filter.value);
          return !isNaN(ltNum) && !isNaN(ltCompare) && ltNum < ltCompare;
        
        case 'BETWEEN':
          if (!filter.numberRange) return false;
          const betweenNum = Number(fieldData);
          const minVal = filter.numberRange.min;
          const maxVal = filter.numberRange.max;
          return !isNaN(betweenNum) && 
                 (minVal === undefined || betweenNum >= minVal) && 
                 (maxVal === undefined || betweenNum <= maxVal);
        
        case 'DATE_EQUALS':
          try {
            const fieldDate = new Date(Number(fieldData) || fieldData);
            const compareDate = new Date(filter.value || '');
            return fieldDate.toDateString() === compareDate.toDateString();
          } catch {
            return false;
          }
        
        case 'DATE_BEFORE':
          try {
            const fieldDate = new Date(Number(fieldData) || fieldData);
            const compareDate = new Date(filter.value || '');
            return fieldDate < compareDate;
          } catch {
            return false;
          }
        
        case 'DATE_AFTER':
          try {
            const fieldDate = new Date(Number(fieldData) || fieldData);
            const compareDate = new Date(filter.value || '');
            return fieldDate > compareDate;
          } catch {
            return false;
          }
        
        case 'DATE_BETWEEN':
          if (!filter.dateRange) return false;
          try {
            const fieldDate = new Date(Number(fieldData) || fieldData);
            const fromDate = filter.dateRange.from ? new Date(filter.dateRange.from) : null;
            const toDate = filter.dateRange.to ? new Date(filter.dateRange.to) : null;
            
            return (!fromDate || fieldDate >= fromDate) && 
                   (!toDate || fieldDate <= toDate);
          } catch {
            return false;
          }
        
        default:
          return true;
      }
    });
  });
};

export const getResponsesByFormId = async (
  formId: string, 
  page: number = 1, 
  limit: number = 10,
  sortBy: string = 'submittedAt',
  sortOrder: string = 'desc',
  filters?: ResponseFilter[]
): Promise<{
  data: FormResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> => {
  // Ensure pagination values are valid
  const validPage = Math.max(1, page);
  const validLimit = Math.min(Math.max(1, limit), 100); // Cap at 100 items per page
  const skip = (validPage - 1) * validLimit;

  // Validate and prepare sorting
  const allowedSortFields = ['id', 'submittedAt'];
  const validSortOrder = ['asc', 'desc'].includes(sortOrder.toLowerCase()) ? sortOrder.toLowerCase() : 'desc';
  
  // Check if sorting by a form field (starts with 'data.')
  const isFormFieldSort = sortBy.startsWith('data.');
  let validSortBy = sortBy;
  
  if (!isFormFieldSort && !allowedSortFields.includes(sortBy)) {
    validSortBy = 'submittedAt';
  }

  // When filters are applied or form field sorting is needed, we need to load all responses
  // to apply filters and sort in memory
  const needsMemoryProcessing = filters && filters.length > 0 || isFormFieldSort;
  
  let allResponses;
  let filteredResponses;
  let responses;
  let total;
  
  if (needsMemoryProcessing) {
    // Get all responses for filtering/sorting in memory
    allResponses = await prisma.response.findMany({
      where: { formId },
    });
    
    // Apply filters first
    filteredResponses = applyFilters(allResponses, filters);
    total = filteredResponses.length;
    
    // Apply sorting
    if (isFormFieldSort) {
      const fieldId = validSortBy.replace('data.', '');
      
      filteredResponses.sort((a, b) => {
        const aValue = (a.data as any)?.[fieldId];
        const bValue = (b.data as any)?.[fieldId];
        
        // Handle null/undefined values
        if (aValue == null && bValue == null) return 0;
        if (aValue == null) return validSortOrder === 'asc' ? -1 : 1;
        if (bValue == null) return validSortOrder === 'asc' ? 1 : -1;
        
        // Convert to strings for comparison
        const aStr = String(aValue).toLowerCase();
        const bStr = String(bValue).toLowerCase();
        
        let comparison = 0;
        if (aStr < bStr) comparison = -1;
        if (aStr > bStr) comparison = 1;
        
        return validSortOrder === 'asc' ? comparison : -comparison;
      });
    } else {
      // Sort by regular fields
      filteredResponses.sort((a, b) => {
        let aValue, bValue;
        
        if (validSortBy === 'submittedAt') {
          aValue = new Date(a.submittedAt).getTime();
          bValue = new Date(b.submittedAt).getTime();
        } else {
          aValue = a[validSortBy];
          bValue = b[validSortBy];
        }
        
        if (aValue < bValue) return validSortOrder === 'asc' ? -1 : 1;
        if (aValue > bValue) return validSortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    // Apply pagination
    responses = filteredResponses.slice(skip, skip + validLimit);
    
  } else {
    // No filters and regular sorting - use database query for better performance
    total = await prisma.response.count({
      where: { formId },
    });
    
    responses = await prisma.response.findMany({
      where: { formId },
      orderBy: { [validSortBy]: validSortOrder },
      skip,
      take: validLimit,
    });
  }
  
  const data = responses.map((response: any) => ({
    id: response.id,
    formId: response.formId,
    data: (response.data as Record<string, any>) || {},
    submittedAt: response.submittedAt,
  }));

  const totalPages = Math.ceil(total / validLimit);

  return {
    data,
    total,
    page: validPage,
    limit: validLimit,
    totalPages,
  };
};

export const getAllResponsesByFormId = async (formId: string): Promise<FormResponse[]> => {
  try {
    console.log(`Fetching ALL responses for form: ${formId}`);
    
    const responses = await prisma.response.findMany({
      where: { formId },
      orderBy: { submittedAt: 'desc' },
    });
    
    console.log(`Found ${responses.length} total responses for form: ${formId}`);
    
    return responses.map((response: any) => ({
      id: response.id,
      formId: response.formId,
      data: (response.data as Record<string, any>) || {},
      submittedAt: response.submittedAt,
    }));
  } catch (error) {
    console.error('Error fetching all responses by form ID:', error);
    throw new Error(`Failed to fetch responses: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export const submitResponse = async (responseData: Partial<FormResponse>): Promise<FormResponse> => {
  const { generateId } = await import('@dculus/utils');
  const newResponse = await prisma.response.create({
    data: {
      id: generateId(),
      formId: responseData.formId!,
      data: responseData.data || {},
    },
  });

  return {
    id: newResponse.id,
    formId: newResponse.formId,
    data: (newResponse.data as Record<string, any>) || {},
    submittedAt: newResponse.submittedAt,
  };
};

export const deleteResponse = async (id: string): Promise<boolean> => {
  try {
    await prisma.response.delete({
      where: { id },
    });
    return true;
  } catch (error) {
    console.error('Error deleting response:', error);
    return false;
  }
}; 
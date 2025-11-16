import { FormResponse } from '@dculus/types';
import { ResponseFilter, applyResponseFilters } from './responseFilterService.js';
import { 
  buildMongoDBFilter, 
  canFilterAtDatabase, 
  getMemoryOnlyFilters 
} from './responseQueryBuilder.js';
import { responseRepository } from '../repositories/index.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';

export const getAllResponses = async (organizationId?: string): Promise<FormResponse[]> => {
  const responses = await responseRepository.findMany({
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
    metadata: (response.metadata as any) || undefined,
    submittedAt: response.submittedAt,
  }));
};

export const getResponseById = async (id: string): Promise<FormResponse | null> => {
  try {
    const response = await responseRepository.findUnique({
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
      metadata: (response.metadata as any) || undefined,
      submittedAt: response.submittedAt,
    };
  } catch (error) {
    logger.error('Error fetching response by ID:', error);
    return null;
  }
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

  // Determine filtering strategy
  const hasFilters = filters && filters.length > 0;
  const memoryOnlyFilters = hasFilters ? getMemoryOnlyFilters(filters) : [];
  const needsMemoryProcessing = isFormFieldSort || memoryOnlyFilters.length > 0;

  let responses;
  let total;

  if (hasFilters && !needsMemoryProcessing && canFilterAtDatabase(filters)) {
    // OPTIMIZED PATH: Use database-level filtering with raw MongoDB query
    logger.info(`Using database-level filtering for ${filters?.length || 0} filters`);
    
    try {
      // Build MongoDB filter
      const mongoFilter = buildMongoDBFilter(formId, filters);
      
      // Count total matching documents
      const countResults = await prisma.response.aggregateRaw({
        pipeline: [
          { $match: mongoFilter },
          { $count: 'total' },
        ],
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      total = (countResults as any)[0]?.total || 0;

      // Apply sorting at database level
      const sortField = validSortBy;
      const sortDirection = validSortOrder === 'asc' ? 1 : -1;

      const sortedResults = await prisma.response.findRaw({
        filter: mongoFilter,
        options: {
          sort: { [sortField]: sortDirection },
          skip: skip,
          limit: validLimit,
        },
      });

      // Convert raw MongoDB results to typed responses
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      responses = (sortedResults as unknown as any[]).map((doc: any) => {
        // Handle MongoDB BSON Date objects and ISO strings
        let submittedAt: Date;
        if (doc.submittedAt instanceof Date) {
          submittedAt = doc.submittedAt;
        } else if (doc.submittedAt?.$date) {
          // MongoDB extended JSON format
          submittedAt = new Date(doc.submittedAt.$date);
        } else if (typeof doc.submittedAt === 'string' || typeof doc.submittedAt === 'number') {
          submittedAt = new Date(doc.submittedAt);
        } else {
          submittedAt = new Date(); // Fallback to current date
        }

        return {
          id: doc._id,
          formId: doc.formId,
          data: doc.data || {},
          metadata: doc.metadata,
          submittedAt,
        };
      });

    } catch (error) {
      logger.error('Database filtering failed, falling back to memory filtering:', error);
      // Fallback to memory processing
      const allResponses = await responseRepository.listByForm(formId);
      const filteredResponses = applyResponseFilters(allResponses, filters);
      total = filteredResponses.length;
      responses = filteredResponses.slice(skip, skip + validLimit);
    }

  } else if (needsMemoryProcessing || (hasFilters && memoryOnlyFilters.length > 0)) {
    // HYBRID PATH: Get all responses and apply memory filtering
    logger.info(`Using memory filtering for ${filters?.length || 0} filters (${memoryOnlyFilters.length} complex)`);
    
    const allResponses = await responseRepository.listByForm(formId);
    const filteredResponses = applyResponseFilters(allResponses, filters);
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
    total = await responseRepository.count({
      where: { formId },
    });
    
    responses = await responseRepository.findMany({
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
    metadata: (response.metadata as any) || undefined,
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
    logger.info(`Fetching ALL responses for form: ${formId}`);
    
    const responses = await responseRepository.listByForm(formId);
    
    logger.info(`Found ${responses.length} total responses for form: ${formId}`);
    
    return responses.map((response: any) => ({
      id: response.id,
      formId: response.formId,
      data: (response.data as Record<string, any>) || {},
      metadata: response.metadata,
      submittedAt: response.submittedAt,
    }));
  } catch (error) {
    logger.error('Error fetching all responses by form ID:', error);
    throw new Error(`Failed to fetch responses: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export const submitResponse = async (responseData: Partial<FormResponse>): Promise<FormResponse> => {
  const { generateId } = await import('@dculus/utils');
  const newResponse = await responseRepository.create({
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
    metadata: (newResponse.metadata as any) || undefined,
    submittedAt: newResponse.submittedAt,
  };
};

export const updateResponse = async (
  responseId: string,
  data: Record<string, any>,
  editContext?: {
    userId: string;
    ipAddress?: string;
    userAgent?: string;
    editReason?: string;
  }
): Promise<FormResponse> => {
  logger.info('updateResponse called with:', { responseId, hasEditContext: !!editContext, editContext });
  // Debug logging

  try {
    // If edit tracking context is provided, we need to track the edit
    if (editContext) {
      logger.info('Edit tracking mode - creating snapshot and recording edit');
      const { ResponseEditTrackingService } = await import('./responseEditTrackingService.js');

      // Get the current response and form schema for change detection
      const { response: currentResponse, formSchema } = await ResponseEditTrackingService.getResponseWithFormSchema(responseId);
      const oldData = currentResponse.data as Record<string, any>;

      // Update the response
      const updatedResponse = await responseRepository.update({
        where: { id: responseId },
        data: { data: data },
      });

      // Record the edit with field-level changes
      await ResponseEditTrackingService.recordEdit(
        responseId,
        oldData,
        data,
        formSchema,
        {
          userId: editContext.userId,
          ipAddress: editContext.ipAddress,
          userAgent: editContext.userAgent,
          editType: 'MANUAL',
          editReason: editContext.editReason
        }
      );

      return {
        id: updatedResponse.id,
        formId: updatedResponse.formId,
        data: (updatedResponse.data as Record<string, any>) || {},
        metadata: (updatedResponse.metadata as any) || undefined,
        submittedAt: updatedResponse.submittedAt,
      };
    } else {
      // Legacy mode - just update without tracking
      const updatedResponse = await responseRepository.update({
        where: { id: responseId },
        data: { data: data },
      });

      return {
        id: updatedResponse.id,
        formId: updatedResponse.formId,
        data: (updatedResponse.data as Record<string, any>) || {},
        metadata: (updatedResponse.metadata as any) || undefined,
        submittedAt: updatedResponse.submittedAt,
      };
    }
  } catch (error) {
    logger.error('Error updating response:', error);
    throw new Error(`Failed to update response: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export const deleteResponse = async (id: string): Promise<boolean> => {
  try {
    await responseRepository.delete({
      where: { id },
    });
    return true;
  } catch (error) {
    logger.error('Error deleting response:', error);
    return false;
  }
}; 

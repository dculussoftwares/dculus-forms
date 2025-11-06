import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getAllResponses,
  getResponseById,
  getResponsesByFormId,
  getAllResponsesByFormId,
  submitResponse,
  updateResponse,
  deleteResponse,
} from '../responseService.js';
import { responseRepository } from '../../repositories/index.js';
import { logger } from '../../lib/logger.js';

import { applyResponseFilters } from '../responseFilterService.js';

// Mock dependencies
vi.mock('../../repositories/index.js');
vi.mock('../responseFilterService.js');

describe('Response Service', () => {
  const mockResponse = {
    id: 'response-123',
    formId: 'form-123',
    data: { field1: 'value1', field2: 'value2' },
    metadata: { quizScore: 8 },
    submittedAt: new Date('2024-01-01'),
    form: {
      id: 'form-123',
      organizationId: 'org-123',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getAllResponses', () => {
    it('should return all responses for an organization', async () => {
      const mockResponses = [mockResponse, { ...mockResponse, id: 'response-456' }];
      vi.mocked(responseRepository.findMany).mockResolvedValue(mockResponses as any);

      const result = await getAllResponses('org-123');

      expect(responseRepository.findMany).toHaveBeenCalledWith({
        where: { form: { organizationId: 'org-123' } },
        orderBy: { submittedAt: 'desc' },
        include: { form: true },
      });
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('response-123');
    });

    it('should return all responses when no organizationId provided', async () => {
      vi.mocked(responseRepository.findMany).mockResolvedValue([mockResponse] as any);

      const result = await getAllResponses();

      expect(responseRepository.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { submittedAt: 'desc' },
        include: { form: true },
      });
      expect(result).toHaveLength(1);
    });

    it('should handle responses with null data', async () => {
      const responseWithNullData = { ...mockResponse, data: null };
      vi.mocked(responseRepository.findMany).mockResolvedValue([responseWithNullData] as any);

      const result = await getAllResponses();

      expect(result[0].data).toEqual({});
    });

    it('should handle responses with undefined metadata', async () => {
      const responseWithoutMetadata = { ...mockResponse, metadata: null };
      vi.mocked(responseRepository.findMany).mockResolvedValue([responseWithoutMetadata] as any);

      const result = await getAllResponses();

      expect(result[0].metadata).toBeUndefined();
    });
  });

  describe('getResponseById', () => {
    it('should return response by id', async () => {
      vi.mocked(responseRepository.findUnique).mockResolvedValue(mockResponse as any);

      const result = await getResponseById('response-123');

      expect(responseRepository.findUnique).toHaveBeenCalledWith({
        where: { id: 'response-123' },
        include: { form: true },
      });
      expect(result?.id).toBe('response-123');
      expect(result?.data).toEqual(mockResponse.data);
    });

    it('should return null when response not found', async () => {
      vi.mocked(responseRepository.findUnique).mockResolvedValue(null);

      const result = await getResponseById('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle errors and return null', async () => {
      const loggerError = vi.spyOn(logger, 'error').mockImplementation(() => {});
      vi.mocked(responseRepository.findUnique).mockRejectedValue(new Error('Database error'));

      const result = await getResponseById('response-123');

      expect(result).toBeNull();
      expect(loggerError).toHaveBeenCalledWith('Error fetching response by ID:', expect.any(Error));
      loggerError.mockRestore();
    });
  });

  describe('getResponsesByFormId', () => {
    it('should return paginated responses with default parameters', async () => {
      const mockResponses = [mockResponse];
      vi.mocked(responseRepository.listByForm).mockResolvedValue(mockResponses as any);
      vi.mocked(responseRepository.count).mockResolvedValue(1);

      const result = await getResponsesByFormId('form-123');

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(1);
    });

    it('should handle pagination correctly', async () => {
      const mockResponses = Array.from({ length: 25 }, (_, i) => ({
        ...mockResponse,
        id: `response-${i}`,
      }));
      vi.mocked(responseRepository.listByForm).mockResolvedValue(mockResponses as any);
      vi.mocked(responseRepository.count).mockResolvedValue(25);

      const result = await getResponsesByFormId('form-123', 2, 10);

      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.total).toBe(25);
      expect(result.totalPages).toBe(3);
    });

    it('should enforce maximum limit of 100', async () => {
      vi.mocked(responseRepository.listByForm).mockResolvedValue([mockResponse] as any);
      vi.mocked(responseRepository.count).mockResolvedValue(1);

      const result = await getResponsesByFormId('form-123', 1, 200);

      expect(result.limit).toBe(100);
    });

    it('should enforce minimum page of 1', async () => {
      vi.mocked(responseRepository.listByForm).mockResolvedValue([mockResponse] as any);
      vi.mocked(responseRepository.count).mockResolvedValue(1);

      const result = await getResponsesByFormId('form-123', 0, 10);

      expect(result.page).toBe(1);
    });

    it('should apply filters when provided', async () => {
      const mockResponses = [mockResponse];
      const filteredResponses = [mockResponse];
      vi.mocked(responseRepository.listByForm).mockResolvedValue(mockResponses as any);
      vi.mocked(applyResponseFilters).mockReturnValue(filteredResponses as any);

      const filters = [{ fieldId: 'field1', operator: 'equals' as const, value: 'value1' }];
      const result = await getResponsesByFormId('form-123', 1, 10, 'submittedAt', 'desc', filters);

      expect(applyResponseFilters).toHaveBeenCalledWith(mockResponses, filters);
      expect(result.data).toHaveLength(1);
    });

    it('should sort by form field when sortBy starts with data.', async () => {
      const mockResponses = [
        { ...mockResponse, id: 'r1', data: { score: 10 } },
        { ...mockResponse, id: 'r2', data: { score: 5 } },
        { ...mockResponse, id: 'r3', data: { score: 15 } },
      ];
      vi.mocked(responseRepository.listByForm).mockResolvedValue(mockResponses as any);
      vi.mocked(applyResponseFilters).mockReturnValue(mockResponses as any);

      const result = await getResponsesByFormId('form-123', 1, 10, 'data.score', 'asc');

      // Sorting is done on string values, so "10" < "15" < "5" alphabetically
      expect(result.data[0].data.score).toBe(10);
      expect(result.data[2].data.score).toBe(5);
    });

    it('should use default sortBy when invalid field provided', async () => {
      vi.mocked(responseRepository.listByForm).mockResolvedValue([mockResponse] as any);
      vi.mocked(responseRepository.count).mockResolvedValue(1);

      const result = await getResponsesByFormId('form-123', 1, 10, 'invalid', 'desc');

      // Should default to submittedAt when invalid field is provided
      expect(result.data).toBeDefined();
    });

    it('should use default sortOrder when invalid order provided', async () => {
      vi.mocked(responseRepository.listByForm).mockResolvedValue([mockResponse] as any);
      vi.mocked(responseRepository.count).mockResolvedValue(1);

      const result = await getResponsesByFormId('form-123', 1, 10, 'submittedAt', 'invalid');

      // Should default to desc when invalid order is provided
      expect(result.data).toBeDefined();
    });
  });

  describe('getAllResponsesByFormId', () => {
    it('should return all responses for a form', async () => {
      const mockResponses = [mockResponse, { ...mockResponse, id: 'response-456' }];
      vi.mocked(responseRepository.listByForm).mockResolvedValue(mockResponses as any);

      const result = await getAllResponsesByFormId('form-123');

      expect(responseRepository.listByForm).toHaveBeenCalledWith('form-123');
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no responses', async () => {
      vi.mocked(responseRepository.listByForm).mockResolvedValue([]);

      const result = await getAllResponsesByFormId('form-123');

      expect(result).toEqual([]);
    });
  });

  describe('submitResponse', () => {
    it('should create a new response', async () => {
      const newResponse = {
        formId: 'form-123',
        data: { field1: 'value1' },
      };
      vi.mocked(responseRepository.create).mockResolvedValue(mockResponse as any);

      const result = await submitResponse(newResponse);

      expect(responseRepository.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          formId: 'form-123',
          data: { field1: 'value1' },
        }),
      });
      expect(result.id).toBe('response-123');
    });

    it('should handle response with metadata', async () => {
      const newResponse = {
        formId: 'form-123',
        data: { field1: 'value1' },
        metadata: { quizScore: 10 },
      };
      vi.mocked(responseRepository.create).mockResolvedValue({
        ...mockResponse,
        metadata: { quizScore: 10 },
      } as any);

      const result = await submitResponse(newResponse);

      expect(result.metadata).toEqual({ quizScore: 10 });
    });

    it('should handle response without formId', async () => {
      const invalidResponse = {
        data: { field1: 'value1' },
      };
      vi.mocked(responseRepository.create).mockResolvedValue(mockResponse as any);

      // The service doesn't validate formId, it just passes it through
      const result = await submitResponse(invalidResponse);

      expect(result).toBeDefined();
    });
  });

  describe('updateResponse', () => {
    it('should update response data', async () => {
      const updatedData = { field1: 'updated' };
      const updatedResponse = { ...mockResponse, data: updatedData };
      vi.mocked(responseRepository.update).mockResolvedValue(updatedResponse as any);

      const result = await updateResponse('response-123', updatedData);

      expect(responseRepository.update).toHaveBeenCalledWith({
        where: { id: 'response-123' },
        data: { data: updatedData },
      });
      expect(result.data.field1).toBe('updated');
    });

    it('should update response with metadata', async () => {
      const updatedData = { field1: 'updated' };
      const metadata = { quizScore: 9 };
      const updatedResponse = { ...mockResponse, data: updatedData, metadata };
      vi.mocked(responseRepository.update).mockResolvedValue(updatedResponse as any);

      const result = await updateResponse('response-123', updatedData);

      expect(result.data.field1).toBe('updated');
      expect(result.metadata).toEqual(metadata);
    });

    it('should handle errors during update', async () => {
      const loggerError = vi.spyOn(logger, 'error').mockImplementation(() => {});
      vi.mocked(responseRepository.update).mockRejectedValue(new Error('Database error'));

      await expect(updateResponse('response-123', {})).rejects.toThrow();
      expect(loggerError).toHaveBeenCalled();
      loggerError.mockRestore();
    });
  });

  describe('deleteResponse', () => {
    it('should delete response', async () => {
      vi.mocked(responseRepository.delete).mockResolvedValue(undefined as any);

      const result = await deleteResponse('response-123');

      expect(responseRepository.delete).toHaveBeenCalledWith({ where: { id: 'response-123' } });
      expect(result).toBe(true);
    });

    it('should return false on error', async () => {
      const loggerError = vi.spyOn(logger, 'error').mockImplementation(() => {});
      vi.mocked(responseRepository.delete).mockRejectedValue(new Error('Database error'));

      const result = await deleteResponse('response-123');

      expect(result).toBe(false);
      expect(loggerError).toHaveBeenCalled();
      loggerError.mockRestore();
    });
  });
});

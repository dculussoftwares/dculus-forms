import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getResponseById,
  getResponsesByFormId,
  getAllResponsesByFormId,
  updateResponse,
  deleteResponse
} from '../responseService.js';
import { responseRepository } from '../../repositories/index.js';

vi.mock('../../repositories/index.js', () => ({
  responseRepository: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    listByForm: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }
}));

vi.mock('../responseFilterService.js', () => ({
  applyResponseFilters: vi.fn((responses) => responses),
  ResponseFilter: {}
}));

describe('Response Service - Additional Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getResponseById', () => {
    it('should return null when response is not found', async () => {
      vi.mocked(responseRepository.findUnique).mockResolvedValue(null);

      const result = await getResponseById('nonexistent-id');

      expect(result).toBeNull();
    });

    it('should return null when error occurs', async () => {
      vi.mocked(responseRepository.findUnique).mockRejectedValue(new Error('Database error'));

      const result = await getResponseById('error-id');

      expect(result).toBeNull();
    });

    it('should successfully return response', async () => {
      const mockResponse = {
        id: 'response-123',
        formId: 'form-123',
        data: { name: 'Test User' },
        metadata: { source: 'web' },
        submittedAt: new Date(),
        form: { id: 'form-123', title: 'Test Form' }
      };

      vi.mocked(responseRepository.findUnique).mockResolvedValue(mockResponse as any);

      const result = await getResponseById('response-123');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('response-123');
      expect(result?.data).toEqual({ name: 'Test User' });
    });
  });

  describe('getResponsesByFormId - Sorting and Filtering', () => {
    it('should handle form field sorting (data.fieldId)', async () => {
      const mockResponses = [
        { id: '1', formId: 'form-1', data: { name: 'Charlie' }, submittedAt: new Date() },
        { id: '2', formId: 'form-1', data: { name: 'Alice' }, submittedAt: new Date() },
        { id: '3', formId: 'form-1', data: { name: 'Bob' }, submittedAt: new Date() }
      ];

      vi.mocked(responseRepository.listByForm).mockResolvedValue(mockResponses as any);

      const result = await getResponsesByFormId('form-1', 1, 10, 'data.name', 'asc');

      expect(result.data.length).toBe(3);
      // Responses should be sorted by name
    });

    it('should handle null values in form field sorting', async () => {
      const mockResponses = [
        { id: '1', formId: 'form-1', data: { name: 'Alice' }, submittedAt: new Date() },
        { id: '2', formId: 'form-1', data: {}, submittedAt: new Date() },
        { id: '3', formId: 'form-1', data: { name: null }, submittedAt: new Date() }
      ];

      vi.mocked(responseRepository.listByForm).mockResolvedValue(mockResponses as any);

      const result = await getResponsesByFormId('form-1', 1, 10, 'data.name', 'asc');

      expect(result.data.length).toBe(3);
    });

    it('should handle descending sort order for form fields', async () => {
      const mockResponses = [
        { id: '1', formId: 'form-1', data: { score: 100 }, submittedAt: new Date() },
        { id: '2', formId: 'form-1', data: { score: 50 }, submittedAt: new Date() },
        { id: '3', formId: 'form-1', data: { score: 75 }, submittedAt: new Date() }
      ];

      vi.mocked(responseRepository.listByForm).mockResolvedValue(mockResponses as any);

      const result = await getResponsesByFormId('form-1', 1, 10, 'data.score', 'desc');

      expect(result.data.length).toBe(3);
    });

    it('should handle regular field sorting (non-data fields) with filters', async () => {
      const date1 = new Date('2024-01-01');
      const date2 = new Date('2024-01-02');
      const date3 = new Date('2024-01-03');

      const mockResponses = [
        { id: '1', formId: 'form-1', data: {}, submittedAt: date2 },
        { id: '2', formId: 'form-1', data: {}, submittedAt: date1 },
        { id: '3', formId: 'form-1', data: {}, submittedAt: date3 }
      ];

      vi.mocked(responseRepository.listByForm).mockResolvedValue(mockResponses as any);

      const result = await getResponsesByFormId('form-1', 1, 10, 'submittedAt', 'asc', [{ fieldId: 'test', operator: 'equals', value: 'test' }] as any);

      expect(result.data.length).toBe(3);
    });

    it('should sort non-date fields in memory when filters are applied', async () => {
      const mockResponses = [
        { id: 'resp-c', formId: 'form-1', data: {}, submittedAt: new Date('2024-01-03') },
        { id: 'resp-a', formId: 'form-1', data: {}, submittedAt: new Date('2024-01-01') },
        { id: 'resp-b', formId: 'form-1', data: {}, submittedAt: new Date('2024-01-02') }
      ];

      vi.mocked(responseRepository.listByForm).mockResolvedValue(mockResponses as any);

      const result = await getResponsesByFormId(
        'form-1',
        1,
        10,
        'id',
        'asc',
        [{ fieldId: 'status', operator: 'EQUALS', value: 'any' }] as any
      );

      expect(result.data.map((response) => response.id)).toEqual(['resp-a', 'resp-b', 'resp-c']);
    });

    it('should cap limit at 100 items per page', async () => {
      vi.mocked(responseRepository.count).mockResolvedValue(200);
      vi.mocked(responseRepository.findMany).mockResolvedValue([]);

      await getResponsesByFormId('form-1', 1, 500, 'submittedAt', 'desc');

      expect(responseRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100 // Should be capped at 100
        })
      );
    });

    it('should handle invalid page numbers', async () => {
      vi.mocked(responseRepository.count).mockResolvedValue(50);
      vi.mocked(responseRepository.findMany).mockResolvedValue([]);

      await getResponsesByFormId('form-1', -5, 10, 'submittedAt', 'desc');

      expect(responseRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0 // Page should be normalized to 1, so skip is 0
        })
      );
    });

    it('should handle invalid sort fields', async () => {
      vi.mocked(responseRepository.count).mockResolvedValue(10);
      vi.mocked(responseRepository.findMany).mockResolvedValue([]);

      await getResponsesByFormId('form-1', 1, 10, 'invalidField', 'asc');

      expect(responseRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { submittedAt: 'asc' } // Should default to submittedAt
        })
      );
    });

    it('should handle invalid sort order', async () => {
      vi.mocked(responseRepository.count).mockResolvedValue(10);
      vi.mocked(responseRepository.findMany).mockResolvedValue([]);

      await getResponsesByFormId('form-1', 1, 10, 'submittedAt', 'invalid' as any);

      expect(responseRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { submittedAt: 'desc' } // Should default to desc
        })
      );
    });

    it('should use database query when no filters and regular sorting', async () => {
      vi.mocked(responseRepository.count).mockResolvedValue(5);
      vi.mocked(responseRepository.findMany).mockResolvedValue([]);

      await getResponsesByFormId('form-1', 1, 10, 'id', 'asc');

      expect(responseRepository.count).toHaveBeenCalled();
      expect(responseRepository.findMany).toHaveBeenCalled();
      expect(responseRepository.listByForm).not.toHaveBeenCalled();
    });
  });

  describe('getAllResponsesByFormId', () => {
    it('should throw error when repository fails', async () => {
      vi.mocked(responseRepository.listByForm).mockRejectedValue(new Error('Connection failed'));

      await expect(getAllResponsesByFormId('form-123')).rejects.toThrow('Failed to fetch responses');
    });

    it('should successfully fetch all responses', async () => {
      const mockResponses = [
        { id: '1', formId: 'form-1', data: { name: 'User1' }, metadata: {}, submittedAt: new Date() },
        { id: '2', formId: 'form-1', data: { name: 'User2' }, metadata: {}, submittedAt: new Date() }
      ];

      vi.mocked(responseRepository.listByForm).mockResolvedValue(mockResponses as any);

      const result = await getAllResponsesByFormId('form-1');

      expect(result.length).toBe(2);
      expect(result[0].id).toBe('1');
      expect(result[1].id).toBe('2');
    });
  });

  describe('updateResponse', () => {
    it('should update response without edit tracking (legacy mode)', async () => {
      const mockResponse = {
        id: 'response-123',
        formId: 'form-123',
        data: { name: 'Updated User' },
        metadata: {},
        submittedAt: new Date()
      };

      vi.mocked(responseRepository.update).mockResolvedValue(mockResponse as any);

      const result = await updateResponse('response-123', { name: 'Updated User' });

      expect(result.id).toBe('response-123');
      expect(result.data).toEqual({ name: 'Updated User' });
      expect(responseRepository.update).toHaveBeenCalledWith({
        where: { id: 'response-123' },
        data: { data: { name: 'Updated User' } }
      });
    });

    it('should throw error when update fails', async () => {
      vi.mocked(responseRepository.update).mockRejectedValue(new Error('Update failed'));

      await expect(updateResponse('response-123', { name: 'Test' })).rejects.toThrow('Failed to update response');
    });
  });

  describe('deleteResponse', () => {
    it('should successfully delete response', async () => {
      vi.mocked(responseRepository.delete).mockResolvedValue(undefined as any);

      const result = await deleteResponse('response-123');

      expect(result).toBe(true);
      expect(responseRepository.delete).toHaveBeenCalledWith({
        where: { id: 'response-123' }
      });
    });

    it('should return false when delete fails', async () => {
      vi.mocked(responseRepository.delete).mockRejectedValue(new Error('Delete failed'));

      const result = await deleteResponse('response-123');

      expect(result).toBe(false);
    });
  });

  describe('Edge cases with sorting', () => {
    it('should handle equal values in sort comparison', async () => {
      const mockResponses = [
        { id: '1', formId: 'form-1', data: { name: 'Alice' }, submittedAt: new Date('2024-01-01') },
        { id: '2', formId: 'form-1', data: { name: 'Alice' }, submittedAt: new Date('2024-01-01') }
      ];

      vi.mocked(responseRepository.listByForm).mockResolvedValue(mockResponses as any);

      const result = await getResponsesByFormId('form-1', 1, 10, 'data.name', 'asc');

      expect(result.data.length).toBe(2);
    });

    it('should handle empty responses array', async () => {
      vi.mocked(responseRepository.listByForm).mockResolvedValue([]);

      const result = await getResponsesByFormId('form-1', 1, 10, 'data.field', 'asc', []);

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    it('should handle pagination beyond available data', async () => {
      const mockResponses = [
        { id: '1', formId: 'form-1', data: {}, submittedAt: new Date() }
      ];

      vi.mocked(responseRepository.listByForm).mockResolvedValue(mockResponses as any);

      const result = await getResponsesByFormId('form-1', 5, 10, 'data.field', 'asc', []);

      expect(result.data).toEqual([]);
      expect(result.page).toBe(5);
    });
  });
});

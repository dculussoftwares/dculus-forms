import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createResponseRepository } from '../responseRepository.js';

describe('Response Repository', () => {
  const mockPrisma = {
    response: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    responseEditHistory: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    responseFieldChange: {
      create: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $queryRawUnsafe: vi.fn(),
  };

  const mockContext = { prisma: mockPrisma as any };
  let responseRepository: ReturnType<typeof createResponseRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    responseRepository = createResponseRepository(mockContext);
  });

  describe('findMany', () => {
    it('should find many responses', async () => {
      const mockResponses = [
        { id: 'response-1', formId: 'form-123' },
        { id: 'response-2', formId: 'form-123' },
      ];

      mockPrisma.response.findMany.mockResolvedValue(mockResponses as any);

      const result = await responseRepository.findMany({
        where: { formId: 'form-123' },
      });

      expect(result).toEqual(mockResponses);
      expect(mockPrisma.response.findMany).toHaveBeenCalledWith({
        where: { formId: 'form-123' },
      });
    });
  });

  describe('findUnique', () => {
    it('should find unique response', async () => {
      const mockResponse = { id: 'response-123', formId: 'form-123' };

      mockPrisma.response.findUnique.mockResolvedValue(mockResponse as any);

      const result = await responseRepository.findUnique({
        where: { id: 'response-123' },
      });

      expect(result).toEqual(mockResponse);
    });
  });

  describe('count', () => {
    it('should count responses', async () => {
      mockPrisma.response.count.mockResolvedValue(42);

      const result = await responseRepository.count({
        where: { formId: 'form-123' },
      });

      expect(result).toBe(42);
      expect(mockPrisma.response.count).toHaveBeenCalledWith({
        where: { formId: 'form-123' },
      });
    });
  });

  describe('create', () => {
    it('should create a response', async () => {
      const responseData = {
        id: 'response-123',
        formId: 'form-123',
        data: { field1: 'value1' },
      };

      mockPrisma.response.create.mockResolvedValue(responseData as any);

      const result = await responseRepository.create({
        data: responseData,
      });

      expect(result).toEqual(responseData);
      expect(mockPrisma.response.create).toHaveBeenCalledWith({
        data: responseData,
      });
    });
  });

  describe('update', () => {
    it('should update a response', async () => {
      const updatedResponse = {
        id: 'response-123',
        data: { field1: 'updated' },
      };

      mockPrisma.response.update.mockResolvedValue(updatedResponse as any);

      const result = await responseRepository.update({
        where: { id: 'response-123' },
        data: { data: { field1: 'updated' } },
      });

      expect(result).toEqual(updatedResponse);
    });
  });

  describe('delete', () => {
    it('should delete a response', async () => {
      mockPrisma.response.delete.mockResolvedValue({} as any);

      const result = await responseRepository.delete({
        where: { id: 'response-123' },
      });

      expect(result).toBeDefined();
      expect(mockPrisma.response.delete).toHaveBeenCalledWith({
        where: { id: 'response-123' },
      });
    });
  });

  describe('createEditHistory', () => {
    it('should create edit history', async () => {
      const editHistoryData = {
        id: 'edit-123',
        responseId: 'response-123',
        editedById: 'user-123',
        editedAt: new Date(),
      };

      mockPrisma.responseEditHistory.create.mockResolvedValue(editHistoryData as any);

      const result = await responseRepository.createEditHistory({
        data: editHistoryData,
      });

      expect(result).toEqual(editHistoryData);
    });
  });

  describe('findEditHistory', () => {
    it('should find edit history', async () => {
      const mockHistory = [
        { id: 'edit-1', responseId: 'response-123' },
        { id: 'edit-2', responseId: 'response-123' },
      ];

      mockPrisma.responseEditHistory.findMany.mockResolvedValue(mockHistory as any);

      const result = await responseRepository.findEditHistory({
        where: { responseId: 'response-123' },
      });

      expect(result).toEqual(mockHistory);
    });
  });

  describe('createFieldChange', () => {
    it('should create field change', async () => {
      const fieldChangeData = {
        id: 'change-123',
        editHistoryId: 'edit-123',
        fieldId: 'field-1',
        fieldLabel: 'Field Label',
        fieldType: 'text',
        changeType: 'update',
        oldValue: 'old',
        newValue: 'new',
      };

      mockPrisma.responseFieldChange.create.mockResolvedValue(fieldChangeData as any);

      const result = await responseRepository.createFieldChange({
        data: fieldChangeData,
      });

      expect(result).toEqual(fieldChangeData);
    });
  });

  describe('listByForm', () => {
    it('should list all responses for a form', async () => {
      const mockResponses = [
        { id: 'response-1', formId: 'form-123', submittedAt: new Date('2024-01-02') },
        { id: 'response-2', formId: 'form-123', submittedAt: new Date('2024-01-01') },
      ];

      mockPrisma.response.findMany.mockResolvedValue(mockResponses as any);

      const result = await responseRepository.listByForm('form-123');

      expect(result).toEqual(mockResponses);
      expect(mockPrisma.response.findMany).toHaveBeenCalledWith({
        where: { formId: 'form-123', deletedAt: null },
        orderBy: { submittedAt: 'desc' },
      });
    });
  });

  describe('updateMany', () => {
    it('should update many responses', async () => {
      mockPrisma.response.updateMany.mockResolvedValue({ count: 3 } as any);

      const result = await responseRepository.updateMany({
        where: { formId: 'form-123' },
        data: { deletedAt: new Date() },
      });

      expect(result).toEqual({ count: 3 });
    });
  });

  describe('countPerFieldRaw', () => {
    it('should return per-field counts', async () => {
      (mockPrisma.$queryRaw as any).mockResolvedValue([
        { field_id: 'field-1', count: BigInt(5) },
      ]);

      const result = await responseRepository.countPerFieldRaw('form-123', ['field-1', 'field-2']);

      expect(result).toEqual([{ field_id: 'field-1', count: BigInt(5) }]);
    });
  });

  describe('countReferencingAnyFieldRaw', () => {
    it('should return a count row', async () => {
      (mockPrisma.$queryRaw as any).mockResolvedValue([{ count: BigInt(7) }]);

      const result = await responseRepository.countReferencingAnyFieldRaw('form-123', ['field-1']);

      expect(result).toEqual([{ count: BigInt(7) }]);
    });
  });

  describe('countFilteredRaw', () => {
    it('should count via queryRawUnsafe and coerce bigint to number', async () => {
      (mockPrisma.$queryRawUnsafe as any).mockResolvedValue([{ count: BigInt(12) }]);

      const result = await responseRepository.countFilteredRaw('WHERE "formId" = $1', ['form-123']);

      expect(result).toBe(12);
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
        'SELECT COUNT(*) as count FROM "response" WHERE "formId" = $1',
        'form-123'
      );
    });
  });

  describe('findFilteredRaw', () => {
    it('should query with pagination params appended', async () => {
      const rows = [{ id: 'response-1', formId: 'form-123', data: {}, metadata: null, respondentEmail: null, submittedAt: new Date() }];
      (mockPrisma.$queryRawUnsafe as any).mockResolvedValue(rows);

      const result = await responseRepository.findFilteredRaw(
        'WHERE "formId" = $1',
        'ORDER BY "submittedAt" DESC',
        ['form-123'],
        10,
        0
      );

      expect(result).toEqual(rows);
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $2 OFFSET $3'),
        'form-123',
        10,
        0
      );
    });
  });

  describe('softDeleteMany', () => {
    it('should soft-delete non-deleted responses by id', async () => {
      mockPrisma.response.updateMany.mockResolvedValue({ count: 2 } as any);

      const result = await responseRepository.softDeleteMany('form-123', ['response-1', 'response-2']);

      expect(result).toEqual({ count: 2 });
      expect(mockPrisma.response.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['response-1', 'response-2'] }, formId: 'form-123', deletedAt: null },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });
});

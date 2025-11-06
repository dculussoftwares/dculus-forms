import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createFormMetadataRepository } from '../formMetadataRepository.js';

describe('Form Metadata Repository', () => {
  const mockPrisma = {
    formMetadata: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
  };

  const mockContext = { prisma: mockPrisma as any };
  let formMetadataRepository: ReturnType<typeof createFormMetadataRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    formMetadataRepository = createFormMetadataRepository(mockContext);
  });

  describe('findByFormId', () => {
    it('should find metadata by form id', async () => {
      const mockMetadata = {
        id: 'metadata-123',
        formId: 'form-123',
        pageCount: 3,
        fieldCount: 10,
      };

      mockPrisma.formMetadata.findUnique.mockResolvedValue(mockMetadata as any);

      const result = await formMetadataRepository.findByFormId('form-123');

      expect(result).toEqual(mockMetadata);
      expect(mockPrisma.formMetadata.findUnique).toHaveBeenCalledWith({
        where: { formId: 'form-123' },
      });
    });
  });

  describe('upsertMetadata', () => {
    it('should upsert metadata', async () => {
      const metadataData = {
        id: 'metadata-123',
        formId: 'form-123',
        pageCount: 3,
        fieldCount: 10,
        backgroundImageKey: null,
        lastUpdated: new Date(),
      };

      mockPrisma.formMetadata.upsert.mockResolvedValue(metadataData as any);

      await formMetadataRepository.upsertMetadata('form-123', metadataData);

      expect(mockPrisma.formMetadata.upsert).toHaveBeenCalledWith({
        where: { formId: 'form-123' },
        update: metadataData,
        create: metadataData,
      });
    });
  });

  describe('listCachedFormIds', () => {
    it('should list all cached form ids', async () => {
      const mockMetadata = [
        { formId: 'form-1' },
        { formId: 'form-2' },
        { formId: 'form-3' },
      ];

      mockPrisma.formMetadata.findMany.mockResolvedValue(mockMetadata as any);

      const result = await formMetadataRepository.listCachedFormIds();

      expect(result).toEqual(mockMetadata);
      expect(mockPrisma.formMetadata.findMany).toHaveBeenCalledWith({
        select: { formId: true },
      });
    });
  });

});

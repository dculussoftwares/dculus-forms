import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createFormMetadataRepository } from '../formMetadataRepository.js';

describe('Form Metadata Repository', () => {
  const mockPrisma = {
    formMetadata: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  };

  const mockContext = { prisma: mockPrisma as any };
  let formMetadataRepository: ReturnType<typeof createFormMetadataRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    formMetadataRepository = createFormMetadataRepository(mockContext);
  });

  describe('core prisma delegates', () => {
    it('should call findUnique with provided args', async () => {
      const args = { where: { id: 'meta-1' }, select: { id: true } };
      const record = { id: 'meta-1' };
      mockPrisma.formMetadata.findUnique.mockResolvedValue(record as any);

      const result = await formMetadataRepository.findUnique(args as any);

      expect(mockPrisma.formMetadata.findUnique).toHaveBeenCalledWith(args);
      expect(result).toEqual(record);
    });

    it('should call findMany with provided args', async () => {
      const args = { where: { pageCount: { gt: 2 } }, take: 5 };
      const list = [{ id: 'meta-a' }, { id: 'meta-b' }];
      mockPrisma.formMetadata.findMany.mockResolvedValue(list as any);

      const result = await formMetadataRepository.findMany(args as any);

      expect(mockPrisma.formMetadata.findMany).toHaveBeenCalledWith(args);
      expect(result).toEqual(list);
    });

    it('should call upsert with provided args', async () => {
      const args = {
        where: { formId: 'form-999' },
        create: { formId: 'form-999', pageCount: 1 },
        update: { pageCount: 2 },
      };
      mockPrisma.formMetadata.upsert.mockResolvedValue(args.create as any);

      const result = await formMetadataRepository.upsert(args as any);

      expect(mockPrisma.formMetadata.upsert).toHaveBeenCalledWith(args);
      expect(result).toEqual(args.create);
    });

    it('should call update with provided args', async () => {
      const args = {
        where: { formId: 'form-777' },
        data: { lastUpdated: new Date() },
      };
      const updated = { ...args.data, formId: 'form-777' };
      mockPrisma.formMetadata.update.mockResolvedValue(updated as any);

      const result = await formMetadataRepository.update(args as any);

      expect(mockPrisma.formMetadata.update).toHaveBeenCalledWith(args);
      expect(result).toEqual(updated);
    });
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

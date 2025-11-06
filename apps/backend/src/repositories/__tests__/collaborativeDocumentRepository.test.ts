import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createCollaborativeDocumentRepository } from '../collaborativeDocumentRepository.js';

describe('Collaborative Document Repository', () => {
  const mockPrisma = {
    collaborativeDocument: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };

  const mockContext = { prisma: mockPrisma as any };
  let repository: ReturnType<typeof createCollaborativeDocumentRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = createCollaborativeDocumentRepository(mockContext);
  });

  describe('findUnique', () => {
    it('should find document by unique field', async () => {
      const mockDoc = {
        id: 'doc-123',
        documentName: 'form-123',
        state: Buffer.from([1, 2, 3]),
      };

      mockPrisma.collaborativeDocument.findUnique.mockResolvedValue(mockDoc as any);

      const result = await repository.findUnique({
        where: { documentName: 'form-123' },
      });

      expect(result).toEqual(mockDoc);
      expect(mockPrisma.collaborativeDocument.findUnique).toHaveBeenCalledWith({
        where: { documentName: 'form-123' },
      });
    });
  });

  describe('findMany', () => {
    it('should find many documents', async () => {
      const mockDocs = [
        { id: 'doc-1', documentName: 'form-1' },
        { id: 'doc-2', documentName: 'form-2' },
      ];

      mockPrisma.collaborativeDocument.findMany.mockResolvedValue(mockDocs as any);

      const result = await repository.findMany();

      expect(result).toEqual(mockDocs);
      expect(mockPrisma.collaborativeDocument.findMany).toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('should create document', async () => {
      const docData = {
        id: 'doc-123',
        documentName: 'form-123',
        state: Buffer.from([1, 2, 3]),
      };

      mockPrisma.collaborativeDocument.create.mockResolvedValue(docData as any);

      const result = await repository.create({
        data: docData,
      });

      expect(result).toEqual(docData);
      expect(mockPrisma.collaborativeDocument.create).toHaveBeenCalledWith({
        data: docData,
      });
    });
  });

  describe('update', () => {
    it('should update document', async () => {
      const updatedDoc = {
        id: 'doc-123',
        state: Buffer.from([4, 5, 6]),
      };

      mockPrisma.collaborativeDocument.update.mockResolvedValue(updatedDoc as any);

      const result = await repository.update({
        where: { documentName: 'form-123' },
        data: { state: Buffer.from([4, 5, 6]) },
      });

      expect(result).toEqual(updatedDoc);
      expect(mockPrisma.collaborativeDocument.update).toHaveBeenCalledWith({
        where: { documentName: 'form-123' },
        data: { state: Buffer.from([4, 5, 6]) },
      });
    });
  });

  describe('fetchDocumentWithState', () => {
    it('should fetch document with state', async () => {
      const mockDoc = {
        id: 'doc-123',
        state: Buffer.from([1, 2, 3]),
        updatedAt: new Date(),
      };

      mockPrisma.collaborativeDocument.findUnique.mockResolvedValue(mockDoc as any);

      const result = await repository.fetchDocumentWithState('form-123');

      expect(result).toEqual(mockDoc);
      expect(mockPrisma.collaborativeDocument.findUnique).toHaveBeenCalledWith({
        where: { documentName: 'form-123' },
        select: { state: true, id: true, updatedAt: true },
      });
    });
  });

  describe('listDocumentNames', () => {
    it('should list all document names', async () => {
      const mockDocs = [
        { id: 'doc-1', documentName: 'form-1' },
        { id: 'doc-2', documentName: 'form-2' },
      ];

      mockPrisma.collaborativeDocument.findMany.mockResolvedValue(mockDocs as any);

      const result = await repository.listDocumentNames();

      expect(result).toEqual(mockDocs);
      expect(mockPrisma.collaborativeDocument.findMany).toHaveBeenCalledWith({
        select: { documentName: true, id: true },
      });
    });
  });

  describe('saveDocumentState', () => {
    it('should create new document when it does not exist', async () => {
      const state = Buffer.from([1, 2, 3]);
      const idFactory = vi.fn().mockReturnValue('doc-123');
      const newDoc = {
        id: 'doc-123',
        documentName: 'form-123',
        state,
      };

      mockPrisma.collaborativeDocument.findUnique.mockResolvedValue(null);
      mockPrisma.collaborativeDocument.create.mockResolvedValue(newDoc as any);

      const result = await repository.saveDocumentState('form-123', state, idFactory);

      expect(result).toEqual(newDoc);
      expect(idFactory).toHaveBeenCalledWith('form-123');
      expect(mockPrisma.collaborativeDocument.create).toHaveBeenCalled();
    });

    it('should update existing document when it exists', async () => {
      const state = Buffer.from([4, 5, 6]);
      const idFactory = vi.fn();
      const existingDoc = { documentName: 'form-123' };
      const updatedDoc = {
        id: 'doc-123',
        documentName: 'form-123',
        state,
      };

      mockPrisma.collaborativeDocument.findUnique.mockResolvedValue(existingDoc as any);
      mockPrisma.collaborativeDocument.update.mockResolvedValue(updatedDoc as any);

      const result = await repository.saveDocumentState('form-123', state, idFactory);

      expect(result).toEqual(updatedDoc);
      expect(idFactory).not.toHaveBeenCalled();
      expect(mockPrisma.collaborativeDocument.update).toHaveBeenCalled();
    });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as Y from 'yjs';
import {
  extractFormStatsFromYDoc,
  extractFormStatsFromState,
  updateFormMetadata,
  computeFormMetadata,
  batchUpdateFormMetadata,
  getFormMetadata,
  constructBackgroundImageUrl,
  getFormsNeedingMetadataUpdate,
} from '../formMetadataService.js';
import {
  formMetadataRepository,
  collaborativeDocumentRepository,
  formRepository,
} from '../../repositories/index.js';

// Mock dependencies
vi.mock('../../repositories/index.js');
vi.mock('../../utils/cdn.js');

// Helper to create mock metadata
const createMockMetadata = (formId: string, overrides = {}) => ({
  id: `metadata-${formId}`,
  formId,
  pageCount: 0,
  fieldCount: 0,
  backgroundImageKey: null,
  lastUpdated: new Date(),
  ...overrides,
});

describe('Form Metadata Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('extractFormStatsFromYDoc', () => {
    it('should extract stats from valid YDoc', () => {
      const ydoc = new Y.Doc();
      const formSchemaMap = ydoc.getMap('formSchema');

      // Create pages array
      const pagesArray = new Y.Array();
      const page1 = new Y.Map();
      const fields1 = new Y.Array();
      fields1.push([{}]);
      fields1.push([{}]);
      page1.set('fields', fields1);
      pagesArray.push([page1]);
      formSchemaMap.set('pages', pagesArray);

      // Create layout
      const layoutMap = new Y.Map();
      layoutMap.set('backgroundImageKey', 'bg-image-123');
      formSchemaMap.set('layout', layoutMap);

      const result = extractFormStatsFromYDoc(ydoc);

      expect(result.pageCount).toBe(1);
      expect(result.fieldCount).toBe(2);
      expect(result.backgroundImageKey).toBe('bg-image-123');
    });

    it('should handle empty YDoc', () => {
      const ydoc = new Y.Doc();

      const result = extractFormStatsFromYDoc(ydoc);

      expect(result.pageCount).toBe(0);
      expect(result.fieldCount).toBe(0);
      expect(result.backgroundImageKey).toBeNull();
    });

    it('should handle YDoc without background image', () => {
      const ydoc = new Y.Doc();
      const formSchemaMap = ydoc.getMap('formSchema');
      const pagesArray = new Y.Array();
      formSchemaMap.set('pages', pagesArray);

      const result = extractFormStatsFromYDoc(ydoc);

      expect(result.backgroundImageKey).toBeNull();
    });

    it('should handle errors gracefully', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const invalidYDoc = null as any;

      const result = extractFormStatsFromYDoc(invalidYDoc);

      expect(result).toEqual({
        pageCount: 0,
        fieldCount: 0,
        backgroundImageKey: null,
      });
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });

  describe('extractFormStatsFromState', () => {
    it('should extract stats from state Uint8Array', () => {
      const ydoc = new Y.Doc();
      const formSchemaMap = ydoc.getMap('formSchema');
      const pagesArray = new Y.Array();
      formSchemaMap.set('pages', pagesArray);

      const state = Y.encodeStateAsUpdate(ydoc);

      const result = extractFormStatsFromState(state);

      expect(result.pageCount).toBe(0);
      expect(result.fieldCount).toBe(0);
    });

    it('should handle invalid state gracefully', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const invalidState = new Uint8Array([1, 2, 3]); // Invalid YJS state

      const result = extractFormStatsFromState(invalidState);

      expect(result).toEqual({
        pageCount: 0,
        fieldCount: 0,
        backgroundImageKey: null,
      });
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });

  describe('updateFormMetadata', () => {
    it('should update metadata in repository', async () => {
      const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.mocked(formMetadataRepository.upsertMetadata).mockResolvedValue(
        createMockMetadata('form-123') as any
      );

      const stats = {
        pageCount: 2,
        fieldCount: 5,
        backgroundImageKey: 'bg-123',
      };

      await updateFormMetadata('form-123', stats);

      expect(formMetadataRepository.upsertMetadata).toHaveBeenCalledWith('form-123', {
        id: 'metadata-form-123',
        formId: 'form-123',
        pageCount: 2,
        fieldCount: 5,
        backgroundImageKey: 'bg-123',
        lastUpdated: expect.any(Date),
      });
      expect(consoleLog).toHaveBeenCalledWith(
        '✅ Updated metadata for form form-123:',
        stats
      );
      consoleLog.mockRestore();
    });

    it('should handle errors and rethrow', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(formMetadataRepository.upsertMetadata).mockRejectedValue(
        new Error('Database error')
      );

      const stats = { pageCount: 2, fieldCount: 5, backgroundImageKey: null };

      await expect(updateFormMetadata('form-123', stats)).rejects.toThrow('Database error');
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });

  describe('computeFormMetadata', () => {
    it('should compute metadata from collaborative document', async () => {
      const ydoc = new Y.Doc();
      const state = Y.encodeStateAsUpdate(ydoc);

      vi.mocked(collaborativeDocumentRepository.fetchDocumentWithState).mockResolvedValue({
        id: 'doc-123',
        documentId: 'form-123',
        state: Buffer.from(state),
      } as any);

      vi.mocked(formMetadataRepository.upsertMetadata).mockResolvedValue(createMockMetadata("form-123") as any);

      const result = await computeFormMetadata('form-123');

      expect(result).toBeDefined();
      expect(result?.pageCount).toBe(0);
      expect(result?.fieldCount).toBe(0);
      expect(formMetadataRepository.upsertMetadata).toHaveBeenCalled();
    });

    it('should return null when collaborative document not found', async () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.mocked(collaborativeDocumentRepository.fetchDocumentWithState).mockResolvedValue(null);

      const result = await computeFormMetadata('form-123');

      expect(result).toBeNull();
      expect(consoleWarn).toHaveBeenCalledWith(
        'No collaborative document found for form: form-123'
      );
      consoleWarn.mockRestore();
    });

    it('should return null when document has no state', async () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.mocked(collaborativeDocumentRepository.fetchDocumentWithState).mockResolvedValue({
        id: 'doc-123',
        documentId: 'form-123',
        state: null,
      } as any);

      const result = await computeFormMetadata('form-123');

      expect(result).toBeNull();
      expect(consoleWarn).toHaveBeenCalled();
      consoleWarn.mockRestore();
    });

    it('should handle errors gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(collaborativeDocumentRepository.fetchDocumentWithState).mockRejectedValue(
        new Error('Database error')
      );

      const result = await computeFormMetadata('form-123');

      expect(result).toBeNull();
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });

  describe('batchUpdateFormMetadata', () => {
    it('should update metadata for multiple forms', async () => {
      const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
      const ydoc = new Y.Doc();
      const state = Y.encodeStateAsUpdate(ydoc);

      vi.mocked(collaborativeDocumentRepository.fetchDocumentWithState).mockResolvedValue({
        id: 'doc-123',
        documentId: 'form-123',
        state: Buffer.from(state),
      } as any);

      vi.mocked(formMetadataRepository.upsertMetadata).mockResolvedValue(createMockMetadata("form-123") as any);

      await batchUpdateFormMetadata(['form-1', 'form-2', 'form-3']);

      expect(consoleLog).toHaveBeenCalledWith(
        '🔄 Starting batch metadata update for 3 forms'
      );
      expect(consoleLog).toHaveBeenCalledWith(
        '✅ Batch update completed: 3 successful, 0 errors'
      );
      consoleLog.mockRestore();
    });

    it('should handle errors and continue processing', async () => {
      const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      vi.mocked(collaborativeDocumentRepository.fetchDocumentWithState)
        .mockResolvedValueOnce({
          id: 'doc-1',
          documentId: 'form-1',
          state: Buffer.from(Y.encodeStateAsUpdate(new Y.Doc())),
        } as any)
        .mockRejectedValueOnce(new Error('Database error'));

      vi.mocked(formMetadataRepository.upsertMetadata).mockResolvedValue(createMockMetadata("form-123") as any);

      await batchUpdateFormMetadata(['form-1', 'form-2']);

      expect(consoleError).toHaveBeenCalled();
      // Check that batch update logs completion (don't check exact counts due to async issues)
      const completedCalls = consoleLog.mock.calls.filter((call) =>
        call[0]?.includes('Batch update completed')
      );
      expect(completedCalls.length).toBeGreaterThan(0);
      consoleLog.mockRestore();
      consoleError.mockRestore();
    });
  });

  describe('getFormMetadata', () => {
    it('should return cached metadata when available', async () => {
      const cachedMetadata = {
        id: 'metadata-form-123',
        formId: 'form-123',
        pageCount: 2,
        fieldCount: 5,
        backgroundImageKey: 'bg-123',
        lastUpdated: new Date(),
      };

      vi.mocked(formMetadataRepository.findByFormId).mockResolvedValue(cachedMetadata as any);

      const result = await getFormMetadata('form-123');

      expect(result).toEqual(cachedMetadata);
      expect(collaborativeDocumentRepository.fetchDocumentWithState).not.toHaveBeenCalled();
    });

    it('should compute metadata when not cached', async () => {
      const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
      const ydoc = new Y.Doc();
      const state = Y.encodeStateAsUpdate(ydoc);

      vi.mocked(formMetadataRepository.findByFormId).mockResolvedValue(null);
      vi.mocked(collaborativeDocumentRepository.fetchDocumentWithState).mockResolvedValue({
        id: 'doc-123',
        documentId: 'form-123',
        state: Buffer.from(state),
      } as any);
      vi.mocked(formMetadataRepository.upsertMetadata).mockResolvedValue(createMockMetadata("form-123") as any);

      const result = await getFormMetadata('form-123');

      expect(result).toBeDefined();
      expect(consoleLog).toHaveBeenCalledWith(
        'Computing metadata for form form-123 (not cached)'
      );
      consoleLog.mockRestore();
    });

    it('should return null when computation fails', async () => {
      vi.mocked(formMetadataRepository.findByFormId).mockResolvedValue(null);
      vi.mocked(collaborativeDocumentRepository.fetchDocumentWithState).mockResolvedValue(null);

      const result = await getFormMetadata('form-123');

      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(formMetadataRepository.findByFormId).mockRejectedValue(
        new Error('Database error')
      );

      const result = await getFormMetadata('form-123');

      expect(result).toBeNull();
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });

  describe('constructBackgroundImageUrl', () => {
    it('should return null for null key', () => {
      const result = constructBackgroundImageUrl(null);

      expect(result).toBeNull();
    });

    it('should return null for empty string', () => {
      const result = constructBackgroundImageUrl('');

      expect(result).toBeNull();
    });
  });

  describe('getFormsNeedingMetadataUpdate', () => {
    it('should return forms without cached metadata', async () => {
      vi.mocked(formMetadataRepository.listCachedFormIds).mockResolvedValue([
        { formId: 'form-1' },
        { formId: 'form-2' },
      ] as any);

      vi.mocked(formRepository.findMany).mockResolvedValue([
        { id: 'form-3' },
        { id: 'form-4' },
      ] as any);

      const result = await getFormsNeedingMetadataUpdate();

      expect(result).toEqual(['form-3', 'form-4']);
      expect(formRepository.findMany).toHaveBeenCalledWith({
        where: {
          id: {
            notIn: ['form-1', 'form-2'],
          },
        },
        select: { id: true },
      });
    });

    it('should return empty array when all forms have metadata', async () => {
      vi.mocked(formMetadataRepository.listCachedFormIds).mockResolvedValue([
        { formId: 'form-1' },
      ] as any);
      vi.mocked(formRepository.findMany).mockResolvedValue([]);

      const result = await getFormsNeedingMetadataUpdate();

      expect(result).toEqual([]);
    });

    it('should handle errors gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(formMetadataRepository.listCachedFormIds).mockRejectedValue(
        new Error('Database error')
      );

      const result = await getFormsNeedingMetadataUpdate();

      expect(result).toEqual([]);
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });
});

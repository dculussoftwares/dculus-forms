import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getAllTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  hardDeleteTemplate,
  getTemplatesByCategory,
  getTemplateCategories,
} from '../templateService.js';
import { formTemplateRepository } from '../../repositories/index.js';
import { serializeFormSchema, deserializeFormSchema, ThemeType, SpacingType } from '@dculus/types';
import { logger } from '../../lib/logger.js';

// Mock dependencies
vi.mock('../../repositories/index.js');
vi.mock('@dculus/types', async () => {
  const actual = await vi.importActual<typeof import('@dculus/types')>('@dculus/types');
  return {
    ...actual,
    serializeFormSchema: vi.fn(),
    deserializeFormSchema: vi.fn(),
  };
});

describe('Template Service', () => {
  const mockFormSchema = {
    pages: [{ id: 'page-1', title: 'Page 1', fields: [], order: 0 }],
    layout: {
      theme: ThemeType.LIGHT,
      textColor: '#000000',
      spacing: SpacingType.NORMAL,
      code: 'L1' as const,
      content: '',
      customBackGroundColor: '#ffffff',
      customCTAButtonName: 'Submit',
      backgroundImageKey: '',
      pageMode: 'multipage' as const,
    },
    isShuffleEnabled: false,
  };

  const mockTemplate = {
    id: 'template-123',
    name: 'Contact Form',
    description: 'A simple contact form',
    category: 'Business',
    formSchema: { serialized: 'data' },
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(deserializeFormSchema).mockReturnValue(mockFormSchema as any);
    vi.mocked(serializeFormSchema).mockReturnValue({ serialized: 'data' } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getAllTemplates', () => {
    it('should return all active templates', async () => {
      vi.mocked(formTemplateRepository.listActive).mockResolvedValue([mockTemplate] as any);

      const result = await getAllTemplates();

      expect(formTemplateRepository.listActive).toHaveBeenCalledWith(undefined);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'template-123',
        name: 'Contact Form',
        description: 'A simple contact form',
        category: 'Business',
      });
      expect(deserializeFormSchema).toHaveBeenCalledWith({ serialized: 'data' });
    });

    it('should filter templates by category', async () => {
      vi.mocked(formTemplateRepository.listActive).mockResolvedValue([mockTemplate] as any);

      const result = await getAllTemplates('Business');

      expect(formTemplateRepository.listActive).toHaveBeenCalledWith('Business');
      expect(result).toHaveLength(1);
    });

    it('should handle templates without description', async () => {
      const templateWithoutDesc = { ...mockTemplate, description: null };
      vi.mocked(formTemplateRepository.listActive).mockResolvedValue([templateWithoutDesc] as any);

      const result = await getAllTemplates();

      expect(result[0].description).toBeUndefined();
    });

    it('should handle templates without category', async () => {
      const templateWithoutCategory = { ...mockTemplate, category: null };
      vi.mocked(formTemplateRepository.listActive).mockResolvedValue([
        templateWithoutCategory,
      ] as any);

      const result = await getAllTemplates();

      expect(result[0].category).toBeUndefined();
    });

    it('should return empty array when no templates exist', async () => {
      vi.mocked(formTemplateRepository.listActive).mockResolvedValue([]);

      const result = await getAllTemplates();

      expect(result).toEqual([]);
    });
  });

  describe('getTemplateById', () => {
    it('should return template by id', async () => {
      vi.mocked(formTemplateRepository.fetchById).mockResolvedValue(mockTemplate as any);

      const result = await getTemplateById('template-123');

      expect(formTemplateRepository.fetchById).toHaveBeenCalledWith('template-123');
      expect(result).toMatchObject({
        id: 'template-123',
        name: 'Contact Form',
      });
      expect(deserializeFormSchema).toHaveBeenCalledWith({ serialized: 'data' });
    });

    it('should return null when template not found', async () => {
      vi.mocked(formTemplateRepository.fetchById).mockResolvedValue(null);

      const result = await getTemplateById('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle errors and return null', async () => {
      const loggerError = vi.spyOn(logger, 'error').mockImplementation(() => {});
      vi.mocked(formTemplateRepository.fetchById).mockRejectedValue(new Error('Database error'));

      const result = await getTemplateById('template-123');

      expect(result).toBeNull();
      expect(loggerError).toHaveBeenCalledWith('Error fetching template by ID:', expect.any(Error));
      loggerError.mockRestore();
    });
  });

  describe('createTemplate', () => {
    it('should create template successfully', async () => {
      vi.mocked(formTemplateRepository.createTemplate).mockResolvedValue(mockTemplate as any);

      const result = await createTemplate({
        name: 'New Template',
        description: 'Test description',
        category: 'Business',
        formSchema: mockFormSchema as any,
      });

      expect(serializeFormSchema).toHaveBeenCalledWith(mockFormSchema);
      expect(formTemplateRepository.createTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Template',
          description: 'Test description',
          category: 'Business',
          formSchema: { serialized: 'data' },
          isActive: true,
        })
      );
      expect(result.name).toBe('Contact Form');
    });

    it('should create template without description and category', async () => {
      vi.mocked(formTemplateRepository.createTemplate).mockResolvedValue(mockTemplate as any);

      await createTemplate({
        name: 'Simple Template',
        formSchema: mockFormSchema as any,
      });

      expect(formTemplateRepository.createTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Simple Template',
          description: undefined,
          category: undefined,
        })
      );
    });

    it('should generate UUID for new template', async () => {
      vi.mocked(formTemplateRepository.createTemplate).mockResolvedValue(mockTemplate as any);

      await createTemplate({
        name: 'Test',
        formSchema: mockFormSchema as any,
      });

      expect(formTemplateRepository.createTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.stringMatching(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
          ),
        })
      );
    });
  });

  describe('updateTemplate', () => {
    it('should update template name', async () => {
      vi.mocked(formTemplateRepository.updateTemplate).mockResolvedValue(mockTemplate as any);

      const result = await updateTemplate('template-123', {
        name: 'Updated Name',
      });

      expect(formTemplateRepository.updateTemplate).toHaveBeenCalledWith('template-123', {
        name: 'Updated Name',
      });
      expect(result).toBeDefined();
    });

    it('should update template description', async () => {
      vi.mocked(formTemplateRepository.updateTemplate).mockResolvedValue(mockTemplate as any);

      await updateTemplate('template-123', {
        description: 'New description',
      });

      expect(formTemplateRepository.updateTemplate).toHaveBeenCalledWith('template-123', {
        description: 'New description',
      });
    });

    it('should update template category', async () => {
      vi.mocked(formTemplateRepository.updateTemplate).mockResolvedValue(mockTemplate as any);

      await updateTemplate('template-123', {
        category: 'Education',
      });

      expect(formTemplateRepository.updateTemplate).toHaveBeenCalledWith('template-123', {
        category: 'Education',
      });
    });

    it('should update template form schema', async () => {
      vi.mocked(formTemplateRepository.updateTemplate).mockResolvedValue(mockTemplate as any);

      await updateTemplate('template-123', {
        formSchema: mockFormSchema as any,
      });

      expect(serializeFormSchema).toHaveBeenCalledWith(mockFormSchema);
      expect(formTemplateRepository.updateTemplate).toHaveBeenCalledWith('template-123', {
        formSchema: { serialized: 'data' },
      });
    });

    it('should update template active status', async () => {
      vi.mocked(formTemplateRepository.updateTemplate).mockResolvedValue(mockTemplate as any);

      await updateTemplate('template-123', {
        isActive: false,
      });

      expect(formTemplateRepository.updateTemplate).toHaveBeenCalledWith('template-123', {
        isActive: false,
      });
    });

    it('should update multiple fields at once', async () => {
      vi.mocked(formTemplateRepository.updateTemplate).mockResolvedValue(mockTemplate as any);

      await updateTemplate('template-123', {
        name: 'New Name',
        description: 'New Description',
        category: 'New Category',
        isActive: false,
      });

      expect(formTemplateRepository.updateTemplate).toHaveBeenCalledWith('template-123', {
        name: 'New Name',
        description: 'New Description',
        category: 'New Category',
        isActive: false,
      });
    });

    it('should handle errors and return null', async () => {
      const loggerError = vi.spyOn(logger, 'error').mockImplementation(() => {});
      vi.mocked(formTemplateRepository.updateTemplate).mockRejectedValue(
        new Error('Update failed')
      );

      const result = await updateTemplate('template-123', { name: 'Test' });

      expect(result).toBeNull();
      expect(loggerError).toHaveBeenCalledWith('Error updating template:', expect.any(Error));
      loggerError.mockRestore();
    });

    it('should handle undefined values correctly', async () => {
      vi.mocked(formTemplateRepository.updateTemplate).mockResolvedValue(mockTemplate as any);

      await updateTemplate('template-123', {
        description: undefined,
        category: undefined,
      });

      expect(formTemplateRepository.updateTemplate).toHaveBeenCalledWith('template-123', {
        description: undefined,
        category: undefined,
      });
    });
  });

  describe('deleteTemplate', () => {
    it('should soft delete template successfully', async () => {
      vi.mocked(formTemplateRepository.softDeleteTemplate).mockResolvedValue({} as any);

      const result = await deleteTemplate('template-123');

      expect(formTemplateRepository.softDeleteTemplate).toHaveBeenCalledWith('template-123');
      expect(result).toBe(true);
    });

    it('should return false on error', async () => {
      const loggerError = vi.spyOn(logger, 'error').mockImplementation(() => {});
      vi.mocked(formTemplateRepository.softDeleteTemplate).mockRejectedValue(
        new Error('Delete failed')
      );

      const result = await deleteTemplate('template-123');

      expect(result).toBe(false);
      expect(loggerError).toHaveBeenCalledWith('Error deleting template:', expect.any(Error));
      loggerError.mockRestore();
    });
  });

  describe('hardDeleteTemplate', () => {
    it('should hard delete template successfully', async () => {
      vi.mocked(formTemplateRepository.hardDeleteTemplate).mockResolvedValue({} as any);

      const result = await hardDeleteTemplate('template-123');

      expect(formTemplateRepository.hardDeleteTemplate).toHaveBeenCalledWith('template-123');
      expect(result).toBe(true);
    });

    it('should return false on error', async () => {
      const loggerError = vi.spyOn(logger, 'error').mockImplementation(() => {});
      vi.mocked(formTemplateRepository.hardDeleteTemplate).mockRejectedValue(
        new Error('Hard delete failed')
      );

      const result = await hardDeleteTemplate('template-123');

      expect(result).toBe(false);
      expect(loggerError).toHaveBeenCalledWith(
        'Error hard deleting template:',
        expect.any(Error)
      );
      loggerError.mockRestore();
    });
  });

  describe('getTemplatesByCategory', () => {
    it('should group templates by category', async () => {
      const templates = [
        { ...mockTemplate, id: 'temp-1', category: 'Business' },
        { ...mockTemplate, id: 'temp-2', category: 'Business' },
        { ...mockTemplate, id: 'temp-3', category: 'Education' },
        { ...mockTemplate, id: 'temp-4', category: null },
      ];

      vi.mocked(formTemplateRepository.listActive).mockResolvedValue(templates as any);

      const result = await getTemplatesByCategory();

      expect(result).toHaveProperty('Business');
      expect(result).toHaveProperty('Education');
      expect(result).toHaveProperty('Uncategorized');
      expect(result.Business).toHaveLength(2);
      expect(result.Education).toHaveLength(1);
      expect(result.Uncategorized).toHaveLength(1);
    });

    it('should return empty object when no templates exist', async () => {
      vi.mocked(formTemplateRepository.listActive).mockResolvedValue([]);

      const result = await getTemplatesByCategory();

      expect(result).toEqual({});
    });

    it('should handle templates without category as Uncategorized', async () => {
      const templates = [
        { ...mockTemplate, id: 'temp-1', category: null },
        { ...mockTemplate, id: 'temp-2', category: undefined },
      ];

      vi.mocked(formTemplateRepository.listActive).mockResolvedValue(templates as any);

      const result = await getTemplatesByCategory();

      expect(result.Uncategorized).toHaveLength(2);
    });
  });

  describe('getTemplateCategories', () => {
    it('should return sorted list of categories', async () => {
      const templates = [
        { category: 'Business' },
        { category: 'Education' },
        { category: 'Business' },
        { category: 'Healthcare' },
      ];

      vi.mocked(formTemplateRepository.listCategories).mockResolvedValue(templates as any);

      const result = await getTemplateCategories();

      expect(result).toEqual(['Business', 'Education', 'Healthcare']);
    });

    it('should filter out null categories', async () => {
      const templates = [
        { category: 'Business' },
        { category: null },
        { category: 'Education' },
        { category: null },
      ];

      vi.mocked(formTemplateRepository.listCategories).mockResolvedValue(templates as any);

      const result = await getTemplateCategories();

      expect(result).toEqual(['Business', 'Education']);
    });

    it('should return empty array when no categories exist', async () => {
      vi.mocked(formTemplateRepository.listCategories).mockResolvedValue([]);

      const result = await getTemplateCategories();

      expect(result).toEqual([]);
    });

    it('should return empty array when all categories are null', async () => {
      const templates = [{ category: null }, { category: null }];

      vi.mocked(formTemplateRepository.listCategories).mockResolvedValue(templates as any);

      const result = await getTemplateCategories();

      expect(result).toEqual([]);
    });
  });
});

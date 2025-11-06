import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createFormTemplateRepository } from '../formTemplateRepository.js';

describe('Form Template Repository', () => {
  const mockPrisma = {
    formTemplate: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };

  const mockContext = { prisma: mockPrisma as any };
  let repository: ReturnType<typeof createFormTemplateRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = createFormTemplateRepository(mockContext);
  });

  describe('findMany', () => {
    it('should find many templates', async () => {
      const mockTemplates = [
        { id: 'template-1', name: 'Contact Form' },
        { id: 'template-2', name: 'Survey' },
      ];

      mockPrisma.formTemplate.findMany.mockResolvedValue(mockTemplates as any);

      const result = await repository.findMany();

      expect(result).toEqual(mockTemplates);
      expect(mockPrisma.formTemplate.findMany).toHaveBeenCalled();
    });
  });

  describe('findUnique', () => {
    it('should find unique template', async () => {
      const mockTemplate = { id: 'template-1', name: 'Contact Form' };

      mockPrisma.formTemplate.findUnique.mockResolvedValue(mockTemplate as any);

      const result = await repository.findUnique({
        where: { id: 'template-1' },
      });

      expect(result).toEqual(mockTemplate);
      expect(mockPrisma.formTemplate.findUnique).toHaveBeenCalledWith({
        where: { id: 'template-1' },
      });
    });
  });

  describe('create', () => {
    it('should create template', async () => {
      const templateData = {
        id: 'template-1',
        name: 'Contact Form',
        category: 'business',
      };

      mockPrisma.formTemplate.create.mockResolvedValue(templateData as any);

      const result = await repository.create({
        data: templateData as any,
      });

      expect(result).toEqual(templateData);
      expect(mockPrisma.formTemplate.create).toHaveBeenCalledWith({
        data: templateData,
      });
    });
  });

  describe('update', () => {
    it('should update template', async () => {
      const updatedTemplate = {
        id: 'template-1',
        name: 'Updated Contact Form',
      };

      mockPrisma.formTemplate.update.mockResolvedValue(updatedTemplate as any);

      const result = await repository.update({
        where: { id: 'template-1' },
        data: { name: 'Updated Contact Form' },
      });

      expect(result).toEqual(updatedTemplate);
      expect(mockPrisma.formTemplate.update).toHaveBeenCalledWith({
        where: { id: 'template-1' },
        data: { name: 'Updated Contact Form' },
      });
    });
  });

  describe('delete', () => {
    it('should delete template', async () => {
      const deletedTemplate = { id: 'template-1' };

      mockPrisma.formTemplate.delete.mockResolvedValue(deletedTemplate as any);

      const result = await repository.delete({
        where: { id: 'template-1' },
      });

      expect(result).toEqual(deletedTemplate);
      expect(mockPrisma.formTemplate.delete).toHaveBeenCalledWith({
        where: { id: 'template-1' },
      });
    });
  });

  describe('listActive', () => {
    it('should list all active templates without category filter', async () => {
      const mockTemplates = [
        { id: 'template-1', isActive: true },
        { id: 'template-2', isActive: true },
      ];

      mockPrisma.formTemplate.findMany.mockResolvedValue(mockTemplates as any);

      const result = await repository.listActive();

      expect(result).toEqual(mockTemplates);
      expect(mockPrisma.formTemplate.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should list active templates filtered by category', async () => {
      const mockTemplates = [{ id: 'template-1', category: 'business' }];

      mockPrisma.formTemplate.findMany.mockResolvedValue(mockTemplates as any);

      const result = await repository.listActive('business');

      expect(result).toEqual(mockTemplates);
      expect(mockPrisma.formTemplate.findMany).toHaveBeenCalledWith({
        where: { isActive: true, category: 'business' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('fetchById', () => {
    it('should fetch template by id', async () => {
      const mockTemplate = { id: 'template-1', name: 'Contact Form' };

      mockPrisma.formTemplate.findUnique.mockResolvedValue(mockTemplate as any);

      const result = await repository.fetchById('template-1');

      expect(result).toEqual(mockTemplate);
      expect(mockPrisma.formTemplate.findUnique).toHaveBeenCalledWith({
        where: { id: 'template-1' },
      });
    });
  });

  describe('createTemplate', () => {
    it('should create template with data', async () => {
      const templateData = {
        name: 'Contact Form',
        description: 'A simple contact form',
        category: 'business',
        formSchema: {},
        isActive: true,
      };

      mockPrisma.formTemplate.create.mockResolvedValue(templateData as any);

      const result = await repository.createTemplate(templateData as any);

      expect(result).toEqual(templateData);
      expect(mockPrisma.formTemplate.create).toHaveBeenCalledWith({
        data: templateData,
      });
    });
  });

  describe('updateTemplate', () => {
    it('should update template by id', async () => {
      const updateData = { name: 'Updated Form' };
      const updatedTemplate = { id: 'template-1', name: 'Updated Form' };

      mockPrisma.formTemplate.update.mockResolvedValue(updatedTemplate as any);

      const result = await repository.updateTemplate('template-1', updateData);

      expect(result).toEqual(updatedTemplate);
      expect(mockPrisma.formTemplate.update).toHaveBeenCalledWith({
        where: { id: 'template-1' },
        data: updateData,
      });
    });
  });

  describe('softDeleteTemplate', () => {
    it('should soft delete template by setting isActive to false', async () => {
      const softDeletedTemplate = { id: 'template-1', isActive: false };

      mockPrisma.formTemplate.update.mockResolvedValue(softDeletedTemplate as any);

      const result = await repository.softDeleteTemplate('template-1');

      expect(result).toEqual(softDeletedTemplate);
      expect(mockPrisma.formTemplate.update).toHaveBeenCalledWith({
        where: { id: 'template-1' },
        data: { isActive: false },
      });
    });
  });

  describe('hardDeleteTemplate', () => {
    it('should hard delete template from database', async () => {
      const deletedTemplate = { id: 'template-1' };

      mockPrisma.formTemplate.delete.mockResolvedValue(deletedTemplate as any);

      const result = await repository.hardDeleteTemplate('template-1');

      expect(result).toEqual(deletedTemplate);
      expect(mockPrisma.formTemplate.delete).toHaveBeenCalledWith({
        where: { id: 'template-1' },
      });
    });
  });

  describe('listCategories', () => {
    it('should list distinct categories from active templates', async () => {
      const mockCategories = [
        { category: 'business' },
        { category: 'education' },
        { category: 'survey' },
      ];

      mockPrisma.formTemplate.findMany.mockResolvedValue(mockCategories as any);

      const result = await repository.listCategories();

      expect(result).toEqual(mockCategories);
      expect(mockPrisma.formTemplate.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        select: { category: true },
        distinct: ['category'],
      });
    });
  });
});

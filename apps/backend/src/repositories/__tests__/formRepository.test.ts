import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createFormRepository } from '../formRepository.js';

describe('Form Repository', () => {
  const mockPrisma = {
    form: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    formPermission: {
      create: vi.fn(),
    },
    formFile: {
      create: vi.fn(),
    },
  };

  const mockContext = { prisma: mockPrisma as any };
  let formRepository: ReturnType<typeof createFormRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    formRepository = createFormRepository(mockContext);
  });

  describe('findById', () => {
    it('should find form by id', async () => {
      const mockForm = {
        id: 'form-123',
        title: 'Test Form',
        organizationId: 'org-123',
      };

      mockPrisma.form.findUnique.mockResolvedValue(mockForm as any);

      const result = await formRepository.findById('form-123');

      expect(result).toEqual(mockForm);
      expect(mockPrisma.form.findUnique).toHaveBeenCalledWith({
        where: { id: 'form-123' },
        include: { createdBy: true, organization: true },
      });
    });
  });

  describe('findByShortUrl', () => {
    it('should find form by short URL', async () => {
      const mockForm = {
        id: 'form-123',
        shortUrl: 'abc123',
      };

      mockPrisma.form.findUnique.mockResolvedValue(mockForm as any);

      const result = await formRepository.findByShortUrl('abc123');

      expect(result).toEqual(mockForm);
      expect(mockPrisma.form.findUnique).toHaveBeenCalledWith({
        where: { shortUrl: 'abc123' },
        include: { createdBy: true, organization: true },
      });
    });
  });

  describe('listByOrganization', () => {
    it('should list all forms for an organization', async () => {
      const mockForms = [
        { id: 'form-1', organizationId: 'org-123' },
        { id: 'form-2', organizationId: 'org-123' },
      ];

      mockPrisma.form.findMany.mockResolvedValue(mockForms as any);

      const result = await formRepository.listByOrganization('org-123');

      expect(result).toEqual(mockForms);
      expect(mockPrisma.form.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org-123' },
        include: { createdBy: true, organization: true },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should list all forms when no organizationId provided', async () => {
      const mockForms = [{ id: 'form-1' }, { id: 'form-2' }];

      mockPrisma.form.findMany.mockResolvedValue(mockForms as any);

      const result = await formRepository.listByOrganization();

      expect(result).toEqual(mockForms);
      expect(mockPrisma.form.findMany).toHaveBeenCalledWith({
        include: { createdBy: true, organization: true },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('createForm', () => {
    it('should create a new form', async () => {
      const formData = {
        id: 'form-123',
        title: 'New Form',
        organizationId: 'org-123',
        createdById: 'user-123',
        shortUrl: 'abc123',
        formSchema: {},
        isPublished: false,
      };

      mockPrisma.form.create.mockResolvedValue(formData as any);

      const result = await formRepository.createForm(formData);

      expect(result).toEqual(formData);
      expect(mockPrisma.form.create).toHaveBeenCalledWith({
        data: formData,
        include: { createdBy: true, organization: true },
      });
    });
  });

  describe('updateForm', () => {
    it('should update a form', async () => {
      const updates = { title: 'Updated Title' };
      const updatedForm = { id: 'form-123', title: 'Updated Title' };

      mockPrisma.form.update.mockResolvedValue(updatedForm as any);

      const result = await formRepository.updateForm('form-123', updates);

      expect(result).toEqual(updatedForm);
      expect(mockPrisma.form.update).toHaveBeenCalledWith({
        where: { id: 'form-123' },
        data: updates,
        include: { createdBy: true, organization: true },
      });
    });
  });

  describe('deleteForm', () => {
    it('should delete a form', async () => {
      mockPrisma.form.delete.mockResolvedValue({} as any);

      await formRepository.deleteForm('form-123');

      expect(mockPrisma.form.delete).toHaveBeenCalledWith({
        where: { id: 'form-123' },
      });
    });
  });

  describe('createOwnerPermission', () => {
    it('should create owner permission', async () => {
      const permissionData = {
        id: 'perm-123',
        formId: 'form-123',
        userId: 'user-123',
        permission: 'OWNER',
        grantedById: 'user-123',
      };

      mockPrisma.formPermission.create.mockResolvedValue(permissionData as any);

      const result = await formRepository.createOwnerPermission(permissionData);

      expect(result).toEqual(permissionData);
      expect(mockPrisma.formPermission.create).toHaveBeenCalledWith({
        data: permissionData,
      });
    });
  });

  describe('createFormAsset', () => {
    it('should create form asset', async () => {
      const assetData = {
        id: 'asset-123',
        formId: 'form-123',
        key: 'bg-image-key',
        type: 'FormBackground',
        originalName: 'background.jpg',
        size: 12345,
        mimeType: 'image/jpeg',
      };

      mockPrisma.formFile.create.mockResolvedValue(assetData as any);

      const result = await formRepository.createFormAsset(assetData);

      expect(result).toEqual(assetData);
      expect(mockPrisma.formFile.create).toHaveBeenCalledWith({
        data: assetData,
      });
    });
  });

  describe('findMany', () => {
    it('should find many forms with custom query', async () => {
      const mockForms = [{ id: 'form-1' }, { id: 'form-2' }];

      mockPrisma.form.findMany.mockResolvedValue(mockForms as any);

      const result = await formRepository.findMany({
        where: { isPublished: true },
        take: 10,
      });

      expect(result).toEqual(mockForms);
      expect(mockPrisma.form.findMany).toHaveBeenCalledWith({
        where: { isPublished: true },
        take: 10,
      });
    });
  });
});

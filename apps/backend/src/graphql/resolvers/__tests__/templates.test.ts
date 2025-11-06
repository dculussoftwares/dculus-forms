import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { templatesResolvers } from '../templates.js';
import { GraphQLError } from 'graphql';
import * as templateService from '../../../services/templateService.js';
import * as formService from '../../../services/formService.js';
import * as fileUploadService from '../../../services/fileUploadService.js';
import * as betterAuthMiddleware from '../../../middleware/better-auth-middleware.js';
import { prisma } from '../../../lib/prisma.js';

// Mock all dependencies
vi.mock('../../../services/templateService.js');
vi.mock('../../../services/formService.js');
vi.mock('../../../services/fileUploadService.js');
vi.mock('../../../middleware/better-auth-middleware.js');
vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    formFile: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));
vi.mock('../../../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));
vi.mock('../../../utils/cdn.js', () => ({
  constructCdnUrl: vi.fn((key: string) => `https://cdn.example.com/${key}`),
}));

describe('Templates Resolvers', () => {
  const mockContext = {
    user: {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      role: 'user' as const,
    },
    auth: {
      user: {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      },
      session: { id: 'session-123' },
      isAuthenticated: true,
    },
  };

  const mockAdminContext = {
    user: {
      id: 'admin-123',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'admin' as const,
    },
    auth: {
      user: {
        id: 'admin-123',
        email: 'admin@example.com',
        name: 'Admin User',
      },
      session: { id: 'session-admin' },
      isAuthenticated: true,
    },
  };

  const mockTemplate = {
    id: 'template-123',
    name: 'Contact Form',
    description: 'A simple contact form template',
    category: 'Basic Forms',
    formSchema: {
      pages: [
        {
          id: 'page-1',
          title: 'Contact Info',
          fields: [],
          order: 0,
        },
      ],
      layout: {
        theme: 'light' as const,
        textColor: '#000000',
        spacing: 'normal' as const,
        code: '',
        content: '',
        customBackGroundColor: '#FFFFFF',
        backgroundImageKey: '',
      },
      isShuffleEnabled: false,
    },
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockTemplateWithBg = {
    ...mockTemplate,
    id: 'template-bg-123',
    name: 'Template with Background',
    formSchema: {
      ...mockTemplate.formSchema,
      layout: {
        ...mockTemplate.formSchema.layout,
        backgroundImageKey: 'templateDirectory/bg-image.jpg',
      },
    },
  };

  const mockForm = {
    id: 'form-123',
    title: 'New Form from Template',
    description: 'Created from template: Contact Form',
    shortUrl: 'abc12345',
    isPublished: false,
    organizationId: 'org-123',
    createdById: 'user-123',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    settings: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Query: templates', () => {
    it('should return all templates for authenticated user', async () => {
      const mockTemplates = [mockTemplate, mockTemplateWithBg];
      vi.mocked(templateService.getAllTemplates).mockResolvedValue(mockTemplates as any);

      const result = await templatesResolvers.Query.templates(
        {},
        {},
        mockContext
      );

      expect(templateService.getAllTemplates).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(mockTemplates);
    });

    it('should return templates filtered by category', async () => {
      const categoryTemplates = [mockTemplate];
      vi.mocked(templateService.getAllTemplates).mockResolvedValue(categoryTemplates as any);

      const result = await templatesResolvers.Query.templates(
        {},
        { category: 'Basic Forms' },
        mockContext
      );

      expect(templateService.getAllTemplates).toHaveBeenCalledWith('Basic Forms');
      expect(result).toEqual(categoryTemplates);
    });

    it('should return empty array when no templates exist', async () => {
      vi.mocked(templateService.getAllTemplates).mockResolvedValue([]);

      const result = await templatesResolvers.Query.templates(
        {},
        {},
        mockContext
      );

      expect(result).toEqual([]);
    });

    it('should throw error when user is not authenticated', async () => {
      const unauthContext = { user: undefined };

      await expect(
        templatesResolvers.Query.templates({}, {}, unauthContext)
      ).rejects.toThrow(GraphQLError);
      await expect(
        templatesResolvers.Query.templates({}, {}, unauthContext)
      ).rejects.toThrow('Authentication required');
    });

    it('should throw GraphQLError when service fails', async () => {
      vi.mocked(templateService.getAllTemplates).mockRejectedValue(
        new Error('Database error')
      );

      await expect(
        templatesResolvers.Query.templates({}, {}, mockContext)
      ).rejects.toThrow('Failed to fetch templates');
    });

    it('should preserve GraphQLError from authentication', async () => {
      const authError = new GraphQLError('Invalid token');
      vi.mocked(templateService.getAllTemplates).mockRejectedValue(authError);

      await expect(
        templatesResolvers.Query.templates({}, {}, mockContext)
      ).rejects.toThrow(authError);
    });
  });

  describe('Query: template', () => {
    it('should return template by ID when user is authenticated', async () => {
      vi.mocked(templateService.getTemplateById).mockResolvedValue(mockTemplate as any);

      const result = await templatesResolvers.Query.template(
        {},
        { id: 'template-123' },
        mockContext
      );

      expect(templateService.getTemplateById).toHaveBeenCalledWith('template-123');
      expect(result).toEqual(mockTemplate);
    });

    it('should throw error when template not found', async () => {
      vi.mocked(templateService.getTemplateById).mockResolvedValue(null);

      await expect(
        templatesResolvers.Query.template({}, { id: 'invalid-template' }, mockContext)
      ).rejects.toThrow('Template not found');
    });

    it('should throw error when user is not authenticated', async () => {
      const unauthContext = { user: undefined };

      await expect(
        templatesResolvers.Query.template({}, { id: 'template-123' }, unauthContext)
      ).rejects.toThrow('Authentication required');
    });

    it('should return template with background image', async () => {
      vi.mocked(templateService.getTemplateById).mockResolvedValue(mockTemplateWithBg as any);

      const result = await templatesResolvers.Query.template(
        {},
        { id: 'template-bg-123' },
        mockContext
      );

      expect(result.formSchema.layout.backgroundImageKey).toBe('templateDirectory/bg-image.jpg');
    });

    it('should throw generic error for non-GraphQL errors', async () => {
      vi.mocked(templateService.getTemplateById).mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(
        templatesResolvers.Query.template({}, { id: 'template-123' }, mockContext)
      ).rejects.toThrow('Failed to fetch template');
    });

    it('should preserve GraphQLError from service', async () => {
      const serviceError = new GraphQLError('Template access denied');
      vi.mocked(templateService.getTemplateById).mockRejectedValue(serviceError);

      await expect(
        templatesResolvers.Query.template({}, { id: 'template-123' }, mockContext)
      ).rejects.toThrow(serviceError);
    });
  });

  describe('Query: templatesByCategory', () => {
    it('should return templates grouped by category', async () => {
      const mockGroupedTemplates = {
        'Basic Forms': [mockTemplate],
        'Advanced Forms': [mockTemplateWithBg],
      };
      vi.mocked(templateService.getTemplatesByCategory).mockResolvedValue(mockGroupedTemplates as any);

      const result = await templatesResolvers.Query.templatesByCategory(
        {},
        {},
        mockContext
      );

      expect(templateService.getTemplatesByCategory).toHaveBeenCalled();
      expect(result).toEqual([
        { category: 'Basic Forms', templates: [mockTemplate] },
        { category: 'Advanced Forms', templates: [mockTemplateWithBg] },
      ]);
    });

    it('should return empty array when no templates exist', async () => {
      vi.mocked(templateService.getTemplatesByCategory).mockResolvedValue({});

      const result = await templatesResolvers.Query.templatesByCategory(
        {},
        {},
        mockContext
      );

      expect(result).toEqual([]);
    });

    it('should throw error when user is not authenticated', async () => {
      const unauthContext = { user: undefined };

      await expect(
        templatesResolvers.Query.templatesByCategory({}, {}, unauthContext)
      ).rejects.toThrow('Authentication required');
    });

    it('should handle uncategorized templates', async () => {
      const mockGroupedTemplates = {
        'Uncategorized': [mockTemplate],
      };
      vi.mocked(templateService.getTemplatesByCategory).mockResolvedValue(mockGroupedTemplates as any);

      const result = await templatesResolvers.Query.templatesByCategory(
        {},
        {},
        mockContext
      );

      expect(result).toEqual([
        { category: 'Uncategorized', templates: [mockTemplate] },
      ]);
    });

    it('should throw generic error for non-GraphQL errors', async () => {
      vi.mocked(templateService.getTemplatesByCategory).mockRejectedValue(
        new Error('Service error')
      );

      await expect(
        templatesResolvers.Query.templatesByCategory({}, {}, mockContext)
      ).rejects.toThrow('Failed to fetch templates by category');
    });

    it('should preserve GraphQLError from authentication', async () => {
      const authError = new GraphQLError('Session expired');
      vi.mocked(templateService.getTemplatesByCategory).mockRejectedValue(authError);

      await expect(
        templatesResolvers.Query.templatesByCategory({}, {}, mockContext)
      ).rejects.toThrow(authError);
    });
  });

  describe('Query: templateCategories', () => {
    it('should return list of template categories', async () => {
      const mockCategories = ['Basic Forms', 'Advanced Forms', 'Survey Templates'];
      vi.mocked(templateService.getTemplateCategories).mockResolvedValue(mockCategories);

      const result = await templatesResolvers.Query.templateCategories(
        {},
        {},
        mockContext
      );

      expect(templateService.getTemplateCategories).toHaveBeenCalled();
      expect(result).toEqual(mockCategories);
    });

    it('should return empty array when no categories exist', async () => {
      vi.mocked(templateService.getTemplateCategories).mockResolvedValue([]);

      const result = await templatesResolvers.Query.templateCategories(
        {},
        {},
        mockContext
      );

      expect(result).toEqual([]);
    });

    it('should throw error when user is not authenticated', async () => {
      const unauthContext = { user: undefined };

      await expect(
        templatesResolvers.Query.templateCategories({}, {}, unauthContext)
      ).rejects.toThrow('Authentication required');
    });

    it('should return sorted categories', async () => {
      const sortedCategories = ['Advanced Forms', 'Basic Forms', 'Surveys'];
      vi.mocked(templateService.getTemplateCategories).mockResolvedValue(sortedCategories);

      const result = await templatesResolvers.Query.templateCategories(
        {},
        {},
        mockContext
      );

      expect(result).toEqual(sortedCategories);
    });

    it('should throw generic error for non-GraphQL errors', async () => {
      vi.mocked(templateService.getTemplateCategories).mockRejectedValue(
        new Error('Database error')
      );

      await expect(
        templatesResolvers.Query.templateCategories({}, {}, mockContext)
      ).rejects.toThrow('Failed to fetch template categories');
    });
  });

  describe('Mutation: createTemplate', () => {
    const createInput = {
      name: 'New Template',
      description: 'A new template',
      category: 'Test Templates',
      formSchema: mockTemplate.formSchema,
    };

    it('should create template with admin role', async () => {
      vi.mocked(templateService.createTemplate).mockResolvedValue(mockTemplate as any);

      const result = await templatesResolvers.Mutation.createTemplate(
        {},
        { input: createInput },
        mockAdminContext
      );

      expect(templateService.createTemplate).toHaveBeenCalledWith(createInput);
      expect(result).toEqual(mockTemplate);
    });

    it('should throw error when user is not admin', async () => {
      await expect(
        templatesResolvers.Mutation.createTemplate({}, { input: createInput }, mockContext)
      ).rejects.toThrow('Admin privileges required');
    });

    it('should throw error when user is not authenticated', async () => {
      const unauthContext = { user: undefined };

      await expect(
        templatesResolvers.Mutation.createTemplate({}, { input: createInput }, unauthContext)
      ).rejects.toThrow('Authentication required');
    });

    it('should create template without optional fields', async () => {
      const minimalInput = {
        name: 'Minimal Template',
        formSchema: mockTemplate.formSchema,
      };
      const minimalTemplate = {
        ...mockTemplate,
        description: undefined,
        category: undefined,
      };
      vi.mocked(templateService.createTemplate).mockResolvedValue(minimalTemplate as any);

      const result = await templatesResolvers.Mutation.createTemplate(
        {},
        { input: minimalInput },
        mockAdminContext
      );

      expect(templateService.createTemplate).toHaveBeenCalledWith(minimalInput);
      expect(result).toEqual(minimalTemplate);
    });

    it('should create template with super admin role', async () => {
      const superAdminContext = {
        ...mockAdminContext,
        user: { ...mockAdminContext.user, role: 'superAdmin' as const },
      };
      vi.mocked(templateService.createTemplate).mockResolvedValue(mockTemplate as any);

      const result = await templatesResolvers.Mutation.createTemplate(
        {},
        { input: createInput },
        superAdminContext
      );

      expect(result).toEqual(mockTemplate);
    });

    it('should throw generic error for non-GraphQL errors', async () => {
      vi.mocked(templateService.createTemplate).mockRejectedValue(
        new Error('Database constraint violation')
      );

      await expect(
        templatesResolvers.Mutation.createTemplate({}, { input: createInput }, mockAdminContext)
      ).rejects.toThrow('Failed to create template');
    });

    it('should preserve GraphQLError from authentication', async () => {
      const authError = new GraphQLError('Invalid admin token');
      vi.mocked(templateService.createTemplate).mockRejectedValue(authError);

      await expect(
        templatesResolvers.Mutation.createTemplate({}, { input: createInput }, mockAdminContext)
      ).rejects.toThrow(authError);
    });
  });

  describe('Mutation: updateTemplate', () => {
    const updateInput = {
      name: 'Updated Template',
      description: 'Updated description',
      category: 'Updated Category',
      isActive: true,
    };

    it('should update template with admin role', async () => {
      const updatedTemplate = { ...mockTemplate, ...updateInput };
      vi.mocked(templateService.updateTemplate).mockResolvedValue(updatedTemplate as any);

      const result = await templatesResolvers.Mutation.updateTemplate(
        {},
        { id: 'template-123', input: updateInput },
        mockAdminContext
      );

      expect(templateService.updateTemplate).toHaveBeenCalledWith('template-123', updateInput);
      expect(result).toEqual(updatedTemplate);
    });

    it('should throw error when template not found', async () => {
      vi.mocked(templateService.updateTemplate).mockResolvedValue(null);

      await expect(
        templatesResolvers.Mutation.updateTemplate(
          {},
          { id: 'invalid-template', input: updateInput },
          mockAdminContext
        )
      ).rejects.toThrow('Template not found');
    });

    it('should throw error when user is not admin', async () => {
      await expect(
        templatesResolvers.Mutation.updateTemplate(
          {},
          { id: 'template-123', input: updateInput },
          mockContext
        )
      ).rejects.toThrow('Admin privileges required');
    });

    it('should throw error when user is not authenticated', async () => {
      const unauthContext = { user: undefined };

      await expect(
        templatesResolvers.Mutation.updateTemplate(
          {},
          { id: 'template-123', input: updateInput },
          unauthContext
        )
      ).rejects.toThrow('Authentication required');
    });

    it('should update only provided fields', async () => {
      const partialInput = { name: 'New Name' };
      const updatedTemplate = { ...mockTemplate, name: 'New Name' };
      vi.mocked(templateService.updateTemplate).mockResolvedValue(updatedTemplate as any);

      const result = await templatesResolvers.Mutation.updateTemplate(
        {},
        { id: 'template-123', input: partialInput },
        mockAdminContext
      );

      expect(templateService.updateTemplate).toHaveBeenCalledWith('template-123', partialInput);
      expect(result.name).toBe('New Name');
    });

    it('should update template schema', async () => {
      const newFormSchema = {
        ...mockTemplate.formSchema,
        pages: [{ id: 'new-page', title: 'New Page', fields: [], order: 0 }],
      };
      const schemaInput = { formSchema: newFormSchema };
      const updatedTemplate = { ...mockTemplate, formSchema: newFormSchema };
      vi.mocked(templateService.updateTemplate).mockResolvedValue(updatedTemplate as any);

      const result = await templatesResolvers.Mutation.updateTemplate(
        {},
        { id: 'template-123', input: schemaInput },
        mockAdminContext
      );

      expect(result.formSchema).toEqual(newFormSchema);
    });

    it('should deactivate template', async () => {
      const deactivateInput = { isActive: false };
      const deactivatedTemplate = { ...mockTemplate, isActive: false };
      vi.mocked(templateService.updateTemplate).mockResolvedValue(deactivatedTemplate as any);

      const result = await templatesResolvers.Mutation.updateTemplate(
        {},
        { id: 'template-123', input: deactivateInput },
        mockAdminContext
      );

      expect(result.isActive).toBe(false);
    });

    it('should throw generic error for non-GraphQL errors', async () => {
      vi.mocked(templateService.updateTemplate).mockRejectedValue(
        new Error('Update failed')
      );

      await expect(
        templatesResolvers.Mutation.updateTemplate(
          {},
          { id: 'template-123', input: updateInput },
          mockAdminContext
        )
      ).rejects.toThrow('Failed to update template');
    });

    it('should preserve GraphQLError from authentication', async () => {
      const authError = new GraphQLError('Admin session expired');
      vi.mocked(templateService.updateTemplate).mockRejectedValue(authError);

      await expect(
        templatesResolvers.Mutation.updateTemplate(
          {},
          { id: 'template-123', input: updateInput },
          mockAdminContext
        )
      ).rejects.toThrow(authError);
    });
  });

  describe('Mutation: deleteTemplate', () => {
    it('should delete template with admin role', async () => {
      vi.mocked(templateService.deleteTemplate).mockResolvedValue(true);

      const result = await templatesResolvers.Mutation.deleteTemplate(
        {},
        { id: 'template-123' },
        mockAdminContext
      );

      expect(templateService.deleteTemplate).toHaveBeenCalledWith('template-123');
      expect(result).toBe(true);
    });

    it('should return false when delete fails', async () => {
      vi.mocked(templateService.deleteTemplate).mockResolvedValue(false);

      const result = await templatesResolvers.Mutation.deleteTemplate(
        {},
        { id: 'invalid-template' },
        mockAdminContext
      );

      expect(result).toBe(false);
    });

    it('should throw error when user is not admin', async () => {
      await expect(
        templatesResolvers.Mutation.deleteTemplate({}, { id: 'template-123' }, mockContext)
      ).rejects.toThrow('Admin privileges required');
    });

    it('should throw error when user is not authenticated', async () => {
      const unauthContext = { user: undefined };

      await expect(
        templatesResolvers.Mutation.deleteTemplate({}, { id: 'template-123' }, unauthContext)
      ).rejects.toThrow('Authentication required');
    });

    it('should allow super admin to delete', async () => {
      const superAdminContext = {
        ...mockAdminContext,
        user: { ...mockAdminContext.user, role: 'superAdmin' as const },
      };
      vi.mocked(templateService.deleteTemplate).mockResolvedValue(true);

      const result = await templatesResolvers.Mutation.deleteTemplate(
        {},
        { id: 'template-123' },
        superAdminContext
      );

      expect(result).toBe(true);
    });

    it('should throw generic error for non-GraphQL errors', async () => {
      vi.mocked(templateService.deleteTemplate).mockRejectedValue(
        new Error('Deletion failed')
      );

      await expect(
        templatesResolvers.Mutation.deleteTemplate({}, { id: 'template-123' }, mockAdminContext)
      ).rejects.toThrow('Failed to delete template');
    });

    it('should preserve GraphQLError from authentication', async () => {
      const authError = new GraphQLError('Authorization failed');
      vi.mocked(templateService.deleteTemplate).mockRejectedValue(authError);

      await expect(
        templatesResolvers.Mutation.deleteTemplate({}, { id: 'template-123' }, mockAdminContext)
      ).rejects.toThrow(authError);
    });
  });

  describe('Mutation: createFormFromTemplate', () => {
    const createFormArgs = {
      templateId: 'template-123',
      organizationId: 'org-123',
      title: 'New Form from Template',
    };

    it('should create form from template for authenticated user', async () => {
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockResolvedValue(undefined);
      vi.mocked(templateService.getTemplateById).mockResolvedValue(mockTemplate as any);
      vi.mocked(formService.createForm).mockResolvedValue(mockForm as any);

      const result = await templatesResolvers.Mutation.createFormFromTemplate(
        {},
        createFormArgs,
        mockContext
      );

      expect(betterAuthMiddleware.requireOrganizationMembership).toHaveBeenCalledWith(
        mockContext.auth,
        'org-123'
      );
      expect(templateService.getTemplateById).toHaveBeenCalledWith('template-123');
      expect(formService.createForm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New Form from Template',
          organizationId: 'org-123',
          createdById: 'user-123',
          isPublished: false,
        }),
        expect.objectContaining({
          pages: mockTemplate.formSchema.pages,
          layout: mockTemplate.formSchema.layout,
        })
      );
      expect(result).toEqual(mockForm);
    });

    it('should throw error when template not found', async () => {
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockResolvedValue(undefined);
      vi.mocked(templateService.getTemplateById).mockResolvedValue(null);

      await expect(
        templatesResolvers.Mutation.createFormFromTemplate({}, createFormArgs, mockContext)
      ).rejects.toThrow('Template not found');
    });

    it('should throw error when user is not organization member', async () => {
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockRejectedValue(
        new GraphQLError('Not a member of this organization')
      );

      await expect(
        templatesResolvers.Mutation.createFormFromTemplate({}, createFormArgs, mockContext)
      ).rejects.toThrow('Not a member of this organization');
    });

    it('should throw error when user is not authenticated', async () => {
      const unauthContext = { auth: { user: null, isAuthenticated: false } as any };

      await expect(
        templatesResolvers.Mutation.createFormFromTemplate({}, createFormArgs, unauthContext as any)
      ).rejects.toThrow('Authentication required');
    });

    it('should copy template background image when present', async () => {
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockResolvedValue(undefined);
      vi.mocked(templateService.getTemplateById).mockResolvedValue(mockTemplateWithBg as any);
      vi.mocked(fileUploadService.copyFileForForm).mockResolvedValue({
        key: 'form-123/bg-image.jpg',
        url: 'https://cdn.example.com/form-123/bg-image.jpg',
        originalName: 'bg-image.jpg',
        size: 102400,
        mimeType: 'image/jpeg',
      } as any);
      vi.mocked(prisma.formFile.create).mockResolvedValue({} as any);
      vi.mocked(formService.createForm).mockResolvedValue(mockForm as any);

      const result = await templatesResolvers.Mutation.createFormFromTemplate(
        {},
        createFormArgs,
        mockContext
      );

      expect(fileUploadService.copyFileForForm).toHaveBeenCalledWith(
        'templateDirectory/bg-image.jpg',
        expect.any(String)
      );
      expect(prisma.formFile.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          key: 'form-123/bg-image.jpg',
          type: 'FormBackground',
          originalName: 'bg-image.jpg',
          url: 'https://cdn.example.com/form-123/bg-image.jpg',
          size: 102400,
          mimeType: 'image/jpeg',
        }),
      });
      expect(result).toEqual(mockForm);
    });

    it('should continue form creation if background image copy fails', async () => {
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockResolvedValue(undefined);
      vi.mocked(templateService.getTemplateById).mockResolvedValue(mockTemplateWithBg as any);
      vi.mocked(fileUploadService.copyFileForForm).mockRejectedValue(
        new Error('Image copy failed')
      );
      vi.mocked(formService.createForm).mockResolvedValue(mockForm as any);

      const result = await templatesResolvers.Mutation.createFormFromTemplate(
        {},
        createFormArgs,
        mockContext
      );

      // Form should still be created even if image copy fails
      expect(result).toEqual(mockForm);
    });

    it('should continue form creation if FormFile record creation fails', async () => {
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockResolvedValue(undefined);
      vi.mocked(templateService.getTemplateById).mockResolvedValue(mockTemplateWithBg as any);
      vi.mocked(fileUploadService.copyFileForForm).mockResolvedValue({
        key: 'form-123/bg-image.jpg',
        url: 'https://cdn.example.com/form-123/bg-image.jpg',
        originalName: 'bg-image.jpg',
        size: 102400,
        mimeType: 'image/jpeg',
      } as any);
      vi.mocked(prisma.formFile.create).mockRejectedValue(new Error('Database error'));
      vi.mocked(formService.createForm).mockResolvedValue(mockForm as any);

      const result = await templatesResolvers.Mutation.createFormFromTemplate(
        {},
        createFormArgs,
        mockContext
      );

      // Form should still be created even if FormFile creation fails
      expect(result).toEqual(mockForm);
      expect(fileUploadService.copyFileForForm).toHaveBeenCalled();
    });

    it('should handle template images from allOrgs directory', async () => {
      // Clear all previous mocks before this test
      vi.clearAllMocks();

      const allOrgsTemplate = {
        ...mockTemplate,
        formSchema: {
          ...mockTemplate.formSchema,
          layout: {
            ...mockTemplate.formSchema.layout,
            backgroundImageKey: 'allOrgs/shared-bg.jpg',
          },
        },
      };
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockResolvedValue(undefined);
      vi.mocked(templateService.getTemplateById).mockResolvedValue(allOrgsTemplate as any);
      vi.mocked(fileUploadService.copyFileForForm).mockResolvedValue({
        key: 'form-123/shared-bg.jpg',
        url: 'https://cdn.example.com/form-123/shared-bg.jpg',
        originalName: 'shared-bg.jpg',
        size: 51200,
        mimeType: 'image/jpeg',
      } as any);
      vi.mocked(prisma.formFile.create).mockResolvedValue({} as any);
      vi.mocked(formService.createForm).mockResolvedValue(mockForm as any);

      await templatesResolvers.Mutation.createFormFromTemplate(
        {},
        createFormArgs,
        mockContext
      );

      expect(fileUploadService.copyFileForForm).toHaveBeenCalledWith(
        'allOrgs/shared-bg.jpg',
        expect.any(String)
      );
    });

    it('should create FormFile record for existing non-template images', async () => {
      // Clear all previous mocks before this test
      vi.clearAllMocks();

      // Create a completely fresh template object to avoid mutations
      const existingImageTemplate = {
        id: 'template-existing',
        name: 'Template with Existing Image',
        description: 'Test template',
        category: 'Test',
        formSchema: {
          pages: [
            {
              id: 'page-1',
              title: 'Test Page',
              fields: [],
              order: 0,
            },
          ],
          layout: {
            theme: 'light' as const,
            textColor: '#000000',
            spacing: 'normal' as const,
            code: '',
            content: '',
            customBackGroundColor: '#FFFFFF',
            backgroundImageKey: 'org-456/form-789/background.jpg',
          },
          isShuffleEnabled: false,
        },
        isActive: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockResolvedValue(undefined);
      vi.mocked(templateService.getTemplateById).mockResolvedValue(existingImageTemplate as any);
      // Mock the first copy attempt (lines 187-219)
      vi.mocked(fileUploadService.copyFileForForm).mockResolvedValue({
        key: 'form-123/background-copy.jpg',
        url: 'https://cdn.example.com/form-123/background-copy.jpg',
        originalName: 'background.jpg',
        size: 102400,
        mimeType: 'image/jpeg',
      } as any);
      vi.mocked(prisma.formFile.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.formFile.create).mockResolvedValue({} as any);
      vi.mocked(formService.createForm).mockResolvedValue(mockForm as any);

      await templatesResolvers.Mutation.createFormFromTemplate(
        {},
        createFormArgs,
        mockContext
      );

      // The first copy happens in lines 187-219 which creates a FormFile
      // Then the second block (lines 232-309) checks if it's a template image
      // Since 'form-123/background-copy.jpg' (the copied key) doesn't contain
      // 'templateDirectory' or 'allOrgs', it goes to the else block and creates FormFile

      // So we expect 2 FormFile.create calls:
      // 1. From the first copy block (line 199)
      // 2. From the second check block for non-template images (line 287)
      expect(prisma.formFile.create).toHaveBeenCalledTimes(2);
    });

    it('should not create duplicate FormFile record if exists', async () => {
      // Clear all previous mocks before this test
      vi.clearAllMocks();

      // Create a completely fresh template object to avoid mutations
      const existingImageTemplate = {
        id: 'template-duplicate-test',
        name: 'Template with Duplicate Check',
        description: 'Test template',
        category: 'Test',
        formSchema: {
          pages: [
            {
              id: 'page-1',
              title: 'Test Page',
              fields: [],
              order: 0,
            },
          ],
          layout: {
            theme: 'light' as const,
            textColor: '#000000',
            spacing: 'normal' as const,
            code: '',
            content: '',
            customBackGroundColor: '#FFFFFF',
            backgroundImageKey: 'org-456/form-789/background.jpg',
          },
          isShuffleEnabled: false,
        },
        isActive: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockResolvedValue(undefined);
      vi.mocked(templateService.getTemplateById).mockResolvedValue(existingImageTemplate as any);
      // Mock the first copy attempt (lines 187-219)
      vi.mocked(fileUploadService.copyFileForForm).mockResolvedValue({
        key: 'form-123/background-copy.jpg',
        url: 'https://cdn.example.com/form-123/background-copy.jpg',
        originalName: 'background.jpg',
        size: 102400,
        mimeType: 'image/jpeg',
      } as any);
      // Mock that FormFile already exists
      vi.mocked(prisma.formFile.findFirst).mockResolvedValue({
        id: 'existing-file',
        key: 'form-123/background-copy.jpg',
        type: 'FormBackground',
      } as any);
      vi.mocked(prisma.formFile.create).mockResolvedValue({} as any);
      vi.mocked(formService.createForm).mockResolvedValue(mockForm as any);

      await templatesResolvers.Mutation.createFormFromTemplate(
        {},
        createFormArgs,
        mockContext
      );

      // The first copy happens in lines 187-219 which creates a FormFile (1 call)
      // Then the second block checks if file already exists and doesn't create duplicate
      // So we expect only 1 FormFile.create call from the first block
      expect(prisma.formFile.create).toHaveBeenCalledTimes(1);
    });

    it('should continue if FormFile creation fails', async () => {
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockResolvedValue(undefined);
      vi.mocked(templateService.getTemplateById).mockResolvedValue(mockTemplateWithBg as any);
      vi.mocked(fileUploadService.copyFileForForm).mockResolvedValue({
        key: 'form-123/bg-image.jpg',
        url: 'https://cdn.example.com/form-123/bg-image.jpg',
        originalName: 'bg-image.jpg',
        size: 102400,
        mimeType: 'image/jpeg',
      } as any);
      vi.mocked(prisma.formFile.create).mockRejectedValue(new Error('Database error'));
      vi.mocked(formService.createForm).mockResolvedValue(mockForm as any);

      const result = await templatesResolvers.Mutation.createFormFromTemplate(
        {},
        createFormArgs,
        mockContext
      );

      expect(result).toEqual(mockForm);
    });

    it('should set form description from template name', async () => {
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockResolvedValue(undefined);
      vi.mocked(templateService.getTemplateById).mockResolvedValue(mockTemplate as any);
      vi.mocked(formService.createForm).mockResolvedValue(mockForm as any);

      await templatesResolvers.Mutation.createFormFromTemplate(
        {},
        createFormArgs,
        mockContext
      );

      expect(formService.createForm).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Created from template: Contact Form',
        }),
        expect.any(Object)
      );
    });

    it('should throw generic error for non-GraphQL errors', async () => {
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockResolvedValue(undefined);
      vi.mocked(templateService.getTemplateById).mockResolvedValue(mockTemplate as any);
      vi.mocked(formService.createForm).mockRejectedValue(
        new Error('Form creation failed')
      );

      await expect(
        templatesResolvers.Mutation.createFormFromTemplate({}, createFormArgs, mockContext)
      ).rejects.toThrow('Failed to create form from template');
    });

    it('should preserve GraphQLError from authentication', async () => {
      const authError = new GraphQLError('Invalid organization access');
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockRejectedValue(authError);

      await expect(
        templatesResolvers.Mutation.createFormFromTemplate({}, createFormArgs, mockContext)
      ).rejects.toThrow(authError);
    });

    it('should clone template schema without modifying original', async () => {
      const originalSchema = { ...mockTemplate.formSchema };
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockResolvedValue(undefined);
      vi.mocked(templateService.getTemplateById).mockResolvedValue(mockTemplate as any);
      vi.mocked(formService.createForm).mockResolvedValue(mockForm as any);

      await templatesResolvers.Mutation.createFormFromTemplate(
        {},
        createFormArgs,
        mockContext
      );

      // Original template schema should remain unchanged
      expect(mockTemplate.formSchema).toEqual(originalSchema);
    });

    it('should generate unique form ID for each form creation', async () => {
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockResolvedValue(undefined);
      vi.mocked(templateService.getTemplateById).mockResolvedValue(mockTemplate as any);
      vi.mocked(formService.createForm).mockResolvedValue(mockForm as any);

      await templatesResolvers.Mutation.createFormFromTemplate(
        {},
        createFormArgs,
        mockContext
      );

      expect(formService.createForm).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
        }),
        expect.any(Object)
      );
    });
  });

  describe('Authentication Edge Cases', () => {
    it('should handle missing user in context for queries', async () => {
      const emptyContext = { auth: { user: null, isAuthenticated: false } as any };

      await expect(
        templatesResolvers.Query.templates({}, {}, emptyContext as any)
      ).rejects.toThrow('Authentication required');
    });

    it('should handle undefined auth context for queries', async () => {
      const undefinedAuthContext = {};

      await expect(
        templatesResolvers.Query.template({}, { id: 'template-123' }, undefinedAuthContext)
      ).rejects.toThrow('Authentication required');
    });

    it('should reject regular user trying to create template', async () => {
      const input = {
        name: 'Unauthorized Template',
        formSchema: mockTemplate.formSchema,
      };

      await expect(
        templatesResolvers.Mutation.createTemplate({}, { input }, mockContext)
      ).rejects.toThrow('Admin privileges required');
    });

    it('should reject regular user trying to update template', async () => {
      const input = { name: 'Updated Name' };

      await expect(
        templatesResolvers.Mutation.updateTemplate(
          {},
          { id: 'template-123', input },
          mockContext
        )
      ).rejects.toThrow('Admin privileges required');
    });

    it('should reject regular user trying to delete template', async () => {
      await expect(
        templatesResolvers.Mutation.deleteTemplate({}, { id: 'template-123' }, mockContext)
      ).rejects.toThrow('Admin privileges required');
    });
  });

  describe('Schema Handling', () => {
    it('should handle template with empty pages array', async () => {
      const emptyPagesTemplate = {
        ...mockTemplate,
        formSchema: {
          ...mockTemplate.formSchema,
          pages: [],
        },
      };
      vi.mocked(templateService.getTemplateById).mockResolvedValue(emptyPagesTemplate as any);

      const result = await templatesResolvers.Query.template(
        {},
        { id: 'template-123' },
        mockContext
      );

      expect(result.formSchema.pages).toEqual([]);
    });

    it('should handle template with multiple pages', async () => {
      const multiPageTemplate = {
        ...mockTemplate,
        formSchema: {
          ...mockTemplate.formSchema,
          pages: [
            { id: 'page-1', title: 'Page 1', fields: [], order: 0 },
            { id: 'page-2', title: 'Page 2', fields: [], order: 1 },
            { id: 'page-3', title: 'Page 3', fields: [], order: 2 },
          ],
        },
      };
      vi.mocked(templateService.getTemplateById).mockResolvedValue(multiPageTemplate as any);

      const result = await templatesResolvers.Query.template(
        {},
        { id: 'template-123' },
        mockContext
      );

      expect(result.formSchema.pages).toHaveLength(3);
    });

    it('should handle template with shuffle enabled', async () => {
      const shuffleTemplate = {
        ...mockTemplate,
        formSchema: {
          ...mockTemplate.formSchema,
          isShuffleEnabled: true,
        },
      };
      vi.mocked(templateService.getTemplateById).mockResolvedValue(shuffleTemplate as any);

      const result = await templatesResolvers.Query.template(
        {},
        { id: 'template-123' },
        mockContext
      );

      expect(result.formSchema.isShuffleEnabled).toBe(true);
    });

    it('should handle template with custom layout settings', async () => {
      const customLayoutTemplate = {
        ...mockTemplate,
        formSchema: {
          ...mockTemplate.formSchema,
          layout: {
            theme: 'dark' as const,
            textColor: '#FFFFFF',
            spacing: 'spacious' as const,
            code: 'custom-code',
            content: 'custom-content',
            customBackGroundColor: '#1a1a1a',
            customCTAButtonName: 'Submit Now',
            backgroundImageKey: 'custom-bg.jpg',
          },
        },
      };
      vi.mocked(templateService.getTemplateById).mockResolvedValue(customLayoutTemplate as any);

      const result = await templatesResolvers.Query.template(
        {},
        { id: 'template-123' },
        mockContext
      );

      expect(result.formSchema.layout.theme).toBe('dark');
      expect(result.formSchema.layout.customCTAButtonName).toBe('Submit Now');
    });
  });

  describe('Category Filtering', () => {
    it('should filter templates by exact category match', async () => {
      const categoryTemplates = [mockTemplate];
      vi.mocked(templateService.getAllTemplates).mockResolvedValue(categoryTemplates as any);

      await templatesResolvers.Query.templates(
        {},
        { category: 'Basic Forms' },
        mockContext
      );

      expect(templateService.getAllTemplates).toHaveBeenCalledWith('Basic Forms');
    });

    it('should return templates from specific category only', async () => {
      const basicFormTemplates = [mockTemplate];
      vi.mocked(templateService.getAllTemplates).mockResolvedValue(basicFormTemplates as any);

      const result = await templatesResolvers.Query.templates(
        {},
        { category: 'Basic Forms' },
        mockContext
      );

      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('Basic Forms');
    });

    it('should handle case-sensitive category names', async () => {
      vi.mocked(templateService.getAllTemplates).mockResolvedValue([]);

      const result = await templatesResolvers.Query.templates(
        {},
        { category: 'basic forms' },
        mockContext
      );

      expect(templateService.getAllTemplates).toHaveBeenCalledWith('basic forms');
      expect(result).toEqual([]);
    });
  });
});

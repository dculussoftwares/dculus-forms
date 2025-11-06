import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formsResolvers } from '../forms.js';
import { GraphQLError } from 'graphql';
import * as formService from '../../../services/formService.js';
import * as templateService from '../../../services/templateService.js';
import * as formMetadataService from '../../../services/formMetadataService.js';
import * as betterAuthMiddleware from '../../../middleware/better-auth-middleware.js';
import * as formSharingResolvers from '../formSharing.js';
import * as fileUploadService from '../../../services/fileUploadService.js';
import * as hocuspocusService from '../../../services/hocuspocus.js';
import * as usageService from '../../../subscriptions/usageService.js';
import { prisma } from '../../../lib/prisma.js';

// Mock all dependencies
vi.mock('../../../services/formService.js');
vi.mock('../../../services/templateService.js');
vi.mock('../../../services/formMetadataService.js');
vi.mock('../../../middleware/better-auth-middleware.js');
vi.mock('../formSharing.js');
vi.mock('../../../services/fileUploadService.js');
vi.mock('../../../services/hocuspocus.js');
vi.mock('../../../subscriptions/usageService.js');
vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    response: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    formViewAnalytics: {
      count: vi.fn(),
    },
    formSubmissionAnalytics: {
      findMany: vi.fn(),
    },
    formFile: {
      create: vi.fn(),
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
vi.mock('@dculus/utils', async () => {
  const actual = await vi.importActual<typeof import('@dculus/utils')>('@dculus/utils');
  return {
    ...actual,
    generateId: vi.fn(() => 'generated-form-id'),
  };
});

describe('Forms Resolvers', () => {
  const mockContext = {
    auth: {
      user: {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      },
      session: { id: 'session-123' },
    },
  };

  const mockForm = {
    id: 'form-123',
    title: 'Test Form',
    description: 'Test Description',
    shortUrl: 'abc12345',
    isPublished: true,
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

  describe('Query: form', () => {
    it('should return form when user has access', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: true,
        form: mockForm as any,
      });

      const result = await formsResolvers.Query.form(
        {},
        { id: 'form-123' },
        mockContext
      );

      expect(betterAuthMiddleware.requireAuth).toHaveBeenCalledWith(mockContext.auth);
      expect(formSharingResolvers.checkFormAccess).toHaveBeenCalledWith(
        'user-123',
        'form-123',
        formSharingResolvers.PermissionLevel.VIEWER
      );
      expect(result).toEqual(mockForm);
    });

    it('should throw error when user lacks access', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: false,
        form: null,
      });

      await expect(
        formsResolvers.Query.form({}, { id: 'form-123' }, mockContext)
      ).rejects.toThrow(GraphQLError);
      await expect(
        formsResolvers.Query.form({}, { id: 'form-123' }, mockContext)
      ).rejects.toThrow('Access denied: You do not have permission to view this form');
    });
  });

  describe('Query: formByShortUrl', () => {
    it('should return published form when valid', async () => {
      vi.mocked(formService.getFormByShortUrl).mockResolvedValue(mockForm as any);
      vi.mocked(usageService.checkUsageExceeded).mockResolvedValue({
        viewsExceeded: false,
        submissionsExceeded: false,
      });

      const result = await formsResolvers.Query.formByShortUrl(
        {},
        { shortUrl: 'abc12345' },
        {} as any
      );

      expect(formService.getFormByShortUrl).toHaveBeenCalledWith('abc12345');
      expect(result).toEqual(mockForm);
    });

    it('should throw error when form not found', async () => {
      vi.mocked(formService.getFormByShortUrl).mockResolvedValue(null);

      await expect(
        formsResolvers.Query.formByShortUrl({}, { shortUrl: 'invalid' }, {} as any)
      ).rejects.toThrow('Form not found');
    });

    it('should throw error when form not published', async () => {
      vi.mocked(formService.getFormByShortUrl).mockResolvedValue({
        ...mockForm,
        isPublished: false,
      } as any);

      await expect(
        formsResolvers.Query.formByShortUrl({}, { shortUrl: 'abc12345' }, {} as any)
      ).rejects.toThrow('Form is not published');
    });

    it('should throw error when view limit exceeded', async () => {
      vi.mocked(formService.getFormByShortUrl).mockResolvedValue(mockForm as any);
      vi.mocked(usageService.checkUsageExceeded).mockResolvedValue({
        viewsExceeded: true,
        submissionsExceeded: false,
      });

      await expect(
        formsResolvers.Query.formByShortUrl({}, { shortUrl: 'abc12345' }, {} as any)
      ).rejects.toThrow("Form view limit exceeded for this organization's subscription plan");
    });

    it('should throw error when max responses reached', async () => {
      const formWithLimits = {
        ...mockForm,
        settings: {
          submissionLimits: {
            maxResponses: { enabled: true, limit: 100 },
          },
        },
      };
      vi.mocked(formService.getFormByShortUrl).mockResolvedValue(formWithLimits as any);
      vi.mocked(usageService.checkUsageExceeded).mockResolvedValue({
        viewsExceeded: false,
        submissionsExceeded: false,
      });
      vi.mocked(prisma.response.count).mockResolvedValue(100);

      await expect(
        formsResolvers.Query.formByShortUrl({}, { shortUrl: 'abc12345' }, {} as any)
      ).rejects.toThrow('Form has reached its maximum response limit');
    });

    it('should throw error when submission time window not yet started', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const formWithTimeWindow = {
        ...mockForm,
        settings: {
          submissionLimits: {
            timeWindow: {
              enabled: true,
              startDate: futureDate.toISOString().split('T')[0],
            },
          },
        },
      };
      vi.mocked(formService.getFormByShortUrl).mockResolvedValue(formWithTimeWindow as any);
      vi.mocked(usageService.checkUsageExceeded).mockResolvedValue({
        viewsExceeded: false,
        submissionsExceeded: false,
      });

      await expect(
        formsResolvers.Query.formByShortUrl({}, { shortUrl: 'abc12345' }, {} as any)
      ).rejects.toThrow('Form is not yet open for submissions');
    });

    it('should throw error when submission time window has ended', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      const formWithTimeWindow = {
        ...mockForm,
        settings: {
          submissionLimits: {
            timeWindow: {
              enabled: true,
              endDate: pastDate.toISOString().split('T')[0],
            },
          },
        },
      };
      vi.mocked(formService.getFormByShortUrl).mockResolvedValue(formWithTimeWindow as any);
      vi.mocked(usageService.checkUsageExceeded).mockResolvedValue({
        viewsExceeded: false,
        submissionsExceeded: false,
      });

      await expect(
        formsResolvers.Query.formByShortUrl({}, { shortUrl: 'abc12345' }, {} as any)
      ).rejects.toThrow('Form submission period has ended');
    });
  });

  describe('Form: metadata', () => {
    it('should return form metadata with background image URL', async () => {
      const mockMetadata = {
        pageCount: 3,
        fieldCount: 10,
        backgroundImageKey: 'test-key',
        lastUpdated: new Date('2024-01-01'),
      };
      vi.mocked(formMetadataService.getFormMetadata).mockResolvedValue(mockMetadata);
      vi.mocked(formMetadataService.constructBackgroundImageUrl).mockReturnValue('https://cdn.example.com/test-key');

      const result = await formsResolvers.Form.metadata({ id: 'form-123' });

      expect(result).toEqual({
        pageCount: 3,
        fieldCount: 10,
        backgroundImageKey: 'test-key',
        backgroundImageUrl: 'https://cdn.example.com/test-key',
        lastUpdated: mockMetadata.lastUpdated.toISOString(),
      });
    });

    it('should return null when no metadata found', async () => {
      vi.mocked(formMetadataService.getFormMetadata).mockResolvedValue(null);

      const result = await formsResolvers.Form.metadata({ id: 'form-123' });

      expect(result).toBeNull();
    });
  });

  describe('Form: formSchema', () => {
    it('should return form schema from hocuspocus', async () => {
      const mockSchema = { pages: [], layout: {} };
      vi.mocked(hocuspocusService.getFormSchemaFromHocuspocus).mockResolvedValue(mockSchema);

      const result = await formsResolvers.Form.formSchema({ id: 'form-123' });

      expect(hocuspocusService.getFormSchemaFromHocuspocus).toHaveBeenCalledWith('form-123');
      expect(result).toEqual(mockSchema);
    });
  });

  describe('Form: settings', () => {
    it('should parse and return JSON settings', () => {
      const settings = { theme: 'dark', spacing: 'compact' };
      const result = formsResolvers.Form.settings({ settings: JSON.stringify(settings) });

      expect(result).toEqual(settings);
    });

    it('should return null when no settings', () => {
      const result = formsResolvers.Form.settings({ settings: null });

      expect(result).toBeNull();
    });
  });

  describe('Form: responseCount', () => {
    it('should return total response count', async () => {
      vi.mocked(prisma.response.count).mockResolvedValue(42);

      const result = await formsResolvers.Form.responseCount({ id: 'form-123' });

      expect(prisma.response.count).toHaveBeenCalledWith({
        where: { formId: 'form-123' },
      });
      expect(result).toBe(42);
    });
  });

  describe('Form: dashboardStats', () => {
    it('should return dashboard statistics', async () => {
      vi.mocked(prisma.response.count)
        .mockResolvedValueOnce(5)  // today
        .mockResolvedValueOnce(20) // this week
        .mockResolvedValueOnce(50) // this month
        .mockResolvedValueOnce(100); // total

      vi.mocked(prisma.formViewAnalytics.count).mockResolvedValue(200);

      vi.mocked(prisma.response.findMany).mockResolvedValue([
        { id: 'resp-1' },
        { id: 'resp-2' },
      ] as any);

      vi.mocked(prisma.formSubmissionAnalytics.findMany).mockResolvedValue([
        { completionTimeSeconds: 120 },
        { completionTimeSeconds: 180 },
        { completionTimeSeconds: 150 },
      ] as any);

      const result = await formsResolvers.Form.dashboardStats({ id: 'form-123' });

      expect(result).toEqual({
        averageCompletionTime: 150,
        responseRate: 50,
        responsesToday: 5,
        responsesThisWeek: 20,
        responsesThisMonth: 50,
      });
    });

    it('should handle null completion times', async () => {
      vi.mocked(prisma.response.count)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(100);

      vi.mocked(prisma.formViewAnalytics.count).mockResolvedValue(200);
      vi.mocked(prisma.response.findMany).mockResolvedValue([]);
      vi.mocked(prisma.formSubmissionAnalytics.findMany).mockResolvedValue([]);

      const result = await formsResolvers.Form.dashboardStats({ id: 'form-123' });

      expect(result.averageCompletionTime).toBeNull();
    });
  });

  describe('Mutation: createForm', () => {
    const mockTemplate = {
      id: 'template-123',
      title: 'Template',
      formSchema: {
        pages: [],
        layout: {
          theme: 'light',
          backgroundImageKey: '',
        },
      },
    };

    it('should create form from template', async () => {
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockResolvedValue(undefined);
      vi.mocked(templateService.getTemplateById).mockResolvedValue(mockTemplate as any);
      vi.mocked(formService.createForm).mockResolvedValue(mockForm as any);

      const input = {
        templateId: 'template-123',
        title: 'New Form',
        description: 'New Description',
        organizationId: 'org-123',
      };

      const result = await formsResolvers.Mutation.createForm({}, { input }, mockContext);

      expect(betterAuthMiddleware.requireOrganizationMembership).toHaveBeenCalledWith(
        mockContext.auth,
        'org-123'
      );
      expect(templateService.getTemplateById).toHaveBeenCalledWith('template-123');
      expect(formService.createForm).toHaveBeenCalled();
      expect(result).toEqual(mockForm);
    });

    it('should copy template background image', async () => {
      const templateWithBg = {
        ...mockTemplate,
        formSchema: {
          pages: [],
          layout: {
            theme: 'light',
            backgroundImageKey: 'template-bg-key',
          },
        },
      };
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockResolvedValue(undefined);
      vi.mocked(templateService.getTemplateById).mockResolvedValue(templateWithBg as any);
      vi.mocked(fileUploadService.copyFileForForm).mockResolvedValue({
        key: 'new-bg-key',
        url: 'https://cdn.example.com/new-bg-key',
        originalName: 'background.jpg',
        size: 1024,
        mimeType: 'image/jpeg',
      });
      vi.mocked(prisma.formFile.create).mockResolvedValue({} as any);
      vi.mocked(formService.createForm).mockResolvedValue(mockForm as any);

      const input = {
        templateId: 'template-123',
        title: 'New Form',
        organizationId: 'org-123',
      };

      await formsResolvers.Mutation.createForm({}, { input }, mockContext);

      expect(fileUploadService.copyFileForForm).toHaveBeenCalledWith(
        'template-bg-key',
        'generated-form-id'
      );
      expect(prisma.formFile.create).toHaveBeenCalled();
    });

    it('should throw error when template not found', async () => {
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockResolvedValue(undefined);
      vi.mocked(templateService.getTemplateById).mockResolvedValue(null);

      const input = {
        templateId: 'invalid-template',
        title: 'New Form',
        organizationId: 'org-123',
      };

      await expect(
        formsResolvers.Mutation.createForm({}, { input }, mockContext)
      ).rejects.toThrow('Template not found');
    });
  });

  describe('Mutation: updateForm', () => {
    it('should update form with editor permissions', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: true,
        form: mockForm as any,
      });
      vi.mocked(formService.updateForm).mockResolvedValue({ ...mockForm, title: 'Updated' } as any);

      const input = { title: 'Updated' };
      const result = await formsResolvers.Mutation.updateForm(
        {},
        { id: 'form-123', input },
        mockContext
      );

      expect(formSharingResolvers.checkFormAccess).toHaveBeenCalledWith(
        'user-123',
        'form-123',
        formSharingResolvers.PermissionLevel.EDITOR
      );
      expect(result.title).toBe('Updated');
    });

    it('should require owner permissions for critical changes', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: true,
        form: mockForm as any,
      });
      vi.mocked(formService.updateForm).mockResolvedValue({ ...mockForm, isPublished: true } as any);

      const input = { isPublished: true };
      await formsResolvers.Mutation.updateForm({}, { id: 'form-123', input }, mockContext);

      expect(formSharingResolvers.checkFormAccess).toHaveBeenCalledWith(
        'user-123',
        'form-123',
        formSharingResolvers.PermissionLevel.OWNER
      );
    });

    it('should throw error when access denied', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: false,
        form: null,
      });

      await expect(
        formsResolvers.Mutation.updateForm({}, { id: 'form-123', input: { title: 'New' } }, mockContext)
      ).rejects.toThrow(GraphQLError);
    });
  });

  describe('Mutation: deleteForm', () => {
    it('should delete form with owner permissions', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: true,
        form: mockForm as any,
      });
      vi.mocked(formService.deleteForm).mockResolvedValue(true);

      const result = await formsResolvers.Mutation.deleteForm(
        {},
        { id: 'form-123' },
        mockContext
      );

      expect(formSharingResolvers.checkFormAccess).toHaveBeenCalledWith(
        'user-123',
        'form-123',
        formSharingResolvers.PermissionLevel.OWNER
      );
      expect(result).toBe(true);
    });

    it('should throw error when user is not owner', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: false,
        form: null,
      });

      await expect(
        formsResolvers.Mutation.deleteForm({}, { id: 'form-123' }, mockContext)
      ).rejects.toThrow('Access denied: Only the form owner can delete this form');
    });
  });

  describe('Mutation: regenerateShortUrl', () => {
    it('should regenerate short URL with owner permissions', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: true,
        form: mockForm as any,
      });
      vi.mocked(formService.regenerateShortUrl).mockResolvedValue({
        ...mockForm,
        shortUrl: 'newUrl123',
      } as any);

      const result = await formsResolvers.Mutation.regenerateShortUrl(
        {},
        { id: 'form-123' },
        mockContext
      );

      expect(result.shortUrl).toBe('newUrl123');
    });

    it('should throw error when user is not owner', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: false,
        form: null,
      });

      await expect(
        formsResolvers.Mutation.regenerateShortUrl({}, { id: 'form-123' }, mockContext)
      ).rejects.toThrow(GraphQLError);
    });
  });

  describe('Mutation: duplicateForm', () => {
    it('should duplicate form with editor permissions', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: true,
        form: mockForm as any,
      });
      vi.mocked(formService.duplicateForm).mockResolvedValue({
        ...mockForm,
        id: 'form-456',
        title: 'Test Form (Copy)',
      } as any);

      const result = await formsResolvers.Mutation.duplicateForm(
        {},
        { id: 'form-123' },
        mockContext
      );

      expect(result.id).toBe('form-456');
      expect(result.title).toBe('Test Form (Copy)');
    });

    it('should throw error when access denied', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: false,
        form: null,
      });

      await expect(
        formsResolvers.Mutation.duplicateForm({}, { id: 'form-123' }, mockContext)
      ).rejects.toThrow('Access denied: You do not have permission to duplicate this form');
    });
  });
});

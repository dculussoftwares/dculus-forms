import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getAllForms,
  getFormById,
  getFormByShortUrl,
  createForm,
  updateForm,
  deleteForm,
  regenerateShortUrl,
  duplicateForm,
} from '../formService.js';
import { formRepository } from '../../repositories/index.js';
import { logger } from '../../lib/logger.js';

import { initializeHocuspocusDocument, getFormSchemaFromHocuspocus } from '../hocuspocus.js';
import { sendFormPublishedNotification } from '../emailService.js';
import { checkFormAccess } from '../../graphql/resolvers/formSharing.js';
import { copyFileForForm } from '../fileUploadService.js';
import { generateShortUrl, generateId } from '@dculus/utils';
import { ThemeType, SpacingType, LayoutCode, PageModeType } from '@dculus/types';

// Mock all dependencies
vi.mock('../../repositories/index.js');
vi.mock('../hocuspocus.js');
vi.mock('../emailService.js');
vi.mock('../../graphql/resolvers/formSharing.js');
vi.mock('../fileUploadService.js');
vi.mock('@dculus/utils', async () => {
  const actual = await vi.importActual<typeof import('@dculus/utils')>('@dculus/utils');
  return {
    ...actual,
    generateShortUrl: vi.fn(),
    generateId: vi.fn(),
  };
});

describe('Form Service', () => {
  const mockForm = {
    id: 'form-123',
    title: 'Test Form',
    description: 'Test Description',
    shortUrl: 'abc12345',
    formSchema: {},
    isPublished: false,
    organizationId: 'org-123',
    createdById: 'user-123',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    settings: null,
    createdBy: {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
    },
    organization: {
      members: [],
    },
    permissions: [],
  };

  const mockFormWithAccess = {
    ...mockForm,
    organization: {
      members: [{
        userId: 'user-123',
        user: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          emailVerified: true,
          image: null,
          role: 'user',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      }],
    },
    permissions: [],
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getAllForms', () => {
    it('should return all forms for an organization', async () => {
      const mockForms = [mockForm, { ...mockForm, id: 'form-456' }];
      vi.mocked(formRepository.listByOrganization).mockResolvedValue(mockForms as any);

      const result = await getAllForms('org-123');

      expect(formRepository.listByOrganization).toHaveBeenCalledWith('org-123');
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('form-123');
    });

    it('should handle forms without description', async () => {
      const formWithoutDesc = { ...mockForm, description: null };
      vi.mocked(formRepository.listByOrganization).mockResolvedValue([formWithoutDesc] as any);

      const result = await getAllForms('org-123');

      expect(result[0].description).toBeUndefined();
    });

    it('should handle undefined organizationId', async () => {
      vi.mocked(formRepository.listByOrganization).mockResolvedValue([]);

      const result = await getAllForms();

      expect(formRepository.listByOrganization).toHaveBeenCalledWith(undefined);
      expect(result).toEqual([]);
    });
  });

  describe('getFormById', () => {
    it('should return form by id', async () => {
      vi.mocked(formRepository.findById).mockResolvedValue(mockForm as any);

      const result = await getFormById('form-123');

      expect(formRepository.findById).toHaveBeenCalledWith('form-123');
      expect(result).toEqual({
        ...mockForm,
        description: mockForm.description,
      });
    });

    it('should return null when form not found', async () => {
      vi.mocked(formRepository.findById).mockResolvedValue(null);

      const result = await getFormById('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle errors and return null', async () => {
      const loggerError = vi.spyOn(logger, 'error').mockImplementation(() => {});
      vi.mocked(formRepository.findById).mockRejectedValue(new Error('Database error'));

      const result = await getFormById('form-123');

      expect(result).toBeNull();
      expect(loggerError).toHaveBeenCalledWith('Error fetching form by ID:', expect.any(Error));
      loggerError.mockRestore();
    });

    it('should convert null description to undefined', async () => {
      const formWithNullDesc = { ...mockForm, description: null };
      vi.mocked(formRepository.findById).mockResolvedValue(formWithNullDesc as any);

      const result = await getFormById('form-123');

      expect(result?.description).toBeUndefined();
    });
  });

  describe('getFormByShortUrl', () => {
    it('should return form by short URL', async () => {
      vi.mocked(formRepository.findByShortUrl).mockResolvedValue(mockForm as any);

      const result = await getFormByShortUrl('abc12345');

      expect(formRepository.findByShortUrl).toHaveBeenCalledWith('abc12345');
      expect(result?.shortUrl).toBe('abc12345');
    });

    it('should return null when short URL not found', async () => {
      vi.mocked(formRepository.findByShortUrl).mockResolvedValue(null);

      const result = await getFormByShortUrl('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle errors and return null', async () => {
      const loggerError = vi.spyOn(logger, 'error').mockImplementation(() => {});
      vi.mocked(formRepository.findByShortUrl).mockRejectedValue(new Error('Database error'));

      const result = await getFormByShortUrl('abc12345');

      expect(result).toBeNull();
      expect(loggerError).toHaveBeenCalledWith('Error fetching form by short URL:', expect.any(Error));
      loggerError.mockRestore();
    });
  });

  describe('createForm', () => {
    beforeEach(() => {
      vi.mocked(generateShortUrl).mockResolvedValue('abc12345');
      vi.mocked(formRepository.findByShortUrl).mockResolvedValue(null);
      vi.mocked(formRepository.createForm).mockResolvedValue(mockForm as any);
      vi.mocked(formRepository.createOwnerPermission).mockResolvedValue({} as any);
      vi.mocked(initializeHocuspocusDocument).mockResolvedValue(undefined);
    });

    it('should create form with default schema', async () => {
      const formData = {
        id: 'form-123',
        title: 'New Form',
        description: 'Test',
        shortUrl: '',
        isPublished: false,
        organizationId: 'org-123',
        createdById: 'user-123',
      };

      const result = await createForm(formData);

      expect(generateShortUrl).toHaveBeenCalledWith(8);
      expect(formRepository.createForm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New Form',
          shortUrl: 'abc12345',
          formSchema: {},
        })
      );
      expect(result.id).toBe('form-123');
    });

    it('should generate unique short URL with retries', async () => {
      vi.mocked(generateShortUrl)
        .mockResolvedValueOnce('existing')
        .mockResolvedValueOnce('abc12345');
      vi.mocked(formRepository.findByShortUrl)
        .mockResolvedValueOnce(mockForm as any)
        .mockResolvedValueOnce(null);

      await createForm({
        id: 'form-123',
        title: 'New Form',
        shortUrl: '',
        isPublished: false,
        organizationId: 'org-123',
        createdById: 'user-123',
      });

      expect(generateShortUrl).toHaveBeenCalledTimes(2);
    });

    it('should use longer short URL after max attempts', async () => {
      // Mock first 10 attempts to return existing URLs
      for (let i = 0; i < 10; i++) {
        vi.mocked(generateShortUrl).mockResolvedValueOnce('existing' + i);
        vi.mocked(formRepository.findByShortUrl).mockResolvedValueOnce(mockForm as any);
      }

      // 11th attempt with 12-char URL succeeds
      vi.mocked(generateShortUrl).mockResolvedValueOnce('longer12char');
      vi.mocked(formRepository.findByShortUrl).mockResolvedValueOnce(null);

      await createForm({
        id: 'form-123',
        title: 'New Form',
        shortUrl: '',
        isPublished: false,
        organizationId: 'org-123',
        createdById: 'user-123',
      });

      expect(generateShortUrl).toHaveBeenLastCalledWith(12);
      expect(generateShortUrl).toHaveBeenCalledTimes(11);
    });

    it('should create OWNER permission for form creator', async () => {
      await createForm({
        id: 'form-123',
        title: 'New Form',
        shortUrl: '',
        isPublished: false,
        organizationId: 'org-123',
        createdById: 'user-123',
      });

      expect(formRepository.createOwnerPermission).toHaveBeenCalledWith(
        expect.objectContaining({
          formId: 'form-123',
          userId: 'user-123',
          permission: 'OWNER',
          grantedById: 'user-123',
        })
      );
    });

    it('should initialize Hocuspocus document with default schema', async () => {
      await createForm({
        id: 'form-123',
        title: 'New Form',
        shortUrl: '',
        isPublished: false,
        organizationId: 'org-123',
        createdById: 'user-123',
      });

      expect(initializeHocuspocusDocument).toHaveBeenCalledWith(
        'form-123',
        expect.objectContaining({
          pages: [],
          isShuffleEnabled: false,
          layout: expect.objectContaining({
            theme: ThemeType.LIGHT,
            spacing: SpacingType.NORMAL,
            code: 'L1',
          }),
        })
      );
    });

    it('should initialize Hocuspocus with template schema if provided', async () => {
      const templateSchema = {
        pages: [{ id: 'page-1', title: 'Page 1', fields: [], order: 0 }],
        layout: {
          theme: ThemeType.DARK,
          textColor: '#ffffff',
          spacing: SpacingType.COMPACT,
          code: 'L2' as LayoutCode,
          content: '',
          customBackGroundColor: '#000000',
          customCTAButtonName: 'Send',
          backgroundImageKey: '',
          pageMode: PageModeType.MULTIPAGE,
        },
        isShuffleEnabled: true,
      };

      await createForm(
        {
          id: 'form-123',
          title: 'New Form',
          shortUrl: '',
          isPublished: false,
          organizationId: 'org-123',
          createdById: 'user-123',
        },
        templateSchema
      );

      expect(initializeHocuspocusDocument).toHaveBeenCalledWith('form-123', templateSchema);
    });

    it('should handle settings as string and parse JSON', async () => {
      const settingsString = '{"thankYou":{"message":"Thanks!"}}';

      await createForm({
        id: 'form-123',
        title: 'New Form',
        shortUrl: '',
        isPublished: false,
        organizationId: 'org-123',
        createdById: 'user-123',
        settings: settingsString as any,
      });

      expect(formRepository.createForm).toHaveBeenCalledWith(
        expect.objectContaining({
          settings: { thankYou: { message: 'Thanks!' } },
        })
      );
    });

    it('should handle invalid JSON in settings gracefully', async () => {
      const loggerWarn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
      const invalidJSON = '{invalid json}';

      await createForm({
        id: 'form-123',
        title: 'New Form',
        shortUrl: '',
        isPublished: false,
        organizationId: 'org-123',
        createdById: 'user-123',
        settings: invalidJSON as any,
      });

      expect(loggerWarn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse form settings'),
        expect.any(Error)
      );
      loggerWarn.mockRestore();
    });

    it('should continue if Hocuspocus initialization fails', async () => {
      const loggerError = vi.spyOn(logger, 'error').mockImplementation(() => {});
      const loggerWarn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
      vi.mocked(initializeHocuspocusDocument).mockRejectedValue(new Error('Hocuspocus error'));

      const result = await createForm({
        id: 'form-123',
        title: 'New Form',
        shortUrl: '',
        isPublished: false,
        organizationId: 'org-123',
        createdById: 'user-123',
      });

      expect(result.id).toBe('form-123');
      expect(loggerError).toHaveBeenCalled();
      expect(loggerWarn).toHaveBeenCalledWith(
        expect.stringContaining('collaboration initialization failed')
      );
      loggerError.mockRestore();
      loggerWarn.mockRestore();
    });

    it('should log error if OWNER permission creation fails', async () => {
      const loggerError = vi.spyOn(logger, 'error').mockImplementation(() => {});
      vi.mocked(formRepository.createOwnerPermission).mockRejectedValue(
        new Error('Permission error')
      );

      await createForm({
        id: 'form-123',
        title: 'New Form',
        shortUrl: '',
        isPublished: false,
        organizationId: 'org-123',
        createdById: 'user-123',
      });

      expect(loggerError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create OWNER permission'),
        expect.any(Error)
      );
      loggerError.mockRestore();
    });
  });

  describe('updateForm', () => {
    beforeEach(() => {
      vi.mocked(formRepository.findById).mockResolvedValue(mockForm as any);
      vi.mocked(formRepository.updateForm).mockResolvedValue(mockForm as any);
      vi.mocked(checkFormAccess).mockResolvedValue({
        hasAccess: true,
        permission: 'EDITOR' as any,
        form: mockFormWithAccess,
      });
    });

    it('should update form basic fields', async () => {
      const updates = {
        title: 'Updated Title',
        description: 'Updated Description',
      };

      await updateForm('form-123', updates);

      expect(formRepository.updateForm).toHaveBeenCalledWith('form-123', updates);
    });

    it('should throw error when form not found', async () => {
      vi.mocked(formRepository.findById).mockResolvedValue(null);

      await expect(updateForm('nonexistent', { title: 'New' })).rejects.toThrow('Form not found');
    });

    it('should validate EDITOR permissions for layout changes', async () => {
      const updates = { title: 'New Title', description: 'New Desc' };

      await updateForm('form-123', updates, 'user-123');

      expect(checkFormAccess).toHaveBeenCalledWith('user-123', 'form-123', 'EDITOR');
    });

    it('should validate OWNER permissions for publishing', async () => {
      vi.mocked(checkFormAccess).mockResolvedValue({ hasAccess: true, permission: 'OWNER' as any, form: mockFormWithAccess });

      await updateForm('form-123', { isPublished: true }, 'user-123');

      expect(checkFormAccess).toHaveBeenCalledWith('user-123', 'form-123', 'OWNER');
    });

    it('should throw error when user lacks permissions', async () => {
      vi.mocked(checkFormAccess).mockResolvedValue({ hasAccess: false, permission: 'NO_ACCESS' as any, form: mockFormWithAccess });

      await expect(updateForm('form-123', { title: 'New' }, 'user-123')).rejects.toThrow(
        'Access denied'
      );
    });

    it('should send notification when form is published', async () => {
      const unpublishedForm = { ...mockForm, isPublished: false };
      const publishedForm = { ...mockForm, isPublished: true };

      vi.mocked(formRepository.findById).mockResolvedValue(unpublishedForm as any);
      vi.mocked(formRepository.updateForm).mockResolvedValue(publishedForm as any);
      vi.mocked(checkFormAccess).mockResolvedValue({ hasAccess: true, permission: 'OWNER' as any, form: mockFormWithAccess });
      vi.mocked(sendFormPublishedNotification).mockResolvedValue(undefined);

      await updateForm('form-123', { isPublished: true }, 'user-123');

      expect(sendFormPublishedNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          formTitle: mockForm.title,
          formDescription: mockForm.description,
          ownerName: mockForm.createdBy.name,
        }),
        mockForm.createdBy.email
      );
    });

    it('should not send notification when form was already published', async () => {
      const publishedForm = { ...mockForm, isPublished: true };

      vi.mocked(formRepository.findById).mockResolvedValue(publishedForm as any);
      vi.mocked(formRepository.updateForm).mockResolvedValue(publishedForm as any);

      await updateForm('form-123', { title: 'New Title' });

      expect(sendFormPublishedNotification).not.toHaveBeenCalled();
    });

    it('should handle email notification failure gracefully', async () => {
      const loggerError = vi.spyOn(logger, 'error').mockImplementation(() => {});
      const unpublishedForm = { ...mockForm, isPublished: false };
      const publishedForm = { ...mockForm, isPublished: true };

      vi.mocked(formRepository.findById).mockResolvedValue(unpublishedForm as any);
      vi.mocked(formRepository.updateForm).mockResolvedValue(publishedForm as any);
      vi.mocked(checkFormAccess).mockResolvedValue({ hasAccess: true, permission: 'OWNER' as any, form: mockFormWithAccess });
      vi.mocked(sendFormPublishedNotification).mockRejectedValue(new Error('Email error'));

      const result = await updateForm('form-123', { isPublished: true }, 'user-123');

      expect(result).toBeDefined();
      expect(loggerError).toHaveBeenCalledWith(
        'Failed to send form published notification:',
        expect.any(Error)
      );
      loggerError.mockRestore();
    });

    it('should update settings field', async () => {
      const settings = { thankYou: { message: 'Thanks!' } };

      await updateForm('form-123', { settings });

      expect(formRepository.updateForm).toHaveBeenCalledWith(
        'form-123',
        expect.objectContaining({ settings })
      );
    });
  });

  describe('regenerateShortUrl', () => {
    beforeEach(() => {
      vi.mocked(generateShortUrl).mockResolvedValue('newurl123');
      vi.mocked(formRepository.findByShortUrl).mockResolvedValue(null);
      vi.mocked(formRepository.updateForm).mockResolvedValue(mockForm as any);
    });

    it('should regenerate short URL', async () => {
      const result = await regenerateShortUrl('form-123');

      expect(generateShortUrl).toHaveBeenCalledWith(8);
      expect(formRepository.updateForm).toHaveBeenCalledWith('form-123', {
        shortUrl: 'newurl123',
      });
      expect(result).toBeDefined();
    });

    it('should handle errors and rethrow', async () => {
      const loggerError = vi.spyOn(logger, 'error').mockImplementation(() => {});
      vi.mocked(formRepository.updateForm).mockRejectedValue(new Error('Database error'));

      await expect(regenerateShortUrl('form-123')).rejects.toThrow('Database error');
      expect(loggerError).toHaveBeenCalled();
      loggerError.mockRestore();
    });
  });

  describe('deleteForm', () => {
    beforeEach(() => {
      vi.mocked(formRepository.deleteForm).mockResolvedValue(mockForm as any);
      vi.mocked(checkFormAccess).mockResolvedValue({ hasAccess: true, permission: 'OWNER' as any, form: mockFormWithAccess });
    });

    it('should delete form', async () => {
      const result = await deleteForm('form-123');

      expect(formRepository.deleteForm).toHaveBeenCalledWith('form-123');
      expect(result).toBe(true);
    });

    it('should validate OWNER permissions when userId provided', async () => {
      await deleteForm('form-123', 'user-123');

      expect(checkFormAccess).toHaveBeenCalledWith('user-123', 'form-123', 'OWNER');
    });

    it('should return false when user lacks OWNER permissions', async () => {
      const loggerError = vi.spyOn(logger, 'error').mockImplementation(() => {});
      vi.mocked(checkFormAccess).mockResolvedValue({ hasAccess: false, permission: 'NO_ACCESS' as any, form: mockFormWithAccess });

      const result = await deleteForm('form-123', 'user-123');

      expect(result).toBe(false);
      expect(loggerError).toHaveBeenCalledWith('Error deleting form:', expect.any(Error));
      loggerError.mockRestore();
    });

    it('should return false on error', async () => {
      const loggerError = vi.spyOn(logger, 'error').mockImplementation(() => {});
      vi.mocked(formRepository.deleteForm).mockRejectedValue(new Error('Database error'));

      const result = await deleteForm('form-123');

      expect(result).toBe(false);
      expect(loggerError).toHaveBeenCalled();
      loggerError.mockRestore();
    });
  });

  describe('duplicateForm', () => {
    const mockSchemaFromHocuspocus = {
      pages: [{ id: 'page-1', title: 'Page 1', fields: [], order: 0 }],
      layout: {
        theme: ThemeType.LIGHT,
        textColor: '#000000',
        spacing: SpacingType.NORMAL,
        code: 'L1' as LayoutCode,
        content: '',
        customBackGroundColor: '#ffffff',
        customCTAButtonName: 'Submit',
        backgroundImageKey: '',
        pageMode: PageModeType.MULTIPAGE,
      },
      isShuffleEnabled: false,
    };

    beforeEach(() => {
      vi.mocked(formRepository.findById).mockResolvedValue(mockForm as any);
      vi.mocked(getFormSchemaFromHocuspocus).mockResolvedValue(mockSchemaFromHocuspocus as any);
      vi.mocked(generateId).mockReturnValue('new-form-id');
      vi.mocked(generateShortUrl).mockResolvedValue('newshort');
      vi.mocked(formRepository.findByShortUrl).mockResolvedValue(null);
      vi.mocked(formRepository.createForm).mockResolvedValue({
        ...mockForm,
        id: 'new-form-id',
        title: 'Test Form (Copy)',
      } as any);
      vi.mocked(formRepository.createOwnerPermission).mockResolvedValue({} as any);
      vi.mocked(initializeHocuspocusDocument).mockResolvedValue(undefined);
    });

    it('should duplicate form with (Copy) suffix', async () => {
      const result = await duplicateForm('form-123', 'user-456');

      expect(formRepository.findById).toHaveBeenCalledWith('form-123');
      expect(generateId).toHaveBeenCalled();
      expect(formRepository.createForm).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'new-form-id',
          title: 'Test Form (Copy)',
          isPublished: false,
          createdById: 'user-456',
        })
      );
      expect(result.id).toBe('new-form-id');
    });

    it('should throw error when original form not found', async () => {
      vi.mocked(formRepository.findById).mockResolvedValue(null);

      await expect(duplicateForm('nonexistent', 'user-123')).rejects.toThrow('Form not found');
    });

    it('should copy form schema from Hocuspocus', async () => {
      await duplicateForm('form-123', 'user-456');

      expect(getFormSchemaFromHocuspocus).toHaveBeenCalledWith('form-123');
      expect(initializeHocuspocusDocument).toHaveBeenCalledWith(
        'new-form-id',
        expect.objectContaining({
          pages: mockSchemaFromHocuspocus.pages,
          isShuffleEnabled: false,
        })
      );
    });

    it('should copy background image if present', async () => {
      const schemaWithBg = {
        ...mockSchemaFromHocuspocus,
        layout: {
          ...mockSchemaFromHocuspocus.layout,
          backgroundImageKey: 'old-bg-key',
        },
      };

      vi.mocked(getFormSchemaFromHocuspocus).mockResolvedValue(schemaWithBg as any);
      vi.mocked(copyFileForForm).mockResolvedValue({
        key: 'new-bg-key',
        originalName: 'background.jpg',
        url: 'https://cdn.example.com/new-bg-key',
        size: 12345,
        mimeType: 'image/jpeg',
      } as any);
      vi.mocked(formRepository.createFormAsset).mockResolvedValue({} as any);

      await duplicateForm('form-123', 'user-456');

      expect(copyFileForForm).toHaveBeenCalledWith('old-bg-key', 'new-form-id');
      expect(formRepository.createFormAsset).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'new-bg-key',
          type: 'FormBackground',
          formId: 'new-form-id',
        })
      );
    });

    it('should handle background image copy failure', async () => {
      const loggerError = vi.spyOn(logger, 'error').mockImplementation(() => {});
      const schemaWithBg = {
        ...mockSchemaFromHocuspocus,
        layout: {
          ...mockSchemaFromHocuspocus.layout,
          backgroundImageKey: 'old-bg-key',
        },
      };

      vi.mocked(getFormSchemaFromHocuspocus).mockResolvedValue(schemaWithBg as any);
      vi.mocked(copyFileForForm).mockRejectedValue(new Error('Copy failed'));

      await duplicateForm('form-123', 'user-456');

      expect(loggerError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to copy background image'),
        expect.any(Error)
      );
      expect(initializeHocuspocusDocument).toHaveBeenCalledWith(
        'new-form-id',
        expect.objectContaining({
          layout: expect.objectContaining({
            backgroundImageKey: '',
          }),
        })
      );
      loggerError.mockRestore();
    });

    it('should handle null schema from Hocuspocus', async () => {
      vi.mocked(getFormSchemaFromHocuspocus).mockResolvedValue(null);

      const result = await duplicateForm('form-123', 'user-456');

      expect(result).toBeDefined();
      expect(initializeHocuspocusDocument).toHaveBeenCalled();
    });

    it('should copy form settings', async () => {
      const formWithSettings = {
        ...mockForm,
        settings: { thankYou: { message: 'Thanks!' } },
      };

      vi.mocked(formRepository.findById).mockResolvedValue(formWithSettings as any);

      const result = await duplicateForm('form-123', 'user-456');

      expect(result.settings).toEqual(formWithSettings.settings);
    });

    it('should handle form without title', async () => {
      const formWithoutTitle = { ...mockForm, title: '' };
      vi.mocked(formRepository.findById).mockResolvedValue(formWithoutTitle as any);

      await duplicateForm('form-123', 'user-456');

      expect(formRepository.createForm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Untitled Form (Copy)',
        })
      );
    });
  });
});

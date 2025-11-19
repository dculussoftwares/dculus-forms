import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fileUploadResolvers } from '../fileUpload.js';
import { GraphQLError } from '#graphql-errors';
import * as fileUploadService from '../../../services/fileUploadService.js';
import * as betterAuthMiddleware from '../../../middleware/better-auth-middleware.js';
import * as formSharingResolvers from '../formSharing.js';
import { prisma } from '../../../lib/prisma.js';

// Mock all dependencies
vi.mock('../../../services/fileUploadService.js');
vi.mock('../../../middleware/better-auth-middleware.js');
vi.mock('../formSharing.js');
vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    formFile: {
      create: vi.fn(),
      findUnique: vi.fn(),
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
vi.mock('crypto', () => ({
  randomUUID: vi.fn(() => 'generated-uuid'),
}));

describe('File Upload Resolvers', () => {
  const mockContext = {
    auth: {
      user: {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
      },
      session: { id: 'session-123' },
      isAuthenticated: true,
    },
  };

  const mockAdminContext = {
    auth: {
      user: {
        id: 'admin-123',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'admin',
      },
      session: { id: 'session-456' },
      isAuthenticated: true,
    },
  };

  const mockSuperAdminContext = {
    auth: {
      user: {
        id: 'superadmin-123',
        email: 'superadmin@example.com',
        name: 'Super Admin',
        role: 'superAdmin',
      },
      session: { id: 'session-789' },
      isAuthenticated: true,
    },
  };

  const mockFile = {
    filename: 'test-image.jpg',
    mimetype: 'image/jpeg',
    encoding: '7bit',
    createReadStream: vi.fn(),
  };

  const mockUploadResult = {
    key: 'uploads/test-key',
    type: 'FormBackground',
    url: 'https://cdn.example.com/uploads/test-key',
    originalName: 'test-image.jpg',
    size: 1024,
    mimeType: 'image/jpeg',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Mutation: uploadFile', () => {
    it('should upload FormTemplate when user is admin', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockAdminContext.auth);
      vi.mocked(fileUploadService.uploadFile).mockResolvedValue({
        ...mockUploadResult,
        type: 'FormTemplate',
      });

      const result = await fileUploadResolvers.Mutation.uploadFile(
        {},
        {
          input: {
            file: Promise.resolve(mockFile),
            type: 'FormTemplate',
          },
        },
        mockAdminContext
      );

      expect(result).toEqual({
        ...mockUploadResult,
        type: 'FormTemplate',
      });
      expect(betterAuthMiddleware.requireAuth).toHaveBeenCalledWith(mockAdminContext.auth);
      expect(fileUploadService.uploadFile).toHaveBeenCalledWith({
        file: mockFile,
        type: 'FormTemplate',
      });
    });

    it('should upload FormTemplate when user is superAdmin', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockAdminContext.auth);
      vi.mocked(fileUploadService.uploadFile).mockResolvedValue({
        ...mockUploadResult,
        type: 'FormTemplate',
      });

      const result = await fileUploadResolvers.Mutation.uploadFile(
        {},
        {
          input: {
            file: Promise.resolve(mockFile),
            type: 'FormTemplate',
          },
        },
        mockSuperAdminContext
      );

      expect(result).toEqual({
        ...mockUploadResult,
        type: 'FormTemplate',
      });
      expect(fileUploadService.uploadFile).toHaveBeenCalled();
    });

    it('should throw error when non-admin tries to upload FormTemplate', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockAdminContext.auth);

      await expect(
        fileUploadResolvers.Mutation.uploadFile(
          {},
          {
            input: {
              file: Promise.resolve(mockFile),
              type: 'FormTemplate',
            },
          },
          mockContext
        )
      ).rejects.toThrow('Admin privileges required to upload templates');
    });

    it('should upload FormBackground when user has editor access', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockAdminContext.auth);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: true,
        permission: 'EDITOR' as any,
        form: { id: 'form-123' } as any,
      });
      vi.mocked(fileUploadService.uploadFile).mockResolvedValue(mockUploadResult);
      vi.mocked(prisma.formFile.create).mockResolvedValue({
        id: 'generated-uuid',
        key: mockUploadResult.key,
        type: mockUploadResult.type,
        formId: 'form-123',
        originalName: mockUploadResult.originalName,
        url: mockUploadResult.url,
        size: mockUploadResult.size,
        mimeType: mockUploadResult.mimeType,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await fileUploadResolvers.Mutation.uploadFile(
        {},
        {
          input: {
            file: Promise.resolve(mockFile),
            type: 'FormBackground',
            formId: 'form-123',
          },
        },
        mockContext
      );

      expect(result).toEqual(mockUploadResult);
      expect(formSharingResolvers.checkFormAccess).toHaveBeenCalledWith(
        'user-123',
        'form-123',
        formSharingResolvers.PermissionLevel.EDITOR
      );
      expect(prisma.formFile.create).toHaveBeenCalledWith({
        data: {
          id: 'generated-uuid',
          key: mockUploadResult.key,
          type: mockUploadResult.type,
          formId: 'form-123',
          originalName: mockUploadResult.originalName,
          url: mockUploadResult.url,
          size: mockUploadResult.size,
          mimeType: mockUploadResult.mimeType,
        },
      });
    });

    it('should throw error when formId is missing for FormBackground', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockAdminContext.auth);

      await expect(
        fileUploadResolvers.Mutation.uploadFile(
          {},
          {
            input: {
              file: Promise.resolve(mockFile),
              type: 'FormBackground',
            },
          },
          mockContext
        )
      ).rejects.toThrow('formId is required for FormBackground uploads');
    });

    it('should throw error when user lacks editor access for FormBackground', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockAdminContext.auth);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: false,
        permission: null as any,
        form: null as any,
      });

      await expect(
        fileUploadResolvers.Mutation.uploadFile(
          {},
          {
            input: {
              file: Promise.resolve(mockFile),
              type: 'FormBackground',
              formId: 'form-123',
            },
          },
          mockContext
        )
      ).rejects.toThrow('Access denied: You need EDITOR access to upload background images for this form');
    });

    it('should upload UserAvatar when authenticated', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockAdminContext.auth);
      vi.mocked(fileUploadService.uploadFile).mockResolvedValue({
        ...mockUploadResult,
        type: 'UserAvatar',
      });

      const result = await fileUploadResolvers.Mutation.uploadFile(
        {},
        {
          input: {
            file: Promise.resolve(mockFile),
            type: 'UserAvatar',
          },
        },
        mockContext
      );

      expect(result).toEqual({
        ...mockUploadResult,
        type: 'UserAvatar',
      });
      expect(betterAuthMiddleware.requireAuth).toHaveBeenCalledWith(mockContext.auth);
    });

    it('should upload OrganizationLogo when user is organization member', async () => {
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockResolvedValue({
        role: 'owner',
      });
      vi.mocked(fileUploadService.uploadFile).mockResolvedValue({
        ...mockUploadResult,
        type: 'OrganizationLogo',
      });

      const result = await fileUploadResolvers.Mutation.uploadFile(
        {},
        {
          input: {
            file: Promise.resolve(mockFile),
            type: 'OrganizationLogo',
            organizationId: 'org-123',
          },
        },
        mockContext
      );

      expect(result).toEqual({
        ...mockUploadResult,
        type: 'OrganizationLogo',
      });
      expect(betterAuthMiddleware.requireOrganizationMembership).toHaveBeenCalledWith(
        mockContext.auth,
        'org-123'
      );
    });

    it('should throw error when organizationId is missing for OrganizationLogo', async () => {
      await expect(
        fileUploadResolvers.Mutation.uploadFile(
          {},
          {
            input: {
              file: Promise.resolve(mockFile),
              type: 'OrganizationLogo',
            },
          },
          mockContext
        )
      ).rejects.toThrow('organizationId is required for OrganizationLogo uploads');
    });

    it('should throw error for invalid file type', async () => {
      await expect(
        fileUploadResolvers.Mutation.uploadFile(
          {},
          {
            input: {
              file: Promise.resolve(mockFile),
              type: 'InvalidType',
            },
          },
          mockContext
        )
      ).rejects.toThrow('Invalid file type');
    });

    it('should handle wrapped file upload object', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockAdminContext.auth);
      vi.mocked(fileUploadService.uploadFile).mockResolvedValue({
        ...mockUploadResult,
        type: 'UserAvatar',
      });

      const wrappedFile = {
        file: mockFile,
        resolve: vi.fn(),
        reject: vi.fn(),
        promise: Promise.resolve(),
      };

      const result = await fileUploadResolvers.Mutation.uploadFile(
        {},
        {
          input: {
            file: Promise.resolve(wrappedFile),
            type: 'UserAvatar',
          },
        },
        mockContext
      );

      expect(result).toEqual({
        ...mockUploadResult,
        type: 'UserAvatar',
      });
      expect(fileUploadService.uploadFile).toHaveBeenCalledWith({
        file: mockFile,
        type: 'UserAvatar',
      });
    });

    it('should handle upload service errors', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockAdminContext.auth);
      vi.mocked(fileUploadService.uploadFile).mockRejectedValue(
        new Error('S3 upload failed')
      );

      await expect(
        fileUploadResolvers.Mutation.uploadFile(
          {},
          {
            input: {
              file: Promise.resolve(mockFile),
              type: 'UserAvatar',
            },
          },
          mockContext
        )
      ).rejects.toThrow('Failed to upload file: S3 upload failed');
    });

    it('should preserve GraphQLError when thrown', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockImplementation(() => {
        throw new GraphQLError('Authentication required');
      });

      await expect(
        fileUploadResolvers.Mutation.uploadFile(
          {},
          {
            input: {
              file: Promise.resolve(mockFile),
              type: 'UserAvatar',
            },
          },
          mockContext
        )
      ).rejects.toThrow(GraphQLError);
    });
  });

  describe('Mutation: deleteFile', () => {
    it('should delete file when user has editor access to associated form', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockAdminContext.auth);
      vi.mocked(prisma.formFile.findUnique).mockResolvedValue({
        id: 'file-123',
        key: 'uploads/test-key',
        type: 'FormBackground',
        formId: 'form-123',
        originalName: 'test.jpg',
        url: 'https://cdn.example.com/test.jpg',
        size: 1024,
        mimeType: 'image/jpeg',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: true,
        permission: 'EDITOR' as any,
        form: { id: 'form-123' } as any,
      });
      vi.mocked(fileUploadService.deleteFile).mockResolvedValue(true);

      const result = await fileUploadResolvers.Mutation.deleteFile(
        {},
        { key: 'uploads/test-key' },
        mockContext
      );

      expect(result).toBe(true);
      expect(betterAuthMiddleware.requireAuth).toHaveBeenCalledWith(mockContext.auth);
      expect(prisma.formFile.findUnique).toHaveBeenCalledWith({
        where: { key: 'uploads/test-key' },
        include: { form: true },
      });
      expect(formSharingResolvers.checkFormAccess).toHaveBeenCalledWith(
        'user-123',
        'form-123',
        formSharingResolvers.PermissionLevel.EDITOR
      );
      expect(fileUploadService.deleteFile).toHaveBeenCalledWith('uploads/test-key');
    });

    it('should throw error when user lacks editor access', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockAdminContext.auth);
      vi.mocked(prisma.formFile.findUnique).mockResolvedValue({
        id: 'file-123',
        key: 'uploads/test-key',
        type: 'FormBackground',
        formId: 'form-123',
        originalName: 'test.jpg',
        url: 'https://cdn.example.com/test.jpg',
        size: 1024,
        mimeType: 'image/jpeg',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: false,
        permission: null as any,
        form: null as any,
      });

      await expect(
        fileUploadResolvers.Mutation.deleteFile(
          {},
          { key: 'uploads/test-key' },
          mockContext
        )
      ).rejects.toThrow('Access denied: You need EDITOR access to delete files from this form');
    });

    it('should delete file when not associated with form (UserAvatar, etc.)', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockAdminContext.auth);
      vi.mocked(prisma.formFile.findUnique).mockResolvedValue(null);
      vi.mocked(fileUploadService.deleteFile).mockResolvedValue(true);

      const result = await fileUploadResolvers.Mutation.deleteFile(
        {},
        { key: 'uploads/avatar-key' },
        mockContext
      );

      expect(result).toBe(true);
      expect(fileUploadService.deleteFile).toHaveBeenCalledWith('uploads/avatar-key');
    });

    it('should require authentication', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockImplementation(() => {
        throw new Error('Authentication required');
      });

      await expect(
        fileUploadResolvers.Mutation.deleteFile(
          {},
          { key: 'uploads/test-key' },
          mockContext
        )
      ).rejects.toThrow('Authentication required');
    });

    it('should handle delete service errors', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockAdminContext.auth);
      vi.mocked(prisma.formFile.findUnique).mockResolvedValue(null);
      vi.mocked(fileUploadService.deleteFile).mockRejectedValue(
        new Error('S3 deletion failed')
      );

      await expect(
        fileUploadResolvers.Mutation.deleteFile(
          {},
          { key: 'uploads/test-key' },
          mockContext
        )
      ).rejects.toThrow('Failed to delete file: S3 deletion failed');
    });

    it('should preserve GraphQLError when thrown', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockAdminContext.auth);
      vi.mocked(prisma.formFile.findUnique).mockResolvedValue({
        id: 'file-123',
        key: 'uploads/test-key',
        type: 'FormBackground',
        formId: 'form-123',
        originalName: 'test.jpg',
        url: 'https://cdn.example.com/test.jpg',
        size: 1024,
        mimeType: 'image/jpeg',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
      vi.mocked(formSharingResolvers.checkFormAccess).mockImplementation(() => {
        throw new GraphQLError('Access denied');
      });

      await expect(
        fileUploadResolvers.Mutation.deleteFile(
          {},
          { key: 'uploads/test-key' },
          mockContext
        )
      ).rejects.toThrow(GraphQLError);
    });

    it('should return false when delete fails', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockAdminContext.auth);
      vi.mocked(prisma.formFile.findUnique).mockResolvedValue(null);
      vi.mocked(fileUploadService.deleteFile).mockResolvedValue(false);

      const result = await fileUploadResolvers.Mutation.deleteFile(
        {},
        { key: 'uploads/non-existent' },
        mockContext
      );

      expect(result).toBe(false);
    });
  });
});

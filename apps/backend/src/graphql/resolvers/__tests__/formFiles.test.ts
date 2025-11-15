import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formFileResolvers } from '../formFiles.js';
import { GraphQLError } from 'graphql';
import * as betterAuthMiddleware from '../../../middleware/better-auth-middleware.js';
import * as formSharingResolvers from '../formSharing.js';
import { prisma } from '../../../lib/prisma.js';

// Mock all dependencies
vi.mock('../../../middleware/better-auth-middleware.js');
vi.mock('../formSharing.js');
vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    formFile: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
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

describe('Form Files Resolvers', () => {
  const mockContext = {
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

  const mockForm = {
    id: 'form-123',
    title: 'Test Form',
    organizationId: 'org-123',
    createdById: 'user-123',
  };

  const mockFormFile1 = {
    id: 'file-123',
    formId: 'form-123',
    type: 'export',
    filename: 'form-export.xlsx',
    key: 'exports/form-123/form-export.xlsx',
    url: 'https://s3.amazonaws.com/bucket/exports/form-123/form-export.xlsx',
    size: 10240,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    metadata: { format: 'excel', responseCount: 100 },
    createdAt: new Date('2024-01-01T10:00:00Z'),
    updatedAt: new Date('2024-01-01T10:00:00Z'),
  };

  const mockFormFile2 = {
    id: 'file-456',
    formId: 'form-123',
    type: 'backup',
    filename: 'form-backup.json',
    key: 'backups/form-123/form-backup.json',
    url: 'https://s3.amazonaws.com/bucket/backups/form-123/form-backup.json',
    size: 5120,
    mimeType: 'application/json',
    metadata: { timestamp: '2024-01-01T10:00:00Z' },
    createdAt: new Date('2024-01-02T10:00:00Z'),
    updatedAt: new Date('2024-01-02T10:00:00Z'),
  };

  const mockFormFile3 = {
    id: 'file-789',
    formId: 'form-123',
    type: 'export',
    filename: 'form-export.csv',
    key: 'exports/form-123/form-export.csv',
    url: 'https://s3.amazonaws.com/bucket/exports/form-123/form-export.csv',
    size: 8192,
    mimeType: 'text/csv',
    metadata: { format: 'csv', responseCount: 100 },
    createdAt: new Date('2024-01-03T10:00:00Z'),
    updatedAt: new Date('2024-01-03T10:00:00Z'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Query: getFormFiles', () => {
    describe('Authentication', () => {
      it('should require authentication', async () => {
        vi.mocked(betterAuthMiddleware.requireAuth).mockImplementation(() => {
          throw new GraphQLError('Authentication required');
        });

        await expect(
          formFileResolvers.Query.getFormFiles(
            {},
            { formId: 'form-123' },
            mockContext
          )
        ).rejects.toThrow('Authentication required');

        expect(betterAuthMiddleware.requireAuth).toHaveBeenCalledWith(mockContext.auth);
      });

      it('should throw error when user is null', async () => {
        const contextWithoutUser = {
          auth: {
            user: null,
            session: null,
          },
        };

        vi.mocked(betterAuthMiddleware.requireAuth).mockImplementation(() => {
          throw new GraphQLError('Authentication required');
        });

        await expect(
          formFileResolvers.Query.getFormFiles(
            {},
            { formId: 'form-123' },
            contextWithoutUser as any
          )
        ).rejects.toThrow('Authentication required');
      });

      it('should throw error when session is invalid', async () => {
        vi.mocked(betterAuthMiddleware.requireAuth).mockImplementation(() => {
          throw new GraphQLError('Invalid session');
        });

        await expect(
          formFileResolvers.Query.getFormFiles(
            {},
            { formId: 'form-123' },
            mockContext
          )
        ).rejects.toThrow('Invalid session');
      });
    });

    describe('Authorization', () => {
      it('should verify user has viewer access to form', async () => {
        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(prisma.formFile.findMany).mockResolvedValue([]);

        await formFileResolvers.Query.getFormFiles(
          {},
          { formId: 'form-123' },
          mockContext
        );

        expect(formSharingResolvers.checkFormAccess).toHaveBeenCalledWith(
          'user-123',
          'form-123',
          formSharingResolvers.PermissionLevel.VIEWER
        );
      });

      it('should throw error when user lacks access to form', async () => {
        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: false,
          permission: null as any,
          form: null as any,
        });

        await expect(
          formFileResolvers.Query.getFormFiles(
            {},
            { formId: 'form-123' },
            mockContext
          )
        ).rejects.toThrow(GraphQLError);

        await expect(
          formFileResolvers.Query.getFormFiles(
            {},
            { formId: 'form-123' },
            mockContext
          )
        ).rejects.toThrow('Access denied: You do not have permission to view files for this form');

        expect(prisma.formFile.findMany).not.toHaveBeenCalled();
      });

      it('should deny access for users from different organization', async () => {
        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: false,
          permission: null as any,
          form: null as any,
        });

        await expect(
          formFileResolvers.Query.getFormFiles(
            {},
            { formId: 'other-org-form' },
            mockContext
          )
        ).rejects.toThrow('Access denied: You do not have permission to view files for this form');
      });

      it('should allow access for organization members with viewer role', async () => {
        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(prisma.formFile.findMany).mockResolvedValue([mockFormFile1] as any);

        const result = await formFileResolvers.Query.getFormFiles(
          {},
          { formId: 'form-123' },
          mockContext
        );

        expect(result).toHaveLength(1);
        expect(formSharingResolvers.checkFormAccess).toHaveBeenCalledWith(
          'user-123',
          'form-123',
          formSharingResolvers.PermissionLevel.VIEWER
        );
      });
    });

    describe('Fetching All Files', () => {
      it('should return all form files when no type filter provided', async () => {
        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(prisma.formFile.findMany).mockResolvedValue([
          mockFormFile1,
          mockFormFile2,
          mockFormFile3,
        ] as any);

        const result = await formFileResolvers.Query.getFormFiles(
          {},
          { formId: 'form-123' },
          mockContext
        );

        expect(prisma.formFile.findMany).toHaveBeenCalledWith({
          where: { formId: 'form-123' },
          orderBy: { createdAt: 'desc' },
        });
        expect(result).toHaveLength(3);
        expect(result).toEqual([mockFormFile1, mockFormFile2, mockFormFile3]);
      });

      it('should return empty array when no files exist', async () => {
        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(prisma.formFile.findMany).mockResolvedValue([]);

        const result = await formFileResolvers.Query.getFormFiles(
          {},
          { formId: 'form-123' },
          mockContext
        );

        expect(result).toEqual([]);
      });

      it('should order files by createdAt in descending order', async () => {
        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(prisma.formFile.findMany).mockResolvedValue([
          mockFormFile3,
          mockFormFile2,
          mockFormFile1,
        ] as any);

        const result = await formFileResolvers.Query.getFormFiles(
          {},
          { formId: 'form-123' },
          mockContext
        );

        expect(prisma.formFile.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: { createdAt: 'desc' },
          })
        );
        expect(result[0].id).toBe('file-789'); // Most recent first
        expect(result[2].id).toBe('file-123'); // Oldest last
      });
    });

    describe('Filtering by Type', () => {
      it('should filter files by type when type parameter provided', async () => {
        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(prisma.formFile.findMany).mockResolvedValue([
          mockFormFile1,
          mockFormFile3,
        ] as any);

        const result = await formFileResolvers.Query.getFormFiles(
          {},
          { formId: 'form-123', type: 'export' },
          mockContext
        );

        expect(prisma.formFile.findMany).toHaveBeenCalledWith({
          where: { formId: 'form-123', type: 'export' },
          orderBy: { createdAt: 'desc' },
        });
        expect(result).toHaveLength(2);
        expect(result.every((file) => file.type === 'export')).toBe(true);
      });

      it('should filter by backup type', async () => {
        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(prisma.formFile.findMany).mockResolvedValue([mockFormFile2] as any);

        const result = await formFileResolvers.Query.getFormFiles(
          {},
          { formId: 'form-123', type: 'backup' },
          mockContext
        );

        expect(prisma.formFile.findMany).toHaveBeenCalledWith({
          where: { formId: 'form-123', type: 'backup' },
          orderBy: { createdAt: 'desc' },
        });
        expect(result).toHaveLength(1);
        expect(result[0].type).toBe('backup');
      });

      it('should return empty array when no files match type filter', async () => {
        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(prisma.formFile.findMany).mockResolvedValue([]);

        const result = await formFileResolvers.Query.getFormFiles(
          {},
          { formId: 'form-123', type: 'template' },
          mockContext
        );

        expect(result).toEqual([]);
      });

      it('should handle custom file types', async () => {
        const customFile = {
          ...mockFormFile1,
          id: 'file-custom',
          type: 'custom',
        };
        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(prisma.formFile.findMany).mockResolvedValue([customFile] as any);

        const result = await formFileResolvers.Query.getFormFiles(
          {},
          { formId: 'form-123', type: 'custom' },
          mockContext
        );

        expect(result).toHaveLength(1);
        expect(result[0].type).toBe('custom');
      });
    });

    describe('File Properties', () => {
      it('should return files with all properties', async () => {
        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(prisma.formFile.findMany).mockResolvedValue([mockFormFile1] as any);

        const result = await formFileResolvers.Query.getFormFiles(
          {},
          { formId: 'form-123' },
          mockContext
        );

        expect(result[0]).toMatchObject({
          id: 'file-123',
          formId: 'form-123',
          type: 'export',
          filename: 'form-export.xlsx',
          key: 'exports/form-123/form-export.xlsx',
          url: expect.any(String),
          size: 10240,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          metadata: expect.any(Object),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
      });

      it('should handle files with null metadata', async () => {
        const fileWithoutMetadata = {
          ...mockFormFile1,
          metadata: null,
        };
        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(prisma.formFile.findMany).mockResolvedValue([
          fileWithoutMetadata,
        ] as any);

        const result = await formFileResolvers.Query.getFormFiles(
          {},
          { formId: 'form-123' },
          mockContext
        );

        expect((result[0] as any).metadata).toBeNull();
      });

      it('should handle files with complex metadata', async () => {
        const fileWithComplexMetadata = {
          ...mockFormFile1,
          metadata: {
            format: 'excel',
            responseCount: 100,
            filters: [{ field: 'status', operator: 'equals', value: 'completed' }],
            exportedBy: 'user-123',
            exportedAt: '2024-01-01T10:00:00Z',
          },
        };
        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(prisma.formFile.findMany).mockResolvedValue([
          fileWithComplexMetadata,
        ] as any);

        const result = await formFileResolvers.Query.getFormFiles(
          {},
          { formId: 'form-123' },
          mockContext
        );

        expect((result[0] as any).metadata).toEqual(fileWithComplexMetadata.metadata);
      });
    });

    describe('Multiple Forms', () => {
      it('should only return files for specified form', async () => {
        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(prisma.formFile.findMany).mockResolvedValue([mockFormFile1] as any);

        await formFileResolvers.Query.getFormFiles(
          {},
          { formId: 'form-123' },
          mockContext
        );

        expect(prisma.formFile.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ formId: 'form-123' }),
          })
        );
      });

      it('should handle different forms separately', async () => {
        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(prisma.formFile.findMany).mockResolvedValue([mockFormFile1] as any);

        await formFileResolvers.Query.getFormFiles(
          {},
          { formId: 'form-456' },
          mockContext
        );

        expect(prisma.formFile.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ formId: 'form-456' }),
          })
        );
      });
    });

    describe('Error Handling', () => {
      it('should re-throw GraphQLError instances', async () => {
        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        const customError = new GraphQLError('Custom database error');
        vi.mocked(prisma.formFile.findMany).mockRejectedValue(customError);

        await expect(
          formFileResolvers.Query.getFormFiles(
            {},
            { formId: 'form-123' },
            mockContext
          )
        ).rejects.toThrow(GraphQLError);

        await expect(
          formFileResolvers.Query.getFormFiles(
            {},
            { formId: 'form-123' },
            mockContext
          )
        ).rejects.toThrow('Custom database error');
      });

      it('should convert non-GraphQLError to GraphQLError', async () => {
        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        const databaseError = new Error('Database connection failed');
        vi.mocked(prisma.formFile.findMany).mockRejectedValue(databaseError);

        await expect(
          formFileResolvers.Query.getFormFiles(
            {},
            { formId: 'form-123' },
            mockContext
          )
        ).rejects.toThrow(GraphQLError);

        await expect(
          formFileResolvers.Query.getFormFiles(
            {},
            { formId: 'form-123' },
            mockContext
          )
        ).rejects.toThrow('Failed to fetch form files: Database connection failed');
      });

      it('should handle prisma errors gracefully', async () => {
        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        const prismaError = new Error('P2021: Table does not exist');
        vi.mocked(prisma.formFile.findMany).mockRejectedValue(prismaError);

        await expect(
          formFileResolvers.Query.getFormFiles(
            {},
            { formId: 'form-123' },
            mockContext
          )
        ).rejects.toThrow('Failed to fetch form files: P2021: Table does not exist');
      });

      it('should handle unknown errors', async () => {
        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(prisma.formFile.findMany).mockRejectedValue('Unknown error');

        await expect(
          formFileResolvers.Query.getFormFiles(
            {},
            { formId: 'form-123' },
            mockContext
          )
        ).rejects.toThrow('Failed to fetch form files: Unknown error');
      });

      it('should handle null formId gracefully', async () => {
        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: false,
          permission: null as any,
          form: null as any,
        });

        await expect(
          formFileResolvers.Query.getFormFiles(
            {},
            { formId: null as any },
            mockContext
          )
        ).rejects.toThrow();
      });
    });

    describe('Edge Cases', () => {
      it('should handle very large file lists', async () => {
        const largeFileList = Array.from({ length: 1000 }, (_, i) => ({
          ...mockFormFile1,
          id: `file-${i}`,
          filename: `export-${i}.xlsx`,
        }));

        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(prisma.formFile.findMany).mockResolvedValue(largeFileList as any);

        const result = await formFileResolvers.Query.getFormFiles(
          {},
          { formId: 'form-123' },
          mockContext
        );

        expect(result).toHaveLength(1000);
      });

      it('should handle special characters in filenames', async () => {
        const fileWithSpecialChars = {
          ...mockFormFile1,
          filename: 'form-export (2024) [final] @user.xlsx',
        };
        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(prisma.formFile.findMany).mockResolvedValue([
          fileWithSpecialChars,
        ] as any);

        const result = await formFileResolvers.Query.getFormFiles(
          {},
          { formId: 'form-123' },
          mockContext
        );

        expect((result[0] as any).filename).toBe('form-export (2024) [final] @user.xlsx');
      });

      it('should handle unicode characters in filenames', async () => {
        const fileWithUnicode = {
          ...mockFormFile1,
          filename: 'formulaire-réponse-ñ-中文.xlsx',
        };
        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(prisma.formFile.findMany).mockResolvedValue([fileWithUnicode] as any);

        const result = await formFileResolvers.Query.getFormFiles(
          {},
          { formId: 'form-123' },
          mockContext
        );

        expect((result[0] as any).filename).toBe('formulaire-réponse-ñ-中文.xlsx');
      });

      it('should handle very long form IDs', async () => {
        const longFormId = 'f'.repeat(100);
        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: { ...mockForm, id: longFormId } as any,
        });
        vi.mocked(prisma.formFile.findMany).mockResolvedValue([]);

        await formFileResolvers.Query.getFormFiles(
          {},
          { formId: longFormId },
          mockContext
        );

        expect(prisma.formFile.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ formId: longFormId }),
          })
        );
      });

      it('should handle empty type string', async () => {
        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(prisma.formFile.findMany).mockResolvedValue([]);

        await formFileResolvers.Query.getFormFiles(
          {},
          { formId: 'form-123', type: '' },
          mockContext
        );

        // Empty string is still truthy for the condition check, so it's not included
        expect(prisma.formFile.findMany).toHaveBeenCalledWith({
          where: { formId: 'form-123' },
          orderBy: { createdAt: 'desc' },
        });
      });
    });

    describe('Performance', () => {
      it('should not over-fetch data', async () => {
        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(prisma.formFile.findMany).mockResolvedValue([mockFormFile1] as any);

        await formFileResolvers.Query.getFormFiles(
          {},
          { formId: 'form-123' },
          mockContext
        );

        // Verify no includes or unnecessary selects
        expect(prisma.formFile.findMany).toHaveBeenCalledWith({
          where: { formId: 'form-123' },
          orderBy: { createdAt: 'desc' },
        });
      });

      it('should only query database once per request', async () => {
        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(prisma.formFile.findMany).mockResolvedValue([mockFormFile1] as any);

        await formFileResolvers.Query.getFormFiles(
          {},
          { formId: 'form-123' },
          mockContext
        );

        expect(prisma.formFile.findMany).toHaveBeenCalledTimes(1);
      });
    });

    describe('File Types', () => {
      it('should support export file type', async () => {
        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(prisma.formFile.findMany).mockResolvedValue([mockFormFile1] as any);

        const result = await formFileResolvers.Query.getFormFiles(
          {},
          { formId: 'form-123', type: 'export' },
          mockContext
        );

        expect(result[0].type).toBe('export');
      });

      it('should support backup file type', async () => {
        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(prisma.formFile.findMany).mockResolvedValue([mockFormFile2] as any);

        const result = await formFileResolvers.Query.getFormFiles(
          {},
          { formId: 'form-123', type: 'backup' },
          mockContext
        );

        expect(result[0].type).toBe('backup');
      });
    });

    describe('MIME Types', () => {
      it('should handle Excel MIME type', async () => {
        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(prisma.formFile.findMany).mockResolvedValue([mockFormFile1] as any);

        const result = await formFileResolvers.Query.getFormFiles(
          {},
          { formId: 'form-123' },
          mockContext
        );

        expect(result[0].mimeType).toBe(
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
      });

      it('should handle CSV MIME type', async () => {
        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(prisma.formFile.findMany).mockResolvedValue([mockFormFile3] as any);

        const result = await formFileResolvers.Query.getFormFiles(
          {},
          { formId: 'form-123' },
          mockContext
        );

        expect(result[0].mimeType).toBe('text/csv');
      });

      it('should handle JSON MIME type', async () => {
        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(prisma.formFile.findMany).mockResolvedValue([mockFormFile2] as any);

        const result = await formFileResolvers.Query.getFormFiles(
          {},
          { formId: 'form-123' },
          mockContext
        );

        expect(result[0].mimeType).toBe('application/json');
      });
    });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { unifiedExportResolvers } from '../unifiedExport.js';
import { GraphQLError } from 'graphql';
import * as betterAuthMiddleware from '../../../middleware/better-auth-middleware.js';
import * as formSharingResolvers from '../formSharing.js';
import * as formService from '../../../services/formService.js';
import * as responseService from '../../../services/responseService.js';
import * as unifiedExportService from '../../../services/unifiedExportService.js';
import * as temporaryFileService from '../../../services/temporaryFileService.js';
import * as hocuspocusService from '../../../services/hocuspocus.js';
import * as responseFilterService from '../../../services/responseFilterService.js';

// Mock all dependencies
vi.mock('../../../middleware/better-auth-middleware.js');
vi.mock('../formSharing.js');
vi.mock('../../../services/formService.js');
vi.mock('../../../services/responseService.js');
vi.mock('../../../services/unifiedExportService.js');
vi.mock('../../../services/temporaryFileService.js');
vi.mock('../../../services/hocuspocus.js');
vi.mock('../../../services/responseFilterService.js');
vi.mock('../../../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));
vi.mock('@dculus/types', async () => {
  const actual = await vi.importActual<typeof import('@dculus/types')>('@dculus/types');
  return {
    ...actual,
    deserializeFormSchema: vi.fn((schema: any) => schema),
  };
});

describe('Unified Export Resolvers', () => {
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
    formSchema: {
      pages: [
        {
          id: 'page-1',
          title: 'Page 1',
          order: 0,
          fields: [
            { id: 'field-1', type: 'text', label: 'Name' },
            { id: 'field-2', type: 'email', label: 'Email' },
          ],
        },
      ],
      layout: {
        theme: 'light',
        textColor: '#000000',
        spacing: 'normal',
        code: '',
        content: '',
        customBackGroundColor: '#ffffff',
        backgroundImageKey: '',
      },
      isShuffleEnabled: false,
    },
  };

  const mockResponses = [
    {
      id: 'response-1',
      formId: 'form-123',
      responseData: {
        'field-1': 'John Doe',
        'field-2': 'john@example.com',
      },
      submittedAt: new Date('2024-01-01T10:00:00Z'),
      respondentEmail: 'john@example.com',
      metadata: {},
    },
    {
      id: 'response-2',
      formId: 'form-123',
      responseData: {
        'field-1': 'Jane Smith',
        'field-2': 'jane@example.com',
      },
      submittedAt: new Date('2024-01-02T10:00:00Z'),
      respondentEmail: 'jane@example.com',
      metadata: {},
    },
  ];

  const mockExportBuffer = Buffer.from('mock export data');
  const mockExportResult = {
    buffer: mockExportBuffer,
    filename: 'Test_Form_2024-01-01.xlsx',
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };

  const mockTemporaryFile = {
    downloadUrl: 'https://s3.amazonaws.com/bucket/exports/form-123/export.xlsx?signature=abc',
    expiresAt: new Date('2024-01-01T11:00:00Z'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Mutation: generateFormResponseReport', () => {
    describe('Authentication', () => {
      it('should require authentication', async () => {
        vi.mocked(betterAuthMiddleware.requireAuth).mockImplementation(() => {
          throw new GraphQLError('Authentication required');
        });

        await expect(
          unifiedExportResolvers.Mutation.generateFormResponseReport(
            {},
            { formId: 'form-123', format: 'EXCEL' },
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
            isAuthenticated: false,
          },
        };

        vi.mocked(betterAuthMiddleware.requireAuth).mockImplementation(() => {
          throw new GraphQLError('Authentication required');
        });

        await expect(
          unifiedExportResolvers.Mutation.generateFormResponseReport(
            {},
            { formId: 'form-123', format: 'EXCEL' },
            contextWithoutUser as any
          )
        ).rejects.toThrow('Authentication required');
      });

      it('should throw error when session is invalid', async () => {
        vi.mocked(betterAuthMiddleware.requireAuth).mockImplementation(() => {
          throw new GraphQLError('Invalid session');
        });

        await expect(
          unifiedExportResolvers.Mutation.generateFormResponseReport(
            {},
            { formId: 'form-123', format: 'EXCEL' },
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
        vi.mocked(formService.getFormById).mockResolvedValue(mockForm as any);
        vi.mocked(responseService.getAllResponsesByFormId).mockResolvedValue(
          mockResponses as any
        );
        vi.mocked(hocuspocusService.getFormSchemaFromHocuspocus).mockResolvedValue(
          mockForm.formSchema as any
        );
        vi.mocked(unifiedExportService.generateExportFile).mockResolvedValue(
          mockExportResult
        );
        vi.mocked(temporaryFileService.uploadTemporaryFile).mockResolvedValue(
          mockTemporaryFile as any
        );

        await unifiedExportResolvers.Mutation.generateFormResponseReport(
          {},
          { formId: 'form-123', format: 'EXCEL' },
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
          unifiedExportResolvers.Mutation.generateFormResponseReport(
            {},
            { formId: 'form-123', format: 'EXCEL' },
            mockContext
          )
        ).rejects.toThrow(GraphQLError);

        await expect(
          unifiedExportResolvers.Mutation.generateFormResponseReport(
            {},
            { formId: 'form-123', format: 'EXCEL' },
            mockContext
          )
        ).rejects.toThrow('Access denied: You do not have permission to export data from this form');
      });

      it('should deny access for users from different organization', async () => {
        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: false,
          permission: null as any,
          form: null as any,
        });

        await expect(
          unifiedExportResolvers.Mutation.generateFormResponseReport(
            {},
            { formId: 'other-org-form', format: 'EXCEL' },
            mockContext
          )
        ).rejects.toThrow('Access denied: You do not have permission to export data from this form');
      });
    });

    describe('Form Validation', () => {
      it('should throw error when form does not exist', async () => {
        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: null as any,
        });
        vi.mocked(formService.getFormById).mockResolvedValue(null);

        await expect(
          unifiedExportResolvers.Mutation.generateFormResponseReport(
            {},
            { formId: 'nonexistent-form', format: 'EXCEL' },
            mockContext
          )
        ).rejects.toThrow('Form not found');
      });

      it('should fetch form by ID correctly', async () => {
        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(formService.getFormById).mockResolvedValue(mockForm as any);
        vi.mocked(responseService.getAllResponsesByFormId).mockResolvedValue(
          mockResponses as any
        );
        vi.mocked(hocuspocusService.getFormSchemaFromHocuspocus).mockResolvedValue(
          mockForm.formSchema as any
        );
        vi.mocked(unifiedExportService.generateExportFile).mockResolvedValue(
          mockExportResult
        );
        vi.mocked(temporaryFileService.uploadTemporaryFile).mockResolvedValue(
          mockTemporaryFile as any
        );

        await unifiedExportResolvers.Mutation.generateFormResponseReport(
          {},
          { formId: 'form-123', format: 'EXCEL' },
          mockContext
        );

        expect(formService.getFormById).toHaveBeenCalledWith('form-123');
      });
    });

    describe('Response Validation', () => {
      it('should throw error when no responses exist', async () => {
        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(formService.getFormById).mockResolvedValue(mockForm as any);
        vi.mocked(responseService.getAllResponsesByFormId).mockResolvedValue([]);

        await expect(
          unifiedExportResolvers.Mutation.generateFormResponseReport(
            {},
            { formId: 'form-123', format: 'EXCEL' },
            mockContext
          )
        ).rejects.toThrow('No responses found for this form');
      });

      it('should fetch all responses for form', async () => {
        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(formService.getFormById).mockResolvedValue(mockForm as any);
        vi.mocked(responseService.getAllResponsesByFormId).mockResolvedValue(
          mockResponses as any
        );
        vi.mocked(hocuspocusService.getFormSchemaFromHocuspocus).mockResolvedValue(
          mockForm.formSchema as any
        );
        vi.mocked(unifiedExportService.generateExportFile).mockResolvedValue(
          mockExportResult
        );
        vi.mocked(temporaryFileService.uploadTemporaryFile).mockResolvedValue(
          mockTemporaryFile as any
        );

        await unifiedExportResolvers.Mutation.generateFormResponseReport(
          {},
          { formId: 'form-123', format: 'EXCEL' },
          mockContext
        );

        expect(responseService.getAllResponsesByFormId).toHaveBeenCalledWith('form-123');
      });

      it('should handle large number of responses', async () => {
        const largeResponseList = Array.from({ length: 10000 }, (_, i) => ({
          id: `response-${i}`,
          formId: 'form-123',
          responseData: { 'field-1': `User ${i}` },
          submittedAt: new Date(),
          respondentEmail: `user${i}@example.com`,
          metadata: {},
        }));

        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(formService.getFormById).mockResolvedValue(mockForm as any);
        vi.mocked(responseService.getAllResponsesByFormId).mockResolvedValue(
          largeResponseList as any
        );
        vi.mocked(hocuspocusService.getFormSchemaFromHocuspocus).mockResolvedValue(
          mockForm.formSchema as any
        );
        vi.mocked(unifiedExportService.generateExportFile).mockResolvedValue(
          mockExportResult
        );
        vi.mocked(temporaryFileService.uploadTemporaryFile).mockResolvedValue(
          mockTemporaryFile as any
        );

        const result = await unifiedExportResolvers.Mutation.generateFormResponseReport(
          {},
          { formId: 'form-123', format: 'EXCEL' },
          mockContext
        );

        expect(result).toBeDefined();
        expect(unifiedExportService.generateExportFile).toHaveBeenCalledWith(
          expect.objectContaining({
            responses: expect.arrayContaining([expect.objectContaining({ id: 'response-0' })]),
          })
        );
      });
    });

    describe('Response Filtering', () => {
      it('should apply filters when provided', async () => {
        const filters = [
          {
            fieldId: 'field-1',
            operator: 'equals' as const,
            value: 'John Doe',
          },
        ];
        const filteredResponses = [mockResponses[0]];

        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(formService.getFormById).mockResolvedValue(mockForm as any);
        vi.mocked(responseService.getAllResponsesByFormId).mockResolvedValue(
          mockResponses as any
        );
        vi.mocked(responseFilterService.applyResponseFilters).mockReturnValue(
          filteredResponses as any
        );
        vi.mocked(hocuspocusService.getFormSchemaFromHocuspocus).mockResolvedValue(
          mockForm.formSchema as any
        );
        vi.mocked(unifiedExportService.generateExportFile).mockResolvedValue(
          mockExportResult
        );
        vi.mocked(temporaryFileService.uploadTemporaryFile).mockResolvedValue(
          mockTemporaryFile as any
        );

        await unifiedExportResolvers.Mutation.generateFormResponseReport(
          {},
          { formId: 'form-123', format: 'EXCEL', filters },
          mockContext
        );

        expect(responseFilterService.applyResponseFilters).toHaveBeenCalledWith(
          mockResponses,
          filters
        );
        expect(unifiedExportService.generateExportFile).toHaveBeenCalledWith(
          expect.objectContaining({
            responses: filteredResponses,
          })
        );
      });

      it('should throw error when filters result in no responses', async () => {
        const filters = [
          {
            fieldId: 'field-1',
            operator: 'equals' as const,
            value: 'Nonexistent User',
          },
        ];

        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(formService.getFormById).mockResolvedValue(mockForm as any);
        vi.mocked(responseService.getAllResponsesByFormId).mockResolvedValue(
          mockResponses as any
        );
        vi.mocked(responseFilterService.applyResponseFilters).mockReturnValue([]);

        await expect(
          unifiedExportResolvers.Mutation.generateFormResponseReport(
            {},
            { formId: 'form-123', format: 'EXCEL', filters },
            mockContext
          )
        ).rejects.toThrow('No responses match the applied filters');
      });

      it('should handle multiple filters', async () => {
        const filters = [
          {
            fieldId: 'field-1',
            operator: 'contains' as const,
            value: 'John',
          },
          {
            fieldId: 'field-2',
            operator: 'equals' as const,
            value: 'john@example.com',
          },
        ];

        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(formService.getFormById).mockResolvedValue(mockForm as any);
        vi.mocked(responseService.getAllResponsesByFormId).mockResolvedValue(
          mockResponses as any
        );
        vi.mocked(responseFilterService.applyResponseFilters).mockReturnValue(
          [mockResponses[0]] as any
        );
        vi.mocked(hocuspocusService.getFormSchemaFromHocuspocus).mockResolvedValue(
          mockForm.formSchema as any
        );
        vi.mocked(unifiedExportService.generateExportFile).mockResolvedValue(
          mockExportResult
        );
        vi.mocked(temporaryFileService.uploadTemporaryFile).mockResolvedValue(
          mockTemporaryFile as any
        );

        await unifiedExportResolvers.Mutation.generateFormResponseReport(
          {},
          { formId: 'form-123', format: 'EXCEL', filters },
          mockContext
        );

        expect(responseFilterService.applyResponseFilters).toHaveBeenCalledWith(
          mockResponses,
          filters
        );
      });

      it('should not filter when no filters provided', async () => {
        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(formService.getFormById).mockResolvedValue(mockForm as any);
        vi.mocked(responseService.getAllResponsesByFormId).mockResolvedValue(
          mockResponses as any
        );
        vi.mocked(hocuspocusService.getFormSchemaFromHocuspocus).mockResolvedValue(
          mockForm.formSchema as any
        );
        vi.mocked(unifiedExportService.generateExportFile).mockResolvedValue(
          mockExportResult
        );
        vi.mocked(temporaryFileService.uploadTemporaryFile).mockResolvedValue(
          mockTemporaryFile as any
        );

        await unifiedExportResolvers.Mutation.generateFormResponseReport(
          {},
          { formId: 'form-123', format: 'EXCEL' },
          mockContext
        );

        expect(responseFilterService.applyResponseFilters).not.toHaveBeenCalled();
      });
    });

    describe('Form Schema Handling', () => {
      it('should prefer live form schema from Hocuspocus', async () => {
        const liveSchema = {
          ...mockForm.formSchema,
          pages: [
            {
              id: 'page-1',
              title: 'Live Page',
              order: 0,
              fields: [{ id: 'field-1', type: 'text', label: 'Live Field' }],
            },
          ],
        };

        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(formService.getFormById).mockResolvedValue(mockForm as any);
        vi.mocked(responseService.getAllResponsesByFormId).mockResolvedValue(
          mockResponses as any
        );
        vi.mocked(hocuspocusService.getFormSchemaFromHocuspocus).mockResolvedValue(
          liveSchema as any
        );
        vi.mocked(unifiedExportService.generateExportFile).mockResolvedValue(
          mockExportResult
        );
        vi.mocked(temporaryFileService.uploadTemporaryFile).mockResolvedValue(
          mockTemporaryFile as any
        );

        await unifiedExportResolvers.Mutation.generateFormResponseReport(
          {},
          { formId: 'form-123', format: 'EXCEL' },
          mockContext
        );

        expect(unifiedExportService.generateExportFile).toHaveBeenCalledWith(
          expect.objectContaining({
            formSchema: liveSchema,
          })
        );
      });

      it('should fallback to database schema when live schema unavailable', async () => {
        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(formService.getFormById).mockResolvedValue(mockForm as any);
        vi.mocked(responseService.getAllResponsesByFormId).mockResolvedValue(
          mockResponses as any
        );
        vi.mocked(hocuspocusService.getFormSchemaFromHocuspocus).mockResolvedValue(null);
        vi.mocked(unifiedExportService.generateExportFile).mockResolvedValue(
          mockExportResult
        );
        vi.mocked(temporaryFileService.uploadTemporaryFile).mockResolvedValue(
          mockTemporaryFile as any
        );

        await unifiedExportResolvers.Mutation.generateFormResponseReport(
          {},
          { formId: 'form-123', format: 'EXCEL' },
          mockContext
        );

        expect(unifiedExportService.generateExportFile).toHaveBeenCalledWith(
          expect.objectContaining({
            formSchema: mockForm.formSchema,
          })
        );
      });

      it('should fallback when live schema has no pages', async () => {
        const emptyLiveSchema = {
          pages: [],
          layout: mockForm.formSchema.layout,
          isShuffleEnabled: false,
        };

        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(formService.getFormById).mockResolvedValue(mockForm as any);
        vi.mocked(responseService.getAllResponsesByFormId).mockResolvedValue(
          mockResponses as any
        );
        vi.mocked(hocuspocusService.getFormSchemaFromHocuspocus).mockResolvedValue(
          emptyLiveSchema as any
        );
        vi.mocked(unifiedExportService.generateExportFile).mockResolvedValue(
          mockExportResult
        );
        vi.mocked(temporaryFileService.uploadTemporaryFile).mockResolvedValue(
          mockTemporaryFile as any
        );

        await unifiedExportResolvers.Mutation.generateFormResponseReport(
          {},
          { formId: 'form-123', format: 'EXCEL' },
          mockContext
        );

        expect(unifiedExportService.generateExportFile).toHaveBeenCalledWith(
          expect.objectContaining({
            formSchema: mockForm.formSchema,
          })
        );
      });
    });

    describe('Excel Export', () => {
      it('should generate Excel export successfully', async () => {
        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(formService.getFormById).mockResolvedValue(mockForm as any);
        vi.mocked(responseService.getAllResponsesByFormId).mockResolvedValue(
          mockResponses as any
        );
        vi.mocked(hocuspocusService.getFormSchemaFromHocuspocus).mockResolvedValue(
          mockForm.formSchema as any
        );
        vi.mocked(unifiedExportService.generateExportFile).mockResolvedValue(
          mockExportResult
        );
        vi.mocked(temporaryFileService.uploadTemporaryFile).mockResolvedValue(
          mockTemporaryFile as any
        );

        const result = await unifiedExportResolvers.Mutation.generateFormResponseReport(
          {},
          { formId: 'form-123', format: 'EXCEL' },
          mockContext
        );

        expect(unifiedExportService.generateExportFile).toHaveBeenCalledWith({
          formTitle: 'Test Form',
          responses: mockResponses,
          formSchema: mockForm.formSchema,
          format: 'excel',
        });
        expect(result.format).toBe('EXCEL');
      });

      it('should convert EXCEL format to lowercase for service', async () => {
        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(formService.getFormById).mockResolvedValue(mockForm as any);
        vi.mocked(responseService.getAllResponsesByFormId).mockResolvedValue(
          mockResponses as any
        );
        vi.mocked(hocuspocusService.getFormSchemaFromHocuspocus).mockResolvedValue(
          mockForm.formSchema as any
        );
        vi.mocked(unifiedExportService.generateExportFile).mockResolvedValue(
          mockExportResult
        );
        vi.mocked(temporaryFileService.uploadTemporaryFile).mockResolvedValue(
          mockTemporaryFile as any
        );

        await unifiedExportResolvers.Mutation.generateFormResponseReport(
          {},
          { formId: 'form-123', format: 'EXCEL' },
          mockContext
        );

        expect(unifiedExportService.generateExportFile).toHaveBeenCalledWith(
          expect.objectContaining({
            format: 'excel',
          })
        );
      });

      it('should handle Excel MIME type correctly', async () => {
        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(formService.getFormById).mockResolvedValue(mockForm as any);
        vi.mocked(responseService.getAllResponsesByFormId).mockResolvedValue(
          mockResponses as any
        );
        vi.mocked(hocuspocusService.getFormSchemaFromHocuspocus).mockResolvedValue(
          mockForm.formSchema as any
        );
        vi.mocked(unifiedExportService.generateExportFile).mockResolvedValue(
          mockExportResult
        );
        vi.mocked(temporaryFileService.uploadTemporaryFile).mockResolvedValue(
          mockTemporaryFile as any
        );

        await unifiedExportResolvers.Mutation.generateFormResponseReport(
          {},
          { formId: 'form-123', format: 'EXCEL' },
          mockContext
        );

        expect(temporaryFileService.uploadTemporaryFile).toHaveBeenCalledWith(
          mockExportBuffer,
          'Test_Form_2024-01-01.xlsx',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
      });
    });

    describe('CSV Export', () => {
      it('should generate CSV export successfully', async () => {
        const csvExportResult = {
          buffer: Buffer.from('mock csv data'),
          filename: 'Test_Form_2024-01-01.csv',
          contentType: 'text/csv',
        };

        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(formService.getFormById).mockResolvedValue(mockForm as any);
        vi.mocked(responseService.getAllResponsesByFormId).mockResolvedValue(
          mockResponses as any
        );
        vi.mocked(hocuspocusService.getFormSchemaFromHocuspocus).mockResolvedValue(
          mockForm.formSchema as any
        );
        vi.mocked(unifiedExportService.generateExportFile).mockResolvedValue(
          csvExportResult
        );
        vi.mocked(temporaryFileService.uploadTemporaryFile).mockResolvedValue(
          mockTemporaryFile as any
        );

        const result = await unifiedExportResolvers.Mutation.generateFormResponseReport(
          {},
          { formId: 'form-123', format: 'CSV' },
          mockContext
        );

        expect(unifiedExportService.generateExportFile).toHaveBeenCalledWith({
          formTitle: 'Test Form',
          responses: mockResponses,
          formSchema: mockForm.formSchema,
          format: 'csv',
        });
        expect(result.format).toBe('CSV');
      });

      it('should convert CSV format to lowercase for service', async () => {
        const csvExportResult = {
          buffer: Buffer.from('mock csv data'),
          filename: 'Test_Form_2024-01-01.csv',
          contentType: 'text/csv',
        };

        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(formService.getFormById).mockResolvedValue(mockForm as any);
        vi.mocked(responseService.getAllResponsesByFormId).mockResolvedValue(
          mockResponses as any
        );
        vi.mocked(hocuspocusService.getFormSchemaFromHocuspocus).mockResolvedValue(
          mockForm.formSchema as any
        );
        vi.mocked(unifiedExportService.generateExportFile).mockResolvedValue(
          csvExportResult
        );
        vi.mocked(temporaryFileService.uploadTemporaryFile).mockResolvedValue(
          mockTemporaryFile as any
        );

        await unifiedExportResolvers.Mutation.generateFormResponseReport(
          {},
          { formId: 'form-123', format: 'CSV' },
          mockContext
        );

        expect(unifiedExportService.generateExportFile).toHaveBeenCalledWith(
          expect.objectContaining({
            format: 'csv',
          })
        );
      });

      it('should handle CSV MIME type correctly', async () => {
        const csvExportResult = {
          buffer: Buffer.from('mock csv data'),
          filename: 'Test_Form_2024-01-01.csv',
          contentType: 'text/csv',
        };

        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(formService.getFormById).mockResolvedValue(mockForm as any);
        vi.mocked(responseService.getAllResponsesByFormId).mockResolvedValue(
          mockResponses as any
        );
        vi.mocked(hocuspocusService.getFormSchemaFromHocuspocus).mockResolvedValue(
          mockForm.formSchema as any
        );
        vi.mocked(unifiedExportService.generateExportFile).mockResolvedValue(
          csvExportResult
        );
        vi.mocked(temporaryFileService.uploadTemporaryFile).mockResolvedValue(
          mockTemporaryFile as any
        );

        await unifiedExportResolvers.Mutation.generateFormResponseReport(
          {},
          { formId: 'form-123', format: 'CSV' },
          mockContext
        );

        expect(temporaryFileService.uploadTemporaryFile).toHaveBeenCalledWith(
          csvExportResult.buffer,
          'Test_Form_2024-01-01.csv',
          'text/csv'
        );
      });
    });

    describe('File Upload', () => {
      it('should upload file to temporary storage', async () => {
        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(formService.getFormById).mockResolvedValue(mockForm as any);
        vi.mocked(responseService.getAllResponsesByFormId).mockResolvedValue(
          mockResponses as any
        );
        vi.mocked(hocuspocusService.getFormSchemaFromHocuspocus).mockResolvedValue(
          mockForm.formSchema as any
        );
        vi.mocked(unifiedExportService.generateExportFile).mockResolvedValue(
          mockExportResult
        );
        vi.mocked(temporaryFileService.uploadTemporaryFile).mockResolvedValue(
          mockTemporaryFile as any
        );

        await unifiedExportResolvers.Mutation.generateFormResponseReport(
          {},
          { formId: 'form-123', format: 'EXCEL' },
          mockContext
        );

        expect(temporaryFileService.uploadTemporaryFile).toHaveBeenCalledWith(
          mockExportBuffer,
          'Test_Form_2024-01-01.xlsx',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
      });

      it('should return signed download URL', async () => {
        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(formService.getFormById).mockResolvedValue(mockForm as any);
        vi.mocked(responseService.getAllResponsesByFormId).mockResolvedValue(
          mockResponses as any
        );
        vi.mocked(hocuspocusService.getFormSchemaFromHocuspocus).mockResolvedValue(
          mockForm.formSchema as any
        );
        vi.mocked(unifiedExportService.generateExportFile).mockResolvedValue(
          mockExportResult
        );
        vi.mocked(temporaryFileService.uploadTemporaryFile).mockResolvedValue(
          mockTemporaryFile as any
        );

        const result = await unifiedExportResolvers.Mutation.generateFormResponseReport(
          {},
          { formId: 'form-123', format: 'EXCEL' },
          mockContext
        );

        expect(result.downloadUrl).toBe(
          'https://s3.amazonaws.com/bucket/exports/form-123/export.xlsx?signature=abc'
        );
      });

      it('should return expiration time', async () => {
        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(formService.getFormById).mockResolvedValue(mockForm as any);
        vi.mocked(responseService.getAllResponsesByFormId).mockResolvedValue(
          mockResponses as any
        );
        vi.mocked(hocuspocusService.getFormSchemaFromHocuspocus).mockResolvedValue(
          mockForm.formSchema as any
        );
        vi.mocked(unifiedExportService.generateExportFile).mockResolvedValue(
          mockExportResult
        );
        vi.mocked(temporaryFileService.uploadTemporaryFile).mockResolvedValue(
          mockTemporaryFile as any
        );

        const result = await unifiedExportResolvers.Mutation.generateFormResponseReport(
          {},
          { formId: 'form-123', format: 'EXCEL' },
          mockContext
        );

        expect(result.expiresAt).toBe('2024-01-01T11:00:00.000Z');
      });

      it('should return filename in response', async () => {
        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(formService.getFormById).mockResolvedValue(mockForm as any);
        vi.mocked(responseService.getAllResponsesByFormId).mockResolvedValue(
          mockResponses as any
        );
        vi.mocked(hocuspocusService.getFormSchemaFromHocuspocus).mockResolvedValue(
          mockForm.formSchema as any
        );
        vi.mocked(unifiedExportService.generateExportFile).mockResolvedValue(
          mockExportResult
        );
        vi.mocked(temporaryFileService.uploadTemporaryFile).mockResolvedValue(
          mockTemporaryFile as any
        );

        const result = await unifiedExportResolvers.Mutation.generateFormResponseReport(
          {},
          { formId: 'form-123', format: 'EXCEL' },
          mockContext
        );

        expect(result.filename).toBe('Test_Form_2024-01-01.xlsx');
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
        const customError = new GraphQLError('Custom export error');
        vi.mocked(formService.getFormById).mockRejectedValue(customError);

        await expect(
          unifiedExportResolvers.Mutation.generateFormResponseReport(
            {},
            { formId: 'form-123', format: 'EXCEL' },
            mockContext
          )
        ).rejects.toThrow(GraphQLError);

        await expect(
          unifiedExportResolvers.Mutation.generateFormResponseReport(
            {},
            { formId: 'form-123', format: 'EXCEL' },
            mockContext
          )
        ).rejects.toThrow('Custom export error');
      });

      it('should convert non-GraphQLError to GraphQLError', async () => {
        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        const serviceError = new Error('Export service failed');
        vi.mocked(formService.getFormById).mockRejectedValue(serviceError);

        await expect(
          unifiedExportResolvers.Mutation.generateFormResponseReport(
            {},
            { formId: 'form-123', format: 'EXCEL' },
            mockContext
          )
        ).rejects.toThrow(GraphQLError);

        await expect(
          unifiedExportResolvers.Mutation.generateFormResponseReport(
            {},
            { formId: 'form-123', format: 'EXCEL' },
            mockContext
          )
        ).rejects.toThrow('Failed to generate EXCEL report: Export service failed');
      });

      it('should handle S3 upload errors', async () => {
        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(formService.getFormById).mockResolvedValue(mockForm as any);
        vi.mocked(responseService.getAllResponsesByFormId).mockResolvedValue(
          mockResponses as any
        );
        vi.mocked(hocuspocusService.getFormSchemaFromHocuspocus).mockResolvedValue(
          mockForm.formSchema as any
        );
        vi.mocked(unifiedExportService.generateExportFile).mockResolvedValue(
          mockExportResult
        );
        vi.mocked(temporaryFileService.uploadTemporaryFile).mockRejectedValue(
          new Error('S3 upload failed')
        );

        await expect(
          unifiedExportResolvers.Mutation.generateFormResponseReport(
            {},
            { formId: 'form-123', format: 'EXCEL' },
            mockContext
          )
        ).rejects.toThrow('Failed to generate EXCEL report: S3 upload failed');
      });

      it('should handle export generation errors', async () => {
        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(formService.getFormById).mockResolvedValue(mockForm as any);
        vi.mocked(responseService.getAllResponsesByFormId).mockResolvedValue(
          mockResponses as any
        );
        vi.mocked(hocuspocusService.getFormSchemaFromHocuspocus).mockResolvedValue(
          mockForm.formSchema as any
        );
        vi.mocked(unifiedExportService.generateExportFile).mockRejectedValue(
          new Error('Failed to generate Excel file')
        );

        await expect(
          unifiedExportResolvers.Mutation.generateFormResponseReport(
            {},
            { formId: 'form-123', format: 'EXCEL' },
            mockContext
          )
        ).rejects.toThrow('Failed to generate EXCEL report: Failed to generate Excel file');
      });

      it('should handle unknown errors', async () => {
        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(formService.getFormById).mockRejectedValue('Unknown error');

        await expect(
          unifiedExportResolvers.Mutation.generateFormResponseReport(
            {},
            { formId: 'form-123', format: 'EXCEL' },
            mockContext
          )
        ).rejects.toThrow('Failed to generate EXCEL report: Unknown error');
      });
    });

    describe('Edge Cases', () => {
      it('should handle form with special characters in title', async () => {
        const formWithSpecialTitle = {
          ...mockForm,
          title: 'Test Form (2024) [Final] @org',
        };

        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: formWithSpecialTitle as any,
        });
        vi.mocked(formService.getFormById).mockResolvedValue(formWithSpecialTitle as any);
        vi.mocked(responseService.getAllResponsesByFormId).mockResolvedValue(
          mockResponses as any
        );
        vi.mocked(hocuspocusService.getFormSchemaFromHocuspocus).mockResolvedValue(
          mockForm.formSchema as any
        );
        vi.mocked(unifiedExportService.generateExportFile).mockResolvedValue(
          mockExportResult
        );
        vi.mocked(temporaryFileService.uploadTemporaryFile).mockResolvedValue(
          mockTemporaryFile as any
        );

        await unifiedExportResolvers.Mutation.generateFormResponseReport(
          {},
          { formId: 'form-123', format: 'EXCEL' },
          mockContext
        );

        expect(unifiedExportService.generateExportFile).toHaveBeenCalledWith(
          expect.objectContaining({
            formTitle: 'Test Form (2024) [Final] @org',
          })
        );
      });

      it('should handle form with unicode characters in title', async () => {
        const formWithUnicode = {
          ...mockForm,
          title: 'Formulaire de réponse 中文 ñ',
        };

        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: formWithUnicode as any,
        });
        vi.mocked(formService.getFormById).mockResolvedValue(formWithUnicode as any);
        vi.mocked(responseService.getAllResponsesByFormId).mockResolvedValue(
          mockResponses as any
        );
        vi.mocked(hocuspocusService.getFormSchemaFromHocuspocus).mockResolvedValue(
          mockForm.formSchema as any
        );
        vi.mocked(unifiedExportService.generateExportFile).mockResolvedValue(
          mockExportResult
        );
        vi.mocked(temporaryFileService.uploadTemporaryFile).mockResolvedValue(
          mockTemporaryFile as any
        );

        await unifiedExportResolvers.Mutation.generateFormResponseReport(
          {},
          { formId: 'form-123', format: 'EXCEL' },
          mockContext
        );

        expect(unifiedExportService.generateExportFile).toHaveBeenCalledWith(
          expect.objectContaining({
            formTitle: 'Formulaire de réponse 中文 ñ',
          })
        );
      });

      it('should handle responses with complex metadata', async () => {
        const responsesWithMetadata = [
          {
            ...mockResponses[0],
            metadata: {
              'quiz-grading': { score: 8, total: 10, percentage: 80 },
              'email': { sent: true, sentAt: '2024-01-01T10:00:00Z' },
            },
          },
        ];

        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(formService.getFormById).mockResolvedValue(mockForm as any);
        vi.mocked(responseService.getAllResponsesByFormId).mockResolvedValue(
          responsesWithMetadata as any
        );
        vi.mocked(hocuspocusService.getFormSchemaFromHocuspocus).mockResolvedValue(
          mockForm.formSchema as any
        );
        vi.mocked(unifiedExportService.generateExportFile).mockResolvedValue(
          mockExportResult
        );
        vi.mocked(temporaryFileService.uploadTemporaryFile).mockResolvedValue(
          mockTemporaryFile as any
        );

        const result = await unifiedExportResolvers.Mutation.generateFormResponseReport(
          {},
          { formId: 'form-123', format: 'EXCEL' },
          mockContext
        );

        expect(result).toBeDefined();
      });

      it('should handle very long form IDs', async () => {
        const longFormId = 'f'.repeat(100);
        const longForm = { ...mockForm, id: longFormId };

        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: longForm as any,
        });
        vi.mocked(formService.getFormById).mockResolvedValue(longForm as any);
        vi.mocked(responseService.getAllResponsesByFormId).mockResolvedValue(
          mockResponses as any
        );
        vi.mocked(hocuspocusService.getFormSchemaFromHocuspocus).mockResolvedValue(
          mockForm.formSchema as any
        );
        vi.mocked(unifiedExportService.generateExportFile).mockResolvedValue(
          mockExportResult
        );
        vi.mocked(temporaryFileService.uploadTemporaryFile).mockResolvedValue(
          mockTemporaryFile as any
        );

        await unifiedExportResolvers.Mutation.generateFormResponseReport(
          {},
          { formId: longFormId, format: 'EXCEL' },
          mockContext
        );

        expect(formService.getFormById).toHaveBeenCalledWith(longFormId);
      });
    });

    describe('Export Formats', () => {
      it('should return original format enum in response', async () => {
        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(formService.getFormById).mockResolvedValue(mockForm as any);
        vi.mocked(responseService.getAllResponsesByFormId).mockResolvedValue(
          mockResponses as any
        );
        vi.mocked(hocuspocusService.getFormSchemaFromHocuspocus).mockResolvedValue(
          mockForm.formSchema as any
        );
        vi.mocked(unifiedExportService.generateExportFile).mockResolvedValue(
          mockExportResult
        );
        vi.mocked(temporaryFileService.uploadTemporaryFile).mockResolvedValue(
          mockTemporaryFile as any
        );

        const result = await unifiedExportResolvers.Mutation.generateFormResponseReport(
          {},
          { formId: 'form-123', format: 'EXCEL' },
          mockContext
        );

        expect(result.format).toBe('EXCEL');
      });

      it('should support CSV format in response', async () => {
        const csvExportResult = {
          buffer: Buffer.from('mock csv data'),
          filename: 'Test_Form_2024-01-01.csv',
          contentType: 'text/csv',
        };

        vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
        vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
          hasAccess: true,
          permission: 'VIEWER' as any,
          form: mockForm as any,
        });
        vi.mocked(formService.getFormById).mockResolvedValue(mockForm as any);
        vi.mocked(responseService.getAllResponsesByFormId).mockResolvedValue(
          mockResponses as any
        );
        vi.mocked(hocuspocusService.getFormSchemaFromHocuspocus).mockResolvedValue(
          mockForm.formSchema as any
        );
        vi.mocked(unifiedExportService.generateExportFile).mockResolvedValue(
          csvExportResult
        );
        vi.mocked(temporaryFileService.uploadTemporaryFile).mockResolvedValue(
          mockTemporaryFile as any
        );

        const result = await unifiedExportResolvers.Mutation.generateFormResponseReport(
          {},
          { formId: 'form-123', format: 'CSV' },
          mockContext
        );

        expect(result.format).toBe('CSV');
      });
    });
  });
});

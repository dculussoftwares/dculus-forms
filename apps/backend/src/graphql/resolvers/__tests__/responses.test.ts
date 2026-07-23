import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { responsesResolvers, extendedResponsesResolvers } from '../responses.js';
import { GraphQLError } from '#graphql-errors';
import { DEFAULT_THANK_YOU_CONTENT } from '@dculus/types';
import * as responseService from '../../../services/responseService.js';
import * as formService from '../../../services/formService.js';
import * as betterAuthMiddleware from '../../../middleware/better-auth-middleware.js';
import * as formSharingResolvers from '../formSharing.js';
import * as analyticsService from '../../../services/analyticsService.js';
import * as pluginEvents from '../../../plugins/core/events.js';
import * as usageService from '../../../subscriptions/usageService.js';
import * as subscriptionEvents from '../../../subscriptions/events.js';
import * as editTrackingService from '../../../services/responseEditTrackingService.js';
import * as tagService from '../../../services/tagService.js';
import * as responseCopyService from '../../../services/responseCopyService.js';

// Shared tx client for $transaction tests
const mockTxClient = {
  response: {
    count: vi.fn(),
    create: vi.fn(),
  },
};

// Mock all dependencies
vi.mock('../../../services/responseService.js');
vi.mock('../../../services/formService.js');
vi.mock('../../../repositories/responseRepository.js', () => ({
  responseRepository: {
    count: vi.fn(),
  },
}));
vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    form: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn((callback: (tx: typeof mockTxClient) => Promise<any>) =>
      callback(mockTxClient)
    ),
  },
  isLocalDatabase: vi.fn(() => true),
}));
vi.mock('../../../middleware/better-auth-middleware.js');
vi.mock('../formSharing.js');
vi.mock('../../../services/analyticsService.js');
vi.mock('../../../plugins/core/events.js');
vi.mock('../../../subscriptions/usageService.js');
vi.mock('../../../subscriptions/events.js');
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
    generateId: vi.fn(() => 'generated-response-id'),
  };
});
vi.mock('../../../services/tagService.js');
// Mock the dynamic import used by getEditHistoryMemoised
vi.mock('../../../services/responseEditTrackingService.js', () => ({
  ResponseEditTrackingService: {
    getEditHistory: vi.fn(),
  },
}));
vi.mock('../../../services/responseCopyService.js', () => ({
  sendResponseCopyIfEnabled: vi.fn().mockResolvedValue(undefined),
}));

describe('Responses Resolvers', () => {
  const mockContext = {
    auth: {
      user: {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      },
      session: {
        id: 'session-123',
        activeOrganizationId: 'org-123',
      },
      isAuthenticated: true,
    },
    req: {
      ip: '192.168.1.1',
      headers: {
        'user-agent': 'Mozilla/5.0',
      },
    },
  };

  const mockResponse = {
    id: 'response-123',
    formId: 'form-123',
    data: { field1: 'value1', field2: 'value2' },
    metadata: {},
    submittedAt: new Date('2024-01-01T12:00:00Z'),
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
    formSchema: {
      pages: [{
        id: 'page-1',
        title: 'Page 1',
        fields: [],
        order: 0,
      }],
      layout: {
        theme: 'light',
        backgroundImageKey: '',
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Query: responses', () => {
    it('should return responses for accessible forms only', async () => {
      const { prisma } = await import('../../../lib/prisma.js');
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockResolvedValue(undefined);
      vi.mocked(prisma.form.findMany as any).mockResolvedValue([{ id: 'form-123' }]);
      vi.mocked(responseService.getAllResponses).mockResolvedValue([mockResponse] as any);

      const result = await responsesResolvers.Query.responses(
        {},
        { organizationId: 'org-123' },
        mockContext
      );

      expect(betterAuthMiddleware.requireOrganizationMembership).toHaveBeenCalledWith(
        mockContext.auth,
        'org-123'
      );
      expect(responseService.getAllResponses).toHaveBeenCalledWith('org-123');
      // mockResponse.formId === 'form-123' which is in the accessible list
      expect(result).toEqual([mockResponse]);
    });

    it('should exclude responses from forms the user cannot access', async () => {
      const { prisma } = await import('../../../lib/prisma.js');
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockResolvedValue(undefined);
      // User has access to form-123 but NOT form-456
      vi.mocked(prisma.form.findMany as any).mockResolvedValue([{ id: 'form-123' }]);
      const hiddenResponse = { ...mockResponse, id: 'response-456', formId: 'form-456' };
      vi.mocked(responseService.getAllResponses).mockResolvedValue([mockResponse, hiddenResponse] as any);

      const result = await responsesResolvers.Query.responses(
        {},
        { organizationId: 'org-123' },
        mockContext
      );

      expect(result).toEqual([mockResponse]);
      expect(result).not.toContainEqual(hiddenResponse);
    });

    it('should throw error when user is not organization member', async () => {
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockRejectedValue(
        new Error('Not a member')
      );

      await expect(
        responsesResolvers.Query.responses({}, { organizationId: 'org-123' }, mockContext)
      ).rejects.toThrow('Not a member');
    });
  });

  describe('Query: response', () => {
    it('should return response by id when user is authenticated', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
      vi.mocked(responseService.getResponseById).mockResolvedValue(mockResponse as any);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: true,
        permission: 'VIEWER' as any,
        form: mockForm as any,
      });

      const result = await responsesResolvers.Query.response(
        {},
        { id: 'response-123' },
        mockContext
      );

      expect(betterAuthMiddleware.requireAuth).toHaveBeenCalledWith(mockContext.auth);
      expect(responseService.getResponseById).toHaveBeenCalledWith('response-123');
      expect(result).toEqual(mockResponse);
    });

    it('should throw error when response not found', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
      vi.mocked(responseService.getResponseById).mockResolvedValue(null);

      await expect(
        responsesResolvers.Query.response({}, { id: 'invalid-id' }, mockContext)
      ).rejects.toThrow('Response not found');
    });

    it('should require authentication', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockImplementation(() => {
        throw new Error('Authentication required');
      });

      await expect(
        responsesResolvers.Query.response({}, { id: 'response-123' }, mockContext)
      ).rejects.toThrow('Authentication required');
    });
  });

  describe('Query: responsesByForm', () => {
    const mockPaginatedResult = {
      data: [mockResponse],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    };

    beforeEach(() => {
      // Reset requireOrganizationMembership to default (pass) before each test in this block
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockResolvedValue(undefined);
    });

    it('should return paginated responses for form', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
      vi.mocked(formService.getFormById).mockResolvedValue(mockForm as any);
      vi.mocked(responseService.getResponsesByFormId).mockResolvedValue(mockPaginatedResult as any);

      const result = await responsesResolvers.Query.responsesByForm(
        {},
        {
          formId: 'form-123',
          page: 1,
          limit: 10,
          sortBy: 'submittedAt',
          sortOrder: 'desc',
        },
        mockContext
      );

      expect(formService.getFormById).toHaveBeenCalledWith('form-123');
      expect(responseService.getResponsesByFormId).toHaveBeenCalledWith(
        'form-123',
        1,
        10,
        'submittedAt',
        'desc',
        undefined,
        'AND'
      );
      expect(result).toEqual(mockPaginatedResult);
    });

    it('should apply filters when provided', async () => {
      const filters = [{ fieldId: 'field1', operator: 'equals', value: 'value1' }];
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
      vi.mocked(formService.getFormById).mockResolvedValue(mockForm as any);
      vi.mocked(responseService.getResponsesByFormId).mockResolvedValue(mockPaginatedResult as any);

      await responsesResolvers.Query.responsesByForm(
        {},
        {
          formId: 'form-123',
          page: 1,
          limit: 10,
          sortBy: 'submittedAt',
          sortOrder: 'desc',
          filters,
        },
        mockContext
      );

      expect(responseService.getResponsesByFormId).toHaveBeenCalledWith(
        'form-123',
        1,
        10,
        'submittedAt',
        'desc',
        filters,
        'AND'
      );
    });

    it('should throw error when form not found', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
      vi.mocked(formService.getFormById).mockResolvedValue(null);

      await expect(
        responsesResolvers.Query.responsesByForm(
          {},
          { formId: 'invalid-form', page: 1, limit: 10, sortBy: 'submittedAt', sortOrder: 'desc' },
          mockContext
        )
      ).rejects.toThrow('Form not found');
    });

    it('should deny access when user not in form organization', async () => {
      const differentOrgContext = {
        ...mockContext,
        auth: {
          ...mockContext.auth,
          session: { id: 'session-123', activeOrganizationId: 'different-org' },
        },
      };
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
      vi.mocked(formService.getFormById).mockResolvedValue(mockForm as any);
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockRejectedValue(
        new GraphQLError('Access denied: You do not have permission to view responses for this form')
      );

      await expect(
        responsesResolvers.Query.responsesByForm(
          {},
          { formId: 'form-123', page: 1, limit: 10, sortBy: 'submittedAt', sortOrder: 'desc' },
          differentOrgContext as any
        )
      ).rejects.toThrow('Access denied: You do not have permission to view responses for this form');
    });

    it('should deny access when no session', async () => {
      const noSessionContext = {
        ...mockContext,
        auth: {
          ...mockContext.auth,
          session: null,
        },
      };
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
      vi.mocked(formService.getFormById).mockResolvedValue(mockForm as any);
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockRejectedValue(
        new GraphQLError('Access denied: You do not have permission to view responses for this form')
      );

      await expect(
        responsesResolvers.Query.responsesByForm(
          {},
          { formId: 'form-123', page: 1, limit: 10, sortBy: 'submittedAt', sortOrder: 'desc' },
          noSessionContext as any
        )
      ).rejects.toThrow('Access denied: You do not have permission to view responses for this form');
    });
  });

  describe('Mutation: submitResponse', () => {
    const mockInput = {
      formId: 'form-123',
      data: { field1: 'answer1', field2: 'answer2' },
      sessionId: 'session-abc',
      userAgent: 'Mozilla/5.0',
      timezone: 'America/New_York',
      language: 'en-US',
      completionTimeSeconds: 120,
    };

    beforeEach(() => {
      vi.mocked(formService.getFormById).mockResolvedValue(mockForm as any);
      vi.mocked(usageService.checkUsageExceeded).mockResolvedValue({
        viewsExceeded: false,
        submissionsExceeded: false,
      });
      vi.mocked(responseService.submitResponse).mockResolvedValue(mockResponse as any);
      vi.mocked(pluginEvents.emitFormSubmitted).mockReturnValue(undefined);
      vi.mocked(subscriptionEvents.emitFormSubmitted).mockReturnValue(undefined);
      vi.mocked(tagService.upsertPreviewTag).mockResolvedValue({
        id: 'preview-tag-id',
        formId: 'form-123',
        name: '__preview__',
        color: '#f59e0b',
        createdAt: new Date(),
      });
      vi.mocked(tagService.addTagToResponse).mockResolvedValue(true);
    });

    it('should submit response successfully', async () => {
      const result = await responsesResolvers.Mutation.submitResponse(
        {},
        { input: mockInput },
        mockContext
      );

      expect(formService.getFormById).toHaveBeenCalledWith('form-123');
      expect(usageService.checkUsageExceeded).toHaveBeenCalledWith('org-123');
      expect(responseService.submitResponse).toHaveBeenCalled();
      expect(result).toMatchObject({
        ...mockResponse,
        thankYouMessage: DEFAULT_THANK_YOU_CONTENT,
      });
    });

    it('should track analytics when analytics data provided', async () => {
      await responsesResolvers.Mutation.submitResponse(
        {},
        { input: mockInput },
        mockContext
      );

      expect(analyticsService.analyticsService.trackFormSubmission).toHaveBeenCalledWith(
        {
          formId: 'form-123',
          responseId: 'response-123',
          sessionId: 'session-abc',
          userAgent: 'Mozilla/5.0',
          timezone: 'America/New_York',
          language: 'en-US',
          completionTimeSeconds: 120,
        },
        '192.168.1.1'
      );
    });

    it('should emit plugin events after submission', async () => {
      await responsesResolvers.Mutation.submitResponse(
        {},
        { input: mockInput },
        mockContext
      );

      expect(pluginEvents.emitFormSubmitted).toHaveBeenCalledWith(
        'form-123',
        'org-123',
        expect.objectContaining({
          responseId: 'response-123',
          field1: 'answer1',
          field2: 'answer2',
        })
      );
    });

    it('should emit subscription events after submission', async () => {
      await responsesResolvers.Mutation.submitResponse(
        {},
        { input: mockInput },
        mockContext
      );

      expect(subscriptionEvents.emitFormSubmitted).toHaveBeenCalledWith(
        'org-123',
        'form-123',
        'response-123'
      );
    });

    it('should substitute mentions in a custom thank you message', async () => {
      const formWithCustomMessage = {
        ...mockForm,
        formSchema: {
          ...mockForm.formSchema,
          layout: {
            ...mockForm.formSchema.layout,
            thankYouContent: 'Thank you, {{field1}}!',
          },
        },
      };
      vi.mocked(formService.getFormById).mockResolvedValue(formWithCustomMessage as any);

      const result = await responsesResolvers.Mutation.submitResponse(
        {},
        { input: mockInput },
        mockContext
      );

      expect(result.thankYouMessage).toContain('answer1');
    });

    it('should throw error when form not found', async () => {
      vi.mocked(formService.getFormById).mockResolvedValue(null);

      await expect(
        responsesResolvers.Mutation.submitResponse({}, { input: mockInput }, mockContext)
      ).rejects.toThrow('Form not found');
    });

    it('should throw error when form not published', async () => {
      vi.mocked(formService.getFormById).mockResolvedValue({
        ...mockForm,
        isPublished: false,
      } as any);

      await expect(
        responsesResolvers.Mutation.submitResponse({}, { input: mockInput }, mockContext)
      ).rejects.toThrow('Form is not published and cannot accept responses');
    });

    it('should throw error when submission limit exceeded', async () => {
      vi.mocked(usageService.checkUsageExceeded).mockResolvedValue({
        viewsExceeded: false,
        submissionsExceeded: true,
      });

      await expect(
        responsesResolvers.Mutation.submitResponse({}, { input: mockInput }, mockContext)
      ).rejects.toThrow('Form submission limit exceeded for this organization subscription plan');
    });

    it('should enforce max responses limit', async () => {
      const formWithLimits = {
        ...mockForm,
        settings: {
          submissionLimits: {
            maxResponses: { enabled: true, limit: 10 },
          },
        },
      };
      vi.mocked(formService.getFormById).mockResolvedValue(formWithLimits as any);
      mockTxClient.response.count.mockResolvedValue(10);

      await expect(
        responsesResolvers.Mutation.submitResponse({}, { input: mockInput }, mockContext)
      ).rejects.toThrow('Form has reached its maximum response limit');
    });

    it('should allow submission when under max responses limit', async () => {
      const formWithLimits = {
        ...mockForm,
        settings: {
          submissionLimits: {
            maxResponses: { enabled: true, limit: 10 },
          },
        },
      };
      vi.mocked(formService.getFormById).mockResolvedValue(formWithLimits as any);
      mockTxClient.response.count.mockResolvedValue(5);
      mockTxClient.response.create.mockResolvedValue({
        id: 'generated-response-id',
        formId: 'form-123',
        data: {},
        submittedAt: new Date(),
      });

      const result = await responsesResolvers.Mutation.submitResponse(
        {},
        { input: mockInput },
        mockContext
      );

      expect(result).toBeDefined();
    });

    it('should enforce time window start date', async () => {
      const futureDate = new Date();
      futureDate.setUTCDate(futureDate.getUTCDate() + 2);
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
      vi.mocked(formService.getFormById).mockResolvedValue(formWithTimeWindow as any);

      await expect(
        responsesResolvers.Mutation.submitResponse({}, { input: mockInput }, mockContext)
      ).rejects.toThrow('Form is not yet open for submissions');
    });

    it('should enforce time window end date', async () => {
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
      vi.mocked(formService.getFormById).mockResolvedValue(formWithTimeWindow as any);

      await expect(
        responsesResolvers.Mutation.submitResponse({}, { input: mockInput }, mockContext)
      ).rejects.toThrow('Form submission period has ended');
    });

    it('should allow submission within time window', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const formWithTimeWindow = {
        ...mockForm,
        settings: {
          submissionLimits: {
            timeWindow: {
              enabled: true,
              startDate: yesterday.toISOString().split('T')[0],
              endDate: tomorrow.toISOString().split('T')[0],
            },
          },
        },
      };
      vi.mocked(formService.getFormById).mockResolvedValue(formWithTimeWindow as any);

      const result = await responsesResolvers.Mutation.submitResponse(
        {},
        { input: mockInput },
        mockContext
      );

      expect(result).toBeDefined();
    });

    it('should enforce time window start date-time with hour precision', async () => {
      const twoHoursFromNow = new Date();
      twoHoursFromNow.setHours(twoHoursFromNow.getHours() + 2);
      const formWithTimeWindow = {
        ...mockForm,
        settings: {
          submissionLimits: {
            timeWindow: {
              enabled: true,
              startDate: twoHoursFromNow.toISOString(),
            },
          },
        },
      };
      vi.mocked(formService.getFormById).mockResolvedValue(formWithTimeWindow as any);

      await expect(
        responsesResolvers.Mutation.submitResponse({}, { input: mockInput }, mockContext)
      ).rejects.toThrow('Form is not yet open for submissions');
    });

    it('should enforce time window end date-time with hour precision', async () => {
      const twoHoursAgo = new Date();
      twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);
      const formWithTimeWindow = {
        ...mockForm,
        settings: {
          submissionLimits: {
            timeWindow: {
              enabled: true,
              endDate: twoHoursAgo.toISOString(),
            },
          },
        },
      };
      vi.mocked(formService.getFormById).mockResolvedValue(formWithTimeWindow as any);

      await expect(
        responsesResolvers.Mutation.submitResponse({}, { input: mockInput }, mockContext)
      ).rejects.toThrow('Form submission period has ended');
    });

    it('should allow submission within a precise start/end date-time window', async () => {
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);
      const oneHourFromNow = new Date();
      oneHourFromNow.setHours(oneHourFromNow.getHours() + 1);
      const formWithTimeWindow = {
        ...mockForm,
        settings: {
          submissionLimits: {
            timeWindow: {
              enabled: true,
              startDate: oneHourAgo.toISOString(),
              endDate: oneHourFromNow.toISOString(),
            },
          },
        },
      };
      vi.mocked(formService.getFormById).mockResolvedValue(formWithTimeWindow as any);

      const result = await responsesResolvers.Mutation.submitResponse(
        {},
        { input: mockInput },
        mockContext
      );

      expect(result).toBeDefined();
    });

    it('should throw BAD_USER_INPUT for a malformed time window start value', async () => {
      const formWithTimeWindow = {
        ...mockForm,
        settings: {
          submissionLimits: {
            timeWindow: {
              enabled: true,
              startDate: 'not-a-date',
            },
          },
        },
      };
      vi.mocked(formService.getFormById).mockResolvedValue(formWithTimeWindow as any);

      await expect(
        responsesResolvers.Mutation.submitResponse({}, { input: mockInput }, mockContext)
      ).rejects.toThrow('Form has an invalid start date configured');
    });

    it('should throw BAD_USER_INPUT for a malformed time window end value', async () => {
      const formWithTimeWindow = {
        ...mockForm,
        settings: {
          submissionLimits: {
            timeWindow: {
              enabled: true,
              endDate: 'not-a-date',
            },
          },
        },
      };
      vi.mocked(formService.getFormById).mockResolvedValue(formWithTimeWindow as any);

      await expect(
        responsesResolvers.Mutation.submitResponse({}, { input: mockInput }, mockContext)
      ).rejects.toThrow('Form has an invalid end date configured');
    });

    it('should handle missing analytics data gracefully', async () => {
      const inputWithoutAnalytics = {
        formId: 'form-123',
        data: { field1: 'answer1' },
      };

      const result = await responsesResolvers.Mutation.submitResponse(
        {},
        { input: inputWithoutAnalytics },
        mockContext
      );

      expect(result).toBeDefined();
      expect(analyticsService.analyticsService.trackFormSubmission).not.toHaveBeenCalled();
    });

    it('should continue submission even if analytics tracking fails', async () => {
      vi.mocked(analyticsService.analyticsService.trackFormSubmission).mockRejectedValue(
        new Error('Analytics error')
      );

      const result = await responsesResolvers.Mutation.submitResponse(
        {},
        { input: mockInput },
        mockContext
      );

      expect(result).toBeDefined();
    });

    it('should continue submission even if plugin event fails', async () => {
      vi.mocked(pluginEvents.emitFormSubmitted).mockImplementation(() => {
        throw new Error('Plugin error');
      });

      const result = await responsesResolvers.Mutation.submitResponse(
        {},
        { input: mockInput },
        mockContext
      );

      expect(result).toBeDefined();
    });

    it('should continue submission even if subscription event fails', async () => {
      vi.mocked(subscriptionEvents.emitFormSubmitted).mockImplementation(() => {
        throw new Error('Subscription error');
      });

      const result = await responsesResolvers.Mutation.submitResponse(
        {},
        { input: mockInput },
        mockContext
      );

      expect(result).toBeDefined();
    });

    it('should extract IP from x-forwarded-for header', async () => {
      const contextWithForwardedFor = {
        ...mockContext,
        req: {
          ...mockContext.req,
          ip: undefined,
          headers: {
            'user-agent': 'Mozilla/5.0',
            'x-forwarded-for': '10.0.0.1, 192.168.1.1',
          },
        },
      };

      await responsesResolvers.Mutation.submitResponse(
        {},
        { input: mockInput },
        contextWithForwardedFor as any
      );

      expect(analyticsService.analyticsService.trackFormSubmission).toHaveBeenCalledWith(
        expect.any(Object),
        '10.0.0.1'
      );
    });

    describe('isPreview flag', () => {
      it('auto-tags response with __preview__ when isPreview is true', async () => {
        const mockInput = {
          formId: 'form-123',
          data: { field1: 'value1' },
          isPreview: true,
        };

        vi.mocked(formService.getFormById).mockResolvedValue({
          id: 'form-123',
          organizationId: 'org-123',
          isPublished: true,
          settings: {},
          formSchema: null,
        } as any);
        vi.mocked(usageService.checkUsageExceeded).mockResolvedValue({
          submissionsExceeded: false,
          viewsExceeded: false,
        } as any);
        vi.mocked(responseService.submitResponse).mockResolvedValue({
          id: 'response-abc',
          formId: 'form-123',
          data: { field1: 'value1' },
          submittedAt: new Date(),
        } as any);

        await responsesResolvers.Mutation.submitResponse(
          {},
          { input: mockInput },
          mockContext
        );

        expect(tagService.upsertPreviewTag).toHaveBeenCalledWith('form-123');
        expect(tagService.addTagToResponse).toHaveBeenCalledWith(
          'response-abc',
          'preview-tag-id'
        );
      });

      it('does NOT call upsertPreviewTag when isPreview is falsy', async () => {
        const mockInput = {
          formId: 'form-123',
          data: { field1: 'value1' },
        };

        vi.mocked(formService.getFormById).mockResolvedValue({
          id: 'form-123',
          organizationId: 'org-123',
          isPublished: true,
          settings: {},
          formSchema: null,
        } as any);
        vi.mocked(usageService.checkUsageExceeded).mockResolvedValue({
          submissionsExceeded: false,
          viewsExceeded: false,
        } as any);
        vi.mocked(responseService.submitResponse).mockResolvedValue({
          id: 'response-xyz',
          formId: 'form-123',
          data: {},
          submittedAt: new Date(),
        } as any);

        await responsesResolvers.Mutation.submitResponse(
          {},
          { input: mockInput },
          mockContext
        );

        expect(tagService.upsertPreviewTag).not.toHaveBeenCalled();
      });
    });

    describe('response copy on preview submissions', () => {
      const formWithResponseCopyEnabled = {
        id: 'form-123',
        organizationId: 'org-123',
        title: 'Feedback Form',
        isPublished: true,
        settings: { responseCopy: { enabled: true, mode: 'always', emailFieldId: 'f-email' } },
        formSchema: null,
      };

      beforeEach(() => {
        vi.mocked(usageService.checkUsageExceeded).mockResolvedValue({
          submissionsExceeded: false,
          viewsExceeded: false,
        } as any);
        vi.mocked(responseService.submitResponse).mockResolvedValue({
          id: 'response-abc',
          formId: 'form-123',
          data: { 'f-email': 'respondent@example.com' },
          submittedAt: new Date(),
        } as any);
      });

      it('does not send a response copy email for a preview submission', async () => {
        vi.mocked(formService.getFormById).mockResolvedValue(formWithResponseCopyEnabled as any);

        await responsesResolvers.Mutation.submitResponse(
          {},
          { input: { formId: 'form-123', data: { 'f-email': 'respondent@example.com' }, isPreview: true } },
          mockContext
        );

        expect(responseCopyService.sendResponseCopyIfEnabled).not.toHaveBeenCalled();
      });

      it('sends a response copy email for a real (non-preview) submission', async () => {
        vi.mocked(formService.getFormById).mockResolvedValue(formWithResponseCopyEnabled as any);

        await responsesResolvers.Mutation.submitResponse(
          {},
          { input: { formId: 'form-123', data: { 'f-email': 'respondent@example.com' } } },
          mockContext
        );

        expect(responseCopyService.sendResponseCopyIfEnabled).toHaveBeenCalledWith(
          expect.objectContaining({ form: formWithResponseCopyEnabled })
        );
      });
    });
  });

  describe('Mutation: updateResponse', () => {
    const mockUpdateInput = {
      responseId: 'response-123',
      data: { field1: 'updated-value' },
      editReason: 'Correcting typo',
    };

    beforeEach(() => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
      vi.mocked(responseService.getResponseById).mockResolvedValue(mockResponse as any);
      vi.mocked(formService.getFormById).mockResolvedValue(mockForm as any);
      // Reset requireOrganizationMembership to default (pass) before each test in this block
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockResolvedValue(undefined);
      vi.mocked(responseService.updateResponse).mockResolvedValue({
        ...mockResponse,
        data: mockUpdateInput.data,
      } as any);
    });

    it('should update response successfully', async () => {
      const result = await responsesResolvers.Mutation.updateResponse(
        {},
        { input: mockUpdateInput },
        mockContext
      );

      expect(betterAuthMiddleware.requireAuth).toHaveBeenCalledWith(mockContext.auth);
      expect(responseService.getResponseById).toHaveBeenCalledWith('response-123');
      expect(formService.getFormById).toHaveBeenCalledWith('form-123');
      expect(responseService.updateResponse).toHaveBeenCalledWith(
        'response-123',
        mockUpdateInput.data,
        expect.objectContaining({
          userId: 'user-123',
          editReason: 'Correcting typo',
        })
      );
      expect(result.data).toEqual(mockUpdateInput.data);
    });

    it('should track edit context with IP and user agent', async () => {
      await responsesResolvers.Mutation.updateResponse(
        {},
        { input: mockUpdateInput },
        mockContext
      );

      expect(responseService.updateResponse).toHaveBeenCalledWith(
        'response-123',
        mockUpdateInput.data,
        expect.objectContaining({
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        })
      );
    });

    it('should handle missing edit reason', async () => {
      const inputWithoutReason = {
        responseId: 'response-123',
        data: { field1: 'updated-value' },
      };

      await responsesResolvers.Mutation.updateResponse(
        {},
        { input: inputWithoutReason },
        mockContext
      );

      expect(responseService.updateResponse).toHaveBeenCalledWith(
        'response-123',
        inputWithoutReason.data,
        expect.objectContaining({
          editReason: undefined,
        })
      );
    });

    it('should throw error when response not found', async () => {
      vi.mocked(responseService.getResponseById).mockResolvedValue(null);

      await expect(
        responsesResolvers.Mutation.updateResponse({}, { input: mockUpdateInput }, mockContext)
      ).rejects.toThrow('Response not found');
    });

    it('should throw error when form not found', async () => {
      vi.mocked(formService.getFormById).mockResolvedValue(null);

      await expect(
        responsesResolvers.Mutation.updateResponse({}, { input: mockUpdateInput }, mockContext)
      ).rejects.toThrow('Form not found');
    });

    it('should deny access when user not in form organization', async () => {
      const differentOrgContext = {
        ...mockContext,
        auth: {
          ...mockContext.auth,
          session: { id: 'session-123', activeOrganizationId: 'different-org' },
        },
      };
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockRejectedValue(
        new GraphQLError('Access denied: You do not have permission to edit this response')
      );

      await expect(
        responsesResolvers.Mutation.updateResponse(
          {},
          { input: mockUpdateInput },
          differentOrgContext as any
        )
      ).rejects.toThrow('Access denied: You do not have permission to edit this response');
    });

    it('should deny access when no session', async () => {
      const noSessionContext = {
        ...mockContext,
        auth: {
          ...mockContext.auth,
          session: null,
        },
      };
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockRejectedValue(
        new GraphQLError('Access denied: You do not have permission to edit this response')
      );

      await expect(
        responsesResolvers.Mutation.updateResponse(
          {},
          { input: mockUpdateInput },
          noSessionContext as any
        )
      ).rejects.toThrow('Access denied: You do not have permission to edit this response');
    });

    it('should extract IP from x-forwarded-for header', async () => {
      const contextWithForwardedFor = {
        ...mockContext,
        req: {
          ...mockContext.req,
          ip: undefined,
          headers: {
            'user-agent': 'Mozilla/5.0',
            'x-forwarded-for': '10.0.0.1, 192.168.1.1',
          },
        },
      };

      await responsesResolvers.Mutation.updateResponse(
        {},
        { input: mockUpdateInput },
        contextWithForwardedFor as any
      );

      expect(responseService.updateResponse).toHaveBeenCalledWith(
        'response-123',
        mockUpdateInput.data,
        expect.objectContaining({
          ipAddress: '10.0.0.1',
        })
      );
    });

    it('should require authentication', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockImplementation(() => {
        throw new Error('Authentication required');
      });

      await expect(
        responsesResolvers.Mutation.updateResponse({}, { input: mockUpdateInput }, mockContext)
      ).rejects.toThrow('Authentication required');
    });
  });

  describe('Mutation: deleteResponse', () => {
    beforeEach(() => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
      vi.mocked(responseService.getResponseById).mockResolvedValue(mockResponse as any);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: true,
        permission: 'OWNER' as any,
        form: mockForm as any,
      });
      vi.mocked(responseService.deleteResponse).mockResolvedValue(true);
    });

    it('should delete response with owner permissions', async () => {
      const result = await responsesResolvers.Mutation.deleteResponse(
        {},
        { id: 'response-123' },
        mockContext
      );

      expect(betterAuthMiddleware.requireAuth).toHaveBeenCalledWith(mockContext.auth);
      expect(responseService.getResponseById).toHaveBeenCalledWith('response-123');
      expect(formSharingResolvers.checkFormAccess).toHaveBeenCalledWith(
        'user-123',
        'form-123',
        formSharingResolvers.PermissionLevel.OWNER
      );
      expect(responseService.deleteResponse).toHaveBeenCalledWith('response-123');
      expect(result).toBe(true);
    });

    it('should throw error when response not found', async () => {
      vi.mocked(responseService.getResponseById).mockResolvedValue(null);

      await expect(
        responsesResolvers.Mutation.deleteResponse({}, { id: 'invalid-id' }, mockContext)
      ).rejects.toThrow('Response not found');
    });

    it('should deny access when user is not owner', async () => {
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: false,
        permission: null as any,
        form: null as any,
      });

      await expect(
        responsesResolvers.Mutation.deleteResponse({}, { id: 'response-123' }, mockContext)
      ).rejects.toThrow(GraphQLError);
      await expect(
        responsesResolvers.Mutation.deleteResponse({}, { id: 'response-123' }, mockContext)
      ).rejects.toThrow('Access denied: You need OWNER access to delete responses for this form');
    });

    it('should require authentication', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockImplementation(() => {
        throw new Error('Authentication required');
      });

      await expect(
        responsesResolvers.Mutation.deleteResponse({}, { id: 'response-123' }, mockContext)
      ).rejects.toThrow('Authentication required');
    });
  });

  describe('Extended Resolvers: Query.responseEditHistory', () => {
    beforeEach(() => {
      // Reset requireOrganizationMembership to default (pass) before each test in this block
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockResolvedValue(undefined);
    });

    const mockEditHistory = [
      {
        id: 'edit-1',
        responseId: 'response-123',
        editedBy: {
          id: 'user-456',
          name: 'Editor User',
          email: 'editor@example.com',
          image: null,
        },
        editedAt: new Date('2024-01-02T10:00:00Z'),
        editType: 'manual',
        editReason: 'Fixing data',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        totalChanges: 2,
        changesSummary: '2 fields changed',
        fieldChanges: [
          {
            id: 'change-1',
            fieldId: 'field1',
            fieldLabel: 'Question 1',
            fieldType: 'text',
            previousValue: 'old value',
            newValue: 'new value',
            changeType: 'updated',
            valueChangeSize: 5,
          },
        ],
      },
    ];

    it('should return edit history for response', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
      vi.mocked(responseService.getResponseById).mockResolvedValue(mockResponse as any);
      vi.mocked(formService.getFormById).mockResolvedValue(mockForm as any);
      vi.mocked(editTrackingService.ResponseEditTrackingService.getEditHistory).mockResolvedValue(mockEditHistory as any);

      const result = await extendedResponsesResolvers.Query.responseEditHistory(
        {},
        { responseId: 'response-123' },
        mockContext
      );

      expect(betterAuthMiddleware.requireAuth).toHaveBeenCalledWith(mockContext.auth);
      expect(responseService.getResponseById).toHaveBeenCalledWith('response-123');
      expect(formService.getFormById).toHaveBeenCalledWith('form-123');
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should throw error when response not found', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
      vi.mocked(responseService.getResponseById).mockResolvedValue(null);

      await expect(
        extendedResponsesResolvers.Query.responseEditHistory(
          {},
          { responseId: 'invalid-id' },
          mockContext
        )
      ).rejects.toThrow('Response not found');
    });

    it('should throw error when form not found', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
      vi.mocked(responseService.getResponseById).mockResolvedValue(mockResponse as any);
      vi.mocked(formService.getFormById).mockResolvedValue(null);

      await expect(
        extendedResponsesResolvers.Query.responseEditHistory(
          {},
          { responseId: 'response-123' },
          mockContext
        )
      ).rejects.toThrow('Form not found');
    });

    it('should deny access when user not in form organization', async () => {
      const differentOrgContext = {
        ...mockContext,
        auth: {
          ...mockContext.auth,
          session: { id: 'session-123', activeOrganizationId: 'different-org' },
        },
      };
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
      vi.mocked(responseService.getResponseById).mockResolvedValue(mockResponse as any);
      vi.mocked(formService.getFormById).mockResolvedValue(mockForm as any);
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockRejectedValue(
        new GraphQLError('Access denied: You do not have permission to view edit history for this response')
      );

      await expect(
        extendedResponsesResolvers.Query.responseEditHistory(
          {},
          { responseId: 'response-123' },
          differentOrgContext as any
        )
      ).rejects.toThrow('Access denied: You do not have permission to view edit history for this response');
    });
  });

  describe('Extended Resolvers: FormResponse.hasBeenEdited', () => {
    it('should return true when response has been edited', async () => {
      vi.mocked(editTrackingService.ResponseEditTrackingService.getEditHistory).mockResolvedValue([{ id: 'edit-1' }] as any);
      // Use fresh parent to avoid cached _editHistoryPromise
      const parent = { ...mockResponse };

      const result = await extendedResponsesResolvers.FormResponse.hasBeenEdited(parent);

      expect(result).toBe(true);
    });

    it('should return false when response has not been edited', async () => {
      vi.mocked(editTrackingService.ResponseEditTrackingService.getEditHistory).mockResolvedValue([]);
      const parent = { ...mockResponse };

      const result = await extendedResponsesResolvers.FormResponse.hasBeenEdited(parent);

      expect(result).toBe(false);
    });

    it('should return false when error occurs', async () => {
      vi.mocked(editTrackingService.ResponseEditTrackingService.getEditHistory).mockRejectedValue(new Error('Database error'));
      const parent = { ...mockResponse };

      const result = await extendedResponsesResolvers.FormResponse.hasBeenEdited(parent);

      expect(result).toBe(false);
    });
  });

  describe('Extended Resolvers: FormResponse.totalEdits', () => {
    it('should return correct number of edits', async () => {
      vi.mocked(editTrackingService.ResponseEditTrackingService.getEditHistory).mockResolvedValue([{ id: 'edit-1' }, { id: 'edit-2' }] as any);
      const parent = { ...mockResponse };

      const result = await extendedResponsesResolvers.FormResponse.totalEdits(parent);

      expect(result).toBe(2);
    });

    it('should return 0 when no edits', async () => {
      vi.mocked(editTrackingService.ResponseEditTrackingService.getEditHistory).mockResolvedValue([]);
      const parent = { ...mockResponse };

      const result = await extendedResponsesResolvers.FormResponse.totalEdits(parent);

      expect(result).toBe(0);
    });

    it('should return 0 when error occurs', async () => {
      vi.mocked(editTrackingService.ResponseEditTrackingService.getEditHistory).mockRejectedValue(new Error('Database error'));
      const parent = { ...mockResponse };

      const result = await extendedResponsesResolvers.FormResponse.totalEdits(parent);

      expect(result).toBe(0);
    });
  });

  describe('Extended Resolvers: FormResponse.lastEditedAt', () => {
    it('should return last edited date', async () => {
      const editHistory = [
        { id: 'edit-2', editedAt: new Date('2024-01-02') },
        { id: 'edit-1', editedAt: new Date('2024-01-01') },
      ];
      vi.mocked(editTrackingService.ResponseEditTrackingService.getEditHistory).mockResolvedValue(editHistory as any);
      const parent = { ...mockResponse };

      const result = await extendedResponsesResolvers.FormResponse.lastEditedAt(parent);

      expect(result).toBe(editHistory[0].editedAt.toISOString());
    });

    it('should return null when no edits', async () => {
      vi.mocked(editTrackingService.ResponseEditTrackingService.getEditHistory).mockResolvedValue([]);
      const parent = { ...mockResponse };

      const result = await extendedResponsesResolvers.FormResponse.lastEditedAt(parent);

      expect(result).toBeNull();
    });

    it('should return null when error occurs', async () => {
      vi.mocked(editTrackingService.ResponseEditTrackingService.getEditHistory).mockRejectedValue(new Error('Database error'));
      const parent = { ...mockResponse };

      const result = await extendedResponsesResolvers.FormResponse.lastEditedAt(parent);

      expect(result).toBeNull();
    });
  });

  describe('Extended Resolvers: FormResponse.lastEditedBy', () => {
    it('should return last editor user', async () => {
      const editHistory = [
        {
          id: 'edit-2',
          editedBy: {
            id: 'user-456',
            name: 'Last Editor',
            email: 'last@example.com',
            image: null,
          },
          editedAt: new Date('2024-01-02'),
        },
      ];
      vi.mocked(editTrackingService.ResponseEditTrackingService.getEditHistory).mockResolvedValue(editHistory as any);
      const parent = { ...mockResponse };

      const result = await extendedResponsesResolvers.FormResponse.lastEditedBy(parent);

      expect(result).toEqual(editHistory[0].editedBy);
    });

    it('should return null when no edits', async () => {
      vi.mocked(editTrackingService.ResponseEditTrackingService.getEditHistory).mockResolvedValue([]);
      const parent = { ...mockResponse };

      const result = await extendedResponsesResolvers.FormResponse.lastEditedBy(parent);

      expect(result).toBeNull();
    });

    it('should return null when error occurs', async () => {
      vi.mocked(editTrackingService.ResponseEditTrackingService.getEditHistory).mockRejectedValue(new Error('Database error'));
      const parent = { ...mockResponse };

      const result = await extendedResponsesResolvers.FormResponse.lastEditedBy(parent);

      expect(result).toBeNull();
    });
  });

  describe('Extended Resolvers: FormResponse.editHistory', () => {
    const mockEditHistoryData = [
      {
        id: 'edit-1',
        editedBy: { id: 'user-123', name: 'User', email: 'user@example.com', image: null },
        editedAt: new Date('2024-01-01'),
      },
    ];

    it('should return full edit history', async () => {
      vi.mocked(editTrackingService.ResponseEditTrackingService.getEditHistory).mockResolvedValue(mockEditHistoryData as any);
      const parent = { ...mockResponse };

      const result = await extendedResponsesResolvers.FormResponse.editHistory(parent);

      expect(result).toEqual(mockEditHistoryData);
    });

    it('should return empty array when no edits', async () => {
      vi.mocked(editTrackingService.ResponseEditTrackingService.getEditHistory).mockResolvedValue([]);
      const parent = { ...mockResponse };

      const result = await extendedResponsesResolvers.FormResponse.editHistory(parent);

      expect(result).toEqual([]);
    });

    it('should return empty array when error occurs', async () => {
      vi.mocked(editTrackingService.ResponseEditTrackingService.getEditHistory).mockRejectedValue(new Error('Database error'));
      const parent = { ...mockResponse };

      const result = await extendedResponsesResolvers.FormResponse.editHistory(parent);

      expect(result).toEqual([]);
    });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { responsesResolvers, extendedResponsesResolvers } from '../responses.js';
import { GraphQLError } from '#graphql-errors';
import {
  DEFAULT_THANK_YOU_CONTENT,
  RadioField,
  TextInputField,
  FillableFormFieldValidation,
  TextFieldValidation,
  serializeFormSchema,
  type FormSchema,
  type QuizSettings,
} from '@dculus/types';
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
import * as hocuspocusService from '../../../services/hocuspocus.js';
import { responseRepository, responseGradeRepository } from '../../../repositories/index.js';

// Mock all dependencies
vi.mock('../../../services/responseService.js');
vi.mock('../../../services/formService.js');
vi.mock('../../../middleware/better-auth-middleware.js');
vi.mock('../formSharing.js');
vi.mock('../../../services/analyticsService.js');
vi.mock('../../../plugins/core/events.js');
vi.mock('../../../subscriptions/usageService.js');
vi.mock('../../../subscriptions/events.js');
vi.mock('../../../services/hocuspocus.js');
// Native Quiz (issue #295): only the DB boundary is mocked here — gradingEngine
// and gradingService run for real, so these tests exercise the actual grading
// and release/visibility projection logic, not a stand-in for it.
vi.mock('../../../repositories/index.js');
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
    // Matches the pre-existing effective behavior in this suite: no real DB,
    // so the internal try/catch in getFormSchemaFromHocuspocus always
    // resolved to null and every schema fell back to form.formSchema.
    vi.mocked(hocuspocusService.getFormSchemaFromHocuspocus).mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Query: responses', () => {
    it('should return responses for accessible forms only', async () => {
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockResolvedValue(undefined);
      vi.mocked(formService.getAccessibleFormIds).mockResolvedValue(['form-123']);
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
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockResolvedValue(undefined);
      // User has access to form-123 but NOT form-456
      vi.mocked(formService.getAccessibleFormIds).mockResolvedValue(['form-123']);
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
        emailsExceeded: false,
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
        emailsExceeded: false,
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
      vi.mocked(responseService.submitResponseWithMaxLimitCheck).mockRejectedValue(
        new Error('Form has reached its maximum response limit')
      );

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
      vi.mocked(responseService.submitResponseWithMaxLimitCheck).mockResolvedValue({
        id: 'generated-response-id',
        formId: 'form-123',
        data: {},
        submittedAt: new Date(),
      } as any);

      const result = await responsesResolvers.Mutation.submitResponse(
        {},
        { input: mockInput },
        mockContext
      );

      expect(result).toBeDefined();
      expect(responseService.submitResponseWithMaxLimitCheck).toHaveBeenCalledWith(
        expect.objectContaining({ formId: 'form-123' }),
        10
      );
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
          emailsExceeded: false,
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
          'preview-tag-id',
          'form-123'
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
          emailsExceeded: false,
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
          emailsExceeded: false,
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

    describe('Native Quiz grading (issue #295)', () => {
      const baseVisibility = {
        totalScore: true,
        perQuestionCorrectness: true,
        correctAnswers: true,
        pointValues: true,
        feedback: true,
        passFailBadge: true,
      };

      const gradedField = new RadioField(
        'q1',
        'Capital of France',
        '',
        '',
        '',
        new FillableFormFieldValidation(false),
        ['Paris', 'London', 'Berlin']
      );
      gradedField.grading = { mode: 'exact', pointValue: 10, acceptedAnswers: ['Paris'] };

      const quizSchema: FormSchema = {
        pages: [{ id: 'page-1', title: 'Page 1', fields: [gradedField], order: 0 }],
        layout: { theme: 'light', backgroundImageKey: '' } as any,
        isShuffleEnabled: false,
      };
      const rawQuizSchema = serializeFormSchema(quizSchema);

      const buildFormWithQuiz = (quiz: QuizSettings, schema: unknown = rawQuizSchema) => ({
        ...mockForm,
        settings: { quiz },
        formSchema: schema,
      });

      const stubGradeUpsert = () => {
        vi.mocked(responseRepository.findUnique).mockResolvedValue({ formId: 'form-123' } as any);
        vi.mocked(responseGradeRepository.upsertForResponse).mockImplementation(
          async (responseId: string, data: any) =>
            ({
              id: 'grade-1',
              responseId,
              gradedAt: new Date('2026-01-01T00:00:00Z'),
              gradedById: null,
              releasedAt: null,
              schemaVersion: 1,
              attemptNumber: 1,
              integrity: null,
              ...data,
            }) as any
        );
      };

      it('performs zero extra work for a form with settings.quiz absent (additive guarantee)', async () => {
        // mockForm.settings is null — quiz absent, exactly the pre-existing fixture.
        const result = await responsesResolvers.Mutation.submitResponse(
          {},
          { input: mockInput },
          mockContext
        );

        expect(result).toEqual({ ...mockResponse, thankYouMessage: DEFAULT_THANK_YOU_CONTENT });
        expect(result).not.toHaveProperty('grade');
        expect(responseGradeRepository.upsertForResponse).not.toHaveBeenCalled();
        expect(responseRepository.findUnique).not.toHaveBeenCalled();
        // Unchanged from before this change: one Hocuspocus lookup for the
        // conditional-strip pass, one for the thank-you mention substitution.
        expect(hocuspocusService.getFormSchemaFromHocuspocus).toHaveBeenCalledTimes(2);
      });

      it('returns a populated, released grade under gradeRelease: immediate', async () => {
        const quiz: QuizSettings = {
          enabled: true,
          passThresholdPercent: 60,
          gradeRelease: 'immediate',
          respondentVisibility: baseVisibility,
        };
        vi.mocked(formService.getFormById).mockResolvedValue(buildFormWithQuiz(quiz) as any);
        stubGradeUpsert();

        const result = await responsesResolvers.Mutation.submitResponse(
          {},
          { input: { formId: 'form-123', data: { q1: 'Paris' } } },
          mockContext
        );

        expect(result.grade).toEqual({
          released: true,
          score: 10,
          maxScore: 10,
          percentage: 100,
          passed: true,
          questions: [
            {
              fieldId: 'q1',
              label: 'Capital of France',
              yourAnswer: 'Paris',
              correct: true,
              pointsAwarded: 10,
              pointValue: 10,
              correctAnswer: ['Paris'],
            },
          ],
        });
        expect(responseGradeRepository.upsertForResponse).toHaveBeenCalledWith(
          'response-123',
          expect.objectContaining({
            score: 10,
            maxScore: 10,
            percentage: 100,
            passed: true,
            status: 'AUTO_GRADED',
          })
        );
      });

      it.each(['afterReview', 'never'] as const)(
        'returns only { released: false } under gradeRelease: %s',
        async (gradeRelease) => {
          const quiz: QuizSettings = {
            enabled: true,
            passThresholdPercent: 60,
            gradeRelease,
            respondentVisibility: baseVisibility,
          };
          vi.mocked(formService.getFormById).mockResolvedValue(buildFormWithQuiz(quiz) as any);
          stubGradeUpsert();

          const result = await responsesResolvers.Mutation.submitResponse(
            {},
            { input: { formId: 'form-123', data: { q1: 'Paris' } } },
            mockContext
          );

          expect(result.grade).toEqual({ released: false });
          expect(Object.keys(result.grade!)).toEqual(['released']);
          expect(JSON.stringify(result.grade)).not.toMatch(/score|percentage|pointsAwarded|Paris/);
        }
      );

      it('excludes a conditionally-hidden graded question from maxScore', async () => {
        const triggerField = new RadioField(
          'trigger',
          'Trigger',
          '',
          '',
          '',
          new FillableFormFieldValidation(false),
          ['Yes', 'No']
        );
        const bonusField = new TextInputField(
          'bonus',
          'Bonus',
          '',
          '',
          '',
          '',
          new TextFieldValidation(false)
        );
        bonusField.grading = { mode: 'text', pointValue: 5, acceptedAnswers: ['42'] };

        const schemaWithConditionObj: FormSchema = {
          ...quizSchema,
          pages: [
            { ...quizSchema.pages[0], fields: [gradedField, triggerField, bonusField] },
          ],
          conditions: [
            {
              id: 'r-show-bonus',
              enabled: true,
              combinator: 'all',
              terms: [{ fieldId: 'trigger', operator: 'equals', value: 'Yes' }],
              actions: [{ type: 'showField', fieldIds: ['bonus'] }],
            },
          ],
        };
        const schemaWithCondition = serializeFormSchema(schemaWithConditionObj);
        const quiz: QuizSettings = {
          enabled: true,
          passThresholdPercent: 60,
          gradeRelease: 'immediate',
          respondentVisibility: baseVisibility,
        };
        vi.mocked(formService.getFormById).mockResolvedValue(
          buildFormWithQuiz(quiz, schemaWithCondition) as any
        );
        stubGradeUpsert();

        // trigger === 'No' hides `bonus` — stripConditionallyHiddenValues removes it
        // from input.data before grading ever sees it.
        const result = await responsesResolvers.Mutation.submitResponse(
          {},
          { input: { formId: 'form-123', data: { q1: 'Paris', trigger: 'No', bonus: 'sneaky' } } },
          mockContext
        );

        // Only q1 (10 pts) counts toward maxScore — bonus (5 pts) never saw the
        // respondent, so it's excluded from the denominator, not scored wrong.
        expect(result.grade).toMatchObject({ maxScore: 10, score: 10 });
        expect(
          (result.grade as any).questions.some((q: any) => q.fieldId === 'bonus')
        ).toBe(false);
      });

      it('lets the submission succeed when grading and the NEEDS_REVIEW fallback both fail', async () => {
        const quiz: QuizSettings = {
          enabled: true,
          passThresholdPercent: 60,
          gradeRelease: 'immediate',
          respondentVisibility: baseVisibility,
        };
        vi.mocked(formService.getFormById).mockResolvedValue(buildFormWithQuiz(quiz) as any);
        // Forces saveGrade to throw for both the primary and the NEEDS_REVIEW
        // fallback attempt — simulates a grading-path failure end to end.
        vi.mocked(responseRepository.findUnique).mockRejectedValue(new Error('DB is down'));

        const result = await responsesResolvers.Mutation.submitResponse(
          {},
          { input: { formId: 'form-123', data: { q1: 'Paris' } } },
          mockContext
        );

        expect(responseService.submitResponse).toHaveBeenCalled();
        expect(result).toMatchObject({ id: mockResponse.id, formId: mockResponse.formId });
        expect(result).not.toHaveProperty('grade');
        expect(responseGradeRepository.upsertForResponse).not.toHaveBeenCalled();
      });

      it('persists a NEEDS_REVIEW fallback when grading throws, but never surfaces it to the respondent or automations', async () => {
        const quiz: QuizSettings = {
          enabled: true,
          passThresholdPercent: 60,
          gradeRelease: 'immediate',
          respondentVisibility: baseVisibility,
        };
        // `pages: 'not-a-schema'` makes deserializeFormSchema throw (a bare
        // string has no .map), exercising the branch where grading itself
        // fails but the NEEDS_REVIEW fallback save succeeds.
        vi.mocked(formService.getFormById).mockResolvedValue(
          buildFormWithQuiz(quiz, { pages: 'not-a-schema' }) as any
        );
        stubGradeUpsert();

        const result = await responsesResolvers.Mutation.submitResponse(
          {},
          { input: { formId: 'form-123', data: { q1: 'Paris' } } },
          mockContext
        );

        expect(responseGradeRepository.upsertForResponse).toHaveBeenCalledWith(
          'response-123',
          expect.objectContaining({ status: 'NEEDS_REVIEW', score: 0, maxScore: 0 })
        );
        // isReleased() ignores grade status under 'immediate' release, so this
        // placeholder must never be projected — it would read as a genuine
        // "you scored 0%" to the respondent instead of silence.
        expect(result).not.toHaveProperty('grade');
        expect(pluginEvents.emitFormSubmitted).toHaveBeenCalledWith(
          'form-123',
          'org-123',
          expect.objectContaining({ responseId: 'response-123' })
        );
        const emittedPayload = vi.mocked(pluginEvents.emitFormSubmitted).mock.calls[0][2];
        expect(emittedPayload).not.toHaveProperty('quizScore');
        expect(emittedPayload).not.toHaveProperty('quizMaxScore');
        expect(emittedPayload).not.toHaveProperty('quizPercentage');
        expect(emittedPayload).not.toHaveProperty('quizPassed');
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

  // Native Quiz (epic #289, Story 11): `responseGrade` is the full builder-side
  // grade record — unlike the respondent-facing `grade` field, this is guarded
  // by form-permission checks, not by quiz release policy, and must never be
  // reachable without VIEWER+ form access.
  describe('Extended Resolvers: FormResponse.responseGrade (issue #300)', () => {
    const mockGradeRow = {
      score: 8,
      maxScore: 10,
      percentage: 80,
      passed: true,
      status: 'AUTO_GRADED',
      gradedAt: new Date('2024-01-02T00:00:00Z'),
      detail: [
        {
          fieldId: 'f1',
          fieldLabel: 'Q1',
          fieldType: 'RADIO_FIELD',
          mode: 'exact',
          submittedValue: 'a',
          acceptedAnswers: ['a'],
          correct: true,
          pointsAwarded: 8,
          pointValue: 10,
          autoPointsAwarded: 8,
        },
      ],
    };

    it('returns null with no authenticated user (e.g. a public submitResponse caller) and never checks form access', async () => {
      const parent = { id: 'response-1', formId: 'form-grade-anon' };
      const anonContext = { auth: { user: null } };

      const result = await extendedResponsesResolvers.FormResponse.responseGrade(
        parent,
        {},
        anonContext as any
      );

      expect(result).toBeNull();
      expect(formSharingResolvers.checkFormAccess).not.toHaveBeenCalled();
      expect(responseGradeRepository.findByResponseId).not.toHaveBeenCalled();
    });

    it('returns null when the authenticated user lacks form access', async () => {
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: false,
        permission: 'NO_ACCESS' as any,
        form: mockForm as any,
      });
      const parent = { id: 'response-2', formId: 'form-grade-noaccess' };

      const result = await extendedResponsesResolvers.FormResponse.responseGrade(
        parent,
        {},
        mockContext as any
      );

      expect(result).toBeNull();
      expect(responseGradeRepository.findByResponseId).not.toHaveBeenCalled();
    });

    it('returns the full grade record when the user has VIEWER+ access', async () => {
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: true,
        permission: 'VIEWER' as any,
        form: mockForm as any,
      });
      vi.mocked(responseGradeRepository.findByResponseId).mockResolvedValue(mockGradeRow as any);
      const parent = { id: 'response-3', formId: 'form-grade-access' };

      const result = await extendedResponsesResolvers.FormResponse.responseGrade(
        parent,
        {},
        mockContext as any
      );

      expect(formSharingResolvers.checkFormAccess).toHaveBeenCalledWith(
        'user-123',
        'form-grade-access',
        formSharingResolvers.PermissionLevel.VIEWER
      );
      expect(result).toEqual({
        score: 8,
        maxScore: 10,
        percentage: 80,
        passed: true,
        status: 'AUTO_GRADED',
        gradedAt: '2024-01-02T00:00:00.000Z',
        detail: mockGradeRow.detail,
      });
    });

    it('returns null when no grade row exists yet', async () => {
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: true,
        permission: 'VIEWER' as any,
        form: mockForm as any,
      });
      vi.mocked(responseGradeRepository.findByResponseId).mockResolvedValue(null);
      const parent = { id: 'response-4', formId: 'form-grade-nogrades' };

      const result = await extendedResponsesResolvers.FormResponse.responseGrade(
        parent,
        {},
        mockContext as any
      );

      expect(result).toBeNull();
    });

    it('caches the form-access check across rows sharing the same form (no per-row permission N+1)', async () => {
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: true,
        permission: 'VIEWER' as any,
        form: mockForm as any,
      });
      vi.mocked(responseGradeRepository.findByResponseId).mockResolvedValue(mockGradeRow as any);

      await extendedResponsesResolvers.FormResponse.responseGrade(
        { id: 'row-1', formId: 'form-grade-shared' },
        {},
        mockContext as any
      );
      await extendedResponsesResolvers.FormResponse.responseGrade(
        { id: 'row-2', formId: 'form-grade-shared' },
        {},
        mockContext as any
      );

      expect(formSharingResolvers.checkFormAccess).toHaveBeenCalledTimes(1);
      expect(responseGradeRepository.findByResponseId).toHaveBeenCalledTimes(2);
    });

    it('falls back to the legacy quiz-grading plugin metadata when no ResponseGrade row exists (bare key)', async () => {
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: true,
        permission: 'VIEWER' as any,
        form: mockForm as any,
      });
      vi.mocked(responseGradeRepository.findByResponseId).mockResolvedValue(null);
      const parent = {
        id: 'response-6',
        formId: 'form-grade-legacy',
        metadata: {
          'quiz-grading': {
            quizScore: 6,
            totalMarks: 10,
            percentage: 60,
            passThreshold: 60,
            gradedAt: '2023-06-01T00:00:00.000Z',
            gradedBy: 'plugin',
            fieldResults: [
              {
                fieldId: 'f1',
                fieldLabel: 'Q1',
                userAnswer: 'b',
                correctAnswer: 'a',
                isCorrect: false,
                marksAwarded: 0,
                maxMarks: 5,
              },
            ],
          },
        },
      };

      const result = await extendedResponsesResolvers.FormResponse.responseGrade(
        parent,
        {},
        mockContext as any
      );

      expect(result).toEqual({
        score: 6,
        maxScore: 10,
        percentage: 60,
        passed: true,
        status: 'AUTO_GRADED',
        gradedAt: '2023-06-01T00:00:00.000Z',
        detail: [
          {
            fieldId: 'f1',
            fieldLabel: 'Q1',
            fieldType: '',
            mode: 'exact',
            submittedValue: 'b',
            acceptedAnswers: ['a'],
            correct: false,
            pointsAwarded: 0,
            pointValue: 5,
            autoPointsAwarded: 0,
          },
        ],
      });
    });

    it('falls back to the legacy quiz-grading plugin metadata under an instance-scoped key (quiz-grading:pluginId)', async () => {
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: true,
        permission: 'VIEWER' as any,
        form: mockForm as any,
      });
      vi.mocked(responseGradeRepository.findByResponseId).mockResolvedValue(null);
      const parent = {
        id: 'response-7',
        formId: 'form-grade-legacy-scoped',
        metadata: {
          'quiz-grading:plugin-abc': {
            quizScore: 3,
            totalMarks: 10,
            percentage: 30,
            passThreshold: 60,
            gradedAt: '2023-05-01T00:00:00.000Z',
            gradedBy: 'plugin',
            fieldResults: [],
          },
        },
      };

      const result = await extendedResponsesResolvers.FormResponse.responseGrade(
        parent,
        {},
        mockContext as any
      );

      expect(result).toMatchObject({ score: 3, maxScore: 10, percentage: 30, passed: false, status: 'AUTO_GRADED' });
    });

    it('returns null when neither a ResponseGrade row nor legacy metadata is present', async () => {
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: true,
        permission: 'VIEWER' as any,
        form: mockForm as any,
      });
      vi.mocked(responseGradeRepository.findByResponseId).mockResolvedValue(null);
      const parent = { id: 'response-8', formId: 'form-grade-neither', metadata: { someOtherPlugin: {} } };

      const result = await extendedResponsesResolvers.FormResponse.responseGrade(
        parent,
        {},
        mockContext as any
      );

      expect(result).toBeNull();
    });

    it('fails closed (returns null) rather than leaking grade data when the access check throws', async () => {
      vi.mocked(formSharingResolvers.checkFormAccess).mockRejectedValue(new Error('boom'));
      const parent = { id: 'response-5', formId: 'form-grade-error' };

      const result = await extendedResponsesResolvers.FormResponse.responseGrade(
        parent,
        {},
        mockContext as any
      );

      expect(result).toBeNull();
      expect(responseGradeRepository.findByResponseId).not.toHaveBeenCalled();
    });
  });

  // Native Quiz (epic #289, Story 16/#320, D9): `myQuizResult` lets a
  // respondent retrieve their OWN deferred-release grade later, keyed off
  // `respondentUserId` rather than form permission — the opposite
  // authorization boundary from `responseGrade` above.
  describe('Extended Resolvers: Query.myQuizResult (issue #320)', () => {
    const quizVisibility = {
      totalScore: true,
      perQuestionCorrectness: true,
      correctAnswers: true,
      pointValues: true,
      feedback: true,
      passFailBadge: true,
    };

    const quizForm = {
      ...mockForm,
      id: 'form-quiz',
      settings: {
        // Identity-gated — respondentUserId is only ever set for a form like
        // this (see accessControlEnforcement.ts), which is the only
        // precondition under which myQuizResult can ever match a response.
        accessControl: { enabled: true },
        quiz: {
          enabled: true,
          gradeRelease: 'afterReview',
          respondentVisibility: quizVisibility,
        },
      },
    };

    const releasedGradeRow = {
      id: 'grade-1',
      responseId: 'response-mine',
      formId: 'form-quiz',
      score: 8,
      maxScore: 10,
      percentage: 80,
      passed: true,
      status: 'REVIEWED',
      detail: [],
    };

    it('requires authentication', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockImplementation(() => {
        throw new Error('Authentication required');
      });

      await expect(
        extendedResponsesResolvers.Query.myQuizResult(
          {},
          { formId: 'form-quiz' },
          mockContext as any
        )
      ).rejects.toThrow('Authentication required');
      expect(formService.getFormById).not.toHaveBeenCalled();
    });

    it('returns null immediately for a non-quiz form — no response/grade lookup fires (additive guarantee)', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
      vi.mocked(formService.getFormById).mockResolvedValue(mockForm as any);

      const result = await extendedResponsesResolvers.Query.myQuizResult(
        {},
        { formId: 'form-123' },
        mockContext as any
      );

      expect(result).toBeNull();
      expect(responseRepository.findFirst).not.toHaveBeenCalled();
      expect(responseGradeRepository.findByResponseId).not.toHaveBeenCalled();
    });

    it('returns null when the form does not exist', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
      vi.mocked(formService.getFormById).mockResolvedValue(null);

      const result = await extendedResponsesResolvers.Query.myQuizResult(
        {},
        { formId: 'missing-form' },
        mockContext as any
      );

      expect(result).toBeNull();
    });

    it('returns null when the caller never submitted this form (no matching respondentUserId)', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
      vi.mocked(formService.getFormById).mockResolvedValue(quizForm as any);
      vi.mocked(responseRepository.findFirst).mockResolvedValue(null);

      const result = await extendedResponsesResolvers.Query.myQuizResult(
        {},
        { formId: 'form-quiz' },
        mockContext as any
      );

      expect(responseRepository.findFirst).toHaveBeenCalledWith({
        where: { formId: 'form-quiz', respondentUserId: 'user-123', deletedAt: null },
        orderBy: { submittedAt: 'desc' },
      });
      expect(result).toBeNull();
      expect(responseGradeRepository.findByResponseId).not.toHaveBeenCalled();
    });

    it('returns null (not accidentally matched) on an anonymous form, since respondentUserId is always null there — and short-circuits before any lookup', async () => {
      // Belt-and-suspenders: an anonymous form's Response rows always have
      // respondentUserId: null, so a DB lookup could never match a signed-in
      // caller's id anyway — but the resolver now checks requiresIdentity
      // explicitly first (mirrors submitResponse's own check) rather than
      // relying on that implicit null-never-equals-a-real-id guarantee, and
      // skips the doomed-to-empty lookup entirely.
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
      const anonymousQuizForm = {
        ...quizForm,
        settings: { quiz: { ...quizForm.settings.quiz } },
      };
      vi.mocked(formService.getFormById).mockResolvedValue(anonymousQuizForm as any);

      const result = await extendedResponsesResolvers.Query.myQuizResult(
        {},
        { formId: 'form-quiz' },
        mockContext as any
      );

      expect(result).toBeNull();
      expect(responseRepository.findFirst).not.toHaveBeenCalled();
      expect(responseGradeRepository.findByResponseId).not.toHaveBeenCalled();
    });

    it('proceeds to the lookup for a form gated only by collectRespondentEmail (no accessControl)', async () => {
      // The other half of requiresIdentity — accessControl.enabled and
      // collectRespondentEmail are independent triggers (see
      // accessControlEnforcement.ts) and either alone must be honored.
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
      const collectEmailQuizForm = {
        ...quizForm,
        settings: { collectRespondentEmail: true, quiz: { ...quizForm.settings.quiz } },
      };
      vi.mocked(formService.getFormById).mockResolvedValue(collectEmailQuizForm as any);
      vi.mocked(responseRepository.findFirst).mockResolvedValue({
        id: 'response-mine',
        formId: 'form-quiz',
        respondentUserId: 'user-123',
      } as any);
      vi.mocked(responseGradeRepository.findByResponseId).mockResolvedValue(releasedGradeRow as any);

      const result = await extendedResponsesResolvers.Query.myQuizResult(
        {},
        { formId: 'form-quiz' },
        mockContext as any
      );

      expect(responseRepository.findFirst).toHaveBeenCalled();
      expect(result).toEqual({
        released: true,
        score: 8,
        maxScore: 10,
        percentage: 80,
        passed: true,
        questions: [],
      });
    });

    it('returns a released grade projected through toRespondentView, using the most recent submission', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
      vi.mocked(formService.getFormById).mockResolvedValue(quizForm as any);
      vi.mocked(responseRepository.findFirst).mockResolvedValue({
        id: 'response-mine',
        formId: 'form-quiz',
        respondentUserId: 'user-123',
      } as any);
      vi.mocked(responseGradeRepository.findByResponseId).mockResolvedValue(releasedGradeRow as any);

      const result = await extendedResponsesResolvers.Query.myQuizResult(
        {},
        { formId: 'form-quiz' },
        mockContext as any
      );

      expect(responseGradeRepository.findByResponseId).toHaveBeenCalledWith('response-mine');
      expect(result).toEqual({
        released: true,
        score: 8,
        maxScore: 10,
        percentage: 80,
        passed: true,
        questions: [],
      });
    });

    it('never leaks another respondent\'s grade — only ever matches the caller\'s own respondentUserId', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
      vi.mocked(formService.getFormById).mockResolvedValue(quizForm as any);
      // A different user's response must never surface: the repository call
      // itself is scoped to the caller's id, so a mock that returns null
      // here models the real query correctly filtering it out.
      vi.mocked(responseRepository.findFirst).mockResolvedValue(null);

      const result = await extendedResponsesResolvers.Query.myQuizResult(
        {},
        { formId: 'form-quiz' },
        mockContext as any
      );

      expect(responseRepository.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ respondentUserId: 'user-123' }),
        })
      );
      expect(result).toBeNull();
    });

    it('returns not-released view (released: false) for a pending afterReview grade — no score leaks', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
      vi.mocked(formService.getFormById).mockResolvedValue(quizForm as any);
      vi.mocked(responseRepository.findFirst).mockResolvedValue({
        id: 'response-mine',
        formId: 'form-quiz',
        respondentUserId: 'user-123',
      } as any);
      vi.mocked(responseGradeRepository.findByResponseId).mockResolvedValue({
        ...releasedGradeRow,
        status: 'AUTO_GRADED', // not yet REVIEWED — afterReview keeps this hidden
      } as any);

      const result = await extendedResponsesResolvers.Query.myQuizResult(
        {},
        { formId: 'form-quiz' },
        mockContext as any
      );

      expect(result).toEqual({ released: false });
    });

    it('returns not-released view for a scheduled grade whose releaseAt is still in the future', async () => {
      const scheduledForm = {
        ...quizForm,
        settings: {
          accessControl: { enabled: true },
          quiz: {
            enabled: true,
            gradeRelease: 'scheduled',
            releaseAt: new Date(Date.now() + 60_000).toISOString(),
            respondentVisibility: quizVisibility,
          },
        },
      };
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
      vi.mocked(formService.getFormById).mockResolvedValue(scheduledForm as any);
      vi.mocked(responseRepository.findFirst).mockResolvedValue({
        id: 'response-mine',
        formId: 'form-quiz',
        respondentUserId: 'user-123',
      } as any);
      vi.mocked(responseGradeRepository.findByResponseId).mockResolvedValue(releasedGradeRow as any);

      const result = await extendedResponsesResolvers.Query.myQuizResult(
        {},
        { formId: 'form-quiz' },
        mockContext as any
      );

      expect(result).toEqual({ released: false });
    });

    it('returns the released grade for a scheduled grade whose releaseAt has already passed', async () => {
      const scheduledForm = {
        ...quizForm,
        settings: {
          accessControl: { enabled: true },
          quiz: {
            enabled: true,
            gradeRelease: 'scheduled',
            releaseAt: new Date(Date.now() - 60_000).toISOString(),
            respondentVisibility: quizVisibility,
          },
        },
      };
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth);
      vi.mocked(formService.getFormById).mockResolvedValue(scheduledForm as any);
      vi.mocked(responseRepository.findFirst).mockResolvedValue({
        id: 'response-mine',
        formId: 'form-quiz',
        respondentUserId: 'user-123',
      } as any);
      vi.mocked(responseGradeRepository.findByResponseId).mockResolvedValue(releasedGradeRow as any);

      const result = await extendedResponsesResolvers.Query.myQuizResult(
        {},
        { formId: 'form-quiz' },
        mockContext as any
      );

      expect(result).toEqual({
        released: true,
        score: 8,
        maxScore: 10,
        percentage: 80,
        passed: true,
        questions: [],
      });
    });
  });
});

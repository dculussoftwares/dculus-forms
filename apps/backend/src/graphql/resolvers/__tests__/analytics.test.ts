import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { analyticsResolvers } from '../analytics.js';
import { GraphQLError } from 'graphql';
import { analyticsService } from '../../../services/analyticsService.js';
import { prisma } from '../../../lib/prisma.js';
import * as events from '../../../subscriptions/events.js';

// Mock all dependencies
vi.mock('../../../services/analyticsService.js');
vi.mock('../../../subscriptions/events.js');
vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    form: {
      findUnique: vi.fn(),
    },
    response: {
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

describe('Analytics Resolvers', () => {
  const mockContext = {
    req: {
      ip: '192.168.1.1',
      headers: {},
    },
    user: {
      id: 'user-123',
      email: 'test@example.com',
    },
  };

  const mockPublishedForm = {
    id: 'form-123',
    title: 'Test Form',
    isPublished: true,
    organizationId: 'org-123',
    organization: {
      members: [
        { userId: 'user-123', role: 'owner' },
      ],
    },
  };

  const mockUnpublishedForm = {
    id: 'form-123',
    title: 'Test Form',
    isPublished: false,
    organizationId: 'org-123',
  };

  const mockResponse = {
    id: 'response-123',
    formId: 'form-123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Mutation: trackFormView', () => {
    const trackFormViewInput = {
      formId: 'form-123',
      sessionId: 'session-abc',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0',
      timezone: 'America/New_York',
      language: 'en-US',
    };

    it('should track form view successfully with published form', async () => {
      vi.mocked(prisma.form.findUnique).mockResolvedValue(mockPublishedForm as any);
      vi.mocked(analyticsService.trackFormView).mockResolvedValue(undefined);
      vi.mocked(events.emitFormViewed).mockReturnValue(undefined);

      const result = await analyticsResolvers.Mutation.trackFormView(
        {},
        { input: trackFormViewInput },
        mockContext
      );

      expect(prisma.form.findUnique).toHaveBeenCalledWith({
        where: { id: 'form-123' },
        select: { id: true, isPublished: true, organizationId: true },
      });

      expect(analyticsService.trackFormView).toHaveBeenCalledWith(
        {
          formId: 'form-123',
          sessionId: 'session-abc',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0',
          timezone: 'America/New_York',
          language: 'en-US',
        },
        '192.168.1.1' // req.ip is used
      );

      expect(events.emitFormViewed).toHaveBeenCalledWith(
        'org-123',
        'form-123',
        'session-abc',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0'
      );

      expect(result).toEqual({ success: true });
    });

    it('should extract IP from various sources', async () => {
      const contextWithNoForwardedFor = {
        ...mockContext,
        req: {
          ip: '192.168.1.1',
          connection: { remoteAddress: '10.0.0.1' },
          socket: { remoteAddress: '172.16.0.1' },
        },
      };

      vi.mocked(prisma.form.findUnique).mockResolvedValue(mockPublishedForm as any);
      vi.mocked(analyticsService.trackFormView).mockResolvedValue(undefined);

      await analyticsResolvers.Mutation.trackFormView(
        {},
        { input: trackFormViewInput },
        contextWithNoForwardedFor
      );

      expect(analyticsService.trackFormView).toHaveBeenCalledWith(
        expect.any(Object),
        '192.168.1.1' // Falls back to req.ip
      );
    });

    it('should throw error when form not found', async () => {
      vi.mocked(prisma.form.findUnique).mockResolvedValue(null);

      await expect(
        analyticsResolvers.Mutation.trackFormView(
          {},
          { input: trackFormViewInput },
          mockContext
        )
      ).rejects.toThrow(GraphQLError);
      await expect(
        analyticsResolvers.Mutation.trackFormView(
          {},
          { input: trackFormViewInput },
          mockContext
        )
      ).rejects.toThrow('Form not found');
    });

    it('should throw error when form is not published', async () => {
      vi.mocked(prisma.form.findUnique).mockResolvedValue(mockUnpublishedForm as any);

      await expect(
        analyticsResolvers.Mutation.trackFormView(
          {},
          { input: trackFormViewInput },
          mockContext
        )
      ).rejects.toThrow(GraphQLError);
      await expect(
        analyticsResolvers.Mutation.trackFormView(
          {},
          { input: trackFormViewInput },
          mockContext
        )
      ).rejects.toThrow('Form is not published');
    });

    it('should return success: false on analytics service error', async () => {
      vi.mocked(prisma.form.findUnique).mockResolvedValue(mockPublishedForm as any);
      vi.mocked(analyticsService.trackFormView).mockRejectedValue(
        new Error('Analytics service error')
      );

      const result = await analyticsResolvers.Mutation.trackFormView(
        {},
        { input: trackFormViewInput },
        mockContext
      );

      expect(result).toEqual({ success: false });
    });

    it('should handle subscription event emission errors gracefully', async () => {
      vi.mocked(prisma.form.findUnique).mockResolvedValue(mockPublishedForm as any);
      vi.mocked(analyticsService.trackFormView).mockResolvedValue(undefined);
      vi.mocked(events.emitFormViewed).mockImplementation(() => {
        throw new Error('Event emission error');
      });

      const result = await analyticsResolvers.Mutation.trackFormView(
        {},
        { input: trackFormViewInput },
        mockContext
      );

      // Should still succeed even if event emission fails
      expect(result).toEqual({ success: true });
    });

    it('should work with minimal input (no timezone/language)', async () => {
      const minimalInput = {
        formId: 'form-123',
        sessionId: 'session-abc',
        userAgent: 'Mozilla/5.0',
      };

      vi.mocked(prisma.form.findUnique).mockResolvedValue(mockPublishedForm as any);
      vi.mocked(analyticsService.trackFormView).mockResolvedValue(undefined);

      const result = await analyticsResolvers.Mutation.trackFormView(
        {},
        { input: minimalInput },
        mockContext
      );

      expect(analyticsService.trackFormView).toHaveBeenCalledWith(
        {
          formId: 'form-123',
          sessionId: 'session-abc',
          userAgent: 'Mozilla/5.0',
          timezone: undefined,
          language: undefined,
        },
        expect.any(String)
      );

      expect(result).toEqual({ success: true });
    });
  });

  describe('Mutation: updateFormStartTime', () => {
    const updateFormStartTimeInput = {
      formId: 'form-123',
      sessionId: 'session-abc',
      startedAt: '2024-01-01T10:00:00.000Z',
    };

    it('should update form start time successfully', async () => {
      vi.mocked(prisma.form.findUnique).mockResolvedValue(mockPublishedForm as any);
      vi.mocked(analyticsService.updateFormStartTime).mockResolvedValue(undefined);

      const result = await analyticsResolvers.Mutation.updateFormStartTime(
        {},
        { input: updateFormStartTimeInput }
      );

      expect(prisma.form.findUnique).toHaveBeenCalledWith({
        where: { id: 'form-123' },
        select: { id: true, isPublished: true },
      });

      expect(analyticsService.updateFormStartTime).toHaveBeenCalledWith({
        formId: 'form-123',
        sessionId: 'session-abc',
        startedAt: '2024-01-01T10:00:00.000Z',
      });

      expect(result).toEqual({ success: true });
    });

    it('should return success: false when form not found', async () => {
      vi.mocked(prisma.form.findUnique).mockResolvedValue(null);

      const result = await analyticsResolvers.Mutation.updateFormStartTime(
        {},
        { input: updateFormStartTimeInput }
      );

      expect(result).toEqual({ success: false });
    });

    it('should return success: false when form is not published', async () => {
      vi.mocked(prisma.form.findUnique).mockResolvedValue(mockUnpublishedForm as any);

      const result = await analyticsResolvers.Mutation.updateFormStartTime(
        {},
        { input: updateFormStartTimeInput }
      );

      expect(result).toEqual({ success: false });
    });

    it('should return success: false on service error without throwing', async () => {
      vi.mocked(prisma.form.findUnique).mockResolvedValue(mockPublishedForm as any);
      vi.mocked(analyticsService.updateFormStartTime).mockRejectedValue(
        new Error('Service error')
      );

      const result = await analyticsResolvers.Mutation.updateFormStartTime(
        {},
        { input: updateFormStartTimeInput }
      );

      expect(result).toEqual({ success: false });
    });
  });

  describe('Mutation: trackFormSubmission', () => {
    const trackFormSubmissionInput = {
      formId: 'form-123',
      responseId: 'response-123',
      sessionId: 'session-abc',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15',
      timezone: 'Europe/London',
      language: 'en-GB',
      completionTimeSeconds: 120,
    };

    it('should track form submission successfully', async () => {
      vi.mocked(prisma.form.findUnique).mockResolvedValue(mockPublishedForm as any);
      vi.mocked(prisma.response.findUnique).mockResolvedValue(mockResponse as any);
      vi.mocked(analyticsService.trackFormSubmission).mockResolvedValue(undefined);

      const result = await analyticsResolvers.Mutation.trackFormSubmission(
        {},
        { input: trackFormSubmissionInput },
        mockContext
      );

      expect(prisma.form.findUnique).toHaveBeenCalledWith({
        where: { id: 'form-123' },
        select: { id: true, isPublished: true },
      });

      expect(prisma.response.findUnique).toHaveBeenCalledWith({
        where: { id: 'response-123' },
        select: { id: true, formId: true },
      });

      expect(analyticsService.trackFormSubmission).toHaveBeenCalledWith(
        {
          formId: 'form-123',
          responseId: 'response-123',
          sessionId: 'session-abc',
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15',
          timezone: 'Europe/London',
          language: 'en-GB',
          completionTimeSeconds: 120,
        },
        '192.168.1.1'
      );

      expect(result).toEqual({ success: true });
    });

    it('should throw error when form not found', async () => {
      vi.mocked(prisma.form.findUnique).mockResolvedValue(null);

      await expect(
        analyticsResolvers.Mutation.trackFormSubmission(
          {},
          { input: trackFormSubmissionInput },
          mockContext
        )
      ).rejects.toThrow(GraphQLError);
      await expect(
        analyticsResolvers.Mutation.trackFormSubmission(
          {},
          { input: trackFormSubmissionInput },
          mockContext
        )
      ).rejects.toThrow('Form not found');
    });

    it('should throw error when form is not published', async () => {
      vi.mocked(prisma.form.findUnique).mockResolvedValue(mockUnpublishedForm as any);

      await expect(
        analyticsResolvers.Mutation.trackFormSubmission(
          {},
          { input: trackFormSubmissionInput },
          mockContext
        )
      ).rejects.toThrow(GraphQLError);
      await expect(
        analyticsResolvers.Mutation.trackFormSubmission(
          {},
          { input: trackFormSubmissionInput },
          mockContext
        )
      ).rejects.toThrow('Form is not published');
    });

    it('should throw error when response not found', async () => {
      vi.mocked(prisma.form.findUnique).mockResolvedValue(mockPublishedForm as any);
      vi.mocked(prisma.response.findUnique).mockResolvedValue(null);

      await expect(
        analyticsResolvers.Mutation.trackFormSubmission(
          {},
          { input: trackFormSubmissionInput },
          mockContext
        )
      ).rejects.toThrow(GraphQLError);
      await expect(
        analyticsResolvers.Mutation.trackFormSubmission(
          {},
          { input: trackFormSubmissionInput },
          mockContext
        )
      ).rejects.toThrow('Response not found');
    });

    it('should throw error when response does not belong to form', async () => {
      vi.mocked(prisma.form.findUnique).mockResolvedValue(mockPublishedForm as any);
      vi.mocked(prisma.response.findUnique).mockResolvedValue({
        id: 'response-123',
        formId: 'different-form-456',
      } as any);

      await expect(
        analyticsResolvers.Mutation.trackFormSubmission(
          {},
          { input: trackFormSubmissionInput },
          mockContext
        )
      ).rejects.toThrow(GraphQLError);
      await expect(
        analyticsResolvers.Mutation.trackFormSubmission(
          {},
          { input: trackFormSubmissionInput },
          mockContext
        )
      ).rejects.toThrow('Response does not belong to this form');
    });

    it('should return success: false on analytics service error', async () => {
      vi.mocked(prisma.form.findUnique).mockResolvedValue(mockPublishedForm as any);
      vi.mocked(prisma.response.findUnique).mockResolvedValue(mockResponse as any);
      vi.mocked(analyticsService.trackFormSubmission).mockRejectedValue(
        new Error('Analytics service error')
      );

      const result = await analyticsResolvers.Mutation.trackFormSubmission(
        {},
        { input: trackFormSubmissionInput },
        mockContext
      );

      expect(result).toEqual({ success: false });
    });

    it('should work with optional fields (no timezone/language/completionTime)', async () => {
      const minimalInput = {
        formId: 'form-123',
        responseId: 'response-123',
        sessionId: 'session-abc',
        userAgent: 'Mozilla/5.0',
      };

      vi.mocked(prisma.form.findUnique).mockResolvedValue(mockPublishedForm as any);
      vi.mocked(prisma.response.findUnique).mockResolvedValue(mockResponse as any);
      vi.mocked(analyticsService.trackFormSubmission).mockResolvedValue(undefined);

      const result = await analyticsResolvers.Mutation.trackFormSubmission(
        {},
        { input: minimalInput },
        mockContext
      );

      expect(analyticsService.trackFormSubmission).toHaveBeenCalledWith(
        {
          formId: 'form-123',
          responseId: 'response-123',
          sessionId: 'session-abc',
          userAgent: 'Mozilla/5.0',
          timezone: undefined,
          language: undefined,
          completionTimeSeconds: undefined,
        },
        expect.any(String)
      );

      expect(result).toEqual({ success: true });
    });

    it('should fall back to x-forwarded-for header when other IP sources are absent', async () => {
      const forwardedContext = {
        req: {
          headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' },
        },
      };

      vi.mocked(prisma.form.findUnique).mockResolvedValue(mockPublishedForm as any);
      vi.mocked(prisma.response.findUnique).mockResolvedValue(mockResponse as any);
      vi.mocked(analyticsService.trackFormSubmission).mockResolvedValue(undefined);

      await analyticsResolvers.Mutation.trackFormSubmission(
        {},
        { input: trackFormSubmissionInput },
        forwardedContext
      );

      expect(analyticsService.trackFormSubmission).toHaveBeenCalledWith(
        expect.any(Object),
        '203.0.113.9'
      );
    });
  });

  describe('Query: formAnalytics', () => {
    const mockAnalyticsData = {
      totalViews: 1500,
      uniqueSessions: 1200,
      topCountries: [
        { code: 'USA', name: 'United States', count: 800, percentage: 53.3 },
        { code: 'GBR', name: 'United Kingdom', count: 300, percentage: 20 },
        { code: 'CAN', name: 'Canada', count: 200, percentage: 13.3 },
      ],
      topRegions: [
        { name: 'California', code: 'CA', countryCode: 'US', count: 500, percentage: 33.3 },
        { name: 'Ontario', code: 'ON', countryCode: 'CA', count: 200, percentage: 13.3 },
      ],
      topCities: [
        { name: 'San Francisco', region: 'California', countryCode: 'US', count: 250, percentage: 16.6 },
        { name: 'London', region: 'England', countryCode: 'GB', count: 180, percentage: 12 },
      ],
      topOperatingSystems: [
        { name: 'Windows', count: 750, percentage: 50 },
        { name: 'macOS', count: 450, percentage: 30 },
        { name: 'Linux', count: 300, percentage: 20 },
      ],
      topBrowsers: [
        { name: 'Chrome', count: 900, percentage: 60 },
        { name: 'Firefox', count: 400, percentage: 26.7 },
        { name: 'Safari', count: 200, percentage: 13.3 },
      ],
      viewsOverTime: [
        { date: '2024-01-01', views: 100, sessions: 80 },
        { date: '2024-01-02', views: 150, sessions: 120 },
      ],
    };

    it('should return analytics data for authenticated user with access', async () => {
      vi.mocked(prisma.form.findUnique).mockResolvedValue(mockPublishedForm as any);
      vi.mocked(analyticsService.getFormAnalytics).mockResolvedValue(mockAnalyticsData);

      const result = await analyticsResolvers.Query.formAnalytics(
        {},
        { formId: 'form-123' },
        mockContext
      );

      expect(prisma.form.findUnique).toHaveBeenCalledWith({
        where: { id: 'form-123' },
        include: {
          organization: {
            include: {
              members: {
                where: { userId: 'user-123' },
              },
            },
          },
        },
      });

      expect(analyticsService.getFormAnalytics).toHaveBeenCalledWith('form-123', undefined);

      expect(result).toEqual(mockAnalyticsData);
    });

    it('should throw error when user is not authenticated', async () => {
      const unauthenticatedContext = {
        ...mockContext,
        user: null,
      };

      await expect(
        analyticsResolvers.Query.formAnalytics(
          {},
          { formId: 'form-123' },
          unauthenticatedContext
        )
      ).rejects.toThrow(GraphQLError);
      await expect(
        analyticsResolvers.Query.formAnalytics(
          {},
          { formId: 'form-123' },
          unauthenticatedContext
        )
      ).rejects.toThrow('Authentication required');
    });

    it('should throw error when form not found', async () => {
      vi.mocked(prisma.form.findUnique).mockResolvedValue(null);

      await expect(
        analyticsResolvers.Query.formAnalytics(
          {},
          { formId: 'non-existent-form' },
          mockContext
        )
      ).rejects.toThrow(GraphQLError);
      await expect(
        analyticsResolvers.Query.formAnalytics(
          {},
          { formId: 'non-existent-form' },
          mockContext
        )
      ).rejects.toThrow('Form not found');
    });

    it('should throw error when user is not a member of organization', async () => {
      const formWithoutUserMembership = {
        ...mockPublishedForm,
        organization: {
          members: [], // User is not a member
        },
      };

      vi.mocked(prisma.form.findUnique).mockResolvedValue(formWithoutUserMembership as any);

      await expect(
        analyticsResolvers.Query.formAnalytics(
          {},
          { formId: 'form-123' },
          mockContext
        )
      ).rejects.toThrow(GraphQLError);
      await expect(
        analyticsResolvers.Query.formAnalytics(
          {},
          { formId: 'form-123' },
          mockContext
        )
      ).rejects.toThrow('Access denied');
    });

    it('should handle time range filtering', async () => {
      const timeRange = {
        start: '2024-01-01T00:00:00.000Z',
        end: '2024-01-31T23:59:59.999Z',
      };

      vi.mocked(prisma.form.findUnique).mockResolvedValue(mockPublishedForm as any);
      vi.mocked(analyticsService.getFormAnalytics).mockResolvedValue(mockAnalyticsData);

      await analyticsResolvers.Query.formAnalytics(
        {},
        { formId: 'form-123', timeRange },
        mockContext
      );

      expect(analyticsService.getFormAnalytics).toHaveBeenCalledWith('form-123', {
        start: new Date('2024-01-01T00:00:00.000Z'),
        end: new Date('2024-01-31T23:59:59.999Z'),
      });
    });

    it('should throw generic error on service failure', async () => {
      vi.mocked(prisma.form.findUnique).mockResolvedValue(mockPublishedForm as any);
      vi.mocked(analyticsService.getFormAnalytics).mockRejectedValue(
        new Error('Database error')
      );

      await expect(
        analyticsResolvers.Query.formAnalytics(
          {},
          { formId: 'form-123' },
          mockContext
        )
      ).rejects.toThrow(GraphQLError);
      await expect(
        analyticsResolvers.Query.formAnalytics(
          {},
          { formId: 'form-123' },
          mockContext
        )
      ).rejects.toThrow('Failed to fetch analytics data');
    });

    it('should preserve GraphQL errors thrown during execution', async () => {
      vi.mocked(prisma.form.findUnique).mockRejectedValue(
        new GraphQLError('Custom GraphQL Error')
      );

      await expect(
        analyticsResolvers.Query.formAnalytics(
          {},
          { formId: 'form-123' },
          mockContext
        )
      ).rejects.toThrow('Custom GraphQL Error');
    });
  });

  describe('Query: formSubmissionAnalytics', () => {
    const mockSubmissionAnalyticsData = {
      totalSubmissions: 800,
      uniqueSessions: 750,
      averageCompletionTime: 185.5,
      completionTimePercentiles: {
        p50: 150,
        p75: 200,
        p90: 280,
        p95: 350,
      },
      topCountries: [
        { code: 'USA', name: 'United States', count: 400, percentage: 50 },
        { code: 'GBR', name: 'United Kingdom', count: 200, percentage: 25 },
      ],
      topRegions: [
        { name: 'California', code: 'CA', countryCode: 'US', count: 220, percentage: 27.5 },
        { name: 'England', code: 'ENG', countryCode: 'GB', count: 150, percentage: 18.75 },
      ],
      topCities: [
        { name: 'Los Angeles', region: 'California', countryCode: 'US', count: 180, percentage: 22.5 },
        { name: 'London', region: 'England', countryCode: 'GB', count: 130, percentage: 16.25 },
      ],
      topOperatingSystems: [
        { name: 'Windows', count: 400, percentage: 50 },
        { name: 'macOS', count: 300, percentage: 37.5 },
      ],
      topBrowsers: [
        { name: 'Chrome', count: 500, percentage: 62.5 },
        { name: 'Safari', count: 200, percentage: 25 },
      ],
      submissionsOverTime: [
        { date: '2024-01-01', submissions: 50, sessions: 48 },
        { date: '2024-01-02', submissions: 75, sessions: 70 },
      ],
      completionTimeDistribution: [
        { label: '0-30 seconds', minSeconds: 0, maxSeconds: 30, count: 100, percentage: 12.5 },
        { label: '1-2 minutes', minSeconds: 61, maxSeconds: 120, count: 300, percentage: 37.5 },
      ],
    };

    it('should return submission analytics data for authenticated user with access', async () => {
      vi.mocked(prisma.form.findUnique).mockResolvedValue(mockPublishedForm as any);
      vi.mocked(analyticsService.getFormSubmissionAnalytics).mockResolvedValue(
        mockSubmissionAnalyticsData
      );

      const result = await analyticsResolvers.Query.formSubmissionAnalytics(
        {},
        { formId: 'form-123' },
        mockContext
      );

      expect(prisma.form.findUnique).toHaveBeenCalledWith({
        where: { id: 'form-123' },
        include: {
          organization: {
            include: {
              members: {
                where: { userId: 'user-123' },
              },
            },
          },
        },
      });

      expect(analyticsService.getFormSubmissionAnalytics).toHaveBeenCalledWith(
        'form-123',
        undefined
      );

      expect(result).toEqual(mockSubmissionAnalyticsData);
    });

    it('should throw error when user is not authenticated', async () => {
      const unauthenticatedContext = {
        ...mockContext,
        user: null,
      };

      await expect(
        analyticsResolvers.Query.formSubmissionAnalytics(
          {},
          { formId: 'form-123' },
          unauthenticatedContext
        )
      ).rejects.toThrow(GraphQLError);
      await expect(
        analyticsResolvers.Query.formSubmissionAnalytics(
          {},
          { formId: 'form-123' },
          unauthenticatedContext
        )
      ).rejects.toThrow('Authentication required');
    });

    it('should throw error when form not found', async () => {
      vi.mocked(prisma.form.findUnique).mockResolvedValue(null);

      await expect(
        analyticsResolvers.Query.formSubmissionAnalytics(
          {},
          { formId: 'non-existent-form' },
          mockContext
        )
      ).rejects.toThrow(GraphQLError);
      await expect(
        analyticsResolvers.Query.formSubmissionAnalytics(
          {},
          { formId: 'non-existent-form' },
          mockContext
        )
      ).rejects.toThrow('Form not found');
    });

    it('should throw error when user is not a member of organization', async () => {
      const formWithoutUserMembership = {
        ...mockPublishedForm,
        organization: {
          members: [], // User is not a member
        },
      };

      vi.mocked(prisma.form.findUnique).mockResolvedValue(formWithoutUserMembership as any);

      await expect(
        analyticsResolvers.Query.formSubmissionAnalytics(
          {},
          { formId: 'form-123' },
          mockContext
        )
      ).rejects.toThrow(GraphQLError);
      await expect(
        analyticsResolvers.Query.formSubmissionAnalytics(
          {},
          { formId: 'form-123' },
          mockContext
        )
      ).rejects.toThrow('Access denied');
    });

    it('should handle time range filtering', async () => {
      const timeRange = {
        start: '2024-01-01T00:00:00.000Z',
        end: '2024-01-31T23:59:59.999Z',
      };

      vi.mocked(prisma.form.findUnique).mockResolvedValue(mockPublishedForm as any);
      vi.mocked(analyticsService.getFormSubmissionAnalytics).mockResolvedValue(
        mockSubmissionAnalyticsData
      );

      await analyticsResolvers.Query.formSubmissionAnalytics(
        {},
        { formId: 'form-123', timeRange },
        mockContext
      );

      expect(analyticsService.getFormSubmissionAnalytics).toHaveBeenCalledWith('form-123', {
        start: new Date('2024-01-01T00:00:00.000Z'),
        end: new Date('2024-01-31T23:59:59.999Z'),
      });
    });

    it('should throw generic error on service failure', async () => {
      vi.mocked(prisma.form.findUnique).mockResolvedValue(mockPublishedForm as any);
      vi.mocked(analyticsService.getFormSubmissionAnalytics).mockRejectedValue(
        new Error('Database error')
      );

      await expect(
        analyticsResolvers.Query.formSubmissionAnalytics(
          {},
          { formId: 'form-123' },
          mockContext
        )
      ).rejects.toThrow(GraphQLError);
      await expect(
        analyticsResolvers.Query.formSubmissionAnalytics(
          {},
          { formId: 'form-123' },
          mockContext
        )
      ).rejects.toThrow('Failed to fetch submission analytics data');
    });

    it('should preserve GraphQL errors thrown during execution', async () => {
      vi.mocked(prisma.form.findUnique).mockRejectedValue(
        new GraphQLError('Custom GraphQL Error')
      );

      await expect(
        analyticsResolvers.Query.formSubmissionAnalytics(
          {},
          { formId: 'form-123' },
          mockContext
        )
      ).rejects.toThrow('Custom GraphQL Error');
    });

    it('should handle null completion time percentiles', async () => {
      const dataWithNullPercentiles = {
        ...mockSubmissionAnalyticsData,
        completionTimePercentiles: {
          p50: null,
          p75: null,
          p90: null,
          p95: null,
        },
      };

      vi.mocked(prisma.form.findUnique).mockResolvedValue(mockPublishedForm as any);
      vi.mocked(analyticsService.getFormSubmissionAnalytics).mockResolvedValue(
        dataWithNullPercentiles
      );

      const result = await analyticsResolvers.Query.formSubmissionAnalytics(
        {},
        { formId: 'form-123' },
        mockContext
      );

      expect(result.completionTimePercentiles).toEqual({
        p50: null,
        p75: null,
        p90: null,
        p95: null,
      });
    });
  });

  describe('IP extraction logic', () => {
    it('should prioritize req.ip over other sources', async () => {
      const contextWithMultipleIPs = {
        ...mockContext,
        req: {
          ip: '192.168.1.1',
          connection: { remoteAddress: '10.0.0.1' },
          socket: { remoteAddress: '172.16.0.1' },
          headers: {
            'x-forwarded-for': '203.0.113.195, 198.51.100.178',
          },
        },
      };

      vi.mocked(prisma.form.findUnique).mockResolvedValue(mockPublishedForm as any);
      vi.mocked(analyticsService.trackFormView).mockResolvedValue(undefined);

      await analyticsResolvers.Mutation.trackFormView(
        {},
        {
          input: {
            formId: 'form-123',
            sessionId: 'session-abc',
            userAgent: 'Mozilla/5.0',
          },
        },
        contextWithMultipleIPs
      );

      expect(analyticsService.trackFormView).toHaveBeenCalledWith(
        expect.any(Object),
        '192.168.1.1' // req.ip takes priority
      );
    });

    it('should fallback to connection.remoteAddress when no other IP available', async () => {
      const contextWithConnectionIP = {
        req: {
          connection: { remoteAddress: '10.0.0.1' },
        },
        user: mockContext.user,
      };

      vi.mocked(prisma.form.findUnique).mockResolvedValue(mockPublishedForm as any);
      vi.mocked(analyticsService.trackFormView).mockResolvedValue(undefined);

      await analyticsResolvers.Mutation.trackFormView(
        {},
        {
          input: {
            formId: 'form-123',
            sessionId: 'session-abc',
            userAgent: 'Mozilla/5.0',
          },
        },
        contextWithConnectionIP
      );

      expect(analyticsService.trackFormView).toHaveBeenCalledWith(
        expect.any(Object),
        '10.0.0.1'
      );
    });

    it('should fallback to socket.remoteAddress when no ip or connection available', async () => {
      const contextWithSocketIP = {
        req: {
          socket: { remoteAddress: '172.16.0.1' },
        },
        user: mockContext.user,
      };

      vi.mocked(prisma.form.findUnique).mockResolvedValue(mockPublishedForm as any);
      vi.mocked(analyticsService.trackFormView).mockResolvedValue(undefined);

      await analyticsResolvers.Mutation.trackFormView(
        {},
        {
          input: {
            formId: 'form-123',
            sessionId: 'session-abc',
            userAgent: 'Mozilla/5.0',
          },
        },
        contextWithSocketIP
      );

      expect(analyticsService.trackFormView).toHaveBeenCalledWith(
        expect.any(Object),
        '172.16.0.1'
      );
    });

    it('should use x-forwarded-for header as last fallback', async () => {
      const contextWithForwardedFor = {
        req: {
          headers: {
            'x-forwarded-for': '203.0.113.195, 198.51.100.178',
          },
        },
        user: mockContext.user,
      };

      vi.mocked(prisma.form.findUnique).mockResolvedValue(mockPublishedForm as any);
      vi.mocked(analyticsService.trackFormView).mockResolvedValue(undefined);

      await analyticsResolvers.Mutation.trackFormView(
        {},
        {
          input: {
            formId: 'form-123',
            sessionId: 'session-abc',
            userAgent: 'Mozilla/5.0',
          },
        },
        contextWithForwardedFor
      );

      expect(analyticsService.trackFormView).toHaveBeenCalledWith(
        expect.any(Object),
        '203.0.113.195' // First IP in x-forwarded-for chain
      );
    });

    it('should handle undefined IP gracefully', async () => {
      const contextWithNoIP = {
        req: {},
        user: mockContext.user,
      };

      vi.mocked(prisma.form.findUnique).mockResolvedValue(mockPublishedForm as any);
      vi.mocked(analyticsService.trackFormView).mockResolvedValue(undefined);

      await analyticsResolvers.Mutation.trackFormView(
        {},
        {
          input: {
            formId: 'form-123',
            sessionId: 'session-abc',
            userAgent: 'Mozilla/5.0',
          },
        },
        contextWithNoIP
      );

      expect(analyticsService.trackFormView).toHaveBeenCalledWith(
        expect.any(Object),
        undefined
      );
    });
  });

  describe('Error handling and resilience', () => {
    it('should not disrupt form viewing on analytics tracking failures', async () => {
      vi.mocked(prisma.form.findUnique).mockResolvedValue(mockPublishedForm as any);
      vi.mocked(analyticsService.trackFormView).mockRejectedValue(
        new Error('Database connection lost')
      );

      const result = await analyticsResolvers.Mutation.trackFormView(
        {},
        {
          input: {
            formId: 'form-123',
            sessionId: 'session-abc',
            userAgent: 'Mozilla/5.0',
          },
        },
        mockContext
      );

      // Should return success: false instead of throwing
      expect(result).toEqual({ success: false });
    });

    it('should not disrupt form submission on analytics tracking failures', async () => {
      vi.mocked(prisma.form.findUnique).mockResolvedValue(mockPublishedForm as any);
      vi.mocked(prisma.response.findUnique).mockResolvedValue(mockResponse as any);
      vi.mocked(analyticsService.trackFormSubmission).mockRejectedValue(
        new Error('Database connection lost')
      );

      const result = await analyticsResolvers.Mutation.trackFormSubmission(
        {},
        {
          input: {
            formId: 'form-123',
            responseId: 'response-123',
            sessionId: 'session-abc',
            userAgent: 'Mozilla/5.0',
          },
        },
        mockContext
      );

      // Should return success: false instead of throwing
      expect(result).toEqual({ success: false });
    });

    it('should rethrow GraphQL errors from validation', async () => {
      vi.mocked(prisma.form.findUnique).mockResolvedValue(null);

      // These should throw, not return success: false
      await expect(
        analyticsResolvers.Mutation.trackFormView(
          {},
          {
            input: {
              formId: 'form-123',
              sessionId: 'session-abc',
              userAgent: 'Mozilla/5.0',
            },
          },
          mockContext
        )
      ).rejects.toThrow(GraphQLError);
    });
  });
});

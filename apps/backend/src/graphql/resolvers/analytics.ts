import { createGraphQLError, GraphQLError } from '#graphql-errors';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import { analyticsService } from '../../services/analyticsService.js';
import { prisma } from '../../lib/prisma.js';
import { emitFormViewed } from '../../subscriptions/events.js';
import { logger } from '../../lib/logger.js';

export const analyticsResolvers = {
  Mutation: {
    trackFormView: async (_: any, { input }: { input: TrackFormViewInput }, context: any) => {
      try {
        // Get client IP from request
        const clientIP = context.req?.ip ||
          context.req?.connection?.remoteAddress ||
          context.req?.socket?.remoteAddress ||
          (context.req?.headers?.['x-forwarded-for'] as string)?.split(',')[0];

        // Verify form exists and is published
        const form = await prisma.form.findUnique({
          where: { id: input.formId },
          select: { id: true, isPublished: true, organizationId: true }
        });

        if (!form) {
          throw createGraphQLError('Form not found', GRAPHQL_ERROR_CODES.FORM_NOT_FOUND);
        }

        if (!form.isPublished) {
          throw createGraphQLError('Form is not published', GRAPHQL_ERROR_CODES.FORM_NOT_PUBLISHED);
        }

        const visitorGeo = context.req?.visitorGeo || context.res?.locals?.visitorGeo;

        // Track the analytics
        await analyticsService.trackFormView({
          formId: input.formId,
          sessionId: input.sessionId,
          userAgent: input.userAgent,
          timezone: input.timezone,
          language: input.language,
          visitorGeo
        }, clientIP);

        // Emit subscription event for usage tracking
        try {
          emitFormViewed(
            form.organizationId,
            input.formId,
            input.sessionId,
            input.userAgent
          );
        } catch (error) {
          logger.error('Error emitting subscription event:', error);
        }

        return {
          success: true
        };
      } catch (error) {
        logger.error('Error in trackFormView mutation:', error);

        if (error instanceof GraphQLError) {
          throw error;
        }

        // Don't throw error for analytics failures to avoid disrupting form viewing
        return {
          success: false
        };
      }
    },

    updateFormStartTime: async (_: any, { input }: { input: UpdateFormStartTimeInput }) => {
      try {
        // Verify form exists and is published
        const form = await prisma.form.findUnique({
          where: { id: input.formId },
          select: { id: true, isPublished: true }
        });

        if (!form) {
          throw createGraphQLError('Form not found', GRAPHQL_ERROR_CODES.FORM_NOT_FOUND);
        }

        if (!form.isPublished) {
          throw createGraphQLError('Form is not published', GRAPHQL_ERROR_CODES.FORM_NOT_PUBLISHED);
        }

        await analyticsService.updateFormStartTime({
          formId: input.formId,
          sessionId: input.sessionId,
          startedAt: input.startedAt
        });

        return {
          success: true
        };
      } catch (error) {
        logger.error('Error in updateFormStartTime mutation:', error);
        return {
          success: false
        };
      }
    },

    trackFormSubmission: async (_: any, { input }: { input: TrackFormSubmissionInput }, context: any) => {
      try {
        // Get client IP from request
        const clientIP = context.req?.ip ||
          context.req?.connection?.remoteAddress ||
          context.req?.socket?.remoteAddress ||
          (context.req?.headers?.['x-forwarded-for'] as string)?.split(',')[0];

        // Verify form exists and is published
        const form = await prisma.form.findUnique({
          where: { id: input.formId },
          select: { id: true, isPublished: true }
        });

        if (!form) {
          throw createGraphQLError('Form not found', GRAPHQL_ERROR_CODES.FORM_NOT_FOUND);
        }

        if (!form.isPublished) {
          throw createGraphQLError('Form is not published', GRAPHQL_ERROR_CODES.FORM_NOT_PUBLISHED);
        }

        // Verify response exists
        const response = await prisma.response.findUnique({
          where: { id: input.responseId },
          select: { id: true, formId: true }
        });

        if (!response) {
          throw createGraphQLError('Response not found', GRAPHQL_ERROR_CODES.RESPONSE_NOT_FOUND);
        }

        if (response.formId !== input.formId) {
          throw createGraphQLError('Response does not belong to this form', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
        }

        const visitorGeo = context.req?.visitorGeo || context.res?.locals?.visitorGeo;

        // Track the submission analytics
        await analyticsService.trackFormSubmission({
          formId: input.formId,
          responseId: input.responseId,
          sessionId: input.sessionId,
          userAgent: input.userAgent,
          timezone: input.timezone,
          language: input.language,
          completionTimeSeconds: input.completionTimeSeconds,
          visitorGeo
        }, clientIP);

        return {
          success: true
        };
      } catch (error) {
        logger.error('Error in trackFormSubmission mutation:', error);

        if (error instanceof GraphQLError) {
          throw error;
        }

        // Don't throw error for analytics failures to avoid disrupting form submission
        return {
          success: false
        };
      }
    }
  },

  Query: {
    formAnalytics: async (_: any, { formId, timeRange }: { formId: string; timeRange?: TimeRangeInput }, context: any) => {
      try {
        // Verify user has access to this form
        if (!context.user) {
          throw createGraphQLError('Authentication required', GRAPHQL_ERROR_CODES.AUTHENTICATION_REQUIRED);
        }

        // Check if user has access to the form (either owner or member of organization)
        const form = await prisma.form.findUnique({
          where: { id: formId },
          include: {
            organization: {
              include: {
                members: {
                  where: { userId: context.user.id }
                }
              }
            }
          }
        });

        if (!form) {
          throw createGraphQLError('Form not found', GRAPHQL_ERROR_CODES.FORM_NOT_FOUND);
        }

        // Check if user is a member of the organization
        if (form.organization.members.length === 0) {
          throw createGraphQLError('Access denied', GRAPHQL_ERROR_CODES.NO_ACCESS);
        }

        // Parse time range if provided
        let parsedTimeRange;
        if (timeRange) {
          parsedTimeRange = {
            start: new Date(timeRange.start),
            end: new Date(timeRange.end)
          };
        }

        // Get analytics data
        const analytics = await analyticsService.getFormAnalytics(formId, parsedTimeRange);

        return analytics;
      } catch (error) {
        logger.error('Error in formAnalytics query:', error);

        if (error instanceof GraphQLError) {
          throw error;
        }

        throw createGraphQLError('Failed to fetch analytics data', GRAPHQL_ERROR_CODES.INTERNAL_SERVER_ERROR);
      }
    },

    formSubmissionAnalytics: async (_: any, { formId, timeRange }: { formId: string; timeRange?: TimeRangeInput }, context: any) => {
      try {
        // Verify user has access to this form
        if (!context.user) {
          throw createGraphQLError('Authentication required', GRAPHQL_ERROR_CODES.AUTHENTICATION_REQUIRED);
        }

        // Check if user has access to the form (either owner or member of organization)
        const form = await prisma.form.findUnique({
          where: { id: formId },
          include: {
            organization: {
              include: {
                members: {
                  where: { userId: context.user.id }
                }
              }
            }
          }
        });

        if (!form) {
          throw createGraphQLError('Form not found', GRAPHQL_ERROR_CODES.FORM_NOT_FOUND);
        }

        // Check if user is a member of the organization
        if (form.organization.members.length === 0) {
          throw createGraphQLError('Access denied', GRAPHQL_ERROR_CODES.NO_ACCESS);
        }

        // Parse time range if provided
        let parsedTimeRange;
        if (timeRange) {
          parsedTimeRange = {
            start: new Date(timeRange.start),
            end: new Date(timeRange.end)
          };
        }

        // Get submission analytics data
        const submissionAnalytics = await analyticsService.getFormSubmissionAnalytics(formId, parsedTimeRange);

        return submissionAnalytics;
      } catch (error) {
        logger.error('Error in formSubmissionAnalytics query:', error);

        if (error instanceof GraphQLError) {
          throw error;
        }

        throw createGraphQLError('Failed to fetch submission analytics data', GRAPHQL_ERROR_CODES.INTERNAL_SERVER_ERROR);
      }
    }
  }
};

// TypeScript interfaces for input types
export interface TrackFormViewInput {
  formId: string;
  sessionId: string;
  userAgent: string;
  timezone?: string;
  language?: string;
}

export interface UpdateFormStartTimeInput {
  formId: string;
  sessionId: string;
  startedAt: string;
}

export interface TrackFormSubmissionInput {
  formId: string;
  responseId: string;
  sessionId: string;
  userAgent: string;
  timezone?: string;
  language?: string;
  completionTimeSeconds?: number;
}

export interface TimeRangeInput {
  start: string;
  end: string;
}

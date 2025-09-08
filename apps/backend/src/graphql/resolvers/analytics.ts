import { GraphQLError } from 'graphql';
import { analyticsService } from '../../services/analyticsService.js';
import { prisma } from '../../lib/prisma.js';

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
          select: { id: true, isPublished: true }
        });
        
        if (!form) {
          throw new GraphQLError('Form not found');
        }
        
        if (!form.isPublished) {
          throw new GraphQLError('Form is not published');
        }
        
        // Track the analytics
        await analyticsService.trackFormView({
          formId: input.formId,
          sessionId: input.sessionId,
          userAgent: input.userAgent,
          timezone: input.timezone,
          language: input.language
        }, clientIP);
        
        return {
          success: true
        };
      } catch (error) {
        console.error('Error in trackFormView mutation:', error);
        
        if (error instanceof GraphQLError) {
          throw error;
        }
        
        // Don't throw error for analytics failures to avoid disrupting form viewing
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
          throw new GraphQLError('Form not found');
        }
        
        if (!form.isPublished) {
          throw new GraphQLError('Form is not published');
        }

        // Verify response exists
        const response = await prisma.response.findUnique({
          where: { id: input.responseId },
          select: { id: true, formId: true }
        });

        if (!response) {
          throw new GraphQLError('Response not found');
        }

        if (response.formId !== input.formId) {
          throw new GraphQLError('Response does not belong to this form');
        }
        
        // Track the submission analytics
        await analyticsService.trackFormSubmission({
          formId: input.formId,
          responseId: input.responseId,
          sessionId: input.sessionId,
          userAgent: input.userAgent,
          timezone: input.timezone,
          language: input.language
        }, clientIP);
        
        return {
          success: true
        };
      } catch (error) {
        console.error('Error in trackFormSubmission mutation:', error);
        
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
          throw new GraphQLError('Authentication required');
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
          throw new GraphQLError('Form not found');
        }
        
        // Check if user is a member of the organization
        if (form.organization.members.length === 0) {
          throw new GraphQLError('Access denied');
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
        console.error('Error in formAnalytics query:', error);
        
        if (error instanceof GraphQLError) {
          throw error;
        }
        
        throw new GraphQLError('Failed to fetch analytics data');
      }
    },

    formSubmissionAnalytics: async (_: any, { formId, timeRange }: { formId: string; timeRange?: TimeRangeInput }, context: any) => {
      try {
        // Verify user has access to this form
        if (!context.user) {
          throw new GraphQLError('Authentication required');
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
          throw new GraphQLError('Form not found');
        }
        
        // Check if user is a member of the organization
        if (form.organization.members.length === 0) {
          throw new GraphQLError('Access denied');
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
        console.error('Error in formSubmissionAnalytics query:', error);
        
        if (error instanceof GraphQLError) {
          throw error;
        }
        
        throw new GraphQLError('Failed to fetch submission analytics data');
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

export interface TrackFormSubmissionInput {
  formId: string;
  responseId: string;
  sessionId: string;
  userAgent: string;
  timezone?: string;
  language?: string;
}

export interface TimeRangeInput {
  start: string;
  end: string;
}
import { GraphQLError } from 'graphql';
import { FieldType } from '@dculus/types';
import {
  getFieldAnalytics,
  getAllFieldsAnalytics,
  type FieldAnalytics
} from '../../services/fieldAnalyticsService.js';
import { prisma } from '../../lib/prisma.js';
import { getFormSchemaFromHocuspocus } from '../../services/hocuspocus.js';

/**
 * Check if user has access to the form (optimized query)
 */
const checkFormAccess = async (formId: string, userId: string, includeSchema: boolean = false) => {
  const selectClause = includeSchema 
    ? { id: true, formSchema: true, organization: true }
    : { id: true, organization: true };
    
  const form = await prisma.form.findFirst({
    where: {
      id: formId,
      organization: {
        members: {
          some: {
            userId: userId
          }
        }
      }
    },
    select: selectClause
  });

  if (!form) {
    throw new GraphQLError('Form not found or access denied', {
      extensions: { code: 'FORBIDDEN' }
    });
  }

  return form;
};

/**
 * Get field info from form schema
 */
const getFieldInfo = (formSchema: any, fieldId: string): { type: FieldType; label: string } | null => {
  if (!formSchema.pages) return null;

  for (const page of formSchema.pages) {
    if (page.fields) {
      const field = page.fields.find((f: any) => f.id === fieldId);
      if (field) {
        return {
          type: field.type as FieldType,
          label: field.label || `Field ${fieldId}`
        };
      }
    }
  }

  console.log('❌ Field not found:', fieldId);
  return null;
};

/**
 * Transform analytics data to match GraphQL schema structure
 */
const transformAnalyticsToGraphQL = (analytics: FieldAnalytics) => {
  const base: any = {
    fieldId: analytics.fieldId,
    fieldType: analytics.fieldType,
    fieldLabel: analytics.fieldLabel,
    totalResponses: analytics.totalResponses,
    responseRate: analytics.responseRate,
    lastUpdated: analytics.lastUpdated.toISOString(),
    textAnalytics: null,
    numberAnalytics: null,
    selectionAnalytics: null,
    checkboxAnalytics: null,
    dateAnalytics: null,
    emailAnalytics: null,
  };

  // Add field-specific analytics based on type
  switch (analytics.fieldType) {
    case FieldType.TEXT_INPUT_FIELD:
    case FieldType.TEXT_AREA_FIELD:
      if ('averageLength' in analytics) {
        base.textAnalytics = {
          averageLength: analytics.averageLength,
          minLength: analytics.minLength,
          maxLength: analytics.maxLength,
          wordCloud: analytics.wordCloud,
          lengthDistribution: analytics.lengthDistribution,
          commonPhrases: analytics.commonPhrases,
          recentResponses: analytics.recentResponses.map(r => ({
            value: r.value,
            submittedAt: r.submittedAt.toISOString(),
            responseId: r.responseId,
          })),
        };
      }
      break;

    case FieldType.NUMBER_FIELD:
      if ('min' in analytics && 'max' in analytics) {
        base.numberAnalytics = {
          min: analytics.min,
          max: analytics.max,
          average: analytics.average,
          median: analytics.median,
          standardDeviation: analytics.standardDeviation,
          distribution: analytics.distribution,
          trend: analytics.trend,
          percentiles: analytics.percentiles,
        };
      }
      break;

    case FieldType.SELECT_FIELD:
    case FieldType.RADIO_FIELD:
      if ('options' in analytics) {
        base.selectionAnalytics = {
          options: analytics.options,
          trend: analytics.trend,
          topOption: analytics.topOption,
          responseDistribution: analytics.responseDistribution,
        };
      }
      break;

    case FieldType.CHECKBOX_FIELD:
      if ('individualOptions' in analytics) {
        base.checkboxAnalytics = {
          individualOptions: analytics.individualOptions,
          combinations: analytics.combinations,
          averageSelections: analytics.averageSelections,
          selectionDistribution: analytics.selectionDistribution,
          correlations: analytics.correlations,
        };
      }
      break;

    case FieldType.DATE_FIELD:
      if ('earliestDate' in analytics) {
        base.dateAnalytics = {
          earliestDate: analytics.earliestDate.toISOString(),
          latestDate: analytics.latestDate.toISOString(),
          mostCommonDate: analytics.mostCommonDate.toISOString(),
          dateDistribution: analytics.dateDistribution,
          weekdayDistribution: analytics.weekdayDistribution,
          monthlyDistribution: analytics.monthlyDistribution,
          seasonalPatterns: analytics.seasonalPatterns,
        };
      }
      break;

    case FieldType.EMAIL_FIELD:
      if ('validEmails' in analytics) {
        base.emailAnalytics = {
          validEmails: analytics.validEmails,
          invalidEmails: analytics.invalidEmails,
          validationRate: analytics.validationRate,
          domains: analytics.domains,
          topLevelDomains: analytics.topLevelDomains,
          corporateVsPersonal: analytics.corporateVsPersonal,
          popularProviders: analytics.popularProviders,
        };
      }
      break;
  }

  return base;
};

export const fieldAnalyticsResolvers = {
  Query: {
    /**
     * Get analytics for a specific field
     */
    fieldAnalytics: async (
      _: any,
      { formId, fieldId }: { formId: string; fieldId: string },
      context: any
    ) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

      // Check form access (don't need schema from DB since we'll get it from Hocuspocus)
      const form = await checkFormAccess(formId, context.user.id, false);

      console.log('🔍 Getting form schema from Hocuspocus collaborative document...');
      
      // Get the proper form schema from YJS collaborative document
      const formSchemaFromHocuspocus = await getFormSchemaFromHocuspocus(formId);
      
      console.log('📋 Hocuspocus schema structure:', {
        hasSchema: !!formSchemaFromHocuspocus,
        hasPages: !!formSchemaFromHocuspocus?.pages,
        pagesCount: formSchemaFromHocuspocus?.pages?.length || 0,
        firstPageFields: formSchemaFromHocuspocus?.pages?.[0]?.fields?.length || 0
      });
      
      if (!formSchemaFromHocuspocus) {
        console.log('❌ No collaborative schema found, falling back to database schema');
        
        // Fallback to database schema if collaborative document doesn't exist
        const fallbackForm = await checkFormAccess(formId, context.user.id, true);
        const fallbackSchema = fallbackForm.formSchema as any; // Type assertion for Prisma JSON field
        
        console.log('📋 Fallback DB schema structure:', {
          hasFormSchema: !!fallbackSchema,
          hasPages: !!fallbackSchema?.pages,
          pagesCount: fallbackSchema?.pages?.length || 0,
          firstPageFields: fallbackSchema?.pages?.[0]?.fields?.length || 0
        });
        
        if (!fallbackSchema) {
          throw new GraphQLError('No form schema found in either collaborative document or database', {
            extensions: { code: 'NOT_FOUND' }
          });
        }
        
        // Get field information from fallback schema
        const fieldInfo = getFieldInfo(fallbackSchema, fieldId);
        if (!fieldInfo) {
          throw new GraphQLError(`Field not found: ${fieldId}`, {
            extensions: { code: 'NOT_FOUND' }
          });
        }
      } else {
        // Get field information from Hocuspocus schema
        const fieldInfo = getFieldInfo(formSchemaFromHocuspocus, fieldId);
        if (!fieldInfo) {
          throw new GraphQLError(`Field not found: ${fieldId}`, {
            extensions: { code: 'NOT_FOUND' }
          });
        }
      }
      
      // Use the schema we found (prefer Hocuspocus over database)
      const activeSchema = formSchemaFromHocuspocus || (form.formSchema as any);
      const fieldInfo = getFieldInfo(activeSchema, fieldId);
      if (!fieldInfo) {
        throw new GraphQLError(`Field not found: ${fieldId}`, {
          extensions: { code: 'NOT_FOUND' }
        });
      }

      // Check if field type is supported for analytics
      const supportedTypes = [
        FieldType.TEXT_INPUT_FIELD,
        FieldType.TEXT_AREA_FIELD,
        FieldType.NUMBER_FIELD,
        FieldType.SELECT_FIELD,
        FieldType.RADIO_FIELD,
        FieldType.CHECKBOX_FIELD,
        FieldType.DATE_FIELD,
        FieldType.EMAIL_FIELD,
      ];

      if (!supportedTypes.includes(fieldInfo.type)) {
        throw new GraphQLError(`Analytics not supported for field type: ${fieldInfo.type}`, {
          extensions: { code: 'UNSUPPORTED_FIELD_TYPE' }
        });
      }

      try {
        const analytics = await getFieldAnalytics(
          formId,
          fieldId,
          fieldInfo.type,
          fieldInfo.label
        );

        return transformAnalyticsToGraphQL(analytics);
      } catch (error) {
        console.error('Error getting field analytics:', error);
        throw new GraphQLError('Failed to get field analytics', {
          extensions: { code: 'INTERNAL_ERROR' }
        });
      }
    },

    /**
     * Get analytics for all fields in a form
     */
    allFieldsAnalytics: async (
      _: any,
      { formId }: { formId: string },
      context: any
    ) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

      // Check form access (no need for schema here)
      await checkFormAccess(formId, context.user.id, false);

      try {
        const analytics = await getAllFieldsAnalytics(formId);

        return {
          formId: analytics.formId,
          totalResponses: analytics.totalResponses,
          fields: analytics.fields.map(transformAnalyticsToGraphQL),
        };
      } catch (error) {
        console.error('Error getting all fields analytics:', error);
        throw new GraphQLError('Failed to get all fields analytics', {
          extensions: { code: 'INTERNAL_ERROR' }
        });
      }
    },

  },
  Mutation: {},
};

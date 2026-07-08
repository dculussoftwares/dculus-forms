import { createGraphQLError } from '#graphql-errors';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import { FieldType } from '@dculus/types';
import {
  getFieldAnalytics,
  getAllFieldsAnalytics,
  type FieldAnalytics,
} from '../../services/fieldAnalytics/index.js';
import { requireAuth, type BetterAuthContext } from '../../middleware/better-auth-middleware.js';
import { prisma } from '../../lib/prisma.js';
import { getFormSchemaFromHocuspocus } from '../../services/hocuspocus.js';
import { logger } from '../../lib/logger.js';
import { checkFormAccess, PermissionLevel } from './formSharing.js';

/**
 * Get field info from form schema
 */
const getFieldInfo = (
  formSchema: any,
  fieldId: string
): { type: FieldType; label: string } | null => {
  if (!formSchema.pages) return null;

  for (const page of formSchema.pages) {
    if (page.fields) {
      const field = page.fields.find((f: any) => f.id === fieldId);
      if (field) {
        return {
          type: field.type as FieldType,
          label: field.label || `Field ${fieldId}`,
        };
      }
    }
  }

  logger.info('❌ Field not found:', fieldId);
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
    fileUploadAnalytics: null,
  };

  // Add field-specific analytics based on type
  switch (analytics.fieldType) {
    case FieldType.TEXT_INPUT_FIELD:
    case FieldType.TEXT_AREA_FIELD:
    case FieldType.PHONE_NUMBER_FIELD:
      if ('averageLength' in analytics) {
        base.textAnalytics = {
          averageLength: analytics.averageLength,
          minLength: analytics.minLength,
          maxLength: analytics.maxLength,
          wordCloud: analytics.wordCloud,
          lengthDistribution: analytics.lengthDistribution,
          commonPhrases: analytics.commonPhrases,
          recentResponses: analytics.recentResponses.map((r) => ({
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

    case FieldType.FILE_UPLOAD_FIELD:
      if ('totalFilesUploaded' in analytics) {
        base.fileUploadAnalytics = {
          totalFilesUploaded: analytics.totalFilesUploaded,
          averageFilesPerResponse: analytics.averageFilesPerResponse,
          extensionDistribution: analytics.extensionDistribution,
          responsesWithFiles: analytics.responsesWithFiles,
          responsesWithoutFiles: analytics.responsesWithoutFiles,
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
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);

      // Check form access — uses comprehensive permission check (respects NO_ACCESS, sharing scopes)
      const accessResult = await checkFormAccess(context.auth.user!.id, formId, PermissionLevel.VIEWER);
      if (!accessResult.hasAccess) {
        throw createGraphQLError('Form not found or access denied', GRAPHQL_ERROR_CODES.FORBIDDEN);
      }
      const form = accessResult.form;

      logger.info(
        '🔍 Getting form schema from Hocuspocus collaborative document...'
      );

      // Get the proper form schema from YJS collaborative document
      const formSchemaFromHocuspocus =
        await getFormSchemaFromHocuspocus(formId);

      logger.info('📋 Hocuspocus schema structure:', {
        hasSchema: !!formSchemaFromHocuspocus,
        hasPages: !!formSchemaFromHocuspocus?.pages,
        pagesCount: formSchemaFromHocuspocus?.pages?.length || 0,
        firstPageFields:
          formSchemaFromHocuspocus?.pages?.[0]?.fields?.length || 0,
      });

      if (!formSchemaFromHocuspocus) {
        logger.info(
          '❌ No collaborative schema found, falling back to database schema'
        );

        // Fallback to database schema if collaborative document doesn't exist
        // Access already verified above — only fetching schema here
        const fallbackForm = await prisma.form.findUnique({
          where: { id: formId },
          select: { formSchema: true },
        });
        const fallbackSchema = fallbackForm?.formSchema as any;

        logger.info('📋 Fallback DB schema structure:', {
          hasFormSchema: !!fallbackSchema,
          hasPages: !!fallbackSchema?.pages,
          pagesCount: fallbackSchema?.pages?.length || 0,
          firstPageFields: fallbackSchema?.pages?.[0]?.fields?.length || 0,
        });

        if (!fallbackSchema) {
          throw createGraphQLError(
            'No form schema found in either collaborative document or database',
            GRAPHQL_ERROR_CODES.NOT_FOUND
          );
        }

        // Get field information from fallback schema
        const fieldInfo = getFieldInfo(fallbackSchema, fieldId);
        if (!fieldInfo) {
          throw createGraphQLError(
            `Field not found: ${fieldId}`,
            GRAPHQL_ERROR_CODES.NOT_FOUND
          );
        }
      } else {
        // Get field information from Hocuspocus schema
        const fieldInfo = getFieldInfo(formSchemaFromHocuspocus, fieldId);
        if (!fieldInfo) {
          throw createGraphQLError(
            `Field not found: ${fieldId}`,
            GRAPHQL_ERROR_CODES.NOT_FOUND
          );
        }
      }

      // Use the schema we found (prefer Hocuspocus over database)
      const activeSchema = formSchemaFromHocuspocus || (form.formSchema as any);
      const fieldInfo = getFieldInfo(activeSchema, fieldId);
      if (!fieldInfo) {
        throw createGraphQLError(
          `Field not found: ${fieldId}`,
          GRAPHQL_ERROR_CODES.NOT_FOUND
        );
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
        FieldType.PHONE_NUMBER_FIELD,
      ];

      if (!supportedTypes.includes(fieldInfo.type)) {
        throw createGraphQLError(
          `Analytics not supported for field type: ${fieldInfo.type}`,
          GRAPHQL_ERROR_CODES.UNSUPPORTED_FIELD_TYPE
        );
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
        logger.error('Error getting field analytics:', error);
        throw createGraphQLError(
          'Failed to get field analytics',
          GRAPHQL_ERROR_CODES.INTERNAL_SERVER_ERROR
        );
      }
    },

    /**
     * Get analytics for all fields in a form
     */
    allFieldsAnalytics: async (
      _: any,
      { formId }: { formId: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);

      // Check form access — uses comprehensive permission check (respects NO_ACCESS, sharing scopes)
      const accessResult = await checkFormAccess(context.auth.user!.id, formId, PermissionLevel.VIEWER);
      if (!accessResult.hasAccess) {
        throw createGraphQLError('Form not found or access denied', GRAPHQL_ERROR_CODES.FORBIDDEN);
      }

      try {
        const analytics = await getAllFieldsAnalytics(formId);

        return {
          formId: analytics.formId,
          totalResponses: analytics.totalResponses,
          fields: analytics.fields.map(transformAnalyticsToGraphQL),
        };
      } catch (error) {
        logger.error('Error getting all fields analytics:', error);
        throw createGraphQLError(
          'Failed to get all fields analytics',
          GRAPHQL_ERROR_CODES.INTERNAL_SERVER_ERROR
        );
      }
    },
  },
  Mutation: {},
};

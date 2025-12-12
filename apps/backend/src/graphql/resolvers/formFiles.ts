import { createGraphQLError, GraphQLError } from '#graphql-errors';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import { prisma } from '../../lib/prisma.js';
import { BetterAuthContext, requireAuth } from '../../middleware/better-auth-middleware.js';
import { checkFormAccess, PermissionLevel } from './formSharing.js';
import { logger } from '../../lib/logger.js';

export interface GetFormFilesArgs {
  formId: string;
  type?: string;
}

export const formFileResolvers = {
  Query: {
    getFormFiles: async (_: any, args: GetFormFilesArgs, context: { auth: BetterAuthContext }) => {
      try {
        // 🔒 SECURITY: Check if user is authenticated
        requireAuth(context.auth);

        const { formId, type } = args;

        // 🔒 SECURITY: Verify user has access to this form before showing files
        const accessCheck = await checkFormAccess(
          context.auth.user!.id,
          formId,
          PermissionLevel.VIEWER
        );
        if (!accessCheck.hasAccess) {
          throw createGraphQLError('Access denied: You do not have permission to view files for this form', GRAPHQL_ERROR_CODES.NO_ACCESS);
        }

        // Build where clause
        const where: any = { formId };
        if (type) {
          where.type = type;
        }

        // Fetch form files
        const formFiles = await prisma.formFile.findMany({
          where,
          orderBy: {
            createdAt: 'desc'
          }
        });

        return formFiles;
      } catch (error) {
        logger.error('Error in getFormFiles resolver:', error);
        if (error instanceof GraphQLError) {
          throw error;
        }
        throw createGraphQLError(`Failed to fetch form files: ${error instanceof Error ? error.message : 'Unknown error'}`, GRAPHQL_ERROR_CODES.INTERNAL_SERVER_ERROR);
      }
    },
  },
};
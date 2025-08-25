import { GraphQLError } from 'graphql';
import { prisma } from '../../lib/prisma.js';

export interface GetFormFilesArgs {
  formId: string;
  type?: string;
}

export const formFileResolvers = {
  Query: {
    getFormFiles: async (_: any, args: GetFormFilesArgs, context: any) => {
      try {
        // Check if user is authenticated
        // if (!context.user) {
        //   throw new GraphQLError('Authentication required');
        // }

        const { formId, type } = args;

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
        console.error('Error in getFormFiles resolver:', error);
        if (error instanceof GraphQLError) {
          throw error;
        }
        throw new GraphQLError(`Failed to fetch form files: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },
  },
};
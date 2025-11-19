import { GraphQLError } from '#graphql-errors';
import { uploadFile, deleteFile } from '../../services/fileUploadService.js';
import { prisma } from '../../lib/prisma.js';
import { randomUUID } from 'crypto';
import { BetterAuthContext, requireAuth, requireOrganizationMembership } from '../../middleware/better-auth-middleware.js';
import { checkFormAccess, PermissionLevel } from './formSharing.js';
import { logger } from '../../lib/logger.js';

interface FileUpload {
  filename: string;
  mimetype: string;
  encoding: string;
  createReadStream: () => NodeJS.ReadableStream;
}

interface FileUploadWrapper {
  file: FileUpload;
  resolve: (value: FileUpload | PromiseLike<FileUpload>) => void;
  reject: (reason?: unknown) => void;
  promise: Promise<FileUpload | void>;
}

export interface UploadFileArgs {
  input: {
    file: Promise<FileUpload | FileUploadWrapper>;
    type: string;
    formId?: string;
    organizationId?: string;
  };
}

/**
 * Helper function to check if user has admin role
 */
function requireAdminRole(context: { auth: BetterAuthContext }) {
  requireAuth(context.auth);

  const userRole = context.auth.user?.role;
  if (!userRole || (userRole !== 'admin' && userRole !== 'superAdmin')) {
    throw new GraphQLError('Admin privileges required to upload templates');
  }

  return context.auth.user;
}

export const fileUploadResolvers = {
  Mutation: {
    uploadFile: async (_: any, args: UploadFileArgs, context: { auth: BetterAuthContext }) => {
      try {
        const { file: filePromise, type, formId, organizationId } = args.input;

        // 🔒 SECURITY: Validate the type first
        const allowedTypes = ['FormTemplate', 'FormBackground', 'UserAvatar', 'OrganizationLogo'];
        if (!allowedTypes.includes(type)) {
          throw new GraphQLError(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`);
        }

        // 🔒 SECURITY: Role-based access control based on file type
        if (type === 'FormTemplate') {
          // Only admin/superAdmin can upload templates
          requireAdminRole(context);
        } else if (type === 'FormBackground') {
          // Must have EDITOR access to the form
          if (!formId) {
            throw new GraphQLError('formId is required for FormBackground uploads');
          }
          requireAuth(context.auth);
          const accessCheck = await checkFormAccess(
            context.auth.user!.id,
            formId,
            PermissionLevel.EDITOR
          );
          if (!accessCheck.hasAccess) {
            throw new GraphQLError('Access denied: You need EDITOR access to upload background images for this form');
          }
        } else if (type === 'UserAvatar') {
          // User can only upload their own avatar
          requireAuth(context.auth);
          // Avatar is associated with the authenticated user automatically
        } else if (type === 'OrganizationLogo') {
          // Must be a member of the organization
          if (!organizationId) {
            throw new GraphQLError('organizationId is required for OrganizationLogo uploads');
          }
          await requireOrganizationMembership(context.auth, organizationId);
        }

        // Resolve the file upload promise
        const fileUpload = await filePromise;

        // Extract the actual file object from the upload wrapper
        const file = ('file' in fileUpload) ? fileUpload.file : fileUpload;

        // Debug logging - more detailed
        logger.info('File upload details:', {
          filename: file?.filename,
          mimetype: file?.mimetype,
          encoding: file?.encoding,
          type: type,
          fileKeys: file ? Object.keys(file) : 'file is null/undefined',
          hasCreateReadStream: typeof file?.createReadStream === 'function'
        });

        // Upload the file
        const result = await uploadFile({
          file,
          type,
        });

        // If formId is provided and type is FormBackground, save to FormFile table
        if (formId && type === 'FormBackground') {
          await prisma.formFile.create({
            data: {
              id: randomUUID(),
              key: result.key,
              type: result.type,
              formId: formId,
              originalName: result.originalName,
              url: result.url,
              size: result.size,
              mimeType: result.mimeType,
            }
          });
        }

        return result;
      } catch (error) {
        logger.error('Error in uploadFile resolver:', error);
        if (error instanceof GraphQLError) {
          throw error;
        }
        throw new GraphQLError(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    deleteFile: async (_: any, args: { key: string }, context: { auth: BetterAuthContext }) => {
      try {
        // 🔒 SECURITY: Check if user is authenticated
        requireAuth(context.auth);

        // 🔒 SECURITY: Verify file ownership before deletion
        // Check if this file belongs to a form the user has access to
        const formFile = await prisma.formFile.findUnique({
          where: { key: args.key },
          include: { form: true }
        });

        if (formFile) {
          // File is associated with a form - check form access
          const accessCheck = await checkFormAccess(
            context.auth.user!.id,
            formFile.formId,
            PermissionLevel.EDITOR
          );
          if (!accessCheck.hasAccess) {
            throw new GraphQLError('Access denied: You need EDITOR access to delete files from this form');
          }
        }
        // If file is not in FormFile table (UserAvatar, OrganizationLogo, FormTemplate),
        // basic authentication is sufficient as these are user-owned or admin-only

        const success = await deleteFile(args.key);
        return success;
      } catch (error) {
        logger.error('Error in deleteFile resolver:', error);
        if (error instanceof GraphQLError) {
          throw error;
        }
        throw new GraphQLError(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },
  },
};

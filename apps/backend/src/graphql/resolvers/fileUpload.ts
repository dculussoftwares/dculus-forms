import { GraphQLError } from '#graphql-errors';
import { createGraphQLError } from '#graphql-errors';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import {
  uploadFile,
  deleteFile,
  generatePresignedDownloadUrl,
} from '../../services/fileUploadService.js';
import { prisma } from '../../lib/prisma.js';
import { randomUUID } from 'crypto';
import {
  BetterAuthContext,
  requireAuth,
  requireOrganizationMembership,
} from '../../middleware/better-auth-middleware.js';
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
  Query: {
    getResponseFileDownloadUrl: async (
      _: any,
      { key }: { key: string },
      context: { auth: BetterAuthContext }
    ) => {
      // Must be authenticated
      requireAuth(context.auth);

      // Key must match the expected pattern — prevents path traversal via crafted keys
      const KEY_PATTERN = /^files\/form-response\/([a-zA-Z0-9_-]+)\/[^/]+$/;
      const keyMatch = key.match(KEY_PATTERN);
      if (!keyMatch) {
        throw createGraphQLError(
          'Only form response files can be accessed via this endpoint',
          GRAPHQL_ERROR_CODES.BAD_USER_INPUT
        );
      }

      const formId = keyMatch[1];

      // Check that caller has at least VIEWER access to the form
      const accessCheck = await checkFormAccess(
        context.auth.user!.id,
        formId,
        PermissionLevel.VIEWER
      );
      if (!accessCheck.hasAccess) {
        throw createGraphQLError(
          'Access denied: You do not have permission to download files from this form',
          GRAPHQL_ERROR_CODES.FORBIDDEN
        );
      }

      return generatePresignedDownloadUrl(key);
    },
  },
  Mutation: {
    uploadFile: async (
      _: any,
      args: UploadFileArgs,
      context: { auth: BetterAuthContext }
    ) => {
      try {
        const { file: filePromise, type, formId, organizationId } = args.input;

        // 🔒 SECURITY: Validate the type first
        const allowedTypes = [
          'FormTemplate',
          'FormBackground',
          'UserAvatar',
          'OrganizationLogo',
          'FormResponse',
        ];
        if (!allowedTypes.includes(type)) {
          throw createGraphQLError(
            `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`,
            GRAPHQL_ERROR_CODES.BAD_USER_INPUT
          );
        }

        // 🔒 SECURITY: Role-based access control based on file type
        if (type === 'FormTemplate') {
          // Only admin/superAdmin can upload templates
          requireAdminRole(context);
        } else if (type === 'FormBackground') {
          // Must have EDITOR access to the form
          if (!formId) {
            throw createGraphQLError(
              'formId is required for FormBackground uploads',
              GRAPHQL_ERROR_CODES.BAD_USER_INPUT
            );
          }
          requireAuth(context.auth);
          const accessCheck = await checkFormAccess(
            context.auth.user!.id,
            formId,
            PermissionLevel.EDITOR
          );
          if (!accessCheck.hasAccess) {
            throw createGraphQLError(
              'Access denied: You need EDITOR access to upload background images for this form',
              GRAPHQL_ERROR_CODES.EDITOR_ACCESS_REQUIRED
            );
          }
        } else if (type === 'UserAvatar') {
          // User can only upload their own avatar
          requireAuth(context.auth);
          // Avatar is associated with the authenticated user automatically
        } else if (type === 'OrganizationLogo') {
          // Must be a member of the organization
          if (!organizationId) {
            throw createGraphQLError(
              'organizationId is required for OrganizationLogo uploads',
              GRAPHQL_ERROR_CODES.BAD_USER_INPUT
            );
          }
          await requireOrganizationMembership(context.auth, organizationId);
        } else if (type === 'FormResponse') {
          // Any authenticated user can upload files as part of a form response
          requireAuth(context.auth);
        }

        // Resolve the file upload promise
        const fileUpload = await filePromise;

        // Extract the actual file object from the upload wrapper
        const file = 'file' in fileUpload ? fileUpload.file : fileUpload;

        // Debug logging - more detailed
        logger.info('File upload details:', {
          filename: file?.filename,
          mimetype: file?.mimetype,
          encoding: file?.encoding,
          type: type,
          fileKeys: file ? Object.keys(file) : 'file is null/undefined',
          hasCreateReadStream: typeof file?.createReadStream === 'function',
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
            },
          });
        }

        return result;
      } catch (error) {
        logger.error('Error in uploadFile resolver:', error);
        if (error instanceof GraphQLError) {
          throw error;
        }
        throw createGraphQLError(
          `Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`,
          GRAPHQL_ERROR_CODES.UPLOAD_FAILED
        );
      }
    },

    deleteFile: async (
      _: any,
      args: { key: string },
      context: { auth: BetterAuthContext }
    ) => {
      try {
        // 🔒 SECURITY: Check if user is authenticated
        requireAuth(context.auth);

        // 🔒 SECURITY: Verify file ownership before deletion
        // Check if this file belongs to a form the user has access to
        const formFile = await prisma.formFile.findUnique({
          where: { key: args.key },
          include: { form: true },
        });

        const userId = context.auth.user!.id;

        if (formFile) {
          // File is associated with a form — requires EDITOR access
          const accessCheck = await checkFormAccess(userId, formFile.formId, PermissionLevel.EDITOR);
          if (!accessCheck.hasAccess) {
            throw createGraphQLError(
              'Access denied: You need EDITOR access to delete files from this form',
              GRAPHQL_ERROR_CODES.NO_ACCESS
            );
          }
        } else {
          // 🔒 SECURITY: Verify ownership for non-FormFile uploads.
          // User.image and Organization.logo store the S3 key directly — use them for lookup.
          const ownerUser = await prisma.user.findFirst({ where: { image: args.key }, select: { id: true } });
          if (ownerUser) {
            if (ownerUser.id !== userId) {
              throw createGraphQLError('Access denied: You can only delete your own avatar', GRAPHQL_ERROR_CODES.NO_ACCESS);
            }
          } else {
            const ownerOrg = await prisma.organization.findFirst({
              where: { logo: args.key },
              include: { members: { where: { userId }, select: { role: true } } },
            });
            if (ownerOrg) {
              if (ownerOrg.members.length === 0) {
                throw createGraphQLError('Access denied: You are not a member of this organization', GRAPHQL_ERROR_CODES.NO_ACCESS);
              }
            } else {
              // Key belongs to a FormTemplate or an untracked file — require admin role
              requireAdminRole(context);
            }
          }
        }

        const success = await deleteFile(args.key);
        return success;
      } catch (error) {
        logger.error('Error in deleteFile resolver:', error);
        if (error instanceof GraphQLError) {
          throw error;
        }
        throw createGraphQLError(
          `Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`,
          GRAPHQL_ERROR_CODES.INTERNAL_SERVER_ERROR
        );
      }
    },
  },
};

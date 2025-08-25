import { GraphQLError } from 'graphql';
import { uploadFile, deleteFile } from '../../services/fileUploadService';
import { prisma } from '../../lib/prisma';
import { randomUUID } from 'crypto';

interface FileUpload {
  filename: string;
  mimetype: string;
  encoding: string;
  createReadStream: () => NodeJS.ReadableStream;
}

interface FileUploadWrapper {
  file: FileUpload;
  resolve: Function;
  reject: Function;
  promise: Promise<any>;
}

export interface UploadFileArgs {
  input: {
    file: Promise<FileUpload | FileUploadWrapper>;
    type: string;
    formId?: string;
  };
}

export const fileUploadResolvers = {
  Mutation: {
    uploadFile: async (_: any, args: UploadFileArgs, context: any) => {
      try {
        // Check if user is authenticated
        // if (!context.user) {
        //   throw new GraphQLError('Authentication required');
        // }

        const { file: filePromise, type, formId } = args.input;
        
        // Resolve the file upload promise
        const fileUpload = await filePromise;
        
        // Extract the actual file object from the upload wrapper
        const file = ('file' in fileUpload) ? fileUpload.file : fileUpload;
        
        // Debug logging - more detailed
        console.log('File upload details:', {
          filename: file?.filename,
          mimetype: file?.mimetype,
          encoding: file?.encoding,
          type: type,
          fileKeys: file ? Object.keys(file) : 'file is null/undefined',
          hasCreateReadStream: typeof file?.createReadStream === 'function'
        });
        
        // Validate the type
        const allowedTypes = ['FormTemplate', 'FormBackground', 'UserAvatar', 'OrganizationLogo'];
        if (!allowedTypes.includes(type)) {
          throw new GraphQLError(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`);
        }

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
        console.error('Error in uploadFile resolver:', error);
        if (error instanceof GraphQLError) {
          throw error;
        }
        throw new GraphQLError(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    deleteFile: async (_: any, args: { key: string }, context: any) => {
      try {
        // Check if user is authenticated
        // if (!context.user) {
        //   throw new GraphQLError('Authentication required');
        // }

        const success = await deleteFile(args.key);
        return success;
      } catch (error) {
        console.error('Error in deleteFile resolver:', error);
        throw new GraphQLError(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },
  },
};

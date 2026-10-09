import { createGraphQLError } from '#graphql-errors';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import { BetterAuthContext, requireAuth } from '../../middleware/better-auth-middleware.js';
import { checkFormAccess, PermissionLevel } from './formSharing.js';
import type { ResponseFilter } from '../../services/responseFilterService.js';
import { collectResponseFiles, type ResponseFileQuery } from '../../services/responseFiles/responseFileCatalog.js';
import {
  createResponseFileExportDownload,
  getResponseFileExport,
  isExportExpired,
  MAX_EXPORT_FILES,
  startResponseFileExport,
} from '../../services/responseFiles/responseFileExportService.js';
import type { ResponseFileGrouping } from '../../services/responseFiles/zipLayout.js';

type PermissionLevelValue = (typeof PermissionLevel)[keyof typeof PermissionLevel];

export interface ResponseFileQueryArgs {
  formId: string;
  filters?: ResponseFilter[] | null;
  filterLogic?: 'AND' | 'OR' | null;
  responseIds?: string[] | null;
  fileKeys?: string[] | null;
}

// The Files view lists at most this many entries; counts and totals still cover everything.
const MAX_CATALOG_FILES = MAX_EXPORT_FILES;
// Bulk selection is bounded by the table's page size; this only guards abuse.
const MAX_RESPONSE_IDS = 1000;

const requireFormAccess = async (
  context: { auth: BetterAuthContext },
  formId: string,
  level: PermissionLevelValue,
  action: string
): Promise<string> => {
  requireAuth(context.auth);
  const userId = context.auth.user!.id;
  const { hasAccess } = await checkFormAccess(userId, formId, level);
  if (!hasAccess) {
    throw createGraphQLError(`Access denied: You need ${level} access to ${action}`, GRAPHQL_ERROR_CODES.NO_ACCESS);
  }
  return userId;
};

const toQuery = ({ filters, filterLogic, responseIds, fileKeys }: ResponseFileQueryArgs): ResponseFileQuery => {
  if ((responseIds?.length ?? 0) > MAX_RESPONSE_IDS || (fileKeys?.length ?? 0) > MAX_EXPORT_FILES) {
    throw createGraphQLError('Too many responses or files selected', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
  }
  return {
    filters: filters ?? undefined,
    filterLogic: filterLogic ?? 'AND',
    responseIds: responseIds ?? undefined,
    fileKeys: fileKeys ?? undefined,
  };
};

type ExportRow = Awaited<ReturnType<typeof getResponseFileExport>>;

const toGraphQLExport = (row: ExportRow) => ({
  id: row.id,
  formId: row.formId,
  status: row.status,
  grouping: row.grouping === 'response' ? 'RESPONSE' : 'QUESTION',
  totalCount: row.totalCount,
  processedCount: row.processedCount,
  totalBytes: Number(row.totalBytes),
  filename: row.filename,
  errorMessage: row.errorMessage,
  expired: isExportExpired(row),
  createdAt: row.createdAt.toISOString(),
  completedAt: row.completedAt?.toISOString() ?? null,
});

export const responseFilesResolvers = {
  Query: {
    /** Files view: every file of the live responses matching the table's filters. */
    responseFiles: async (_: unknown, args: ResponseFileQueryArgs, context: { auth: BetterAuthContext }) => {
      await requireFormAccess(context, args.formId, PermissionLevel.VIEWER, 'view files for this form');

      const { fields, files } = await collectResponseFiles(args.formId, toQuery(args));
      const countByField = new Map<string, number>();
      for (const file of files) countByField.set(file.fieldId, (countByField.get(file.fieldId) ?? 0) + 1);

      return {
        questions: fields.map((field) => ({
          fieldId: field.id,
          label: field.label,
          fileCount: countByField.get(field.id) ?? 0,
        })),
        files: files.slice(0, MAX_CATALOG_FILES).map((file) => ({
          ...file,
          submittedAt: file.submittedAt.toISOString(),
        })),
        totalCount: files.length,
        totalBytes: files.reduce((sum, file) => sum + (file.size ?? 0), 0),
        truncated: files.length > MAX_CATALOG_FILES,
      };
    },

    responseFileExport: async (_: unknown, { id }: { id: string }, context: { auth: BetterAuthContext }) => {
      requireAuth(context.auth);
      const row = await getResponseFileExport(id, context.auth.user!.id);
      // Someone whose access to the form was revoked must not keep seeing its export status.
      await requireFormAccess(context, row.formId, PermissionLevel.VIEWER, 'view this download');
      return toGraphQLExport(row);
    },
  },

  Mutation: {
    /** Bulk ZIP download: EDITOR, same bar as Excel/CSV export (VIEWER cannot bulk-export PII). */
    startResponseFileExport: async (
      _: unknown,
      args: ResponseFileQueryArgs & { grouping?: 'QUESTION' | 'RESPONSE' | null },
      context: { auth: BetterAuthContext }
    ) => {
      const userId = await requireFormAccess(context, args.formId, PermissionLevel.EDITOR, 'download files from this form');
      const grouping: ResponseFileGrouping = args.grouping === 'RESPONSE' ? 'response' : 'question';
      const row = await startResponseFileExport({ formId: args.formId, userId, grouping, query: toQuery(args) });
      return toGraphQLExport(row);
    },

    responseFileExportDownloadUrl: async (_: unknown, { id }: { id: string }, context: { auth: BetterAuthContext }) => {
      requireAuth(context.auth);
      const userId = context.auth.user!.id;
      const row = await getResponseFileExport(id, userId);
      // Re-checked at download time so revoked access also revokes finished exports.
      await requireFormAccess(context, row.formId, PermissionLevel.EDITOR, 'download files from this form');
      return createResponseFileExportDownload(id, userId);
    },
  },
};

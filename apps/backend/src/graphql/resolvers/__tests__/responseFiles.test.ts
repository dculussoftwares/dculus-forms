import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../middleware/better-auth-middleware.js');
vi.mock('../formSharing.js', () => ({
  checkFormAccess: vi.fn(),
  PermissionLevel: { OWNER: 'OWNER', EDITOR: 'EDITOR', VIEWER: 'VIEWER', NO_ACCESS: 'NO_ACCESS' },
}));
vi.mock('../../../services/responseFiles/responseFileCatalog.js', () => ({ collectResponseFiles: vi.fn() }));
vi.mock('../../../services/responseFiles/responseFileExportService.js', () => ({
  MAX_EXPORT_FILES: 5000,
  startResponseFileExport: vi.fn(),
  getResponseFileExport: vi.fn(),
  createResponseFileExportDownload: vi.fn(),
  isExportExpired: vi.fn(() => false),
}));

import * as betterAuthMiddleware from '../../../middleware/better-auth-middleware.js';
import { checkFormAccess } from '../formSharing.js';
import { collectResponseFiles } from '../../../services/responseFiles/responseFileCatalog.js';
import {
  createResponseFileExportDownload,
  getResponseFileExport,
  startResponseFileExport,
} from '../../../services/responseFiles/responseFileExportService.js';
import { responseFilesResolvers } from '../responseFiles.js';

const context = { auth: { user: { id: 'user-1' }, session: { id: 's' }, isAuthenticated: true } } as any;

const exportRow = {
  id: 'exp-1',
  formId: 'form-1',
  requestedById: 'user-1',
  status: 'running',
  grouping: 'response',
  totalCount: 3,
  processedCount: 1,
  totalBytes: BigInt(2048),
  fileKey: null,
  filename: 'f.zip',
  errorMessage: null,
  createdAt: new Date('2026-10-09T10:00:00Z'),
  updatedAt: new Date('2026-10-09T10:00:00Z'),
  completedAt: null,
};

const file = (fieldId: string, size: number | null) => ({
  key: `files/form-response/form-1/${fieldId}.pdf`,
  responseId: 'r1',
  submittedAt: new Date('2026-10-08T10:00:00Z'),
  respondentEmail: null,
  fieldId,
  fieldLabel: fieldId,
  fieldOrder: 0,
  originalName: `${fieldId}.pdf`,
  size,
  mimeType: 'application/pdf',
});

describe('responseFilesResolvers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(context.auth);
    vi.mocked(checkFormAccess).mockResolvedValue({ hasAccess: true } as any);
  });

  describe('responseFiles', () => {
    it('lets viewers browse files with per-question counts and totals', async () => {
      vi.mocked(collectResponseFiles).mockResolvedValue({
        fields: [
          { id: 'resume', label: 'Resume', order: 0 },
          { id: 'photo', label: 'Photo', order: 1 },
        ],
        files: [file('resume', 1000), file('resume', null)],
      });

      const result = await responseFilesResolvers.Query.responseFiles(
        null,
        { formId: 'form-1', filters: null, filterLogic: null, responseIds: null },
        context
      );

      expect(checkFormAccess).toHaveBeenCalledWith('user-1', 'form-1', 'VIEWER');
      expect(collectResponseFiles).toHaveBeenCalledWith('form-1', {
        filters: undefined,
        filterLogic: 'AND',
        responseIds: undefined,
        fileKeys: undefined,
      });
      expect(result.questions).toEqual([
        { fieldId: 'resume', label: 'Resume', fileCount: 2 },
        { fieldId: 'photo', label: 'Photo', fileCount: 0 },
      ]);
      expect(result).toMatchObject({ totalCount: 2, totalBytes: 1000, truncated: false });
      expect(result.files[0].submittedAt).toBe('2026-10-08T10:00:00.000Z');
    });

    it('denies people without access to the form', async () => {
      vi.mocked(checkFormAccess).mockResolvedValue({ hasAccess: false } as any);

      await expect(
        responseFilesResolvers.Query.responseFiles(null, { formId: 'form-1' }, context)
      ).rejects.toMatchObject({ extensions: { code: 'NO_ACCESS' } });
      expect(collectResponseFiles).not.toHaveBeenCalled();
    });

    it('caps the number of selected responses', async () => {
      await expect(
        responseFilesResolvers.Query.responseFiles(
          null,
          { formId: 'form-1', responseIds: Array.from({ length: 1001 }, (_, i) => `r${i}`) },
          context
        )
      ).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } });
    });
  });

  describe('exports', () => {
    it('requires EDITOR access to start a ZIP export', async () => {
      vi.mocked(startResponseFileExport).mockResolvedValue(exportRow as any);

      const result = await responseFilesResolvers.Mutation.startResponseFileExport(
        null,
        { formId: 'form-1', grouping: 'RESPONSE', responseIds: ['r1'], fileKeys: ['k1'] },
        context
      );

      expect(checkFormAccess).toHaveBeenCalledWith('user-1', 'form-1', 'EDITOR');
      expect(startResponseFileExport).toHaveBeenCalledWith({
        formId: 'form-1',
        userId: 'user-1',
        grouping: 'response',
        query: { filters: undefined, filterLogic: 'AND', responseIds: ['r1'], fileKeys: ['k1'] },
      });
      expect(result).toMatchObject({
        id: 'exp-1',
        grouping: 'RESPONSE',
        totalBytes: 2048,
        expired: false,
        createdAt: '2026-10-09T10:00:00.000Z',
        completedAt: null,
      });
    });

    it('blocks viewers from bulk exports', async () => {
      vi.mocked(checkFormAccess).mockResolvedValue({ hasAccess: false } as any);

      await expect(
        responseFilesResolvers.Mutation.startResponseFileExport(null, { formId: 'form-1' }, context)
      ).rejects.toMatchObject({ extensions: { code: 'NO_ACCESS' } });
      expect(startResponseFileExport).not.toHaveBeenCalled();
    });

    it('returns the requester’s export status', async () => {
      vi.mocked(getResponseFileExport).mockResolvedValue({ ...exportRow, grouping: 'question' } as any);

      const result = await responseFilesResolvers.Query.responseFileExport(null, { id: 'exp-1' }, context);

      expect(getResponseFileExport).toHaveBeenCalledWith('exp-1', 'user-1');
      expect(result.grouping).toBe('QUESTION');
    });

    it('re-checks EDITOR access before issuing a download link', async () => {
      vi.mocked(getResponseFileExport).mockResolvedValue(exportRow as any);
      vi.mocked(createResponseFileExportDownload).mockResolvedValue({
        downloadUrl: 'https://zip',
        filename: 'f.zip',
        expiresAt: 'later',
      });

      await expect(
        responseFilesResolvers.Mutation.responseFileExportDownloadUrl(null, { id: 'exp-1' }, context)
      ).resolves.toMatchObject({ downloadUrl: 'https://zip' });
      expect(checkFormAccess).toHaveBeenCalledWith('user-1', 'form-1', 'EDITOR');

      vi.mocked(checkFormAccess).mockResolvedValue({ hasAccess: false } as any);
      await expect(
        responseFilesResolvers.Mutation.responseFileExportDownloadUrl(null, { id: 'exp-1' }, context)
      ).rejects.toMatchObject({ extensions: { code: 'NO_ACCESS' } });
      expect(createResponseFileExportDownload).toHaveBeenCalledTimes(1);
    });
  });
});

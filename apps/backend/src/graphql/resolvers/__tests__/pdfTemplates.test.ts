import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pdfTemplatesResolvers } from '../pdfTemplates.js';
import * as betterAuthMiddleware from '../../../middleware/better-auth-middleware.js';
import * as formSharingResolvers from '../formSharing.js';
import { prisma } from '../../../lib/prisma.js';
import { generatePdfForResponse } from '../../../services/pdfTemplateService.js';

vi.mock('../../../middleware/better-auth-middleware.js');
vi.mock('../formSharing.js');
vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    pdfTemplate: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    response: {
      findUnique: vi.fn(),
    },
    form: {
      findUnique: vi.fn(),
    },
  },
}));
vi.mock('../../../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));
vi.mock('../../../services/fileUploadService.js', () => ({
  deleteFile: vi.fn(),
  generatePresignedDownloadUrl: vi.fn(),
}));
vi.mock('../../../services/pdfTemplateService.js', async () => {
  const actual = await vi.importActual<typeof import('../../../services/pdfTemplateService.js')>(
    '../../../services/pdfTemplateService.js'
  );
  return {
    ...actual,
    generatePdfForResponse: vi.fn(),
  };
});
vi.mock('@dculus/utils', async () => {
  const actual = await vi.importActual<typeof import('@dculus/utils')>('@dculus/utils');
  return {
    ...actual,
    generateId: vi.fn(() => 'generated-template-id'),
  };
});

const BLANK_A4 = { width: 210, height: 297, padding: [10, 10, 10, 10] as [number, number, number, number] };

describe('PDF Templates Resolvers', () => {
  const mockContext = {
    auth: {
      user: { id: 'user-123', email: 'test@example.com', name: 'Test User' },
      session: { id: 'session-123' },
      isAuthenticated: true,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Mutation: createPdfTemplate', () => {
    beforeEach(() => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth as any);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: true,
      } as any);
    });

    it('creates a blank-page template with no fileKey', async () => {
      vi.mocked(prisma.pdfTemplate.create).mockResolvedValue({ id: 'template-1' } as any);

      await pdfTemplatesResolvers.Mutation.createPdfTemplate(
        null,
        {
          input: {
            formId: 'form-123',
            name: 'Certificate',
            template: { basePdf: BLANK_A4, schemas: [[]] },
          },
        },
        mockContext as any
      );

      expect(prisma.pdfTemplate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ fileKey: null }),
        })
      );
    });

    it('accepts a fileKey issued for this form under the PdfTemplateAsset path', async () => {
      vi.mocked(prisma.pdfTemplate.create).mockResolvedValue({ id: 'template-2' } as any);

      await pdfTemplatesResolvers.Mutation.createPdfTemplate(
        null,
        {
          input: {
            formId: 'form-123',
            name: 'Certificate',
            template: { basePdf: null, schemas: [[]] },
            fileKey: 'files/pdf-template-asset/form-123/171-uuid-cert.pdf',
            fileName: 'cert.pdf',
          },
        },
        mockContext as any
      );

      expect(prisma.pdfTemplate.create).toHaveBeenCalled();
    });

    it('rejects a fileKey belonging to a different form (IDOR guard)', async () => {
      await expect(
        pdfTemplatesResolvers.Mutation.createPdfTemplate(
          null,
          {
            input: {
              formId: 'form-123',
              name: 'Certificate',
              template: { basePdf: null, schemas: [[]] },
              fileKey: 'files/pdf-template-asset/OTHER-FORM/171-uuid-cert.pdf',
            },
          },
          mockContext as any
        )
      ).rejects.toThrow(/Invalid fileKey/);

      expect(prisma.pdfTemplate.create).not.toHaveBeenCalled();
    });

    it('rejects a fileKey pointing at an unrelated upload path (e.g. FormResponse uploads)', async () => {
      await expect(
        pdfTemplatesResolvers.Mutation.createPdfTemplate(
          null,
          {
            input: {
              formId: 'form-123',
              name: 'Certificate',
              template: { basePdf: null, schemas: [[]] },
              fileKey: 'files/form-response/form-123/171-uuid-secret.pdf',
            },
          },
          mockContext as any
        )
      ).rejects.toThrow(/Invalid fileKey/);

      expect(prisma.pdfTemplate.create).not.toHaveBeenCalled();
    });
  });

  describe('Mutation: generatePdfFromResponse', () => {
    it('returns a generic error message without leaking internal exception details', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth as any);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: true,
      } as any);
      vi.mocked(prisma.pdfTemplate.findUnique).mockResolvedValue({
        id: 'template-1',
        formId: 'form-123',
        fileKey: null,
        template: { basePdf: BLANK_A4, schemas: [[]] },
        name: 'Certificate',
      } as any);
      vi.mocked(prisma.response.findUnique).mockResolvedValue({
        id: 'response-1',
        formId: 'form-123',
        deletedAt: null,
        data: {},
      } as any);
      vi.mocked(prisma.form.findUnique).mockResolvedValue({
        formSchema: { pages: [] },
      } as any);
      vi.mocked(generatePdfForResponse).mockRejectedValue(
        new Error('ENOENT: /private/r2/internal-bucket-path/leaked-secret-key.pdf')
      );

      await expect(
        pdfTemplatesResolvers.Mutation.generatePdfFromResponse(
          null,
          { templateId: 'template-1', responseId: 'response-1' },
          mockContext as any
        )
      ).rejects.toThrow('Failed to generate PDF');

      // The internal error detail must never reach the client
      await expect(
        pdfTemplatesResolvers.Mutation.generatePdfFromResponse(
          null,
          { templateId: 'template-1', responseId: 'response-1' },
          mockContext as any
        )
      ).rejects.not.toThrow(/leaked-secret-key/);
    });
  });
});

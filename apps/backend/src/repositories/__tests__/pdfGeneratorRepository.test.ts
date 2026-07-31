import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPdfGeneratorRepository } from '../pdfGeneratorRepository.js';

const prismaMock = vi.hoisted(() => ({
  pdfGenerator: {
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    count: vi.fn().mockResolvedValue(0),
  },
  pdfGenerationRun: {
    findFirst: vi.fn().mockResolvedValue(null),
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
  },
  pdfGenerationResult: {
    upsert: vi.fn().mockResolvedValue({}),
    findUnique: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../baseRepository.js', () => ({
  resolvePrisma: () => prismaMock,
}));

describe('pdfGeneratorRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.pdfGenerator.findMany.mockResolvedValue([]);
    prismaMock.pdfGenerator.findUnique.mockResolvedValue(null);
    prismaMock.pdfGenerator.create.mockResolvedValue({});
    prismaMock.pdfGenerator.update.mockResolvedValue({});
    prismaMock.pdfGenerator.delete.mockResolvedValue({});
    prismaMock.pdfGenerator.count.mockResolvedValue(0);
    prismaMock.pdfGenerationRun.findFirst.mockResolvedValue(null);
    prismaMock.pdfGenerationRun.findUnique.mockResolvedValue(null);
    prismaMock.pdfGenerationRun.create.mockResolvedValue({});
    prismaMock.pdfGenerationRun.update.mockResolvedValue({});
    prismaMock.pdfGenerationResult.upsert.mockResolvedValue({});
    prismaMock.pdfGenerationResult.findUnique.mockResolvedValue(null);
    prismaMock.pdfGenerationResult.findMany.mockResolvedValue([]);
  });

  it('proxies basic prisma delegate methods for PdfGenerator', async () => {
    const repo = createPdfGeneratorRepository();
    const args = { where: { id: 'generator-1' } };

    await repo.findMany(args as any);
    await repo.findUnique(args as any);
    await repo.create({ data: { id: 'generator-1' } } as any);
    await repo.update({ where: { id: 'generator-1' }, data: { name: 'New' } } as any);
    await repo.delete({ where: { id: 'generator-1' } } as any);
    await repo.count(args as any);

    expect(prismaMock.pdfGenerator.findMany).toHaveBeenCalledWith(args);
    expect(prismaMock.pdfGenerator.findUnique).toHaveBeenCalledWith(args);
    expect(prismaMock.pdfGenerator.create).toHaveBeenCalled();
    expect(prismaMock.pdfGenerator.update).toHaveBeenCalled();
    expect(prismaMock.pdfGenerator.delete).toHaveBeenCalled();
    expect(prismaMock.pdfGenerator.count).toHaveBeenCalledWith(args);
  });

  describe('PdfGenerator domain helpers', () => {
    it('findById looks up by id only', async () => {
      const repo = createPdfGeneratorRepository();
      await repo.findById('generator-1');
      expect(prismaMock.pdfGenerator.findUnique).toHaveBeenCalledWith({ where: { id: 'generator-1' } });
    });

    it('findByIdWithTemplate includes the template relation', async () => {
      const repo = createPdfGeneratorRepository();
      await repo.findByIdWithTemplate('generator-1');
      expect(prismaMock.pdfGenerator.findUnique).toHaveBeenCalledWith({
        where: { id: 'generator-1' },
        include: { template: true },
      });
    });

    it('listByForm orders by createdAt desc', async () => {
      const repo = createPdfGeneratorRepository();
      await repo.listByForm('form-1');
      expect(prismaMock.pdfGenerator.findMany).toHaveBeenCalledWith({
        where: { formId: 'form-1' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('countByForm scopes to formId', async () => {
      const repo = createPdfGeneratorRepository();
      await repo.countByForm('form-1');
      expect(prismaMock.pdfGenerator.count).toHaveBeenCalledWith({ where: { formId: 'form-1' } });
    });

    it('createGenerator / updateGenerator / deleteGenerator delegate correctly', async () => {
      const repo = createPdfGeneratorRepository();
      await repo.createGenerator({ id: 'generator-1' } as any);
      await repo.updateGenerator('generator-1', { name: 'Renamed' } as any);
      await repo.deleteGenerator('generator-1');

      expect(prismaMock.pdfGenerator.create).toHaveBeenCalledWith({ data: { id: 'generator-1' } });
      expect(prismaMock.pdfGenerator.update).toHaveBeenCalledWith({
        where: { id: 'generator-1' },
        data: { name: 'Renamed' },
      });
      expect(prismaMock.pdfGenerator.delete).toHaveBeenCalledWith({ where: { id: 'generator-1' } });
    });
  });

  describe('PdfGenerationRun domain helpers', () => {
    it('findRunById looks up by id only', async () => {
      const repo = createPdfGeneratorRepository();
      await repo.findRunById('run-1');
      expect(prismaMock.pdfGenerationRun.findUnique).toHaveBeenCalledWith({ where: { id: 'run-1' } });
    });

    it('findActiveRun scopes to running/cancelling statuses', async () => {
      const repo = createPdfGeneratorRepository();
      await repo.findActiveRun('generator-1');
      expect(prismaMock.pdfGenerationRun.findFirst).toHaveBeenCalledWith({
        where: { generatorId: 'generator-1', status: { in: ['running', 'cancelling'] } },
      });
    });

    it('findLatestRun orders by startedAt desc', async () => {
      const repo = createPdfGeneratorRepository();
      await repo.findLatestRun('generator-1');
      expect(prismaMock.pdfGenerationRun.findFirst).toHaveBeenCalledWith({
        where: { generatorId: 'generator-1' },
        orderBy: { startedAt: 'desc' },
      });
    });

    it('createRun delegates correctly', async () => {
      const repo = createPdfGeneratorRepository();
      await repo.createRun({ id: 'run-1' } as any);
      expect(prismaMock.pdfGenerationRun.create).toHaveBeenCalledWith({ data: { id: 'run-1' } });
    });

    it('updateRunStatus updates the run by id with arbitrary status-transition data', async () => {
      const repo = createPdfGeneratorRepository();
      await repo.updateRunStatus('run-1', { status: 'completed', completedAt: expect.any(Date) } as any);
      expect(prismaMock.pdfGenerationRun.update).toHaveBeenCalledWith({
        where: { id: 'run-1' },
        data: { status: 'completed', completedAt: expect.any(Date) },
      });
    });
  });

  describe('PdfGenerationResult domain helpers', () => {
    it('upsertResult upserts on the generatorId_responseId compound key', async () => {
      const repo = createPdfGeneratorRepository();
      await repo.upsertResult('generator-1', 'response-1', {
        create: { id: 'result-1', generatorId: 'generator-1', responseId: 'response-1', status: 'success' } as any,
        update: { status: 'success' } as any,
      });

      expect(prismaMock.pdfGenerationResult.upsert).toHaveBeenCalledWith({
        where: { generatorId_responseId: { generatorId: 'generator-1', responseId: 'response-1' } },
        create: { id: 'result-1', generatorId: 'generator-1', responseId: 'response-1', status: 'success' },
        update: { status: 'success' },
      });
    });

    it('findResult looks up by the compound key', async () => {
      const repo = createPdfGeneratorRepository();
      await repo.findResult('generator-1', 'response-1');
      expect(prismaMock.pdfGenerationResult.findUnique).toHaveBeenCalledWith({
        where: { generatorId_responseId: { generatorId: 'generator-1', responseId: 'response-1' } },
      });
    });

    it('listResultsByGenerator orders by generatedAt desc', async () => {
      const repo = createPdfGeneratorRepository();
      await repo.listResultsByGenerator('generator-1');
      expect(prismaMock.pdfGenerationResult.findMany).toHaveBeenCalledWith({
        where: { generatorId: 'generator-1' },
        orderBy: { generatedAt: 'desc' },
      });
    });

    it('listSuccessfulResultResponseIdsByGenerator selects only responseId', async () => {
      const repo = createPdfGeneratorRepository();
      await repo.listSuccessfulResultResponseIdsByGenerator('generator-1');
      expect(prismaMock.pdfGenerationResult.findMany).toHaveBeenCalledWith({
        where: { generatorId: 'generator-1', status: 'success' },
        select: { responseId: true },
      });
    });

    it('listDownloadableResultsByGenerator scopes to success + non-null fileKey', async () => {
      const repo = createPdfGeneratorRepository();
      await repo.listDownloadableResultsByGenerator('generator-1');
      expect(prismaMock.pdfGenerationResult.findMany).toHaveBeenCalledWith({
        where: { generatorId: 'generator-1', status: 'success', fileKey: { not: null } },
      });
    });

    it('listSuccessfulResultsByResponse scopes to responseId + success', async () => {
      const repo = createPdfGeneratorRepository();
      await repo.listSuccessfulResultsByResponse('response-1');
      expect(prismaMock.pdfGenerationResult.findMany).toHaveBeenCalledWith({
        where: { responseId: 'response-1', status: 'success' },
      });
    });
  });
});

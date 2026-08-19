import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createResponseGradeRepository } from '../responseGradeRepository.js';

const prismaMock = vi.hoisted(() => ({
  responseGrade: {
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    count: vi.fn().mockResolvedValue(0),
    upsert: vi.fn().mockResolvedValue({}),
    aggregate: vi.fn().mockResolvedValue({
      _avg: { percentage: null },
      _min: { percentage: null },
      _max: { percentage: null },
    }),
  },
}));

vi.mock('../baseRepository.js', () => ({
  resolvePrisma: () => prismaMock,
}));

describe('responseGradeRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.responseGrade.findMany.mockResolvedValue([]);
    prismaMock.responseGrade.findUnique.mockResolvedValue(null);
    prismaMock.responseGrade.create.mockResolvedValue({});
    prismaMock.responseGrade.update.mockResolvedValue({});
    prismaMock.responseGrade.delete.mockResolvedValue({});
    prismaMock.responseGrade.count.mockResolvedValue(0);
    prismaMock.responseGrade.upsert.mockResolvedValue({});
    prismaMock.responseGrade.aggregate.mockResolvedValue({
      _avg: { percentage: null },
      _min: { percentage: null },
      _max: { percentage: null },
    });
  });

  it('should proxy basic prisma delegate methods', async () => {
    const repo = createResponseGradeRepository();
    const args = { where: { id: 'grade-1' } };

    await repo.findMany(args);
    await repo.findUnique(args as any);
    await repo.create({ data: { id: 'grade-1' } } as any);
    await repo.update({ where: { id: 'grade-1' }, data: { score: 5 } } as any);
    await repo.delete({ where: { id: 'grade-1' } } as any);
    await repo.count(args as any);
    await repo.upsert({ where: { responseId: 'r1' }, create: {}, update: {} } as any);

    expect(prismaMock.responseGrade.findMany).toHaveBeenCalledWith(args);
    expect(prismaMock.responseGrade.findUnique).toHaveBeenCalledWith(args);
    expect(prismaMock.responseGrade.create).toHaveBeenCalled();
    expect(prismaMock.responseGrade.update).toHaveBeenCalled();
    expect(prismaMock.responseGrade.delete).toHaveBeenCalled();
    expect(prismaMock.responseGrade.count).toHaveBeenCalledWith(args);
    expect(prismaMock.responseGrade.upsert).toHaveBeenCalled();
  });

  it('should upsert a grade keyed by responseId', async () => {
    const repo = createResponseGradeRepository();
    const data = {
      formId: 'form-1',
      score: 8,
      maxScore: 10,
      percentage: 80,
      passed: true,
      status: 'AUTO_GRADED',
      autoScore: 8,
      detail: [],
    };

    await repo.upsertForResponse('response-1', data as any);

    expect(prismaMock.responseGrade.upsert).toHaveBeenCalledWith({
      where: { responseId: 'response-1' },
      create: { responseId: 'response-1', ...data },
      update: data,
    });
  });

  it('should find a grade by responseId', async () => {
    const repo = createResponseGradeRepository();

    await repo.findByResponseId('response-1');
    expect(prismaMock.responseGrade.findUnique).toHaveBeenCalledWith({
      where: { responseId: 'response-1' },
    });
  });

  it('should list grades for a form, most recently graded first by default', async () => {
    const repo = createResponseGradeRepository();

    await repo.findManyByFormId('form-1');
    expect(prismaMock.responseGrade.findMany).toHaveBeenCalledWith({
      where: { formId: 'form-1' },
      orderBy: { gradedAt: 'desc' },
    });

    await repo.findManyByFormId('form-1', { status: 'RELEASED' });
    expect(prismaMock.responseGrade.findMany).toHaveBeenCalledWith({
      where: { formId: 'form-1', status: 'RELEASED' },
      orderBy: { gradedAt: 'desc' },
    });
  });

  it('should count grades for a form by status', async () => {
    const repo = createResponseGradeRepository();
    prismaMock.responseGrade.count.mockResolvedValueOnce(3);

    const result = await repo.countByFormAndStatus('form-1', 'NEEDS_REVIEW');

    expect(result).toBe(3);
    expect(prismaMock.responseGrade.count).toHaveBeenCalledWith({
      where: { formId: 'form-1', status: 'NEEDS_REVIEW' },
    });
  });

  it('should aggregate percentage stats and pass/total counts for a form', async () => {
    const repo = createResponseGradeRepository();
    prismaMock.responseGrade.aggregate.mockResolvedValueOnce({
      _avg: { percentage: 75.5 },
      _min: { percentage: 40 },
      _max: { percentage: 100 },
    });
    prismaMock.responseGrade.count
      .mockResolvedValueOnce(6) // passedCount
      .mockResolvedValueOnce(10); // total

    const result = await repo.aggregateByForm('form-1');

    expect(result).toEqual({
      avgPercentage: 75.5,
      minPercentage: 40,
      maxPercentage: 100,
      passedCount: 6,
      total: 10,
    });
    expect(prismaMock.responseGrade.aggregate).toHaveBeenCalledWith({
      where: { formId: 'form-1' },
      _avg: { percentage: true },
      _min: { percentage: true },
      _max: { percentage: true },
    });
    expect(prismaMock.responseGrade.count).toHaveBeenNthCalledWith(1, {
      where: { formId: 'form-1', passed: true },
    });
    expect(prismaMock.responseGrade.count).toHaveBeenNthCalledWith(2, {
      where: { formId: 'form-1' },
    });
  });
});

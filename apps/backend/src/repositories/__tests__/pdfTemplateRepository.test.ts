import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPdfTemplateRepository } from '../pdfTemplateRepository.js';

const prismaMock = vi.hoisted(() => ({
  pdfTemplate: {
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    count: vi.fn().mockResolvedValue(0),
  },
}));

vi.mock('../baseRepository.js', () => ({
  resolvePrisma: () => prismaMock,
}));

describe('pdfTemplateRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.pdfTemplate.findMany.mockResolvedValue([]);
    prismaMock.pdfTemplate.findUnique.mockResolvedValue(null);
    prismaMock.pdfTemplate.create.mockResolvedValue({});
    prismaMock.pdfTemplate.update.mockResolvedValue({});
    prismaMock.pdfTemplate.delete.mockResolvedValue({});
    prismaMock.pdfTemplate.count.mockResolvedValue(0);
  });

  it('should proxy basic prisma delegate methods', async () => {
    const repo = createPdfTemplateRepository();
    const args = { where: { id: 'template-1' } };

    await repo.findMany(args as any);
    await repo.findUnique(args as any);
    await repo.create({ data: { id: 'template-1' } } as any);
    await repo.update({ where: { id: 'template-1' }, data: { name: 'New' } } as any);
    await repo.delete({ where: { id: 'template-1' } } as any);
    await repo.count(args as any);

    expect(prismaMock.pdfTemplate.findMany).toHaveBeenCalledWith(args);
    expect(prismaMock.pdfTemplate.findUnique).toHaveBeenCalledWith(args);
    expect(prismaMock.pdfTemplate.create).toHaveBeenCalled();
    expect(prismaMock.pdfTemplate.update).toHaveBeenCalled();
    expect(prismaMock.pdfTemplate.delete).toHaveBeenCalled();
    expect(prismaMock.pdfTemplate.count).toHaveBeenCalledWith(args);
  });

  it('should find a template by id', async () => {
    const repo = createPdfTemplateRepository();
    prismaMock.pdfTemplate.findUnique.mockResolvedValueOnce({ id: 'template-1' } as any);

    const result = await repo.findById('template-1');

    expect(prismaMock.pdfTemplate.findUnique).toHaveBeenCalledWith({ where: { id: 'template-1' } });
    expect(result).toEqual({ id: 'template-1' });
  });

  it('should list templates for a form, most recent first', async () => {
    const repo = createPdfTemplateRepository();
    prismaMock.pdfTemplate.findMany.mockResolvedValueOnce([{ id: 'template-1' }] as any);

    const result = await repo.listByForm('form-1');

    expect(prismaMock.pdfTemplate.findMany).toHaveBeenCalledWith({
      where: { formId: 'form-1' },
      orderBy: { createdAt: 'desc' },
    });
    expect(result).toEqual([{ id: 'template-1' }]);
  });

  it('should count templates for a form', async () => {
    const repo = createPdfTemplateRepository();
    prismaMock.pdfTemplate.count.mockResolvedValueOnce(3);

    const result = await repo.countByForm('form-1');

    expect(prismaMock.pdfTemplate.count).toHaveBeenCalledWith({ where: { formId: 'form-1' } });
    expect(result).toBe(3);
  });

  it('should create a template', async () => {
    const repo = createPdfTemplateRepository();
    const data = { id: 'template-1', formId: 'form-1', name: 'Test' };

    await repo.createTemplate(data as any);

    expect(prismaMock.pdfTemplate.create).toHaveBeenCalledWith({ data });
  });

  it('should update a template by id', async () => {
    const repo = createPdfTemplateRepository();
    const data = { name: 'Updated' };

    await repo.updateTemplate('template-1', data as any);

    expect(prismaMock.pdfTemplate.update).toHaveBeenCalledWith({
      where: { id: 'template-1' },
      data,
    });
  });

  it('should delete a template by id', async () => {
    const repo = createPdfTemplateRepository();

    await repo.deleteTemplate('template-1');

    expect(prismaMock.pdfTemplate.delete).toHaveBeenCalledWith({ where: { id: 'template-1' } });
  });
});

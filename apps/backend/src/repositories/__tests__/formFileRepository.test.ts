import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createFormFileRepository } from '../formFileRepository.js';

const prismaMock = vi.hoisted(() => ({
  formFile: {
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

describe('formFileRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.formFile.findMany.mockResolvedValue([]);
    prismaMock.formFile.findUnique.mockResolvedValue(null);
    prismaMock.formFile.create.mockResolvedValue({});
    prismaMock.formFile.update.mockResolvedValue({});
    prismaMock.formFile.delete.mockResolvedValue({});
    prismaMock.formFile.count.mockResolvedValue(0);
  });

  it('should proxy basic prisma delegate methods', async () => {
    const repo = createFormFileRepository();
    const args = { where: { id: 'file-1' } };

    await repo.findMany(args);
    await repo.findUnique(args as any);
    await repo.create({ data: { id: 'file-1' } } as any);
    await repo.update({ where: { id: 'file-1' }, data: { url: 'new-url' } } as any);
    await repo.delete({ where: { id: 'file-1' } } as any);
    await repo.count(args as any);

    expect(prismaMock.formFile.findMany).toHaveBeenCalledWith(args);
    expect(prismaMock.formFile.findUnique).toHaveBeenCalledWith(args);
    expect(prismaMock.formFile.create).toHaveBeenCalled();
    expect(prismaMock.formFile.update).toHaveBeenCalled();
    expect(prismaMock.formFile.delete).toHaveBeenCalled();
    expect(prismaMock.formFile.count).toHaveBeenCalledWith(args);
  });

  it('should list files for a form, most recent first', async () => {
    const repo = createFormFileRepository();

    await repo.listByFormId('form-1');
    expect(prismaMock.formFile.findMany).toHaveBeenCalledWith({
      where: { formId: 'form-1' },
      orderBy: { createdAt: 'desc' },
    });

    await repo.listByFormId('form-1', 'FormBackground');
    expect(prismaMock.formFile.findMany).toHaveBeenCalledWith({
      where: { formId: 'form-1', type: 'FormBackground' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('should find a file by id', async () => {
    const repo = createFormFileRepository();

    await repo.findById('file-1');
    expect(prismaMock.formFile.findUnique).toHaveBeenCalledWith({
      where: { id: 'file-1' },
    });
  });

  it('should create a form file', async () => {
    const repo = createFormFileRepository();

    await repo.createFormFile({ formId: 'form-1', key: 'file' } as any);
    expect(prismaMock.formFile.create).toHaveBeenCalledWith({
      data: { formId: 'form-1', key: 'file' },
    });
  });
});

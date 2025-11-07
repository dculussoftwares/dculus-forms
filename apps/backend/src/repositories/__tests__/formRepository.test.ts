import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createFormRepository } from '../formRepository.js';

const prismaMock = vi.hoisted(() => ({
  form: {
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    count: vi.fn().mockResolvedValue(0),
  },
  formPermission: {
    create: vi.fn().mockResolvedValue({}),
  },
  formFile: {
    create: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../baseRepository.js', () => ({
  resolvePrisma: () => prismaMock,
}));

describe('formRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.form.findMany.mockResolvedValue([]);
    prismaMock.form.findUnique.mockResolvedValue(null);
    prismaMock.form.create.mockResolvedValue({});
    prismaMock.form.update.mockResolvedValue({});
    prismaMock.form.delete.mockResolvedValue({});
    prismaMock.form.count.mockResolvedValue(0);
    prismaMock.formPermission.create.mockResolvedValue({});
    prismaMock.formFile.create.mockResolvedValue({});
  });

  it('should proxy basic prisma delegate methods', async () => {
    const repo = createFormRepository();
    const args = { where: { id: 'form-1' } };
    await repo.findMany(args);
    await repo.findUnique(args as any);
    await repo.create({ data: { id: 'form-1' } } as any);
    await repo.update({ where: { id: 'form-1' }, data: { title: 'New' } } as any);
    await repo.delete({ where: { id: 'form-1' } } as any);
    await repo.count(args as any);

    expect(prismaMock.form.findMany).toHaveBeenCalledWith(args);
    expect(prismaMock.form.findUnique).toHaveBeenCalledWith(args);
    expect(prismaMock.form.create).toHaveBeenCalled();
    expect(prismaMock.form.update).toHaveBeenCalled();
    expect(prismaMock.form.delete).toHaveBeenCalled();
    expect(prismaMock.form.count).toHaveBeenCalledWith(args);
  });

  it('should expose domain helpers with default includes', async () => {
    const repo = createFormRepository();
    prismaMock.form.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([] as any);
    prismaMock.form.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null as any);

    await repo.listByOrganization('org-1');
    await repo.listByOrganization();
    await repo.findById('form-1');
    await repo.findByShortUrl('short');
    await repo.createForm({ title: 'Test' } as any);
    await repo.updateForm('form-1', { title: 'Updated' } as any);
    await repo.deleteForm('form-1');
    await repo.createOwnerPermission({ formId: 'form-1' } as any);
    await repo.createFormAsset({ formId: 'form-1', key: 'file' } as any);

    expect(prismaMock.form.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1' },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      })
    );
    expect(prismaMock.form.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'form-1' },
        include: expect.any(Object),
      })
    );
    expect(prismaMock.form.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'form-1' },
        include: expect.any(Object),
      })
    );
    expect(prismaMock.formPermission.create).toHaveBeenCalledWith({ data: { formId: 'form-1' } });
    expect(prismaMock.formFile.create).toHaveBeenCalledWith({ data: { formId: 'form-1', key: 'file' } });
  });
});

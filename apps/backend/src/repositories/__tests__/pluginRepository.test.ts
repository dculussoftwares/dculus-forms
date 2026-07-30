import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPluginRepository } from '../pluginRepository.js';

const prismaMock = vi.hoisted(() => ({
  formPlugin: {
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    count: vi.fn().mockResolvedValue(0),
  },
  pluginDelivery: {
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({}),
  },
  pluginBackfillJob: {
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../baseRepository.js', () => ({
  resolvePrisma: () => prismaMock,
}));

describe('pluginRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.formPlugin.findMany.mockResolvedValue([]);
    prismaMock.formPlugin.findUnique.mockResolvedValue(null);
    prismaMock.formPlugin.create.mockResolvedValue({});
    prismaMock.formPlugin.update.mockResolvedValue({});
    prismaMock.formPlugin.delete.mockResolvedValue({});
    prismaMock.formPlugin.count.mockResolvedValue(0);
    prismaMock.pluginDelivery.findMany.mockResolvedValue([]);
    prismaMock.pluginDelivery.findUnique.mockResolvedValue(null);
    prismaMock.pluginDelivery.create.mockResolvedValue({});
    prismaMock.pluginBackfillJob.findMany.mockResolvedValue([]);
    prismaMock.pluginBackfillJob.findUnique.mockResolvedValue(null);
    prismaMock.pluginBackfillJob.create.mockResolvedValue({});
    prismaMock.pluginBackfillJob.update.mockResolvedValue({});
  });

  it('should proxy generic FormPlugin delegate methods', async () => {
    const repo = createPluginRepository();
    const args = { where: { id: 'plugin-1' } };

    await repo.findMany(args);
    await repo.findUnique(args as any);
    await repo.create({ data: { id: 'plugin-1' } } as any);
    await repo.update({ where: { id: 'plugin-1' }, data: { name: 'New' } } as any);
    await repo.delete({ where: { id: 'plugin-1' } } as any);
    await repo.count(args as any);

    expect(prismaMock.formPlugin.findMany).toHaveBeenCalledWith(args);
    expect(prismaMock.formPlugin.findUnique).toHaveBeenCalledWith(args);
    expect(prismaMock.formPlugin.create).toHaveBeenCalled();
    expect(prismaMock.formPlugin.update).toHaveBeenCalled();
    expect(prismaMock.formPlugin.delete).toHaveBeenCalled();
    expect(prismaMock.formPlugin.count).toHaveBeenCalledWith(args);
  });

  it('should expose FormPlugin domain helpers', async () => {
    const repo = createPluginRepository();

    await repo.listByForm('form-1');
    expect(prismaMock.formPlugin.findMany).toHaveBeenCalledWith({
      where: { formId: 'form-1' },
      orderBy: { createdAt: 'desc' },
    });

    await repo.listEnabledByForm('form-1');
    expect(prismaMock.formPlugin.findMany).toHaveBeenCalledWith({
      where: { formId: 'form-1', enabled: true },
      select: { id: true, type: true, config: true },
    });

    await repo.findById('plugin-1');
    expect(prismaMock.formPlugin.findUnique).toHaveBeenCalledWith({ where: { id: 'plugin-1' } });

    await repo.findByIdWithForm('plugin-1');
    expect(prismaMock.formPlugin.findUnique).toHaveBeenCalledWith({
      where: { id: 'plugin-1' },
      include: { form: true },
    });
  });

  it('should proxy PluginDelivery methods and domain helper', async () => {
    const repo = createPluginRepository();

    await repo.findManyDeliveries({ where: { pluginId: 'plugin-1' } } as any);
    expect(prismaMock.pluginDelivery.findMany).toHaveBeenCalledWith({ where: { pluginId: 'plugin-1' } });

    await repo.findUniqueDelivery({ where: { id: 'delivery-1' } } as any);
    expect(prismaMock.pluginDelivery.findUnique).toHaveBeenCalledWith({ where: { id: 'delivery-1' } });

    await repo.createDelivery({ data: { id: 'delivery-1' } } as any);
    expect(prismaMock.pluginDelivery.create).toHaveBeenCalledWith({ data: { id: 'delivery-1' } });

    await repo.listDeliveriesByPlugin('plugin-1', 25);
    expect(prismaMock.pluginDelivery.findMany).toHaveBeenCalledWith({
      where: { pluginId: 'plugin-1' },
      orderBy: { deliveredAt: 'desc' },
      take: 25,
    });

    await repo.listDeliveriesByPlugin('plugin-1');
    expect(prismaMock.pluginDelivery.findMany).toHaveBeenCalledWith({
      where: { pluginId: 'plugin-1' },
      orderBy: { deliveredAt: 'desc' },
      take: 50,
    });
  });

  it('should proxy PluginBackfillJob methods and domain helper', async () => {
    const repo = createPluginRepository();

    await repo.findManyBackfillJobs({ where: { pluginId: 'plugin-1' } } as any);
    expect(prismaMock.pluginBackfillJob.findMany).toHaveBeenCalledWith({ where: { pluginId: 'plugin-1' } });

    await repo.findUniqueBackfillJob({ where: { id: 'job-1' } } as any);
    expect(prismaMock.pluginBackfillJob.findUnique).toHaveBeenCalledWith({ where: { id: 'job-1' } });

    await repo.createBackfillJob({ data: { id: 'job-1' } } as any);
    expect(prismaMock.pluginBackfillJob.create).toHaveBeenCalledWith({ data: { id: 'job-1' } });

    await repo.updateBackfillJob({ where: { id: 'job-1' }, data: { status: 'completed' } } as any);
    expect(prismaMock.pluginBackfillJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { status: 'completed' },
    });

    await repo.findBackfillJobById('job-1');
    expect(prismaMock.pluginBackfillJob.findUnique).toHaveBeenCalledWith({ where: { id: 'job-1' } });
  });
});

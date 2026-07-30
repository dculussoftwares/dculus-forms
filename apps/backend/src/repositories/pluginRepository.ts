import type { Prisma } from '#prisma-client';
import { resolvePrisma, type RepositoryContext } from './baseRepository.js';

/**
 * Factory for all plugin related data access (FormPlugin, PluginDelivery,
 * PluginBackfillJob). Covers the plugin *CRUD* surface only — the plugin
 * *execution* system (registry, executor, event emitter, per-type handlers)
 * lives under `plugins/` and is out of scope here.
 */
export const createPluginRepository = (context?: RepositoryContext) => {
  const prisma = resolvePrisma(context);

  /** --- FormPlugin: generic delegate passthroughs --- */
  const findMany = <T extends Prisma.FormPluginFindManyArgs>(
    args?: Prisma.SelectSubset<T, Prisma.FormPluginFindManyArgs>
  ) => prisma.formPlugin.findMany(args);

  const findUnique = <T extends Prisma.FormPluginFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.FormPluginFindUniqueArgs>
  ) => prisma.formPlugin.findUnique(args);

  const create = <T extends Prisma.FormPluginCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.FormPluginCreateArgs>
  ) => prisma.formPlugin.create(args);

  const update = <T extends Prisma.FormPluginUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.FormPluginUpdateArgs>
  ) => prisma.formPlugin.update(args);

  const remove = <T extends Prisma.FormPluginDeleteArgs>(
    args: Prisma.SelectSubset<T, Prisma.FormPluginDeleteArgs>
  ) => prisma.formPlugin.delete(args);

  const count = <T extends Prisma.FormPluginCountArgs>(
    args?: Prisma.SelectSubset<T, Prisma.FormPluginCountArgs>
  ) => prisma.formPlugin.count(args);

  /** --- FormPlugin: domain-oriented helpers --- */
  const listByForm = async (formId: string) =>
    prisma.formPlugin.findMany({
      where: { formId },
      orderBy: { createdAt: 'desc' },
    });

  const listEnabledByForm = async (formId: string) =>
    prisma.formPlugin.findMany({
      where: { formId, enabled: true },
      select: { id: true, type: true, config: true },
    });

  const findById = async (id: string) =>
    prisma.formPlugin.findUnique({ where: { id } });

  const findByIdWithForm = async (id: string) =>
    prisma.formPlugin.findUnique({ where: { id }, include: { form: true } });

  /** --- PluginDelivery: generic delegate passthroughs --- */
  const findManyDeliveries = <T extends Prisma.PluginDeliveryFindManyArgs>(
    args?: Prisma.SelectSubset<T, Prisma.PluginDeliveryFindManyArgs>
  ) => prisma.pluginDelivery.findMany(args);

  const findUniqueDelivery = <T extends Prisma.PluginDeliveryFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.PluginDeliveryFindUniqueArgs>
  ) => prisma.pluginDelivery.findUnique(args);

  const createDelivery = <T extends Prisma.PluginDeliveryCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.PluginDeliveryCreateArgs>
  ) => prisma.pluginDelivery.create(args);

  /** --- PluginDelivery: domain-oriented helpers --- */
  const listDeliveriesByPlugin = async (pluginId: string, limit = 50) =>
    prisma.pluginDelivery.findMany({
      where: { pluginId },
      orderBy: { deliveredAt: 'desc' },
      take: limit,
    });

  /** --- PluginBackfillJob: generic delegate passthroughs --- */
  const findManyBackfillJobs = <T extends Prisma.PluginBackfillJobFindManyArgs>(
    args?: Prisma.SelectSubset<T, Prisma.PluginBackfillJobFindManyArgs>
  ) => prisma.pluginBackfillJob.findMany(args);

  const findUniqueBackfillJob = <T extends Prisma.PluginBackfillJobFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.PluginBackfillJobFindUniqueArgs>
  ) => prisma.pluginBackfillJob.findUnique(args);

  const createBackfillJob = <T extends Prisma.PluginBackfillJobCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.PluginBackfillJobCreateArgs>
  ) => prisma.pluginBackfillJob.create(args);

  const updateBackfillJob = <T extends Prisma.PluginBackfillJobUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.PluginBackfillJobUpdateArgs>
  ) => prisma.pluginBackfillJob.update(args);

  /** --- PluginBackfillJob: domain-oriented helpers --- */
  const findBackfillJobById = async (id: string) =>
    prisma.pluginBackfillJob.findUnique({ where: { id } });

  return {
    // FormPlugin: generic operations
    findMany,
    findUnique,
    create,
    update,
    delete: remove,
    count,

    // FormPlugin: domain helpers
    listByForm,
    listEnabledByForm,
    findById,
    findByIdWithForm,

    // PluginDelivery
    findManyDeliveries,
    findUniqueDelivery,
    createDelivery,
    listDeliveriesByPlugin,

    // PluginBackfillJob
    findManyBackfillJobs,
    findUniqueBackfillJob,
    createBackfillJob,
    updateBackfillJob,
    findBackfillJobById,
  };
};

export type PluginRepository = ReturnType<typeof createPluginRepository>;

export const pluginRepository = createPluginRepository();

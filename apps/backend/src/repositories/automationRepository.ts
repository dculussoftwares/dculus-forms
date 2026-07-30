import { Prisma } from '#prisma-client';
import { resolvePrisma, type RepositoryContext } from './baseRepository.js';

const ACTIVE_RUN_STATUSES = ['RUNNING', 'WAITING'] as const;

/**
 * Factory for Automation / AutomationRun / AutomationStepRun data access.
 * Covers both the CRUD side (automations.ts resolver) and the execution-hot-path
 * side (services/automation/engine.ts, triggerService.ts).
 */
export const createAutomationRepository = (context?: RepositoryContext) => {
  const prisma = resolvePrisma(context);

  /** --- Generic delegate passthroughs (Automation) --- */
  const findMany = <T extends Prisma.AutomationFindManyArgs>(
    args?: Prisma.SelectSubset<T, Prisma.AutomationFindManyArgs>
  ) => prisma.automation.findMany(args);

  const findUnique = <T extends Prisma.AutomationFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.AutomationFindUniqueArgs>
  ) => prisma.automation.findUnique(args);

  const create = <T extends Prisma.AutomationCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.AutomationCreateArgs>
  ) => prisma.automation.create(args);

  const update = <T extends Prisma.AutomationUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.AutomationUpdateArgs>
  ) => prisma.automation.update(args);

  const remove = <T extends Prisma.AutomationDeleteArgs>(
    args: Prisma.SelectSubset<T, Prisma.AutomationDeleteArgs>
  ) => prisma.automation.delete(args);

  const count = <T extends Prisma.AutomationCountArgs>(
    args?: Prisma.SelectSubset<T, Prisma.AutomationCountArgs>
  ) => prisma.automation.count(args);

  /** --- Domain helpers: Automation --- */
  const findById = async (id: string) => prisma.automation.findUnique({ where: { id } });

  const listByFormId = async (formId: string) =>
    prisma.automation.findMany({
      where: { formId },
      orderBy: { createdAt: 'desc' },
    });

  const listActiveByFormAndTrigger = async (formId: string, triggerType: string) =>
    prisma.automation.findMany({
      where: { formId, status: 'ACTIVE', triggerType },
    });

  const createAutomation = async (data: Prisma.AutomationCreateArgs['data']) =>
    prisma.automation.create({ data });

  const updateAutomation = async (id: string, data: Prisma.AutomationUpdateArgs['data']) =>
    prisma.automation.update({ where: { id }, data });

  const deleteAutomation = async (id: string) => prisma.automation.delete({ where: { id } });

  /** --- Domain helpers: AutomationRun --- */
  const findRunById = async (id: string) => prisma.automationRun.findUnique({ where: { id } });

  const findRunByIdWithAutomation = async (id: string) =>
    prisma.automationRun.findUnique({ where: { id }, include: { automation: true } });

  const listRunsByAutomation = async (
    automationId: string,
    { limit, offset }: { limit?: number; offset?: number } = {}
  ) =>
    prisma.automationRun.findMany({
      where: { automationId },
      orderBy: { startedAt: 'desc' },
      take: limit ?? 50,
      skip: offset ?? 0,
    });

  /** Ids of runs still able to be cancelled (RUNNING/WAITING) for a given automation. */
  const listActiveRunsByAutomation = async (automationId: string) =>
    prisma.automationRun.findMany({
      where: { automationId, status: { in: [...ACTIVE_RUN_STATUSES] } },
      select: { id: true },
    });

  const createRun = async (data: Prisma.AutomationRunCreateArgs['data']) =>
    prisma.automationRun.create({ data });

  const updateRun = async (id: string, data: Prisma.AutomationRunUpdateArgs['data']) =>
    prisma.automationRun.update({ where: { id }, data });

  /** Marks the given run ids CANCELLED unconditionally (caller has already snapshotted them). */
  const cancelRunsByIds = async (ids: string[]) =>
    prisma.automationRun.updateMany({
      where: { id: { in: ids } },
      data: { status: 'CANCELLED', completedAt: new Date() },
    });

  /**
   * Marks a single run CANCELLED only if it is still RUNNING/WAITING — a TOCTOU-safe guard
   * against a run reaching a terminal state concurrently. Returns the number of rows matched.
   */
  const cancelRunIfActive = async (id: string) =>
    prisma.automationRun.updateMany({
      where: { id, status: { in: [...ACTIVE_RUN_STATUSES] } },
      data: { status: 'CANCELLED', completedAt: new Date() },
    });

  /** --- Domain helpers: AutomationStepRun --- */
  const listStepRunsByRun = async (runId: string) =>
    prisma.automationStepRun.findMany({
      where: { runId },
      orderBy: { startedAt: 'asc' },
    });

  const createStepRun = async (data: Prisma.AutomationStepRunCreateArgs['data']) =>
    prisma.automationStepRun.create({ data });

  const findSuccessStepRun = async (runId: string, nodeId: string) =>
    prisma.automationStepRun.findFirst({ where: { runId, nodeId, status: 'SUCCESS' } });

  const findStepRunByNode = async (runId: string, nodeId: string) =>
    prisma.automationStepRun.findFirst({ where: { runId, nodeId } });

  /**
   * Atomically replaces one node's `data.config` inside a `{ nodes: [...], edges: [...] }`
   * JSON column, leaving every other node untouched. `SET column = jsonb_set(column, ...)`
   * re-reads the row's latest *committed* value at execution time, so concurrent writes
   * targeting different nodes in the same graph correctly compose.
   */
  const setNodeConfigInGraph = async (
    automationId: string,
    nodeId: string,
    config: Prisma.InputJsonValue
  ) =>
    prisma.$executeRaw(Prisma.sql`
      UPDATE ${Prisma.raw('"automation"')}
      SET ${Prisma.raw('"graph"')} = jsonb_set(
        ${Prisma.raw('"graph"')},
        '{nodes}',
        (
          SELECT COALESCE(jsonb_agg(
            CASE WHEN elem->>'id' = ${nodeId}
              THEN jsonb_set(elem, '{data,config}', ${JSON.stringify(config)}::jsonb, true)
              ELSE elem
            END
          ), '[]'::jsonb)
          FROM jsonb_array_elements(${Prisma.raw('"graph"')}->'nodes') AS elem
        )
      )
      WHERE id = ${automationId}
    `);

  /** Same as {@link setNodeConfigInGraph}, scoped to a single run's frozen `graphSnapshot`. */
  const setNodeConfigInRunSnapshot = async (
    runId: string,
    nodeId: string,
    config: Prisma.InputJsonValue
  ) =>
    prisma.$executeRaw(Prisma.sql`
      UPDATE ${Prisma.raw('"automation_run"')}
      SET ${Prisma.raw('"graphSnapshot"')} = jsonb_set(
        ${Prisma.raw('"graphSnapshot"')},
        '{nodes}',
        (
          SELECT COALESCE(jsonb_agg(
            CASE WHEN elem->>'id' = ${nodeId}
              THEN jsonb_set(elem, '{data,config}', ${JSON.stringify(config)}::jsonb, true)
              ELSE elem
            END
          ), '[]'::jsonb)
          FROM jsonb_array_elements(${Prisma.raw('"graphSnapshot"')}->'nodes') AS elem
        )
      )
      WHERE id = ${runId}
    `);

  return {
    // Generic operations (Automation)
    findMany,
    findUnique,
    create,
    update,
    delete: remove,
    count,

    // Domain helpers (Automation)
    findById,
    listByFormId,
    listActiveByFormAndTrigger,
    createAutomation,
    updateAutomation,
    deleteAutomation,

    // Domain helpers (AutomationRun)
    findRunById,
    findRunByIdWithAutomation,
    listRunsByAutomation,
    listActiveRunsByAutomation,
    createRun,
    updateRun,
    cancelRunsByIds,
    cancelRunIfActive,

    // Domain helpers (AutomationStepRun)
    listStepRunsByRun,
    createStepRun,
    findSuccessStepRun,
    findStepRunByNode,

    // Transaction-participating raw writes (see engine.ts updateAutomationNodeConfig)
    setNodeConfigInGraph,
    setNodeConfigInRunSnapshot,
  };
};

export type AutomationRepository = ReturnType<typeof createAutomationRepository>;

export const automationRepository = createAutomationRepository();

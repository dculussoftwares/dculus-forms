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

  /**
   * Moves a schedule automation's digest watermark forward to `until` (the upper bound of the
   * window that was just fully processed). Replaces the previous "most recent COMPLETED run"
   * derivation, which a test run or a partially-delivered batch could advance past responses
   * nothing had actually handled.
   *
   * `updateMany` with the lt/null guard rather than `update`: two runs of the same automation can
   * settle out of order (a retried step finishing after a later tick), and the watermark must
   * never move backwards — a backwards move would re-process, and re-deliver, an already-sent
   * window. A no-op when the stored value is already at or past `until`.
   */
  const advanceDigestWatermark = async (automationId: string, until: Date) =>
    prisma.automation.updateMany({
      where: {
        id: automationId,
        OR: [{ lastDigestedAt: null }, { lastDigestedAt: { lt: until } }],
      },
      data: { lastDigestedAt: until },
    });

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

  /**
   * A step run for this node that already ran to a non-retryable conclusion — the redelivery
   * guard in engine.ts's executeAutomationStep. Deliberately broader than SUCCESS: a PARTIAL
   * (some deliveries in a batch failed) or SKIPPED (nothing to deliver, or the org's email quota
   * was reached) step also already executed its handler, and re-running it on a redelivered job
   * would re-send to everyone the first attempt reached. FAILED is excluded — that is precisely
   * the case retries exist for.
   */
  const findExecutedStepRun = async (runId: string, nodeId: string) =>
    prisma.automationStepRun.findFirst({
      where: { runId, nodeId, status: { in: ['SUCCESS', 'PARTIAL', 'SKIPPED'] } },
    });

  /**
   * The status/nodeType of every step in a run that did not cleanly succeed. A run has a handful
   * of steps, so this is cheaper than several counting queries — and it lets the engine apply the
   * two rules it needs (what the run's terminal status is, and whether the digest watermark may
   * advance) in one readable place rather than encoding both in SQL. See engine.ts's completeRun.
   */
  const listUnsuccessfulStepRuns = async (runId: string) =>
    prisma.automationStepRun.findMany({
      where: { runId, status: { not: 'SUCCESS' } },
      select: { status: true, nodeType: true },
    });

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
    advanceDigestWatermark,
    cancelRunsByIds,
    cancelRunIfActive,

    // Domain helpers (AutomationStepRun)
    listStepRunsByRun,
    createStepRun,
    findExecutedStepRun,
    listUnsuccessfulStepRuns,
    findStepRunByNode,

    // Transaction-participating raw writes (see engine.ts updateAutomationNodeConfig)
    setNodeConfigInGraph,
    setNodeConfigInRunSnapshot,
  };
};

export type AutomationRepository = ReturnType<typeof createAutomationRepository>;

export const automationRepository = createAutomationRepository();

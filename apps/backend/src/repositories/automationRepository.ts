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

  /**
   * Takes a transaction-scoped advisory lock naming this automation's scheduled tick, returning
   * false when another worker already holds it.
   *
   * The overlap guard in triggerService checks for an in-flight run and then creates one; without
   * a lock, two workers can both pass that check before either writes, and both start processing
   * the same digest window. pg-boss makes that rare — one job per tick, claimed with SKIP LOCKED —
   * but not impossible: a batch that outlives the job's visibility timeout is redelivered while
   * the first worker is still going, which is precisely the long-running case this guard exists
   * for.
   *
   * `pg_try_advisory_xact_lock` rather than a row lock or unique index because the thing being
   * serialised is "processing a tick for this automation", which has no single row to lock — and
   * because a unique index on active runs would wrongly forbid the concurrent runs that
   * form.submitted automations create legitimately, one per submission. The lock releases with the
   * transaction, so a crashed worker cannot wedge an automation.
   *
   * `hashtextextended` (64-bit), NOT `hashtext` (32-bit): the advisory lock namespace is global
   * across every automation in the database, and two ids colliding would make one automation's
   * tick see the other's lock and skip. That skip is silent by design — a worker that loses the
   * claim records nothing, since the winner is expected to decide — so a collision would drop
   * ticks with no trace at all. 32 bits puts the birthday bound around 65k automations, which is a
   * reachable number; 64 bits moves it past 4 billion.
   */
  const tryLockScheduledTick = async (automationId: string): Promise<boolean> => {
    const rows = await prisma.$queryRaw<Array<{ locked: boolean }>>(
      Prisma.sql`SELECT pg_try_advisory_xact_lock(hashtextextended(${`automation-tick:${automationId}`}, 0)) AS locked`
    );
    return rows[0]?.locked === true;
  };

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
   * Claims a FAILED run for a retry by flipping it to RUNNING, but only while it is still FAILED —
   * the same TOCTOU-safe shape as cancelRunIfActive below, and for the same reason. Two retry
   * requests arriving together would otherwise both read FAILED, both pass the check, and both
   * enqueue the failed node, executing the action twice. Making the transition itself the guard
   * means exactly one caller can win. Returns the number of rows matched.
   */
  const claimFailedRunForRetry = async (id: string, nodeId: string) =>
    prisma.automationRun.updateMany({
      where: { id, status: 'FAILED' },
      data: { status: 'RUNNING', completedAt: null, currentNodeId: nodeId },
    });

  /**
   * Undoes a retry claim, putting the run back to FAILED so it can be retried again. Guarded on
   * the run still being RUNNING so it can never overwrite an outcome the engine reached in the
   * meantime. Returns the number of rows matched.
   */
  const releaseRetryClaim = async (id: string) =>
    prisma.automationRun.updateMany({
      where: { id, status: 'RUNNING' },
      data: { status: 'FAILED', completedAt: new Date() },
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
   * Every step row in a run, as `(nodeId, nodeType, status)`.
   *
   * Deliberately returns *all* rows, including successes: a retried node has one row per attempt,
   * so the failed first attempt of a node that later succeeded is only distinguishable from a
   * genuine failure by seeing both rows. A run has a handful of steps, so one small query beats
   * encoding that reasoning in SQL — the engine resolves each node to a single outcome in
   * completeRun.
   */
  const listStepOutcomes = async (runId: string) =>
    prisma.automationStepRun.findMany({
      where: { runId },
      select: { nodeId: true, nodeType: true, status: true },
    });

  const findStepRunByNode = async (runId: string, nodeId: string) =>
    prisma.automationStepRun.findFirst({ where: { runId, nodeId } });

  /**
   * The step a FAILED run died on — where a retry (gap H) resumes from. Newest first, because a
   * retried run accumulates one row per attempt and the last failure is the one still outstanding.
   */
  const findLatestFailedStepRun = async (runId: string) =>
    prisma.automationStepRun.findFirst({
      where: { runId, status: 'FAILED' },
      orderBy: { startedAt: 'desc' },
    });

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
    tryLockScheduledTick,
    updateRun,
    advanceDigestWatermark,
    claimFailedRunForRetry,
    releaseRetryClaim,
    cancelRunsByIds,
    cancelRunIfActive,

    // Domain helpers (AutomationStepRun)
    listStepRunsByRun,
    createStepRun,
    findExecutedStepRun,
    listStepOutcomes,
    findStepRunByNode,
    findLatestFailedStepRun,

    // Transaction-participating raw writes (see engine.ts updateAutomationNodeConfig)
    setNodeConfigInGraph,
    setNodeConfigInRunSnapshot,
  };
};

export type AutomationRepository = ReturnType<typeof createAutomationRepository>;

export const automationRepository = createAutomationRepository();

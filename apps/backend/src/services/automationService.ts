import { createGraphQLError } from '#graphql-errors';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import { generateId } from '@dculus/utils';
import { automationRepository, responseRepository } from '../repositories/index.js';
import { getAvailablePluginTypes } from '../plugins/core/registry.js';
import { validateAutomationGraph } from './automation/graphValidator.js';
import { enqueueFirstStep, enqueueRunStep } from './automation/engine.js';
import {
  cancelRunsForAutomation,
  cancelSingleAutomationRun,
  scheduleAutomationCron,
  unscheduleAutomationCron,
} from './automation/triggerService.js';
import { isValidCronExpression, isValidTimezone } from './automation/cronValidator.js';
import { isAutomationEngineEnabled } from './automation/boss.js';
import { AUTOMATION_TEMPLATE_IDS, getAutomationTemplate } from './automation/templates.js';
import { copyAutomation } from './automation/copyAutomation.js';
import type { AutomationGraph, AutomationRunContext } from './automation/types.js';

/**
 * CRUD + orchestration service for the Automations system (#195). Distinct from
 * `services/automation/engine.ts` (the execution engine) and `triggerService.ts`
 * (trigger-time run creation) — this file owns list/get/create/update/delete for
 * `Automation` records plus run/step-run reads, backing the automations.ts resolver.
 */

const AUTOMATION_STATUSES = ['DRAFT', 'ACTIVE', 'PAUSED'] as const;
const TRIGGER_TYPES = ['form.submitted', 'response.edited', 'schedule'] as const;

/**
 * Validates `triggerConfig` for a `schedule`-triggerType automation on save/activate (#201) —
 * cron is required, must parse as a standard 5-field expression, and an optional timezone must
 * be a real IANA identifier.
 */
function assertValidScheduleTriggerConfig(
  triggerConfig: any
): asserts triggerConfig is { cron: string; timezone?: string } {
  if (!triggerConfig || typeof triggerConfig !== 'object') {
    throw createGraphQLError(
      'Scheduled automations require a triggerConfig with a cron expression',
      GRAPHQL_ERROR_CODES.BAD_USER_INPUT
    );
  }
  if (!isValidCronExpression(triggerConfig.cron)) {
    throw createGraphQLError(
      `Invalid cron expression: ${triggerConfig.cron}`,
      GRAPHQL_ERROR_CODES.BAD_USER_INPUT
    );
  }
  if (triggerConfig.timezone !== undefined && !isValidTimezone(triggerConfig.timezone)) {
    throw createGraphQLError(
      `Invalid timezone: ${triggerConfig.timezone}`,
      GRAPHQL_ERROR_CODES.BAD_USER_INPUT
    );
  }
}

/**
 * DRAFT default graph for a brand-new automation: a single trigger wired to a single end.
 * A `schedule` trigger fires with no triggering response, so an empty graph (`trigger → end`)
 * would run on its cron and do nothing — the `end` handler is a pure no-op. To avoid shipping
 * a schedule that silently never sends anything, default it to `trigger → digest → end`, with
 * the digest ("Filter Responses") node pre-inserted exactly as `AddStepEdge` would insert it.
 */
function buildDefaultGraph(triggerType: string): AutomationGraph {
  const triggerId = generateId();
  const endId = generateId();

  if (triggerType === 'schedule') {
    const digestId = generateId();
    return {
      nodes: [
        { id: triggerId, type: 'trigger', data: { triggerType } },
        { id: digestId, type: 'digest', data: {} },
        { id: endId, type: 'end' },
      ],
      edges: [
        { id: generateId(), source: triggerId, target: digestId },
        { id: generateId(), source: digestId, target: endId },
      ],
    };
  }

  return {
    nodes: [
      { id: triggerId, type: 'trigger', data: { triggerType } },
      { id: endId, type: 'end' },
    ],
    edges: [{ id: generateId(), source: triggerId, target: endId }],
  };
}

export async function getAutomationById(id: string) {
  const automation = await automationRepository.findById(id);
  if (!automation) {
    throw createGraphQLError('Automation not found', GRAPHQL_ERROR_CODES.AUTOMATION_NOT_FOUND);
  }
  return automation;
}

export async function listAutomationsByForm(formId: string) {
  return automationRepository.listByFormId(formId);
}

export async function createAutomation(params: {
  formId: string;
  organizationId: string;
  name: string;
  triggerType: string;
  createdBy: string;
  /** Starter graph to begin from (gap I). Its own triggerType wins over the `triggerType` arg. */
  template?: string;
}) {
  const { formId, organizationId, name, createdBy } = params;

  if (!name || name.trim().length === 0) {
    throw createGraphQLError('Automation name is required', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
  }

  // A template dictates its own trigger — a follow-up email only makes sense on a submission, a
  // digest only on a schedule — so it takes precedence over whatever the dialog last had selected.
  const template = params.template ? getAutomationTemplate(params.template) : undefined;
  if (params.template && !template) {
    throw createGraphQLError(
      `Unknown automation template: ${params.template}. Available: ${AUTOMATION_TEMPLATE_IDS.join(', ')}`,
      GRAPHQL_ERROR_CODES.BAD_USER_INPUT
    );
  }

  const triggerType = template?.triggerType ?? params.triggerType;
  if (!TRIGGER_TYPES.includes(triggerType as (typeof TRIGGER_TYPES)[number])) {
    throw createGraphQLError(
      `Invalid trigger type: ${triggerType}. Supported types: ${TRIGGER_TYPES.join(', ')}`,
      GRAPHQL_ERROR_CODES.BAD_USER_INPUT
    );
  }

  return automationRepository.createAutomation({
    id: generateId(),
    formId,
    organizationId,
    name,
    status: 'DRAFT',
    triggerType,
    graph: (template ? template.buildGraph() : buildDefaultGraph(triggerType)) as any,
    version: 1,
    createdBy,
  });
}

/**
 * Duplicates one automation within its own form (gap I) — the cheapest way to build a variant of a
 * flow that already works. Always lands as a DRAFT with integration bindings stripped, so it can
 * never start double-delivering alongside the original the moment it is created.
 */
export async function duplicateAutomation(
  automation: {
    id: string;
    name: string;
    formId: string;
    organizationId: string;
    triggerType: string;
    triggerConfig: unknown;
    graph: unknown;
  },
  createdBy: string
) {
  return copyAutomation(automation, automation.formId, createdBy, `${automation.name} (Copy)`);
}

/**
 * Updates name/graph/triggerConfig on an already-fetched `automation` record. Validates the
 * graph against the same bar as activation when the automation is already ACTIVE (an active
 * automation is already live, so a new graph must not bypass activation-time rules such as the
 * schedule automation response-dependent-node ban), and re-schedules the cron immediately when
 * an ACTIVE schedule automation's triggerConfig changes.
 */
export async function updateAutomation(
  automation: { id: string; status: string; triggerType: string; graph: unknown },
  updates: { name?: string; graph?: any; triggerConfig?: any }
) {
  const { name, graph, triggerConfig } = updates;
  const data: Record<string, any> = { updatedAt: new Date() };

  if (name !== undefined) data.name = name;
  if (triggerConfig !== undefined) {
    if (automation.triggerType === 'schedule') {
      assertValidScheduleTriggerConfig(triggerConfig);
    }
    data.triggerConfig = triggerConfig;
  }
  if (graph !== undefined) {
    if (automation.status === 'ACTIVE') {
      const result = validateAutomationGraph(graph, {
        pluginTypes: getAvailablePluginTypes(),
        triggerType: automation.triggerType,
      });
      if (!result.valid) {
        throw createGraphQLError(
          'Automation graph is invalid and cannot be saved while this automation is active',
          GRAPHQL_ERROR_CODES.AUTOMATION_INVALID_GRAPH,
          { extensions: { validationErrors: result.errors } }
        );
      }
    }

    data.graph = graph;
    const graphChanged = JSON.stringify(graph) !== JSON.stringify(automation.graph);
    if (graphChanged) {
      data.version = { increment: 1 };
    }
  }

  const updated = await automationRepository.updateAutomation(automation.id, data);

  // Re-schedule immediately so an ACTIVE scheduled automation picks up a new cron/timezone
  // without requiring pause+reactivate — boss.schedule upserts by (queue, key).
  if (automation.triggerType === 'schedule' && triggerConfig !== undefined && updated.status === 'ACTIVE') {
    await scheduleAutomationCron(updated.id, triggerConfig.cron, triggerConfig.timezone);
  }

  return updated;
}

/**
 * Watermark seeded into `Automation.lastDigestedAt` when a schedule automation with a digest node
 * is activated for the first time.
 *
 * Without this, a digest node's first tick has no lower bound and matches the form's entire
 * history — so switching on a "weekly digest" against a form with thousands of existing responses
 * processes all of them at once, and with a per-response email action emails every one of those
 * respondents. Defaulting the window to "from activation onwards" makes the first run mean what
 * users read it to mean; a node that genuinely wants the backfill opts in via
 * `includeExistingResponses`, which leaves the watermark unset.
 *
 * Only ever seeds a watermark that is still null, so pausing and reactivating never rewinds or
 * skips the window an already-running automation was working through.
 */
function resolveActivationDigestWatermark(automation: {
  triggerType: string;
  graph: unknown;
  lastDigestedAt?: Date | null;
}): Date | null {
  if (automation.triggerType !== 'schedule' || automation.lastDigestedAt) return null;

  const nodes = (automation.graph as { nodes?: Array<{ type?: string; data?: any }> })?.nodes ?? [];
  const digestNode = nodes.find((node) => node?.type === 'digest');
  if (!digestNode) return null;
  if (digestNode.data?.includeExistingResponses === true) return null;

  return new Date();
}

export async function setAutomationStatus(
  automation: {
    id: string;
    triggerType: string;
    graph: unknown;
    triggerConfig: unknown;
    lastDigestedAt?: Date | null;
  },
  status: string
) {
  if (!AUTOMATION_STATUSES.includes(status as (typeof AUTOMATION_STATUSES)[number])) {
    throw createGraphQLError(
      `Invalid status: ${status}. Supported statuses: ${AUTOMATION_STATUSES.join(', ')}`,
      GRAPHQL_ERROR_CODES.BAD_USER_INPUT
    );
  }

  if (status === 'ACTIVE') {
    const result = validateAutomationGraph(automation.graph, {
      pluginTypes: getAvailablePluginTypes(),
      triggerType: automation.triggerType,
    });
    if (!result.valid) {
      throw createGraphQLError(
        'Automation graph is invalid and cannot be activated',
        GRAPHQL_ERROR_CODES.AUTOMATION_INVALID_GRAPH,
        { extensions: { validationErrors: result.errors } }
      );
    }
    if (automation.triggerType === 'schedule') {
      assertValidScheduleTriggerConfig(automation.triggerConfig);
    }
  }

  const digestWatermark = status === 'ACTIVE' ? resolveActivationDigestWatermark(automation) : null;

  const updated = await automationRepository.updateAutomation(automation.id, {
    status,
    updatedAt: new Date(),
    ...(digestWatermark ? { lastDigestedAt: digestWatermark } : {}),
  });

  // Schedule/unschedule lifecycle (#201) — boss.schedule upserts, boss.unschedule is a
  // no-op if nothing is scheduled, so this is safe regardless of prior state.
  if (automation.triggerType === 'schedule') {
    if (status === 'ACTIVE') {
      const { cron, timezone } = automation.triggerConfig as { cron: string; timezone?: string };
      await scheduleAutomationCron(automation.id, cron, timezone);
    } else {
      await unscheduleAutomationCron(automation.id);
    }
  }

  return updated;
}

export async function deleteAutomation(automation: { id: string; triggerType: string }) {
  if (automation.triggerType === 'schedule') {
    await unscheduleAutomationCron(automation.id);
  }
  await cancelRunsForAutomation(automation.id, 'automation deleted');
  await automationRepository.deleteAutomation(automation.id);
  return true;
}

/**
 * Starts a test run: a real run through the real graph, made safe rather than simulated. The
 * engine fast-forwards delays, executes actions regardless of the automation's DRAFT/PAUSED
 * status (so an automation can be rehearsed before it ever goes live), redirects email deliveries
 * to `testUserEmail` instead of real respondents, samples rather than drains a digest node's
 * window, and never advances the digest watermark.
 *
 * `testUserEmail` is where every email action in this run is redirected. It is threaded through
 * the run context rather than resolved in the engine because only the resolver knows who pressed
 * the button; without it the engine skips email deliveries instead of guessing.
 */
export async function testAutomation(
  automation: {
    id: string;
    formId: string;
    version: number;
    graph: unknown;
    triggerType: string;
  },
  responseId?: string,
  testUserEmail?: string
) {
  // A schedule automation has no triggering response by design — its digest node is what supplies
  // data, and graphValidator rejects response-dependent steps on it. Demanding a response here
  // made schedule automations untestable on a form that had none, and injected response data into
  // a triggerData that every downstream step is validated to treat as empty.
  if (automation.triggerType === 'schedule') {
    const context: AutomationRunContext = {
      test: true,
      testUserEmail,
      triggerData: {},
      trigger: { scheduledAt: new Date().toISOString() },
    };

    const run = await automationRepository.createRun({
      id: generateId(),
      automationId: automation.id,
      responseId: null,
      automationVersion: automation.version,
      graphSnapshot: automation.graph as any,
      status: 'RUNNING',
      context: context as any,
    });

    await enqueueFirstStep(run);

    return run;
  }

  const response = responseId
    ? await responseRepository.findFirst({
        where: { id: responseId, formId: automation.formId, deletedAt: null },
      })
    : await responseRepository.findFirst({
        where: { formId: automation.formId, deletedAt: null },
        orderBy: { submittedAt: 'desc' },
      });

  if (!response) {
    throw createGraphQLError(
      'No response available to test this automation with',
      GRAPHQL_ERROR_CODES.RESPONSE_NOT_FOUND
    );
  }

  const context: AutomationRunContext = {
    test: true,
    testUserEmail,
    triggerData: {
      ...(response.data as Record<string, any>),
      responseId: response.id,
      submittedAt: response.submittedAt.toISOString(),
      isPreview: false,
    },
  };

  const run = await automationRepository.createRun({
    id: generateId(),
    automationId: automation.id,
    responseId: response.id,
    automationVersion: automation.version,
    graphSnapshot: automation.graph as any,
    status: 'RUNNING',
    context: context as any,
  });

  await enqueueFirstStep(run);

  return run;
}

export async function listAutomationRuns(
  automationId: string,
  limit?: number,
  offset?: number
) {
  return automationRepository.listRunsByAutomation(automationId, { limit, offset });
}

export async function getAutomationRunWithAutomation(id: string) {
  const run = await automationRepository.findRunByIdWithAutomation(id);
  if (!run) {
    throw createGraphQLError('Automation run not found', GRAPHQL_ERROR_CODES.NOT_FOUND);
  }
  return run;
}

export async function cancelAutomationRun(runId: string) {
  const cancelled = await cancelSingleAutomationRun(runId);
  if (!cancelled) {
    throw createGraphQLError('Automation run not found', GRAPHQL_ERROR_CODES.NOT_FOUND);
  }
  return cancelled;
}

export async function listStepRuns(runId: string) {
  return automationRepository.listStepRunsByRun(runId);
}

/**
 * Resumes a FAILED run from the step it died on (gap H).
 *
 * Resumes rather than re-runs: the graph snapshot records exactly which steps already succeeded,
 * and re-running from the trigger would deliver every one of them a second time. Only the failed
 * node is re-enqueued, and the redelivery guard treats the surviving SUCCESS rows as done.
 *
 * Before re-enqueueing, the failed node's config is refreshed from the automation's live graph.
 * Retries are most often triggered by a fix — a corrected webhook URL, a reconnected integration —
 * and replaying the frozen config would fail again for the same reason. Only that one node's
 * config moves; the rest of the snapshot stays frozen, so the graph this run executes is still the
 * one it started with. (`setNodeConfigInRunSnapshot` is the same mechanism a handler already uses
 * to persist an auto-created spreadsheet id back into a running snapshot.)
 */
export async function retryAutomationRun(runId: string) {
  const run = await automationRepository.findRunByIdWithAutomation(runId);
  if (!run) {
    throw createGraphQLError('Automation run not found', GRAPHQL_ERROR_CODES.NOT_FOUND);
  }

  if (run.status !== 'FAILED') {
    throw createGraphQLError(
      `Only failed runs can be retried — this run is ${run.status}`,
      GRAPHQL_ERROR_CODES.BAD_USER_INPUT
    );
  }

  const isTest = ((run.context as AutomationRunContext) ?? {}).test === true;
  // A real run's action nodes refuse to execute unless the automation is ACTIVE, so retrying a
  // paused automation would just cancel the run at the first action. Say so up front instead of
  // letting the user discover it from a second dead run.
  if (!isTest && run.automation.status !== 'ACTIVE') {
    throw createGraphQLError(
      `Activate this automation before retrying — it is currently ${run.automation.status}`,
      GRAPHQL_ERROR_CODES.BAD_USER_INPUT
    );
  }

  // Checked BEFORE the claim below, not after. With the engine off, enqueueRunStep logs a warning
  // and returns without throwing — so a retry would flip the run to RUNNING, queue nothing, and
  // report success. The run would then be stuck: it can never be retried again (retry requires
  // FAILED), and on a schedule automation the overlap guard would read it as in-flight and block
  // every future tick.
  if (!isAutomationEngineEnabled()) {
    throw createGraphQLError(
      'The automation engine is not running, so this run cannot be retried right now',
      GRAPHQL_ERROR_CODES.BAD_USER_INPUT
    );
  }

  const failedStep = await automationRepository.findLatestFailedStepRun(runId);
  if (!failedStep) {
    throw createGraphQLError(
      'This run has no failed step to retry from',
      GRAPHQL_ERROR_CODES.BAD_USER_INPUT
    );
  }

  const liveNode = ((run.automation.graph as unknown as AutomationGraph)?.nodes ?? []).find(
    (node) => node.id === failedStep.nodeId
  );
  if (liveNode?.type === 'action') {
    await automationRepository.setNodeConfigInRunSnapshot(
      runId,
      failedStep.nodeId,
      (liveNode.data?.config ?? {}) as any
    );
  }

  // The FAILED -> RUNNING transition IS the guard. Two retry requests arriving together would
  // otherwise both have read FAILED above, both pass that check, and both enqueue the same node —
  // executing the action twice. The idempotency key does not save us here: both enqueued steps
  // carry the same `runId:nodeId`, and nothing on our side stores it.
  const { count } = await automationRepository.claimFailedRunForRetry(runId, failedStep.nodeId);
  if (count === 0) {
    throw createGraphQLError(
      'This run is already being retried',
      GRAPHQL_ERROR_CODES.BAD_USER_INPUT
    );
  }

  // Everything after the claim is inside the rollback, the re-read included. The status flip has
  // already committed, so ANY failure from here on would otherwise leave the run RUNNING with no
  // queued work — unretryable (retry needs FAILED), and read as in-flight by the schedule overlap
  // guard. Putting it back to FAILED means the user can simply try again.
  try {
    // Re-read so the snapshot carries the config refresh above.
    const resumed = await automationRepository.findRunById(runId);
    if (!resumed) {
      throw createGraphQLError('Automation run not found', GRAPHQL_ERROR_CODES.NOT_FOUND);
    }

    await enqueueRunStep(resumed, failedStep.nodeId);

    return resumed;
  } catch (error) {
    await automationRepository.releaseRetryClaim(runId);
    throw error;
  }
}

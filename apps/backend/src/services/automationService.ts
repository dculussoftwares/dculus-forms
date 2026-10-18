import { createGraphQLError } from '#graphql-errors';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import { generateId } from '@dculus/utils';
import { Prisma } from '#prisma-client';
import { automationRepository, responseRepository } from '../repositories/index.js';
import { getAvailablePluginTypes } from '../plugins/core/registry.js';
import { validateAutomationGraph, type GraphValidationError } from './automation/graphValidator.js';
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
import { carrySheetColumnsInGraph } from '../plugins/core/sheetColumns.js';
import { audit } from '../lib/audit.js';
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
    draftGraph?: unknown;
    draftTriggerConfig?: unknown;
  },
  createdBy: string
) {
  // Copy what the author sees in the builder, not the (possibly older) published version.
  return copyAutomation(
    {
      ...automation,
      graph: effectiveGraph(automation),
      triggerConfig: effectiveTriggerConfig(automation),
    },
    automation.formId,
    createdBy,
    `${automation.name} (Copy)`
  );
}

/** Autosaved drafts above this serialized size are rejected, as a guard against runaway payloads. */
const MAX_DRAFT_BYTES = 512 * 1024;

interface DraftAwareAutomation {
  id: string;
  status: string;
  triggerType: string;
  graph: unknown;
  triggerConfig: unknown;
  version: number;
  draftGraph?: unknown;
  draftTriggerConfig?: unknown;
  draftRevision?: number;
  draftUpdatedAt?: Date | null;
  draftUpdatedById?: string | null;
  lastDigestedAt?: Date | null;
}

const effectiveGraph = (automation: { graph: unknown; draftGraph?: unknown }) =>
  automation.draftGraph ?? automation.graph;

const effectiveTriggerConfig = (automation: { triggerConfig: unknown; draftTriggerConfig?: unknown }) =>
  automation.draftTriggerConfig ?? automation.triggerConfig ?? null;

/**
 * JSON.stringify with sorted object keys. Postgres JSONB does not preserve key order, so a graph
 * read back from the database would never compare equal to the same graph from the client.
 */
function stableStringify(value: unknown): string {
  return JSON.stringify(value ?? null, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v
  );
}

/**
 * The builder serializes every node with a `data` object, while server-built graphs (the default
 * `end` node) may omit it. Treat the two as equal, or a draft identical to the live graph would
 * never normalise back to "no unpublished changes" and the first publish would bump the version
 * for no semantic change.
 */
function comparableGraph(graph: unknown): unknown {
  const nodes = (graph as { nodes?: unknown })?.nodes;
  if (!Array.isArray(nodes)) return graph;
  return { ...(graph as object), nodes: nodes.map((node) => ({ ...node, data: node?.data ?? {} })) };
}

const isGraphShape = (graph: unknown): graph is AutomationGraph =>
  !!graph &&
  typeof graph === 'object' &&
  Array.isArray((graph as AutomationGraph).nodes) &&
  Array.isArray((graph as AutomationGraph).edges);

/** Everything that would stop this graph + trigger config from being published or activated. */
function collectPublishIssues(graph: unknown, triggerConfig: unknown, triggerType: string): GraphValidationError[] {
  const result = validateAutomationGraph(graph, {
    pluginTypes: getAvailablePluginTypes(),
    triggerType,
  });
  const issues = [...(result?.errors ?? [])];

  if (triggerType === 'schedule') {
    const config = triggerConfig as { cron?: string; timezone?: string } | null;
    if (!config || typeof config !== 'object' || !isValidCronExpression(config.cron as string)) {
      issues.push({ code: 'INVALID_TRIGGER_CONFIG', message: 'Set up a valid schedule for this automation.' });
    } else if (config.timezone !== undefined && !isValidTimezone(config.timezone)) {
      issues.push({ code: 'INVALID_TRIGGER_CONFIG', message: `Invalid timezone: ${config.timezone}` });
    }
  }

  return issues;
}

/** A failed compare-and-swap means a newer draft exists — or the automation was deleted meanwhile. */
async function conflictOrNotFound(automationId: string) {
  const latest = (await automationRepository.findById(automationId)) as DraftAwareAutomation | null;
  if (!latest) {
    return createGraphQLError('Automation not found', GRAPHQL_ERROR_CODES.AUTOMATION_NOT_FOUND);
  }
  return draftConflictError(latest);
}

function draftConflictError(latest: DraftAwareAutomation | null) {
  return createGraphQLError(
    'This automation was edited elsewhere',
    GRAPHQL_ERROR_CODES.AUTOMATION_DRAFT_CONFLICT,
    {
      extensions: {
        draftRevision: latest?.draftRevision ?? null,
        draftUpdatedAt: latest?.draftUpdatedAt?.toISOString() ?? null,
        draftUpdatedById: latest?.draftUpdatedById ?? null,
      },
    }
  );
}

/**
 * Autosave. Writes the builder's working copy to `draftGraph` / `draftTriggerConfig` and never
 * touches the live `graph`, so nothing a run reads changes until {@link publishAutomation}.
 *
 * Deliberately does NOT reject an unpublishable graph: a half-configured step is the normal state
 * mid-edit, and refusing to save it would defeat autosave. Issues are returned instead so the
 * builder can show them as the user works. Optimistic concurrency via `baseRevision` stops two
 * tabs silently overwriting each other; `force` is the "keep my version" escape hatch.
 */
export async function saveAutomationDraft(
  automation: DraftAwareAutomation,
  input: { graph?: unknown; triggerConfig?: unknown; baseRevision: number; force?: boolean },
  userId: string
) {
  if (input.graph === undefined && input.triggerConfig === undefined) {
    throw createGraphQLError('Nothing to save', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
  }
  if (input.graph !== undefined && !isGraphShape(input.graph)) {
    throw createGraphQLError('Graph must contain nodes and edges arrays', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
  }
  if (
    input.triggerConfig !== undefined &&
    input.triggerConfig !== null &&
    (typeof input.triggerConfig !== 'object' || Array.isArray(input.triggerConfig))
  ) {
    throw createGraphQLError('triggerConfig must be an object', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
  }
  if (stableStringify({ g: input.graph, t: input.triggerConfig }).length > MAX_DRAFT_BYTES) {
    throw createGraphQLError('Automation is too large to save', GRAPHQL_ERROR_CODES.AUTOMATION_DRAFT_TOO_LARGE);
  }

  const baseGraph = effectiveGraph(automation);
  const nextGraph =
    input.graph === undefined ? baseGraph : carrySheetColumnsInGraph(baseGraph, input.graph);
  const nextTrigger = input.triggerConfig === undefined ? effectiveTriggerConfig(automation) : input.triggerConfig;

  // A draft equal to the live version is stored as null, so undoing every edit clears the
  // "unpublished changes" state instead of leaving a redundant copy behind.
  const graphMatchesLive = stableStringify(comparableGraph(nextGraph)) === stableStringify(comparableGraph(automation.graph));
  const triggerMatchesLive = stableStringify(nextTrigger) === stableStringify(automation.triggerConfig);
  const issues = collectPublishIssues(nextGraph, nextTrigger, automation.triggerType);

  const updated = await automationRepository.updateIfDraftRevision(
    automation.id,
    input.force ? null : input.baseRevision,
    {
      draftGraph: graphMatchesLive ? Prisma.DbNull : (nextGraph as Prisma.InputJsonValue),
      draftTriggerConfig:
        triggerMatchesLive || nextTrigger === null ? Prisma.DbNull : (nextTrigger as Prisma.InputJsonValue),
      draftRevision: { increment: 1 },
      draftUpdatedAt: new Date(),
      draftUpdatedById: userId,
      draftIssueCount: issues.length,
    }
  );

  if (!updated) {
    throw await conflictOrNotFound(automation.id);
  }

  return { automation: updated, validationErrors: issues };
}

/**
 * Promotes the draft to the live automation: validates it at the activation bar, writes it to
 * `graph` / `triggerConfig`, bumps `version`, and optionally activates — all in one compare-and-swap
 * on `draftRevision`, so the version published is exactly the one the user last saw.
 */
export async function publishAutomation(
  automation: DraftAwareAutomation,
  input: { baseRevision: number; activate?: boolean },
  userId: string
) {
  if ((automation.draftRevision ?? 0) !== input.baseRevision) {
    throw draftConflictError(automation);
  }

  const candidateTrigger = effectiveTriggerConfig(automation);
  // Engine write-backs (an auto-created spreadsheet's column layout) land on the live graph; keep
  // them rather than overwriting with the draft's older copy.
  const candidateGraph = carrySheetColumnsInGraph(automation.graph, effectiveGraph(automation));

  const issues = collectPublishIssues(candidateGraph, candidateTrigger, automation.triggerType);
  if (issues.length > 0) {
    throw createGraphQLError(
      'Automation graph is invalid and cannot be published',
      GRAPHQL_ERROR_CODES.AUTOMATION_INVALID_GRAPH,
      { extensions: { validationErrors: issues } }
    );
  }

  const changed =
    stableStringify(comparableGraph(candidateGraph)) !== stableStringify(comparableGraph(automation.graph)) ||
    stableStringify(candidateTrigger) !== stableStringify(automation.triggerConfig);
  const activate = input.activate === true;
  const digestWatermark = activate
    ? resolveActivationDigestWatermark({
        triggerType: automation.triggerType,
        graph: candidateGraph,
        lastDigestedAt: automation.lastDigestedAt,
      })
    : null;

  const updated = await automationRepository.updateIfDraftRevision(automation.id, input.baseRevision, {
    graph: candidateGraph as Prisma.InputJsonValue,
    triggerConfig: candidateTrigger === null ? Prisma.DbNull : (candidateTrigger as Prisma.InputJsonValue),
    ...(changed ? { version: { increment: 1 } } : {}),
    draftGraph: Prisma.DbNull,
    draftTriggerConfig: Prisma.DbNull,
    draftRevision: { increment: 1 },
    draftUpdatedAt: null,
    draftUpdatedById: null,
    draftIssueCount: 0,
    publishedAt: new Date(),
    publishedById: userId,
    updatedAt: new Date(),
    ...(activate ? { status: 'ACTIVE' } : {}),
    ...(digestWatermark ? { lastDigestedAt: digestWatermark } : {}),
  });

  if (!updated) {
    throw await conflictOrNotFound(automation.id);
  }

  // boss.schedule upserts by (queue, key), so a changed cron/timezone replaces the old schedule.
  if (automation.triggerType === 'schedule' && updated.status === 'ACTIVE') {
    const { cron, timezone } = candidateTrigger as { cron: string; timezone?: string };
    await scheduleAutomationCron(updated.id, cron, timezone);
  }

  await audit('automation.published', 'Automation', automation.id, userId, {
    fromVersion: automation.version,
    toVersion: updated.version,
    activated: activate,
  });

  return updated;
}

/** Throws the draft away and returns the builder to the published version. */
export async function discardAutomationDraft(automation: { id: string }) {
  // Bumping the revision makes any other open tab hit a conflict and reload rather than re-save
  // the discarded edits.
  const updated = await automationRepository.updateIfDraftRevision(automation.id, null, {
    draftGraph: Prisma.DbNull,
    draftTriggerConfig: Prisma.DbNull,
    draftRevision: { increment: 1 },
    draftUpdatedAt: null,
    draftUpdatedById: null,
    draftIssueCount: 0,
  });
  if (!updated) {
    throw createGraphQLError('Automation not found', GRAPHQL_ERROR_CODES.AUTOMATION_NOT_FOUND);
  }
  return updated;
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
  const { name, triggerConfig } = updates;
  // The builder saves the whole graph, including the sheet layout it loaded; keep the latest one.
  const graph =
    updates.graph === undefined ? undefined : carrySheetColumnsInGraph(automation.graph, updates.graph);
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
    status?: string;
    triggerType: string;
    graph: unknown;
    triggerConfig: unknown;
    lastDigestedAt?: Date | null;
    draftGraph?: unknown;
    draftTriggerConfig?: unknown;
  },
  status: string
) {
  // A never-published automation's live graph is just the placeholder it was created with; the real
  // work sits in the draft. Activating "what is live" would silently run the placeholder, so
  // leaving DRAFT has to go through publishAutomation.
  if (
    status === 'ACTIVE' &&
    automation.status === 'DRAFT' &&
    (automation.draftGraph != null || automation.draftTriggerConfig != null)
  ) {
    throw createGraphQLError(
      'This automation has unpublished changes — publish it to activate it',
      GRAPHQL_ERROR_CODES.BAD_USER_INPUT
    );
  }

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

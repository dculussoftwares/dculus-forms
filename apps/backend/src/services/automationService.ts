import { createGraphQLError } from '#graphql-errors';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import { generateId } from '@dculus/utils';
import { automationRepository, responseRepository } from '../repositories/index.js';
import { getAvailablePluginTypes } from '../plugins/core/registry.js';
import { validateAutomationGraph } from './automation/graphValidator.js';
import { enqueueFirstStep } from './automation/engine.js';
import {
  cancelRunsForAutomation,
  cancelSingleAutomationRun,
  scheduleAutomationCron,
  unscheduleAutomationCron,
} from './automation/triggerService.js';
import { isValidCronExpression, isValidTimezone } from './automation/cronValidator.js';
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

/** DRAFT default graph for a brand-new automation: a single trigger wired to a single end. */
function buildDefaultGraph(triggerType: string): AutomationGraph {
  const triggerId = generateId();
  const endId = generateId();
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
}) {
  const { formId, organizationId, name, triggerType, createdBy } = params;

  if (!name || name.trim().length === 0) {
    throw createGraphQLError('Automation name is required', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
  }
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
    graph: buildDefaultGraph(triggerType) as any,
    version: 1,
    createdBy,
  });
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

export async function setAutomationStatus(
  automation: { id: string; triggerType: string; graph: unknown; triggerConfig: unknown },
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

  const updated = await automationRepository.updateAutomation(automation.id, {
    status,
    updatedAt: new Date(),
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

export async function testAutomation(automation: {
  id: string;
  formId: string;
  version: number;
  graph: unknown;
}, responseId?: string) {
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

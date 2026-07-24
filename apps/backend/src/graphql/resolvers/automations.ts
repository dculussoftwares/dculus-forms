import { createGraphQLError } from '#graphql-errors';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import { generateId } from '@dculus/utils';
import { prisma } from '../../lib/prisma.js';
import { BetterAuthContext, requireAuth, requireOrganizationMembership } from '../../middleware/better-auth-middleware.js';
import { checkFormAccess, PermissionLevel } from './formSharing.js';
import { getAvailablePluginTypes } from '../../plugins/core/registry.js';
import { validateAutomationGraph } from '../../services/automation/graphValidator.js';
import { enqueueFirstStep } from '../../services/automation/engine.js';
import { cancelRunsForAutomation, cancelSingleAutomationRun } from '../../services/automation/triggerService.js';
import type { AutomationGraph, AutomationRunContext } from '../../services/automation/types.js';

/**
 * GraphQL Resolvers for the Automations system (#195)
 * Follows apps/backend/src/graphql/resolvers/plugins.ts conventions.
 */

type Permission = (typeof PermissionLevel)[keyof typeof PermissionLevel];

const AUTOMATION_STATUSES = ['DRAFT', 'ACTIVE', 'PAUSED'] as const;
const TRIGGER_TYPES = ['form.submitted', 'response.edited', 'schedule'] as const;

const toISOString = (value: Date | string | null | undefined): string | null => {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
};

/**
 * Auth gate mirroring plugins.ts's checkFormAccess usage, plus an explicit
 * requireOrganizationMembership call per issue #195 (defense in depth — checkFormAccess
 * already denies non-members internally, but the org-membership layer must be checked
 * independently of form-permission resolution).
 */
async function assertFormAccess(
  context: { auth: BetterAuthContext },
  formId: string,
  requiredPermission: Permission,
  deniedMessage: string
) {
  requireAuth(context.auth);

  const accessCheck = await checkFormAccess(context.auth.user!.id, formId, requiredPermission);
  await requireOrganizationMembership(context.auth, accessCheck.form.organizationId);

  if (!accessCheck.hasAccess) {
    throw createGraphQLError(deniedMessage, GRAPHQL_ERROR_CODES.NO_ACCESS);
  }

  return accessCheck;
}

async function getAutomationOrThrow(id: string) {
  const automation = await prisma.automation.findUnique({ where: { id } });
  if (!automation) {
    throw createGraphQLError('Automation not found', GRAPHQL_ERROR_CODES.AUTOMATION_NOT_FOUND);
  }
  return automation;
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

export const automationsResolvers = {
  Query: {
    formAutomations: async (
      _: any,
      { formId }: { formId: string },
      context: { auth: BetterAuthContext }
    ) => {
      await assertFormAccess(
        context,
        formId,
        PermissionLevel.VIEWER,
        'Access denied: You do not have permission to view automations for this form'
      );

      return prisma.automation.findMany({
        where: { formId },
        orderBy: { createdAt: 'desc' },
      });
    },

    automation: async (
      _: any,
      { id }: { id: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      const automation = await getAutomationOrThrow(id);
      await assertFormAccess(
        context,
        automation.formId,
        PermissionLevel.VIEWER,
        'Access denied: You do not have permission to view this automation'
      );
      return automation;
    },

    automationRuns: async (
      _: any,
      { automationId, limit, offset }: { automationId: string; limit?: number; offset?: number },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      const automation = await getAutomationOrThrow(automationId);
      await assertFormAccess(
        context,
        automation.formId,
        PermissionLevel.VIEWER,
        'Access denied: You do not have permission to view runs for this automation'
      );

      return prisma.automationRun.findMany({
        where: { automationId },
        orderBy: { startedAt: 'desc' },
        take: limit ?? 50,
        skip: offset ?? 0,
      });
    },

    automationRun: async (
      _: any,
      { id }: { id: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      const run = await prisma.automationRun.findUnique({
        where: { id },
        include: { automation: true },
      });
      if (!run) {
        throw createGraphQLError('Automation run not found', GRAPHQL_ERROR_CODES.NOT_FOUND);
      }

      await assertFormAccess(
        context,
        run.automation.formId,
        PermissionLevel.VIEWER,
        'Access denied: You do not have permission to view this automation run'
      );

      return run;
    },
  },

  Mutation: {
    createAutomation: async (
      _: any,
      { formId, name, triggerType }: { formId: string; name: string; triggerType: string },
      context: { auth: BetterAuthContext }
    ) => {
      const accessCheck = await assertFormAccess(
        context,
        formId,
        PermissionLevel.EDITOR,
        'Access denied: You need EDITOR access to create automations for this form'
      );

      if (!name || name.trim().length === 0) {
        throw createGraphQLError('Automation name is required', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
      }
      if (!TRIGGER_TYPES.includes(triggerType as (typeof TRIGGER_TYPES)[number])) {
        throw createGraphQLError(
          `Invalid trigger type: ${triggerType}. Supported types: ${TRIGGER_TYPES.join(', ')}`,
          GRAPHQL_ERROR_CODES.BAD_USER_INPUT
        );
      }

      return prisma.automation.create({
        data: {
          id: generateId(),
          formId,
          organizationId: accessCheck.form.organizationId,
          name,
          status: 'DRAFT',
          triggerType,
          graph: buildDefaultGraph(triggerType) as any,
          version: 1,
          createdBy: context.auth.user!.id,
        },
      });
    },

    updateAutomation: async (
      _: any,
      {
        id,
        name,
        graph,
        triggerConfig,
      }: { id: string; name?: string; graph?: any; triggerConfig?: any },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      const automation = await getAutomationOrThrow(id);
      await assertFormAccess(
        context,
        automation.formId,
        PermissionLevel.EDITOR,
        'Access denied: You need EDITOR access to update this automation'
      );

      const data: Record<string, any> = { updatedAt: new Date() };
      if (name !== undefined) data.name = name;
      if (triggerConfig !== undefined) data.triggerConfig = triggerConfig;
      if (graph !== undefined) {
        data.graph = graph;
        const graphChanged = JSON.stringify(graph) !== JSON.stringify(automation.graph);
        if (graphChanged) {
          data.version = { increment: 1 };
        }
      }

      return prisma.automation.update({ where: { id }, data });
    },

    setAutomationStatus: async (
      _: any,
      { id, status }: { id: string; status: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      const automation = await getAutomationOrThrow(id);
      await assertFormAccess(
        context,
        automation.formId,
        PermissionLevel.EDITOR,
        'Access denied: You need EDITOR access to change this automation status'
      );

      if (!AUTOMATION_STATUSES.includes(status as (typeof AUTOMATION_STATUSES)[number])) {
        throw createGraphQLError(
          `Invalid status: ${status}. Supported statuses: ${AUTOMATION_STATUSES.join(', ')}`,
          GRAPHQL_ERROR_CODES.BAD_USER_INPUT
        );
      }

      if (status === 'ACTIVE') {
        const result = validateAutomationGraph(automation.graph, {
          pluginTypes: getAvailablePluginTypes(),
        });
        if (!result.valid) {
          throw createGraphQLError(
            'Automation graph is invalid and cannot be activated',
            GRAPHQL_ERROR_CODES.AUTOMATION_INVALID_GRAPH,
            { extensions: { validationErrors: result.errors } }
          );
        }
      }

      return prisma.automation.update({
        where: { id },
        data: { status, updatedAt: new Date() },
      });
    },

    deleteAutomation: async (
      _: any,
      { id }: { id: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      const automation = await getAutomationOrThrow(id);
      await assertFormAccess(
        context,
        automation.formId,
        PermissionLevel.EDITOR,
        'Access denied: You need EDITOR access to delete this automation'
      );

      await cancelRunsForAutomation(id, 'automation deleted');
      await prisma.automation.delete({ where: { id } });

      return true;
    },

    testAutomation: async (
      _: any,
      { id, responseId }: { id: string; responseId?: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      const automation = await getAutomationOrThrow(id);
      await assertFormAccess(
        context,
        automation.formId,
        PermissionLevel.EDITOR,
        'Access denied: You need EDITOR access to test this automation'
      );

      const response = responseId
        ? await prisma.response.findFirst({
            where: { id: responseId, formId: automation.formId, deletedAt: null },
          })
        : await prisma.response.findFirst({
            where: { formId: automation.formId, deletedAt: null },
            orderBy: { submittedAt: 'desc' },
          });

      if (!response) {
        throw createGraphQLError(
          'No response available to test this automation with',
          GRAPHQL_ERROR_CODES.RESPONSE_NOT_FOUND
        );
      }

      const context_: AutomationRunContext = {
        test: true,
        triggerData: {
          ...(response.data as Record<string, any>),
          responseId: response.id,
          submittedAt: response.submittedAt.toISOString(),
          isPreview: false,
        },
      };

      const run = await prisma.automationRun.create({
        data: {
          id: generateId(),
          automationId: automation.id,
          responseId: response.id,
          automationVersion: automation.version,
          graphSnapshot: automation.graph as any,
          status: 'RUNNING',
          context: context_ as any,
        },
      });

      await enqueueFirstStep(run);

      return run;
    },

    cancelAutomationRun: async (
      _: any,
      { runId }: { runId: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      const run = await prisma.automationRun.findUnique({
        where: { id: runId },
        include: { automation: true },
      });
      if (!run) {
        throw createGraphQLError('Automation run not found', GRAPHQL_ERROR_CODES.NOT_FOUND);
      }

      await assertFormAccess(
        context,
        run.automation.formId,
        PermissionLevel.EDITOR,
        'Access denied: You need EDITOR access to cancel this automation run'
      );

      const cancelled = await cancelSingleAutomationRun(runId);
      if (!cancelled) {
        throw createGraphQLError('Automation run not found', GRAPHQL_ERROR_CODES.NOT_FOUND);
      }
      return cancelled;
    },
  },

  Automation: {
    createdAt: (parent: { createdAt: Date | string }) => toISOString(parent.createdAt),
    updatedAt: (parent: { updatedAt: Date | string }) => toISOString(parent.updatedAt),
  },

  AutomationRun: {
    startedAt: (parent: { startedAt: Date | string }) => toISOString(parent.startedAt),
    completedAt: (parent: { completedAt: Date | string | null }) => toISOString(parent.completedAt),
    stepRuns: async (parent: { id: string }) =>
      prisma.automationStepRun.findMany({
        where: { runId: parent.id },
        orderBy: { startedAt: 'asc' },
      }),
  },

  AutomationStepRun: {
    startedAt: (parent: { startedAt: Date | string }) => toISOString(parent.startedAt),
    finishedAt: (parent: { finishedAt: Date | string | null }) => toISOString(parent.finishedAt),
  },
};

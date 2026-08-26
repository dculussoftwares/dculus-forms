import { createGraphQLError } from '#graphql-errors';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import { BetterAuthContext, requireAuth, requireOrganizationMembership } from '../../middleware/better-auth-middleware.js';
import { checkFormAccess, PermissionLevel } from './formSharing.js';
import * as automationService from '../../services/automationService.js';

/**
 * GraphQL Resolvers for the Automations system (#195)
 * Follows apps/backend/src/graphql/resolvers/plugins.ts conventions.
 * Business logic (graph/cron validation, version bumping, run creation) lives in
 * automationService.ts — this resolver only orchestrates auth and calls the service.
 */

type Permission = (typeof PermissionLevel)[keyof typeof PermissionLevel];

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

      return automationService.listAutomationsByForm(formId);
    },

    automation: async (
      _: any,
      { id }: { id: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      const automation = await automationService.getAutomationById(id);
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
      const automation = await automationService.getAutomationById(automationId);
      await assertFormAccess(
        context,
        automation.formId,
        PermissionLevel.VIEWER,
        'Access denied: You do not have permission to view runs for this automation'
      );

      return automationService.listAutomationRuns(automationId, limit, offset);
    },

    automationRun: async (
      _: any,
      { id }: { id: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      const run = await automationService.getAutomationRunWithAutomation(id);

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

      return automationService.createAutomation({
        formId,
        organizationId: accessCheck.form.organizationId,
        name,
        triggerType,
        createdBy: context.auth.user!.id,
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
      const automation = await automationService.getAutomationById(id);
      await assertFormAccess(
        context,
        automation.formId,
        PermissionLevel.EDITOR,
        'Access denied: You need EDITOR access to update this automation'
      );

      return automationService.updateAutomation(automation, { name, graph, triggerConfig });
    },

    setAutomationStatus: async (
      _: any,
      { id, status }: { id: string; status: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      const automation = await automationService.getAutomationById(id);
      await assertFormAccess(
        context,
        automation.formId,
        PermissionLevel.EDITOR,
        'Access denied: You need EDITOR access to change this automation status'
      );

      return automationService.setAutomationStatus(automation, status);
    },

    deleteAutomation: async (
      _: any,
      { id }: { id: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      const automation = await automationService.getAutomationById(id);
      await assertFormAccess(
        context,
        automation.formId,
        PermissionLevel.EDITOR,
        'Access denied: You need EDITOR access to delete this automation'
      );

      return automationService.deleteAutomation(automation);
    },

    testAutomation: async (
      _: any,
      { id, responseId }: { id: string; responseId?: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      const automation = await automationService.getAutomationById(id);
      await assertFormAccess(
        context,
        automation.formId,
        PermissionLevel.EDITOR,
        'Access denied: You need EDITOR access to test this automation'
      );

      // Every email action in a test run is redirected to whoever pressed Test, so a rehearsal can
      // never reach a real respondent — the engine skips the send outright if this is missing.
      return automationService.testAutomation(automation, responseId, context.auth.user!.email);
    },

    cancelAutomationRun: async (
      _: any,
      { runId }: { runId: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      const run = await automationService.getAutomationRunWithAutomation(runId);

      await assertFormAccess(
        context,
        run.automation.formId,
        PermissionLevel.EDITOR,
        'Access denied: You need EDITOR access to cancel this automation run'
      );

      return automationService.cancelAutomationRun(runId);
    },

    retryAutomationRun: async (
      _: any,
      { runId }: { runId: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      const run = await automationService.getAutomationRunWithAutomation(runId);

      await assertFormAccess(
        context,
        run.automation.formId,
        PermissionLevel.EDITOR,
        'Access denied: You need EDITOR access to retry this automation run'
      );

      return automationService.retryAutomationRun(runId);
    },
  },

  Automation: {
    createdAt: (parent: { createdAt: Date | string }) => toISOString(parent.createdAt),
    updatedAt: (parent: { updatedAt: Date | string }) => toISOString(parent.updatedAt),
    lastDigestedAt: (parent: { lastDigestedAt: Date | string | null }) => toISOString(parent.lastDigestedAt),
  },

  AutomationRun: {
    startedAt: (parent: { startedAt: Date | string }) => toISOString(parent.startedAt),
    completedAt: (parent: { completedAt: Date | string | null }) => toISOString(parent.completedAt),
    stepRuns: async (parent: { id: string }) => automationService.listStepRuns(parent.id),
  },

  AutomationStepRun: {
    startedAt: (parent: { startedAt: Date | string }) => toISOString(parent.startedAt),
    finishedAt: (parent: { finishedAt: Date | string | null }) => toISOString(parent.finishedAt),
  },
};

import { createGraphQLError } from '#graphql-errors';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import { BetterAuthContext, requireAuth, requireOrganizationMembership } from '../../middleware/better-auth-middleware.js';
import { checkFormAccess, PermissionLevel } from './formSharing.js';
import * as automationService from '../../services/automationService.js';
import { userRepository } from '../../repositories/index.js';
import { redactAutomationGraph, redactRunOutput } from '../../lib/secretRedaction.js';

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

const canEditPermission = (permission: string | null | undefined) =>
  permission === PermissionLevel.OWNER || permission === PermissionLevel.EDITOR;

/**
 * Viewers see what actually runs. The draft is an editor's work in progress, so it is withheld —
 * but `hasUnpublishedChanges` is preserved so the UI can still tell them one exists.
 */
const withoutDraft = <T extends { graph?: unknown; draftGraph?: unknown; draftTriggerConfig?: unknown }>(automation: T) => ({
  ...automation,
  // Action configs hold credentials (webhook secret, header values, OAuth tokens); viewers get them masked.
  graph: redactAutomationGraph(automation.graph),
  _hasUnpublishedChanges: automation.draftGraph != null || automation.draftTriggerConfig != null,
  draftGraph: null,
  draftTriggerConfig: null,
  draftUpdatedAt: null,
  draftUpdatedById: null,
  draftIssueCount: 0,
});

const lookupEditor = async (userId: string | null | undefined) => {
  if (!userId) return null;
  const user = await userRepository.findUnique({ where: { id: userId }, select: { id: true, name: true } });
  return user ?? null;
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
      const accessCheck = await assertFormAccess(
        context,
        formId,
        PermissionLevel.VIEWER,
        'Access denied: You do not have permission to view automations for this form'
      );

      const automations = await automationService.listAutomationsByForm(formId);
      return canEditPermission(accessCheck.permission) ? automations : automations.map(withoutDraft);
    },

    automation: async (
      _: any,
      { id }: { id: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      const automation = await automationService.getAutomationById(id);
      const accessCheck = await assertFormAccess(
        context,
        automation.formId,
        PermissionLevel.VIEWER,
        'Access denied: You do not have permission to view this automation'
      );
      return canEditPermission(accessCheck.permission) ? automation : withoutDraft(automation);
    },

    automationRuns: async (
      _: any,
      { automationId, limit, offset }: { automationId: string; limit?: number; offset?: number },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      const automation = await automationService.getAutomationById(automationId);
      const accessCheck = await assertFormAccess(
        context,
        automation.formId,
        PermissionLevel.VIEWER,
        'Access denied: You do not have permission to view runs for this automation'
      );

      const runs = await automationService.listAutomationRuns(automationId, limit, offset);
      const canEdit = canEditPermission(accessCheck.permission);
      return runs.map((run) => ({ ...run, _canEdit: canEdit }));
    },

    automationRun: async (
      _: any,
      { id }: { id: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      const run = await automationService.getAutomationRunWithAutomation(id);

      const accessCheck = await assertFormAccess(
        context,
        run.automation.formId,
        PermissionLevel.VIEWER,
        'Access denied: You do not have permission to view this automation run'
      );

      return { ...run, _canEdit: canEditPermission(accessCheck.permission) };
    },
  },

  Mutation: {
    createAutomation: async (
      _: any,
      {
        formId,
        name,
        triggerType,
        template,
      }: { formId: string; name: string; triggerType: string; template?: string },
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
        template,
        createdBy: context.auth.user!.id,
      });
    },

    duplicateAutomation: async (
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
        'Access denied: You need EDITOR access to duplicate this automation'
      );

      return automationService.duplicateAutomation(automation, context.auth.user!.id);
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

    saveAutomationDraft: async (
      _: any,
      {
        id,
        graph,
        triggerConfig,
        baseRevision,
        force,
      }: { id: string; graph?: any; triggerConfig?: any; baseRevision: number; force?: boolean },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      const automation = await automationService.getAutomationById(id);
      await assertFormAccess(
        context,
        automation.formId,
        PermissionLevel.EDITOR,
        'Access denied: You need EDITOR access to edit this automation'
      );

      return automationService.saveAutomationDraft(
        automation,
        { graph, triggerConfig, baseRevision, force },
        context.auth.user!.id
      );
    },

    publishAutomation: async (
      _: any,
      { id, baseRevision, activate }: { id: string; baseRevision: number; activate?: boolean },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      const automation = await automationService.getAutomationById(id);
      await assertFormAccess(
        context,
        automation.formId,
        PermissionLevel.EDITOR,
        'Access denied: You need EDITOR access to publish this automation'
      );

      return automationService.publishAutomation(automation, { baseRevision, activate }, context.auth.user!.id);
    },

    discardAutomationDraft: async (
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
        'Access denied: You need EDITOR access to discard changes to this automation'
      );

      return automationService.discardAutomationDraft(automation);
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
    lastRunAt: (parent: { lastRunAt: Date | string | null }) => toISOString(parent.lastRunAt),
    draftUpdatedAt: (parent: { draftUpdatedAt?: Date | string | null }) => toISOString(parent.draftUpdatedAt),
    publishedAt: (parent: { publishedAt?: Date | string | null }) => toISOString(parent.publishedAt),
    draftUpdatedBy: (parent: { draftUpdatedById?: string | null }) => lookupEditor(parent.draftUpdatedById),
    publishedBy: (parent: { publishedById?: string | null }) => lookupEditor(parent.publishedById),
    hasUnpublishedChanges: (parent: {
      _hasUnpublishedChanges?: boolean;
      draftGraph?: unknown;
      draftTriggerConfig?: unknown;
    }) => parent._hasUnpublishedChanges ?? (parent.draftGraph != null || parent.draftTriggerConfig != null),
  },

  AutomationRun: {
    startedAt: (parent: { startedAt: Date | string }) => toISOString(parent.startedAt),
    completedAt: (parent: { completedAt: Date | string | null }) => toISOString(parent.completedAt),
    // Receiver replies are never returned in full; the short excerpt is for editors only.
    context: (parent: { context?: unknown; _canEdit?: boolean }) =>
      redactRunOutput(parent.context, parent._canEdit === true),
    stepRuns: async (parent: { id: string; _canEdit?: boolean }) => {
      const stepRuns = await automationService.listStepRuns(parent.id);
      return stepRuns.map((stepRun) => ({ ...stepRun, _canEdit: parent._canEdit === true }));
    },
  },

  AutomationStepRun: {
    output: (parent: { output?: unknown; _canEdit?: boolean }) => redactRunOutput(parent.output, parent._canEdit === true),
    startedAt: (parent: { startedAt: Date | string }) => toISOString(parent.startedAt),
    finishedAt: (parent: { finishedAt: Date | string | null }) => toISOString(parent.finishedAt),
  },
};

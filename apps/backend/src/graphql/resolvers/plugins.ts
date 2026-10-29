import { createGraphQLError } from '#graphql-errors';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import { BetterAuthContext, requireAuth } from '../../middleware/better-auth-middleware.js';
import { checkFormAccess, PermissionLevel } from './formSharing.js';
import { emitPluginTest } from '../../plugins/core/events.js';
import { startBackfill, cancelBackfill, getLatestBackfillJob } from '../../plugins/core/backfill.js';
import { carrySheetColumns } from '../../plugins/core/sheetColumns.js';
import type { PluginConfig } from '../../plugins/core/types.js';
import { provisionSheetPlugin, syncSheetPluginName } from '../../plugins/core/provision.js';
import * as pluginService from '../../services/pluginService.js';
import { mergeMaskedConfig, redactPluginConfig, redactRunOutput } from '../../lib/secretRedaction.js';
import { assertOutboundUrlAllowed, UnsafeUrlError } from '../../lib/urlGuard.js';
import { getFormSchemaFromHocuspocus } from '../../services/hocuspocus.js';

/**
 * GraphQL Resolvers for Plugin System
 * Handles plugin CRUD operations and testing
 */

const parseJsonField = (value: unknown) => (typeof value === 'string' ? JSON.parse(value) : value);

/**
 * Plugin configs carry credentials (webhook secret, header values, OAuth tokens). Only an OWNER —
 * the level that can create/update plugins — receives them; everyone else gets the masked
 * projection from lib/secretRedaction.ts.
 */
const projectPlugin = <T extends { config?: unknown }>(plugin: T, permission: string | undefined): T =>
  permission === PermissionLevel.OWNER
    ? plugin
    : { ...plugin, config: redactPluginConfig(parseJsonField(plugin.config)) };

/** Webhook destinations are screened at save time; safeFetch screens them again on every send. */
const assertWebhookDestination = async (type: string, config: unknown) => {
  if (type !== 'webhook') return;
  const url = (config as { url?: unknown } | null)?.url;
  // A plugin saved without a URL yet cannot send anything; every send is screened regardless.
  if (url === undefined || url === null || url === '') return;
  try {
    await assertOutboundUrlAllowed(url);
  } catch (error) {
    if (error instanceof UnsafeUrlError) {
      throw createGraphQLError(`Invalid webhook URL: ${error.message}`, GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
    }
    throw error;
  }
};

/**
 * An email plugin may address the respondent through a form field. That field must be an email
 * field, otherwise any free-text answer would become a recipient. The handler validates the
 * submitted value again on every send; this rejects the misconfiguration up front.
 */
const assertRecipientFieldIsEmail = async (type: string, config: unknown, formId: string) => {
  if (type !== 'email') return;
  const fieldId = (config as { recipientFieldId?: unknown } | null)?.recipientFieldId;
  if (typeof fieldId !== 'string' || fieldId === '') return;

  const schema = await getFormSchemaFromHocuspocus(formId);
  // No live schema to check against (new or unsynced form); the handler's runtime check still applies.
  if (!schema?.pages) return;

  const fields: Array<{ id?: string; type?: string }> = (schema.pages as Array<{ fields?: unknown[] }>).flatMap(
    (page) => (page.fields ?? []) as Array<{ id?: string; type?: string }>
  );
  const field = fields.find((candidate) => candidate.id === fieldId);
  if (!field || String(field.type).toLowerCase() !== 'email_field') {
    throw createGraphQLError(
      'The recipient field must be an email field on this form',
      GRAPHQL_ERROR_CODES.BAD_USER_INPUT
    );
  }
};

export const pluginsResolvers = {
  Query: {
    /**
     * Get all plugins for a specific form
     */
    formPlugins: async (
      _: any,
      { formId }: { formId: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);

      // Check if user has at least VIEWER access to this form
      const accessCheck = await checkFormAccess(
        context.auth.user!.id,
        formId,
        PermissionLevel.VIEWER
      );
      if (!accessCheck.hasAccess) {
        throw createGraphQLError('Access denied: You do not have permission to view plugins for this form', GRAPHQL_ERROR_CODES.NO_ACCESS);
      }

      // Fetch all plugins for this form
      const plugins = await pluginService.listPluginsByForm(formId);

      return plugins.map((plugin) => projectPlugin(plugin, accessCheck.permission));
    },

    /**
     * Get a single plugin by ID
     */
    formPlugin: async (
      _: any,
      { id }: { id: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);

      // Fetch plugin and check access
      const plugin = await pluginService.getPluginByIdWithForm(id);

      if (!plugin) {
        throw createGraphQLError('Plugin not found', GRAPHQL_ERROR_CODES.NOT_FOUND);
      }

      // Check if user has access to the form this plugin belongs to
      const accessCheck = await checkFormAccess(
        context.auth.user!.id,
        plugin.formId,
        PermissionLevel.VIEWER
      );
      if (!accessCheck.hasAccess) {
        throw createGraphQLError('Access denied: You do not have permission to view this plugin', GRAPHQL_ERROR_CODES.NO_ACCESS);
      }

      return projectPlugin(plugin, accessCheck.permission);
    },

    /**
     * Get plugin delivery history
     */
    pluginDeliveries: async (
      _: any,
      { pluginId, limit = 50 }: { pluginId: string; limit?: number },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);

      // Fetch plugin and check access
      const plugin = await pluginService.getPluginById(pluginId);

      if (!plugin) {
        throw createGraphQLError('Plugin not found', GRAPHQL_ERROR_CODES.NOT_FOUND);
      }

      // Check if user has access to the form
      const accessCheck = await checkFormAccess(
        context.auth.user!.id,
        plugin.formId,
        PermissionLevel.VIEWER
      );
      if (!accessCheck.hasAccess) {
        throw createGraphQLError('Access denied: You do not have permission to view plugin deliveries', GRAPHQL_ERROR_CODES.NO_ACCESS);
      }

      // Fetch delivery history
      const deliveries = await pluginService.listPluginDeliveries(pluginId, limit);

      // Receiver replies are attacker-controlled text; only OWNER sees the short excerpt, and
      // full bodies stored before they were dropped are never returned.
      const includeExcerpt = accessCheck.permission === PermissionLevel.OWNER;
      return deliveries.map((delivery) => ({
        ...delivery,
        response: redactRunOutput(parseJsonField(delivery.response), includeExcerpt),
      }));
    },

    /**
     * Get the latest backfill job status for a plugin
     */
    pluginBackfillStatus: async (
      _: any,
      { pluginId }: { pluginId: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);

      const plugin = await pluginService.getPluginById(pluginId);
      if (!plugin) {
        throw createGraphQLError('Plugin not found', GRAPHQL_ERROR_CODES.NOT_FOUND);
      }

      const accessCheck = await checkFormAccess(
        context.auth.user!.id,
        plugin.formId,
        PermissionLevel.VIEWER
      );
      if (!accessCheck.hasAccess) {
        throw createGraphQLError('Access denied: You do not have permission to view this plugin', GRAPHQL_ERROR_CODES.NO_ACCESS);
      }

      return getLatestBackfillJob(pluginId);
    },
  },

  Mutation: {
    /**
     * Create a new plugin for a form
     */
    createFormPlugin: async (
      _: any,
      {
        input,
      }: {
        input: {
          formId: string;
          type: string;
          name: string;
          config: any;
          events: string[];
          enabled?: boolean;
        };
      },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);

      // Check if user has OWNER access to this form (plugins send data to external systems)
      const accessCheck = await checkFormAccess(
        context.auth.user!.id,
        input.formId,
        PermissionLevel.OWNER
      );
      if (!accessCheck.hasAccess) {
        throw createGraphQLError('Access denied: You need OWNER access to create plugins for this form', GRAPHQL_ERROR_CODES.NO_ACCESS);
      }

      // quiz-grading is deprecated (native quiz mode replaces it — see Form Settings → Quiz).
      // Block new instances here; UI-level gating alone isn't enough since this mutation is
      // directly callable. Existing quiz-grading instances are untouched and keep executing.
      if (input.type === 'quiz-grading') {
        throw createGraphQLError(
          'The Quiz Auto-Grading plugin is deprecated. Use native quiz mode in Form Settings → Quiz instead.',
          GRAPHQL_ERROR_CODES.PLUGIN_DEPRECATED
        );
      }

      // Validate events (only allow supported events)
      const supportedEvents = ['form.submitted', 'plugin.test'];
      const invalidEvents = input.events.filter(
        (event) => !supportedEvents.includes(event)
      );
      if (invalidEvents.length > 0) {
        throw createGraphQLError(`Invalid event types: ${invalidEvents.join(', ')}. Supported events: ${supportedEvents.join(', ')}`, GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
      }

      await assertWebhookDestination(input.type, input.config);
      await assertRecipientFieldIsEmail(input.type, input.config, input.formId);

      // Create plugin (a mask can never be a real credential, so none is stored on create)
      const plugin = await pluginService.createPlugin({
        ...input,
        config: mergeMaskedConfig(undefined, input.config),
      });

      const provisioned = await provisionSheetPlugin(plugin.id);
      return provisioned ? ((await pluginService.getPluginById(plugin.id)) ?? plugin) : plugin;
    },

    /**
     * Update an existing plugin
     */
    updateFormPlugin: async (
      _: any,
      {
        id,
        input,
      }: {
        id: string;
        input: {
          name?: string;
          config?: any;
          events?: string[];
          enabled?: boolean;
        };
      },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);

      // Fetch plugin
      const plugin = await pluginService.getPluginById(id);

      if (!plugin) {
        throw createGraphQLError('Plugin not found', GRAPHQL_ERROR_CODES.NOT_FOUND);
      }

      // Check if user has OWNER access to this form (plugins send data to external systems)
      const accessCheck = await checkFormAccess(
        context.auth.user!.id,
        plugin.formId,
        PermissionLevel.OWNER
      );
      if (!accessCheck.hasAccess) {
        throw createGraphQLError('Access denied: You need OWNER access to update this plugin', GRAPHQL_ERROR_CODES.NO_ACCESS);
      }

      // Validate events if provided
      if (input.events) {
        const supportedEvents = ['form.submitted', 'plugin.test'];
        const invalidEvents = input.events.filter(
          (event) => !supportedEvents.includes(event)
        );
        if (invalidEvents.length > 0) {
          throw createGraphQLError(`Invalid event types: ${invalidEvents.join(', ')}. Supported events: ${supportedEvents.join(', ')}`, GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
        }
      }

      if (input.config !== undefined) {
        await assertWebhookDestination(plugin.type, input.config);
        await assertRecipientFieldIsEmail(plugin.type, input.config, plugin.formId);
      }

      // Update plugin. A credential sent back as the mask means "unchanged" — restore the stored one.
      const updatedPlugin = await pluginService.updatePlugin(
        id,
        input.config === undefined
          ? input
          : {
              ...input,
              config: carrySheetColumns(plugin.config, mergeMaskedConfig(plugin.config, input.config)),
            }
      );

      const provisioned = await provisionSheetPlugin(id);
      await syncSheetPluginName(id, plugin.config as PluginConfig | undefined);
      return provisioned ? ((await pluginService.getPluginById(id)) ?? updatedPlugin) : updatedPlugin;
    },

    /**
     * Delete a plugin
     */
    deleteFormPlugin: async (
      _: any,
      { id }: { id: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);

      // Fetch plugin
      const plugin = await pluginService.getPluginById(id);

      if (!plugin) {
        throw createGraphQLError('Plugin not found', GRAPHQL_ERROR_CODES.NOT_FOUND);
      }

      // Check if user has OWNER access to this form (plugins send data to external systems)
      const accessCheck = await checkFormAccess(
        context.auth.user!.id,
        plugin.formId,
        PermissionLevel.OWNER
      );
      if (!accessCheck.hasAccess) {
        throw createGraphQLError('Access denied: You need OWNER access to delete this plugin', GRAPHQL_ERROR_CODES.NO_ACCESS);
      }

      // Delete plugin (deliveries will cascade delete)
      await pluginService.deletePlugin(id);

      return { success: true, message: 'Plugin deleted successfully' };
    },

    /**
     * Test a plugin by triggering a test event
     */
    testFormPlugin: async (
      _: any,
      { id }: { id: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);

      // Fetch plugin
      const plugin = await pluginService.getPluginByIdWithForm(id);

      if (!plugin) {
        throw createGraphQLError('Plugin not found', GRAPHQL_ERROR_CODES.NOT_FOUND);
      }

      // Check if user has OWNER access to this form (plugins send data to external systems)
      const accessCheck = await checkFormAccess(
        context.auth.user!.id,
        plugin.formId,
        PermissionLevel.OWNER
      );
      if (!accessCheck.hasAccess) {
        throw createGraphQLError('Access denied: You need OWNER access to test this plugin', GRAPHQL_ERROR_CODES.NO_ACCESS);
      }

      // Emit test event
      emitPluginTest(plugin.formId, plugin.form.organizationId, {
        pluginId: plugin.id,
        pluginType: plugin.type,
        pluginName: plugin.name,
      });

      return {
        success: true,
        message: 'Test event triggered successfully. Check plugin deliveries for results.',
      };
    },

    /**
     * Start a backfill run for a plugin against existing responses
     */
    startPluginBackfill: async (
      _: any,
      { pluginId }: { pluginId: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);

      const plugin = await pluginService.getPluginById(pluginId);
      if (!plugin) {
        throw createGraphQLError('Plugin not found', GRAPHQL_ERROR_CODES.NOT_FOUND);
      }

      const accessCheck = await checkFormAccess(
        context.auth.user!.id,
        plugin.formId,
        PermissionLevel.OWNER
      );
      if (!accessCheck.hasAccess) {
        throw createGraphQLError('Access denied: You need OWNER access to backfill this plugin', GRAPHQL_ERROR_CODES.NO_ACCESS);
      }

      return startBackfill(pluginId);
    },

    /**
     * Cancel a running backfill job
     */
    cancelPluginBackfill: async (
      _: any,
      { jobId }: { jobId: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);

      const job = await pluginService.getBackfillJobById(jobId);
      if (!job) {
        throw createGraphQLError('Backfill job not found', GRAPHQL_ERROR_CODES.NOT_FOUND);
      }

      const plugin = await pluginService.getPluginById(job.pluginId);
      if (!plugin) {
        throw createGraphQLError('Plugin not found', GRAPHQL_ERROR_CODES.NOT_FOUND);
      }

      const accessCheck = await checkFormAccess(
        context.auth.user!.id,
        plugin.formId,
        PermissionLevel.OWNER
      );
      if (!accessCheck.hasAccess) {
        throw createGraphQLError('Access denied: You need OWNER access to cancel this backfill', GRAPHQL_ERROR_CODES.NO_ACCESS);
      }

      return cancelBackfill(jobId);
    },
  },

  // Field resolvers
  FormPlugin: {
    config: (parent: any) => {
      // Parse JSON config if it's a string
      if (typeof parent.config === 'string') {
        return JSON.parse(parent.config);
      }
      return parent.config;
    },
  },

  PluginDelivery: {
    payload: (parent: any) => {
      // Parse JSON payload if it's a string
      if (typeof parent.payload === 'string') {
        return JSON.parse(parent.payload);
      }
      return parent.payload;
    },
    response: (parent: any) => {
      // Parse JSON response if it's a string
      if (parent.response && typeof parent.response === 'string') {
        return JSON.parse(parent.response);
      }
      return parent.response;
    },
  },
};

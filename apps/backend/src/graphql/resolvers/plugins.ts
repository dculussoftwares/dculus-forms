import { createGraphQLError } from '#graphql-errors';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import { prisma } from '../../lib/prisma.js';
import { BetterAuthContext, requireAuth } from '../../middleware/better-auth-middleware.js';
import { checkFormAccess, PermissionLevel } from './formSharing.js';
import { emitPluginTest } from '../../plugins/core/events.js';
import { startBackfill, cancelBackfill, getLatestBackfillJob } from '../../plugins/core/backfill.js';
import { generateId } from '@dculus/utils';

/**
 * GraphQL Resolvers for Plugin System
 * Handles plugin CRUD operations and testing
 */

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
      const plugins = await prisma.formPlugin.findMany({
        where: { formId },
        orderBy: { createdAt: 'desc' },
      });

      return plugins;
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
      const plugin = await prisma.formPlugin.findUnique({
        where: { id },
        include: { form: true },
      });

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

      return plugin;
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
      const plugin = await prisma.formPlugin.findUnique({
        where: { id: pluginId },
      });

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
      const deliveries = await prisma.pluginDelivery.findMany({
        where: { pluginId },
        orderBy: { deliveredAt: 'desc' },
        take: limit,
      });

      return deliveries;
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

      const plugin = await prisma.formPlugin.findUnique({ where: { id: pluginId } });
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

      // Validate events (only allow supported events)
      const supportedEvents = ['form.submitted', 'plugin.test'];
      const invalidEvents = input.events.filter(
        (event) => !supportedEvents.includes(event)
      );
      if (invalidEvents.length > 0) {
        throw createGraphQLError(`Invalid event types: ${invalidEvents.join(', ')}. Supported events: ${supportedEvents.join(', ')}`, GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
      }

      // Create plugin
      const plugin = await prisma.formPlugin.create({
        data: {
          id: generateId(),
          formId: input.formId,
          type: input.type,
          name: input.name,
          config: input.config,
          events: input.events,
          enabled: input.enabled ?? true,
        },
      });

      return plugin;
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
      const plugin = await prisma.formPlugin.findUnique({
        where: { id },
      });

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

      // Update plugin
      const updatedPlugin = await prisma.formPlugin.update({
        where: { id },
        data: {
          ...input,
          updatedAt: new Date(),
        },
      });

      return updatedPlugin;
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
      const plugin = await prisma.formPlugin.findUnique({
        where: { id },
      });

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
      await prisma.formPlugin.delete({
        where: { id },
      });

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
      const plugin = await prisma.formPlugin.findUnique({
        where: { id },
        include: { form: true },
      });

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

      const plugin = await prisma.formPlugin.findUnique({ where: { id: pluginId } });
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

      const job = await prisma.pluginBackfillJob.findUnique({ where: { id: jobId } });
      if (!job) {
        throw createGraphQLError('Backfill job not found', GRAPHQL_ERROR_CODES.NOT_FOUND);
      }

      const plugin = await prisma.formPlugin.findUnique({ where: { id: job.pluginId } });
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

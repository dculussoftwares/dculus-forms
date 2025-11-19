import { GraphQLError } from '#graphql-errors';
import { prisma } from '../../lib/prisma.js';
import { BetterAuthContext, requireAuth } from '../../middleware/better-auth-middleware.js';
import { checkFormAccess, PermissionLevel } from './formSharing.js';
import { emitPluginTest } from '../../plugins/events.js';
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
        throw new GraphQLError(
          'Access denied: You do not have permission to view plugins for this form'
        );
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
        throw new GraphQLError('Plugin not found');
      }

      // Check if user has access to the form this plugin belongs to
      const accessCheck = await checkFormAccess(
        context.auth.user!.id,
        plugin.formId,
        PermissionLevel.VIEWER
      );
      if (!accessCheck.hasAccess) {
        throw new GraphQLError(
          'Access denied: You do not have permission to view this plugin'
        );
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
        throw new GraphQLError('Plugin not found');
      }

      // Check if user has access to the form
      const accessCheck = await checkFormAccess(
        context.auth.user!.id,
        plugin.formId,
        PermissionLevel.VIEWER
      );
      if (!accessCheck.hasAccess) {
        throw new GraphQLError(
          'Access denied: You do not have permission to view plugin deliveries'
        );
      }

      // Fetch delivery history
      const deliveries = await prisma.pluginDelivery.findMany({
        where: { pluginId },
        orderBy: { deliveredAt: 'desc' },
        take: limit,
      });

      return deliveries;
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

      // Check if user has EDITOR access to this form
      const accessCheck = await checkFormAccess(
        context.auth.user!.id,
        input.formId,
        PermissionLevel.EDITOR
      );
      if (!accessCheck.hasAccess) {
        throw new GraphQLError(
          'Access denied: You need EDITOR access to create plugins for this form'
        );
      }

      // Validate events (only allow supported events)
      const supportedEvents = ['form.submitted', 'plugin.test'];
      const invalidEvents = input.events.filter(
        (event) => !supportedEvents.includes(event)
      );
      if (invalidEvents.length > 0) {
        throw new GraphQLError(
          `Invalid event types: ${invalidEvents.join(', ')}. Supported events: ${supportedEvents.join(', ')}`
        );
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
        throw new GraphQLError('Plugin not found');
      }

      // Check if user has EDITOR access to this form
      const accessCheck = await checkFormAccess(
        context.auth.user!.id,
        plugin.formId,
        PermissionLevel.EDITOR
      );
      if (!accessCheck.hasAccess) {
        throw new GraphQLError(
          'Access denied: You need EDITOR access to update this plugin'
        );
      }

      // Validate events if provided
      if (input.events) {
        const supportedEvents = ['form.submitted', 'plugin.test'];
        const invalidEvents = input.events.filter(
          (event) => !supportedEvents.includes(event)
        );
        if (invalidEvents.length > 0) {
          throw new GraphQLError(
            `Invalid event types: ${invalidEvents.join(', ')}. Supported events: ${supportedEvents.join(', ')}`
          );
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
        throw new GraphQLError('Plugin not found');
      }

      // Check if user has EDITOR access to this form
      const accessCheck = await checkFormAccess(
        context.auth.user!.id,
        plugin.formId,
        PermissionLevel.EDITOR
      );
      if (!accessCheck.hasAccess) {
        throw new GraphQLError(
          'Access denied: You need EDITOR access to delete this plugin'
        );
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
        throw new GraphQLError('Plugin not found');
      }

      // Check if user has EDITOR access to this form
      const accessCheck = await checkFormAccess(
        context.auth.user!.id,
        plugin.formId,
        PermissionLevel.EDITOR
      );
      if (!accessCheck.hasAccess) {
        throw new GraphQLError(
          'Access denied: You need EDITOR access to test this plugin'
        );
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

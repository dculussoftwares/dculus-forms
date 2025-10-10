import { prisma } from '../../lib/prisma.js';
import { BetterAuthContext, requireAuth } from '../../middleware/better-auth-middleware.js';
import { generateId } from '@dculus/utils';
import { GraphQLError } from 'graphql';

export const pluginsResolvers = {
  Query: {
    /**
     * Get all plugins for a form
     */
    formPlugins: async (
      _: any,
      { formId }: { formId: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);

      // Check if user has access to this form
      const form = await prisma.form.findUnique({
        where: { id: formId }
      });

      if (!form) {
        throw new GraphQLError('Form not found');
      }

      const userSession = context.auth.session;
      if (!userSession || userSession.activeOrganizationId !== form.organizationId) {
        throw new GraphQLError('Access denied: You do not have permission to view plugins for this form');
      }

      return await prisma.pluginConfig.findMany({
        where: { formId },
        orderBy: { createdAt: 'desc' }
      });
    },

    /**
     * Get a specific plugin configuration
     */
    formPlugin: async (
      _: any,
      { id }: { id: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);

      const plugin = await prisma.pluginConfig.findUnique({
        where: { id },
        include: { form: true }
      });

      if (!plugin) {
        throw new GraphQLError('Plugin not found');
      }

      const userSession = context.auth.session;
      if (!userSession || userSession.activeOrganizationId !== plugin.form.organizationId) {
        throw new GraphQLError('Access denied');
      }

      return plugin;
    },

    /**
     * Get plugin execution logs
     */
    pluginExecutionLogs: async (
      _: any,
      { pluginConfigId, limit = 50 }: { pluginConfigId: string; limit?: number },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);

      const plugin = await prisma.pluginConfig.findUnique({
        where: { id: pluginConfigId },
        include: { form: true }
      });

      if (!plugin) {
        throw new GraphQLError('Plugin not found');
      }

      const userSession = context.auth.session;
      if (!userSession || userSession.activeOrganizationId !== plugin.form.organizationId) {
        throw new GraphQLError('Access denied');
      }

      return await prisma.pluginExecutionLog.findMany({
        where: { pluginConfigId },
        orderBy: { executedAt: 'desc' },
        take: Math.min(limit, 100)
      });
    }
  },

  Mutation: {
    /**
     * Create a new plugin configuration
     */
    createFormPlugin: async (
      _: any,
      { input }: {
        input: {
          formId: string;
          pluginId: string;
          config: any;
          triggerEvents: string[];
        }
      },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);

      const form = await prisma.form.findUnique({
        where: { id: input.formId }
      });

      if (!form) {
        throw new GraphQLError('Form not found');
      }

      const userSession = context.auth.session;
      if (!userSession || userSession.activeOrganizationId !== form.organizationId) {
        throw new GraphQLError('Access denied');
      }

      // Check if plugin already exists for this form
      const existing = await prisma.pluginConfig.findUnique({
        where: {
          formId_pluginId: {
            formId: input.formId,
            pluginId: input.pluginId
          }
        }
      });

      if (existing) {
        throw new GraphQLError('Plugin already configured for this form');
      }

      return await prisma.pluginConfig.create({
        data: {
          id: generateId(),
          formId: input.formId,
          pluginId: input.pluginId,
          pluginVersion: '1.0.0',
          enabled: false, // Start disabled until user enables it
          config: input.config,
          triggerEvents: input.triggerEvents,
          createdById: context.auth.user.id
        }
      });
    },

    /**
     * Update plugin configuration
     */
    updateFormPlugin: async (
      _: any,
      { input }: {
        input: {
          id: string;
          config: any;
          triggerEvents?: string[];
        }
      },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);

      const plugin = await prisma.pluginConfig.findUnique({
        where: { id: input.id },
        include: { form: true }
      });

      if (!plugin) {
        throw new GraphQLError('Plugin not found');
      }

      const userSession = context.auth.session;
      if (!userSession || userSession.activeOrganizationId !== plugin.form.organizationId) {
        throw new GraphQLError('Access denied');
      }

      return await prisma.pluginConfig.update({
        where: { id: input.id },
        data: {
          config: input.config,
          ...(input.triggerEvents && { triggerEvents: input.triggerEvents })
        }
      });
    },

    /**
     * Toggle plugin enabled/disabled
     */
    toggleFormPlugin: async (
      _: any,
      { id, enabled }: { id: string; enabled: boolean },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);

      const plugin = await prisma.pluginConfig.findUnique({
        where: { id },
        include: { form: true }
      });

      if (!plugin) {
        throw new GraphQLError('Plugin not found');
      }

      const userSession = context.auth.session;
      if (!userSession || userSession.activeOrganizationId !== plugin.form.organizationId) {
        throw new GraphQLError('Access denied');
      }

      return await prisma.pluginConfig.update({
        where: { id },
        data: { enabled }
      });
    },

    /**
     * Delete plugin configuration
     */
    deleteFormPlugin: async (
      _: any,
      { id }: { id: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);

      const plugin = await prisma.pluginConfig.findUnique({
        where: { id },
        include: { form: true }
      });

      if (!plugin) {
        throw new GraphQLError('Plugin not found');
      }

      const userSession = context.auth.session;
      if (!userSession || userSession.activeOrganizationId !== plugin.form.organizationId) {
        throw new GraphQLError('Access denied');
      }

      await prisma.pluginConfig.delete({
        where: { id }
      });

      return true;
    }
  }
};

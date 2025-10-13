/**
 * GraphQL Resolvers - Plugins
 *
 * Handles all plugin-related queries and mutations.
 */

import { GraphQLError } from 'graphql';
import * as pluginService from '../../services/pluginService.js';
import { PluginLoader } from '../../plugins/loader/PluginLoader.js';

export const pluginResolvers = {
  Query: {
    /**
     * Get all available plugins from the registry
     */
    availablePlugins: async () => {
      return pluginService.getAvailablePlugins();
    },

    /**
     * Get plugin configurations for a specific form
     */
    formPluginConfigs: async (_: any, { formId }: { formId: string }, context: any) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required');
      }

      return pluginService.getFormPluginConfigs(formId);
    },

    /**
     * Get a specific plugin configuration
     */
    pluginConfig: async (
      _: any,
      { formId, pluginId }: { formId: string; pluginId: string },
      context: any
    ) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required');
      }

      return pluginService.getPluginConfig(formId, pluginId);
    },

    /**
     * Get plugin configuration UI bundle code
     */
    pluginConfigUI: async (_: any, { pluginId }: { pluginId: string }, context: any) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required');
      }

      // Get plugin from database
      const plugin = await context.prisma.plugin.findUnique({
        where: { id: pluginId },
      });

      if (!plugin) {
        throw new GraphQLError('Plugin not found');
      }

      if (!plugin.isExternal || !plugin.frontendCode) {
        throw new GraphQLError('Plugin does not have a configuration UI');
      }

      return plugin.frontendCode;
    },
  },

  Mutation: {
    /**
     * Install a plugin for a form
     */
    installPlugin: async (
      _: any,
      {
        input,
      }: {
        input: {
          formId: string;
          pluginId: string;
          organizationId: string;
          config: Record<string, any>;
        };
      },
      context: any
    ) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required');
      }

      // Verify user has access to the form
      const form = await context.prisma.form.findUnique({
        where: { id: input.formId },
      });

      if (!form) {
        throw new GraphQLError('Form not found');
      }

      // Check if user belongs to the organization
      const membership = await context.prisma.member.findFirst({
        where: {
          userId: context.user.id,
          organizationId: input.organizationId,
        },
      });

      if (!membership) {
        throw new GraphQLError(
          'You must be a member of the organization to install plugins'
        );
      }

      return pluginService.installPlugin(input);
    },

    /**
     * Update plugin configuration
     */
    updatePluginConfig: async (
      _: any,
      {
        input,
      }: {
        input: {
          id: string;
          config: Record<string, any>;
        };
      },
      context: any
    ) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required');
      }

      // Get the plugin config to verify ownership
      const pluginConfig = await context.prisma.formPluginConfig.findUnique({
        where: { id: input.id },
        include: {
          form: true,
        },
      });

      if (!pluginConfig) {
        throw new GraphQLError('Plugin configuration not found');
      }

      // Check if user belongs to the organization
      const membership = await context.prisma.member.findFirst({
        where: {
          userId: context.user.id,
          organizationId: pluginConfig.organizationId,
        },
      });

      if (!membership) {
        throw new GraphQLError(
          'You do not have permission to update this plugin configuration'
        );
      }

      return pluginService.updatePluginConfig(input);
    },

    /**
     * Toggle plugin enabled/disabled state
     */
    togglePlugin: async (
      _: any,
      {
        input,
      }: {
        input: {
          id: string;
          isEnabled: boolean;
        };
      },
      context: any
    ) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required');
      }

      // Get the plugin config to verify ownership
      const pluginConfig = await context.prisma.formPluginConfig.findUnique({
        where: { id: input.id },
      });

      if (!pluginConfig) {
        throw new GraphQLError('Plugin configuration not found');
      }

      // Check if user belongs to the organization
      const membership = await context.prisma.member.findFirst({
        where: {
          userId: context.user.id,
          organizationId: pluginConfig.organizationId,
        },
      });

      if (!membership) {
        throw new GraphQLError(
          'You do not have permission to modify this plugin'
        );
      }

      return pluginService.togglePlugin(input);
    },

    /**
     * Uninstall a plugin
     */
    uninstallPlugin: async (_: any, { id }: { id: string }, context: any) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required');
      }

      // Get the plugin config to verify ownership
      const pluginConfig = await context.prisma.formPluginConfig.findUnique({
        where: { id },
      });

      if (!pluginConfig) {
        throw new GraphQLError('Plugin configuration not found');
      }

      // Check if user belongs to the organization
      const membership = await context.prisma.member.findFirst({
        where: {
          userId: context.user.id,
          organizationId: pluginConfig.organizationId,
        },
      });

      if (!membership) {
        throw new GraphQLError(
          'You do not have permission to uninstall this plugin'
        );
      }

      return pluginService.uninstallPlugin(id);
    },

    /**
     * Install external plugin from URL
     */
    installExternalPlugin: async (
      _: any,
      { input }: { input: { url: string } },
      context: any
    ) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required');
      }

      // Get user's active organization from session
      const activeOrganizationId = context.auth?.session?.activeOrganizationId;

      if (!activeOrganizationId) {
        throw new GraphQLError('No active organization. Please set an active organization first.');
      }

      // Verify user is a member of the organization
      const membership = await context.prisma.member.findFirst({
        where: {
          userId: context.user.id,
          organizationId: activeOrganizationId,
        },
      });

      if (!membership) {
        throw new GraphQLError('You are not a member of the active organization');
      }

      // Install plugin using PluginLoader
      const result = await PluginLoader.installFromUrl(input.url, activeOrganizationId);

      return result;
    },

    /**
     * Uninstall external plugin
     */
    uninstallExternalPlugin: async (_: any, { pluginId }: { pluginId: string }, context: any) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required');
      }

      // Get user's active organization from session
      const activeOrganizationId = context.auth?.session?.activeOrganizationId;

      if (!activeOrganizationId) {
        throw new GraphQLError('No active organization. Please set an active organization first.');
      }

      // Verify user is a member of the organization
      const membership = await context.prisma.member.findFirst({
        where: {
          userId: context.user.id,
          organizationId: activeOrganizationId,
        },
      });

      if (!membership) {
        throw new GraphQLError('You are not a member of the active organization');
      }

      // Uninstall plugin using PluginLoader
      const result = await PluginLoader.uninstallPlugin(pluginId, activeOrganizationId);

      return result;
    },

    /**
     * Update external plugin to latest version
     */
    updateExternalPlugin: async (_: any, { pluginId }: { pluginId: string }, context: any) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required');
      }

      // Get user's active organization from session
      const activeOrganizationId = context.auth?.session?.activeOrganizationId;

      if (!activeOrganizationId) {
        throw new GraphQLError('No active organization. Please set an active organization first.');
      }

      // Verify user is a member of the organization
      const membership = await context.prisma.member.findFirst({
        where: {
          userId: context.user.id,
          organizationId: activeOrganizationId,
        },
      });

      if (!membership) {
        throw new GraphQLError('You are not a member of the active organization');
      }

      // Update plugin using PluginLoader
      const result = await PluginLoader.updatePlugin(pluginId, activeOrganizationId);

      return result;
    },
  },
};

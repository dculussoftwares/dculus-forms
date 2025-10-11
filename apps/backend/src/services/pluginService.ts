/**
 * Plugin Service
 *
 * Handles CRUD operations for plugin configurations.
 * Used by GraphQL resolvers to manage plugin installations.
 */

import { nanoid } from 'nanoid';
import { prisma } from '../lib/prisma.js';
import { pluginRegistry } from '../plugins/registry.js';
import { GraphQLError } from 'graphql';

export interface InstallPluginInput {
  formId: string;
  pluginId: string;
  organizationId: string;
  config: Record<string, any>;
}

export interface UpdatePluginConfigInput {
  id: string;
  config: Record<string, any>;
}

export interface TogglePluginInput {
  id: string;
  isEnabled: boolean;
}

/**
 * Get all available plugins from the registry
 */
export async function getAvailablePlugins() {
  return pluginRegistry.getAllMetadata();
}

/**
 * Get plugin configurations for a specific form
 */
export async function getFormPluginConfigs(formId: string) {
  return prisma.formPluginConfig.findMany({
    where: { formId },
    include: {
      plugin: true,
    },
  });
}

/**
 * Get a specific plugin configuration
 */
export async function getPluginConfig(formId: string, pluginId: string) {
  return prisma.formPluginConfig.findUnique({
    where: {
      formId_pluginId: {
        formId,
        pluginId,
      },
    },
    include: {
      plugin: true,
    },
  });
}

/**
 * Install a plugin for a form (create configuration)
 */
export async function installPlugin(input: InstallPluginInput) {
  const { formId, pluginId, organizationId, config } = input;

  // Check if plugin exists in registry
  const plugin = pluginRegistry.get(pluginId);
  if (!plugin) {
    throw new GraphQLError(`Plugin "${pluginId}" not found`);
  }

  // Validate configuration against plugin schema
  const validation = plugin.validateConfig(config);
  if (!validation.success) {
    throw new GraphQLError(
      `Invalid plugin configuration: ${validation.error.message}`
    );
  }

  // Check if plugin is already installed
  const existing = await prisma.formPluginConfig.findUnique({
    where: {
      formId_pluginId: {
        formId,
        pluginId,
      },
    },
  });

  if (existing) {
    throw new GraphQLError('Plugin is already installed for this form');
  }

  // Create plugin configuration
  const pluginConfig = await prisma.formPluginConfig.create({
    data: {
      id: nanoid(),
      formId,
      pluginId,
      organizationId,
      config: config,
      isEnabled: true,
    },
    include: {
      plugin: true,
    },
  });

  // Call plugin lifecycle hook
  await plugin.onEnabled(formId, config as any);

  return pluginConfig;
}

/**
 * Update plugin configuration
 */
export async function updatePluginConfig(input: UpdatePluginConfigInput) {
  const { id, config } = input;

  // Get existing configuration
  const existingConfig = await prisma.formPluginConfig.findUnique({
    where: { id },
  });

  if (!existingConfig) {
    throw new GraphQLError('Plugin configuration not found');
  }

  // Get plugin from registry
  const plugin = pluginRegistry.get(existingConfig.pluginId);
  if (!plugin) {
    throw new GraphQLError(`Plugin "${existingConfig.pluginId}" not found`);
  }

  // Validate new configuration
  const validation = plugin.validateConfig(config);
  if (!validation.success) {
    throw new GraphQLError(
      `Invalid plugin configuration: ${validation.error.message}`
    );
  }

  // Update configuration
  const updatedConfig = await prisma.formPluginConfig.update({
    where: { id },
    data: {
      config: config,
    },
    include: {
      plugin: true,
    },
  });

  return updatedConfig;
}

/**
 * Toggle plugin enabled/disabled state
 */
export async function togglePlugin(input: TogglePluginInput) {
  const { id, isEnabled } = input;

  // Get existing configuration
  const existingConfig = await prisma.formPluginConfig.findUnique({
    where: { id },
  });

  if (!existingConfig) {
    throw new GraphQLError('Plugin configuration not found');
  }

  // Get plugin from registry
  const plugin = pluginRegistry.get(existingConfig.pluginId);
  if (!plugin) {
    throw new GraphQLError(`Plugin "${existingConfig.pluginId}" not found`);
  }

  // Update enabled state
  const updatedConfig = await prisma.formPluginConfig.update({
    where: { id },
    data: { isEnabled },
    include: {
      plugin: true,
    },
  });

  // Call appropriate lifecycle hook
  if (isEnabled) {
    await plugin.onEnabled(existingConfig.formId, existingConfig.config as any);
  } else {
    await plugin.onDisabled(existingConfig.formId);
  }

  return updatedConfig;
}

/**
 * Uninstall a plugin (delete configuration)
 */
export async function uninstallPlugin(id: string) {
  // Get existing configuration
  const existingConfig = await prisma.formPluginConfig.findUnique({
    where: { id },
  });

  if (!existingConfig) {
    throw new GraphQLError('Plugin configuration not found');
  }

  // Get plugin from registry
  const plugin = pluginRegistry.get(existingConfig.pluginId);

  // Call lifecycle hook if plugin exists
  if (plugin) {
    await plugin.onUninstalled(existingConfig.formId);
  }

  // Delete configuration
  await prisma.formPluginConfig.delete({
    where: { id },
  });

  return true;
}

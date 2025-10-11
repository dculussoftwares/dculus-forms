/**
 * GraphQL Queries and Mutations for Plugins
 */

import { gql } from '@apollo/client';

export const GET_AVAILABLE_PLUGINS = gql`
  query GetAvailablePlugins {
    availablePlugins {
      id
      name
      description
      icon
      category
      version
      isActive
      createdAt
      updatedAt
    }
  }
`;

export const GET_FORM_PLUGIN_CONFIGS = gql`
  query GetFormPluginConfigs($formId: ID!) {
    formPluginConfigs(formId: $formId) {
      id
      formId
      pluginId
      organizationId
      config
      isEnabled
      createdAt
      updatedAt
      plugin {
        id
        name
        description
        icon
        category
        version
        isActive
      }
    }
  }
`;

export const GET_PLUGIN_CONFIG = gql`
  query GetPluginConfig($formId: ID!, $pluginId: String!) {
    pluginConfig(formId: $formId, pluginId: $pluginId) {
      id
      formId
      pluginId
      organizationId
      config
      isEnabled
      createdAt
      updatedAt
      plugin {
        id
        name
        description
        icon
        category
        version
        isActive
      }
    }
  }
`;

export const INSTALL_PLUGIN = gql`
  mutation InstallPlugin($input: InstallPluginInput!) {
    installPlugin(input: $input) {
      id
      formId
      pluginId
      organizationId
      config
      isEnabled
      createdAt
      updatedAt
      plugin {
        id
        name
        description
        icon
        category
        version
        isActive
      }
    }
  }
`;

export const UPDATE_PLUGIN_CONFIG = gql`
  mutation UpdatePluginConfig($input: UpdatePluginConfigInput!) {
    updatePluginConfig(input: $input) {
      id
      formId
      pluginId
      organizationId
      config
      isEnabled
      createdAt
      updatedAt
      plugin {
        id
        name
        description
        icon
        category
        version
        isActive
      }
    }
  }
`;

export const TOGGLE_PLUGIN = gql`
  mutation TogglePlugin($input: TogglePluginInput!) {
    togglePlugin(input: $input) {
      id
      formId
      pluginId
      organizationId
      config
      isEnabled
      createdAt
      updatedAt
      plugin {
        id
        name
        description
        icon
        category
        version
        isActive
      }
    }
  }
`;

export const UNINSTALL_PLUGIN = gql`
  mutation UninstallPlugin($id: ID!) {
    uninstallPlugin(id: $id)
  }
`;

import { gql } from '@apollo/client';

export const GET_FORM_PLUGINS = gql`
  query GetFormPlugins($formId: ID!) {
    formPlugins(formId: $formId) {
      id
      formId
      pluginId
      pluginVersion
      enabled
      config
      triggerEvents
      createdAt
      updatedAt
    }
  }
`;

export const GET_PLUGIN_EXECUTION_LOGS = gql`
  query GetPluginExecutionLogs($pluginConfigId: ID!, $limit: Int) {
    pluginExecutionLogs(pluginConfigId: $pluginConfigId, limit: $limit) {
      id
      pluginConfigId
      event
      status
      executedAt
      executionTime
      errorMessage
      outputData
    }
  }
`;

export const CREATE_FORM_PLUGIN = gql`
  mutation CreateFormPlugin($input: CreateFormPluginInput!) {
    createFormPlugin(input: $input) {
      id
      formId
      pluginId
      pluginVersion
      enabled
      config
      triggerEvents
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_FORM_PLUGIN = gql`
  mutation UpdateFormPlugin($input: UpdateFormPluginInput!) {
    updateFormPlugin(input: $input) {
      id
      formId
      pluginId
      pluginVersion
      enabled
      config
      triggerEvents
      createdAt
      updatedAt
    }
  }
`;

export const TOGGLE_FORM_PLUGIN = gql`
  mutation ToggleFormPlugin($id: ID!, $enabled: Boolean!) {
    toggleFormPlugin(id: $id, enabled: $enabled) {
      id
      enabled
    }
  }
`;

export const DELETE_FORM_PLUGIN = gql`
  mutation DeleteFormPlugin($id: ID!) {
    deleteFormPlugin(id: $id)
  }
`;

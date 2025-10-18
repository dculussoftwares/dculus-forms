import { gql } from '@apollo/client';

/**
 * GraphQL Queries and Mutations for Plugin System
 */

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get all plugins for a form
 */
export const GET_FORM_PLUGINS = gql`
  query GetFormPlugins($formId: ID!) {
    formPlugins(formId: $formId) {
      id
      formId
      type
      name
      enabled
      config
      events
      createdAt
      updatedAt
    }
  }
`;

/**
 * Get a single plugin by ID
 */
export const GET_FORM_PLUGIN = gql`
  query GetFormPlugin($id: ID!) {
    formPlugin(id: $id) {
      id
      formId
      type
      name
      enabled
      config
      events
      createdAt
      updatedAt
    }
  }
`;

/**
 * Get plugin delivery history
 */
export const GET_PLUGIN_DELIVERIES = gql`
  query GetPluginDeliveries($pluginId: ID!, $limit: Int) {
    pluginDeliveries(pluginId: $pluginId, limit: $limit) {
      id
      pluginId
      eventType
      status
      payload
      response
      errorMessage
      deliveredAt
    }
  }
`;

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Create a new plugin for a form
 */
export const CREATE_FORM_PLUGIN = gql`
  mutation CreateFormPlugin($input: CreateFormPluginInput!) {
    createFormPlugin(input: $input) {
      id
      formId
      type
      name
      enabled
      config
      events
      createdAt
      updatedAt
    }
  }
`;

/**
 * Update an existing plugin
 */
export const UPDATE_FORM_PLUGIN = gql`
  mutation UpdateFormPlugin($id: ID!, $input: UpdateFormPluginInput!) {
    updateFormPlugin(id: $id, input: $input) {
      id
      formId
      type
      name
      enabled
      config
      events
      createdAt
      updatedAt
    }
  }
`;

/**
 * Delete a plugin
 */
export const DELETE_FORM_PLUGIN = gql`
  mutation DeleteFormPlugin($id: ID!) {
    deleteFormPlugin(id: $id) {
      success
      message
    }
  }
`;

/**
 * Test a plugin by triggering a test event
 */
export const TEST_FORM_PLUGIN = gql`
  mutation TestFormPlugin($id: ID!) {
    testFormPlugin(id: $id) {
      success
      message
    }
  }
`;

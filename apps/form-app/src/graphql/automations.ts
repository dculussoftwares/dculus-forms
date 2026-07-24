import { gql } from '@apollo/client';
import type { TypedDocumentNode } from '@apollo/client';

/**
 * GraphQL Queries and Mutations for the Automations system (#196)
 * Follows apps/form-app/src/graphql/plugins.ts conventions.
 */

// ============================================================================
// QUERIES
// ============================================================================

export const GET_FORM_AUTOMATIONS: TypedDocumentNode<any, any> = gql`
  query GetFormAutomations($formId: ID!) {
    formAutomations(formId: $formId) {
      id
      formId
      name
      status
      triggerType
      version
      createdAt
      updatedAt
    }
  }
`;

export const GET_AUTOMATION: TypedDocumentNode<any, any> = gql`
  query GetAutomation($id: ID!) {
    automation(id: $id) {
      id
      formId
      name
      status
      triggerType
      triggerConfig
      graph
      version
      createdAt
      updatedAt
    }
  }
`;

export const GET_AUTOMATION_RUNS: TypedDocumentNode<any, any> = gql`
  query GetAutomationRuns($automationId: ID!, $limit: Int, $offset: Int) {
    automationRuns(automationId: $automationId, limit: $limit, offset: $offset) {
      id
      automationId
      responseId
      automationVersion
      status
      currentNodeId
      context
      startedAt
      completedAt
    }
  }
`;

export const GET_AUTOMATION_RUN: TypedDocumentNode<any, any> = gql`
  query GetAutomationRun($id: ID!) {
    automationRun(id: $id) {
      id
      automationId
      responseId
      automationVersion
      status
      currentNodeId
      context
      startedAt
      completedAt
      stepRuns {
        id
        nodeId
        nodeType
        status
        output
        errorMessage
        attempt
        startedAt
        finishedAt
      }
    }
  }
`;

// ============================================================================
// MUTATIONS
// ============================================================================

export const CREATE_AUTOMATION: TypedDocumentNode<any, any> = gql`
  mutation CreateAutomation($formId: ID!, $name: String!, $triggerType: String!) {
    createAutomation(formId: $formId, name: $name, triggerType: $triggerType) {
      id
      formId
      name
      status
      triggerType
      version
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_AUTOMATION: TypedDocumentNode<any, any> = gql`
  mutation UpdateAutomation($id: ID!, $name: String, $graph: JSON) {
    updateAutomation(id: $id, name: $name, graph: $graph) {
      id
      formId
      name
      status
      triggerType
      graph
      version
      createdAt
      updatedAt
    }
  }
`;

export const SET_AUTOMATION_STATUS: TypedDocumentNode<any, any> = gql`
  mutation SetAutomationStatus($id: ID!, $status: String!) {
    setAutomationStatus(id: $id, status: $status) {
      id
      formId
      name
      status
      triggerType
      version
      createdAt
      updatedAt
    }
  }
`;

export const DELETE_AUTOMATION: TypedDocumentNode<any, any> = gql`
  mutation DeleteAutomation($id: ID!) {
    deleteAutomation(id: $id)
  }
`;

export const TEST_AUTOMATION: TypedDocumentNode<any, any> = gql`
  mutation TestAutomation($id: ID!, $responseId: ID) {
    testAutomation(id: $id, responseId: $responseId) {
      id
      automationId
      responseId
      automationVersion
      status
      currentNodeId
      context
      startedAt
      completedAt
    }
  }
`;

export const CANCEL_AUTOMATION_RUN: TypedDocumentNode<any, any> = gql`
  mutation CancelAutomationRun($runId: ID!) {
    cancelAutomationRun(runId: $runId) {
      id
      status
      completedAt
    }
  }
`;

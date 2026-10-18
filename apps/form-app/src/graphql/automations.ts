import { gql } from '@apollo/client';
import type { TypedDocumentNode } from '@apollo/client';

/**
 * GraphQL Queries and Mutations for the Automations system (#196)
 * Follows apps/form-app/src/graphql/plugins.ts conventions.
 */

// Draft/publish bookkeeping shared by the queries and mutations. Deliberately excludes draftGraph:
// autosave responses carry only these, so a save never rewrites the whole graph in the Apollo cache.
const DRAFT_STATUS_FIELDS = `
  draftRevision
  draftUpdatedAt
  draftUpdatedBy {
    id
    name
  }
  draftIssueCount
  hasUnpublishedChanges
  publishedAt
  publishedBy {
    id
    name
  }
`;

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
      lastRunStatus
      lastRunAt
      consecutiveFailureCount
      ${DRAFT_STATUS_FIELDS}
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
      draftGraph
      draftTriggerConfig
      version
      createdAt
      updatedAt
      ${DRAFT_STATUS_FIELDS}
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
  mutation CreateAutomation($formId: ID!, $name: String!, $triggerType: String!, $template: String) {
    createAutomation(formId: $formId, name: $name, triggerType: $triggerType, template: $template) {
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
  mutation UpdateAutomation($id: ID!, $name: String, $graph: JSON, $triggerConfig: JSON) {
    updateAutomation(id: $id, name: $name, graph: $graph, triggerConfig: $triggerConfig) {
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

export const SAVE_AUTOMATION_DRAFT: TypedDocumentNode<any, any> = gql`
  mutation SaveAutomationDraft($id: ID!, $graph: JSON, $triggerConfig: JSON, $baseRevision: Int!, $force: Boolean) {
    saveAutomationDraft(id: $id, graph: $graph, triggerConfig: $triggerConfig, baseRevision: $baseRevision, force: $force) {
      automation {
        id
        ${DRAFT_STATUS_FIELDS}
      }
      validationErrors {
        nodeId
        code
        message
      }
    }
  }
`;

export const PUBLISH_AUTOMATION: TypedDocumentNode<any, any> = gql`
  mutation PublishAutomation($id: ID!, $baseRevision: Int!, $activate: Boolean) {
    publishAutomation(id: $id, baseRevision: $baseRevision, activate: $activate) {
      id
      formId
      name
      status
      triggerType
      triggerConfig
      graph
      draftGraph
      draftTriggerConfig
      version
      updatedAt
      ${DRAFT_STATUS_FIELDS}
    }
  }
`;

export const DISCARD_AUTOMATION_DRAFT: TypedDocumentNode<any, any> = gql`
  mutation DiscardAutomationDraft($id: ID!) {
    discardAutomationDraft(id: $id) {
      id
      triggerConfig
      graph
      draftGraph
      draftTriggerConfig
      version
      updatedAt
      ${DRAFT_STATUS_FIELDS}
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

export const DUPLICATE_AUTOMATION: TypedDocumentNode<any, any> = gql`
  mutation DuplicateAutomation($id: ID!) {
    duplicateAutomation(id: $id) {
      id
      name
      status
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

export const RETRY_AUTOMATION_RUN: TypedDocumentNode<any, any> = gql`
  mutation RetryAutomationRun($runId: ID!) {
    retryAutomationRun(runId: $runId) {
      id
      status
      completedAt
    }
  }
`;

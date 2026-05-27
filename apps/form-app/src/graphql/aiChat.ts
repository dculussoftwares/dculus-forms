import { gql } from '@apollo/client';

export const LIST_AI_CHAT_CONVERSATIONS = gql`
  query ListAIChatConversations($formId: ID!, $organizationId: ID!) {
    listAIChatConversations(formId: $formId, organizationId: $organizationId) {
      id
      title
      messageCount
      createdAt
      updatedAt
    }
  }
`;

export const GET_AI_CHAT_CONVERSATION = gql`
  query GetAIChatConversation($id: ID!, $organizationId: ID!) {
    getAIChatConversation(id: $id, organizationId: $organizationId) {
      id
      title
      messageCount
      createdAt
      updatedAt
      messages {
        id
        role
        content
        operations
        createdAt
      }
    }
  }
`;

export const CREATE_AI_CHAT_CONVERSATION = gql`
  mutation CreateAIChatConversation($formId: ID!, $organizationId: ID!) {
    createAIChatConversation(formId: $formId, organizationId: $organizationId) {
      id
      title
      messageCount
      createdAt
      updatedAt
      messages {
        id
        role
        content
        operations
        createdAt
      }
    }
  }
`;

export const DELETE_AI_CHAT_CONVERSATION = gql`
  mutation DeleteAIChatConversation($id: ID!, $organizationId: ID!) {
    deleteAIChatConversation(id: $id, organizationId: $organizationId)
  }
`;

export const RENAME_AI_CHAT_CONVERSATION = gql`
  mutation RenameAIChatConversation($id: ID!, $organizationId: ID!, $title: String!) {
    renameAIChatConversation(id: $id, organizationId: $organizationId, title: $title) {
      id
      title
    }
  }
`;


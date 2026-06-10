import { gql } from '@apollo/client';
import type { TypedDocumentNode } from '@apollo/client';

export const LIST_AI_CHAT_CONVERSATIONS : TypedDocumentNode<any, any> = gql`
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

export const GET_AI_CHAT_CONVERSATION : TypedDocumentNode<any, any> = gql`
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
        data
        createdAt
      }
    }
  }
`;

export const CREATE_AI_CHAT_CONVERSATION : TypedDocumentNode<any, any> = gql`
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
        data
        createdAt
      }
    }
  }
`;

export const DELETE_AI_CHAT_CONVERSATION : TypedDocumentNode<any, any> = gql`
  mutation DeleteAIChatConversation($id: ID!, $organizationId: ID!) {
    deleteAIChatConversation(id: $id, organizationId: $organizationId)
  }
`;

export const RENAME_AI_CHAT_CONVERSATION : TypedDocumentNode<any, any> = gql`
  mutation RenameAIChatConversation($id: ID!, $organizationId: ID!, $title: String!) {
    renameAIChatConversation(id: $id, organizationId: $organizationId, title: $title) {
      id
      title
    }
  }
`;

export const AI_TOKEN_USAGE : TypedDocumentNode<any, any> = gql`
  query AITokenUsage($organizationId: ID!) {
    aiTokenUsage(organizationId: $organizationId) {
      used
      limit
      resetAt
    }
  }
`;


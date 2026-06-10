/* eslint-disable @typescript-eslint/no-explicit-any */
import { gql } from '@apollo/client';
import type { TypedDocumentNode } from '@apollo/client';

export const GET_TEMPLATES : TypedDocumentNode<any, any> = gql`
  query GetTemplates($category: String) {
    templates(category: $category) {
      id
      name
      description
      category
      isActive
      createdAt
      updatedAt
    }
  }
`;

export const GET_TEMPLATE : TypedDocumentNode<any, any> = gql`
  query GetTemplate($id: ID!) {
    template(id: $id) {
      id
      name
      description
      category
      formSchema
      isActive
      createdAt
      updatedAt
    }
  }
`;

export const GET_TEMPLATE_CATEGORIES : TypedDocumentNode<any, any> = gql`
  query GetTemplateCategories {
    templateCategories
  }
`;

export const CREATE_TEMPLATE : TypedDocumentNode<any, any> = gql`
  mutation CreateTemplate($input: CreateTemplateInput!) {
    createTemplate(input: $input) {
      id
      name
      description
      category
      isActive
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_TEMPLATE : TypedDocumentNode<any, any> = gql`
  mutation UpdateTemplate($id: ID!, $input: UpdateTemplateInput!) {
    updateTemplate(id: $id, input: $input) {
      id
      name
      description
      category
      isActive
      createdAt
      updatedAt
    }
  }
`;

export const DELETE_TEMPLATE : TypedDocumentNode<any, any> = gql`
  mutation DeleteTemplate($id: ID!) {
    deleteTemplate(id: $id)
  }
`;
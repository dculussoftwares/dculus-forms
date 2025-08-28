import { gql } from '@apollo/client';

export const GET_TEMPLATES = gql`
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

export const GET_TEMPLATE = gql`
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

export const GET_TEMPLATE_CATEGORIES = gql`
  query GetTemplateCategories {
    templateCategories
  }
`;

export const CREATE_TEMPLATE = gql`
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

export const UPDATE_TEMPLATE = gql`
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

export const DELETE_TEMPLATE = gql`
  mutation DeleteTemplate($id: ID!) {
    deleteTemplate(id: $id)
  }
`;
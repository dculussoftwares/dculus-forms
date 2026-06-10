import { gql } from '@apollo/client';
import type { TypedDocumentNode } from '@apollo/client';

export const GET_TEMPLATES : TypedDocumentNode<any, any> = gql`
  query Templates($category: String) {
    templates(category: $category) {
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

export const GET_TEMPLATE_BY_ID : TypedDocumentNode<any, any> = gql`
  query GetTemplateById($id: ID!) {
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

export const CREATE_TEMPLATE : TypedDocumentNode<any, any> = gql`
  mutation CreateTemplate($input: CreateTemplateInput!) {
    createTemplate(input: $input) {
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

export const UPDATE_TEMPLATE : TypedDocumentNode<any, any> = gql`
  mutation UpdateTemplate($id: ID!, $input: UpdateTemplateInput!) {
    updateTemplate(id: $id, input: $input) {
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

export const DELETE_TEMPLATE : TypedDocumentNode<any, any> = gql`
  mutation DeleteTemplate($id: ID!) {
    deleteTemplate(id: $id) {
      success
      message
    }
  }
`;

export const GET_TEMPLATES_BY_CATEGORY : TypedDocumentNode<any, any> = gql`
  query GetTemplatesByCategory {
    templatesByCategory {
      category
      templates {
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
  }
`;

export const CREATE_FORM_FROM_TEMPLATE : TypedDocumentNode<any, any> = gql`
  mutation CreateFormFromTemplate($templateId: ID!, $title: String!, $description: String, $organizationId: ID!) {
    createFormFromTemplate(templateId: $templateId, title: $title, description: $description, organizationId: $organizationId) {
      id
      title
      description
      formSchema
      isPublished
      organization {
        id
        name
        slug
      }
      createdBy {
        id
        name
        email
      }
      createdAt
      updatedAt
    }
  }
`;

export const UPLOAD_FILE : TypedDocumentNode<any, any> = gql`
  mutation UploadFile($input: UploadFileInput!) {
    uploadFile(input: $input) {
      key
      type
      url
      originalName
      size
      mimeType
    }
  }
`;

export const DELETE_FILE : TypedDocumentNode<any, any> = gql`
  mutation DeleteFile($key: String!) {
    deleteFile(key: $key) {
      success
      message
    }
  }
`;

export const GET_FORM_FILES : TypedDocumentNode<any, any> = gql`
  query GetFormFiles($formId: ID!, $type: String) {
    getFormFiles(formId: $formId, type: $type) {
      id
      key
      type
      formId
      originalName
      url
      size
      mimeType
      createdAt
      updatedAt
    }
  }
`;

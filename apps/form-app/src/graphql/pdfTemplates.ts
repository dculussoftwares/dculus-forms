import { gql } from '@apollo/client';
import type { TypedDocumentNode } from '@apollo/client';

/**
 * GraphQL Queries and Mutations for PDF Templates (issue #87)
 */

// ============================================================================
// QUERIES
// ============================================================================

export const GET_PDF_TEMPLATES: TypedDocumentNode<any, any> = gql`
  query GetPdfTemplates($formId: ID!) {
    pdfTemplates(formId: $formId) {
      id
      formId
      name
      fileKey
      fileName
      pageCount
      createdAt
      updatedAt
    }
  }
`;

export const GET_PDF_TEMPLATE: TypedDocumentNode<any, any> = gql`
  query GetPdfTemplate($id: ID!) {
    pdfTemplate(id: $id) {
      id
      formId
      name
      template
      fileKey
      fileName
      pageCount
      basePdfUrl
      createdAt
      updatedAt
    }
  }
`;

// ============================================================================
// MUTATIONS
// ============================================================================

export const CREATE_PDF_TEMPLATE: TypedDocumentNode<any, any> = gql`
  mutation CreatePdfTemplate($input: CreatePdfTemplateInput!) {
    createPdfTemplate(input: $input) {
      id
      formId
      name
      fileKey
      fileName
      pageCount
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_PDF_TEMPLATE: TypedDocumentNode<any, any> = gql`
  mutation UpdatePdfTemplate($id: ID!, $input: UpdatePdfTemplateInput!) {
    updatePdfTemplate(id: $id, input: $input) {
      id
      name
      pageCount
      updatedAt
    }
  }
`;

export const DELETE_PDF_TEMPLATE: TypedDocumentNode<any, any> = gql`
  mutation DeletePdfTemplate($id: ID!) {
    deletePdfTemplate(id: $id)
  }
`;

export const PREVIEW_PDF_TEMPLATE: TypedDocumentNode<any, any> = gql`
  mutation PreviewPdfTemplate($templateId: ID!, $template: JSON, $responseId: ID, $aiSampleData: Boolean) {
    previewPdfTemplate(templateId: $templateId, template: $template, responseId: $responseId, aiSampleData: $aiSampleData) {
      downloadUrl
      expiresAt
      filename
    }
  }
`;

export const GENERATE_PDF_FROM_RESPONSE: TypedDocumentNode<any, any> = gql`
  mutation GeneratePdfFromResponse($templateId: ID!, $responseId: ID!) {
    generatePdfFromResponse(templateId: $templateId, responseId: $responseId) {
      downloadUrl
      expiresAt
      filename
    }
  }
`;

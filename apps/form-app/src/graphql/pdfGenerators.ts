import { gql } from '@apollo/client';
import type { TypedDocumentNode } from '@apollo/client';

/**
 * GraphQL Queries and Mutations for PDF Generators — saved template+filter
 * combos for bulk/repeatable PDF generation from responses.
 */

// ============================================================================
// QUERIES
// ============================================================================

export const GET_PDF_GENERATORS: TypedDocumentNode<any, any> = gql`
  query GetPdfGenerators($formId: ID!) {
    pdfGenerators(formId: $formId) {
      id
      formId
      templateId
      name
      columnName
      filenameFieldId
      filters
      filterLogic
      autoRunOnSubmit
      enabled
      createdAt
      updatedAt
      matchingResponseCount
      template {
        id
        name
      }
      latestRun {
        id
        trigger
        status
        totalCount
        processedCount
        succeededCount
        failedCount
        errorMessage
        startedAt
        completedAt
      }
    }
  }
`;

export const GET_PDF_GENERATOR: TypedDocumentNode<any, any> = gql`
  query GetPdfGenerator($id: ID!) {
    pdfGenerator(id: $id) {
      id
      formId
      templateId
      name
      columnName
      filenameFieldId
      filters
      filterLogic
      autoRunOnSubmit
      enabled
      createdAt
      updatedAt
      matchingResponseCount
      template {
        id
        name
      }
    }
  }
`;

export const GET_PDF_GENERATION_RUN_STATUS: TypedDocumentNode<any, any> = gql`
  query GetPdfGenerationRunStatus($generatorId: ID!) {
    pdfGenerationRunStatus(generatorId: $generatorId) {
      id
      generatorId
      trigger
      status
      totalCount
      processedCount
      succeededCount
      failedCount
      errorMessage
      startedAt
      completedAt
    }
  }
`;

export const GET_PDF_GENERATION_RESULT: TypedDocumentNode<any, any> = gql`
  query GetPdfGenerationResult($generatorId: ID!, $responseId: ID!) {
    pdfGenerationResult(generatorId: $generatorId, responseId: $responseId) {
      id
      status
      filename
      errorMessage
      generatedAt
      downloadUrl
    }
  }
`;

export const GET_PDF_GENERATION_RESULTS: TypedDocumentNode<any, any> = gql`
  query GetPdfGenerationResults($generatorId: ID!) {
    pdfGenerationResults(generatorId: $generatorId) {
      id
      responseId
      status
      filename
      errorMessage
      generatedAt
      downloadUrl
    }
  }
`;

export const PREVIEW_PDF_GENERATOR_MATCH_COUNT: TypedDocumentNode<any, any> = gql`
  query PreviewPdfGeneratorMatchCount($formId: ID!, $filters: [ResponseFilterInput!], $filterLogic: FilterLogic) {
    previewPdfGeneratorMatchCount(formId: $formId, filters: $filters, filterLogic: $filterLogic)
  }
`;

// ============================================================================
// MUTATIONS
// ============================================================================

export const CREATE_PDF_GENERATOR: TypedDocumentNode<any, any> = gql`
  mutation CreatePdfGenerator($input: CreatePdfGeneratorInput!) {
    createPdfGenerator(input: $input) {
      id
      formId
      templateId
      name
      columnName
      filenameFieldId
      filters
      filterLogic
      autoRunOnSubmit
      enabled
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_PDF_GENERATOR: TypedDocumentNode<any, any> = gql`
  mutation UpdatePdfGenerator($id: ID!, $input: UpdatePdfGeneratorInput!) {
    updatePdfGenerator(id: $id, input: $input) {
      id
      templateId
      name
      columnName
      filenameFieldId
      filters
      filterLogic
      autoRunOnSubmit
      enabled
      updatedAt
    }
  }
`;

export const DELETE_PDF_GENERATOR: TypedDocumentNode<any, any> = gql`
  mutation DeletePdfGenerator($id: ID!) {
    deletePdfGenerator(id: $id)
  }
`;

export const START_PDF_GENERATION_RUN: TypedDocumentNode<any, any> = gql`
  mutation StartPdfGenerationRun($generatorId: ID!) {
    startPdfGenerationRun(generatorId: $generatorId) {
      id
      status
      totalCount
      processedCount
      succeededCount
      failedCount
    }
  }
`;

export const CANCEL_PDF_GENERATION_RUN: TypedDocumentNode<any, any> = gql`
  mutation CancelPdfGenerationRun($runId: ID!) {
    cancelPdfGenerationRun(runId: $runId) {
      id
      status
    }
  }
`;

export const GENERATE_PDF_FROM_GENERATOR: TypedDocumentNode<any, any> = gql`
  mutation GeneratePdfFromGenerator($generatorId: ID!, $responseId: ID!) {
    generatePdfFromGenerator(generatorId: $generatorId, responseId: $responseId) {
      downloadUrl
      expiresAt
      filename
    }
  }
`;

export const DOWNLOAD_PDF_GENERATION_RESULTS_ZIP: TypedDocumentNode<any, any> = gql`
  mutation DownloadPdfGenerationResultsZip($generatorId: ID!) {
    downloadPdfGenerationResultsZip(generatorId: $generatorId) {
      downloadUrl
      expiresAt
      filename
    }
  }
`;

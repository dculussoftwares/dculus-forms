import { gql } from '@apollo/client';
import type { TypedDocumentNode } from '@apollo/client';

/**
 * Respondent-uploaded files: the Files view catalog, single-file links and
 * "download as ZIP" export jobs.
 */

export type ResponseFileGrouping = 'QUESTION' | 'RESPONSE';
export type ResponseFileExportStatus = 'running' | 'completed' | 'failed';

export interface ResponseFile {
  key: string;
  responseId: string;
  submittedAt: string;
  respondentEmail: string | null;
  fieldId: string;
  fieldLabel: string;
  originalName: string;
  size: number | null;
  mimeType: string | null;
}

export interface ResponseFileQuestion {
  fieldId: string;
  label: string;
  fileCount: number;
}

export interface ResponseFileCatalog {
  questions: ResponseFileQuestion[];
  files: ResponseFile[];
  totalCount: number;
  totalBytes: number;
  truncated: boolean;
}

export interface ResponseFileExport {
  id: string;
  formId: string;
  status: ResponseFileExportStatus;
  grouping: ResponseFileGrouping;
  totalCount: number;
  processedCount: number;
  totalBytes: number;
  filename: string | null;
  errorMessage: string | null;
  expired: boolean;
}

export interface ResponseFilterVariable {
  fieldId: string;
  operator: string;
  value?: string;
  values?: string[];
  dateRange?: { from?: string; to?: string };
  numberRange?: { min?: number; max?: number };
}

interface ResponseFileScope {
  formId: string;
  filters?: ResponseFilterVariable[] | null;
  filterLogic?: 'AND' | 'OR';
  responseIds?: string[];
}

const RESPONSE_FILE_EXPORT_FIELDS = gql`
  fragment ResponseFileExportFields on ResponseFileExport {
    id
    formId
    status
    grouping
    totalCount
    processedCount
    totalBytes
    filename
    errorMessage
    expired
  }
`;

export const GET_RESPONSE_FILES: TypedDocumentNode<
  { responseFiles: ResponseFileCatalog },
  ResponseFileScope
> = gql`
  query GetResponseFiles(
    $formId: ID!
    $filters: [ResponseFilterInput!]
    $filterLogic: FilterLogic
    $responseIds: [ID!]
  ) {
    responseFiles(formId: $formId, filters: $filters, filterLogic: $filterLogic, responseIds: $responseIds) {
      questions {
        fieldId
        label
        fileCount
      }
      files {
        key
        responseId
        submittedAt
        respondentEmail
        fieldId
        fieldLabel
        originalName
        size
        mimeType
      }
      totalCount
      totalBytes
      truncated
    }
  }
`;

export const GET_RESPONSE_FILE_URL: TypedDocumentNode<
  { getResponseFileDownloadUrl: string },
  { key: string; preview?: boolean }
> = gql`
  query GetResponseFileUrl($key: String!, $preview: Boolean) {
    getResponseFileDownloadUrl(key: $key, preview: $preview)
  }
`;

export const GET_RESPONSE_FILE_EXPORT: TypedDocumentNode<
  { responseFileExport: ResponseFileExport },
  { id: string }
> = gql`
  ${RESPONSE_FILE_EXPORT_FIELDS}
  query GetResponseFileExport($id: ID!) {
    responseFileExport(id: $id) {
      ...ResponseFileExportFields
    }
  }
`;

export const START_RESPONSE_FILE_EXPORT: TypedDocumentNode<
  { startResponseFileExport: ResponseFileExport },
  ResponseFileScope & { grouping: ResponseFileGrouping; fileKeys?: string[] }
> = gql`
  ${RESPONSE_FILE_EXPORT_FIELDS}
  mutation StartResponseFileExport(
    $formId: ID!
    $grouping: ResponseFileGrouping
    $filters: [ResponseFilterInput!]
    $filterLogic: FilterLogic
    $responseIds: [ID!]
    $fileKeys: [String!]
  ) {
    startResponseFileExport(
      formId: $formId
      grouping: $grouping
      filters: $filters
      filterLogic: $filterLogic
      responseIds: $responseIds
      fileKeys: $fileKeys
    ) {
      ...ResponseFileExportFields
    }
  }
`;

export const GET_RESPONSE_FILE_EXPORT_DOWNLOAD_URL: TypedDocumentNode<
  { responseFileExportDownloadUrl: { downloadUrl: string; filename: string } },
  { id: string }
> = gql`
  mutation ResponseFileExportDownloadUrl($id: ID!) {
    responseFileExportDownloadUrl(id: $id) {
      downloadUrl
      filename
    }
  }
`;

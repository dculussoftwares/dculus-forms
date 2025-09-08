import { gql } from '@apollo/client';

export const GET_ACTIVE_ORGANIZATION = gql`
  query GetActiveOrganization {
    activeOrganization {
      id
      name
      slug
    }
  }
`;

export const GET_FORMS = gql`
  query GetForms($organizationId: ID!) {
    forms(organizationId: $organizationId) {
      id
      title
      description
      shortUrl
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
      metadata {
        pageCount
        fieldCount
        backgroundImageKey
        backgroundImageUrl
        lastUpdated
      }
    }
  }
`;

export const GET_FORMS_DASHBOARD = gql`
  query GetFormsDashboard($organizationId: ID!) {
    forms(organizationId: $organizationId) {
      id
      title
      description
      shortUrl
      isPublished
      createdAt
      updatedAt
      metadata {
        pageCount
        fieldCount
        backgroundImageKey
        backgroundImageUrl
        lastUpdated
      }
    }
  }
`;

export const GET_FORM_BY_ID = gql`
  query GetFormById($id: ID!) {
    form(id: $id) {
      id
      title
      description
      shortUrl
      isPublished
      formSchema
      settings {
        thankYou {
          enabled
          message
        }
      }
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
      metadata {
        pageCount
        fieldCount
        backgroundImageKey
        backgroundImageUrl
        lastUpdated
      }
    }
  }
`;

export const GET_FORM_RESPONSES = gql`
  query GetFormResponses($formId: ID!, $page: Int = 1, $limit: Int = 10, $sortBy: String = "submittedAt", $sortOrder: String = "desc") {
    responsesByForm(formId: $formId, page: $page, limit: $limit, sortBy: $sortBy, sortOrder: $sortOrder) {
      data {
        id
        formId
        data
        submittedAt
      }
      total
      page
      limit
      totalPages
    }
  }
`;

export const GET_ALL_FORM_RESPONSES = gql`
  query GetAllFormResponses($formId: ID!) {
    responsesByForm(formId: $formId, page: 1, limit: 10000, sortBy: "submittedAt", sortOrder: "desc") {
      data {
        id
        formId
        data
        submittedAt
      }
      total
    }
  }
`;

export const GENERATE_FORM_RESPONSE_REPORT = gql`
  mutation GenerateFormResponseReport($formId: ID!, $format: ExportFormat!) {
    generateFormResponseReport(formId: $formId, format: $format) {
      downloadUrl
      expiresAt
      filename
      format
    }
  }
`;

export const GET_FORM_ANALYTICS = gql`
  query GetFormAnalytics($formId: ID!, $timeRange: TimeRangeInput) {
    formAnalytics(formId: $formId, timeRange: $timeRange) {
      totalViews
      uniqueSessions
      topCountries {
        code
        name
        count
        percentage
      }
      topOperatingSystems {
        name
        count
        percentage
      }
      topBrowsers {
        name
        count
        percentage
      }
      viewsOverTime {
        date
        views
        sessions
      }
    }
  }
`;

export const GET_FORM_SUBMISSION_ANALYTICS = gql`
  query GetFormSubmissionAnalytics($formId: ID!, $timeRange: TimeRangeInput) {
    formSubmissionAnalytics(formId: $formId, timeRange: $timeRange) {
      totalSubmissions
      uniqueSessions
      averageCompletionTime
      completionTimePercentiles {
        p50
        p75
        p90
        p95
      }
      topCountries {
        code
        name
        count
        percentage
      }
      topOperatingSystems {
        name
        count
        percentage
      }
      topBrowsers {
        name
        count
        percentage
      }
      submissionsOverTime {
        date
        submissions
        sessions
      }
      completionTimeDistribution {
        label
        minSeconds
        maxSeconds
        count
        percentage
      }
    }
  }
`;

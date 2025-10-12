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


export const GET_FORMS_WITH_CATEGORY = gql`
  query GetFormsWithCategory($organizationId: ID!, $category: FormCategory!) {
    formsWithCategory(organizationId: $organizationId, category: $category) {
      id
      title
      description
      shortUrl
      isPublished
      sharingScope
      defaultPermission
      userPermission
      category
      responseCount
      createdAt
      updatedAt
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

export const GET_MY_FORMS_WITH_CATEGORY = gql`
  query GetMyFormsWithCategory($organizationId: ID!, $page: Int = 1, $limit: Int = 10, $filters: FormsFilterInput) {
    formsWithCategory(organizationId: $organizationId, category: MY_FORMS, page: $page, limit: $limit, filters: $filters) {
      forms {
        id
        title
        description
        shortUrl
        isPublished
        sharingScope
        defaultPermission
        userPermission
        category
        responseCount
        createdAt
        updatedAt
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
        metadata {
          pageCount
          fieldCount
          backgroundImageKey
          backgroundImageUrl
          lastUpdated
        }
      }
      totalCount
      page
      limit
      totalPages
      hasNextPage
      hasPreviousPage
    }
  }
`;

export const GET_SHARED_FORMS_WITH_CATEGORY = gql`
  query GetSharedFormsWithCategory($organizationId: ID!, $page: Int = 1, $limit: Int = 10, $filters: FormsFilterInput) {
    formsWithCategory(organizationId: $organizationId, category: SHARED_WITH_ME, page: $page, limit: $limit, filters: $filters) {
      forms {
        id
        title
        description
        shortUrl
        isPublished
        sharingScope
        defaultPermission
        userPermission
        category
        responseCount
        createdAt
        updatedAt
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
        metadata {
          pageCount
          fieldCount
          backgroundImageKey
          backgroundImageUrl
          lastUpdated
        }
      }
      totalCount
      page
      limit
      totalPages
      hasNextPage
      hasPreviousPage
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
      responseCount
      sharingScope
      defaultPermission
      userPermission
      settings {
        thankYou {
          enabled
          message
        }
        submissionLimits {
          maxResponses {
            enabled
            limit
          }
          timeWindow {
            enabled
            startDate
            endDate
          }
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
      dashboardStats {
        averageCompletionTime
        responseRate
        responsesToday
        responsesThisWeek
        responsesThisMonth
      }
    }
  }
`;

export const GET_FORM_RESPONSES = gql`
  query GetFormResponses($formId: ID!, $page: Int = 1, $limit: Int = 10, $sortBy: String = "submittedAt", $sortOrder: String = "desc", $filters: [ResponseFilterInput!]) {
    responsesByForm(formId: $formId, page: $page, limit: $limit, sortBy: $sortBy, sortOrder: $sortOrder, filters: $filters) {
      data {
        id
        formId
        data
        submittedAt
        hasBeenEdited
        totalEdits
        lastEditedAt
        lastEditedBy {
          id
          name
          email
        }
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
  mutation GenerateFormResponseReport($formId: ID!, $format: ExportFormat!, $filters: [ResponseFilterInput!]) {
    generateFormResponseReport(formId: $formId, format: $format, filters: $filters) {
      downloadUrl
      expiresAt
      filename
      format
    }
  }
`;

export const GET_RESPONSE_BY_ID = gql`
  query GetResponseById($id: ID!) {
    response(id: $id) {
      id
      formId
      data
      submittedAt
    }
  }
`;

export const UPDATE_RESPONSE = gql`
  mutation UpdateResponse($input: UpdateResponseInput!) {
    updateResponse(input: $input) {
      id
      formId
      data
      submittedAt
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

export const GET_INVITATION_PUBLIC = gql`
  query GetInvitationPublic($id: ID!) {
    getInvitationPublic(id: $id) {
      id
      email
      role
      status
      expiresAt
      createdAt
      organization {
        id
        name
        slug
      }
      inviter {
        id
        name
        email
      }
    }
  }
`;

export const GET_USER_ORGANIZATIONS = gql`
  query GetUserOrganizations {
    me {
      id
      organizations {
        id
        name
        slug
        logo
        members {
          id
          role
          user {
            id
            name
            email
          }
        }
      }
    }
  }
`;

// Response Edit History Queries
export const GET_RESPONSE_EDIT_HISTORY = gql`
  query GetResponseEditHistory($responseId: ID!) {
    responseEditHistory(responseId: $responseId) {
      id
      responseId
      editedBy {
        id
        name
        email
        image
      }
      editedAt
      editType
      editReason
      ipAddress
      userAgent
      totalChanges
      changesSummary
      fieldChanges {
        id
        fieldId
        fieldLabel
        fieldType
        previousValue
        newValue
        changeType
        valueChangeSize
      }
    }
  }
`;

// Response Edit History Mutations
export const UPDATE_RESPONSE_WITH_TRACKING = gql`
  mutation UpdateResponseWithTracking($input: UpdateResponseInput!) {
    updateResponse(input: $input) {
      id
      formId
      data
      submittedAt
      hasBeenEdited
      lastEditedAt
      totalEdits
    }
  }
`;

// Enhanced response query with edit tracking fields
export const GET_RESPONSE_WITH_EDIT_INFO = gql`
  query GetResponseWithEditInfo($id: ID!) {
    response(id: $id) {
      id
      formId
      data
      submittedAt
      editHistory {
        id
        editedBy {
          id
          name
          email
          image
        }
        editedAt
        editType
        changesSummary
        totalChanges
      }
    }
  }
`;

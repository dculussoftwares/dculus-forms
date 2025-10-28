import { gql } from '@apollo/client';

export const ACTIVE_ORGANIZATION = gql`
  query ActiveOrganization {
    activeOrganization {
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
`;

export const GET_MY_FORMS_WITH_CATEGORY = gql`
  query GetMyFormsWithCategory(
    $organizationId: ID!
    $page: Int = 1
    $limit: Int = 12
    $filters: FormsFilterInput
  ) {
    formsWithCategory(
      organizationId: $organizationId
      category: MY_FORMS
      page: $page
      limit: $limit
      filters: $filters
    ) {
      forms {
        id
        title
        description
        shortUrl
        isPublished
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
          lastUpdated
          backgroundImageKey
          backgroundImageUrl
        }
        userPermission
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
  query GetSharedFormsWithCategory(
    $organizationId: ID!
    $page: Int = 1
    $limit: Int = 12
    $filters: FormsFilterInput
  ) {
    formsWithCategory(
      organizationId: $organizationId
      category: SHARED_WITH_ME
      page: $page
      limit: $limit
      filters: $filters
    ) {
      forms {
        id
        title
        description
        shortUrl
        isPublished
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
          lastUpdated
          backgroundImageKey
          backgroundImageUrl
        }
        userPermission
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
        lastUpdated
        backgroundImageKey
        backgroundImageUrl
      }
      dashboardStats {
        averageCompletionTime
        responseRate
        responsesToday
        responsesThisWeek
        responsesThisMonth
      }
      userPermission
    }
  }
`;

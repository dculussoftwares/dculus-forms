import { gql } from '@apollo/client';

export const DELETE_FORM = gql`
  mutation DeleteForm($id: ID!) {
    deleteForm(id: $id)
  }
`;

export const UPDATE_FORM = gql`
  mutation UpdateForm($id: ID!, $input: UpdateFormInput!) {
    updateForm(id: $id, input: $input) {
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
    }
  }
`;

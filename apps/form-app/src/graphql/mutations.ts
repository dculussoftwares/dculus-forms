import { gql } from '@apollo/client';

export const CREATE_ORGANIZATION = gql`
  mutation CreateOrganization($name: String!) {
    createOrganization(name: $name) {
      id
      name
      slug
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

export const CREATE_FORM = gql`
  mutation CreateForm($input: CreateFormInput!) {
    createForm(input: $input) {
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
    }
  }
`;

export const UPDATE_FORM = gql`
  mutation UpdateForm($id: ID!, $input: UpdateFormInput!) {
    updateForm(id: $id, input: $input) {
      id
      title
      description
      shortUrl
      responseCount
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

export const DELETE_FORM = gql`
  mutation DeleteForm($id: ID!) {
    deleteForm(id: $id)
  }
`;

export const REGENERATE_SHORT_URL = gql`
  mutation RegenerateShortUrl($id: ID!) {
    regenerateShortUrl(id: $id) {
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
    }
  }
`;


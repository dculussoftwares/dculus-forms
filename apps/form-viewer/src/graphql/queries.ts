import { gql } from '@apollo/client';

export const GET_FORM_BY_SHORT_URL = gql`
  query GetFormByShortUrl($shortUrl: String!) {
    formByShortUrl(shortUrl: $shortUrl) {
      id
      title
      description
      shortUrl
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

export const SUBMIT_RESPONSE = gql`
  mutation SubmitResponse($input: SubmitResponseInput!) {
    submitResponse(input: $input) {
      id
      formId
      data
      submittedAt
    }
  }
`;
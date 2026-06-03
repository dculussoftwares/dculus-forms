import { gql } from '@apollo/client';

export const GET_FORM_BY_SHORT_URL = gql`
  query GetFormByShortUrl($shortUrl: String!) {
    formByShortUrl(shortUrl: $shortUrl) {
      id
      title
      description
      shortUrl
      formSchema
      settings {
        submissionLimits {
          timeWindow {
            enabled
            startDate
            endDate
          }
          maxResponses {
            enabled
            limit
          }
        }
      }
      organization {
        id
        name
        slug
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
      thankYouMessage
      showCustomThankYou
    }
  }
`;


import { gql } from '@apollo/client';
import type { TypedDocumentNode } from '@apollo/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const GET_FORM_BY_SHORT_URL: TypedDocumentNode<any, any> = gql`
  query GetFormByShortUrl($shortUrl: String!) {
    formByShortUrl(shortUrl: $shortUrl) {
      id
      title
      description
      shortUrl
      formSchemaPublic
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
        responseCopy {
          enabled
          mode
          emailFieldId
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const SUBMIT_RESPONSE: TypedDocumentNode<any, any> = gql`
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


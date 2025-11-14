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
      thankYouMessage
      showCustomThankYou
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
      topRegions {
        name
        code
        countryCode
        count
        percentage
      }
      topCities {
        name
        region
        countryCode
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
    }
  }
`;

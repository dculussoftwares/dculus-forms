import { gql } from '@apollo/client';
import type { TypedDocumentNode } from '@apollo/client';

export const CREATE_ORGANIZATION : TypedDocumentNode<any, any> = gql`
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

export const SET_ACCOUNT_PASSWORD : TypedDocumentNode<any, any> = gql`
  mutation SetAccountPassword($password: String!) {
    setAccountPassword(password: $password)
  }
`;

export const CREATE_FORM : TypedDocumentNode<any, any> = gql`
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

export const UPDATE_FORM : TypedDocumentNode<any, any> = gql`
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
        responseCopy {
          enabled
          mode
          emailFieldId
          pdfTemplateId
          subject
        }
        accessControl {
          enabled
          requireSignIn
          allowedDomains
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

export const DELETE_FORM : TypedDocumentNode<any, any> = gql`
  mutation DeleteForm($id: ID!) {
    deleteForm(id: $id)
  }
`;

export const REGENERATE_SHORT_URL : TypedDocumentNode<any, any> = gql`
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const DUPLICATE_FORM: TypedDocumentNode<any, any> = gql`
  mutation DuplicateForm($id: ID!) {
    duplicateForm(id: $id) {
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

export const DELETE_RESPONSE : TypedDocumentNode<any, any> = gql`
  mutation DeleteResponse($id: ID!) {
    deleteResponse(id: $id)
  }
`;

export const DELETE_RESPONSES : TypedDocumentNode<any, any> = gql`
  mutation DeleteResponses($formId: ID!, $ids: [ID!]!) {
    deleteResponses(formId: $formId, ids: $ids)
  }
`;

export const CREATE_TAG : TypedDocumentNode<any, any> = gql`
  mutation CreateTag($formId: ID!, $name: String!, $color: String) {
    createTag(formId: $formId, name: $name, color: $color) {
      id
      name
      color
    }
  }
`;

export const DELETE_TAG : TypedDocumentNode<any, any> = gql`
  mutation DeleteTag($id: ID!, $formId: ID!) {
    deleteTag(id: $id, formId: $formId)
  }
`;

export const ADD_TAG_TO_RESPONSE : TypedDocumentNode<any, any> = gql`
  mutation AddTagToResponse($responseId: ID!, $tagId: ID!) {
    addTagToResponse(responseId: $responseId, tagId: $tagId)
  }
`;

export const REMOVE_TAG_FROM_RESPONSE : TypedDocumentNode<any, any> = gql`
  mutation RemoveTagFromResponse($responseId: ID!, $tagId: ID!) {
    removeTagFromResponse(responseId: $responseId, tagId: $tagId)
  }
`;

export const GENERATE_FORM_WITH_AI : TypedDocumentNode<any, any> = gql`
  mutation GenerateFormWithAI($prompt: String!, $organizationId: ID!, $mode: AIFormMode) {
    generateFormWithAI(prompt: $prompt, organizationId: $organizationId, mode: $mode) {
      suggestedTitle
      tokensUsed
      fields {
        type
        label
        placeholder
        required
        options {
          value
          label
        }
      }
      layout {
        content
        customCTAButtonName
      }
    }
  }
`;


export const SUBMIT_RESPONSE : TypedDocumentNode<any, any> = gql`
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const DELETE_PREVIEW_RESPONSES: TypedDocumentNode<any, any> = gql`
  mutation DeletePreviewResponses($formId: ID!) {
    deletePreviewResponses(formId: $formId)
  }
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const GENERATE_FAKE_RESPONSES: TypedDocumentNode<any, any> = gql`
  mutation GenerateFakeResponses($formId: ID!, $count: Int!) {
    generateFakeResponses(formId: $formId, count: $count)
  }
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const DELETE_AI_GENERATED_RESPONSES: TypedDocumentNode<any, any> = gql`
  mutation DeleteAiGeneratedResponses($formId: ID!) {
    deleteAiGeneratedResponses(formId: $formId)
  }
`;

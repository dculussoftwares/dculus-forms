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
      accessStatus
      # The signed-in respondent's own verified email + avatar (null unless
      # this form captures respondent identity and the caller is
      # authenticated). Drives the account header so a shared browser can't
      # submit silently under a previous respondent.
      respondentEmail
      respondentImage
      # Save-and-resume: the signed-in respondent's own draft, or null.
      myDraft {
        data
        currentPageId
        version
        startedAt
        updatedAt
      }
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
        accessControl {
          enabled
          requireSignIn
          allowedDomains
        }
        collectRespondentEmail
        saveProgress {
          enabled
        }
        # Native Quiz (epic #289, Story 16/#320, D9): lets form-viewer decide
        # whether to offer a "check your result later" link on the post-submit
        # screen — only relevant when the quiz defers release AND the form
        # captures respondent identity (accessControl/collectRespondentEmail).
        quiz {
          enabled
          gradeRelease
        }
        # Form Embed v1: the /embed/:shortUrl route refuses to render when the
        # owner has turned embedding off. Absent settings mean "never
        # configured", which is embeddable — a closed default would break every
        # form that predates the feature.
        embed {
          enabled
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
      grade {
        released
        score
        maxScore
        percentage
        passed
        message
        questions {
          fieldId
          label
          correct
          pointsAwarded
          pointValue
          yourAnswer
          correctAnswer
          feedback
        }
      }
    }
  }
`;

// Native Quiz (epic #289, Story 16/#320, D9): lets a signed-in respondent
// retrieve their OWN deferred-release grade later — the only other read path
// (`FormResponse.responseGrade`) requires form VIEWER+ permission, which a
// respondent never has. Returns null when the caller never submitted this
// form, or the form isn't a quiz — QuizResultPage treats both the same way
// (nothing to show yet).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MY_QUIZ_RESULT: TypedDocumentNode<any, any> = gql`
  query MyQuizResult($formId: ID!) {
    myQuizResult(formId: $formId) {
      released
      score
      maxScore
      percentage
      passed
      message
      questions {
        fieldId
        label
        correct
        pointsAwarded
        pointValue
        yourAnswer
        correctAnswer
        feedback
      }
    }
  }
`;


const RESPONSE_DRAFT_FIELDS = gql`
  fragment ResponseDraftFields on ResponseDraft {
    data
    currentPageId
    version
    startedAt
    updatedAt
  }
`;

export interface ResponseDraftData {
  data: Record<string, unknown>;
  currentPageId: string | null;
  version: number;
  startedAt: string;
  updatedAt: string;
}

export interface SaveResponseDraftResult {
  saveResponseDraft: { conflict: boolean; draft: ResponseDraftData };
}

export interface SaveResponseDraftVariables {
  input: {
    formId: string;
    data: Record<string, unknown>;
    currentPageId: string | null;
    baseVersion: number | null;
  };
}

export const SAVE_RESPONSE_DRAFT: TypedDocumentNode<SaveResponseDraftResult, SaveResponseDraftVariables> = gql`
  mutation SaveResponseDraft($input: SaveResponseDraftInput!) {
    saveResponseDraft(input: $input) {
      conflict
      draft {
        ...ResponseDraftFields
      }
    }
  }
  ${RESPONSE_DRAFT_FIELDS}
`;

export const DISCARD_RESPONSE_DRAFT: TypedDocumentNode<
  { discardResponseDraft: boolean },
  { formId: string }
> = gql`
  mutation DiscardResponseDraft($formId: ID!) {
    discardResponseDraft(formId: $formId)
  }
`;

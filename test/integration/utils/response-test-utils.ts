import { AuthUtils } from './auth-utils';

export interface ResponseData {
  [fieldId: string]: any;
}

export interface FormResponse {
  id: string;
  formId: string;
  data: ResponseData;
  submittedAt: string;
  thankYouMessage?: string;
  showCustomThankYou?: boolean;
  metadata?: any;
}

export class ResponseTestUtils {
  public authUtils: AuthUtils;
  private baseURL: string;

  constructor(baseURL: string = 'http://localhost:4000') {
    this.baseURL = baseURL;
    this.authUtils = new AuthUtils(baseURL);
  }

  /**
   * Submit a response to a form (public submission via shortUrl)
   */
  async submitResponse(shortUrl: string, data: ResponseData): Promise<FormResponse> {
    // First, get the form by shortUrl to get the formId
    const formQuery = `
      query GetFormByShortUrl($shortUrl: String!) {
        formByShortUrl(shortUrl: $shortUrl) {
          id
        }
      }
    `;

    const formResponse = await this.authUtils.axiosInstance.post('/graphql', {
      query: formQuery,
      variables: { shortUrl }
    });

    if (formResponse.data.errors) {
      throw new Error(`Failed to get form by shortUrl: ${formResponse.data.errors[0].message}`);
    }

    const formId = formResponse.data.data.formByShortUrl.id;

    // Now submit the response
    const mutation = `
      mutation SubmitResponse($input: SubmitResponseInput!) {
        submitResponse(input: $input) {
          id
          formId
          data
          submittedAt
          thankYouMessage
          showCustomThankYou
          metadata
        }
      }
    `;

    const input = {
      formId,
      data,
      sessionId: `test-session-${Date.now()}`,
      userAgent: 'Mozilla/5.0 (Test) AppleWebKit/537.36',
      timezone: 'America/New_York',
      language: 'en-US'
    };

    // Submit response without authentication (public form submission)
    const response = await this.authUtils.axiosInstance.post('/graphql', {
      query: mutation,
      variables: { input }
    });

    if (response.data.errors) {
      throw new Error(`Failed to submit response: ${response.data.errors[0].message}`);
    }

    return response.data.data.submitResponse;
  }

  /**
   * Get responses for a form (requires authentication)
   */
  async getResponses(
    token: string,
    formId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{ data: FormResponse[]; total: number; page: number; limit: number; totalPages: number }> {
    const query = `
      query GetResponsesByForm(
        $formId: ID!,
        $page: Int,
        $limit: Int
      ) {
        responsesByForm(
          formId: $formId,
          page: $page,
          limit: $limit
        ) {
          data {
            id
            formId
            data
            submittedAt
            metadata
          }
          total
          page
          limit
          totalPages
        }
      }
    `;

    const response = await this.authUtils.graphqlRequest(query, {
      formId,
      page,
      limit
    }, token);

    if (response.data.errors) {
      throw new Error(`Failed to get responses: ${response.data.errors[0].message}`);
    }

    return response.data.data.responsesByForm;
  }

  /**
   * Delete a response (requires authentication)
   */
  async deleteResponse(token: string, responseId: string): Promise<boolean> {
    const mutation = `
      mutation DeleteResponse($id: ID!) {
        deleteResponse(id: $id)
      }
    `;

    const response = await this.authUtils.graphqlRequest(mutation, { id: responseId }, token);

    if (response.data.errors) {
      throw new Error(`Failed to delete response: ${response.data.errors[0].message}`);
    }

    return response.data.data.deleteResponse;
  }

  /**
   * Generate sample response data based on field count
   */
  generateSampleResponseData(fieldCount: number): ResponseData {
    const data: ResponseData = {};

    for (let i = 1; i <= fieldCount; i++) {
      data[`field-${i}`] = `Sample data for field ${i}`;
    }

    return data;
  }
}

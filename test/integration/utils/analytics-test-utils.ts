import axios, { AxiosInstance } from 'axios';
import { nanoid } from 'nanoid';

/**
 * Analytics Test Utilities for Integration Tests
 *
 * Provides helper functions for testing form view and submission analytics
 */

export interface FormViewData {
  formId: string;
  sessionId?: string;
  userAgent?: string;
  operatingSystem?: string;
  browser?: string;
  browserVersion?: string;
  countryCode?: string;
  regionCode?: string;
  city?: string;
  timezone?: string;
  language?: string;
}

export interface FormSubmissionData {
  formId: string;
  responseId: string;
  sessionId?: string;
  completionTime?: number; // in seconds
}

export interface TimeRange {
  startDate: string; // ISO date string
  endDate: string; // ISO date string
}

export class AnalyticsTestUtils {
  private axiosInstance: AxiosInstance;
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.axiosInstance = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Track a form view
   */
  async trackFormView(formId: string, viewData?: Partial<FormViewData>): Promise<any> {
    const mutation = `
      mutation TrackFormView($input: TrackFormViewInput!) {
        trackFormView(input: $input) {
          success
        }
      }
    `;

    const defaultData: FormViewData = {
      formId,
      sessionId: viewData?.sessionId || nanoid(),
      userAgent: viewData?.userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      operatingSystem: viewData?.operatingSystem || 'macOS',
      browser: viewData?.browser || 'Chrome',
      browserVersion: viewData?.browserVersion || '120.0.0',
      countryCode: viewData?.countryCode || 'USA',
      timezone: viewData?.timezone || 'America/New_York',
      language: viewData?.language || 'en-US',
    };

    const variables = {
      input: {
        ...defaultData,
        ...viewData,
      },
    };

    const response = await this.graphqlRequest(mutation, variables);

    if (response.data.errors) {
      throw new Error(`Failed to track form view: ${response.data.errors[0].message}`);
    }

    return response.data.data.trackFormView;
  }

  /**
   * Get form view analytics
   */
  async getFormViewAnalytics(
    token: string,
    formId: string,
    timeRange?: TimeRange
  ): Promise<any> {
    const query = `
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

    const variables: any = { formId };
    if (timeRange) {
      variables.timeRange = timeRange;
    }

    const response = await this.graphqlRequest(query, variables, token);

    if (response.data.errors) {
      throw new Error(`Failed to get form analytics: ${response.data.errors[0].message}`);
    }

    return response.data.data.formAnalytics;
  }

  /**
   * Get form submission analytics
   */
  async getFormSubmissionAnalytics(
    token: string,
    formId: string,
    timeRange?: TimeRange
  ): Promise<any> {
    const query = `
      query GetFormSubmissionAnalytics($formId: ID!, $timeRange: TimeRangeInput) {
        formSubmissionAnalytics(formId: $formId, timeRange: $timeRange) {
          totalSubmissions
          averageCompletionTime
          submissionsByDate {
            date
            count
          }
        }
      }
    `;

    const variables: any = { formId };
    if (timeRange) {
      variables.timeRange = timeRange;
    }

    const response = await this.graphqlRequest(query, variables, token);

    if (response.data.errors) {
      throw new Error(
        `Failed to get submission analytics: ${response.data.errors[0].message}`
      );
    }

    return response.data.data.formSubmissionAnalytics;
  }

  /**
   * Get field-level analytics
   */
  async getFieldAnalytics(
    token: string,
    formId: string,
    fieldId: string
  ): Promise<any> {
    const query = `
      query GetFieldAnalytics($formId: ID!, $fieldId: String!) {
        fieldAnalytics(formId: $formId, fieldId: $fieldId) {
          fieldId
          fieldType
          totalResponses
          responseRate
          averageLength
          wordCloud {
            word
            count
            percentage
          }
          choiceDistribution {
            choice
            count
            percentage
          }
        }
      }
    `;

    const variables = { formId, fieldId };

    const response = await this.graphqlRequest(query, variables, token);

    if (response.data.errors) {
      throw new Error(`Failed to get field analytics: ${response.data.errors[0].message}`);
    }

    return response.data.data.fieldAnalytics;
  }

  /**
   * Generate bulk form views for testing
   */
  async generateBulkViews(
    formId: string,
    count: number,
    variance: boolean = true
  ): Promise<void> {
    const browsers = ['Chrome', 'Firefox', 'Safari', 'Edge'];
    const os = ['Windows', 'macOS', 'Linux', 'iOS', 'Android'];
    const countries = ['USA', 'CAN', 'GBR', 'DEU', 'FRA', 'JPN', 'AUS'];

    // Helper function for unbiased random array index selection
    const getRandomIndex = (arrayLength: number): number => {
      const randomBytes = new Uint32Array(1);
      crypto.getRandomValues(randomBytes);
      return randomBytes[0] % arrayLength;
    };

    for (let i = 0; i < count; i++) {
      const viewData: Partial<FormViewData> = {
        formId,
        sessionId: nanoid(),
      };

      if (variance) {
        viewData.browser = browsers[getRandomIndex(browsers.length)];
        viewData.operatingSystem = os[getRandomIndex(os.length)];
        viewData.countryCode = countries[getRandomIndex(countries.length)];
      }

      await this.trackFormView(formId, viewData);
    }
  }

  /**
   * Create a time range helper
   */
  createTimeRange(days: number): TimeRange {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };
  }

  /**
   * Create a custom time range
   */
  createCustomTimeRange(start: Date, end: Date): TimeRange {
    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    };
  }

  /**
   * Make a GraphQL request
   */
  private async graphqlRequest(
    query: string,
    variables: any,
    token?: string
  ): Promise<any> {
    const headers: any = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return await this.axiosInstance.post(
      '/graphql',
      {
        query,
        variables,
      },
      {
        headers,
      }
    );
  }
}

import axios, { AxiosInstance } from 'axios';
import { nanoid } from 'nanoid';

/**
 * Plugin Test Utilities for Integration Tests
 *
 * Provides helper functions for testing webhook, email, and quiz grading plugins
 */

export interface WebhookPluginConfig {
  url: string;
  headers?: Record<string, string>;
  method?: 'POST' | 'GET';
  retries?: number;
  timeout?: number;
}

export interface EmailPluginConfig {
  to: string | string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  isHTML?: boolean;
}

export interface QuizPluginConfig {
  questions: Array<{
    fieldId: string;
    correctAnswer: string | string[];
    marks: number;
  }>;
  passThreshold?: number; // Percentage (0-100)
}

export interface PluginExecutionLog {
  pluginId: string;
  pluginType: string;
  status: 'success' | 'failed' | 'timeout';
  executedAt: Date;
  error?: string;
  metadata?: any;
}

export class PluginTestUtils {
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
   * Create a webhook plugin for a form
   */
  async createWebhookPlugin(
    token: string,
    formId: string,
    config: WebhookPluginConfig
  ): Promise<any> {
    const mutation = `
      mutation CreatePlugin($input: CreatePluginInput!) {
        createPlugin(input: $input) {
          id
          formId
          type
          name
          config
          isEnabled
          order
          createdAt
        }
      }
    `;

    const variables = {
      input: {
        formId,
        type: 'webhook',
        name: 'Test Webhook Plugin',
        config: {
          url: config.url,
          headers: config.headers || {},
          method: config.method || 'POST',
          retries: config.retries ?? 3,
          timeout: config.timeout ?? 30000,
        },
        isEnabled: true,
      },
    };

    const response = await this.graphqlRequest(mutation, variables, token);

    if (response.data.errors) {
      throw new Error(`Failed to create webhook plugin: ${response.data.errors[0].message}`);
    }

    return response.data.data.createPlugin;
  }

  /**
   * Create an email plugin for a form
   */
  async createEmailPlugin(
    token: string,
    formId: string,
    config: EmailPluginConfig
  ): Promise<any> {
    const mutation = `
      mutation CreatePlugin($input: CreatePluginInput!) {
        createPlugin(input: $input) {
          id
          formId
          type
          name
          config
          isEnabled
          order
          createdAt
        }
      }
    `;

    const variables = {
      input: {
        formId,
        type: 'email',
        name: 'Test Email Plugin',
        config: {
          to: Array.isArray(config.to) ? config.to : [config.to],
          cc: config.cc || [],
          bcc: config.bcc || [],
          subject: config.subject,
          body: config.body,
          isHTML: config.isHTML ?? true,
        },
        isEnabled: true,
      },
    };

    const response = await this.graphqlRequest(mutation, variables, token);

    if (response.data.errors) {
      throw new Error(`Failed to create email plugin: ${response.data.errors[0].message}`);
    }

    return response.data.data.createPlugin;
  }

  /**
   * Create a quiz grading plugin for a form
   */
  async createQuizPlugin(
    token: string,
    formId: string,
    config: QuizPluginConfig
  ): Promise<any> {
    const mutation = `
      mutation CreatePlugin($input: CreatePluginInput!) {
        createPlugin(input: $input) {
          id
          formId
          type
          name
          config
          isEnabled
          order
          createdAt
        }
      }
    `;

    const variables = {
      input: {
        formId,
        type: 'quiz-grading',
        name: 'Test Quiz Grading Plugin',
        config: {
          questions: config.questions,
          passThreshold: config.passThreshold ?? 60,
        },
        isEnabled: true,
      },
    };

    const response = await this.graphqlRequest(mutation, variables, token);

    if (response.data.errors) {
      throw new Error(`Failed to create quiz plugin: ${response.data.errors[0].message}`);
    }

    return response.data.data.createPlugin;
  }

  /**
   * Get plugin execution logs from response metadata
   */
  async getPluginExecutionLogs(
    token: string,
    responseId: string
  ): Promise<PluginExecutionLog[]> {
    const query = `
      query GetResponse($id: ID!) {
        response(id: $id) {
          id
          metadata
        }
      }
    `;

    const response = await this.graphqlRequest(query, { id: responseId }, token);

    if (response.data.errors) {
      throw new Error(`Failed to get response: ${response.data.errors[0].message}`);
    }

    const metadata = response.data.data.response.metadata || {};

    // Extract plugin execution logs from metadata
    const logs: PluginExecutionLog[] = [];

    // Check for webhook metadata
    if (metadata.webhook) {
      logs.push({
        pluginId: metadata.webhook.pluginId || 'unknown',
        pluginType: 'webhook',
        status: metadata.webhook.status === 'success' ? 'success' : 'failed',
        executedAt: new Date(metadata.webhook.deliveredAt || metadata.webhook.executedAt),
        metadata: metadata.webhook,
      });
    }

    // Check for email metadata
    if (metadata.email) {
      logs.push({
        pluginId: metadata.email.pluginId || 'unknown',
        pluginType: 'email',
        status: metadata.email.deliveryStatus === 'sent' ? 'success' : 'failed',
        executedAt: new Date(metadata.email.sentAt || metadata.email.executedAt),
        metadata: metadata.email,
      });
    }

    // Check for quiz grading metadata
    if (metadata['quiz-grading']) {
      logs.push({
        pluginId: metadata['quiz-grading'].pluginId || 'unknown',
        pluginType: 'quiz-grading',
        status: 'success',
        executedAt: new Date(metadata['quiz-grading'].gradedAt || Date.now()),
        metadata: metadata['quiz-grading'],
      });
    }

    return logs;
  }

  /**
   * Wait for plugin execution to complete (polls response metadata)
   */
  async waitForPluginExecution(
    token: string,
    responseId: string,
    pluginType: string,
    timeout: number = 10000
  ): Promise<boolean> {
    const startTime = Date.now();
    const pollInterval = 500; // 500ms

    while (Date.now() - startTime < timeout) {
      const logs = await this.getPluginExecutionLogs(token, responseId);
      const pluginLog = logs.find((log) => log.pluginType === pluginType);

      if (pluginLog) {
        return true;
      }

      // Wait before polling again
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    return false;
  }

  /**
   * Get quiz results from response metadata
   */
  async getQuizResults(token: string, responseId: string): Promise<any> {
    const logs = await this.getPluginExecutionLogs(token, responseId);
    const quizLog = logs.find((log) => log.pluginType === 'quiz-grading');

    if (!quizLog) {
      throw new Error('Quiz grading results not found in response metadata');
    }

    return quizLog.metadata;
  }

  /**
   * Verify webhook delivery by checking mock server
   */
  verifyWebhookDelivery(
    receivedRequests: any[],
    expectedPayload: any
  ): boolean {
    return receivedRequests.some((req) => {
      const bodyMatches = JSON.stringify(req.body).includes(
        JSON.stringify(expectedPayload).slice(0, 50) // Partial match
      );
      return bodyMatches;
    });
  }

  /**
   * Make a GraphQL request
   */
  private async graphqlRequest(
    query: string,
    variables: any,
    token: string
  ): Promise<any> {
    return await this.axiosInstance.post(
      '/graphql',
      {
        query,
        variables,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
  }
}

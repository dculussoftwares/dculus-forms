import { AxiosResponse } from 'axios';
import { AuthUtils } from './auth-utils';

export interface FormTemplate {
  id: string;
  name: string;
  description?: string;
  category: string;
  formSchema: any;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Form {
  id: string;
  title: string;
  description?: string;
  shortUrl: string;
  formSchema: any;
  isPublished: boolean;
  organization: { id: string; name: string; slug: string; };
  createdBy: { id: string; name: string; email: string; };
  responseCount: number;
  sharingScope: string;
  defaultPermission: string;
  permissions: FormPermission[];
  userPermission?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: FormMetadata;
  settings?: FormSettings;
}

export interface FormMetadata {
  pageCount: number;
  fieldCount: number;
  backgroundImageKey?: string;
  backgroundImageUrl?: string;
  lastUpdated: string;
}

export interface FormSettings {
  thankYou?: {
    enabled: boolean;
    message: string;
  };
  submissionLimits?: {
    maxResponses?: {
      enabled: boolean;
      limit: number;
    };
    timeWindow?: {
      enabled: boolean;
      startDate?: string;
      endDate?: string;
    };
  };
}

export interface FormPermission {
  id: string;
  formId: string;
  userId: string;
  permission: string;
  grantedBy: { id: string; name: string; email: string; };
  grantedAt: string;
  updatedAt: string;
}

export interface FormResponse {
  id: string;
  formId: string;
  data: any;
  submittedAt: string;
  thankYouMessage: string;
  showCustomThankYou: boolean;
}

export interface CreateFormInput {
  templateId: string;
  title: string;
  description?: string;
  organizationId: string;
}

export interface UpdateFormInput {
  title?: string;
  description?: string;
  isPublished?: boolean;
  settings?: FormSettings;
}

export interface SubmitResponseInput {
  formId: string;
  data: any;
  sessionId?: string;
  userAgent?: string;
  timezone?: string;
  language?: string;
  completionTimeSeconds?: number;
}

export class FormTestUtils {
  public authUtils: AuthUtils;
  private baseURL: string;

  constructor(baseURL: string = 'http://localhost:4000') {
    this.baseURL = baseURL;
    this.authUtils = new AuthUtils(baseURL);
  }

  // Template Operations

  /**
   * Get all available templates
   */
  async getTemplates(token: string, category?: string): Promise<FormTemplate[]> {
    const query = `
      query GetTemplates($category: String) {
        templates(category: $category) {
          id
          name
          description
          category
          formSchema
          isActive
          createdAt
          updatedAt
        }
      }
    `;

    const response = await this.authUtils.graphqlRequest(query, { category }, token);

    if (response.data.errors) {
      throw new Error(`Failed to get templates: ${response.data.errors[0].message}`);
    }

    return response.data.data.templates;
  }

  /**
   * Get template by ID
   */
  async getTemplate(token: string, templateId: string): Promise<FormTemplate> {
    const query = `
      query GetTemplate($id: ID!) {
        template(id: $id) {
          id
          name
          description
          category
          formSchema
          isActive
          createdAt
          updatedAt
        }
      }
    `;

    const response = await this.authUtils.graphqlRequest(query, { id: templateId }, token);

    if (response.data.errors) {
      throw new Error(`Failed to get template: ${response.data.errors[0].message}`);
    }

    return response.data.data.template;
  }

  /**
   * Find template by name
   */
  async findTemplateByName(token: string, templateName: string): Promise<FormTemplate | null> {
    const templates = await this.getTemplates(token);
    return templates.find(t => t.name === templateName) || null;
  }

  // Form Operations

  /**
   * Create a form from template
   */
  async createForm(token: string, input: CreateFormInput): Promise<Form> {
    const mutation = `
      mutation CreateForm($input: CreateFormInput!) {
        createForm(input: $input) {
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
          responseCount
          sharingScope
          defaultPermission
          permissions {
            id
            formId
            userId
            permission
            grantedBy {
              id
              name
              email
            }
            grantedAt
            updatedAt
          }
          userPermission
          createdAt
          updatedAt
          metadata {
            pageCount
            fieldCount
            backgroundImageKey
            backgroundImageUrl
            lastUpdated
          }
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
        }
      }
    `;

    const response = await this.authUtils.graphqlRequest(mutation, { input }, token);

    if (response.data.errors) {
      throw new Error(`Failed to create form: ${response.data.errors[0].message}`);
    }

    return response.data.data.createForm;
  }

  /**
   * Update a form
   */
  async updateForm(token: string, formId: string, input: UpdateFormInput): Promise<Form> {
    const mutation = `
      mutation UpdateForm($id: ID!, $input: UpdateFormInput!) {
        updateForm(id: $id, input: $input) {
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
          responseCount
          sharingScope
          defaultPermission
          permissions {
            id
            formId
            userId
            permission
            grantedBy {
              id
              name
              email
            }
            grantedAt
            updatedAt
          }
          userPermission
          createdAt
          updatedAt
          metadata {
            pageCount
            fieldCount
            backgroundImageKey
            backgroundImageUrl
            lastUpdated
          }
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
        }
      }
    `;

    const response = await this.authUtils.graphqlRequest(mutation, { id: formId, input }, token);

    if (response.data.errors) {
      throw new Error(`Failed to update form: ${response.data.errors[0].message}`);
    }

    return response.data.data.updateForm;
  }

  /**
   * Delete a form
   */
  async deleteForm(token: string, formId: string): Promise<boolean> {
    const mutation = `
      mutation DeleteForm($id: ID!) {
        deleteForm(id: $id)
      }
    `;

    const response = await this.authUtils.graphqlRequest(mutation, { id: formId }, token);

    if (response.data.errors) {
      throw new Error(`Failed to delete form: ${response.data.errors[0].message}`);
    }

    return response.data.data.deleteForm;
  }

  /**
   * Get form by ID
   */
  async getForm(token: string, formId: string): Promise<Form> {
    const query = `
      query GetForm($id: ID!) {
        form(id: $id) {
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
          responseCount
          sharingScope
          defaultPermission
          permissions {
            id
            formId
            userId
            permission
            grantedBy {
              id
              name
              email
            }
            grantedAt
            updatedAt
          }
          userPermission
          createdAt
          updatedAt
          metadata {
            pageCount
            fieldCount
            backgroundImageKey
            backgroundImageUrl
            lastUpdated
          }
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
        }
      }
    `;

    const response = await this.authUtils.graphqlRequest(query, { id: formId }, token);

    if (response.data.errors) {
      throw new Error(`Failed to get form: ${response.data.errors[0].message}`);
    }

    return response.data.data.form;
  }

  /**
   * Get form by short URL (public access)
   */
  async getFormByShortUrl(shortUrl: string): Promise<Form> {
    const query = `
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
          responseCount
          createdAt
          updatedAt
          metadata {
            pageCount
            fieldCount
            backgroundImageKey
            backgroundImageUrl
            lastUpdated
          }
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
        }
      }
    `;

    const response = await this.authUtils.axiosInstance.post('/graphql', {
      query,
      variables: { shortUrl }
    });

    if (response.data.errors) {
      throw new Error(`Failed to get form by short URL: ${response.data.errors[0].message}`);
    }

    return response.data.data.formByShortUrl;
  }

  /**
   * Regenerate form short URL
   */
  async regenerateShortUrl(token: string, formId: string): Promise<Form> {
    const mutation = `
      mutation RegenerateShortUrl($id: ID!) {
        regenerateShortUrl(id: $id) {
          id
          title
          shortUrl
          isPublished
        }
      }
    `;

    const response = await this.authUtils.graphqlRequest(mutation, { id: formId }, token);

    if (response.data.errors) {
      throw new Error(`Failed to regenerate short URL: ${response.data.errors[0].message}`);
    }

    return response.data.data.regenerateShortUrl;
  }

  /**
   * Get all forms in an organization
   */
  async getForms(token: string, organizationId: string): Promise<Form[]> {
    const query = `
      query GetForms($organizationId: ID!) {
        forms(organizationId: $organizationId) {
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
          responseCount
          userPermission
          createdAt
          updatedAt
        }
      }
    `;

    const response = await this.authUtils.graphqlRequest(query, { organizationId }, token);

    if (response.data.errors) {
      throw new Error(`Failed to get forms: ${response.data.errors[0].message}`);
    }

    return response.data.data.forms;
  }

  // Response Operations

  /**
   * Submit a response to a form
   */
  async submitResponse(input: SubmitResponseInput): Promise<FormResponse> {
    const mutation = `
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
   * Get responses for a form with pagination
   */
  async getResponsesByForm(
    token: string,
    formId: string,
    page: number = 1,
    limit: number = 10,
    sortBy: string = 'submittedAt',
    sortOrder: string = 'desc',
    filters?: any[]
  ): Promise<{ data: FormResponse[]; total: number; page: number; limit: number; totalPages: number }> {
    const query = `
      query GetResponsesByForm(
        $formId: ID!,
        $page: Int,
        $limit: Int,
        $sortBy: String,
        $sortOrder: String,
        $filters: [ResponseFilterInput!]
      ) {
        responsesByForm(
          formId: $formId,
          page: $page,
          limit: $limit,
          sortBy: $sortBy,
          sortOrder: $sortOrder,
          filters: $filters
        ) {
          data {
            id
            formId
            data
            submittedAt
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
      limit,
      sortBy,
      sortOrder,
      filters
    }, token);

    if (response.data.errors) {
      throw new Error(`Failed to get responses: ${response.data.errors[0].message}`);
    }

    return response.data.data.responsesByForm;
  }

  /**
   * Delete a response
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

  // Utility Methods

  /**
   * Generate sample form data for response submission
   */
  generateSampleFormData(formSchema: any): any {
    const data: any = {};

    // Handle case where formSchema might be serialized
    let schema = formSchema;
    if (typeof formSchema === 'string') {
      try {
        schema = JSON.parse(formSchema);
      } catch (e) {
        console.warn('Failed to parse form schema:', e);
        return data;
      }
    }

    // Add some default sample data even if schema parsing fails
    if (!schema || !schema.pages) {
      // Provide basic sample data for common field names
      data.name = 'John Doe';
      data.position = 'Senior Engineer';
      data.email = 'test@example.com';
      data.message = 'Sample response text';
      return data;
    }

    schema.pages.forEach((page: any) => {
      if (page.fields) {
        page.fields.forEach((field: any) => {
          switch (field.type) {
            case 'TextInput':
              data[field.id] = `Sample text for ${field.label || field.id}`;
              break;
            case 'TextArea':
              data[field.id] = `Sample long text for ${field.label || field.id}`;
              break;
            case 'Email':
              data[field.id] = 'test@example.com';
              break;
            case 'Number':
              data[field.id] = 42;
              break;
            case 'Select':
              if (field.options && field.options.length > 0) {
                data[field.id] = field.options[0];
              }
              break;
            case 'Radio':
              if (field.options && field.options.length > 0) {
                data[field.id] = field.options[0];
              }
              break;
            case 'Checkbox':
              if (field.options && field.options.length > 0) {
                data[field.id] = [field.options[0]];
              }
              break;
            case 'Date':
              data[field.id] = '2024-01-15';
              break;
          }
        });
      }
    });

    return data;
  }

  /**
   * Wait for form to be accessible by short URL
   */
  async waitForFormAvailability(shortUrl: string, timeoutMs: number = 5000): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        await this.getFormByShortUrl(shortUrl);
        return true;
      } catch (error) {
        // Wait 100ms before retrying
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return false;
  }

  /**
   * Extract short URL from full URL
   */
  extractShortUrl(fullUrl: string): string {
    // Extract the short URL part from a full URL
    // e.g., "http://localhost:5173/form/abc123" -> "abc123"
    const parts = fullUrl.split('/');
    return parts[parts.length - 1];
  }

  /**
   * Generate unique test data
   */
  generateUniqueTestData(): { title: string; description: string; organizationName: string } {
    const timestamp = Date.now();
    return {
      title: `Test Form ${timestamp}`,
      description: `Test form description created at ${new Date().toISOString()}`,
      organizationName: `Test Org ${timestamp}`
    };
  }
}
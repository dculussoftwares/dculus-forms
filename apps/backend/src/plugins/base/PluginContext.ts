/**
 * Plugin Context
 *
 * Provides organization-scoped API access to plugins.
 * All methods automatically enforce organization boundaries.
 *
 * IMPORTANT: For external plugins, the prismaClient MUST be injected by the host application.
 * This prevents bundling Prisma client code into external plugin bundles.
 */

import type { Form, Response, Organization } from '@prisma/client';

export class PluginContext {
  constructor(
    private readonly organizationId: string,
    private readonly formId: string,
    private readonly prisma: any
  ) {
    if (!prisma) {
      throw new Error('[PluginContext] prismaClient is required but was not provided');
    }
  }

  /**
   * Get form details
   * Automatically scoped to plugin's organization
   *
   * @param formId - Form ID to retrieve
   * @returns Form object
   * @throws Error if form not found or not in same organization
   */
  async getForm(formId: string): Promise<Form> {
    const form = await prisma.form.findUnique({
      where: {
        id: formId,
        organizationId: this.organizationId,
      },
    });

    if (!form) {
      throw new Error(
        `Form ${formId} not found or access denied for organization ${this.organizationId}`
      );
    }

    return form;
  }

  /**
   * Get response details
   * Automatically scoped to plugin's organization
   *
   * @param responseId - Response ID to retrieve
   * @returns Response object with form included
   * @throws Error if response not found or not in same organization
   */
  async getResponse(responseId: string): Promise<Response & { form: Form }> {
    const response = await prisma.response.findUnique({
      where: { id: responseId },
      include: { form: true },
    });

    if (!response) {
      throw new Error(`Response ${responseId} not found`);
    }

    if (response.form.organizationId !== this.organizationId) {
      throw new Error(
        `Response ${responseId} access denied for organization ${this.organizationId}`
      );
    }

    return response;
  }

  /**
   * List responses for a form
   * Automatically scoped to plugin's organization
   *
   * @param formId - Form ID to list responses for
   * @param limit - Maximum number of responses to return (default: 100)
   * @returns Array of responses
   * @throws Error if form not found or not in same organization
   */
  async listResponses(formId: string, limit: number = 100): Promise<Response[]> {
    // Verify form access first
    await this.getForm(formId);

    const responses = await prisma.response.findMany({
      where: { formId },
      orderBy: { submittedAt: 'desc' },
      take: Math.min(limit, 1000), // Cap at 1000 for safety
    });

    return responses;
  }

  /**
   * Get organization details
   *
   * @returns Organization object
   * @throws Error if organization not found
   */
  async getOrganization(): Promise<Organization> {
    const organization = await prisma.organization.findUnique({
      where: { id: this.organizationId },
    });

    if (!organization) {
      throw new Error(`Organization ${this.organizationId} not found`);
    }

    return organization;
  }

  /**
   * Get the current organization ID
   * Useful for logging or debugging
   */
  getOrganizationId(): string {
    return this.organizationId;
  }

  /**
   * Get the current form ID
   * Useful for logging or debugging
   */
  getFormId(): string {
    return this.formId;
  }
}

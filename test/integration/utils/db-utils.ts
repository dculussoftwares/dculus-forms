import { randomBytes } from 'crypto';
import { PrismaClient, User, Organization, Form, Response, FormTemplate, FormPlugin } from '@prisma/client';

function generateId(length: number = 21): string {
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const array = randomBytes(length);
  let id = '';
  for (let i = 0; i < length; i++) {
    id += alphabet[array[i] % alphabet.length];
  }
  return id;
}

/**
 * Database Utilities for Integration Tests
 *
 * Provides helper functions for seeding test data and cleaning up the database
 */

export interface SeedUserData {
  id?: string;
  name: string;
  email: string;
  role?: string;
  password?: string;
}

export interface SeedOrganizationData {
  id?: string;
  name: string;
  slug?: string;
}

export interface SeedFormData {
  id?: string;
  title: string;
  description?: string;
  formSchema: any;
  organizationId: string;
  createdById: string;
  isPublished?: boolean;
  shortUrl?: string;
}

export interface SeedResponseData {
  id?: string;
  formId: string;
  data: any;
  metadata?: any;
}

export interface SeedTemplateData {
  id?: string;
  name: string;
  description?: string;
  category?: string;
  formSchema: any;
  isActive?: boolean;
}

export interface SeedPluginData {
  id?: string;
  formId: string;
  type: string;
  name: string;
  config: any;
  enabled?: boolean;
  events?: string[];
}

/**
 * Seed a test user in the database
 */
export async function seedTestUser(
  prisma: PrismaClient,
  data: SeedUserData
): Promise<User> {
  const user = await prisma.user.create({
    data: {
      id: data.id || generateId(),
      name: data.name,
      email: data.email,
      role: data.role || 'user',
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  // Create account if password is provided
  if (data.password) {
    await prisma.account.create({
      data: {
        id: generateId(),
        accountId: generateId(),
        providerId: 'credential',
        userId: user.id,
        password: data.password, // In real scenario, this would be hashed
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  return user;
}

/**
 * Seed a test organization in the database
 */
export async function seedTestOrganization(
  prisma: PrismaClient,
  data: SeedOrganizationData,
  ownerId?: string
): Promise<Organization> {
  const organization = await prisma.organization.create({
    data: {
      id: data.id || generateId(),
      name: data.name,
      slug: data.slug || data.name.toLowerCase().replace(/\s+/g, '-') + '-' + generateId(6),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  // Create owner membership if provided
  if (ownerId) {
    await prisma.member.create({
      data: {
        id: generateId(),
        organizationId: organization.id,
        userId: ownerId,
        role: 'owner',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  return organization;
}

/**
 * Seed a test form in the database
 */
export async function seedTestForm(
  prisma: PrismaClient,
  data: SeedFormData
): Promise<Form> {
  const form = await prisma.form.create({
    data: {
      id: data.id || generateId(),
      title: data.title,
      description: data.description || '',
      shortUrl: data.shortUrl || generateId(8),
      formSchema: data.formSchema,
      organizationId: data.organizationId,
      createdById: data.createdById,
      isPublished: data.isPublished ?? false,
      sharingScope: 'PRIVATE',
      defaultPermission: 'VIEWER',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  return form;
}

/**
 * Seed multiple test responses for a form
 */
export async function seedTestResponses(
  prisma: PrismaClient,
  formId: string,
  count: number,
  dataGenerator?: (index: number) => any
): Promise<Response[]> {
  const responses: Response[] = [];

  for (let i = 0; i < count; i++) {
    const responseData = dataGenerator ? dataGenerator(i) : { field1: `value-${i}` };

    const response = await prisma.response.create({
      data: {
        id: generateId(),
        formId,
        data: responseData,
        metadata: {},
        submittedAt: new Date(),
      },
    });

    responses.push(response);
  }

  return responses;
}

/**
 * Seed a single test response
 */
export async function seedTestResponse(
  prisma: PrismaClient,
  data: SeedResponseData
): Promise<Response> {
  const response = await prisma.response.create({
    data: {
      id: data.id || generateId(),
      formId: data.formId,
      data: data.data,
      metadata: data.metadata || {},
      submittedAt: new Date(),
    },
  });

  return response;
}

/**
 * Seed a test form template
 */
export async function seedTestTemplate(
  prisma: PrismaClient,
  data: SeedTemplateData
): Promise<FormTemplate> {
  const template = await prisma.formTemplate.create({
    data: {
      id: data.id || generateId(),
      name: data.name,
      description: data.description || '',
      category: data.category || 'general',
      formSchema: data.formSchema,
      isActive: data.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  return template;
}

/**
 * Seed a test plugin for a form
 */
export async function seedTestPlugin(
  prisma: PrismaClient,
  data: SeedPluginData
): Promise<FormPlugin> {
  const plugin = await prisma.formPlugin.create({
    data: {
      id: data.id || generateId(),
      formId: data.formId,
      type: data.type,
      name: data.name,
      config: data.config,
      enabled: data.enabled ?? true,
      events: data.events ?? [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  return plugin;
}

/**
 * Clear all data from the database
 */
export async function clearAllData(prisma: PrismaClient): Promise<void> {
  // Delete in order to respect foreign key constraints
  await prisma.formViewAnalytics.deleteMany({});
  await prisma.formSubmissionAnalytics.deleteMany({});
  await prisma.response.deleteMany({});
  await prisma.formPlugin.deleteMany({});
  await prisma.formPermission.deleteMany({});
  await prisma.formFile.deleteMany({});
  await prisma.formMetadata.deleteMany({});
  await prisma.form.deleteMany({});
  await prisma.formTemplate.deleteMany({});
  await prisma.collaborativeDocument.deleteMany({});
  await prisma.invitation.deleteMany({});
  await prisma.member.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.organization.deleteMany({});
  await prisma.subscription.deleteMany({});
  await prisma.verification.deleteMany({});
}

/**
 * Clear form-related data for a specific form
 */
export async function clearFormData(prisma: PrismaClient, formId: string): Promise<void> {
  await prisma.formViewAnalytics.deleteMany({ where: { formId } });
  await prisma.formSubmissionAnalytics.deleteMany({ where: { formId } });
  await prisma.response.deleteMany({ where: { formId } });
  await prisma.formPlugin.deleteMany({ where: { formId } });
  await prisma.formPermission.deleteMany({ where: { formId } });
  await prisma.formFile.deleteMany({ where: { formId } });
  await prisma.formMetadata.deleteMany({ where: { formId } });
  await prisma.form.delete({ where: { id: formId } });
}

/**
 * Clear user-related data for a specific user
 */
export async function clearUserData(prisma: PrismaClient, userId: string): Promise<void> {
  // Delete forms created by the user
  const userForms = await prisma.form.findMany({ where: { createdById: userId } });
  for (const form of userForms) {
    await clearFormData(prisma, form.id);
  }

  // Delete user memberships and related data
  await prisma.member.deleteMany({ where: { userId } });
  await prisma.invitation.deleteMany({ where: { inviterId: userId } });
  await prisma.session.deleteMany({ where: { userId } });
  await prisma.account.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
}

/**
 * Get a form with all its responses
 */
export async function getFormWithResponses(
  prisma: PrismaClient,
  formId: string
): Promise<Form & { responses: Response[] }> {
  const form = await prisma.form.findUnique({
    where: { id: formId },
    include: {
      responses: true,
    },
  });

  if (!form) {
    throw new Error(`Form with ID ${formId} not found`);
  }

  return form;
}

/**
 * Get an organization with all its members
 */
export async function getOrganizationWithMembers(
  prisma: PrismaClient,
  orgId: string
) {
  const organization = await prisma.organization.findUnique({
    where: { id: orgId },
    include: {
      members: {
        include: {
          user: true,
        },
      },
    },
  });

  if (!organization) {
    throw new Error(`Organization with ID ${orgId} not found`);
  }

  return organization;
}

/**
 * Create a complete test setup with user, organization, and form
 */
export async function createCompleteTestSetup(
  prisma: PrismaClient,
  options: {
    userName?: string;
    userEmail?: string;
    orgName?: string;
    formTitle?: string;
    formSchema?: any;
  } = {}
) {
  // Create user
  const user = await seedTestUser(prisma, {
    name: options.userName || 'Test User',
    email: options.userEmail || `test-${generateId(6)}@example.com`,
    role: 'user',
  });

  // Create organization
  const organization = await seedTestOrganization(
    prisma,
    {
      name: options.orgName || 'Test Organization',
    },
    user.id
  );

  // Create form
  const form = await seedTestForm(prisma, {
    title: options.formTitle || 'Test Form',
    formSchema: options.formSchema || {
      pages: [
        {
          id: generateId(),
          title: 'Page 1',
          fields: [],
          order: 0,
        },
      ],
      layout: {
        theme: 'light',
        textColor: '#000000',
        spacing: 'normal',
        code: '',
        content: '',
        customBackGroundColor: '#ffffff',
        backgroundImageKey: '',
      },
      isShuffleEnabled: false,
    },
    organizationId: organization.id,
    createdById: user.id,
  });

  return {
    user,
    organization,
    form,
  };
}

/**
 * Get count of entities in database (useful for verification)
 */
export async function getDatabaseCounts(prisma: PrismaClient) {
  const [
    userCount,
    organizationCount,
    formCount,
    responseCount,
    pluginCount,
    templateCount,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.organization.count(),
    prisma.form.count(),
    prisma.response.count(),
    prisma.formPlugin.count(),
    prisma.formTemplate.count(),
  ]);

  return {
    users: userCount,
    organizations: organizationCount,
    forms: formCount,
    responses: responseCount,
    plugins: pluginCount,
    templates: templateCount,
  };
}

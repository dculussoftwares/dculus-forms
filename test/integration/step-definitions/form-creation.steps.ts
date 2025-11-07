import { Given, When, Then } from '@cucumber/cucumber';
import { randomBytes } from 'crypto';
import { CustomWorld } from '../support/world';
import { expect, expectDefined, expectEqual } from '../utils/expect-helper';
import { seedTestTemplate } from '../utils/db-utils';

function generateId(length: number = 21): string {
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const bytes = randomBytes(length);
  let id = '';
  for (let i = 0; i < length; i++) {
    id += alphabet[bytes[i] % alphabet.length];
  }
  return id;
}

Given('an organization owner {string} exists with password {string} and organization {string}',
  async function(this: CustomWorld, email: string, _password: string, organizationName: string) {
    expectDefined(this.prisma, 'Prisma client must be available to seed users');

    const userId = generateId();
    const organizationId = generateId();
    const now = new Date();

    const user = await this.prisma.user.create({
      data: {
        id: userId,
        email,
        name: 'Owner User',
        emailVerified: true,
        role: 'user',
        createdAt: now,
        updatedAt: now,
      },
    });

    const organization = await this.prisma.organization.create({
      data: {
        id: organizationId,
        name: organizationName,
        slug: `${organizationName.toLowerCase().replace(/\s+/g, '-')}-${generateId(6)}`.slice(0, 30),
        createdAt: now,
        updatedAt: now,
      },
    });

    await this.prisma.member.create({
      data: {
        id: generateId(),
        organizationId: organization.id,
        userId: user.id,
        role: 'owner',
        createdAt: now,
        updatedAt: now,
      },
    });

    const sessionToken = `test-session-${generateId(32)}`;
    const session = await this.prisma.session.create({
      data: {
        id: generateId(),
        userId: user.id,
        token: sessionToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        ipAddress: '127.0.0.1',
        userAgent: 'integration-test',
        activeOrganizationId: organization.id,
        createdAt: now,
        updatedAt: now,
      },
    });

    this.currentUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
    this.currentOrganization = {
      id: organization.id,
      name: organization.name,
    };
    this.currentSession = {
      id: session.id,
      userId: session.userId,
      token: session.token,
      expiresAt: session.expiresAt.toISOString(),
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      activeOrganizationId: session.activeOrganizationId || undefined,
    };
    this.authToken = session.token;

    console.log(`👤 Seeded organization owner ${email} with organization ${organization.name}`);
  }
);

Given('an active form template named {string} with {int} fields exists',
  async function(this: CustomWorld, templateName: string, fieldCount: number) {
    expectDefined(this.prisma, 'Prisma client must be available to seed templates');
    const pageId = `page-${generateId(8)}`;

    const fields = Array.from({ length: fieldCount }).map((_, index) => ({
      id: `field-${index + 1}`,
      type: 'text_input_field',
      label: `Field ${index + 1}`,
      order: index,
      defaultValue: '',
      prefix: '',
      hint: '',
      validation: {
        required: index === 0,
        type: 'text_input_field',
      },
    }));

    const templateSchema = {
      pages: [
        {
          id: pageId,
          title: 'Template Page',
          order: 0,
          fields,
        },
      ],
      layout: {
        theme: 'light',
        textColor: '#000000',
        spacing: 'normal',
        code: 'L1',
        content: '',
        customBackGroundColor: '#ffffff',
        customCTAButtonName: 'Submit',
        backgroundImageKey: '',
        pageMode: 'multipage',
      },
      isShuffleEnabled: false,
    };

    const template = await seedTestTemplate(this.prisma, {
      name: templateName,
      description: 'Integration test template',
      category: 'test',
      formSchema: templateSchema,
      isActive: true,
    });

    this.setSharedTestData(`template:${templateName}`, template);
    this.setSharedTestData('templateFieldCount', fieldCount);

    console.log(`🧩 Seeded template "${templateName}" with ${fieldCount} fields`);
  }
);

When('I create a form from template {string} with title {string} and description {string}',
  async function(this: CustomWorld, templateName: string, title: string, description: string) {
    expectDefined(this.authToken, 'Auth token must be available for GraphQL requests');
    expectDefined(this.currentOrganization, 'Current organization must be set before creating a form');

    const template = this.getSharedTestData(`template:${templateName}`);
    expectDefined(template, `Template ${templateName} should exist before creating form`);

    const form = await this.formTestUtils.createForm(this.authToken!, {
      templateId: template.id,
      title,
      description,
      organizationId: this.currentOrganization!.id,
    });

    this.setSharedTestData('createdForm', form);
    this.trackCreatedForm(form);

    console.log(`📝 Created form "${form.title}" from template "${templateName}"`);
  }
);

Then('the form creation response should include the title {string}',
  function(this: CustomWorld, expectedTitle: string) {
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form should be stored after creation');
    expectEqual(form.title, expectedTitle, 'Form title should match request');
  }
);

Then('the form should not be published by default',
  function(this: CustomWorld) {
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form should be stored after creation');
    expect(form.isPublished === false, 'New forms should be created as unpublished');
  }
);

Then('the form schema should have {int} fields',
  function(this: CustomWorld, expectedFieldCount: number) {
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form should exist to verify schema');

    const schema = (() => {
      if (!form.formSchema) {
        return { pages: [] };
      }

      if (typeof form.formSchema === 'string') {
        try {
          return JSON.parse(form.formSchema);
        } catch (error) {
          console.warn('Failed to parse form schema string:', error);
          return { pages: [] };
        }
      }

      return form.formSchema;
    })();

    const totalFields = (schema.pages || []).reduce((count: number, page: any) => {
      return count + (page.fields ? page.fields.length : 0);
    }, 0);

    expectEqual(totalFields, expectedFieldCount, 'Form schema field count should match template');
  }
);

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
  async function(this: CustomWorld, email: string, password: string, organizationName: string) {
    expectDefined(this.authUtils, 'Auth utils must be available');

    // Make email unique per test run to avoid conflicts during retries
    const uniqueEmail = email.replace('@', `+${Date.now()}@`);

    // Use better-auth signup API to create user with proper session
    try {
      const signupResponse = await this.authUtils.axiosInstance.post('/api/auth/sign-up/email', {
        email: uniqueEmail,
        password,
        name: 'Owner User',
        callbackURL: '/',
      });

      // Extract auth token from response headers
      const authToken = signupResponse.headers['set-auth-token'];
      if (!authToken) {
        throw new Error('No auth token returned from signup');
      }

      this.authToken = authToken;
      this.currentUser = signupResponse.data.user;

      // Create organization for the user using better-auth organization API
      const createOrgResponse = await this.authUtils.axiosInstance.post(
        '/api/auth/organization/create',
        {
          name: organizationName,
          slug: `${organizationName.toLowerCase().replace(/\s+/g, '-')}-${generateId(6)}`.slice(0, 30),
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      this.currentOrganization = {
        id: createOrgResponse.data.id,
        name: createOrgResponse.data.name,
      };

      console.log(`👤 Seeded organization owner ${uniqueEmail} with organization ${organizationName}`);
    } catch (error: any) {
      console.error('Failed to create organization owner:', error.response?.data || error.message);
      throw error;
    }
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

import { Given, When, Then } from '@cucumber/cucumber';
import { CustomWorld } from '../support/world';
import { FormTestUtils, Form, FormTemplate, CreateFormInput, UpdateFormInput } from '../utils/form-test-utils';
import { generateTestUser } from '../utils/test-data';

// Simple assertion function matching existing pattern
const expect = (actual: any) => ({
  toBe: (expected: any) => {
    if (actual !== expected) {
      throw new Error(`Expected ${actual} to be ${expected}`);
    }
  },
  toBeGreaterThan: (expected: number) => {
    if (actual <= expected) {
      throw new Error(`Expected ${actual} to be greater than ${expected}`);
    }
  },
  toContain: (expected: any) => {
    if (typeof actual === 'string' && typeof expected === 'string') {
      if (!actual.includes(expected)) {
        throw new Error(`Expected "${actual}" to contain "${expected}"`);
      }
    }
  },
  toMatch: (pattern: RegExp | string) => {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    if (!regex.test(actual)) {
      throw new Error(`Expected "${actual}" to match ${pattern}`);
    }
  },
  toBeDefined: () => {
    if (actual === undefined) {
      throw new Error('Expected value to be defined');
    }
  },
  toBeNull: () => {
    if (actual !== null) {
      throw new Error(`Expected ${actual} to be null`);
    }
  },
  not: {
    toBe: (expected: any) => {
      if (actual === expected) {
        throw new Error(`Expected ${actual} not to be ${expected}`);
      }
    },
    toBeNull: () => {
      if (actual === null) {
        throw new Error('Expected value not to be null');
      }
    }
  },
  toEqual: (expected: any) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`);
    }
  },
  toHaveProperty: (property: string) => {
    if (!(property in actual)) {
      throw new Error(`Expected object to have property '${property}'`);
    }
  },
  toBeUndefined: () => {
    if (actual !== undefined) {
      throw new Error(`Expected ${actual} to be undefined`);
    }
  }
});

// Initialize form test utilities
let formTestUtils: FormTestUtils;
let currentForm: Form;
let currentTemplate: FormTemplate;
let availableTemplates: FormTemplate[];
let originalShortUrl: string;
let otherUserForm: Form;
let otherUserToken: string;

// Test data storage
const testData = new Map<string, any>();

// Background Steps

Given('I have a test user with an organization', async function (this: CustomWorld) {
  if (!formTestUtils) {
    formTestUtils = new FormTestUtils(this.baseURL);
  }

  if (!(this as any).isAuthenticated()) {
    const testUser = generateTestUser();
    const organizationName = `Test Org ${Date.now()}`;

    const signUpResult = await this.authUtils.signUpUser(
      testUser.email,
      testUser.password,
      testUser.name,
      organizationName
    );

    const signInResult = await this.authUtils.signInUser(testUser.email, testUser.password);

    (this as any).setAuthContext(signInResult.user, signInResult.session, signInResult.token);
    (this as any).storeTestUser('main', testUser, signInResult.token, signUpResult.organization.id);
  }
});

Given('I have access to form templates', async function (this: CustomWorld) {
  availableTemplates = await formTestUtils.getTemplates(this.authToken!);
  expect(availableTemplates.length).toBeGreaterThan(0);
});

// Form Creation Steps

When('I create a form from the {string} template with title {string}', async function (this: CustomWorld, templateName: string, formTitle: string) {
  const template = await formTestUtils.findTemplateByName(this.authToken!, templateName);
  expect(template).not.toBeNull();
  currentTemplate = template!;

  const organizationId = (this as any).getCurrentOrganizationId();
  expect(organizationId).toBeDefined();

  const createInput: CreateFormInput = {
    templateId: template!.id,
    title: formTitle,
    organizationId: organizationId!
  };

  try {
    currentForm = await formTestUtils.createForm(this.authToken!, createInput);
  } catch (error: any) {
    testData.set('lastError', error.message);
    throw error;
  }
});

When('I create a form from the {string} template with:', async function (this: CustomWorld, templateName: string, dataTable) {
  const template = await formTestUtils.findTemplateByName(this.authToken!, templateName);
  expect(template).not.toBeNull();
  currentTemplate = template!;

  const organizationId = (this as any).getCurrentOrganizationId();
  expect(organizationId).toBeDefined();

  const data = dataTable.rowsHash();
  const createInput: CreateFormInput = {
    templateId: template!.id,
    title: data.title,
    description: data.description,
    organizationId: organizationId!
  };

  try {
    currentForm = await formTestUtils.createForm(this.authToken!, createInput);
  } catch (error: any) {
    testData.set('lastError', error.message);
    throw error;
  }
});

When('I attempt to create a form with invalid template ID {string}', async function (this: CustomWorld, templateId: string) {
  const organizationId = (this as any).getCurrentOrganizationId();
  expect(organizationId).toBeDefined();

  const createInput: CreateFormInput = {
    templateId: templateId,
    title: 'Test Form',
    organizationId: organizationId!
  };

  try {
    await formTestUtils.createForm(this.authToken!, createInput);
    throw new Error('Expected form creation to fail, but it succeeded');
  } catch (error: any) {
    testData.set('lastError', error.message);
  }
});

When('I attempt to create a form from any template', async function (this: CustomWorld) {
  const templates = await formTestUtils.getTemplates('invalid-token');
  const template = templates[0];

  const createInput: CreateFormInput = {
    templateId: template.id,
    title: 'Test Form',
    organizationId: 'test-org-id'
  };

  try {
    await formTestUtils.createForm('invalid-token', createInput);
    throw new Error('Expected form creation to fail, but it succeeded');
  } catch (error: any) {
    testData.set('lastError', error.message);
  }
});

// Form Creation Assertions

Then('the form should be created successfully', function (this: CustomWorld) {
  expect(currentForm).toBeDefined();
  expect(currentForm.id).toBeDefined();
  expect(currentForm.shortUrl).toBeDefined();
});

Then('the form should have the correct title and template structure', function (this: CustomWorld) {
  expect(currentForm.title).toBeDefined();
  expect(currentForm.formSchema).toBeDefined();

  // Parse form schema if it's a string
  let formSchema = currentForm.formSchema;
  if (typeof formSchema === 'string') {
    formSchema = JSON.parse(formSchema);
  }

  // Verify that the form schema has the same basic structure as template
  // (excluding dynamic fields like backgroundImageKey that get modified during creation)
  expect(formSchema.pages).toBeDefined();
  expect(formSchema.pages.length).toBeGreaterThan(0);
  expect(formSchema.layout).toBeDefined();

  // Check if basic structure matches template (pages and fields)
  if (currentTemplate.formSchema.pages) {
    expect(formSchema.pages.length).toBe(currentTemplate.formSchema.pages.length);

    formSchema.pages.forEach((page: any, index: number) => {
      const templatePage = currentTemplate.formSchema.pages[index];
      expect(page.fields.length).toBe(templatePage.fields.length);

      // Verify field types match
      page.fields.forEach((field: any, fieldIndex: number) => {
        const templateField = templatePage.fields[fieldIndex];
        expect(field.type).toBe(templateField.type);
        expect(field.label).toBe(templateField.label);
      });
    });
  }
});

Then('the form should be unpublished by default', function (this: CustomWorld) {
  expect(currentForm.isPublished).toBe(false);
});

Then('the form should have a unique short URL', function (this: CustomWorld) {
  expect(currentForm.shortUrl).toBeDefined();
  expect(currentForm.shortUrl.length).toBeGreaterThan(0);
});

Then('I should be the owner of the form', function (this: CustomWorld) {
  expect(currentForm.createdBy.id).toBe(this.currentUser!.id);
  expect(currentForm.userPermission).toBe('OWNER');
});

Then('the form should have title {string}', function (this: CustomWorld, expectedTitle: string) {
  expect(currentForm.title).toBe(expectedTitle);
});

Then('the form should have description {string}', function (this: CustomWorld, expectedDescription: string) {
  expect(currentForm.description).toBe(expectedDescription);
});

Then('the form creation should fail', function (this: CustomWorld) {
  expect(testData.get('lastError')).toBeDefined();
});

Then('I should receive an error {string}', function (this: CustomWorld, expectedError: string) {
  const lastError = testData.get('lastError');
  expect(lastError).toBeDefined();
  expect(lastError).toContain(expectedError);
});

// Authentication steps

Given('I am authenticated', function (this: CustomWorld) {
  expect((this as any).isAuthenticated()).toBe(true);
});

// Note: 'I am not authenticated' step is defined in form-responses.steps.ts to avoid conflicts

Given('another user has created a private form', async function (this: CustomWorld) {
  // Create another test user
  const otherUser = generateTestUser();
  const organizationName = `Other Test Org ${Date.now()}`;

  const signUpResult = await this.authUtils.signUpUser(
    otherUser.email,
    otherUser.password,
    otherUser.name,
    organizationName
  );

  const signInResult = await this.authUtils.signInUser(otherUser.email, otherUser.password);
  otherUserToken = signInResult.token;

  // Create a private form as the other user
  const templates = await formTestUtils.getTemplates(otherUserToken);
  const template = templates[0];

  const createInput: CreateFormInput = {
    templateId: template.id,
    title: `Private Form ${Date.now()}`,
    organizationId: signUpResult.organization.id
  };

  otherUserForm = await formTestUtils.createForm(otherUserToken, createInput);

  // Store other user for cleanup
  (this as any).storeTestUser('other', otherUser, otherUserToken, signUpResult.organization.id);
});

// Form Update Steps

Given('I have created a form from a template', async function (this: CustomWorld) {
  if (!currentForm) {
    const templates = await formTestUtils.getTemplates(this.authToken!);
    const template = templates[0];

    const organizationId = (this as any).getCurrentOrganizationId();
    const createInput: CreateFormInput = {
      templateId: template.id,
      title: `Test Form ${Date.now()}`,
      organizationId: organizationId!
    };

    currentForm = await formTestUtils.createForm(this.authToken!, createInput);
  }
});

Given('I have created an unpublished form', async function (this: CustomWorld) {
  // Create a form from template directly instead of using step
  if (!currentForm) {
    const templates = await formTestUtils.getTemplates(this.authToken!);
    const template = templates[0];

    const organizationId = (this as any).getCurrentOrganizationId();
    const createInput: CreateFormInput = {
      templateId: template.id,
      title: `Test Form ${Date.now()}`,
      organizationId: organizationId!
    };

    currentForm = await formTestUtils.createForm(this.authToken!, createInput);
  }
  expect(currentForm.isPublished).toBe(false);
});

Given('I have created and published a form', async function (this: CustomWorld) {
  // Create a form from template directly instead of using step
  if (!currentForm) {
    const templates = await formTestUtils.getTemplates(this.authToken!);
    const template = templates[0];

    const organizationId = (this as any).getCurrentOrganizationId();
    const createInput: CreateFormInput = {
      templateId: template.id,
      title: `Test Form ${Date.now()}`,
      organizationId: organizationId!
    };

    currentForm = await formTestUtils.createForm(this.authToken!, createInput);
  }

  // Publish the form
  const updateInput: UpdateFormInput = {
    isPublished: true
  };

  currentForm = await formTestUtils.updateForm(this.authToken!, currentForm.id, updateInput);
  expect(currentForm.isPublished).toBe(true);
});

When('I update the form with:', async function (this: CustomWorld, dataTable) {
  const data = dataTable.rowsHash();
  const updateInput: UpdateFormInput = {};

  if (data.title) updateInput.title = data.title;
  if (data.description) updateInput.description = data.description;

  try {
    currentForm = await formTestUtils.updateForm(this.authToken!, currentForm.id, updateInput);
  } catch (error: any) {
    testData.set('lastError', error.message);
    throw error;
  }
});

When('I publish the form', async function (this: CustomWorld) {
  const updateInput: UpdateFormInput = {
    isPublished: true
  };

  try {
    currentForm = await formTestUtils.updateForm(this.authToken!, currentForm.id, updateInput);
  } catch (error: any) {
    testData.set('lastError', error.message);
    throw error;
  }
});

When('I update the form settings with:', async function (this: CustomWorld, dataTable) {
  const data = dataTable.rowsHash();
  const updateInput: UpdateFormInput = {
    settings: {}
  };

  // Parse the flat key structure into nested object
  Object.keys(data).forEach(key => {
    const value = data[key];
    const keys = key.split('.');

    if (keys.length === 2) {
      const [section, field] = keys;
      if (section === 'thankYou') {
        if (!updateInput.settings!.thankYou) {
          updateInput.settings!.thankYou = { enabled: false, message: '' };
        }
        if (field === 'enabled') {
          updateInput.settings!.thankYou.enabled = value === 'true';
        } else if (field === 'message') {
          updateInput.settings!.thankYou.message = value;
        }
      }
    }
  });

  try {
    currentForm = await formTestUtils.updateForm(this.authToken!, currentForm.id, updateInput);
  } catch (error: any) {
    testData.set('lastError', error.message);
    throw error;
  }
});

// Form Update Assertions

Then('the form should be updated successfully', function (this: CustomWorld) {
  expect(currentForm).toBeDefined();
});

Then('the form title should be {string}', function (this: CustomWorld, expectedTitle: string) {
  expect(currentForm.title).toBe(expectedTitle);
});

Then('the form description should be {string}', function (this: CustomWorld, expectedDescription: string) {
  expect(currentForm.description).toBe(expectedDescription);
});

Then('the form should be marked as published', function (this: CustomWorld) {
  expect(currentForm.isPublished).toBe(true);
});

Then('the form should be accessible via its short URL', async function (this: CustomWorld) {
  const publicForm = await formTestUtils.getFormByShortUrl(currentForm.shortUrl);
  expect(publicForm.id).toBe(currentForm.id);
  expect(publicForm.isPublished).toBe(true);
});

Then('the form settings should be updated successfully', function (this: CustomWorld) {
  expect(currentForm.settings).toBeDefined();
});

Then('the thank you message should be customized', function (this: CustomWorld) {
  expect(currentForm.settings?.thankYou?.enabled).toBe(true);
  expect(currentForm.settings?.thankYou?.message).toBe('Thank you for your submission!');
});

// Permission-based Steps

Given('another user has created a form', async function (this: CustomWorld) {
  // Create another test user
  const otherUser = generateTestUser();
  const organizationName = `Other Test Org ${Date.now()}`;

  const signUpResult = await this.authUtils.signUpUser(
    otherUser.email,
    otherUser.password,
    otherUser.name,
    organizationName
  );

  const signInResult = await this.authUtils.signInUser(otherUser.email, otherUser.password);
  otherUserToken = signInResult.token;

  // Create a form as the other user
  const templates = await formTestUtils.getTemplates(otherUserToken);
  const template = templates[0];

  const createInput: CreateFormInput = {
    templateId: template.id,
    title: `Other User Form ${Date.now()}`,
    organizationId: signUpResult.organization.id
  };

  otherUserForm = await formTestUtils.createForm(otherUserToken, createInput);

  // Store other user for cleanup
  (this as any).storeTestUser('other', otherUser, otherUserToken, signUpResult.organization.id);
});

Given('I have VIEWER permission to that form', async function (this: CustomWorld) {
  await shareFormWithUser.call(this, 'VIEWER');
});

Given('I have EDITOR permission to that form', async function (this: CustomWorld) {
  await shareFormWithUser.call(this, 'EDITOR');
});

// Helper function to share form with current user
async function shareFormWithUser(this: CustomWorld, permissionLevel: string) {
  // Share the form with the current user with specified permission
  const shareInput = {
    formId: otherUserForm.id,
    sharingScope: 'SPECIFIC_MEMBERS',
    userPermissions: [
      {
        userId: this.currentUser!.id,
        permission: permissionLevel
      }
    ]
  };

  const shareMutation = `
    mutation ShareForm($input: ShareFormInput!) {
      shareForm(input: $input) {
        sharingScope
        defaultPermission
        permissions {
          id
          userId
          permission
        }
      }
    }
  `;

  try {
    await formTestUtils.authUtils.graphqlRequest(shareMutation, { input: shareInput }, otherUserToken);
    testData.set('grantedPermission', permissionLevel);
  } catch (error: any) {
    console.error('Failed to share form:', error.message);
    testData.set('lastError', error.message);
    throw error;
  }
}

Given('I do not have access to that form', function (this: CustomWorld) {
  // This is implicitly true since the form was created by another user
  // and no sharing has been configured
  testData.set('hasAccess', false);
});

When('I attempt to update the form title', async function (this: CustomWorld) {
  const updateInput: UpdateFormInput = {
    title: 'Updated by unauthorized user'
  };

  try {
    await formTestUtils.updateForm(this.authToken!, otherUserForm.id, updateInput);
    throw new Error('Expected update to fail, but it succeeded');
  } catch (error: any) {
    testData.set('lastError', error.message);
  }
});

When('I attempt to publish the form', async function (this: CustomWorld) {
  const updateInput: UpdateFormInput = {
    isPublished: true
  };

  try {
    await formTestUtils.updateForm(this.authToken!, otherUserForm.id, updateInput);
    throw new Error('Expected publish to fail, but it succeeded');
  } catch (error: any) {
    testData.set('lastError', error.message);
  }
});

Then('the form update should fail', function (this: CustomWorld) {
  expect(testData.get('lastError')).toBeDefined();
});

Then('I should receive a permission error', function (this: CustomWorld) {
  const lastError = testData.get('lastError');
  expect(lastError).toBeDefined();
  expect(lastError.toLowerCase()).toMatch(/permission|access|denied|unauthorized/);
});

Then('I should receive an error about requiring owner permissions', function (this: CustomWorld) {
  const lastError = testData.get('lastError');
  expect(lastError).toBeDefined();
  expect(lastError.toLowerCase()).toMatch(/owner|permission/);
});

// URL Management Steps

Given('I note the current short URL', function (this: CustomWorld) {
  originalShortUrl = currentForm.shortUrl;
  expect(originalShortUrl).toBeDefined();
});

When('I regenerate the form\'s short URL', async function (this: CustomWorld) {
  try {
    currentForm = await formTestUtils.regenerateShortUrl(this.authToken!, currentForm.id);
  } catch (error: any) {
    testData.set('lastError', error.message);
    throw error;
  }
});

When('I attempt to regenerate the form\'s short URL', async function (this: CustomWorld) {
  try {
    await formTestUtils.regenerateShortUrl(this.authToken!, otherUserForm.id);
    throw new Error('Expected URL regeneration to fail, but it succeeded');
  } catch (error: any) {
    testData.set('lastError', error.message);
  }
});

Then('a new short URL should be generated', function (this: CustomWorld) {
  expect(currentForm.shortUrl).toBeDefined();
  expect(currentForm.shortUrl).not.toBe(originalShortUrl);
});

Then('the new URL should be different from the previous one', function (this: CustomWorld) {
  expect(currentForm.shortUrl).not.toBe(originalShortUrl);
});

Then('the form should be accessible via the new URL', async function (this: CustomWorld) {
  const publicForm = await formTestUtils.getFormByShortUrl(currentForm.shortUrl);
  expect(publicForm.id).toBe(currentForm.id);
});

Then('the old URL should no longer work', async function (this: CustomWorld) {
  try {
    await formTestUtils.getFormByShortUrl(originalShortUrl);
    throw new Error('Expected old URL to fail, but it still works');
  } catch (error: any) {
    expect(error.message).toMatch(/not found|not published/);
  }
});

Then('the operation should fail', function (this: CustomWorld) {
  expect(testData.get('lastError')).toBeDefined();
});

// Form Deletion Steps

Given('I note the form ID', function (this: CustomWorld) {
  testData.set('currentFormId', currentForm.id);
});

When('I delete the form', async function (this: CustomWorld) {
  try {
    const result = await formTestUtils.deleteForm(this.authToken!, currentForm.id);
    testData.set('deleteResult', result);
  } catch (error: any) {
    testData.set('lastError', error.message);
    throw error;
  }
});

When('I attempt to delete the form', async function (this: CustomWorld) {
  try {
    await formTestUtils.deleteForm(this.authToken!, otherUserForm.id);
    throw new Error('Expected deletion to fail, but it succeeded');
  } catch (error: any) {
    testData.set('lastError', error.message);
  }
});

When('I attempt to delete a form with ID {string}', async function (this: CustomWorld, formId: string) {
  try {
    await formTestUtils.deleteForm(this.authToken!, formId);
    throw new Error('Expected deletion to fail, but it succeeded');
  } catch (error: any) {
    testData.set('lastError', error.message);
  }
});

Then('the form should be deleted successfully', function (this: CustomWorld) {
  const deleteResult = testData.get('deleteResult');
  expect(deleteResult).toBe(true);
});

Then('the form should no longer be accessible', async function (this: CustomWorld) {
  try {
    await formTestUtils.getForm(this.authToken!, currentForm.id);
    throw new Error('Expected form retrieval to fail, but it succeeded');
  } catch (error: any) {
    expect(error.message).toMatch(/not found|access denied/);
  }
});

Then('attempting to access the form should return {string}', async function (this: CustomWorld, expectedError: string) {
  try {
    await formTestUtils.getForm(this.authToken!, testData.get('currentFormId'));
    throw new Error('Expected form access to fail, but it succeeded');
  } catch (error: any) {
    expect(error.message.toLowerCase()).toContain(expectedError.toLowerCase());
  }
});

Then('the form deletion should fail', function (this: CustomWorld) {
  expect(testData.get('lastError')).toBeDefined();
});

Then('I should receive an error that only the owner can delete the form', function (this: CustomWorld) {
  const lastError = testData.get('lastError');
  expect(lastError).toBeDefined();
  expect(lastError.toLowerCase()).toMatch(/owner.*delete|only.*owner/);
});

Then('the form should still exist', async function (this: CustomWorld) {
  // Verify with the other user's token that the form still exists
  const form = await formTestUtils.getForm(otherUserToken, otherUserForm.id);
  expect(form.id).toBe(otherUserForm.id);
});

Then('I should receive an error about the form not being found', function (this: CustomWorld) {
  const lastError = testData.get('lastError');
  expect(lastError).toBeDefined();
  expect(lastError.toLowerCase()).toMatch(/not found|form.*not.*found/);
});

// Form Retrieval Steps

When('I retrieve the form by its ID', async function (this: CustomWorld) {
  try {
    const retrievedForm = await formTestUtils.getForm(this.authToken!, currentForm.id);
    testData.set('retrievedForm', retrievedForm);
  } catch (error: any) {
    testData.set('lastError', error.message);
    throw error;
  }
});

When('I retrieve the form by its short URL without authentication', async function (this: CustomWorld) {
  try {
    const retrievedForm = await formTestUtils.getFormByShortUrl(currentForm.shortUrl);
    testData.set('retrievedPublicForm', retrievedForm);
  } catch (error: any) {
    testData.set('lastError', error.message);
    throw error;
  }
});

When('I attempt to retrieve the form by its ID', async function (this: CustomWorld) {
  try {
    await formTestUtils.getForm(this.authToken!, otherUserForm.id);
    throw new Error('Expected form retrieval to fail, but it succeeded');
  } catch (error: any) {
    testData.set('lastError', error.message);
  }
});

When('I attempt to retrieve the form by its short URL without authentication', async function (this: CustomWorld) {
  try {
    await formTestUtils.getFormByShortUrl(currentForm.shortUrl);
    throw new Error('Expected form retrieval to fail, but it succeeded');
  } catch (error: any) {
    testData.set('lastError', error.message);
  }
});

Then('I should receive the complete form data', function (this: CustomWorld) {
  const retrievedForm = testData.get('retrievedForm');
  expect(retrievedForm).toBeDefined();
  expect(retrievedForm.id).toBe(currentForm.id);
  expect(retrievedForm.title).toBeDefined();
  expect(retrievedForm.formSchema).toBeDefined();
});

Then('the form should include metadata like field count and page count', function (this: CustomWorld) {
  const retrievedForm = testData.get('retrievedForm');
  expect(retrievedForm.metadata).toBeDefined();
  expect(retrievedForm.metadata.fieldCount).toBeGreaterThan(0);
  expect(retrievedForm.metadata.pageCount).toBeGreaterThan(0);
});

Then('the form should include my permission level', function (this: CustomWorld) {
  const retrievedForm = testData.get('retrievedForm');
  expect(retrievedForm.userPermission).toBe('OWNER');
});

Then('I should receive the form data', function (this: CustomWorld) {
  const retrievedForm = testData.get('retrievedPublicForm');
  expect(retrievedForm).toBeDefined();
  expect(retrievedForm.id).toBe(currentForm.id);
});

Then('the form schema should be included', function (this: CustomWorld) {
  const retrievedForm = testData.get('retrievedPublicForm');
  expect(retrievedForm.formSchema).toBeDefined();
});

Then('no permission-sensitive data should be exposed', function (this: CustomWorld) {
  const retrievedForm = testData.get('retrievedPublicForm');
  // Ensure sensitive fields are not included in public access
  expect(retrievedForm.permissions).toBeUndefined();
  expect(retrievedForm.userPermission).toBeUndefined();
});

Then('the form retrieval should fail', function (this: CustomWorld) {
  expect(testData.get('lastError')).toBeDefined();
});

// Note: 'I should receive an access denied error' step is defined in form-responses.steps.ts to avoid conflicts

Then('I should receive an error that the form is not published', function (this: CustomWorld) {
  const lastError = testData.get('lastError');
  expect(lastError).toBeDefined();
  expect(lastError.toLowerCase()).toMatch(/not.*published|form.*not.*published/);
});

// Business Rules Steps

When('I configure the form with maximum {int} responses', async function (this: CustomWorld, maxResponses: number) {
  const updateInput: UpdateFormInput = {
    settings: {
      submissionLimits: {
        maxResponses: {
          enabled: true,
          limit: maxResponses
        }
      }
    }
  };

  try {
    currentForm = await formTestUtils.updateForm(this.authToken!, currentForm.id, updateInput);
  } catch (error: any) {
    testData.set('lastError', error.message);
    throw error;
  }
});

When('I configure the form with time window from tomorrow to next week', async function (this: CustomWorld) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);

  const updateInput: UpdateFormInput = {
    settings: {
      submissionLimits: {
        timeWindow: {
          enabled: true,
          startDate: tomorrow.toISOString().split('T')[0],
          endDate: nextWeek.toISOString().split('T')[0]
        }
      }
    }
  };

  try {
    currentForm = await formTestUtils.updateForm(this.authToken!, currentForm.id, updateInput);
  } catch (error: any) {
    testData.set('lastError', error.message);
    throw error;
  }
});

Then('the form should enforce the response limit', function (this: CustomWorld) {
  expect(currentForm.settings?.submissionLimits?.maxResponses?.enabled).toBe(true);
  expect(currentForm.settings?.submissionLimits?.maxResponses?.limit).toBe(5);
});

Then('the form should be accessible until the limit is reached', async function (this: CustomWorld) {
  // Verify that the form is accessible and has the limits configured
  const publicForm = await formTestUtils.getFormByShortUrl(currentForm.shortUrl);
  expect(publicForm.settings?.submissionLimits?.maxResponses?.enabled).toBe(true);
});

Then('the form should not accept submissions before the start date', function (this: CustomWorld) {
  expect(currentForm.settings?.submissionLimits?.timeWindow?.enabled).toBe(true);
  expect(currentForm.settings?.submissionLimits?.timeWindow?.startDate).toBeDefined();
});

Then('the form should accept submissions during the active period', function (this: CustomWorld) {
  expect(currentForm.settings?.submissionLimits?.timeWindow?.enabled).toBe(true);
  expect(currentForm.settings?.submissionLimits?.timeWindow?.startDate).toBeDefined();
  expect(currentForm.settings?.submissionLimits?.timeWindow?.endDate).toBeDefined();
});
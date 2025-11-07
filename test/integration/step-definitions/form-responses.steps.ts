import { Given, When, Then } from '@cucumber/cucumber';
import { randomBytes } from 'crypto';
import { CustomWorld } from '../support/world';
import { expect, expectDefined, expectDeepEqual, expectEqual } from '../utils/expect-helper';

function generateId(length: number = 21): string {
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const bytes = randomBytes(length);
  let id = '';
  for (let i = 0; i < length; i++) {
    id += alphabet[bytes[i] % alphabet.length];
  }
  return id;
}

Given('I publish the created form',
  async function(this: CustomWorld) {
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Created form must exist before publishing');
    expectDefined(this.authToken, 'Auth token is required to publish form');

    const updatedForm = await this.formTestUtils.updateForm(this.authToken!, form.id, {
      isPublished: true,
    });

    this.setSharedTestData('createdForm', updatedForm);
    console.log(`📣 Published form ${updatedForm.id}`);
  }
);

Given('I create an unpublished form from template {string} with title {string}',
  async function(this: CustomWorld, templateName: string, title: string) {
    expectDefined(this.authToken, 'Auth token is required to create forms');
    expectDefined(this.currentOrganization, 'Organization context is required to create forms');

    const template = this.getSharedTestData(`template:${templateName}`);
    expectDefined(template, `Template ${templateName} must exist to create form`);

    const form = await this.formTestUtils.createForm(this.authToken!, {
      templateId: template.id,
      title,
      description: 'Draft form for submission tests',
      organizationId: this.currentOrganization!.id,
    });

    this.setSharedTestData(`unpublishedForm:${title}`, form);
    console.log(`📝 Created unpublished form "${title}"`);
  }
);

When('a public user submits a response to the published form',
  async function(this: CustomWorld) {
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Published form must exist before submitting response');

    const submissionData = this.formTestUtils.generateSampleFormData(form.formSchema);
    this.setSharedTestData('lastSubmittedData', submissionData);

    const input = {
      formId: form.id,
      data: submissionData,
      sessionId: generateId(16),
      userAgent: 'integration-test-agent',
      timezone: 'UTC',
      language: 'en-US',
      completionTimeSeconds: 12,
    };

    try {
      const response = await this.formTestUtils.submitResponse(input);
      this.setSharedTestData('lastResponse', response);
      this.setSharedTestData('responseError', undefined);
      console.log(`✅ Submitted response ${response.id} to form ${form.id}`);
    } catch (error) {
      this.setSharedTestData('responseError', error);
      throw error;
    }
  }
);

When('a public user attempts to submit a response to the unpublished form titled {string}',
  async function(this: CustomWorld, title: string) {
    const form = this.getSharedTestData(`unpublishedForm:${title}`);
    expectDefined(form, `Unpublished form "${title}" must exist before submitting response`);

    const submissionData = this.formTestUtils.generateSampleFormData(form.formSchema);
    this.setSharedTestData('lastSubmittedData', submissionData);

    const input = {
      formId: form.id,
      data: submissionData,
      sessionId: generateId(16),
      userAgent: 'integration-test-agent',
      timezone: 'UTC',
      language: 'en-US',
      completionTimeSeconds: 15,
    };

    try {
      const response = await this.formTestUtils.submitResponse(input);
      this.setSharedTestData('lastResponse', response);
      this.setSharedTestData('responseError', undefined);
    } catch (error) {
      this.setSharedTestData('responseError', error);
      console.log('❌ Submission failed as expected for unpublished form');
    }
  }
);

Then('the submission should succeed with thank you message {string}',
  function(this: CustomWorld, expectedMessage: string) {
    const response = this.getSharedTestData('lastResponse');
    expectDefined(response, 'Response should exist after successful submission');
    expectEqual(
      response.thankYouMessage,
      expectedMessage,
      'Thank you message should match expected default'
    );
    expect(response.showCustomThankYou === false, 'Default thank you message should not mark custom');
  }
);

Then('the form should have {int} stored responses',
  async function(this: CustomWorld, expectedCount: number) {
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form should exist to verify response count');
    expectDefined(this.prisma, 'Prisma client must be available to verify database state');
    expectDefined(this.authToken, 'Auth token is required to fetch responses');

    const dbCount = await this.prisma.response.count({ where: { formId: form.id } });
    expectEqual(dbCount, expectedCount, 'Database response count should match expected value');

    const paginated = await this.formTestUtils.getResponsesByForm(this.authToken!, form.id, 1, 10);
    expectEqual(paginated.total, expectedCount, 'GraphQL responsesByForm total should match expected value');
  }
);

Then('the stored response data should match the submitted payload',
  async function(this: CustomWorld) {
    const submittedData = this.getSharedTestData('lastSubmittedData');
    const response = this.getSharedTestData('lastResponse');

    expectDefined(submittedData, 'Submitted data should be stored for comparison');
    expectDefined(response, 'Response should exist for comparison');
    expectDeepEqual(response.data, submittedData, 'Stored response data should match submitted payload');
  }
);

Then('the submission should fail with error {string}',
  function(this: CustomWorld, expectedMessage: string) {
    const error = this.getSharedTestData('responseError') as Error | undefined;
    expectDefined(error, 'Error should be captured for failed submission');
    expectEqual(error.message, expectedMessage, 'Error message should match expected value');
  }
);

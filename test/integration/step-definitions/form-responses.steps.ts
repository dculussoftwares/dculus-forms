import { Given, When, Then } from '@cucumber/cucumber';
import { randomBytes } from 'crypto';
import { CustomWorld } from '../support/world';
import { expectDefined, expectDeepEqual, expectEqual } from '../utils/expect-helper';

/**
 * Generates unbiased random index using rejection sampling.
 */
function unbiasedRandomIndex(max: number, randomByte: number): number | null {
  const limit = 256 - (256 % max);
  if (randomByte >= limit) return null;
  return randomByte % max;
}

function generateId(length: number = 21): string {
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let id = '';
  while (id.length < length) {
    const bytes = randomBytes(length - id.length + 10);
    for (let i = 0; i < bytes.length && id.length < length; i++) {
      const index = unbiasedRandomIndex(alphabet.length, bytes[i]);
      if (index !== null) id += alphabet[index];
    }
  }
  return id;
}

Given('I publish the created form',
  async function (this: CustomWorld) {
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
  async function (this: CustomWorld, templateName: string, title: string) {
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

Given('I set the submission limit to {int} response on the published form',
  async function (this: CustomWorld, limit: number) {
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form must exist before configuring submission limits');
    expectDefined(this.authToken, 'Auth token is required to update form settings');

    const existingSettings = (() => {
      if (!form.settings) return {};
      if (typeof form.settings === 'string') {
        try {
          return JSON.parse(form.settings);
        } catch {
          return {};
        }
      }
      return form.settings;
    })();

    const updatedForm = await this.formTestUtils.updateForm(this.authToken!, form.id, {
      settings: {
        ...existingSettings,
        submissionLimits: {
          ...existingSettings?.submissionLimits,
          maxResponses: {
            enabled: true,
            limit,
          },
        },
      },
    });

    this.setSharedTestData('createdForm', updatedForm);
    console.log(`📊 Enabled submission limit of ${limit} for form ${updatedForm.id}`);
  }
);

Given('I configure a custom thank you message {string} on the published form',
  async function (this: CustomWorld, messageTemplate: string) {
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form must exist before configuring thank you message');
    expectDefined(this.prisma, 'Prisma client must be available to update the form layout');

    // Thank-you content now lives on formSchema.layout.thankYouContent (edited live in
    // the builder's Layout tab, synced via Y.js/Hocuspocus in the real app — see #170).
    // There's no GraphQL mutation surface for it outside that collaborative document, so
    // this API-level test writes the layout field directly via Prisma, same as the DB
    // assertions elsewhere in this suite (e.g. "the form should have N stored responses").
    const existingSchema = (() => {
      if (!form.formSchema) return { pages: [], layout: {} };
      if (typeof form.formSchema === 'string') {
        try {
          return JSON.parse(form.formSchema);
        } catch {
          return { pages: [], layout: {} };
        }
      }
      return form.formSchema;
    })();

    const updatedSchema = {
      ...existingSchema,
      layout: {
        ...existingSchema.layout,
        thankYouContent: messageTemplate,
      },
    };

    await this.prisma.form.update({
      where: { id: form.id },
      data: { formSchema: updatedSchema },
    });

    // submitResponse resolves the thank-you template from the live Hocuspocus document
    // first, only falling back to this Form.formSchema column if no collaborative
    // document exists (see responses.ts) — and createForm always initializes one. So the
    // Prisma write above alone would be invisible to the resolver; patch the stored Y.Doc's
    // layout.thankYouContent to match, the same way a real builder edit would.
    // Dynamic import (not a top-level `import * as Y from 'yjs'`) — yjs ships ESM-only,
    // and a static import here produces a `require()` call under this project's CJS
    // ts-node transpilation, which fails to load at all (TS1479).
    const collabDoc = await this.prisma.collaborativeDocument.findUnique({
      where: { documentName: form.id },
    });
    // createForm always initializes a collaborative document, so a missing one here
    // means the test isn't exercising the live-document path it's meant to validate —
    // fail loudly instead of silently falling through to the (also-updated) DB column.
    expectDefined(collabDoc, 'Collaborative document must exist for live thank-you content tests');

    const Y = await import('yjs');
    const doc = new Y.Doc();
    Y.applyUpdate(doc, new Uint8Array(collabDoc.state));
    const formSchemaMap = doc.getMap('formSchema');
    let layoutMap: any = formSchemaMap.get('layout');
    if (!(layoutMap instanceof Y.Map)) {
      layoutMap = new Y.Map();
      formSchemaMap.set('layout', layoutMap);
    }
    layoutMap.set('thankYouContent', messageTemplate);
    const state = Buffer.from(Y.encodeStateAsUpdate(doc));
    await this.prisma.collaborativeDocument.update({
      where: { documentName: form.id },
      data: { state },
    });
    doc.destroy();

    this.setSharedTestData('createdForm', { ...form, formSchema: updatedSchema });
    this.setSharedTestData('thankYouTemplate', messageTemplate);
    console.log(`💬 Configured custom thank you message on form ${form.id}`);
  }
);

When('a public user submits a response to the published form',
  async function (this: CustomWorld) {
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

When('another public user attempts to submit a response to the published form',
  async function (this: CustomWorld) {
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form must exist before submitting response');

    const submissionData = this.formTestUtils.generateSampleFormData(form.formSchema);
    const input = {
      formId: form.id,
      data: submissionData,
      sessionId: generateId(16),
      userAgent: 'integration-test-agent',
      timezone: 'UTC',
      language: 'en-US',
      completionTimeSeconds: 10,
    };

    try {
      const response = await this.formTestUtils.submitResponse(input);
      this.setSharedTestData('lastResponse', response);
      this.setSharedTestData('responseError', undefined);
      console.warn('⚠️ Additional submission unexpectedly succeeded despite limits');
    } catch (error) {
      this.setSharedTestData('responseError', error);
      console.log('❌ Additional submission blocked by submission limits as expected');
    }
  }
);

When('a public user attempts to submit a response to the unpublished form titled {string}',
  async function (this: CustomWorld, title: string) {
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
  function (this: CustomWorld, expectedMessage: string) {
    const response = this.getSharedTestData('lastResponse');
    expectDefined(response, 'Response should exist after successful submission');
    expectEqual(
      response.thankYouMessage,
      expectedMessage,
      'Thank you message should match expected default'
    );
  }
);

Then('the form should have {int} stored responses',
  async function (this: CustomWorld, expectedCount: number) {
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
  async function (this: CustomWorld) {
    const submittedData = this.getSharedTestData('lastSubmittedData');
    const response = this.getSharedTestData('lastResponse');

    expectDefined(submittedData, 'Submitted data should be stored for comparison');
    expectDefined(response, 'Response should exist for comparison');
    expectDeepEqual(response.data, submittedData, 'Stored response data should match submitted payload');
  }
);

Then('the submission should fail with error {string}',
  function (this: CustomWorld, expectedMessage: string) {
    const error = this.getSharedTestData('responseError') as Error | undefined;
    expectDefined(error, 'Error should be captured for failed submission');
    expectEqual(error.message, expectedMessage, 'Error message should match expected value');
  }
);

Then('the custom thank you message should render with submitted data',
  function (this: CustomWorld) {
    const response = this.getSharedTestData('lastResponse');
    const submittedData = this.getSharedTestData('lastSubmittedData');
    const template = this.getSharedTestData('thankYouTemplate');

    expectDefined(response, 'Response should exist after submission');
    expectDefined(submittedData, 'Submitted data should be stored');
    expectDefined(template, 'Thank you template should be stored');

    const renderedExpectation = template.replace(/\{\{([^}]+)\}\}/g, (_match: string, fieldId: string) => {
      const value = submittedData[fieldId];
      return value !== undefined && value !== null ? String(value) : `[${fieldId}]`;
    });

    expectEqual(response.thankYouMessage, renderedExpectation, 'Thank you message should include substituted field values');
  }
);

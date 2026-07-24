import { Given, When, Then } from '@cucumber/cucumber';
import { randomBytes } from 'crypto';
import { CustomWorld } from '../support/world';
import { expectDefined, expectEqual } from '../utils/expect-helper';

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

const NAME_FIELD_ID = 'automation-name-field';

Given('I create a published form for automation testing titled {string}',
  async function (this: CustomWorld, title: string) {
    expectDefined(this.authToken, 'Auth token is required to create forms');
    expectDefined(this.currentOrganization, 'Organization context is required to create forms');
    expectDefined(this.currentUser, 'Current user is required to create forms');

    const formSchema = {
      pages: [
        {
          id: generateId(),
          title: 'Page 1',
          order: 0,
          fields: [
            {
              id: NAME_FIELD_ID,
              type: 'TEXT_INPUT_FIELD',
              label: 'Name',
              defaultValue: '',
              prefix: '',
              hint: '',
              placeholder: 'Enter your name',
              validation: { type: 'TEXT_FIELD_VALIDATION', required: false },
            },
          ],
        },
      ],
      layout: {
        theme: 'light',
        textColor: '#000000',
        spacing: 'normal',
        code: 'L1',
        customBackGroundColor: '#ffffff',
        backgroundImageKey: '',
      },
      isShuffleEnabled: false,
    };

    const form = await this.prisma.form.create({
      data: {
        id: generateId(),
        title,
        description: 'Form for automation trigger integration test',
        shortUrl: generateId(8),
        formSchema: JSON.stringify(formSchema),
        isPublished: true,
        organizationId: this.currentOrganization!.id,
        createdById: this.currentUser!.id,
        sharingScope: 'PUBLIC',
        defaultPermission: 'VIEW',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    this.setSharedTestData('automationTestForm', {
      id: form.id,
      shortUrl: form.shortUrl,
    });

    console.log(`✅ Created automation test form: ${form.id}`);
  }
);

Given('I create an ACTIVE single-action automation on that form that emails {string} with subject {string}',
  async function (this: CustomWorld, recipientEmail: string, subject: string) {
    const form = this.getSharedTestData('automationTestForm');
    expectDefined(form, 'Automation test form must exist before creating an automation');
    expectDefined(this.currentOrganization, 'Organization context is required');
    expectDefined(this.currentUser, 'Current user is required');

    const graph = {
      nodes: [
        { id: 'trigger-1', type: 'trigger', data: { triggerType: 'form.submitted' } },
        {
          id: 'action-1',
          type: 'action',
          data: {
            actionType: 'email',
            config: {
              recipientEmail,
              subject,
              message: `A new response was submitted: {{${NAME_FIELD_ID}}}`,
            },
          },
        },
      ],
      edges: [{ id: 'e1', source: 'trigger-1', target: 'action-1' }],
    };

    const automation = await this.prisma.automation.create({
      data: {
        id: generateId(),
        formId: form.id,
        organizationId: this.currentOrganization!.id,
        name: 'Send email on submission',
        status: 'ACTIVE',
        triggerType: 'form.submitted',
        graph,
        version: 1,
        createdBy: this.currentUser!.id,
      },
    });

    this.setSharedTestData('automation', { id: automation.id });
    console.log(`✅ Created ACTIVE automation: ${automation.id}`);
  }
);

When('I submit a response to that form with field {string} value {string}',
  async function (this: CustomWorld, fieldLabel: string, value: string) {
    const form = this.getSharedTestData('automationTestForm');
    expectDefined(form, 'Automation test form must exist before submitting a response');
    expectEqual(fieldLabel, 'Name', 'This step only knows the "Name" field of the automation test form');

    const mutation = `
      mutation SubmitResponse($input: SubmitResponseInput!) {
        submitResponse(input: $input) {
          id
          formId
        }
      }
    `;

    const response = await this.authUtils.graphqlRequest(
      mutation,
      { input: { formId: form.id, data: { [NAME_FIELD_ID]: value } } },
      '' // Public submission, no auth token
    );

    if (response.data.errors) {
      throw new Error(`Failed to submit response: ${response.data.errors[0].message}`);
    }

    console.log(`📤 Submitted response ${response.data.data.submitResponse.id} to form ${form.id}`);
  }
);

Then('an automation run for that automation should reach status {string} within {int} seconds',
  async function (this: CustomWorld, expectedStatus: string, timeoutSeconds: number) {
    const automation = this.getSharedTestData('automation');
    expectDefined(automation, 'Automation must exist before polling for a run');

    const deadline = Date.now() + timeoutSeconds * 1000;
    let lastRun: { status: string } | null = null;

    while (Date.now() < deadline) {
      lastRun = await this.prisma.automationRun.findFirst({
        where: { automationId: automation.id },
        orderBy: { startedAt: 'desc' },
      });

      if (lastRun && lastRun.status === expectedStatus) {
        console.log(`✅ Automation run reached status ${expectedStatus}`);
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    throw new Error(
      `Automation run for automation ${automation.id} did not reach status "${expectedStatus}" within ${timeoutSeconds}s ` +
      `(last observed: ${lastRun ? lastRun.status : 'no run found'})`
    );
  }
);

Then('the mock SMTP server should have received an email with subject {string}',
  async function (this: CustomWorld, subject: string) {
    const deadline = Date.now() + 5000;

    while (Date.now() < deadline) {
      const found = this.mockSMTP.getCapturedEmails().some((email) => email.subject === subject);
      if (found) {
        console.log(`✅ Mock SMTP received email with subject "${subject}"`);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    throw new Error(`Mock SMTP server never received an email with subject "${subject}"`);
  }
);

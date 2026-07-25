import { Given, When, Then, Before, After } from '@cucumber/cucumber';
import { randomBytes } from 'crypto';
import { CustomWorld } from '../support/world';
import { MockWebhookServer } from '../utils/mock-servers';
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
const WEBHOOK_PATH = '/automation-webhook';

// Cucumber runs this suite with `parallel: 1` (test/integration/cucumber.js), so a single
// module-level instance — started/stopped per scenario via tagged hooks — is safe.
let mockWebhookServer: MockWebhookServer | undefined;

Before({ tags: '@automations' }, async function () {
  mockWebhookServer = new MockWebhookServer({ port: 9825 });
  await mockWebhookServer.start();
});

After({ tags: '@automations' }, async function () {
  if (mockWebhookServer) {
    await mockWebhookServer.stop();
    mockWebhookServer = undefined;
  }
});

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
        // formSchema is a Prisma Json column — pass the object directly (not
        // JSON.stringify'd, which would double-encode it as a JSON string value).
        formSchema,
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

Given('I create an ACTIVE single-action automation on that form that calls the mock webhook server',
  async function (this: CustomWorld) {
    await createSingleActionAutomation(this, 'form.submitted');
  }
);

Given('I create an ACTIVE single-action automation on that form with trigger {string} that calls the mock webhook server',
  async function (this: CustomWorld, triggerType: string) {
    await createSingleActionAutomation(this, triggerType);
  }
);

async function createSingleActionAutomation(world: CustomWorld, triggerType: string): Promise<void> {
  const form = world.getSharedTestData('automationTestForm');
  expectDefined(form, 'Automation test form must exist before creating an automation');
  expectDefined(world.currentOrganization, 'Organization context is required');
  expectDefined(world.currentUser, 'Current user is required');

  expectDefined(mockWebhookServer, 'Mock webhook server must be running');
  // Read the port start() actually bound (it silently retries on port + 1 if the
  // requested one is taken), so the automation always points at the live server.
  const webhookUrl = `http://localhost:${mockWebhookServer!.getPort()}${WEBHOOK_PATH}`;

  const graph = {
    nodes: [
      { id: 'trigger-1', type: 'trigger', data: { triggerType } },
      {
        id: 'action-1',
        type: 'action',
        data: {
          actionType: 'webhook',
          config: { url: webhookUrl },
        },
      },
    ],
    edges: [{ id: 'e1', source: 'trigger-1', target: 'action-1' }],
  };

  const automation = await world.prisma.automation.create({
    data: {
      id: generateId(),
      formId: form.id,
      organizationId: world.currentOrganization!.id,
      name: `Call webhook on ${triggerType}`,
      status: 'ACTIVE',
      triggerType,
      graph,
      version: 1,
      createdBy: world.currentUser!.id,
    },
  });

  world.setSharedTestData('automation', { id: automation.id });
  console.log(`✅ Created ACTIVE automation (${triggerType}): ${automation.id}`);
}

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

    const responseId = response.data.data.submitResponse.id;
    this.setSharedTestData('automationTestResponse', { id: responseId });
    console.log(`📤 Submitted response ${responseId} to form ${form.id}`);
  }
);

When('I edit that response\'s field {string} to value {string}',
  async function (this: CustomWorld, fieldLabel: string, value: string) {
    expectDefined(this.authToken, 'Auth token is required to edit a response');
    const submittedResponse = this.getSharedTestData('automationTestResponse');
    expectDefined(submittedResponse, 'A response must be submitted before it can be edited');
    expectEqual(fieldLabel, 'Name', 'This step only knows the "Name" field of the automation test form');

    const mutation = `
      mutation UpdateResponse($input: UpdateResponseInput!) {
        updateResponse(input: $input) {
          id
        }
      }
    `;

    const response = await this.authUtils.graphqlRequest(
      mutation,
      { input: { responseId: submittedResponse.id, data: { [NAME_FIELD_ID]: value } } },
      this.authToken
    );

    if (response.data.errors) {
      throw new Error(`Failed to edit response: ${response.data.errors[0].message}`);
    }

    console.log(`✏️  Edited response ${submittedResponse.id}`);
  }
);

Then('an automation run for that automation should reach status {string} within {int} seconds',
  { timeout: 25000 },
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

Then('the mock webhook server should have received a request for that form\'s submission',
  async function (this: CustomWorld) {
    const form = this.getSharedTestData('automationTestForm');
    expectDefined(form, 'Automation test form must exist before checking webhook delivery');
    expectDefined(mockWebhookServer, 'Mock webhook server must be running');

    const received = mockWebhookServer!
      .getRequestsByUrl(WEBHOOK_PATH)
      .some((req) => req.body?.formId === form.id);

    if (!received) {
      throw new Error(
        `Mock webhook server never received a request for form ${form.id} at ${WEBHOOK_PATH}. ` +
        `Received: ${JSON.stringify(mockWebhookServer!.getReceivedRequests())}`
      );
    }

    console.log(`✅ Mock webhook server received the automation's request for form ${form.id}`);
  }
);

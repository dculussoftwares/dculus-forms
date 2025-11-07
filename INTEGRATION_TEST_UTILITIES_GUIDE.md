# Integration Test Utilities - Quick Reference Guide

This guide provides examples of how to use the new integration test utilities in your Cucumber step definitions.

---

## Table of Contents
1. [Database Utilities](#database-utilities)
2. [Plugin Test Utilities](#plugin-test-utilities)
3. [Analytics Test Utilities](#analytics-test-utilities)
4. [Collaboration Test Utilities](#collaboration-test-utilities)
5. [Mock Servers](#mock-servers)
6. [World Context](#world-context)

---

## Database Utilities

### Import
```typescript
import {
  seedTestUser,
  seedTestOrganization,
  seedTestForm,
  seedTestResponse,
  seedTestResponses,
  clearAllData,
  createCompleteTestSetup,
} from '../utils/db-utils';
```

### Example: Seed a User
```typescript
Given('a user exists with email {string}', async function(this: CustomWorld, email: string) {
  const user = await seedTestUser(this.prisma, {
    name: 'Test User',
    email,
    role: 'user',
  });

  this.setSharedTestData('userId', user.id);
});
```

### Example: Create Complete Test Setup
```typescript
Given('I have a complete test setup', async function(this: CustomWorld) {
  const { user, organization, form } = await createCompleteTestSetup(this.prisma, {
    userName: 'Test User',
    userEmail: 'test@example.com',
    orgName: 'Test Org',
    formTitle: 'Test Form',
  });

  this.setSharedTestData('user', user);
  this.setSharedTestData('organization', organization);
  this.setSharedTestData('form', form);
});
```

### Example: Seed Bulk Responses
```typescript
Given('the form has {int} responses', async function(this: CustomWorld, count: number) {
  const formId = this.getSharedTestData('formId');

  await seedTestResponses(this.prisma, formId, count, (index) => ({
    field1: `Value ${index}`,
    field2: `Response ${index}`,
  }));
});
```

### Example: Verify Database State
```typescript
Then('the database should have {int} forms', async function(this: CustomWorld, expectedCount: number) {
  const actualCount = await this.prisma.form.count();
  expect(actualCount).toBe(expectedCount);
});
```

### Example: Clear Specific Data
```typescript
import { clearFormData } from '../utils/db-utils';

After(async function(this: CustomWorld) {
  const formId = this.getSharedTestData('formId');
  if (formId) {
    await clearFormData(this.prisma, formId);
  }
});
```

---

## Plugin Test Utilities

### Import
```typescript
import { PluginTestUtils } from '../utils/plugin-test-utils';
```

### Initialize in World
```typescript
// In world.ts constructor
this.pluginTestUtils = new PluginTestUtils(this.baseURL);
```

### Example: Create Webhook Plugin
```typescript
Given('I have configured a webhook plugin with URL {string}',
  async function(this: CustomWorld, url: string) {
    const token = this.authUtils.getToken();
    const formId = this.getSharedTestData('formId');

    const plugin = await this.pluginTestUtils.createWebhookPlugin(token, formId, {
      url,
      headers: {
        'X-Custom-Header': 'test-value',
      },
      retries: 3,
    });

    this.setSharedTestData('webhookPlugin', plugin);
  }
);
```

### Example: Create Quiz Plugin
```typescript
Given('I have configured quiz grading with correct answers:',
  async function(this: CustomWorld, dataTable: DataTable) {
    const token = this.authUtils.getToken();
    const formId = this.getSharedTestData('formId');
    const rows = dataTable.hashes();

    const questions = rows.map(row => ({
      fieldId: row.fieldId,
      correctAnswer: row.correctAnswer,
      marks: parseFloat(row.marks),
    }));

    const plugin = await this.pluginTestUtils.createQuizPlugin(token, formId, {
      questions,
      passThreshold: 60,
    });

    this.setSharedTestData('quizPlugin', plugin);
  }
);
```

### Example: Wait for Plugin Execution
```typescript
Then('the webhook should be delivered',
  async function(this: CustomWorld) {
    const token = this.authUtils.getToken();
    const responseId = this.getSharedTestData('responseId');

    const executed = await this.pluginTestUtils.waitForPluginExecution(
      token,
      responseId,
      'webhook',
      10000 // 10 second timeout
    );

    expect(executed).toBe(true);
  }
);
```

### Example: Get Quiz Results
```typescript
Then('the quiz score should be {int}/{int}',
  async function(this: CustomWorld, score: number, total: number) {
    const token = this.authUtils.getToken();
    const responseId = this.getSharedTestData('responseId');

    const results = await this.pluginTestUtils.getQuizResults(token, responseId);

    expect(results.quizScore).toBe(score);
    expect(results.totalMarks).toBe(total);
  }
);
```

---

## Analytics Test Utilities

### Import
```typescript
import { AnalyticsTestUtils } from '../utils/analytics-test-utils';
```

### Initialize in World
```typescript
// In world.ts constructor
this.analyticsTestUtils = new AnalyticsTestUtils(this.baseURL);
```

### Example: Track Form View
```typescript
When('a user views the form', async function(this: CustomWorld) {
  const formId = this.getSharedTestData('formId');

  await this.analyticsTestUtils.trackFormView(formId, {
    sessionId: nanoid(),
    browser: 'Chrome',
    operatingSystem: 'Windows',
    countryCode: 'USA',
  });
});
```

### Example: Generate Bulk Views
```typescript
Given('the form has {int} views with variance',
  async function(this: CustomWorld, count: number) {
    const formId = this.getSharedTestData('formId');

    await this.analyticsTestUtils.generateBulkViews(formId, count, true);
  }
);
```

### Example: Query Analytics with Time Range
```typescript
Then('the analytics for the last {int} days should show {int} views',
  async function(this: CustomWorld, days: number, expectedViews: number) {
    const token = this.authUtils.getToken();
    const formId = this.getSharedTestData('formId');
    const timeRange = this.analyticsTestUtils.createTimeRange(days);

    const analytics = await this.analyticsTestUtils.getFormViewAnalytics(
      token,
      formId,
      timeRange
    );

    expect(analytics.totalViews).toBe(expectedViews);
  }
);
```

### Example: Get Field Analytics
```typescript
Then('the word cloud for field {string} should contain {string}',
  async function(this: CustomWorld, fieldId: string, word: string) {
    const token = this.authUtils.getToken();
    const formId = this.getSharedTestData('formId');

    const analytics = await this.analyticsTestUtils.getFieldAnalytics(
      token,
      formId,
      fieldId
    );

    const wordExists = analytics.wordCloud.some((w: any) => w.word === word);
    expect(wordExists).toBe(true);
  }
);
```

---

## Collaboration Test Utilities

### Import
```typescript
import { CollaborationTestUtils } from '../utils/collaboration-test-utils';
```

### Initialize in World
```typescript
// In world.ts constructor
this.collaborationTestUtils = new CollaborationTestUtils(this.baseURL);
```

### Example: Connect to Document
```typescript
Given('I connect to the collaborative document for form {string}',
  async function(this: CustomWorld, formId: string) {
    const token = this.authUtils.getToken();
    const user = this.currentUser!;

    const ws = await this.collaborationTestUtils.connectToDocument({
      formId,
      userId: user.id,
      token,
    });

    this.setSharedTestData('websocket', ws);
  }
);
```

### Example: Simulate Concurrent Edit
```typescript
When('two users edit the form concurrently',
  async function(this: CustomWorld) {
    const formId = this.getSharedTestData('formId');
    const user1 = this.getTestUser('user1');
    const user2 = this.getTestUser('user2');

    await this.collaborationTestUtils.simulateConcurrentEdit(
      formId,
      [
        { userId: user1!.user.id, token: user1!.token },
        { userId: user2!.user.id, token: user2!.token },
      ],
      [
        (doc) => {
          // User 1 edits field 1
          const formSchema = doc.getMap('formSchema');
          formSchema.set('field1', 'User 1 Edit');
        },
        (doc) => {
          // User 2 edits field 2
          const formSchema = doc.getMap('formSchema');
          formSchema.set('field2', 'User 2 Edit');
        },
      ]
    );
  }
);
```

### Example: Verify Document State
```typescript
Then('both users should see {int} new fields',
  async function(this: CustomWorld, expectedCount: number) {
    const formId = this.getSharedTestData('formId');

    const state = this.collaborationTestUtils.getDocumentState(formId);
    const fieldCount = Object.keys(state).length;

    expect(fieldCount).toBe(expectedCount);
  }
);
```

---

## Mock Servers

### Import
```typescript
import { MockWebhookServer, MockSMTPServer } from '../utils/mock-servers';
```

### Example: Setup Mock Webhook Server (in hooks.ts)
```typescript
import { MockWebhookServer } from '../utils/mock-servers';

let mockWebhookServer: MockWebhookServer;

Before(async function() {
  mockWebhookServer = new MockWebhookServer({ port: 9999 });
  await mockWebhookServer.start();
});

After(async function() {
  await mockWebhookServer.stop();
});
```

### Example: Verify Webhook Delivery
```typescript
Then('the webhook should be delivered to {string}',
  async function(this: CustomWorld, url: string) {
    const requests = mockWebhookServer.getRequestsByUrl(url);
    expect(requests.length).toBeGreaterThan(0);
  }
);
```

### Example: Simulate Webhook Failure
```typescript
Given('the webhook server will return {int} status for {string}',
  async function(this: CustomWorld, statusCode: number, url: string) {
    mockWebhookServer.simulateError(url, statusCode);
  }
);
```

### Example: Verify Webhook Payload
```typescript
Then('the webhook payload should contain the response data',
  async function(this: CustomWorld) {
    const responseId = this.getSharedTestData('responseId');

    const verified = mockWebhookServer.verifyWebhookReceived(
      '/webhook',
      (body) => body.responseId === responseId
    );

    expect(verified).toBe(true);
  }
);
```

### Example: Mock Email Server
```typescript
Then('an email should be sent to {string}',
  async function(this: CustomWorld, recipient: string) {
    const mockSMTP = new MockSMTPServer();
    const verified = mockSMTP.verifyEmailSent(recipient);
    expect(verified).toBe(true);
  }
);
```

---

## World Context

### Access Prisma Client
```typescript
When('I directly query the database', async function(this: CustomWorld) {
  const forms = await this.prisma.form.findMany({
    where: {
      organizationId: this.currentOrganization?.id,
    },
  });

  this.setSharedTestData('forms', forms);
});
```

### Clear Database Between Scenarios
```typescript
Before(async function(this: CustomWorld) {
  // Clear database before each scenario
  await this.clearDatabase();
});
```

### Store and Retrieve Test Data
```typescript
// Store data
this.setSharedTestData('formId', form.id);
this.setSharedTestData('user', user);

// Retrieve data
const formId = this.getSharedTestData('formId');
const user = this.getSharedTestData('user');
```

### Track Current Organization
```typescript
Given('I have an organization {string}', async function(this: CustomWorld, orgName: string) {
  const org = await seedTestOrganization(this.prisma, { name: orgName });
  this.currentOrganization = { id: org.id, name: org.name };
});

// Later access
const orgId = this.currentOrganization?.id;
```

---

## Complete Example: Form CRUD Scenario

```typescript
import { Given, When, Then } from '@cucumber/cucumber';
import { CustomWorld } from '../support/world';
import { seedTestUser, seedTestOrganization, createCompleteTestSetup } from '../utils/db-utils';

Given('I have a complete test setup', async function(this: CustomWorld) {
  const { user, organization, form } = await createCompleteTestSetup(this.prisma, {
    userName: 'Test User',
    userEmail: 'test@example.com',
    orgName: 'Test Org',
    formTitle: 'My Form',
  });

  // Sign in the user
  const authResult = await this.authUtils.signIn(user.email, 'password');
  this.setAuthContext(authResult.user, authResult.session, authResult.token);

  this.setSharedTestData('user', user);
  this.setSharedTestData('organization', organization);
  this.setSharedTestData('form', form);
  this.currentOrganization = { id: organization.id, name: organization.name };
});

When('I update the form title to {string}', async function(this: CustomWorld, newTitle: string) {
  const token = this.authToken!;
  const form = this.getSharedTestData('form');

  const updated = await this.formTestUtils.updateForm(token, form.id, {
    title: newTitle,
  });

  this.setSharedTestData('updatedForm', updated);
});

Then('the form title should be {string}', async function(this: CustomWorld, expectedTitle: string) {
  const form = this.getSharedTestData('updatedForm');
  expect(form.title).toBe(expectedTitle);
});

Then('the database should reflect the new title', async function(this: CustomWorld) {
  const form = this.getSharedTestData('form');
  const dbForm = await this.prisma.form.findUnique({
    where: { id: form.id },
  });

  expect(dbForm?.title).toBe(this.getSharedTestData('updatedForm').title);
});
```

---

## Best Practices

### 1. Always Clean Up
```typescript
After(async function(this: CustomWorld) {
  // Cleanup is automatic via World.cleanup()
  // But you can do additional cleanup if needed
  if (this.collaborationTestUtils) {
    await this.collaborationTestUtils.cleanup();
  }
});
```

### 2. Use Shared Test Data
```typescript
// Store once
this.setSharedTestData('formId', form.id);

// Access anywhere
const formId = this.getSharedTestData('formId');
```

### 3. Verify Both GraphQL and Database
```typescript
// GraphQL response
const form = await this.formTestUtils.getForm(token, formId);
expect(form.title).toBe('Expected Title');

// Database verification
const dbForm = await this.prisma.form.findUnique({ where: { id: formId } });
expect(dbForm?.title).toBe('Expected Title');
```

### 4. Use Type-Safe Seeding
```typescript
import { SeedFormData } from '../utils/db-utils';

const formData: SeedFormData = {
  title: 'Test Form',
  formSchema: { /* ... */ },
  organizationId: org.id,
  createdById: user.id,
  isPublished: true,
};

const form = await seedTestForm(this.prisma, formData);
```

### 5. Handle Async Operations
```typescript
// Wait for plugin execution
await this.pluginTestUtils.waitForPluginExecution(token, responseId, 'webhook', 10000);

// Wait for collaboration sync
await this.collaborationTestUtils.waitForSynchronization(formId, 2000);
```

---

## Troubleshooting

### Issue: Prisma client not initialized
```typescript
// Solution: Ensure BeforeAll hook runs first
// Check that test is running locally (not against remote backend)
if (!this.prisma) {
  console.warn('Prisma client not available for remote tests');
  return;
}
```

### Issue: WebSocket connection fails
```typescript
// Solution: Ensure Hocuspocus server is running
// Check authentication token is valid
// Verify WebSocket URL is correct (ws:// not http://)
```

### Issue: Mock server port conflict
```typescript
// Solution: Use different port or let server auto-increment
const mockServer = new MockWebhookServer({ port: 9999 });
await mockServer.start(); // Will try 10000 if 9999 is in use
```

---

## Additional Resources

- **MongoDB Memory Server Docs**: https://github.com/nodkz/mongodb-memory-server
- **Prisma Client Docs**: https://www.prisma.io/docs/concepts/components/prisma-client
- **YJS Docs**: https://docs.yjs.dev/
- **Cucumber.js Docs**: https://cucumber.io/docs/cucumber/

---

**Happy Testing! 🎉**

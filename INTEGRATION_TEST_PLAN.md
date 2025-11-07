# Backend Integration Test Suite Implementation Plan

## Overview
This document outlines a comprehensive Cucumber BDD integration test suite targeting 80%+ coverage across GraphQL resolvers, plugin system, real-time collaboration, and security/authorization for the dculus-forms backend.

## Current State Analysis

### Existing Test Infrastructure
- **Unit Tests**: Vitest 4.0.7 with 73 existing test files
- **Integration Tests**: Cucumber.js 12.2.0 with Gherkin features
- **E2E Tests**: Playwright 1.52.0 for browser automation
- **Test Database**: MongoDB Memory Server 10.3.0 for isolated testing
- **Coverage Tool**: @vitest/coverage-v8 targeting 80%+ thresholds

### Current Integration Test Coverage
Existing feature files in `test/integration/features/`:
- ✅ `auth.feature` - Authentication workflows
- ✅ `auth-simple.feature` - Simple auth tests
- ✅ `auth-graphql.feature` - GraphQL auth tests
- ✅ `health.feature` - Health check endpoint
- ✅ `form-lifecycle.feature` - Basic form CRUD
- ✅ `form-responses.feature` - Response submission
- ✅ `organization-security.feature` - Permission tests
- ✅ `template-authorization.feature` - Template access control
- ✅ `file-upload.feature` - File upload operations

### Gaps to Address
The following critical areas lack comprehensive integration test coverage:
1. **GraphQL Resolvers** (forms.ts, responses.ts, plugins.ts, admin.ts, analytics.ts, fieldAnalytics.ts)
2. **Plugin System** (webhook, email, quiz auto-grading, plugin executor)
3. **Real-time Collaboration** (YJS/Hocuspocus integration)
4. **Advanced Analytics** (form view/submission analytics, field-level analytics)
5. **Security Edge Cases** (permission boundaries, data leakage prevention)
6. **Performance & Concurrency** (large datasets, concurrent operations)

## Test Strategy

### Testing Approach
- **Framework**: Cucumber BDD (Gherkin syntax) for human-readable scenarios
- **Database**: MongoDB Memory Server for fast, isolated test execution
- **Coverage Target**: 80%+ across all backend code
- **Execution**: Sequential (parallel: 1) to avoid port conflicts
- **Cleanup**: Automatic database reset between scenarios

### Test Tagging Strategy
- `@GraphQL` - GraphQL resolver tests
- `@Plugins` - Plugin system tests
- `@Collaboration` - Real-time collaboration tests
- `@Security` - Security/authorization tests
- `@Performance` - Performance/load tests
- `@Critical` - Critical path scenarios (run on every commit)
- `@Smoke` - Quick smoke tests (run before full suite)
- `@Integration` - All integration tests

### Quality Gates
- All `@Critical` tests must pass before PR merge
- Full suite must pass before deployment
- Coverage reports generated on every test run
- Failed scenarios logged with detailed error messages

## Implementation Phases

### Phase 1: Test Infrastructure Enhancement (2-3 days)

#### 1.1 MongoDB Memory Server Integration for Cucumber
**Goal**: Replace live database dependency with in-memory MongoDB for faster, isolated tests.

**Files to Modify**:
- `test/integration/support/hooks.ts`
  - Add `BeforeAll` hook to start MongoDB Memory Server
  - Set `DATABASE_URL` environment variable to memory server URI
  - Add `AfterAll` hook to stop memory server
  - Maintain existing `Before`/`After` hooks for scenario-level cleanup

- `test/integration/support/world.ts`
  - Add Prisma client instance connected to memory database
  - Expose `prisma` property for direct database operations in steps
  - Add helper methods: `seedDatabase()`, `clearDatabase()`, `resetSequences()`

**New File**:
- `test/integration/utils/db-utils.ts`
  ```typescript
  // Database seeding utilities
  export async function seedTestOrganization(prisma, data)
  export async function seedTestUser(prisma, data)
  export async function seedTestForm(prisma, data)
  export async function seedTestResponses(prisma, formId, count)

  // Cleanup utilities
  export async function clearAllData(prisma)
  export async function clearFormData(prisma, formId)
  export async function clearUserData(prisma, userId)

  // Query utilities
  export async function getFormWithResponses(prisma, formId)
  export async function getOrganizationWithMembers(prisma, orgId)
  ```

**Configuration**:
- Update `test/integration/cucumber.js` to ensure single MongoDB instance
- Add timeout handling (60s for memory server startup)
- Configure parallel execution control

#### 1.2 Enhanced Test Utilities
**Goal**: Provide reusable helpers for complex test scenarios.

**New File**: `test/integration/utils/plugin-test-utils.ts`
```typescript
export class PluginTestUtils {
  // Webhook plugin helpers
  async createWebhookPlugin(formId, url, headers?)
  async verifyWebhookDelivery(webhookUrl, expectedPayload)
  async simulateWebhookFailure(webhookUrl)

  // Email plugin helpers
  async createEmailPlugin(formId, config)
  async getLastSentEmail()
  async verifyEmailContent(email, expectedData)

  // Quiz grading plugin helpers
  async createQuizPlugin(formId, questions)
  async setCorrectAnswers(pluginId, answers)
  async getQuizResults(responseId)

  // Plugin execution helpers
  async waitForPluginExecution(responseId, timeout = 5000)
  async getPluginExecutionLogs(responseId)
}
```

**New File**: `test/integration/utils/analytics-test-utils.ts`
```typescript
export class AnalyticsTestUtils {
  // View analytics helpers
  async trackFormView(formId, sessionData)
  async getFormViewAnalytics(formId, timeRange?)
  async generateBulkViews(formId, count, variance = true)

  // Submission analytics helpers
  async trackFormSubmission(formId, responseData)
  async getFormSubmissionAnalytics(formId, timeRange?)

  // Field analytics helpers
  async getFieldAnalytics(formId, fieldId)
  async getWordCloudData(formId, fieldId)
  async getChoiceDistribution(formId, fieldId)

  // Time range utilities
  createTimeRange(days: number)
  createCustomTimeRange(start: Date, end: Date)
}
```

**New File**: `test/integration/utils/collaboration-test-utils.ts`
```typescript
export class CollaborationTestUtils {
  // YJS document helpers
  async createYjsDocument(formId)
  async connectToDocument(formId, userId, token)
  async disconnectFromDocument(formId, userId)

  // Multi-user simulation
  async simulateConcurrentEdit(formId, users, edits)
  async getDocumentState(formId)
  async waitForSynchronization(formId, timeout = 3000)

  // WebSocket helpers
  async connectWebSocket(url, token)
  async sendYjsUpdate(ws, update)
  async receiveYjsUpdates(ws, timeout = 1000)

  // Conflict resolution
  async createConflict(formId, user1Edit, user2Edit)
  async verifyConflictResolution(formId, expectedState)
}
```

**New File**: `test/integration/utils/mock-servers.ts`
```typescript
// Mock webhook server
export class MockWebhookServer {
  private app: Express
  private server: Server
  private receivedRequests: Array<{url, method, headers, body, timestamp}>

  async start(port = 9999)
  async stop()
  getReceivedRequests()
  clearRequests()
  simulateTimeout(url)
  simulateError(url, statusCode)
}

// Mock SMTP server
export class MockSMTPServer {
  private server: any // nodemailer-mock or mailhog client
  private sentEmails: Array<Email>

  async start()
  async stop()
  getSentEmails()
  getLastEmail()
  clearEmails()
  verifyEmailSent(to, subject)
}
```

#### 1.3 Mock Services Configuration

**Mock Webhook Server Setup**:
- Express server listening on port 9999 (configurable)
- Captures all POST requests with headers, body, timestamp
- Supports timeout/error simulation for retry testing
- Automatic cleanup between scenarios

**Mock SMTP Server Setup**:
- Use `nodemailer-mock` or `mailhog` for email testing
- Capture sent emails with full content
- Support HTML/plain text verification
- Test @ mention parsing and variable interpolation

**Test Data Generators**:
- Complex form schemas (multi-page, all field types)
- Bulk response generation (100-1000+ responses)
- Realistic user data (names, emails, countries)
- Time-series data for analytics testing

### Phase 2: GraphQL Resolver Test Coverage (4-5 days)

#### 2.1 Form Operations (`features/graphql-resolvers/form-operations.feature`)

**Scenarios to Implement**:

```gherkin
@GraphQL @FormOps @Critical
Feature: Form Operations
  As a form owner
  I want to manage forms through GraphQL
  So that I can create and maintain my forms

  Background:
    Given I am authenticated as a user with email "form-owner@test.com"
    And I have an organization with ID "org-123"

  @Smoke
  Scenario: Create form with complex schema
    Given I have a form schema with 3 pages and 10 fields
    When I create a form with title "Complex Form" and the schema
    Then the form should be created successfully
    And the form should have 3 pages
    And the form should have 10 fields across all pages
    And the form should not be published

  Scenario: Update form schema - add new field
    Given I have a published form with ID "form-123"
    When I add a new "email" field to page 1
    Then the form should have the new field
    And the form should remain published
    And the collaborative document should be updated

  Scenario: Update form schema - remove field
    Given I have a form with 5 fields
    When I remove field with ID "field-3"
    Then the form should have 4 fields
    And existing responses should not be affected

  Scenario: Duplicate form with responses
    Given I have a form with ID "form-123"
    And the form has 50 responses
    When I duplicate the form with title "Copy of Form"
    Then a new form should be created
    And the new form should have the same schema
    And the new form should have 0 responses

  Scenario: Archive form
    Given I have an active form with ID "form-123"
    When I archive the form
    Then the form status should be "archived"
    And the form should not appear in active forms list
    And the form should be accessible via direct link

  Scenario: Restore archived form
    Given I have an archived form with ID "form-123"
    When I restore the form
    Then the form status should be "active"
    And the form should appear in active forms list

  Scenario: Delete form with responses
    Given I have a form with ID "form-123"
    And the form has 100 responses
    When I delete the form
    Then the form should be deleted
    And all 100 responses should be deleted
    And the collaborative document should be deleted

  Scenario: Transfer form ownership
    Given I have a form with ID "form-123"
    And there is another user "new-owner@test.com" in my organization
    When I transfer ownership to "new-owner@test.com"
    Then the form owner should be "new-owner@test.com"
    And I should have EDITOR permission on the form

  Scenario: Bulk form operations - delete multiple
    Given I have 10 forms
    When I delete forms with IDs ["form-1", "form-2", "form-3"]
    Then 3 forms should be deleted
    And I should have 7 forms remaining

  Scenario: Invalid schema validation - missing required field
    Given I have a form schema without a "type" field
    When I create a form with the invalid schema
    Then the creation should fail with error "Invalid schema"
    And no form should be created

  Scenario: Form schema with all field types
    Given I have a schema with all field types:
      | TextInputField | TextAreaField | EmailField | NumberField |
      | SelectField    | RadioField    | CheckboxField | DateField |
    When I create a form with this schema
    Then the form should be created successfully
    And all 8 field types should be present
```

**Step Definitions** (`step-definitions/form-operations.steps.ts`):
```typescript
import { Given, When, Then } from '@cucumber/cucumber';
import { CustomWorld } from '../support/world';

Given('I have a form schema with {int} pages and {int} fields',
  async function(this: CustomWorld, pageCount: number, fieldCount: number) {
    this.testFormSchema = this.formTestUtils.generateSchemaWithPages(pageCount, fieldCount);
  }
);

When('I create a form with title {string} and the schema',
  async function(this: CustomWorld, title: string) {
    const token = this.authUtils.getToken();
    const result = await this.formTestUtils.createForm(token, {
      title,
      organizationId: this.currentOrganization.id,
      formSchema: this.testFormSchema,
    });
    this.setSharedTestData('createdForm', result);
  }
);

Then('the form should have {int} pages',
  async function(this: CustomWorld, expectedPages: number) {
    const form = this.getSharedTestData('createdForm');
    const pageCount = form.formSchema.pages.length;
    expect(pageCount).toBe(expectedPages);
  }
);
```

#### 2.2 Form Sharing & Permissions (`features/graphql-resolvers/form-sharing.feature`)

**Key Scenarios**:
- Share form with VIEWER permission (can view, cannot edit)
- Share form with EDITOR permission (can edit, cannot delete)
- Revoke sharing access
- Update permission level (VIEWER → EDITOR, EDITOR → VIEWER)
- Attempt unauthorized edit as VIEWER (should fail)
- Share with non-organization member (should fail)
- Multiple users with different permissions
- Permission inheritance from organization role

#### 2.3 Response Operations (`features/graphql-resolvers/response-operations.feature`)

**Key Scenarios**:
- Submit response with all field types populated
- Submit response with only required fields
- Submit partial response (optional fields empty)
- Edit submitted response (if form allows editing)
- Delete response as form owner
- Bulk response deletion (100+ responses)
- Response pagination (test with 1000+ responses)
- Response filtering by date range
- Response filtering by field values
- Export responses to CSV format
- Export responses to JSON format
- Response submission to unpublished form (should fail)
- Response validation errors (required field missing)

#### 2.4 Analytics Features (`features/graphql-resolvers/analytics.feature`)

**Key Scenarios**:
- Track form view with browser/OS/country detection
- Track form submission analytics
- Get total view count for form
- Get unique session count
- Get top countries (with ISO codes)
- Get top browsers and versions
- Get top operating systems
- Analytics time-range queries (last 7 days, 30 days, custom)
- Response rate calculation (submissions / views)
- Analytics for unpublished form
- Analytics aggregation with 10,000+ views
- Field-level analytics (text field word cloud)
- Field-level analytics (select field choice distribution)
- Field-level response rate per field

#### 2.5 Admin Operations (`features/graphql-resolvers/admin-operations.feature`)

**Key Scenarios**:
- Admin view all organizations
- Admin access organization details (members, forms)
- Admin retrieve system statistics
- Admin access forms from different organizations
- Admin view all user accounts
- Non-admin attempt admin query (should fail)
- Super admin vs regular admin permissions
- Admin organization search by name
- Admin user search by email
- Admin system health check

#### 2.6 Template Operations (`features/graphql-resolvers/template-operations.feature`)

**Key Scenarios**:
- Create custom form template
- Update template title and description
- Delete template
- List all templates
- List templates by category
- Create form from template
- Create form from template with customization
- Template permission restrictions
- Template duplication
- Template schema validation

### Phase 3: Plugin System Integration Tests (3-4 days)

#### 3.1 Webhook Plugin (`features/plugins/webhook-plugin.feature`)

```gherkin
@Plugins @Webhook @Integration
Feature: Webhook Plugin
  As a form owner
  I want to send webhook notifications on form submission
  So that I can integrate with external systems

  Background:
    Given the mock webhook server is running on port 9999
    And I am authenticated as "form-owner@test.com"
    And I have a published form with ID "form-123"

  @Critical
  Scenario: Webhook fires on form submission
    Given I have configured a webhook plugin with URL "http://localhost:9999/webhook"
    When a user submits a response to the form
    Then the webhook should be delivered to "http://localhost:9999/webhook"
    And the webhook payload should contain the response data
    And the webhook should include header "Content-Type: application/json"
    And the response metadata should contain webhook delivery status

  Scenario: Webhook retry on failure (3 attempts)
    Given I have configured a webhook plugin with URL "http://localhost:9999/failing"
    And the webhook server will return 500 status for "http://localhost:9999/failing"
    When a user submits a response to the form
    Then the webhook should be attempted 3 times
    And the retry delays should be 1s, 2s, 4s (exponential backoff)
    And the response metadata should show "failed" status after 3 attempts

  Scenario: Webhook timeout handling
    Given I have configured a webhook plugin with URL "http://localhost:9999/slow"
    And the webhook server will timeout after 30 seconds
    When a user submits a response to the form
    Then the webhook request should timeout
    And the webhook should be retried
    And the response metadata should contain timeout error

  Scenario: Webhook with custom headers
    Given I have configured a webhook plugin with:
      | URL     | http://localhost:9999/webhook        |
      | Headers | Authorization: Bearer test-token-123 |
      | Headers | X-Custom-Header: custom-value        |
    When a user submits a response to the form
    Then the webhook should include custom headers
    And the Authorization header should be "Bearer test-token-123"

  Scenario: Multiple webhooks per form
    Given I have configured 3 webhook plugins:
      | webhook-1 | http://localhost:9999/webhook1 |
      | webhook-2 | http://localhost:9999/webhook2 |
      | webhook-3 | http://localhost:9999/webhook3 |
    When a user submits a response to the form
    Then all 3 webhooks should be delivered
    And the delivery should be in parallel
    And each webhook should have independent retry logic

  Scenario: Webhook payload validation
    Given I have configured a webhook plugin
    When a user submits a response to the form
    Then the webhook payload should contain:
      | formId       | form-123                    |
      | responseId   | <generated UUID>            |
      | submittedAt  | <ISO timestamp>             |
      | responseData | <all field values>          |
      | metadata     | <empty or plugin-specific>  |
```

**Step Definitions** (`step-definitions/webhook-plugin.steps.ts`):
```typescript
import { Given, When, Then } from '@cucumber/cucumber';
import { CustomWorld } from '../support/world';

Given('the mock webhook server is running on port {int}',
  async function(this: CustomWorld, port: number) {
    await this.mockWebhookServer.start(port);
  }
);

Given('I have configured a webhook plugin with URL {string}',
  async function(this: CustomWorld, url: string) {
    const token = this.authUtils.getToken();
    const formId = this.getSharedTestData('formId');
    const plugin = await this.pluginTestUtils.createWebhookPlugin(formId, url);
    this.setSharedTestData('webhookPlugin', plugin);
  }
);

Then('the webhook should be delivered to {string}',
  async function(this: CustomWorld, url: string) {
    await this.pluginTestUtils.waitForPluginExecution(
      this.getSharedTestData('responseId')
    );
    const requests = this.mockWebhookServer.getReceivedRequests();
    const delivered = requests.some(r => r.url.includes('/webhook'));
    expect(delivered).toBe(true);
  }
);
```

#### 3.2 Email Plugin (`features/plugins/email-plugin.feature`)

**Key Scenarios**:
- Email sent on form submission
- Email with recipient from form field (@ mention: `@email`)
- Email with static recipient list
- Email template rendering with variable interpolation
- Email with form data in body
- Email HTML vs plain text
- Multiple email recipients (CC, BCC)
- Email delivery failure handling
- Email metadata in response
- Email sent only when condition met (conditional email)

#### 3.3 Quiz Auto-Grading Plugin (`features/plugins/quiz-grading-plugin.feature`)

```gherkin
@Plugins @QuizGrading @Integration
Feature: Quiz Auto-Grading Plugin
  As a quiz creator
  I want automatic grading of quiz responses
  So that respondents get immediate feedback

  Background:
    Given I am authenticated as "quiz-creator@test.com"
    And I have a form with 5 quiz questions:
      | field-1 | SelectField | What is 2+2?           | [3, 4, 5]       |
      | field-2 | RadioField  | Capital of France?     | [London, Paris] |
      | field-3 | SelectField | Primary colors?        | [Red, Blue, Green, Yellow] |
      | field-4 | RadioField  | Largest planet?        | [Mars, Jupiter] |
      | field-5 | TextInputField | Describe photosynthesis | (not graded) |

  @Critical
  Scenario: Submit all correct answers (100% score)
    Given I have configured quiz grading with correct answers:
      | field-1 | 4       | 2 marks |
      | field-2 | Paris   | 3 marks |
      | field-3 | Red, Blue | 3 marks (multiple select) |
      | field-4 | Jupiter | 2 marks |
    And the pass threshold is 60%
    When a user submits:
      | field-1 | 4       |
      | field-2 | Paris   |
      | field-3 | Red, Blue |
      | field-4 | Jupiter |
    Then the quiz should be auto-graded
    And the score should be 10/10 (100%)
    And the result should be "PASS"
    And the metadata should contain per-question breakdown

  Scenario: Submit partial correct answers (50% score)
    Given quiz grading is configured with 10 total marks
    When a user submits 2 correct and 2 incorrect answers
    Then the score should be 5/10 (50%)
    And the result should be "FAIL" (below 60% threshold)

  Scenario: Custom pass threshold (40%)
    Given quiz grading is configured with 40% pass threshold
    When a user submits answers with 45% score
    Then the result should be "PASS"

  Scenario: Quiz metadata in response
    Given quiz grading is configured
    When a user submits answers
    Then the response metadata should contain:
      | quiz-grading.quizScore      | <calculated score> |
      | quiz-grading.totalMarks     | 10                 |
      | quiz-grading.percentage     | <percentage>       |
      | quiz-grading.result         | PASS or FAIL       |
      | quiz-grading.passThreshold  | 60                 |
      | quiz-grading.breakdown      | <per-question>     |

  Scenario: Grade calculation with decimal marks
    Given quiz grading is configured with:
      | field-1 | correct-answer | 2.5 marks |
      | field-2 | correct-answer | 1.5 marks |
    When a user submits 1 correct answer (2.5 marks)
    Then the score should be 2.5/4.0 (62.5%)

  Scenario: Mixed field types (only select/radio graded)
    Given the form has:
      | field-1 | SelectField | graded     |
      | field-2 | TextInputField | not graded |
      | field-3 | EmailField  | not graded |
      | field-4 | RadioField  | graded     |
    And quiz grading is configured for field-1 and field-4 only
    When a user submits the form
    Then only field-1 and field-4 should be graded
    And text/email fields should be ignored
```

#### 3.4 Plugin Execution Flow (`features/plugins/plugin-executor.feature`)

**Key Scenarios**:
- Multiple plugins execute in sequence (webhook → email → quiz)
- Plugin execution error doesn't block others
- Plugin timeout handling (30s default)
- Plugin execution logs captured
- Disabled plugin skipped
- Plugin priority/ordering
- Plugin execution metadata aggregation in response
- Plugin execution with database transaction
- Concurrent plugin execution (where safe)

### Phase 4: Real-time Collaboration Tests (2-3 days)

#### 4.1 YJS Document Synchronization (`features/collaboration/collaboration.feature`)

```gherkin
@Collaboration @YJS @Integration
Feature: Real-time Form Collaboration
  As a form editor
  I want to collaborate with others in real-time
  So that we can build forms together

  Background:
    Given I am authenticated as "user1@test.com"
    And another user "user2@test.com" exists in my organization
    And I have a form with ID "form-123"
    And the form has a collaborative document

  @Critical
  Scenario: Two users connect to same document
    Given I connect to the collaborative document for "form-123"
    When "user2@test.com" connects to the same document
    Then both users should see 2 connected users
    And the document awareness should show both users

  Scenario: Concurrent field addition
    Given both "user1@test.com" and "user2@test.com" are connected
    When "user1@test.com" adds a "TextInputField" to page 1
    And "user2@test.com" adds a "EmailField" to page 1 simultaneously
    Then both fields should be added
    And both users should see 2 new fields
    And there should be no conflicts

  Scenario: Concurrent field edits (different fields)
    Given both users are connected
    And the form has fields "field-1" and "field-2"
    When "user1@test.com" edits "field-1" label to "New Label 1"
    And "user2@test.com" edits "field-2" label to "New Label 2" simultaneously
    Then both edits should succeed
    And both users should see both changes
    And the document state should be consistent

  Scenario: Field deletion synchronization
    Given both users are connected
    And the form has 5 fields
    When "user1@test.com" deletes field "field-3"
    Then "user2@test.com" should see the deletion within 1 second
    And both users should see 4 fields

  Scenario: Page reordering synchronization
    Given both users are connected
    And the form has 3 pages
    When "user1@test.com" moves page 3 to position 1
    Then "user2@test.com" should see the new order
    And the page order should be [3, 1, 2]

  Scenario: Layout changes propagation
    Given both users are connected
    When "user1@test.com" changes form layout to "dark" theme
    Then "user2@test.com" should see the theme change
    And both users should see dark theme

  Scenario: Disconnect and reconnect behavior
    Given "user1@test.com" is connected
    When "user1@test.com" disconnects (network loss)
    And "user2@test.com" makes 5 edits
    And "user1@test.com" reconnects after 30 seconds
    Then "user1@test.com" should receive all 5 edits
    And the document state should be synchronized

  Scenario: Document persistence to MongoDB
    Given "user1@test.com" is connected
    When "user1@test.com" adds 3 fields
    And "user1@test.com" disconnects
    And "user2@test.com" connects 5 minutes later
    Then "user2@test.com" should see all 3 fields
    And the collaborative document should be persisted in MongoDB
```

#### 4.2 Hocuspocus Server (`features/collaboration/collaboration-server.feature`)

**Key Scenarios**:
- WebSocket connection establishment with authentication
- Bearer token validation on connection
- Unauthorized connection rejected (invalid token)
- Document awareness (list of connected users)
- Document state restoration on reconnect
- Memory cleanup on disconnect
- Concurrent edit conflict resolution (CRDT)
- Connection timeout after inactivity
- Maximum connections per document limit
- WebSocket message rate limiting

### Phase 5: Security & Authorization Tests (3-4 days)

#### 5.1 Permission Enforcement (`features/security/permission-enforcement.feature`)

```gherkin
@Security @Permissions @Critical
Feature: Permission Enforcement
  As a system administrator
  I want strict permission enforcement
  So that users can only perform authorized actions

  Background:
    Given user "owner@test.com" is the form owner
    And user "editor@test.com" has EDITOR permission
    And user "viewer@test.com" has VIEWER permission
    And the form ID is "form-123"

  Scenario: VIEWER cannot edit form
    Given I am authenticated as "viewer@test.com"
    When I attempt to update form "form-123" title
    Then the request should fail with "Permission denied"
    And the error should specify "EDITOR access required"

  Scenario: VIEWER cannot delete form
    Given I am authenticated as "viewer@test.com"
    When I attempt to delete form "form-123"
    Then the request should fail with "Permission denied"
    And the error should specify "OWNER access required"

  Scenario: VIEWER cannot configure plugins
    Given I am authenticated as "viewer@test.com"
    When I attempt to add a webhook plugin to form "form-123"
    Then the request should fail with "Permission denied"

  Scenario: EDITOR can edit but not delete
    Given I am authenticated as "editor@test.com"
    When I update form "form-123" title to "New Title"
    Then the update should succeed
    When I attempt to delete form "form-123"
    Then the delete should fail with "Permission denied"

  Scenario: OWNER can perform all actions
    Given I am authenticated as "owner@test.com"
    When I update form "form-123"
    And I configure plugins for form "form-123"
    And I delete form "form-123"
    Then all actions should succeed

  Scenario: Permission checks on all mutations
    Given a comprehensive list of GraphQL mutations:
      | createForm        | requires: OWNER of organization |
      | updateForm        | requires: EDITOR or OWNER       |
      | deleteForm        | requires: OWNER                 |
      | publishForm       | requires: EDITOR or OWNER       |
      | shareForm         | requires: OWNER                 |
      | configurePlugin   | requires: OWNER                 |
    When I test each mutation with insufficient permissions
    Then all should fail with appropriate error messages

  Scenario: Bypass attempt with direct GraphQL call
    Given I am authenticated as "viewer@test.com"
    When I send a raw GraphQL mutation to delete the form
    And I bypass the UI permission checks
    Then the GraphQL resolver should still deny the request
    And the error should be "Permission denied"
```

#### 5.2 Organization Boundaries (`features/security/organization-security.feature` - extend existing)

**Additional Scenarios**:
- User cannot access forms from other organizations
- User cannot view responses from other organizations
- User cannot share forms with users outside organization
- Admin can access cross-organization data
- Organization member list access control
- Invitation acceptance workflow with role assignment
- Member role changes (member → owner, owner → member)
- Remove member from organization (orphan check for forms)

#### 5.3 Authentication Edge Cases (`features/security/auth-edge-cases.feature`)

**Key Scenarios**:
- Expired token rejected with 401
- Malformed token rejected
- Token from different environment/secret
- Concurrent sessions from multiple devices
- Session invalidation on password change
- Session invalidation on logout
- Rate limiting on auth endpoints (100 req/min)
- Brute force protection on login (5 attempts → lockout)
- Token refresh workflow
- Token revocation

#### 5.4 Data Leakage Prevention (`features/security/data-security.feature`)

```gherkin
@Security @DataLeakage @Critical
Feature: Data Leakage Prevention
  As a security engineer
  I want to prevent data leakage
  So that user data remains private

  Scenario: Form IDs are UUIDs (not sequential)
    When I create 10 forms
    Then all form IDs should be UUIDs
    And form IDs should not be sequential
    And form IDs should not be predictable

  Scenario: Short URLs don't expose form IDs
    Given I have a form with ID "550e8400-e29b-41d4-a716-446655440000"
    When I publish the form
    Then the short URL should not contain the form ID
    And the short URL should be random (e.g., "abc123xyz")
    And the short URL length should be 8-12 characters

  Scenario: Response data not in public endpoints
    Given I have a form with 100 responses
    When an unauthenticated user accesses the form
    Then they should see the form structure only
    And they should NOT see existing responses
    And they should NOT see response count

  Scenario: Analytics requires authentication
    Given I have a form with analytics data
    When an unauthenticated user queries form analytics
    Then the request should fail with "Authentication required"

  Scenario: File upload URLs are signed
    Given I upload a file to a form
    When I receive the file URL
    Then the URL should contain a signature/token
    And the URL should expire after 1 hour
    And accessing the URL without valid signature should fail

  Scenario: Error messages don't leak sensitive data
    Given I am not authenticated
    When I query a form that doesn't exist
    Then the error should be "Form not found"
    And the error should NOT reveal if the form ID format is valid
    When I query a form I don't have access to
    Then the error should be "Form not found" (not "Permission denied")
```

### Phase 6: Edge Cases & Performance (2-3 days)

#### 6.1 Large Data Scenarios (`features/performance/performance.feature`)

```gherkin
@Performance @LargeData
Feature: Performance with Large Datasets
  As a system administrator
  I want the system to handle large datasets
  So that it scales for enterprise users

  @Slow
  Scenario: Form with 50+ fields
    Given I create a form with 50 fields across 5 pages
    When I load the form in the builder
    Then the form should load within 2 seconds
    And all 50 fields should be editable
    And real-time collaboration should still work

  @Slow
  Scenario: Form with 10+ pages
    Given I create a form with 10 pages and 100 total fields
    When I navigate between pages
    Then each page navigation should take < 500ms
    And the form schema should be under 1MB

  @Slow
  Scenario: 1000+ response submissions
    Given I have a published form
    When I submit 1000 responses via the API
    Then all submissions should succeed
    And the submission rate should be > 50/second
    And database performance should remain stable

  @Slow
  Scenario: Pagination with 10,000 responses
    Given a form has 10,000 responses
    When I query responses with pagination (limit=100)
    Then the first page should load within 1 second
    And subsequent pages should load within 1 second
    And the total count should be accurate

  @Slow
  Scenario: Analytics aggregation with large dataset
    Given a form has 50,000 view analytics records
    When I query form analytics for "last 30 days"
    Then the aggregation should complete within 3 seconds
    And the results should be accurate

  @Slow
  Scenario: Bulk delete 100 forms
    Given I have 100 forms in my organization
    When I delete all 100 forms
    Then the bulk delete should complete within 10 seconds
    And all forms and responses should be deleted
```

#### 6.2 Concurrent Operations (`features/performance/concurrency.feature`)

**Key Scenarios**:
- 10 simultaneous form submissions (different users)
- 5 concurrent plugin executions on same form
- Race condition: 2 users delete same form
- Race condition: 2 users share form with same user
- Duplicate submission prevention (same user, same form, within 1 second)
- Database transaction isolation (concurrent updates)
- Optimistic locking on form updates

#### 6.3 Error Scenarios (`features/performance/error-scenarios.feature`)

**Key Scenarios**:
- Invalid GraphQL query syntax
- Missing required mutation fields
- Type validation errors (string → number)
- Database connection failure (simulate)
- External service failure (webhook timeout)
- Email service failure (SMTP error)
- File upload failure (S3 error)
- Graceful degradation (analytics failure doesn't block submission)
- Partial plugin failure (webhook fails, email succeeds)

## Test File Organization

```
test/integration/
├── features/
│   ├── graphql-resolvers/
│   │   ├── form-operations.feature
│   │   ├── form-sharing.feature
│   │   ├── response-operations.feature
│   │   ├── analytics.feature
│   │   ├── admin-operations.feature
│   │   └── template-operations.feature
│   ├── plugins/
│   │   ├── webhook-plugin.feature
│   │   ├── email-plugin.feature
│   │   ├── quiz-grading-plugin.feature
│   │   └── plugin-executor.feature
│   ├── collaboration/
│   │   ├── collaboration.feature
│   │   └── collaboration-server.feature
│   ├── security/
│   │   ├── permission-enforcement.feature
│   │   ├── organization-security.feature (extend existing)
│   │   ├── auth-edge-cases.feature
│   │   └── data-security.feature
│   └── performance/
│       ├── performance.feature
│       ├── concurrency.feature
│       └── error-scenarios.feature
├── step-definitions/
│   ├── form-operations.steps.ts
│   ├── form-sharing.steps.ts
│   ├── response-operations.steps.ts
│   ├── analytics.steps.ts
│   ├── admin-operations.steps.ts
│   ├── template-operations.steps.ts
│   ├── webhook-plugin.steps.ts
│   ├── email-plugin.steps.ts
│   ├── quiz-grading-plugin.steps.ts
│   ├── plugin-executor.steps.ts
│   ├── collaboration.steps.ts
│   ├── collaboration-server.steps.ts
│   ├── permission-enforcement.steps.ts
│   ├── auth-edge-cases.steps.ts
│   ├── data-security.steps.ts
│   ├── performance.steps.ts
│   ├── concurrency.steps.ts
│   └── error-scenarios.steps.ts
├── support/
│   ├── world.ts (extend with new utilities)
│   ├── hooks.ts (add MongoDB Memory Server setup)
│   └── types.ts (extend with new interfaces)
└── utils/
    ├── db-utils.ts (NEW)
    ├── plugin-test-utils.ts (NEW)
    ├── analytics-test-utils.ts (NEW)
    ├── collaboration-test-utils.ts (NEW)
    ├── mock-servers.ts (NEW)
    ├── auth-utils.ts (existing)
    ├── form-test-utils.ts (existing)
    ├── test-data.ts (existing)
    └── constants.ts (existing)
```

## CI/CD Integration

### GitHub Actions Workflow

```yaml
name: Integration Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  smoke-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
      - run: pnpm install
      - run: pnpm build
      - run: pnpm backend:dev &
      - run: sleep 10 # wait for server
      - run: pnpm test:integration --tags "@Smoke"

  critical-tests:
    runs-on: ubuntu-latest
    needs: smoke-tests
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
      - run: pnpm install
      - run: pnpm build
      - run: pnpm backend:dev &
      - run: sleep 10
      - run: pnpm test:integration --tags "@Critical"

  full-suite:
    runs-on: ubuntu-latest
    needs: critical-tests
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
      - run: pnpm install
      - run: pnpm build
      - run: pnpm backend:dev &
      - run: sleep 10
      - run: pnpm test:integration:coverage
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/integration/coverage-final.json
```

### Test Execution Scripts

**Run by tags**:
```bash
# Smoke tests only (fast)
pnpm test:integration --tags "@Smoke"

# Critical path tests
pnpm test:integration --tags "@Critical"

# GraphQL resolver tests
pnpm test:integration --tags "@GraphQL"

# Plugin tests
pnpm test:integration --tags "@Plugins"

# Security tests
pnpm test:integration --tags "@Security"

# Performance tests (slow)
pnpm test:integration --tags "@Performance"

# Exclude slow tests
pnpm test:integration --tags "not @Slow"
```

**Run by feature**:
```bash
# Specific feature file
pnpm test:integration features/plugins/webhook-plugin.feature

# All plugin features
pnpm test:integration features/plugins/

# All security features
pnpm test:integration features/security/
```

## Coverage Targets

### Overall Targets
- **GraphQL Resolvers**: 90%+ line coverage
- **Plugin Handlers**: 85%+ line coverage
- **Services**: 80%+ line coverage (combination of unit + integration)
- **Repositories**: 75%+ line coverage (primarily unit tests)
- **Overall Backend**: 80%+ line coverage

### Coverage Reporting
- Generate HTML coverage reports: `pnpm test:integration:coverage`
- Upload to Codecov on CI
- Fail PR if coverage drops below threshold
- Track coverage trends over time

### Coverage Exclusions
- Type definitions (`*.types.ts`)
- Test utilities (`*.test-utils.ts`)
- Mock data generators
- Development scripts (`scripts/`)
- Auto-generated Prisma client

## Development Workflow

### Adding New Integration Tests

1. **Create feature file**:
   ```bash
   touch test/integration/features/graphql-resolvers/my-feature.feature
   ```

2. **Write scenarios in Gherkin**:
   ```gherkin
   @GraphQL @MyFeature
   Feature: My Feature
     Scenario: Test case 1
       Given precondition
       When action
       Then assertion
   ```

3. **Create step definitions**:
   ```bash
   touch test/integration/step-definitions/my-feature.steps.ts
   ```

4. **Implement steps**:
   ```typescript
   import { Given, When, Then } from '@cucumber/cucumber';
   import { CustomWorld } from '../support/world';

   Given('precondition', async function(this: CustomWorld) {
     // implementation
   });
   ```

5. **Run tests**:
   ```bash
   pnpm test:integration features/graphql-resolvers/my-feature.feature
   ```

### Debugging Tests

**Verbose output**:
```bash
DEBUG=* pnpm test:integration features/my-feature.feature
```

**Run single scenario**:
```gherkin
@only
Scenario: Debug this scenario
```
```bash
pnpm test:integration --tags "@only"
```

**Inspect step execution**:
```typescript
// Add logging in step definitions
console.log('Current state:', this.getSharedTestData());
```

**Database inspection**:
```typescript
// In step definition
const forms = await this.prisma.form.findMany();
console.log('All forms:', forms);
```

## Estimated Timeline

| Phase | Duration | Deliverables |
|-------|----------|-------------|
| **Phase 1**: Infrastructure | 2-3 days | MongoDB Memory Server integration, enhanced test utilities, mock servers |
| **Phase 2**: GraphQL Resolvers | 4-5 days | 6 feature files, ~50 scenarios, step definitions |
| **Phase 3**: Plugin System | 3-4 days | 4 feature files, ~30 scenarios, mock webhook/email servers |
| **Phase 4**: Collaboration | 2-3 days | 2 feature files, ~20 scenarios, YJS test utilities |
| **Phase 5**: Security | 3-4 days | 4 feature files, ~40 scenarios, permission test utilities |
| **Phase 6**: Edge Cases | 2-3 days | 3 feature files, ~25 scenarios, performance benchmarks |
| **Documentation & Review** | 1-2 days | Update README, add examples, code review |

**Total**: 17-24 days (3.5-5 weeks)

## Success Criteria

✅ **Coverage**: 80%+ code coverage across backend
✅ **Scenarios**: 150+ integration test scenarios implemented
✅ **Critical Paths**: All user journeys covered with `@Critical` tag
✅ **Plugin System**: Full webhook, email, quiz grading test coverage
✅ **Collaboration**: Real-time YJS synchronization validated
✅ **Security**: Permission boundaries enforced and tested
✅ **CI/CD**: Automated test execution on every commit
✅ **Documentation**: Comprehensive guide for adding new tests
✅ **Performance**: Test suite completes in < 30 minutes

## Maintenance

### Regular Tasks
- **Weekly**: Review flaky tests and fix root causes
- **Monthly**: Update test data to reflect schema changes
- **Quarterly**: Review coverage reports and add tests for gaps
- **Per Release**: Update test scenarios for new features

### Test Health Monitoring
- Track test execution time trends
- Monitor flaky test rate (< 1% acceptable)
- Review coverage changes on every PR
- Maintain test documentation

## References

- [Cucumber.js Documentation](https://cucumber.io/docs/cucumber/)
- [Vitest Documentation](https://vitest.dev/)
- [Prisma Testing Guide](https://www.prisma.io/docs/guides/testing)
- [MongoDB Memory Server](https://github.com/nodkz/mongodb-memory-server)
- [GraphQL Testing Best Practices](https://www.apollographql.com/docs/apollo-server/testing/testing/)

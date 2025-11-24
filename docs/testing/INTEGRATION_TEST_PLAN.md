# Backend Integration Test Suite Implementation Plan

## Overview
This document outlines a comprehensive Cucumber BDD integration test suite targeting 80%+ coverage across GraphQL resolvers, plugin system, real-time collaboration, and security/authorization for the dculus-forms backend.

## Current State Analysis

### Existing Test Infrastructure
- **Unit Tests**: Vitest 4.0.7 with 73 existing test files
- **Integration Tests**: Cucumber.js 12.2.0 with Gherkin features
- **E2E Tests**: Suite removed (previously Playwright 1.52.0 for browser automation)
- **Test Database**: MongoDB Memory Replica Set (in-memory) for isolated testing
- **Coverage Tool**: @vitest/coverage-v8 targeting 80%+ thresholds
- **Mock Services**: Mock SMTP Server for email testing

### Current Integration Test Coverage
Implemented feature files in `test/integration/features/`:
- ✅ `basic-flow.feature` - Complete user journey (signup → organization → form creation)
- ✅ `account-creation.feature` - Comprehensive account creation scenarios (6 scenarios)
  - Successful signup with valid credentials
  - Invalid email format validation
  - Weak password validation
  - Duplicate email detection
  - Missing required fields validation
  - Special characters in name handling

### Test Infrastructure (Fully Operational)
**MongoDB Memory Replica Set** (`test/integration/support/hooks.ts`):
- ✅ Automatic startup in `BeforeAll` hook (90s timeout)
- ✅ Prisma schema push to in-memory database
- ✅ Automatic cleanup in `AfterAll` hook
- ✅ Supports Prisma transactions (replica set requirement)
- ✅ Fast, isolated test execution (no external database needed)

**Mock SMTP Server** (`test/integration/utils/mock-servers.ts`):
- ✅ Runs on port 1025 during tests
- ✅ Captures all sent emails for verification
- ✅ Automatic startup/cleanup

**Test Utilities** (Available):
- ✅ `auth-utils.ts` - Authentication helpers (signup, signin, token management)
- ✅ `expect-helper.ts` - Custom assertion utilities
- ✅ `db-utils.ts` - Database seeding and cleanup utilities
- ✅ `mock-servers.ts` - Mock SMTP server implementation
- ✅ `form-test-utils.ts` - Form creation and management helpers
- ✅ `analytics-test-utils.ts` - Analytics tracking helpers
- ✅ `collaboration-test-utils.ts` - YJS collaboration helpers
- ✅ `plugin-test-utils.ts` - Plugin configuration helpers

**CustomWorld Extensions** (`test/integration/support/world.ts`):
- ✅ Prisma client instance (connected to in-memory DB)
- ✅ AuthUtils for authentication operations
- ✅ FormTestUtils for form operations
- ✅ Database cleanup utilities
- ✅ Shared test data storage across steps
- ✅ Automatic cleanup after each scenario

### Gaps to Address
The following critical areas need integration test coverage:
1. **Form Operations** (create, update, delete, duplicate, share)
2. **Form Responses** (submit, edit, delete, export, pagination)
3. **GraphQL Resolvers** (forms.ts, responses.ts, plugins.ts, admin.ts, analytics.ts)
4. **Plugin System** (webhook, email, quiz auto-grading, plugin executor)
5. **Real-time Collaboration** (YJS/Hocuspocus integration)
6. **Advanced Analytics** (form view/submission analytics, field-level analytics)
7. **Security Edge Cases** (permission boundaries, data leakage prevention)
8. **Performance & Concurrency** (large datasets, concurrent operations)

## Test Strategy

### Testing Approach
- **Framework**: Cucumber BDD (Gherkin syntax) for human-readable scenarios
- **Database**: MongoDB Memory Replica Set (in-memory) for fast, isolated test execution
- **Mock Services**: Mock SMTP Server for email testing (port 1025)
- **Backend**: Local backend server spawned automatically in BeforeAll hook
- **Coverage Target**: 80%+ across all backend code
- **Execution**: Sequential (parallel: 1) to avoid port conflicts
- **Cleanup**: Automatic database reset between scenarios

### Simplified Implementation Strategy

**Key Principles**:
1. **Iterative Development**: Implement one feature area at a time, validate, then move on
2. **Just-in-Time Utilities**: Create helper functions only when needed for tests
3. **Direct Database Access**: Use Prisma client directly in steps for verification
4. **Minimal Abstraction**: Keep step definitions readable and straightforward
5. **Real Backend Testing**: Test against actual backend server, not mocks

**Process for Each Feature**:
1. **Plan**: Review feature area, identify key test scenarios
2. **Write**: Create `.feature` file with Gherkin scenarios
3. **Implement**: Write step definitions using existing utilities
4. **Extend**: Add new utility functions if needed
5. **Test**: Run tests, fix issues, ensure all scenarios pass
6. **Document**: Update this plan with completion status
7. **Commit**: Commit working tests before moving to next feature

**Benefits of This Approach**:
- ✅ Faster implementation (no upfront utility building)
- ✅ Focused testing (one feature at a time)
- ✅ Real-world validation (actual backend, database, APIs)
- ✅ Easy debugging (fewer abstractions)
- ✅ Maintainable tests (clear, direct step definitions)

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

### Phase 1: Test Infrastructure ✅ COMPLETED

#### 1.1 MongoDB Memory Replica Set Integration ✅
**Status**: Fully implemented and operational

**Implementation**:
- ✅ `BeforeAll` hook starts MongoDB Memory Replica Set (90s timeout)
- ✅ Automatic Prisma schema push to in-memory database
- ✅ `AfterAll` hook stops memory server and disconnects Prisma
- ✅ `After` hook runs cleanup after each scenario
- ✅ Support for both local and remote backend testing

**Key Files**:
- `test/integration/support/hooks.ts:36-153` - BeforeAll/AfterAll hooks
- `test/integration/support/hooks.ts:156-160` - After cleanup hook
- `test/integration/support/hooks.ts:201-214` - getPrismaClient(), getMockSMTPServer()

#### 1.2 CustomWorld with Database Access ✅
**Status**: Fully implemented

**Implementation**:
- ✅ Prisma client instance in CustomWorld (`this.prisma`)
- ✅ Database cleanup method (`this.clearDatabase()`)
- ✅ Shared test data storage (`this.setSharedTestData()`, `this.getSharedTestData()`)
- ✅ Authentication context management
- ✅ Test user/organization tracking
- ✅ Automatic cleanup of created resources

**Key Files**:
- `test/integration/support/world.ts:9-29` - CustomWorld interface
- `test/integration/support/world.ts:199-231` - clearDatabase() implementation
- `test/integration/support/world.ts:236-294` - cleanup() implementation

#### 1.3 Test Utilities ✅
**Status**: Fully implemented and operational

**Available Utilities**:
- ✅ `auth-utils.ts` - AuthUtils class for signup, signin, admin user creation
- ✅ `expect-helper.ts` - Custom assertion helpers (expect, expectDefined, expectEqual, expectNoGraphQLErrors)
- ✅ `db-utils.ts` - Database utilities (planned, to be added as needed)
- ✅ `mock-servers.ts` - MockSMTPServer class for email testing
- ✅ `plugin-test-utils.ts` - Plugin helpers (planned, to be added as needed)
- ✅ `analytics-test-utils.ts` - Analytics helpers (planned, to be added as needed)
- ✅ `collaboration-test-utils.ts` - YJS helpers (planned, to be added as needed)

**Mock SMTP Server** (`mock-servers.ts:195-214`):
- ✅ Implemented and tested
- ✅ Runs on port 1025 during tests
- ✅ Captures all sent emails
- ✅ Automatic startup in BeforeAll, cleanup in AfterAll

**Approach**: We create utility classes and helper functions **as needed** when writing test scenarios, rather than pre-building everything upfront. This keeps the codebase lean and focused on actual test requirements.

#### 1.4 Current Test Implementation Status ✅

**Completed Tests**:
1. ✅ `basic-flow.feature` (1 scenario, 10 steps) - Complete user journey
   - User signup → Organization creation → Form creation
   - Tests database operations via Prisma
   - Validates organization ownership and form association

2. ✅ `account-creation.feature` (6 scenarios, 42 steps) - Account creation
   - ✅ Successful account creation with valid credentials
   - ✅ Invalid email format validation (400 error)
   - ✅ Weak password validation (400 error)
   - ✅ Duplicate email detection (422 error)
   - ✅ Missing required fields validation (400 error)
   - ✅ Special characters in name handling

**Test Execution Results**:
```
7 scenarios (7 passed)
42 steps (42 passed)
0m19.471s (executing steps: 0m01.143s)
```

**CI/CD Integration**:
- ✅ GitHub Actions workflow updated (`.github/workflows/build.yml:208-260`)
- ✅ Integration tests run automatically after `build-shared-packages` job
- ✅ Tests run on every push and pull request
- ✅ Test summary added to GitHub Actions output

### Phase 2: Core Feature Test Coverage (Iterative, Feature-by-Feature)

**Approach**: Implement tests iteratively, one feature area at a time. For each feature:
1. Create `.feature` file with Gherkin scenarios
2. Implement step definitions
3. Add utility functions as needed
4. Run tests and verify
5. Commit and move to next feature

**Priority Order** (based on business impact):
1. ✅ Account Creation (COMPLETED)
2. 🔄 Form Submission & Response Flow (NEXT)
3. ⏳ Form Sharing & Permissions
4. ⏳ Plugin System (webhook, email, quiz)
5. ⏳ Analytics
6. ⏳ Admin Operations
7. ⏳ Templates
8. ⏳ Real-time Collaboration

#### 2.1 Form Operations (`features/form-operations.feature`) ⏳ PLANNED

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

### Current Structure (Simplified, Flat Hierarchy)

```
test/integration/
├── features/
│   ├── basic-flow.feature ✅ (Complete user journey)
│   ├── account-creation.feature ✅ (6 account creation scenarios)
│   ├── form-submission.feature ⏳ (Planned next)
│   ├── form-sharing.feature ⏳
│   ├── webhook-plugin.feature ⏳
│   ├── email-plugin.feature ⏳
│   ├── quiz-grading-plugin.feature ⏳
│   ├── analytics.feature ⏳
│   ├── admin-operations.feature ⏳
│   ├── templates.feature ⏳
│   └── collaboration.feature ⏳
│
├── step-definitions/
│   ├── basic-flow.steps.ts ✅
│   ├── account-creation.steps.ts ✅
│   └── (add more as features are implemented)
│
├── support/
│   ├── world.ts ✅ (CustomWorld with Prisma, auth, cleanup)
│   ├── hooks.ts ✅ (MongoDB Memory Replica Set, SMTP, backend startup)
│   └── types.ts ✅
│
├── utils/
│   ├── auth-utils.ts ✅ (AuthUtils class for signup/signin/admin)
│   ├── expect-helper.ts ✅ (expect, expectDefined, expectEqual, etc.)
│   ├── mock-servers.ts ✅ (MockSMTPServer)
│   ├── db-utils.ts ⏳ (add as needed)
│   ├── plugin-test-utils.ts ⏳ (add as needed)
│   ├── analytics-test-utils.ts ⏳ (add as needed)
│   ├── collaboration-test-utils.ts ⏳ (add as needed)
│   └── form-test-utils.ts ✅
│
└── cucumber.js ✅ (Cucumber configuration)
```

### Organizational Principles

1. **Flat Feature Structure**: No deep nesting (e.g., `features/graphql-resolvers/...`). Keep all `.feature` files in `features/` root for easy navigation.

2. **One Feature → One Step File**: Each `.feature` file has a corresponding `.steps.ts` file with the same name for easy lookup.

3. **Shared Utilities**: Common helpers in `utils/` directory, created as needed during test implementation.

4. **Common Steps**: Reusable steps (like "Given the database is clean") can be in any `.steps.ts` file - Cucumber finds them automatically.

5. **No Premature Abstraction**: Don't create utility files until you actually need them in tests.

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

## Implementation Progress & Timeline

### Completed (Phase 1)
| Feature | Scenarios | Steps | Duration | Status |
|---------|-----------|-------|----------|--------|
| **Infrastructure Setup** | - | - | 3 days | ✅ DONE |
| - MongoDB Memory Replica Set | - | - | - | ✅ |
| - Mock SMTP Server | - | - | - | ✅ |
| - CustomWorld & Utilities | - | - | - | ✅ |
| - CI/CD Integration | - | - | - | ✅ |
| **Basic Flow** | 1 | 10 | 1 day | ✅ DONE |
| **Account Creation** | 6 | 42 | 1 day | ✅ DONE |
| **Subtotal** | **7** | **52** | **5 days** | ✅ |

### Planned (Phase 2+)
| Feature Area | Est. Scenarios | Est. Duration | Priority |
|--------------|----------------|---------------|----------|
| Form Submission & Responses | 8-10 | 2 days | 🔥 HIGH |
| Form Sharing & Permissions | 6-8 | 1-2 days | 🔥 HIGH |
| Webhook Plugin | 5-6 | 1 day | 🔥 HIGH |
| Email Plugin | 5-6 | 1 day | 🔥 HIGH |
| Quiz Grading Plugin | 6-8 | 1-2 days | 🔥 HIGH |
| Analytics | 8-10 | 2 days | 🟡 MEDIUM |
| Admin Operations | 5-6 | 1 day | 🟡 MEDIUM |
| Templates | 4-5 | 1 day | 🟡 MEDIUM |
| Real-time Collaboration | 6-8 | 2 days | 🟢 LOW |
| **Total Remaining** | **53-67** | **12-15 days** | - |

### Overall Estimated Timeline
- ✅ **Completed**: 7 scenarios, 52 steps (5 days)
- ⏳ **Remaining**: 53-67 scenarios (12-15 days)
- 📊 **Total**: 60-74 scenarios (17-20 days / 3.5-4 weeks)

**Note**: This is a revised, more realistic timeline based on our simplified iterative approach. Original estimate was 150+ scenarios over 17-24 days.

## Success Criteria

### Phase 1 (Infrastructure) ✅ COMPLETED
- ✅ **MongoDB Memory Replica Set**: In-memory database with transaction support
- ✅ **Mock Services**: Mock SMTP server operational
- ✅ **Backend Automation**: Automatic backend startup/shutdown in tests
- ✅ **Test Utilities**: Auth, expect helpers, CustomWorld with Prisma access
- ✅ **CI/CD**: Integration tests run automatically on GitHub Actions
- ✅ **Initial Tests**: 7 scenarios, 52 steps, all passing
- ✅ **Execution Time**: < 20 seconds for test suite

### Phase 2+ (Feature Coverage) 🔄 IN PROGRESS
- 🔄 **Account Creation**: ✅ 6 scenarios (DONE)
- ⏳ **Form Submission**: 8-10 scenarios (NEXT)
- ⏳ **Form Sharing**: 6-8 scenarios
- ⏳ **Plugin System**: 16-20 scenarios (webhook, email, quiz)
- ⏳ **Analytics**: 8-10 scenarios
- ⏳ **Admin Operations**: 5-6 scenarios
- ⏳ **Templates**: 4-5 scenarios
- ⏳ **Collaboration**: 6-8 scenarios

### Final Success Criteria (Target)
- 📊 **Total Scenarios**: 60-74 integration test scenarios
- 📈 **Coverage**: 80%+ code coverage across backend (via combined unit + integration)
- 🔥 **Critical Paths**: All high-priority user journeys tested
- 🔒 **Security**: Permission boundaries validated
- ⚡ **Performance**: Full test suite completes in < 5 minutes
- 📚 **Documentation**: Updated guide for adding new tests
- ✅ **CI/CD**: All tests passing on every commit

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

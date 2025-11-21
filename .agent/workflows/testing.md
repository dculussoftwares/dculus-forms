---
description: Testing strategies and commands
---

# Testing Workflow

This workflow covers all testing strategies used in Dculus Forms.

## Test Types

### 1. Unit Tests (Vitest)
- **Location**: `apps/backend/src/**/*.test.ts`
- **Purpose**: Test individual functions and services
- **Framework**: Vitest

### 2. Integration Tests (Cucumber)
- **Location**: `test/integration/features/*.feature`
- **Purpose**: Test API endpoints and GraphQL resolvers
- **Framework**: Cucumber + supertest

### 3. E2E Tests (Playwright)
- **Location**: `test/e2e/features/*.feature`
- **Purpose**: Test full user flows across applications
- **Framework**: Playwright + Cucumber

## Running Tests

### Unit Tests

```bash
# Run all unit tests
pnpm test:unit

# Run in watch mode (auto-rerun on changes)
pnpm test:unit:watch

# Run with UI (interactive test runner)
pnpm test:unit:ui

# Run with coverage report
pnpm test:unit:coverage
```

### Integration Tests

```bash
# Run all integration tests
pnpm test:integration

# Run specific feature
pnpm test:integration:auth
pnpm test:integration:health

# Run by tags
pnpm test:integration:by-tags "@auth"
pnpm test:integration:by-tags "@forms and @create"

# Dry run (see which scenarios will run)
pnpm test:integration:dry-run

# Run with coverage
pnpm test:integration:coverage
```

### E2E Tests

```bash
# Run all E2E tests (headless)
pnpm test:e2e

# Run in headed mode (see browser)
pnpm test:e2e:headed

# Run specific feature
pnpm test:e2e:form-creation
pnpm test:e2e:form-creation:headed

# Run in development mode
pnpm test:e2e:dev
```

### Production Tests

```bash
# Test against production backend
pnpm test:integration:production
pnpm test:integration:auth:production
pnpm test:integration:health:production
```

## Writing Tests

### Unit Test Example

```typescript
// apps/backend/src/services/FormService.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { FormService } from './FormService';

describe('FormService', () => {
  let formService: FormService;

  beforeEach(() => {
    formService = new FormService();
  });

  describe('createForm', () => {
    it('should create a form with valid input', async () => {
      // Arrange
      const input = {
        title: 'Test Form',
        description: 'Test Description',
      };
      const userId = 'user-123';

      // Act
      const result = await formService.createForm(input, userId);

      // Assert
      expect(result).toBeDefined();
      expect(result.title).toBe('Test Form');
      expect(result.createdBy).toBe(userId);
    });

    it('should throw error when title is empty', async () => {
      // Arrange
      const input = { title: '', description: 'Test' };
      const userId = 'user-123';

      // Act & Assert
      await expect(
        formService.createForm(input, userId)
      ).rejects.toThrow('Form title is required');
    });
  });
});
```

### Integration Test Example

```gherkin
# test/integration/features/forms.feature
Feature: Form Management
  As a user
  I want to manage forms
  So that I can collect responses

  Background:
    Given I am authenticated as "user@example.com"

  @forms @create
  Scenario: Create a new form
    When I create a form with the following data:
      | title       | My Test Form           |
      | description | This is a test form    |
    Then the response status should be 200
    And the form should be created successfully
    And the form should have title "My Test Form"

  @forms @list
  Scenario: List all forms
    Given I have created 3 forms
    When I request the list of forms
    Then the response status should be 200
    And I should receive 3 forms

  @forms @update
  Scenario: Update a form
    Given I have created a form with title "Original Title"
    When I update the form title to "Updated Title"
    Then the response status should be 200
    And the form should have title "Updated Title"
```

### E2E Test Example

```gherkin
# test/e2e/features/form-creation.feature
Feature: Form Creation Flow
  As a user
  I want to create forms through the UI
  So that I can collect responses

  @PageInteraction
  Scenario: Create a form with text field
    Given I am on the login page
    When I log in with email "user@example.com" and password "password123"
    Then I should see the dashboard

    When I click the "Create Form" button
    And I enter "Customer Feedback" in the form title field
    And I add a text field with label "Name"
    And I add a text field with label "Email"
    And I click the "Save" button
    Then I should see "Form saved successfully"
    And the form should appear in my forms list
```

## Test Tags

### Integration Test Tags
- `@auth` - Authentication tests
- `@forms` - Form management tests
- `@responses` - Response management tests
- `@templates` - Template tests
- `@organizations` - Organization tests
- `@subscriptions` - Subscription tests
- `@health` - Health check tests

### E2E Test Tags
- `@PageInteraction` - UI interaction tests
- `@FormBuilder` - Form builder tests
- `@FormViewer` - Form viewer tests
- `@AdminPanel` - Admin panel tests

## Test Utilities

### Integration Test Utilities

```typescript
// test/integration/support/helpers.ts

// Create authenticated user
export async function createAuthenticatedUser(email: string) {
  const response = await request(app)
    .post('/api/auth/signup')
    .send({ email, password: 'password123' });
  
  return response.body.token;
}

// Create test form
export async function createTestForm(token: string, data: any) {
  const response = await request(app)
    .post('/graphql')
    .set('Authorization', `Bearer ${token}`)
    .send({
      query: CREATE_FORM_MUTATION,
      variables: { input: data },
    });
  
  return response.body.data.createForm;
}
```

### E2E Test Utilities

```typescript
// test/e2e/support/helpers.ts

// Login helper
export async function login(page: Page, email: string, password: string) {
  await page.goto('http://localhost:3000/login');
  await page.fill('[name="email"]', email);
  await page.fill('[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
}

// Create form helper
export async function createForm(page: Page, title: string) {
  await page.click('text=Create Form');
  await page.fill('[name="title"]', title);
  await page.click('text=Save');
  await page.waitForSelector('text=Form saved successfully');
}
```

## Coverage Reports

### Unit Test Coverage

```bash
# Generate coverage report
pnpm test:unit:coverage

# View coverage report
open coverage/index.html
```

Coverage thresholds (configured in `vitest.config.ts`):
- Statements: 80%
- Branches: 80%
- Functions: 80%
- Lines: 80%

### Integration Test Coverage

```bash
# Generate coverage report
pnpm test:integration:coverage

# View coverage report
open coverage/lcov-report/index.html
```

## Debugging Tests

### Unit Tests

```bash
# Run with UI for debugging
pnpm test:unit:ui

# Run specific test file
pnpm --filter backend test src/services/FormService.test.ts
```

### Integration Tests

```bash
# Add console.log in step definitions
# Logs will appear in terminal output

# Run single scenario
pnpm test:integration:by-tags "@forms and @create"
```

### E2E Tests

```bash
# Run in headed mode to see browser
pnpm test:e2e:headed

# Use Playwright Inspector
PWDEBUG=1 pnpm test:e2e

# Take screenshots on failure (automatic)
# Screenshots saved to test-results/
```

## CI/CD Testing

Tests run automatically in GitHub Actions on:
- Pull requests
- Pushes to main branch
- Release tags

### CI Test Workflow

```yaml
# .github/workflows/test.yml
- name: Run unit tests
  run: pnpm test:unit

- name: Run integration tests
  run: pnpm test:integration

- name: Run E2E tests
  run: pnpm test:e2e
```

## Best Practices

### 1. Test Naming
- Use descriptive names that explain what is being tested
- Follow "should [expected behavior] when [condition]" pattern
- Group related tests in `describe` blocks

### 2. Test Independence
- Each test should be independent and not rely on other tests
- Use `beforeEach` to set up test data
- Clean up after tests in `afterEach`

### 3. Arrange-Act-Assert
- **Arrange**: Set up test data and conditions
- **Act**: Execute the code being tested
- **Assert**: Verify the results

### 4. Mock External Dependencies
- Mock database calls in unit tests
- Mock API calls in frontend tests
- Use test databases for integration tests

### 5. Test Edge Cases
- Test with empty inputs
- Test with invalid data
- Test error conditions
- Test boundary values

## Troubleshooting

### Tests Failing Locally

```bash
# Clean and rebuild
pnpm clean
pnpm install
pnpm build

# Reset database
pnpm docker:down
pnpm docker:up
pnpm db:push
```

### Integration Tests Timeout

```bash
# Increase timeout in cucumber.js
// test/integration/cucumber.js
module.exports = {
  default: {
    timeout: 30000, // Increase from default
  }
};
```

### E2E Tests Flaky

```bash
# Add explicit waits
await page.waitForSelector('[data-testid="form-list"]');

# Use retry logic
await expect(async () => {
  const count = await page.locator('.form-item').count();
  expect(count).toBe(3);
}).toPass({ timeout: 5000 });
```

## Quick Reference

```bash
# Unit Tests
pnpm test:unit              # Run all
pnpm test:unit:watch        # Watch mode
pnpm test:unit:coverage     # With coverage

# Integration Tests
pnpm test:integration       # Run all
pnpm test:integration:auth  # Auth tests only
pnpm test:integration:by-tags "@forms"  # By tag

# E2E Tests
pnpm test:e2e              # Headless
pnpm test:e2e:headed       # With browser
PWDEBUG=1 pnpm test:e2e    # Debug mode
```

# Cucumber BDD Integration Tests

This directory contains Behavior Driven Development (BDD) integration tests using Cucumber.js for the Dculus Forms application.

## Overview

The Cucumber tests complement the existing Jest-based integration tests by providing:
- **Human-readable test scenarios** in Gherkin format
- **Business-focused test descriptions** that non-technical stakeholders can understand
- **Reusable step definitions** for common testing patterns
- **Tagged test execution** for flexible test organization

## Directory Structure

```
tests/integration/
├── features/              # Gherkin feature files (.feature)
│   └── health-check.feature
├── steps/                 # Step definitions (.ts)
│   └── health-check.steps.ts
├── support/               # Support files
│   └── world.ts          # Custom World class
├── setup/                 # Setup and configuration
│   └── cucumber-setup.ts  # Hooks and global setup
├── utils/                 # Shared utilities
│   └── testClient.ts     # API test client
└── reports/              # Generated test reports
    ├── cucumber-report.html
    └── cucumber-report.json
```

## Available Test Tags

Tests are organized using tags for flexible execution:

- `@smoke` - Critical functionality tests that should always pass
- `@health` - Health check and system status tests  
- `@performance` - Performance and response time tests
- `@integration` - Full integration test scenarios
- `@manual` - Tests that require manual verification (excluded in CI)
- `@skip` - Tests to skip (useful for debugging)

## Running Tests

### Prerequisites

Ensure Docker and Docker Compose are running, then:

```bash
# Install dependencies
pnpm install

# Start test environment
pnpm test:integration:setup
```

### Test Execution Commands

```bash
# Run all Cucumber tests
pnpm test:cucumber

# Run smoke tests only
pnpm test:cucumber:smoke

# Run health check tests only  
pnpm test:cucumber:health

# Run with specific tags
pnpm test:cucumber:tags "@health and @smoke"

# Run in CI mode (fail fast, no retries)
pnpm test:cucumber:ci

# Direct Cucumber execution with custom options
npx cucumber-js --config cucumber.config.js --tags "@performance"
```

### Advanced Usage

```bash
# Run without cleanup (for debugging)
./scripts/cucumber-test.sh --no-cleanup

# Show Docker logs on failure
./scripts/cucumber-test.sh --logs --smoke

# Run specific tags with CI profile
./scripts/cucumber-test.sh --ci --tags "@smoke or @health"
```

## Writing New Tests

### 1. Create Feature Files

Feature files use Gherkin syntax to describe test scenarios:

```gherkin
Feature: User Authentication
  As a user
  I want to authenticate with the system
  So that I can access protected resources

  @smoke @auth
  Scenario: Successful login with valid credentials
    Given I have valid user credentials
    When I submit the login form
    Then I should be logged in successfully
    And I should see the dashboard
```

### 2. Implement Step Definitions

Step definitions connect Gherkin steps to TypeScript code:

```typescript
import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@jest/globals';
import { CustomWorld } from '../support/world';

Given('I have valid user credentials', function(this: CustomWorld) {
  this.credentials = { email: 'test@example.com', password: 'password123' };
});

When('I submit the login form', async function(this: CustomWorld) {
  const response = await this.testClient.login(this.credentials);
  this.setResponse(response);
});

Then('I should be logged in successfully', function(this: CustomWorld) {
  expect(this.responseStatus).toBe(200);
  expect(this.responseBody).toHaveProperty('token');
});
```

### 3. Use the Custom World

The `CustomWorld` class provides:
- Access to the test client (`this.testClient`)
- Response storage methods (`this.setResponse()`)
- Logging utilities (`this.logScenario()`)
- Base URL configuration (`this.getBaseUrl()`)

## Test Reports

After running tests, reports are generated in `tests/integration/reports/`:

- **HTML Report** (`cucumber-report.html`) - Visual test results for browsers
- **JSON Report** (`cucumber-report.json`) - Structured data for CI/CD integration

## Configuration

### Cucumber Config (`cucumber.config.js`)

- **Default profile** - Standard test execution with retries
- **CI profile** - Fail-fast execution for continuous integration

### Environment Variables

- `TEST_BASE_URL` - Backend API base URL (default: `http://localhost:4000`)

## Best Practices

### Feature Files
- Use descriptive scenario names that explain the business value
- Keep scenarios focused on a single behavior
- Use tags to organize related tests
- Write from the user's perspective

### Step Definitions
- Make steps reusable across multiple scenarios
- Use the Custom World to share data between steps
- Add meaningful logging with `this.logScenario()`
- Handle both positive and negative test cases

### Test Organization
- Group related features in the same `.feature` file
- Use consistent tag naming conventions
- Keep step definitions modular and focused
- Share common utilities through the test client

## Integration with Existing Tests

Cucumber tests complement the existing Jest tests:

- **Jest tests** - Unit and focused integration tests with mocking
- **Cucumber tests** - End-to-end scenarios with real services
- Both use the same test infrastructure (Docker Compose, test client)
- Both can be run independently or together

## Troubleshooting

### Common Issues

1. **TypeScript compilation errors**
   - Check `tsconfig.cucumber.json` configuration
   - Ensure all imports use correct paths

2. **Step definition not found**
   - Verify step patterns match exactly
   - Check that step files are in `steps/` directory

3. **Test environment not ready**
   - Ensure Docker services are healthy
   - Check backend endpoint availability

4. **Tag filtering not working**
   - Use proper tag expression syntax
   - Quote complex expressions: `"@tag1 and @tag2"`

### Debug Mode

Run tests without cleanup to inspect the environment:

```bash
./scripts/cucumber-test.sh --no-cleanup --logs
# Services remain running for inspection
# Check with: docker compose -f docker-compose.integration.yml ps
```
---
applyTo: "test/**"
---

# Testing Instructions

## Test Types

### 1. Integration Tests (API)
- **Framework**: Cucumber.js + better-auth
- **Location**: `test/integration/`
- **Target**: Backend GraphQL API
- **No mocks** — tests against real running backend

```bash
pnpm test:integration                  # All tests (local)
pnpm test:integration:production       # Against production
pnpm test:integration:auth             # Auth tests only
pnpm test:integration:by-tags          # Filter by Cucumber tags
pnpm test:integration:coverage         # With code coverage
```

### 2. E2E Tests (Browser)
- **Framework**: Playwright + Cucumber
- **Location**: `test/e2e/`
- **Target**: Full browser-based user flows

```bash
pnpm test:e2e                          # Headless
pnpm test:e2e -- --tags "@persistence" # Tagged tests
```

### 3. Unit Tests (Backend)
- **Framework**: Vitest
- **Location**: `apps/backend/src/**/__tests__/`

```bash
pnpm test:unit                         # Run all
pnpm test:unit:watch                   # Watch mode
pnpm test:unit:coverage                # With coverage
```

## Test Credentials

```
# E2E Tests
Email: cloude2etest@mailinator.com
Password: cloude2etest@mailinator.com

# Integration Tests (alternate)
Email: sivam2@mailinator.com
Password: password
```

## Integration Test Structure

```
test/integration/
├── features/                    # Gherkin .feature files
│   ├── auth.feature
│   ├── auth-email-password.feature
│   ├── health.feature
│   └── *.feature
├── step-definitions/           # Step implementations
│   ├── common.steps.ts
│   └── *.steps.ts
├── support/
│   ├── world.ts               # Cucumber World class
│   └── hooks.ts               # Before/After hooks
├── utils/
│   └── auth-utils.ts          # Auth helper utilities
├── cucumber.js                # Local config
├── cucumber.production.js     # Production config
└── tsconfig.json
```

## Writing a New Integration Test

1. Create feature file `test/integration/features/my-feature.feature`:
```gherkin
@my-feature
Feature: My Feature

  Scenario: Create something
    Given I am authenticated as "test@example.com"
    When I send a GraphQL mutation to create something
    Then the response should be successful
```

2. Create step definitions `test/integration/step-definitions/my-feature.steps.ts`:
```typescript
import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';

Given('I am authenticated as {string}', async function (email: string) {
  await this.authenticate(email);
});

When('I send a GraphQL mutation to create something', async function () {
  this.response = await this.graphqlRequest(`
    mutation { createSomething(input: { name: "test" }) { id name } }
  `);
});

Then('the response should be successful', function () {
  expect(this.response.errors).to.be.undefined;
});
```

## E2E Test Structure

```
test/e2e/
├── features/                # Gherkin .feature files
│   ├── field-short-text.feature
│   ├── field-checkbox.feature
│   ├── form-viewer-multipage.feature
│   └── *.feature
├── steps/                   # Playwright step definitions
├── support/
│   └── world.ts
└── cucumber.js
```

## Tagging Convention

- `@auth` — Authentication tests
- `@persistence` — Data persistence tests
- `@mass-responses` — Bulk response tests
- `@max-responses` — Response limit tests
- `@my-feature` — Custom feature tags

## Running Specific Tests

```bash
# By tag
pnpm test:integration -- --tags "@auth"
pnpm test:e2e -- --tags "@persistence"

# By feature file
pnpm test:integration -- test/integration/features/auth.feature
```

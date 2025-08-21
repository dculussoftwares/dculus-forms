# Journey Tests for Dculus Forms

This directory contains end-to-end journey tests for the collaborative form builder application.

## Overview

The test suite covers the core user journeys:
1. **User Authentication**: Sign up and sign in workflows
2. **Form Creation**: Dashboard navigation and template usage

## Test Structure

```
tests/
├── e2e/                           # End-to-end journey tests
│   ├── auth/                      # Authentication tests
│   │   ├── signup.test.ts         # User registration flow
│   │   └── signin.test.ts         # User login flow
│   ├── form-creation/             # Form creation tests
│   │   ├── dashboard-navigation.test.ts # Dashboard → Templates navigation
│   │   └── template-usage.test.ts # Template selection → Form creation
│   └── utils/                     # Test utilities
│       ├── auth-helpers.ts        # Authentication helpers
│       ├── form-helpers.ts        # Form creation helpers
│       └── page-objects.ts        # Page object models
├── fixtures/                      # Test data
│   ├── test-users.json           # User test data
│   └── test-organizations.json   # Organization test data
└── config/                        # Test configuration
    ├── playwright.config.ts       # Playwright configuration
    └── test-setup.ts             # Global test setup
```

## Prerequisites

1. **Node.js** >= 18.0.0
2. **pnpm** >= 8.0.0
3. **Docker** (for database)
4. **Playwright browsers** (installed automatically)

## Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Install Playwright browsers:
   ```bash
   npx playwright install
   ```

3. Start the required services:
   ```bash
   # Start database
   pnpm docker:up
   
   # Setup database
   pnpm db:generate && pnpm db:push
   
   # Seed test data (optional)
   pnpm db:seed
   ```

## Running Tests

### All E2E Tests
```bash
# Run all journey tests
pnpm test:e2e

# Run with browser UI visible
pnpm test:e2e:headed

# Run with Playwright UI for debugging
pnpm test:e2e:ui

# Debug mode (step through tests)
pnpm test:e2e:debug
```

### Specific Test Suites
```bash
# Run only authentication tests
pnpm test:auth

# Run only form creation tests
pnpm test:form-creation
```

### View Test Reports
```bash
# Open HTML test report
pnpm test:e2e:report
```

## Test Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# Test environment settings
TEST_BASE_URL=http://localhost:3000
DATABASE_URL=mongodb://localhost:27017/dculus-forms-test
```

### Browser Configuration

Tests run on:
- **Chromium** (primary)
- **Firefox** 
- **Webkit** (Safari)

Configuration is in `tests/config/playwright.config.ts`.

## Writing New Tests

### Authentication Tests

```typescript
import { test, expect } from '@playwright/test';
import { SignUpPage } from '../utils/page-objects';
import { generateTestUser } from '../utils/auth-helpers';

test('should create new user account', async ({ page }) => {
  const signUpPage = new SignUpPage(page);
  const userData = generateTestUser();
  
  await signUpPage.goto();
  await signUpPage.fillForm(userData);
  await signUpPage.submit();
  
  // Verify success
  await expect(page).toHaveURL('/signin');
});
```

### Form Creation Tests

```typescript
import { test, expect } from '@playwright/test';
import { authenticateUser } from '../utils/auth-helpers';
import { useTemplate } from '../utils/form-helpers';

test('should create form from template', async ({ page }) => {
  // Setup authenticated user
  await authenticateUser(page, 'test@example.com', 'password123');
  
  // Navigate and use template
  await page.goto('/dashboard/templates');
  await useTemplate(page, {
    formTitle: 'My Test Form',
    description: 'Test description'
  });
  
  // Verify form created
  await expect(page).toHaveURL(/\/dashboard\/form\/[\w-]+$/);
});
```

## Utilities and Helpers

### Authentication Helpers

- `generateTestUser()` - Creates unique test user data
- `signUpNewUser()` - Complete signup flow
- `signInUser()` - Sign in existing user
- `authenticateUser()` - Quick authentication for tests

### Form Helpers

- `navigateToTemplates()` - Navigate to templates page
- `useTemplate()` - Select template and create form
- `generateTestFormData()` - Create unique form data

### Page Objects

- `SignUpPage` - Sign up page interactions
- `SignInPage` - Sign in page interactions
- `DashboardPage` - Dashboard page interactions
- `TemplatesPage` - Templates page interactions
- `UseTemplatePopover` - Template selection popover

## Test Data Management

Tests use unique data generation to avoid conflicts:

```typescript
// Generate unique user
const userData = generateTestUser('suffix');

// Generate unique form
const formData = generateTestFormData('suffix');
```

Static test data is in `tests/fixtures/`.

## Debugging Tests

### Visual Debugging
```bash
# Run with browser visible
pnpm test:e2e:headed

# Interactive debugging
pnpm test:e2e:debug
```

### Screenshots and Videos

Failed tests automatically capture:
- Screenshots
- Screen recordings
- Browser traces

Find them in `tests/test-results/`.

### Console Logs

Test helper functions include console output for debugging:
```typescript
console.log('🔧 Setting up test user...');
console.log('✅ User authenticated successfully');
```

## CI/CD Integration

Tests are configured for continuous integration:

- Parallel execution disabled on CI
- Retry failed tests 2 times
- Generate JUnit reports
- Capture artifacts on failure

## Best Practices

1. **Test Isolation** - Each test creates its own data
2. **Unique Data** - Use generators to avoid conflicts
3. **Page Objects** - Abstract UI interactions
4. **Helper Functions** - Reuse common workflows
5. **Clear Assertions** - Test expected outcomes explicitly

## Troubleshooting

### Common Issues

**Tests failing with "Server not ready"**
```bash
# Ensure services are running
pnpm docker:up
pnpm backend:dev  # In separate terminal
pnpm form-app:dev # In separate terminal
```

**Database connection errors**
```bash
# Reset database
pnpm docker:down
pnpm docker:up
pnpm db:push
```

**Browser not found**
```bash
# Reinstall browsers
npx playwright install
```

### Debug Mode

Run single test in debug mode:
```bash
npx playwright test --config=tests/config/playwright.config.ts --debug tests/e2e/auth/signup.test.ts
```

## Future Enhancements

Planned additions:
- **Collaboration Tests** - Multi-user real-time editing
- **Form Builder Tests** - Drag & drop functionality  
- **Form Submission Tests** - End-to-end form usage
- **API Tests** - GraphQL endpoint testing
- **Performance Tests** - Load and stress testing

---

For questions or issues with tests, check the GitHub repository or create an issue.
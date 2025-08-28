# E2E Tests for Dculus Forms

This directory contains end-to-end tests for the Dculus Forms application using **Playwright** + **Cucumber** with **TypeScript**.

## 🏗️ Architecture

```
test/e2e/
├── features/           # Cucumber feature files (.feature)
├── step-definitions/   # TypeScript step implementations
├── support/           # World, hooks, and test utilities
├── utils/             # Helper utilities (health checks, etc.)
├── scripts/           # Test runner and utility scripts
├── reports/           # Generated test reports and screenshots
├── cucumber.js        # Cucumber configuration
├── playwright.config.ts # Playwright configuration
└── tsconfig.json      # TypeScript configuration
```

## 🚀 Quick Start

### Prerequisites

- Node.js >=18.0.0
- pnpm >=8.0.0
- Docker (for MongoDB)

### Running Tests

#### Option 1: Full Automated Run (Recommended)
```bash
# Starts all services, runs tests, and cleans up
pnpm test:e2e
```

#### Option 2: Run Against Already Running Services
```bash
# Start services manually first
pnpm dev

# Then run tests in development mode
pnpm test:e2e:dev
```

#### Option 3: Run with Visible Browser (Debug Mode)
```bash
# Run tests with browser window visible
pnpm test:e2e:headed
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm test:e2e` | Full automated test run (starts services, runs tests, cleans up) |
| `pnpm test:e2e:dev` | Run tests against already running services |
| `pnpm test:e2e:headed` | Run tests with visible browser window |

## 🧪 Test Features

### Sign Up Page Tests
- ✅ Successful user registration with generated test data
- ✅ Form validation for required fields
- ✅ Email format validation
- ✅ Password length validation  
- ✅ Password confirmation matching
- ✅ Navigation between sign up and sign in pages

### Test Data Generation
Tests automatically generate unique test data:
- **Email**: `test-user-{timestamp}@example.com`
- **Organization**: `Test Org {timestamp}`

## 🔧 Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `E2E_BASE_URL` | `http://localhost:3000` | Frontend URL |
| `E2E_BACKEND_URL` | `http://localhost:4000` | Backend URL |
| `PLAYWRIGHT_HEADLESS` | `true` | Run browser in headless mode |
| `PLAYWRIGHT_SLOW_MO` | `0` | Slow motion delay in ms |

### Service Requirements

The tests require the following services:
1. **MongoDB** (via Docker): `pnpm docker:up`
2. **Backend API** (port 4000): `pnpm backend:dev`
3. **Form App** (port 3000): `pnpm form-app:dev`

## 📊 Test Reports

After running tests, reports are generated in `test/e2e/reports/`:
- **HTML Report**: `cucumber-report.html` - Interactive test results
- **JSON Report**: `cucumber-report.json` - Machine-readable results
- **Screenshots**: `*.png` - Failure screenshots and debug captures

## 🛠️ Writing Tests

### Feature Files
Write tests in Gherkin syntax in the `features/` directory:

```gherkin
Feature: User Authentication
  Scenario: Successful login
    Given I am on the sign in page
    When I enter valid credentials
    Then I should be logged in
```

### Step Definitions
Implement steps in TypeScript in the `step-definitions/` directory:

```typescript
import { Given, When, Then } from '@cucumber/cucumber';
import { E2EWorld } from '../support/world';

Given('I am on the sign in page', async function (this: E2EWorld) {
  await this.navigateToPage('/signin');
});
```

### World API
The `E2EWorld` class provides helpful methods:

```typescript
// Navigation
await this.navigateToPage('/signup');
await this.waitForPageReady();

// Form interaction
await this.fillFormField('Email', 'test@example.com');
await this.clickButton('Submit');

// Assertions
await this.waitForElement('.success-message');
const isVisible = await this.isElementVisible('.error');

// Test data
const email = this.generateTestEmail();
this.setTestData('userEmail', email);

// Debug
await this.takeScreenshot('debug-screenshot');
```

## 🐛 Debugging

### Run Tests with Visible Browser
```bash
pnpm test:e2e:headed
```

### Run Tests in Slow Motion
```bash
PLAYWRIGHT_SLOW_MO=1000 pnpm test:e2e:headed
```

### Check Service Logs
When services are started by the test runner, logs are saved:
- Backend: `test/e2e/backend.log`
- Frontend: `test/e2e/form-app.log`

### Manual Service Testing
```bash
# Check if services respond
curl http://localhost:4000/health    # Backend health
curl http://localhost:3000           # Frontend

# Check GraphQL endpoint
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query { __schema { queryType { name } } }"}'
```

## 🚨 Troubleshooting

### Services Won't Start
1. **Check ports**: Ensure ports 3000 and 4000 are available
2. **Database**: Verify MongoDB is running with `docker ps`
3. **Dependencies**: Run `pnpm install` in project root
4. **Build**: Run `pnpm build` to build shared packages

### Tests Fail Unexpectedly
1. **Screenshots**: Check `test/e2e/reports/*.png` for visual debugging
2. **Service logs**: Review backend and frontend logs
3. **Network**: Verify services are accessible at expected URLs
4. **Timing**: Increase timeouts in `playwright.config.ts` if needed

### Browser Issues
1. **Install browsers**: Run `npx playwright install` if needed
2. **Headless issues**: Try `pnpm test:e2e:headed` to see browser
3. **Permissions**: Ensure browser can access test URLs

## 📝 Best Practices

### Test Design
- ✅ Use descriptive scenario names
- ✅ Keep scenarios focused and independent  
- ✅ Generate unique test data for each run
- ✅ Clean up test data after scenarios

### Step Definitions
- ✅ Reuse common steps across features
- ✅ Use meaningful error messages
- ✅ Take screenshots on failures for debugging
- ✅ Use proper TypeScript types

### Maintenance
- ✅ Keep selectors stable (prefer data-testid attributes)
- ✅ Update tests when UI changes
- ✅ Monitor test execution times
- ✅ Review and update test data regularly
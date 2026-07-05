# Integration Tests

This directory contains integration tests for the Dculus Forms application using Cucumber.js and better-auth for authentication testing.

## Prerequisite: build the backend first

The test harness (`support/hooks.ts`) connects to Postgres using the backend's
generated Prisma client (`apps/backend/src/generated/prisma`, via the
`prisma-client` generator + `@prisma/adapter-pg` — see
`apps/backend/prisma/schema.prisma`). That client is an ES module, and this
test project runs as CommonJS, so the client is loaded via a dynamic
`import()` of the *compiled* backend output rather than a static import.
Run the backend build before running integration tests locally:

```bash
pnpm db:generate
pnpm --filter backend build
```

(CI's `integration-tests` job does this automatically.)

## Quick Start

```bash
# Run all integration tests
pnpm test:integration

# Watch mode (auto-restart on file changes)
pnpm test:integration:watch
```

## Test Commands

| Command | Description | Test Coverage |
|---------|-------------|---------------|
| `test:integration` | **Main command** - Runs all tests | All features (11 scenarios) |
| `test:integration:watch` | Watch mode | All features with auto-restart |

## Authentication Testing

The integration tests include comprehensive authentication testing using better-auth:

### Features Tested
- ✅ **User Registration** - Sign up with organization creation
- ✅ **User Sign In** - Authentication with bearer tokens  
- ✅ **GraphQL Queries** - Authenticated API requests
- ✅ **Authorization** - Access control and error handling
- ✅ **Multi-tenant** - Organization management

### Auth Utilities
The tests use custom auth utilities that mirror the frontend authentication flow:

```typescript
import { AuthUtils, generateTestUser } from './utils';

const authUtils = new AuthUtils('http://localhost:4000');
const testUser = generateTestUser();

// Sign up with organization
await authUtils.signUpUser(
  testUser.email, 
  testUser.password, 
  testUser.name, 
  'Test Organization'
);

// Get auth token  
const token = await authUtils.getAuthToken(testUser.email, testUser.password);

// Make authenticated GraphQL request
await authUtils.graphqlRequest('query { me { id email } }', {}, token);
```

## Test Structure

```
test/integration/
├── features/           # Gherkin feature files
│   ├── health.feature
│   ├── auth.feature
│   ├── auth-simple.feature
│   └── auth-graphql.feature
├── step-definitions/   # Cucumber step implementations
│   ├── common.steps.ts
│   ├── health.steps.ts
│   ├── auth.steps.ts
│   ├── auth-simple.steps.ts
│   └── auth-graphql.steps.ts
├── support/           # Test framework setup
│   ├── world.ts       # Test context and utilities
│   └── hooks.ts       # Before/After test hooks
└── utils/             # Shared test utilities
    ├── auth-utils.ts  # Authentication helpers
    └── test-data.ts   # Test data generators
```

## Test Results

Current status: **✅ All tests passing (11/11 scenarios)**

- Health Check: 2/2 ✅  
- Authentication: 9/9 ✅
- Total Success Rate: 100%

The tests validate the complete authentication flow including user registration, sign-in, GraphQL queries, and error handling without using any mocks.
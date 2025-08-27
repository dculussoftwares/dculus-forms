# Authentication Integration Tests

This document describes the comprehensive authentication integration test suite for Dculus Forms, covering better-auth signup/signin and authenticated GraphQL operations.

## Overview

The authentication integration tests verify the complete authentication flow from user registration through GraphQL API access. This includes:

- **better-auth** signup and signin workflows
- **Token generation and management** 
- **Authenticated GraphQL operations**
- **Organization creation and management**
- **End-to-end user scenarios**
- **Error handling and edge cases**

## Architecture

### Test Stack
- **Framework**: Cucumber BDD with TypeScript
- **HTTP Client**: Supertest for API requests
- **Environment**: Docker Compose with MongoDB and MinIO
- **Authentication**: better-auth with bearer token plugin
- **GraphQL**: Apollo Server integration testing

### Test Structure
```
tests/integration/
├── features/
│   ├── auth-signup.feature           # Core authentication scenarios
│   ├── auth-graphql-e2e.feature     # End-to-end workflows
│   └── health-check.feature         # Infrastructure health
├── steps/
│   ├── auth-signup.steps.ts         # Auth step definitions
│   ├── auth-e2e.steps.ts            # E2E step definitions
│   └── health-check.steps.ts        # Health check steps
├── support/
│   └── world.ts                     # Test world context
├── utils/
│   ├── testClient.ts                # Enhanced HTTP/GraphQL client
│   └── debugUtils.ts                # Debugging utilities
└── setup/
    └── cucumber-setup.js            # Test environment setup
```

## Quick Start

### Running Tests

```bash
# Run all authentication tests
pnpm test:auth

# Run with debug output
pnpm test:auth:debug

# Run only signup tests
pnpm test:auth:signup

# Run end-to-end scenarios
pnpm test:auth:e2e

# Run without cleanup (for debugging)
pnpm test:auth:no-cleanup
```

### Manual Script Execution

```bash
# Basic run
./scripts/test-auth-integration.sh

# With specific tags
./scripts/test-auth-integration.sh --tags "@auth @signup"

# Debug mode with verbose logging
./scripts/test-auth-integration.sh --debug --logs

# Skip cleanup for debugging
./scripts/test-auth-integration.sh --no-cleanup
```

## Test Scenarios

### Core Authentication Tests (`auth-signup.feature`)

#### User Registration
- ✅ Successful signup with organization creation
- ✅ Signup validation (email, password, name, organization)
- ✅ Duplicate email handling
- ✅ Token generation and storage
- ✅ Performance requirements (< 3 seconds)

#### Authentication Flow
- ✅ Sign in with existing credentials  
- ✅ Sign out functionality
- ✅ Token persistence across requests
- ✅ Invalid token rejection

#### GraphQL Integration
- ✅ Authenticated profile queries (`me`)
- ✅ Organization queries (`myOrganizations`, `activeOrganization`)
- ✅ Unauthorized request handling
- ✅ Multiple consecutive authenticated requests

### End-to-End Scenarios (`auth-graphql-e2e.feature`)

#### Complete User Journey
1. **User Registration** → Create account with organization
2. **Profile Verification** → Verify user data via GraphQL
3. **Organization Access** → Confirm organization membership and roles
4. **Active Organization** → Check active organization context

#### Form Lifecycle (Future)
1. **Form Creation** → Create forms within organization context
2. **Form Management** → Query and manage organization forms
3. **Form Responses** → Handle form submissions (planned)

#### Multi-User Workflows
- ✅ Multiple user registration within same test
- ✅ Organization ownership and membership verification
- ✅ User isolation and data separation

#### Session Management
- ✅ Token persistence across multiple requests
- ✅ Session validation over time
- ✅ Authentication state consistency

#### Error Handling
- ✅ Malformed GraphQL query handling
- ✅ Authentication recovery after errors
- ✅ Connection resilience testing

## Test Client Features

### Enhanced TestClient (`testClient.ts`)

The test client provides comprehensive authentication and GraphQL testing capabilities:

#### Authentication Methods
```typescript
// User registration
await testClient.signUp({
  email: 'user@example.com',
  password: 'securepass123',
  name: 'Test User',
  organizationName: 'Test Organization'
});

// User signin
await testClient.signIn({
  email: 'user@example.com', 
  password: 'securepass123'
});

// Sign out
await testClient.signOut();
```

#### GraphQL Operations
```typescript
// Authenticated GraphQL query
const response = await testClient.authenticatedGraphQL(`
  query {
    me {
      id
      email
      name
    }
  }
`);

// Unauthenticated GraphQL query  
const response = await testClient.graphql(query);
```

#### Token Management
```typescript
// Check authentication status
const isAuth = testClient.isAuthenticated();

// Get stored tokens
const tokens = testClient.getAuthTokens();

// Clear authentication state
testClient.clearAuthTokens();

// Create test user with default values
await testClient.createTestUser();
```

## Environment Configuration

### Environment Variables

The tests use dedicated environment configuration (`tests/.env.integration`):

```env
# Core Configuration
NODE_ENV=test
DATABASE_URL=mongodb://admin:password123@localhost:27017/dculus_test?authSource=admin

# Authentication  
JWT_SECRET=test-jwt-secret-integration-12345678901234567890
BETTER_AUTH_SECRET=test-better-auth-secret-integration-12345678901234567890
BETTER_AUTH_BASE_URL=http://localhost:4000
BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:4000

# Services
BACKEND_URL=http://localhost:4000
GRAPHQL_ENDPOINT=http://localhost:4000/graphql

# Storage (MinIO)
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin123
S3_PUBLIC_BUCKET_NAME=dculus-public
S3_PRIVATE_BUCKET_NAME=dculus-private
```

### Docker Services

Tests run against containerized services:

- **MongoDB** (`mongo:7.0`) - Database with test data
- **MinIO** (`minio/minio`) - S3-compatible storage  
- **Backend** (`dculus/forms-backend:latest`) - Application server
- **MinIO Init** - Bucket setup and policies

## Debugging

### Debug Mode

Enable comprehensive debugging:

```bash
# Environment variables
export DEBUG_REQUESTS=true     # Log HTTP requests
export DEBUG_RESPONSES=true    # Log HTTP responses  
export DEBUG_TOKENS=true       # Log auth tokens
export DEBUG_GRAPHQL=true      # Log GraphQL operations
export DEBUG_VERBOSE=true      # Verbose output

# Or use debug flag
./scripts/test-auth-integration.sh --debug
```

### Debug Output

Debug mode provides detailed logging:

```
🌐 HTTP Request:
   Method: POST
   URL: /api/auth/sign-up
   Data: {"email":"test@example.com","password":"[REDACTED]"}

📥 HTTP Response:
   Status: 200
   Body: {"user":{"id":"...","email":"test@example.com"}}

🔐 Auth Token generated:
   Token: eyJhbGci...OpXVCJ9 (masked for security)
   Decoded: {"userId":"...","email":"...","exp":"2024-01-01T00:00:00Z"}

🔍 GraphQL Query:
   Query: query { me { id email name } }
   Data: {me: {id: "...", email: "...", name: "..."}}
```

### Manual Debugging

For manual inspection during test failures:

```bash
# Run without cleanup
./scripts/test-auth-integration.sh --no-cleanup --logs

# Access services directly
# GraphQL Playground: http://localhost:4000/graphql
# MinIO Console: http://localhost:9001 (minioadmin/minioadmin123)
# MongoDB: mongosh "mongodb://admin:password123@localhost:27017/dculus_test?authSource=admin"
```

### Test Data Inspection

View created test data:

```javascript
// In MongoDB shell
use dculus_test;
db.users.find({email: /test/});
db.organizations.find({name: /test/i});
db.members.find({});
```

## Common Issues & Solutions

### 1. Services Not Ready
**Problem**: Tests fail because Docker services aren't healthy
**Solution**: 
- Increase health check timeout in `docker-compose.integration.yml`
- Verify Docker has sufficient resources allocated
- Check service logs: `docker-compose -f docker-compose.integration.yml logs backend`

### 2. Authentication Token Issues  
**Problem**: Token not found or invalid
**Solution**:
- Enable token debugging: `DEBUG_TOKENS=true`
- Verify better-auth configuration matches between backend and tests
- Check token extraction logic in `testClient.ts`

### 3. GraphQL Schema Mismatches
**Problem**: GraphQL queries fail with field errors
**Solution**:
- Ensure backend Docker image is up-to-date
- Verify GraphQL schema matches test expectations
- Use GraphQL playground to validate queries manually

### 4. Database State Pollution
**Problem**: Tests fail due to previous test data
**Solution**:
- Each test scenario clears authentication state automatically
- Manual cleanup: `docker-compose -f docker-compose.integration.yml down -v`
- Consider using unique test data identifiers

### 5. Port Conflicts
**Problem**: Cannot bind to localhost ports (3000, 4000, 9000, 27017)
**Solution**:
- Stop conflicting services: `lsof -ti:4000 | xargs kill -9`
- Update port mappings in `docker-compose.integration.yml`
- Use different port ranges for integration tests

## CI/CD Integration

### GitHub Actions

```yaml
name: Authentication Integration Tests
on: [push, pull_request]

jobs:
  auth-integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: pnpm install
        
      - name: Run Authentication Tests
        run: pnpm test:auth
        env:
          CI: true
          
      - name: Upload Test Reports
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: auth-test-reports
          path: tests/integration/reports/
```

## Extending the Tests

### Adding New Authentication Scenarios

1. **Add scenarios to feature files**:
```gherkin
@auth @new-feature
Scenario: My new authentication test
  Given I have a user account
  When I perform some action
  Then I should see expected result
```

2. **Implement step definitions**:
```typescript
When('I perform some action', async function(this: CustomWorld) {
  // Implementation
  const response = await this.testClient.someNewMethod();
  this.setResponse(response);
});
```

3. **Extend test client if needed**:
```typescript
// Add new methods to testClient.ts
async someNewMethod() {
  return this.request()
    .post('/api/new-endpoint')
    .set('Authorization', `Bearer ${this.authTokens?.accessToken}`)
    .send(data);
}
```

### Adding GraphQL Operations

1. **Create GraphQL test scenarios**:
```gherkin
When I query my custom data via GraphQL:
  """
  query {
    myCustomData {
      id
      customField
    }
  }
  """
```

2. **Add step definitions**:
```typescript
When('I query my custom data via GraphQL:', async function(this: CustomWorld, query: string) {
  const response = await this.testClient.authenticatedGraphQL(query);
  this.setResponse(response);
});
```

## Performance Considerations

### Test Execution Time
- **Typical run time**: 2-5 minutes for full suite
- **Service startup**: ~60 seconds (Docker container initialization)  
- **Test execution**: ~2-3 minutes (depends on scenario count)
- **Cleanup**: ~10 seconds

### Optimization Strategies
- **Parallel execution**: Use `--parallel` flag (experimental)
- **Selective testing**: Use tags to run subset of scenarios
- **Container reuse**: Skip cleanup between runs during development
- **Resource allocation**: Ensure Docker has adequate CPU/memory

### CI Optimization
- **Docker layer caching**: Cache backend image layers
- **Parallel jobs**: Run different test suites in parallel
- **Selective triggering**: Only run auth tests when auth code changes
- **Resource limits**: Set appropriate timeout values for CI environment

## Security Considerations

### Token Safety
- Authentication tokens are automatically masked in debug output
- Test tokens use dedicated secrets separate from production
- Tokens are cleared between test scenarios automatically
- No production credentials are used in integration tests

### Test Data Isolation  
- Each test uses unique email addresses with timestamps
- Test database (`dculus_test`) is separate from development/production
- Docker containers are isolated from host system
- Test data is automatically cleaned up after test runs

### Environment Security
- Integration test environment uses non-production secrets
- Docker containers run with minimal required permissions
- Network access is restricted to localhost interfaces
- No external API calls are made during testing

This comprehensive authentication integration test suite ensures that the critical user registration, authentication, and GraphQL access flows work correctly and reliably across the entire Dculus Forms platform.
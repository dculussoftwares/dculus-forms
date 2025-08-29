# Deployment Testing Guide

This document describes the deployment testing setup that runs E2E and integration tests against the deployed production environment.

## Overview

The deployment testing system allows running tests against the actual deployed services instead of local development servers. This provides:

- **Quality Assurance**: Verify deployments work end-to-end  
- **Real Environment Testing**: Test against actual production infrastructure
- **CI/CD Integration**: Automatic testing after each deployment
- **Early Detection**: Catch deployment-specific issues immediately

## Architecture

### Test Scripts

#### E2E Tests
- **Script**: `test/e2e/scripts/run-deployment-e2e-tests.sh`
- **Target**: Form App (Cloudflare Pages) + Backend (Azure Container Apps)
- **Features**:
  - Deployment readiness validation
  - Extended timeouts for production
  - Screenshot capture on failures
  - Detailed reporting

#### Integration Tests  
- **Script**: `test/integration/scripts/run-deployment-integration-tests.sh`
- **Target**: Backend GraphQL API (Azure Container Apps)
- **Features**:
  - Backend health checks
  - GraphQL introspection validation
  - Increased request timeouts
  - Retry logic for network issues

### Configuration

#### Environment Variables

**E2E Tests:**
```bash
# Override deployment URLs
DEPLOYMENT_FORM_APP_URL="https://dculus-forms-app.pages.dev"
DEPLOYMENT_BACKEND_URL="https://dculus-forms-backend.reddune-e5ba9473.eastus.azurecontainerapps.io"

# Test configuration
E2E_DEPLOYMENT_MODE=true
PLAYWRIGHT_HEADLESS=true
PLAYWRIGHT_TIMEOUT=60000
```

**Integration Tests:**
```bash
# Override deployment URL
DEPLOYMENT_BACKEND_URL="https://dculus-forms-backend.reddune-e5ba9473.eastus.azurecontainerapps.io"

# Test configuration  
TEST_DEPLOYMENT_MODE=true
TEST_TIMEOUT=60000
TEST_RETRY_COUNT=3
```

#### World Configuration Updates

Both E2E and integration test worlds have been updated to:
- Support deployment URL overrides
- Use extended timeouts in deployment mode
- Log configuration for debugging
- Handle production-specific scenarios

## Usage

### Local Testing Against Deployment

#### Run E2E tests against deployment:
```bash
# Basic deployment testing
pnpm test:e2e:deployment

# With custom URLs
pnpm test:e2e:deployment --form-app-url https://custom-app.pages.dev --backend-url https://custom-api.com

# With browser visible (debugging)
pnpm test:e2e:deployment:headed

# Skip deployment validation
pnpm test:e2e:deployment --skip-validation
```

#### Run Integration tests against deployment:
```bash
# Basic deployment testing
pnpm test:integration:deployment

# With custom backend URL
pnpm test:integration:deployment --backend-url https://custom-api.com

# With increased timeout
pnpm test:integration:deployment --timeout 90000

# With more retries
pnpm test:integration:deployment --retry-count 5
```

#### Run both test suites:
```bash
pnpm test:deployment
```

### CI/CD Integration

The GitHub Actions workflow now includes two new jobs that run after deployment:

#### `test-deployment-integration`
- **Runs after**: `deploy-to-azure`
- **Tests**: Backend GraphQL API functionality
- **Timeout**: 5 minutes deployment readiness + test execution
- **Artifacts**: Test reports and logs

#### `test-deployment-e2e` 
- **Runs after**: `deploy-form-app-to-cloudflare` + `deploy-to-azure`
- **Tests**: Full user workflows across frontend + backend
- **Timeout**: 5 minutes deployment readiness + test execution  
- **Artifacts**: Test reports, screenshots, and logs

Both jobs:
- Only run on `main` and `release` branches (not PRs)
- Wait for deployments to be ready before testing
- Upload artifacts for debugging failures
- Report results in the build summary

## Test Configuration

### Deployment Mode Features

When `E2E_DEPLOYMENT_MODE` or `TEST_DEPLOYMENT_MODE` is enabled:

**E2E Tests:**
- Extended browser timeouts (60s vs 30s)
- Skip local service startup
- Use production URLs
- Enhanced error logging
- Production-specific selectors

**Integration Tests:**
- Extended HTTP timeouts (60s vs 10s)
- Retry logic for network issues
- Production endpoint validation
- Enhanced error reporting

### Test Filtering

Use `@local-only` tags to skip tests that only work in local development:

```gherkin
@local-only
Scenario: Test local database seeding
  # This test will be skipped in deployment mode
```

## Deployment URLs

### Default URLs

**Production (Main Branch):**
- Form App: `https://dculus-forms-app.pages.dev`
- Form Viewer: `https://dculus-forms-viewer-app.pages.dev`  
- Admin App: `https://dculus-forms-admin-app.pages.dev`
- Backend: `https://dculus-forms-backend.reddune-e5ba9473.eastus.azurecontainerapps.io`

**Branch Previews:**
- Form App: `https://[branch].dculus-forms-app.pages.dev`
- Form Viewer: `https://[branch].dculus-forms-viewer-app.pages.dev`
- Admin App: `https://[branch].dculus-forms-admin-app.pages.dev`

### Override URLs

You can override deployment URLs via environment variables or script parameters:

```bash
# Environment variables
export DEPLOYMENT_FORM_APP_URL="https://staging-app.pages.dev"
export DEPLOYMENT_BACKEND_URL="https://staging-api.azurecontainerapps.io"

# Script parameters  
./test/e2e/scripts/run-deployment-e2e-tests.sh --form-app-url https://staging-app.pages.dev
./test/integration/scripts/run-deployment-integration-tests.sh --backend-url https://staging-api.com
```

## Troubleshooting

### Common Issues

**1. Deployment Not Ready**
```bash
# Skip validation if you know deployment is ready
pnpm test:e2e:deployment --skip-validation
pnpm test:integration:deployment --skip-validation
```

**2. Timeouts in Production**  
```bash
# Increase timeouts
export TEST_TIMEOUT=120000  # 2 minutes
export PLAYWRIGHT_TIMEOUT=90000  # 90 seconds
```

**3. Network Issues**
```bash
# Increase retry count
export TEST_RETRY_COUNT=5
```

**4. CORS or Authentication Issues**
- Check that the deployed backend has correct CORS settings
- Verify authentication endpoints are accessible
- Review deployment logs for errors

### Debugging

**View detailed logs:**
```bash
# Enable verbose logging
./test/integration/scripts/run-deployment-integration-tests.sh --verbose

# Run E2E with visible browser
pnpm test:e2e:deployment:headed

# Run with slow motion
PLAYWRIGHT_SLOW_MO=1000 pnpm test:e2e:deployment:headed
```

**Check deployment health manually:**
```bash
# Backend health
curl https://dculus-forms-backend.reddune-e5ba9473.eastus.azurecontainerapps.io/health

# GraphQL introspection
curl -X POST https://dculus-forms-backend.reddune-e5ba9473.eastus.azurecontainerapps.io/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __schema { types { name } } }"}'

# Frontend availability
curl https://dculus-forms-app.pages.dev
```

## Limitations

1. **Data Isolation**: Tests run against shared production database
2. **Rate Limiting**: Production APIs may have stricter rate limits  
3. **Authentication**: Some tests may need production-compatible auth setup
4. **Network Dependencies**: Tests depend on external service availability

## Future Enhancements

1. **Staging Environment**: Add staging deployment targets
2. **Test Data Management**: Implement test data seeding/cleanup for production
3. **Performance Testing**: Add load testing against deployed services
4. **Multi-Region Testing**: Test deployments across different regions
5. **Rollback Testing**: Verify rollback procedures work correctly
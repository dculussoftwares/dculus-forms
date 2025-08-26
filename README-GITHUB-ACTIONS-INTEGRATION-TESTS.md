# GitHub Actions Integration Tests

This document describes how integration tests are integrated into the GitHub Actions CI/CD pipeline.

## Overview

Integration tests have been added to the build pipeline to ensure the backend Docker image works correctly before deployment. The tests run automatically after the `build-and-push` job and before any deployment jobs.

## Pipeline Flow

```
Build & Push → Integration Tests → Deploy to Azure
                                ↓
                           Deploy to Cloudflare
```

## Integration Test Job

### Location in Pipeline
- **Job Name**: `integration-tests`
- **Runs After**: `build-and-push` 
- **Runs Before**: `deploy-to-azure`, deployments to Cloudflare
- **Trigger**: All branches except PRs (PRs run validation only)

### What It Does

#### For Main/Release Branches:
1. **Full Docker Integration Tests**
   - Sets up complete Docker Compose environment
   - Pulls the freshly built backend image (`dculus/forms-backend:latest`)
   - Starts MongoDB, MinIO, and backend services
   - Runs comprehensive health endpoint tests
   - Validates service connectivity and API responses

#### For Pull Requests:
1. **Configuration Validation Only**
   - Validates Jest configuration syntax
   - Validates Docker Compose configuration
   - Checks integration test file structure
   - Skips Docker execution (due to CI limitations)

### Services Tested

1. **MongoDB** - Database connectivity and health
2. **MinIO** - S3-compatible storage setup
3. **Backend** - Health endpoint and API availability

### Test Coverage

- ✅ HTTP 200 status code validation
- ✅ JSON response structure verification  
- ✅ Response content validation (`success: true`)
- ✅ Timestamp format validation
- ✅ Uptime value validation
- ✅ Content-type header validation
- ✅ Response time performance check (< 1 second)

## Configuration

### Environment Variables
The integration tests use the following environment variables in the GitHub Actions runner:

```env
NODE_ENV=test
DATABASE_URL=mongodb://admin:password123@mongodb:27017/dculus_test?authSource=admin
JWT_SECRET=test-jwt-secret-integration-12345678901234567890
BETTER_AUTH_SECRET=test-better-auth-secret-integration-12345678901234567890
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin123
S3_PUBLIC_BUCKET_NAME=dculus-public
S3_PRIVATE_BUCKET_NAME=dculus-private
S3_CDN_URL=http://localhost:9000
```

### Docker Images Used
- **Backend**: `dculus/forms-backend:latest` (freshly built)
- **Database**: `mongo:7.0`
- **Storage**: `minio/minio:latest` + `minio/mc:latest`

### Timeouts
- **Job Timeout**: 15 minutes
- **Health Check Wait**: Up to 30 attempts (1 minute)
- **Individual Test Timeout**: 30 seconds

## Integration with Deployment

### Deployment Dependencies
All deployment jobs now depend on integration tests:

```yaml
deploy-to-azure:
  needs: [build-and-push, integration-tests]
  
deploy-form-app-to-cloudflare:
  needs: build-form-app
  # (Indirectly depends via build-summary)
```

### Failure Handling
- **Integration Test Failure**: Blocks all deployments
- **Test Success**: Allows deployments to proceed
- **PR Tests**: Only validate configuration, don't block merging

## Reporting

### Automatic Comments
The pipeline automatically creates:

#### For Main/Release Branches:
- **Commit Comment** with detailed test results
- **Job Summary** in GitHub Actions UI
- **Artifacts** uploaded (test results, Docker configs)

#### For Pull Requests:
- **PR Comment** with configuration validation results
- **Simplified Summary** focusing on validation

### Sample Comment Output

```markdown
## 🧪 Integration Test Results

**Status**: ✅ PASSED
**Backend Image**: dculus/forms-backend:latest
**Test Environment**: Docker Compose sandbox
**Services Tested**:
- ✅ MongoDB (Database)
- ✅ MinIO (S3-compatible storage)  
- ✅ Backend (Health endpoint verification)

### Test Summary:
- Health endpoint response validation
- JSON structure verification
- Response time performance check
- Service connectivity validation

**Duration**: ~2-3 minutes including Docker setup
```

## Benefits

### Quality Assurance
- **Early Detection**: Catches integration issues before deployment
- **Realistic Environment**: Tests actual Docker image in isolated environment
- **Service Validation**: Ensures all dependencies work together

### CI/CD Safety
- **Deployment Gates**: Prevents broken deployments
- **Rollback Prevention**: Stops bad builds from reaching production  
- **Confidence Building**: Validates end-to-end functionality

### Developer Experience
- **Fast Feedback**: Results available within 3-5 minutes
- **Clear Reporting**: Detailed test results and failure explanations
- **PR Safety**: Configuration validation without full test overhead

## Troubleshooting

### Common Issues

1. **Docker Image Pull Failure**
   - Check Docker Hub access and image availability
   - Verify image tag exists after build-and-push job

2. **Service Health Check Timeouts**
   - Review service logs in GitHub Actions
   - Check resource constraints in CI environment

3. **Port Conflicts**
   - Usually resolved automatically in fresh CI containers
   - Check for any custom port assignments

### Debug Commands

```bash
# Check job logs for service status
docker-compose -f docker-compose.integration.yml ps

# View service logs
docker-compose -f docker-compose.integration.yml logs backend
docker-compose -f docker-compose.integration.yml logs mongodb
docker-compose -f docker-compose.integration.yml logs minio

# Validate configuration locally
docker-compose -f docker-compose.integration.yml config
npx jest --config jest.integration.config.js --listTests
```

## Future Enhancements

### Planned Improvements
- **GraphQL API Testing**: Extend beyond health endpoints
- **File Upload Testing**: Validate MinIO integration
- **Authentication Flow Testing**: Test better-auth integration
- **Database Operation Testing**: Validate Prisma/MongoDB operations

### Scalability
- **Parallel Test Execution**: Split tests into multiple jobs
- **Test Caching**: Cache Docker images for faster execution
- **Environment Variations**: Test against different backend configurations

## Manual Testing

To run the same tests locally that run in GitHub Actions:

```bash
# Full integration test (same as CI main branch)
pnpm test:integration

# Configuration validation only (same as CI PR)
npx jest --config jest.integration.config.js --listTests
docker-compose -f docker-compose.integration.yml config
```

This ensures parity between local development and CI environment.
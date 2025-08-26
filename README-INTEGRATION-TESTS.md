# Integration Tests Setup

This document describes the integration testing setup for Dculus Forms backend using Docker Compose.

## Overview

The integration test environment consists of:
- **MongoDB**: Database for storing application data
- **MinIO**: S3-compatible storage for file handling
- **Backend**: Published Docker image of the Dculus Forms backend
- **Jest**: Testing framework for running integration tests

## Quick Start

### Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ and pnpm 8+ installed
- Access to the published Docker image `ghcr.io/natheeshkumarrangasamy/dculus-forms-backend:latest`

### Running Integration Tests

```bash
# Run all integration tests (recommended)
pnpm test:integration

# Setup test environment only (for debugging)
pnpm test:integration:setup

# Teardown test environment
pnpm test:integration:teardown
```

### Advanced Usage

```bash
# Run tests without cleanup (useful for debugging)
./scripts/integration-test.sh --no-cleanup

# Show Docker logs on test failure
./scripts/integration-test.sh --logs

# Show help
./scripts/integration-test.sh --help
```

## Architecture

### Docker Compose Services

#### MongoDB (`mongodb`)
- **Image**: `mongo:7.0`
- **Port**: `27017`
- **Credentials**: `admin:password123`
- **Database**: `dculus_test`
- **Initialization**: Creates collections and test user via `mongo-init.js`

#### MinIO (`minio`)
- **Image**: `minio/minio:latest`
- **Ports**: `9000` (API), `9001` (Console)
- **Credentials**: `minioadmin:minioadmin123`
- **Buckets**: `dculus-public`, `dculus-private`
- **Bucket Policy**: Public bucket allows public read access

#### Backend (`backend`)
- **Image**: `ghcr.io/natheeshkumarrangasamy/dculus-forms-backend:latest`
- **Port**: `4000`
- **Dependencies**: Waits for MongoDB and MinIO to be healthy
- **Environment**: Configured for test environment with MongoDB and MinIO

### Test Structure

```
tests/
├── .env.integration          # Environment variables
├── integration/
│   ├── setup/
│   │   ├── globalSetup.ts    # Jest global setup
│   │   ├── globalTeardown.ts # Jest global teardown
│   │   ├── setup.ts          # Test setup configuration
│   │   └── mongo-init.js     # MongoDB initialization script
│   ├── api/
│   │   └── health.test.ts    # Health endpoint tests
│   └── utils/
│       └── testClient.ts     # HTTP client utilities
```

## Current Tests

### Health Check Tests (`health.test.ts`)

Tests the `/health` endpoint to verify:
- ✅ Returns 200 status code
- ✅ Returns correct JSON structure
- ✅ Returns `success: true`
- ✅ Returns valid timestamp
- ✅ Returns positive uptime value
- ✅ Has correct content-type header
- ✅ Responds quickly (under 1 second)

## Configuration

### Environment Variables

The integration tests use the following environment variables (defined in `tests/.env.integration`):

```env
NODE_ENV=test
DATABASE_URL=mongodb://admin:password123@localhost:27017/dculus_test?authSource=admin
JWT_SECRET=test-jwt-secret-integration-12345678901234567890
BETTER_AUTH_SECRET=test-better-auth-secret-integration-12345678901234567890
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin123
S3_PUBLIC_BUCKET_NAME=dculus-public
S3_PRIVATE_BUCKET_NAME=dculus-private
S3_CDN_URL=http://localhost:9000
BACKEND_URL=http://localhost:4000
HEALTH_ENDPOINT=http://localhost:4000/health
GRAPHQL_ENDPOINT=http://localhost:4000/graphql
```

### Jest Configuration

Integration tests use a separate Jest config (`jest.integration.config.js`) with:
- TypeScript support via `ts-jest`
- 30-second test timeout
- Global setup/teardown hooks
- Custom module path mapping

## Extending Tests

To add more integration tests:

1. Create test files in `tests/integration/api/`
2. Use the `testClient` utility for making HTTP requests
3. Follow the existing pattern for test structure
4. Ensure tests are isolated and don't depend on order

### Example: Adding GraphQL Tests

```typescript
// tests/integration/api/graphql.test.ts
import { testClient } from '../utils/testClient';

describe('GraphQL Integration Tests', () => {
  beforeAll(async () => {
    await testClient.waitForReady();
  });

  it('should handle GraphQL introspection', async () => {
    const query = `
      query {
        __schema {
          types {
            name
          }
        }
      }
    `;
    
    const response = await testClient.graphql(query);
    expect(response.status).toBe(200);
    expect(response.body.data).toBeDefined();
  });
});
```

## Troubleshooting

### Common Issues

1. **Docker not running**: Ensure Docker Desktop is running
2. **Port conflicts**: Check if ports 4000, 9000, 9001, 27017 are available
3. **Image pull failures**: Ensure you have access to the backend Docker image
4. **Services not healthy**: Wait longer or check Docker logs

### Debugging

```bash
# Check service status
docker-compose -f docker-compose.integration.yml ps

# View logs
docker-compose -f docker-compose.integration.yml logs backend
docker-compose -f docker-compose.integration.yml logs mongodb
docker-compose -f docker-compose.integration.yml logs minio

# Run tests with cleanup disabled for debugging
./scripts/integration-test.sh --no-cleanup

# Access MinIO console
open http://localhost:9001

# Connect to MongoDB
mongosh "mongodb://admin:password123@localhost:27017/dculus_test?authSource=admin"
```

### Performance

- First run may take longer due to Docker image pulls
- Subsequent runs are faster due to Docker layer caching
- Test execution typically takes 10-30 seconds
- Service startup takes 30-60 seconds

## CI/CD Integration

The integration tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run Integration Tests
  run: |
    chmod +x ./scripts/integration-test.sh
    ./scripts/integration-test.sh
```

Ensure the CI environment has:
- Docker and Docker Compose available
- Access to pull the backend Docker image
- Sufficient resources for running multiple containers
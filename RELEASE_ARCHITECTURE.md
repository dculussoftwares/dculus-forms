# Release & Deployment Architecture

## Overview

This document provides a technical overview of the release and deployment architecture for Dculus Forms, a monorepo project with multiple frontend applications and a backend API.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Developer Workflow                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Code Changes → Commit → Push to main                          │
│  2. Create version tag: git tag v1.2.3                            │
│  3. Push tag: git push origin v1.2.3                              │
│                                                                     │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Release Pipeline Triggered                       │
│                 (.github/workflows/release.yml)                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [1] Validate Version Tag (semver format check)                    │
│  [2] Security Scan (TruffleHog)                                    │
│  [3] Build Shared Packages (@dculus/types, utils, ui)             │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────┐     │
│  │  Parallel Build Jobs                                     │     │
│  ├──────────────────────────────────────────────────────────┤     │
│  │  • Build form-app → dist/                               │     │
│  │  • Build form-viewer → dist/                            │     │
│  │  • Build admin-app → dist/                              │     │
│  │  • Build & Push Docker (backend)                         │     │
│  │    - Multi-platform (linux/amd64, linux/arm64)          │     │
│  │    - Tags: 1.2.3, 1.2, 1, latest                        │     │
│  └──────────────────────────────────────────────────────────┘     │
│                                                                     │
│  [4] Package Artifacts                                             │
│      • form-app-v1.2.3.zip                                         │
│      • form-viewer-v1.2.3.zip                                      │
│      • admin-app-v1.2.3.zip                                        │
│      • checksums.txt (SHA256)                                      │
│      • deployment-manifest.json                                    │
│                                                                     │
│  [5] Generate Changelog (from git commits)                         │
│                                                                     │
│  [6] Create GitHub Release                                         │
│      • Tag: v1.2.3                                                 │
│      • Artifacts attached                                          │
│      • Changelog included                                          │
│      • Docker pull commands                                        │
│                                                                     │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  Deployment Pipeline Triggered                      │
│                 (.github/workflows/build.yml)                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [1] Detect Trigger Type                                           │
│      ┌─────────────────┬─────────────────────────────────┐        │
│      │ Tag (v1.2.3)   │ Branch (main/release)          │        │
│      │ → Use Release  │ → Build from Source            │        │
│      │   Artifacts    │                                 │        │
│      └─────────────────┴─────────────────────────────────┘        │
│                                                                     │
│  [2] For Tagged Releases:                                          │
│      • Download artifacts from GitHub Release                      │
│      • Extract zip files to dist directories                       │
│      • Validate checksums                                          │
│                                                                     │
│  [3] For Branch Builds:                                            │
│      • Build shared packages                                       │
│      • Build each app from source                                  │
│                                                                     │
│  [4] Deploy Frontend Apps (Cloudflare Pages)                       │
│      ┌───────────────────────────────────────────────┐            │
│      │ Wrangler CLI Deployment                      │            │
│      ├───────────────────────────────────────────────┤            │
│      │ • form-app → dculus-forms-app                │            │
│      │ • form-viewer → dculus-forms-viewer-app      │            │
│      │ • admin-app → dculus-forms-admin-app         │            │
│      │                                               │            │
│      │ Branch Strategy:                             │            │
│      │ - Tags: branch=v1.2.3                        │            │
│      │ - Main: branch=main                          │            │
│      │ - Release: branch=release                    │            │
│      └───────────────────────────────────────────────┘            │
│                                                                     │
│  [5] Deploy Backend (Azure Container Apps)                         │
│      ┌───────────────────────────────────────────────┐            │
│      │ Terraform Infrastructure as Code             │            │
│      ├───────────────────────────────────────────────┤            │
│      │ • Update container image to v1.2.3           │            │
│      │ • Apply Terraform changes                     │            │
│      │ • Wait for container startup                  │            │
│      │ • Run health checks                           │            │
│      │ • Verify GraphQL endpoint                     │            │
│      └───────────────────────────────────────────────┘            │
│                                                                     │
│  [6] Deployment Summary                                            │
│      • GitHub Step Summary with URLs                               │
│      • Deployment status for each app                              │
│                                                                     │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Production Environment                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Frontend (Cloudflare Pages):                                      │
│  • https://dculus-forms-app.pages.dev                              │
│  • https://dculus-forms-viewer-app.pages.dev                       │
│  • https://dculus-forms-admin-app.pages.dev                        │
│                                                                     │
│  Backend (Azure Container Apps):                                   │
│  • https://dculus-forms-backend.reddune-e5ba9473.eastus            │
│    .azurecontainerapps.io                                          │
│                                                                     │
│  Docker Registry (Docker Hub):                                     │
│  • docker.io/dculus/forms-backend:1.2.3                            │
│  • docker.io/dculus/forms-backend:latest                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Two-Pipeline Architecture

### Why Two Pipelines?

The architecture separates **release creation** from **deployment** for several key benefits:

1. **Immutability**: Release artifacts are built once and never change
2. **Reusability**: Same artifacts can be deployed to multiple environments
3. **Auditability**: Clear record of what was released and when
4. **Rollback capability**: Easy to redeploy previous releases
5. **Separation of concerns**: Building vs deploying are distinct operations

### Pipeline 1: Release Pipeline

**Purpose**: Create immutable, versioned release artifacts

**Trigger**: Git tags matching `v*` (e.g., `v1.2.3`)

**Responsibilities**:
- Validate version format
- Build all applications
- Create zip archives
- Generate checksums
- Build and push Docker images
- Create GitHub Release
- Generate changelog

**Outputs**:
- GitHub Release with downloadable artifacts
- Docker images with semantic version tags
- Deployment manifest with metadata

**Key Characteristics**:
- Runs only for version tags
- Creates immutable artifacts
- No deployment to production
- Full build from source

### Pipeline 2: Deployment Pipeline

**Purpose**: Deploy applications to production infrastructure

**Triggers**:
- Git tags `v*` (release deployment)
- Push to `main` or `release` branches (direct deployment)
- Pull requests (build and test only)

**Responsibilities**:
- Download release artifacts OR build from source
- Deploy to Cloudflare Pages
- Deploy to Azure Container Apps
- Run health checks
- Generate deployment reports

**Deployment Modes**:

**Mode 1: Release Deployment** (from tags)
```yaml
if: startsWith(github.ref, 'refs/tags/v')
```
- Downloads pre-built artifacts from GitHub Release
- Extracts and deploys to infrastructure
- Uses version tag as branch name in Cloudflare
- Fastest deployment (no build time)

**Mode 2: Branch Deployment** (from main/release)
```yaml
if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/release'
```
- Builds applications from source
- Deploys to infrastructure
- Uses git branch name in Cloudflare
- Useful for hotfixes and continuous deployment

**Mode 3: PR Validation** (pull requests)
```yaml
if: github.event_name == 'pull_request'
```
- Builds and tests only
- No deployment
- Validates changes before merge

## Artifact Strategy

### Artifact Types

1. **Frontend Artifacts** (Zip files)
   - `form-app-v1.2.3.zip` - Form builder application
   - `form-viewer-v1.2.3.zip` - Form viewer application
   - `admin-app-v1.2.3.zip` - Admin dashboard

2. **Backend Artifact** (Docker image)
   - `docker.io/dculus/forms-backend:1.2.3`
   - Multi-platform: `linux/amd64`, `linux/arm64`

3. **Metadata Artifacts**
   - `deployment-manifest.json` - Deployment metadata
   - `checksums.txt` - SHA256 checksums for verification

### Artifact Structure

**Frontend Zip Structure**:
```
form-app-v1.2.3.zip
└── form-app/
    ├── index.html
    ├── assets/
    │   ├── index-[hash].js
    │   └── index-[hash].css
    └── ...
```

**Deployment Manifest**:
```json
{
  "version": "1.2.3",
  "releaseTag": "v1.2.3",
  "createdAt": "2025-01-09T10:30:00Z",
  "commitSha": "abc123...",
  "artifacts": {
    "formApp": {
      "filename": "form-app-v1.2.3.zip",
      "checksum": "sha256:abc123...",
      "cloudflareProject": "dculus-forms-app"
    }
  },
  "docker": {
    "registry": "docker.io",
    "image": "dculus/forms-backend",
    "tags": ["1.2.3", "1.2", "1", "latest"]
  }
}
```

## Deployment Targets

### Frontend: Cloudflare Pages

**Technology**: Static site hosting with global CDN

**Projects**:
- `dculus-forms-app` - Form builder
- `dculus-forms-viewer-app` - Form submission viewer
- `dculus-forms-admin-app` - Admin dashboard

**Deployment Method**: Wrangler CLI

**Branch Strategy**:
```bash
# Release deployment (creates version-specific URL)
wrangler pages deploy dist --project-name=dculus-forms-app --branch=v1.2.3
# URL: https://v1-2-3.dculus-forms-app.pages.dev

# Main branch deployment
wrangler pages deploy dist --project-name=dculus-forms-app --branch=main
# URL: https://dculus-forms-app.pages.dev (production)
```

**Benefits**:
- Global CDN distribution
- Automatic SSL certificates
- Version-specific URLs for testing
- Zero-downtime deployments
- Instant rollback capability

### Backend: Azure Container Apps

**Technology**: Serverless container hosting

**Infrastructure**: Managed by Terraform

**Configuration**:
- Resource Group: `dculus-forms-rg`
- Container App: `dculus-forms-backend`
- Environment: `dculus-forms-env`
- Scaling: 1-10 replicas (auto-scale)

**Deployment Method**:
```bash
# Terraform updates container image
az containerapp update \
  --name dculus-forms-backend \
  --image docker.io/dculus/forms-backend:1.2.3
```

**Health Checks**:
1. Container startup probe
2. HTTP health endpoint: `/health`
3. GraphQL introspection query
4. 10 retries with 30s intervals

**Benefits**:
- Auto-scaling based on load
- Zero-downtime deployments
- Built-in load balancing
- Managed SSL/TLS
- Container orchestration

## Version Management

### Semantic Versioning

**Format**: `MAJOR.MINOR.PATCH[-PRERELEASE]`

**Examples**:
- `v1.2.3` - Stable release
- `v1.2.3-beta.1` - Beta pre-release
- `v1.2.3-rc.2` - Release candidate
- `v2.0.0` - Major version

**Docker Tags Generated**:
```
For tag v1.2.3:
- docker.io/dculus/forms-backend:1.2.3 (full version)
- docker.io/dculus/forms-backend:1.2   (minor version)
- docker.io/dculus/forms-backend:1     (major version)
- docker.io/dculus/forms-backend:latest (if not pre-release)
```

**Cloudflare Branch Names**:
```
For tag v1.2.3:
- Branch: v1.2.3
- URL: https://v1-2-3.dculus-forms-app.pages.dev
```

### Version Lifecycle

```
Development → Testing → Release → Deployment → Production
    ↓           ↓         ↓          ↓            ↓
  Commits    PR Tests   Git Tag   Artifacts   Live Site
```

## Rollback Mechanisms

### Method 1: Redeploy Previous Release

**Fastest and safest method**

```bash
# Via GitHub UI:
# 1. Go to Actions → Build Pipeline
# 2. Find previous successful deployment (e.g., v1.2.2)
# 3. Click "Re-run jobs"

# Via GitHub CLI:
gh workflow run build.yml --ref v1.2.2
```

### Method 2: Manual Artifact Deployment

**For granular control**

```bash
# Download previous release
gh release download v1.2.2

# Deploy frontend
unzip form-app-v1.2.2.zip
wrangler pages deploy form-app \
  --project-name=dculus-forms-app

# Deploy backend
az containerapp update \
  --name dculus-forms-backend \
  --image docker.io/dculus/forms-backend:1.2.2
```

### Method 3: Hotfix Release

**For critical bugs requiring code changes**

```bash
# Create hotfix branch from last good release
git checkout -b hotfix/1.2.4 v1.2.3

# Apply fix
git commit -m "fix: critical bug"

# Create new release
git tag v1.2.4
git push origin v1.2.4

# Automated release and deployment will proceed
```

## Security Considerations

### Secret Management

**GitHub Secrets Required**:
- `CLOUDFLARE_API_TOKEN` - Cloudflare Pages deployment
- `CLOUDFLARE_ACCOUNT_ID` - Cloudflare account
- `DOCKER_USERNAME` - Docker Hub authentication
- `DOCKER_PASSWORD` - Docker Hub token
- `AZURE_CLIENT_ID` - Azure OIDC authentication
- `AZURE_SUBSCRIPTION_ID` - Azure subscription
- `AZURE_TENANT_ID` - Azure tenant
- `MONGODB_CONNECTION_STRING` - Database connection
- `BETTER_AUTH_SECRET` - Authentication secret
- `S3_ACCESS_KEY`, `S3_SECRET_KEY` - Object storage
- `VITE_*` - Frontend environment variables

### Security Scanning

**TruffleHog Integration**:
- Scans for exposed secrets
- Runs on every release
- Excludes development credentials
- Non-blocking (reports but doesn't fail)

### Access Control

**GitHub Actions Permissions**:
```yaml
permissions:
  contents: write    # Create releases
  packages: write    # Push Docker images
  id-token: write    # Azure OIDC
  deployments: write # Deployment status
```

**Azure OIDC**: Workload identity federation (no static credentials)

## Monitoring & Observability

### Pipeline Monitoring

**GitHub Actions UI**:
- Real-time job status
- Step-by-step logs
- Artifact downloads
- Deployment history

**GitHub Step Summary**:
- Deployment URLs
- Health check results
- Docker image details
- Quick test commands

### Production Monitoring

**Health Checks**:
```bash
# Backend health
curl https://dculus-forms-backend.../health

# GraphQL introspection
curl -X POST https://dculus-forms-backend.../graphql \
  -d '{"query":"{__schema{types{name}}}"}'

# Frontend accessibility
curl -I https://dculus-forms-app.pages.dev
```

**Azure Monitoring**:
- Container App logs
- Metrics and scaling
- Resource utilization
- Application insights

**Cloudflare Analytics**:
- Page views and traffic
- Performance metrics
- CDN cache hit rates
- Geographic distribution

## Cost Optimization

### Build Efficiency

**Caching Strategy**:
- pnpm store cache (dependencies)
- Built packages cache (monorepo artifacts)
- Docker layer cache (container images)

**Parallel Execution**:
- Frontend builds run in parallel
- Independent jobs maximize throughput
- Shared package cache reduces rebuild time

### Infrastructure Costs

**Cloudflare Pages**: Free tier for moderate usage
**Azure Container Apps**: Pay-per-use, scales to zero
**Docker Hub**: Free tier for public images
**GitHub Actions**: Free for public repositories

## Best Practices

### Release Checklist

- [ ] All tests pass locally
- [ ] Documentation updated
- [ ] Breaking changes documented
- [ ] Version follows semver
- [ ] Tag annotation includes summary
- [ ] Monitor pipeline execution
- [ ] Verify deployments in production
- [ ] Check health endpoints
- [ ] Review application logs

### Deployment Checklist

- [ ] Release artifacts created successfully
- [ ] Checksums verified
- [ ] Docker image pushed to registry
- [ ] Frontend deployed to Cloudflare
- [ ] Backend deployed to Azure
- [ ] Health checks pass
- [ ] GraphQL endpoint accessible
- [ ] No errors in application logs
- [ ] Monitoring dashboards normal

## Troubleshooting

### Common Issues

1. **Build failures**: Check pnpm lockfile, node version, TypeScript errors
2. **Artifact download fails**: Verify GitHub Release exists and artifacts attached
3. **Cloudflare deployment fails**: Check API token, account ID, project name
4. **Azure deployment fails**: Verify OIDC credentials, resource group, Terraform state
5. **Health check fails**: Check environment variables, MongoDB connection, container logs

### Debug Commands

```bash
# Check GitHub Release
gh release view v1.2.3 --json assets

# Validate deployment manifest
node .github/scripts/validate-artifacts.js \
  --manifest=deployment-manifest.json \
  --artifactsDir=./artifacts

# Test Docker image locally
docker run -p 4000:4000 \
  -e DATABASE_URL=$MONGODB_CONNECTION_STRING \
  docker.io/dculus/forms-backend:1.2.3

# Check Azure Container App status
az containerapp show \
  --name dculus-forms-backend \
  --resource-group dculus-forms-rg \
  --query properties.runningStatus
```

## Future Enhancements

### Potential Improvements

- [ ] Staging environment deployments
- [ ] Automated performance testing
- [ ] Visual regression testing
- [ ] Deployment approval workflows
- [ ] Canary deployments
- [ ] Blue-green deployments
- [ ] Automated rollback on health check failure
- [ ] Slack/Discord deployment notifications
- [ ] Release notes automation from JIRA/GitHub issues
- [ ] Multi-region deployments

## References

- [Release Process Documentation](./RELEASE_PROCESS.md)
- [GitHub Actions Workflows](./.github/workflows/)
- [Deployment Manifest Generator](./.github/scripts/generate-manifest.js)
- [Artifact Validator](./.github/scripts/validate-artifacts.js)
- [Terraform Infrastructure](./infrastructure/multi-cloud/terraform/azure/)

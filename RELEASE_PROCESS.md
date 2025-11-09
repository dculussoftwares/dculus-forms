# Release Process

This document describes the release and deployment process for the Dculus Forms monorepo.

## Table of Contents

- [Overview](#overview)
- [Release Strategy](#release-strategy)
- [Creating a Release](#creating-a-release)
- [Pipeline Architecture](#pipeline-architecture)
- [Deployment Workflow](#deployment-workflow)
- [Rollback Procedure](#rollback-procedure)
- [Troubleshooting](#troubleshooting)

## Overview

The Dculus Forms project uses a **two-pipeline architecture** for releases and deployments:

1. **Release Pipeline** (`.github/workflows/release.yml`) - Creates immutable release artifacts
2. **Deployment Pipeline** (`.github/workflows/build.yml`) - Deploys applications to production

### Key Features

- ✅ **Semantic versioning** for entire monorepo
- ✅ **Immutable release artifacts** (zip files with checksums)
- ✅ **Auto-generated changelogs** from git commits
- ✅ **GitHub Releases** with downloadable artifacts
- ✅ **Cloudflare Pages** deployment with version tags
- ✅ **Azure Container Apps** backend deployment
- ✅ **Easy rollbacks** by redeploying previous releases

## Release Strategy

### Versioning

This project follows [Semantic Versioning 2.0.0](https://semver.org/):

- **MAJOR.MINOR.PATCH** (e.g., `1.2.3`)
- **Pre-releases**: `1.2.3-beta.1`, `1.2.3-rc.2`, `1.2.3-alpha.1`

**Version Format Rules:**
- All releases use unified version across the entire monorepo
- All frontend apps (form-app, form-viewer, admin-app) share the same version
- Backend Docker image uses the same version tag

**Version Guidelines:**
- **MAJOR**: Breaking API changes, major feature overhauls
- **MINOR**: New features, backwards-compatible changes
- **PATCH**: Bug fixes, minor improvements
- **Pre-release**: Beta, release candidate, alpha versions

### Release Triggers

Releases are triggered exclusively by **git tags**:

```bash
# Create and push a version tag
git tag v1.2.3
git push origin v1.2.3
```

This will automatically:
1. Trigger the release pipeline
2. Build all applications
3. Create GitHub Release with artifacts
4. Deploy to production

## Creating a Release

### Step-by-Step Process

#### 1. Prepare the Release

```bash
# Ensure you're on the main branch
git checkout main
git pull origin main

# Verify all tests pass
pnpm test:integration

# Build locally to verify
pnpm build
```

#### 2. Update Version (Optional)

The version in `package.json` is informational. The actual release version comes from the git tag.

```bash
# Update version in package.json (optional)
npm version 1.2.3 --no-git-tag-version

# Commit version bump
git add package.json
git commit -m "chore: bump version to 1.2.3"
git push origin main
```

#### 3. Create and Push Tag

```bash
# Create annotated tag with message
git tag -a v1.2.3 -m "Release v1.2.3"

# Or lightweight tag
git tag v1.2.3

# Push tag to trigger release
git push origin v1.2.3
```

#### 4. Monitor Release Pipeline

1. Go to **Actions** tab on GitHub
2. Watch the **Release** workflow
3. Verify all jobs complete successfully:
   - ✅ Validate version tag
   - ✅ Security scan
   - ✅ Build shared packages
   - ✅ Build form-app, form-viewer, admin-app
   - ✅ Build and push Docker image
   - ✅ Create release artifacts
   - ✅ Create GitHub Release

#### 5. Verify GitHub Release

1. Go to **Releases** page
2. Confirm new release is created with version tag
3. Verify artifacts are attached:
   - `form-app-v1.2.3.zip`
   - `form-viewer-v1.2.3.zip`
   - `admin-app-v1.2.3.zip`
   - `deployment-manifest.json`
   - `checksums.txt`

#### 6. Monitor Deployment

The deployment pipeline runs automatically after release creation:

1. Watch **Build Pipeline** workflow
2. Verify deployments:
   - ✅ Form App to Cloudflare Pages
   - ✅ Form Viewer to Cloudflare Pages
   - ✅ Admin App to Cloudflare Pages
   - ✅ Backend to Azure Container Apps

#### 7. Verify Production

```bash
# Test form-app
curl -I https://dculus-forms-app.pages.dev

# Test form-viewer
curl -I https://dculus-forms-viewer-app.pages.dev

# Test admin-app
curl -I https://dculus-forms-admin-app.pages.dev

# Test backend health
curl https://dculus-forms-backend.reddune-e5ba9473.eastus.azurecontainerapps.io/health

# Test GraphQL endpoint
curl -X POST https://dculus-forms-backend.reddune-e5ba9473.eastus.azurecontainerapps.io/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{__schema{types{name}}}"}'
```

### Pre-Release Process

For beta, RC, or alpha releases:

```bash
# Create pre-release tag
git tag v1.2.3-beta.1
git push origin v1.2.3-beta.1
```

Pre-releases are automatically marked as such on GitHub and won't update the `latest` Docker tag.

## Pipeline Architecture

### Release Pipeline (`.github/workflows/release.yml`)

**Trigger:** Git tags matching `v*` pattern

**Jobs:**
1. **validate-version** - Validates semver format
2. **security-scan** - TruffleHog secret scanning
3. **build-shared-packages** - Builds @dculus/* packages
4. **build-form-app** - Builds form builder application
5. **build-form-viewer** - Builds form viewer application
6. **build-admin-app** - Builds admin dashboard
7. **build-and-push-docker** - Multi-platform Docker build
8. **create-release-artifacts** - Packages zips with checksums
9. **create-github-release** - Creates GitHub Release with changelog
10. **trigger-deployment** - Signals deployment workflow

**Outputs:**
- GitHub Release with version tag
- Downloadable zip artifacts
- Docker image: `docker.io/dculus/forms-backend:1.2.3`
- Deployment manifest with metadata

### Deployment Pipeline (`.github/workflows/build.yml`)

**Triggers:**
- Push to `main`, `release` branches
- Git tags `v*`
- Pull requests to `main`

**Behavior:**

**For tagged releases (`v*`):**
- Download artifacts from GitHub Release
- Extract to deployment directories
- Deploy to Cloudflare Pages with version-tagged branch
- Deploy Docker image to Azure Container Apps

**For branch pushes (main/release):**
- Build applications from source
- Deploy to Cloudflare Pages with branch name
- Deploy backend to Azure (if main/release)

**For pull requests:**
- Build and test only
- No deployment

## Deployment Workflow

### Frontend Applications (Cloudflare Pages)

**Projects:**
- `dculus-forms-app` - Form builder
- `dculus-forms-viewer-app` - Form viewer
- `dculus-forms-admin-app` - Admin dashboard

**Deployment Process:**

1. **Release Deployments** (from tags):
   ```bash
   # Wrangler deploys with version branch
   wrangler pages deploy apps/form-app/dist \
     --project-name=dculus-forms-app \
     --branch=v1.2.3
   ```

2. **Branch Deployments** (from main/release):
   ```bash
   # Wrangler deploys with git branch
   wrangler pages deploy apps/form-app/dist \
     --project-name=dculus-forms-app
   ```

**Access URLs:**
- **Production**: `https://dculus-forms-app.pages.dev`
- **Version**: `https://v1-2-3.dculus-forms-app.pages.dev`
- **Branch**: `https://main.dculus-forms-app.pages.dev`

### Backend Application (Azure Container Apps)

**Deployment:**
- Uses Terraform for infrastructure as code
- Multi-platform Docker image (amd64, arm64)
- Auto-scaling: 1-10 replicas
- Health checks and readiness probes

**Docker Images:**
```bash
# Latest release
docker pull docker.io/dculus/forms-backend:latest

# Specific version
docker pull docker.io/dculus/forms-backend:1.2.3

# Semver tags
docker pull docker.io/dculus/forms-backend:1.2
docker pull docker.io/dculus/forms-backend:1
```

## Rollback Procedure

### Option 1: Redeploy Previous Release

The easiest rollback method is to redeploy a previous release:

```bash
# Find previous release
gh release list

# Re-run deployment workflow for that release
# Go to Actions → Build Pipeline → Re-run jobs for v1.2.2 tag
```

### Option 2: Manual Rollback

#### Frontend Rollback (Cloudflare Pages)

```bash
# Download previous release artifacts
gh release download v1.2.2 \
  --pattern "form-app-v1.2.2.zip" \
  --dir /tmp/rollback

# Extract
unzip /tmp/rollback/form-app-v1.2.2.zip -d /tmp/extracted

# Deploy with wrangler
wrangler pages deploy /tmp/extracted/form-app \
  --project-name=dculus-forms-app \
  --branch=v1.2.2
```

#### Backend Rollback (Azure Container Apps)

```bash
# Update container app to use previous image version
az containerapp update \
  --name dculus-forms-backend \
  --resource-group dculus-forms-rg \
  --image docker.io/dculus/forms-backend:1.2.2
```

### Option 3: Create Hotfix Release

For critical bugs requiring immediate fix:

```bash
# Create hotfix branch from previous tag
git checkout -b hotfix/1.2.3 v1.2.2

# Make fix
git add .
git commit -m "fix: critical bug in form submission"

# Create new patch release
git tag v1.2.3
git push origin v1.2.3
```

## Troubleshooting

### Release Pipeline Failures

#### Issue: Version tag validation fails

**Symptom:** `Invalid version tag format` error

**Solution:**
```bash
# Ensure tag follows semver: vMAJOR.MINOR.PATCH
git tag -d v1.2.3-wrong  # Delete incorrect tag
git tag v1.2.3            # Create correct tag
git push origin v1.2.3
```

#### Issue: Build failures

**Symptom:** Build job fails during compilation

**Solution:**
```bash
# Test build locally first
pnpm install --frozen-lockfile
pnpm build

# Check for type errors
pnpm type-check

# Fix issues and push
git add .
git commit -m "fix: resolve build errors"
git push origin main

# Delete and recreate tag
git tag -d v1.2.3
git push origin :refs/tags/v1.2.3
git tag v1.2.3
git push origin v1.2.3
```

#### Issue: Docker build fails

**Symptom:** Multi-platform Docker build fails

**Solution:**
- Check Dockerfile syntax
- Verify base image availability
- Check Docker Hub credentials in secrets
- Review build logs for specific errors

### Deployment Pipeline Failures

#### Issue: Artifact not found

**Symptom:** `Error: Artifact not found` when downloading from release

**Solution:**
```bash
# Verify release exists
gh release view v1.2.3

# Check artifact is attached
gh release view v1.2.3 --json assets

# If missing, re-run release workflow
```

#### Issue: Cloudflare Pages deployment fails

**Symptom:** Wrangler deploy fails

**Solution:**
- Verify `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets
- Check Cloudflare Pages project exists
- Verify token has correct permissions
- Check wrangler version compatibility

#### Issue: Azure Container Apps deployment fails

**Symptom:** Terraform apply fails or container doesn't start

**Solution:**
```bash
# Check Azure credentials
az account show

# Verify resource group exists
az group show --name dculus-forms-rg

# Check container logs
az containerapp logs show \
  --name dculus-forms-backend \
  --resource-group dculus-forms-rg
```

### Verification Issues

#### Issue: Health check fails

**Symptom:** Backend health endpoint returns 500 or timeout

**Solution:**
```bash
# Check container status
az containerapp show \
  --name dculus-forms-backend \
  --resource-group dculus-forms-rg \
  --query "properties.runningStatus"

# View logs
az containerapp logs show \
  --name dculus-forms-backend \
  --resource-group dculus-forms-rg \
  --follow

# Common issues:
# - Missing environment variables
# - MongoDB connection failure
# - Port configuration mismatch
```

#### Issue: Frontend shows blank page

**Symptom:** Cloudflare Pages deployment succeeds but shows blank page

**Solution:**
- Check browser console for errors
- Verify environment variables are set correctly:
  - `VITE_API_URL`
  - `VITE_GRAPHQL_URL`
  - `VITE_CDN_ENDPOINT`
  - `VITE_PIXABAY_API_KEY`
- Ensure backend is accessible from frontend
- Check CORS configuration

## Deployment Manifest

Each release includes a `deployment-manifest.json` file with metadata:

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
    },
    ...
  },
  "docker": {
    "registry": "docker.io",
    "image": "dculus/forms-backend",
    "tags": ["1.2.3", "1.2", "1", "latest"]
  },
  "deployments": {
    "production": {
      "formApp": "https://dculus-forms-app.pages.dev",
      ...
    }
  }
}
```

**Usage:**
- Verify artifact integrity with checksums
- Track which version is deployed
- Audit deployment history
- Automate deployment processes

## Best Practices

### Before Release

- ✅ Run all tests locally: `pnpm test:integration`
- ✅ Build locally to catch errors: `pnpm build`
- ✅ Review recent commits and changes
- ✅ Update documentation if needed
- ✅ Test in staging environment (if available)

### Version Numbering

- Use **PATCH** for bug fixes (1.2.3 → 1.2.4)
- Use **MINOR** for new features (1.2.3 → 1.3.0)
- Use **MAJOR** for breaking changes (1.2.3 → 2.0.0)
- Use **pre-release** for testing (1.2.3-beta.1)

### Git Tag Management

```bash
# List all tags
git tag -l

# Delete local tag
git tag -d v1.2.3

# Delete remote tag
git push origin :refs/tags/v1.2.3

# Create annotated tag (recommended)
git tag -a v1.2.3 -m "Release v1.2.3: Form validation improvements"
```

### Monitoring After Release

- Monitor application logs for errors
- Check user reports and feedback
- Verify analytics and metrics
- Monitor performance and response times
- Keep eye on error tracking (if configured)

## Emergency Procedures

### Critical Bug in Production

1. **Immediate rollback** to previous version:
   ```bash
   # Redeploy previous release
   # Via GitHub Actions UI or CLI
   ```

2. **Create hotfix**:
   ```bash
   git checkout -b hotfix/v1.2.4 v1.2.3
   # Make fix
   git tag v1.2.4
   git push origin v1.2.4
   ```

3. **Communicate**:
   - Notify team of issue and fix
   - Update status page (if available)
   - Document incident for postmortem

### Complete System Failure

1. Check Azure Container Apps status
2. Verify Cloudflare Pages is operational
3. Check MongoDB connection
4. Review application logs
5. Contact infrastructure team if needed

## Additional Resources

- [Semantic Versioning](https://semver.org/)
- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Azure Container Apps Documentation](https://learn.microsoft.com/en-us/azure/container-apps/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Documentation](https://docs.docker.com/)
- [Terraform Documentation](https://www.terraform.io/docs)

## Support

For questions or issues:
- Create an issue on GitHub
- Contact the development team
- Review workflow logs in GitHub Actions
- Check Azure Portal for infrastructure issues

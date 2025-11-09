# Release Quick Reference

Quick commands and workflows for creating releases and managing deployments.

## 🚀 Creating a Release

### 1. Standard Release

```bash
# Ensure you're on main and up to date
git checkout main
git pull origin main

# Create and push version tag
git tag v1.2.3
git push origin v1.2.3

# That's it! GitHub Actions handles the rest.
```

### 2. Pre-Release (Beta/RC)

```bash
# Create pre-release tag
git tag v1.2.3-beta.1
git push origin v1.2.3-beta.1

# GitHub will mark it as pre-release automatically
```

### 3. Hotfix Release

```bash
# Create hotfix branch from last release
git checkout -b hotfix/1.2.4 v1.2.3

# Make fixes
git add .
git commit -m "fix: critical bug in form submission"

# Merge to main
git checkout main
git merge hotfix/1.2.4
git push origin main

# Create new release
git tag v1.2.4
git push origin v1.2.4
```

## 📦 Version Numbering

```
v1.2.3
│ │ │
│ │ └─ PATCH: Bug fixes, minor changes (1.2.3 → 1.2.4)
│ └─── MINOR: New features, backwards compatible (1.2.3 → 1.3.0)
└───── MAJOR: Breaking changes (1.2.3 → 2.0.0)

Pre-release examples:
v1.2.3-beta.1    # Beta release
v1.2.3-rc.2      # Release candidate
v1.2.3-alpha.1   # Alpha release
```

## 🔄 Rollback Procedures

### Method 1: Redeploy Previous Release (Fastest)

```bash
# Via GitHub UI:
# Actions → Build Pipeline → Find v1.2.2 run → Re-run jobs

# Via CLI:
gh workflow run build.yml --ref v1.2.2
```

### Method 2: Manual Rollback

**Frontend:**
```bash
# Download previous release
gh release download v1.2.2 --pattern "form-app-v1.2.2.zip"

# Extract
unzip form-app-v1.2.2.zip -d /tmp/rollback

# Deploy
wrangler pages deploy /tmp/rollback/form-app \
  --project-name=dculus-forms-app
```

**Backend:**
```bash
# Update to previous version
az containerapp update \
  --name dculus-forms-backend \
  --resource-group dculus-forms-rg \
  --image docker.io/dculus/forms-backend:1.2.2
```

## 🔍 Verification Commands

### Production Health Checks

```bash
# Backend health
curl https://dculus-forms-backend.reddune-e5ba9473.eastus.azurecontainerapps.io/health

# GraphQL endpoint
curl -X POST https://dculus-forms-backend.reddune-e5ba9473.eastus.azurecontainerapps.io/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{__schema{types{name}}}"}'

# Frontend apps
curl -I https://dculus-forms-app.pages.dev
curl -I https://dculus-forms-viewer-app.pages.dev
curl -I https://dculus-forms-admin-app.pages.dev
```

### Check Release Status

```bash
# View latest release
gh release view

# View specific release
gh release view v1.2.3

# List all releases
gh release list

# Check artifacts in release
gh release view v1.2.3 --json assets

# Download and inspect artifacts (build output only)
gh release download v1.2.3 --pattern "form-app-v1.2.3.zip"
unzip -l form-app-v1.2.3.zip
# You'll see: index.html, assets/*.js, assets/*.css (NO source code)
```

### Check Deployment Status

```bash
# Azure Container App status
az containerapp show \
  --name dculus-forms-backend \
  --resource-group dculus-forms-rg \
  --query properties.runningStatus

# View container logs
az containerapp logs show \
  --name dculus-forms-backend \
  --resource-group dculus-forms-rg \
  --follow

# Check which version is deployed
az containerapp show \
  --name dculus-forms-backend \
  --resource-group dculus-forms-rg \
  --query properties.template.containers[0].image
```

## 📊 Monitoring Commands

### GitHub Actions

```bash
# List recent workflow runs
gh run list --workflow=release.yml

# View specific run
gh run view <run-id>

# Watch current run
gh run watch
```

### Docker Images

```bash
# List tags for backend image
curl -s https://hub.docker.com/v2/repositories/dculus/forms-backend/tags/ | jq

# Pull specific version
docker pull docker.io/dculus/forms-backend:1.2.3

# Run locally
docker run -p 4000:4000 \
  -e DATABASE_URL=$MONGODB_CONNECTION_STRING \
  -e BETTER_AUTH_SECRET=$BETTER_AUTH_SECRET \
  docker.io/dculus/forms-backend:1.2.3
```

## 🏷️ Git Tag Management

```bash
# List all tags
git tag -l

# Show tag details
git show v1.2.3

# Delete local tag
git tag -d v1.2.3

# Delete remote tag
git push origin :refs/tags/v1.2.3

# Create annotated tag with message
git tag -a v1.2.3 -m "Release v1.2.3: Bug fixes and improvements"

# Push specific tag
git push origin v1.2.3

# Push all tags
git push origin --tags
```

## 🐛 Troubleshooting

### Build Failures

```bash
# Test build locally
pnpm install --frozen-lockfile
pnpm build

# Type check
pnpm type-check

# Run tests
pnpm test:integration

# If tag was pushed with errors, delete and recreate:
git tag -d v1.2.3
git push origin :refs/tags/v1.2.3
# Fix issues, then:
git tag v1.2.3
git push origin v1.2.3
```

### Artifact Download Failures

```bash
# Verify release exists
gh release view v1.2.3

# Check if artifacts are attached
gh release view v1.2.3 --json assets --jq '.assets[].name'

# Manually download artifact
gh release download v1.2.3 --pattern "*.zip"

# Validate manifest
node .github/scripts/validate-artifacts.js \
  --manifest=deployment-manifest.json \
  --artifactsDir=./artifacts
```

### Deployment Failures

**Cloudflare Issues:**
```bash
# Test wrangler authentication
wrangler whoami

# List Cloudflare projects
wrangler pages project list

# Deploy manually
cd apps/form-app
pnpm build
wrangler pages deploy dist --project-name=dculus-forms-app
```

**Azure Issues:**
```bash
# Check authentication
az account show

# Verify resource group exists
az group show --name dculus-forms-rg

# Check container app exists
az containerapp list --resource-group dculus-forms-rg

# View recent revisions
az containerapp revision list \
  --name dculus-forms-backend \
  --resource-group dculus-forms-rg
```

## 📋 Pre-Release Checklist

Before creating a release:

- [ ] All tests pass: `pnpm test:integration`
- [ ] Local build succeeds: `pnpm build`
- [ ] Type checking passes: `pnpm type-check`
- [ ] Code reviewed and merged to main
- [ ] Breaking changes documented
- [ ] Version number follows semver
- [ ] CHANGELOG updated (if maintained)

## 🔐 Required Secrets

Verify these secrets are configured in GitHub:

```bash
# Check GitHub secrets (requires admin access)
gh secret list

# Required secrets:
# - CLOUDFLARE_API_TOKEN
# - CLOUDFLARE_ACCOUNT_ID
# - DOCKER_USERNAME
# - DOCKER_PASSWORD
# - AZURE_CLIENT_ID
# - AZURE_SUBSCRIPTION_ID
# - AZURE_TENANT_ID
# - MONGODB_CONNECTION_STRING
# - BETTER_AUTH_SECRET
# - S3_ACCESS_KEY
# - S3_SECRET_KEY
# - S3_ENDPOINT
# - S3_PRIVATE_BUCKET_NAME
# - S3_PUBLIC_BUCKET_NAME
# - CORS_ORIGINS
# - VITE_CDN_ENDPOINT
# - VITE_PIXABAY_API_KEY
```

## 📚 Production URLs

### Frontend Applications
- **Form Builder**: https://dculus-forms-app.pages.dev
- **Form Viewer**: https://dculus-forms-viewer-app.pages.dev
- **Admin Dashboard**: https://dculus-forms-admin-app.pages.dev

### Backend API
- **API Base**: https://dculus-forms-backend.reddune-e5ba9473.eastus.azurecontainerapps.io
- **GraphQL**: https://dculus-forms-backend.reddune-e5ba9473.eastus.azurecontainerapps.io/graphql
- **Health**: https://dculus-forms-backend.reddune-e5ba9473.eastus.azurecontainerapps.io/health

### Version-Specific URLs (Cloudflare)
Replace dots with hyphens in version:
- `v1.2.3` → https://v1-2-3.dculus-forms-app.pages.dev

## 🆘 Emergency Contacts

If automated processes fail:

1. **Check GitHub Actions**: https://github.com/your-org/dculus-forms/actions
2. **Review Workflow Logs**: Click on failed job for details
3. **Azure Portal**: https://portal.azure.com
4. **Cloudflare Dashboard**: https://dash.cloudflare.com
5. **Docker Hub**: https://hub.docker.com/r/dculus/forms-backend

## 📖 Full Documentation

For detailed information, see:
- [Release Process](./RELEASE_PROCESS.md) - Complete release guide
- [Release Architecture](./RELEASE_ARCHITECTURE.md) - Technical architecture
- [CLAUDE.md](./CLAUDE.md) - Development guide

## 💡 Tips & Tricks

### Fastest Release Process
```bash
# One-liner for standard release
git tag v1.2.3 && git push origin v1.2.3
```

### Check What Changed Since Last Release
```bash
# Compare with previous tag
git log v1.2.2..v1.2.3 --oneline

# Detailed diff
git diff v1.2.2..v1.2.3
```

### Test Release Locally
```bash
# Simulate release build
.github/scripts/generate-manifest.js \
  --version=1.2.3 \
  --tag=v1.2.3 \
  --commitSha=$(git rev-parse HEAD) \
  --artifactsDir=./dist \
  --output=manifest.json

# Validate artifacts
.github/scripts/validate-artifacts.js \
  --manifest=manifest.json \
  --artifactsDir=./dist
```

### Monitor Release in Real-Time
```bash
# Watch release workflow
gh run watch

# Follow with notifications
gh run watch --exit-status && \
  echo "✅ Release complete!" || \
  echo "❌ Release failed!"
```

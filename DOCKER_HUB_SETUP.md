# Docker Hub Setup Guide

This guide walks you through setting up automated Docker Hub publishing for the Dculus Forms backend via GitHub Actions.

## 🐳 Docker Hub Repository Setup

### 1. Create Docker Hub Repository

1. Log in to [Docker Hub](https://hub.docker.com/)
2. Click **"Create Repository"**
3. Set **Repository Name**: `forms-backend`
4. Set **Namespace**: `dculus` (your Docker Hub username/organization)
5. **Visibility**: Choose Public or Private
6. **Description**: `Express.js + GraphQL backend for Dculus Forms with MongoDB and collaborative editing`
7. Click **"Create"**

Your repository will be: `dculus/forms-backend`

### 2. Generate Docker Hub Access Token

1. Go to [Docker Hub Account Settings](https://hub.docker.com/settings/security)
2. Click **"New Access Token"**
3. **Access Token Description**: `GitHub Actions - Dculus Forms`
4. **Permissions**: `Read, Write, Delete`
5. Click **"Generate"**
6. **Copy the token** (you won't see it again!)

## 🔐 GitHub Repository Secrets Setup

### Required Secrets

Add these secrets to your GitHub repository:

1. Go to your GitHub repository
2. Navigate to **Settings > Secrets and variables > Actions**
3. Click **"New repository secret"** for each:

| Secret Name | Value | Description |
|-------------|-------|-------------|
| `DOCKER_USERNAME` | `dculus` | Your Docker Hub username/organization |
| `DOCKER_PASSWORD` | `dckr_pat_xxxxx...` | Your Docker Hub access token |

### How to Add Secrets

```bash
# Navigate to: https://github.com/your-username/dculus-forms/settings/secrets/actions
# Click "New repository secret" and add:

Name: DOCKER_USERNAME
Secret: dculus

Name: DOCKER_PASSWORD  
Secret: dckr_pat_xxxxxxxxxxxxxxxxxxxxx
```

## 🚀 Workflow Configuration

The GitHub Actions workflow is already configured in `.github/workflows/docker-publish.yml`. It will:

### Trigger Conditions

- ✅ **Push to main branch** with changes to:
  - `apps/backend/**`
  - `packages/**` 
  - `pnpm-lock.yaml`
  - Workflow file itself

- ✅ **Pull requests** to main (builds but doesn't push)

- ✅ **Manual workflow dispatch** with custom tag option

### Multi-Architecture Support

The workflow builds for:
- `linux/amd64` (Intel/AMD 64-bit)
- `linux/arm64` (Apple Silicon, ARM servers)

### Image Tags

| Trigger | Tag |
|---------|-----|
| Push to main | `latest` |
| Push to main | `main-{sha}` |
| Pull request | `pr-{number}` |
| Manual dispatch | Custom tag or `latest` |

## 📦 Using the Published Image

### Pull from Docker Hub

```bash
# Pull latest version
docker pull dculus/forms-backend:latest

# Pull specific version
docker pull dculus/forms-backend:main-abc1234
```

### Run the Container

```bash
docker run -d \
  --name dculus-backend \
  -p 4000:4000 \
  -e DATABASE_URL="mongodb://localhost:27017/dculus_forms?replicaSet=rs0" \
  -e JWT_SECRET="your-super-secret-jwt-key-32-chars-minimum" \
  -e BETTER_AUTH_SECRET="your-super-secret-auth-key-32-chars-minimum" \
  -e NODE_ENV="production" \
  dculus/forms-backend:latest
```

### Docker Compose

The workflow generates a production-ready `docker-compose.production.yml`:

```yaml
version: '3.8'

services:
  backend:
    image: dculus/forms-backend:latest
    ports:
      - "4000:4000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
      - BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}
      # ... other environment variables
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:4000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => { process.exit(1) })"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

## 🔍 Monitoring the Build

### GitHub Actions

1. Go to **Actions** tab in your repository
2. Look for **"Build and Push Backend to Docker Hub"** workflow
3. Click on a run to see detailed logs

### Docker Hub

1. Go to your [Docker Hub repository](https://hub.docker.com/r/dculus/forms-backend)
2. Check the **"Tags"** tab for pushed images
3. View **"Activity"** for push history

## 🛠️ Troubleshooting

### Common Issues

1. **Authentication Failed**
   ```
   Error: buildx failed with: ERROR: failed to solve: failed to push to registry
   ```
   **Solution**: Check `DOCKER_USERNAME` and `DOCKER_PASSWORD` secrets

2. **Image Not Found on Docker Hub**
   ```
   Error: pull access denied for dculus/forms-backend
   ```
   **Solution**: Ensure repository exists and is public, or provide authentication

3. **Build Fails on Dependencies**
   ```
   Error: Cannot find module '@dculus/types'
   ```
   **Solution**: The updated Dockerfile now properly handles workspace dependencies

4. **Multi-architecture Build Issues**
   ```
   Error: failed to solve: failed to build for platform linux/arm64
   ```
   **Solution**: Some dependencies might not support ARM64. Check build logs.

### Debug Commands

```bash
# Test Docker image locally
docker run --rm dculus/forms-backend:latest node --version

# Check image architecture
docker inspect dculus/forms-backend:latest | grep -A 10 Architecture

# Test health check
docker run --rm -p 4000:4000 dculus/forms-backend:latest &
sleep 10 && curl http://localhost:4000/health
```

## 🔧 Manual Build and Push

If you need to build and push manually:

```bash
# From repository root
cd apps/backend

# Build multi-architecture image
docker buildx build --platform linux/amd64,linux/arm64 \
  -t dculus/forms-backend:manual \
  --push \
  -f Dockerfile \
  ../../

# Or build for current platform only
docker build -t dculus/forms-backend:local ../../ -f Dockerfile
docker push dculus/forms-backend:local
```

## 📈 Image Optimization

The Docker image is optimized for:

- ✅ **Multi-stage build** - Smaller final image
- ✅ **Alpine Linux** - Minimal base image
- ✅ **Non-root user** - Security best practices
- ✅ **Layer caching** - Faster builds in CI/CD
- ✅ **Production dependencies only** - Smaller image size
- ✅ **Health checks** - Container monitoring
- ✅ **Multi-architecture** - ARM64 and AMD64 support

## 🔄 Updating the Workflow

To modify the workflow:

1. Edit `.github/workflows/docker-publish.yml`
2. Common changes:
   - **Repository name**: Update `IMAGE_NAME` environment variable
   - **Trigger paths**: Modify `paths` in `on.push` and `on.pull_request`
   - **Platforms**: Add/remove from `platforms` in buildx setup
   - **Tags**: Modify tag strategy in metadata action

## 🏷️ Tagging Strategy

| Branch/Event | Tag Examples |
|--------------|--------------|
| `main` branch | `latest`, `main-abc1234` |
| Feature branch | `feature-new-auth-def5678` |
| Pull request | `pr-42` |
| Release tag `v1.0.0` | `v1.0.0`, `1.0.0`, `1.0`, `1` |
| Manual dispatch | Custom tag or `latest` |

## 🚀 Next Steps

1. **Set up secrets** in your GitHub repository
2. **Create Docker Hub repository** `dculus/forms-backend`
3. **Push changes** to main branch to trigger first build
4. **Monitor the workflow** in GitHub Actions
5. **Test the published image** with docker pull
6. **Set up deployment** using the published image

---

**Need help?** Check the [Docker Hub documentation](https://docs.docker.com/docker-hub/) or [GitHub Actions documentation](https://docs.github.com/en/actions).
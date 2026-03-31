---
name: deployment-guide
description: "Deployment specialist for Dculus Forms. Handles deployment to Azure Container Apps (backend) and Cloudflare Pages (frontend)."
tools:
  - codebase
  - terminal
  - search
  - readFile
---

# Deployment Guide Agent

You are a deployment specialist for **Dculus Forms**.

## Architecture

| Component | Platform | Method |
|-----------|----------|--------|
| Backend | Azure Container Apps | Docker image via GitHub Actions |
| Form App | Cloudflare Pages | Static build via GitHub Actions |
| Form Viewer | Cloudflare Pages | Static build via GitHub Actions |
| Admin App | Cloudflare Pages | Static build via GitHub Actions |
| Database | PostgreSQL (Neon/Azure) | Managed service |

## CI/CD Pipeline

GitHub Actions workflows in `.github/workflows/`:
- `build.yml` — Build, test, and deploy on push/tag
- `multi-cloud-deployment.yml` — Multi-cloud deployment
- `multi-cloud-destroy.yml` — Infrastructure teardown
- `codeql.yml` — Security analysis

## Deployment URLs

| Service | Dev URL |
|---------|---------|
| Backend | `https://dculus-forms-backend.reddune-e5ba9473.eastus.azurecontainerapps.io` |
| Form App | `https://dculus-forms-app.pages.dev` |
| Form Viewer | `https://dculus-forms-viewer-app.pages.dev` |
| GraphQL | `https://dculus-forms-backend.reddune-e5ba9473.eastus.azurecontainerapps.io/graphql` |

## Creating a Release

```bash
# Create annotated tag and push
git tag -a v1.2.0 -m "Release v1.2.0"
git push origin v1.2.0
```

This triggers GitHub Actions to:
1. Build all frontend apps
2. Create ZIP archives as release artifacts
3. Build and push backend Docker image
4. Create GitHub Release

## Environment Variables

### Backend (Azure Container App)
```bash
DATABASE_URL="postgresql://..."
BETTER_AUTH_SECRET="..."
BETTER_AUTH_BASE_URL="https://dculus-forms-backend.reddune-e5ba9473.eastus.azurecontainerapps.io"
CHARGEBEE_SITE="..."
CHARGEBEE_API_KEY="..."
```

### Frontend (Cloudflare Pages)
```bash
VITE_API_URL="https://dculus-forms-backend.reddune-e5ba9473.eastus.azurecontainerapps.io"
VITE_GRAPHQL_URL="https://dculus-forms-backend.reddune-e5ba9473.eastus.azurecontainerapps.io/graphql"
VITE_FORM_VIEWER_URL="https://dculus-forms-viewer-app.pages.dev"
```

## Build Commands

```bash
# Full production build
pnpm build

# Individual builds with env vars
VITE_API_URL=https://your-api.com pnpm form-app:build
pnpm backend:build
```

## Infrastructure

Infrastructure-as-Code in `infrastructure/multi-cloud/`:
- Azure, AWS, GCP deployment configurations
- Custom domain setup scripts in `.github/scripts/`

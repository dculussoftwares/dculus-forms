---
description: Deployment workflows for all environments
---

# Deployment Workflow

This workflow covers deploying Dculus Forms to various environments.

## Deployment Architecture

### Production Stack
- **Backend**: Azure Container Apps
- **Frontend Apps**: Cloudflare Pages
- **Database**: Azure PostgreSQL
- **File Storage**: Azure Blob Storage

### Environments
- **Development**: Local development
- **Staging**: Pre-production testing
- **Production**: Live environment

## Automated Deployment (CI/CD)

### GitHub Actions Workflow

Deployments are automated via GitHub Actions on:
- **Push to main**: Deploy to staging
- **Git tag (v*)**: Deploy to production

### Create a Release

```bash
# Create and push annotated tag
git tag -a v1.2.0 -m "Release v1.2.0"
git push origin v1.2.0
```

This triggers:
1. Build all applications
2. Run tests
3. Create release artifacts
4. Deploy to production

### Release Artifacts

GitHub Actions creates downloadable artifacts:
- `form-app-build-v{version}.zip`
- `form-viewer-build-v{version}.zip`
- `admin-app-build-v{version}.zip`
- Backend Docker image: `dculus/forms-backend:v{version}`

## Manual Deployment

### Backend Deployment

#### Option 1: Docker (Recommended)

```bash
# Build Docker image
cd apps/backend
docker build -t dculus-forms-backend .

# Run container
docker run -d -p 4000:4000 \
  -e DATABASE_URL='postgresql://...' \
  -e BETTER_AUTH_SECRET='your-secret' \
  -e BETTER_AUTH_URL='https://api.yourdomain.com' \
  dculus-forms-backend
```

#### Option 2: Node.js

```bash
# Build backend
pnpm backend:build

# Set environment variables
export DATABASE_URL='postgresql://...'
export BETTER_AUTH_SECRET='your-secret'
export NODE_ENV='production'

# Start server
cd apps/backend
node dist/index.js
```

### Frontend Deployment

#### Build Applications

```bash
# Form App
VITE_API_URL=https://api.yourdomain.com \
VITE_GRAPHQL_URL=https://api.yourdomain.com/graphql \
VITE_FORM_VIEWER_URL=https://viewer.yourdomain.com \
pnpm form-app:build

# Form Viewer
VITE_API_URL=https://api.yourdomain.com \
VITE_GRAPHQL_URL=https://api.yourdomain.com/graphql \
pnpm form-viewer:build

# Admin App
VITE_API_URL=https://api.yourdomain.com \
VITE_GRAPHQL_URL=https://api.yourdomain.com/graphql \
pnpm admin-app:build
```

Build output is in `apps/[app-name]/dist/`

## Platform-Specific Deployment

### Cloudflare Pages

#### Via Dashboard

1. Go to [Cloudflare Pages](https://pages.cloudflare.com/)
2. Create new project
3. Connect GitHub repository
4. Configure build:
   - **Build command**: `pnpm form-app:build`
   - **Build output**: `apps/form-app/dist`
   - **Root directory**: `/`
5. Add environment variables
6. Deploy

#### Via Wrangler CLI

```bash
# Install Wrangler
npm install -g wrangler

# Login
wrangler login

# Deploy
cd apps/form-app
wrangler pages deploy dist --project-name=dculus-forms-app
```

### Azure Container Apps

#### Deploy Backend

```bash
# Login to Azure
az login

# Create resource group
az group create --name dculus-forms --location eastus

# Create container app
az containerapp create \
  --name dculus-forms-backend \
  --resource-group dculus-forms \
  --image dculus/forms-backend:latest \
  --target-port 4000 \
  --ingress external \
  --env-vars \
    DATABASE_URL='postgresql://...' \
    BETTER_AUTH_SECRET='your-secret'
```

### Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Deploy
cd apps/form-app
netlify deploy --prod --dir=dist
```

### Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
cd apps/form-app
vercel --prod
```

### AWS S3 + CloudFront

```bash
# Build app
pnpm form-app:build

# Upload to S3
aws s3 sync apps/form-app/dist/ s3://your-bucket-name/ \
  --delete \
  --cache-control max-age=31536000,public

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"
```

## Database Migrations

### Production Migration Workflow

```bash
# 1. Backup database
pg_dump -h production-host -U user -d database > backup.sql

# 2. Apply migrations
cd apps/backend
DATABASE_URL='postgresql://production-url' \
npx prisma migrate deploy

# 3. Verify migration
DATABASE_URL='postgresql://production-url' \
npx prisma migrate status
```

### Rollback Strategy

If migration fails:

```bash
# Restore from backup
psql -h production-host -U user -d database < backup.sql

# Mark migration as rolled back
npx prisma migrate resolve --rolled-back "migration_name"
```

## Environment Variables

### Backend (.env)

```bash
# Required
DATABASE_URL="postgresql://..."
BETTER_AUTH_SECRET="..."
BETTER_AUTH_URL="https://api.yourdomain.com"
NODE_ENV="production"

# Optional
CHARGEBEE_SITE="..."
CHARGEBEE_API_KEY="..."
SMTP_HOST="..."
SMTP_PORT="587"
```

### Frontend Apps

**Form App**:
```bash
VITE_API_URL="https://api.yourdomain.com"
VITE_GRAPHQL_URL="https://api.yourdomain.com/graphql"
VITE_FORM_VIEWER_URL="https://viewer.yourdomain.com"
```

**Form Viewer**:
```bash
VITE_API_URL="https://api.yourdomain.com"
VITE_GRAPHQL_URL="https://api.yourdomain.com/graphql"
```

**Admin App**:
```bash
VITE_API_URL="https://api.yourdomain.com"
VITE_GRAPHQL_URL="https://api.yourdomain.com/graphql"
```

## Health Checks

### Backend Health Check

```bash
# Check backend health
curl https://api.yourdomain.com/health

# Expected response
{"status":"ok"}
```

### GraphQL Endpoint

```bash
# Check GraphQL endpoint
curl https://api.yourdomain.com/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __typename }"}'
```

## Monitoring

### Application Logs

```bash
# Azure Container Apps
az containerapp logs show \
  --name dculus-forms-backend \
  --resource-group dculus-forms \
  --follow

# Docker
docker logs -f container-name
```

### Database Monitoring

```bash
# Check active connections
SELECT count(*) FROM pg_stat_activity;

# Check slow queries
SELECT * FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;
```

## Rollback Procedure

### Frontend Rollback

```bash
# Cloudflare Pages: Use dashboard to rollback to previous deployment
# Or redeploy previous version
git checkout v1.1.0
pnpm form-app:build
# Deploy...
```

### Backend Rollback

```bash
# Docker: Deploy previous image
docker pull dculus/forms-backend:v1.1.0
docker stop current-container
docker run -d dculus/forms-backend:v1.1.0 ...

# Database: Restore from backup if needed
psql -h host -U user -d database < backup.sql
```

## Pre-Deployment Checklist

- [ ] All tests passing (`pnpm test:unit`, `pnpm test:integration`)
- [ ] Code reviewed and approved
- [ ] Environment variables configured
- [ ] Database backup created
- [ ] Migration tested in staging
- [ ] Release notes prepared
- [ ] Monitoring alerts configured

## Post-Deployment Checklist

- [ ] Health check passing
- [ ] GraphQL endpoint accessible
- [ ] Frontend apps loading
- [ ] Authentication working
- [ ] Database migrations applied
- [ ] No errors in logs
- [ ] Performance metrics normal

## Troubleshooting

### Build Failures

```bash
# Clear cache and rebuild
pnpm clean
pnpm install
pnpm build
```

### Deployment Failures

```bash
# Check environment variables
# Check build logs
# Verify network connectivity
# Check resource limits
```

### Runtime Errors

```bash
# Check application logs
# Verify database connection
# Check environment variables
# Verify API endpoints
```

## Quick Reference

```bash
# Create release
git tag -a v1.2.0 -m "Release v1.2.0"
git push origin v1.2.0

# Build apps
pnpm build

# Deploy backend (Docker)
docker build -t backend .
docker run -d -p 4000:4000 backend

# Deploy frontend
pnpm form-app:build
# Upload dist/ to hosting provider

# Apply migrations
npx prisma migrate deploy

# Health check
curl https://api.yourdomain.com/health
```

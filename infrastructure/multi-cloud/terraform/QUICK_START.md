# Multi-Cloud Deployment - Quick Start Guide

Quick reference for deploying dculus-forms infrastructure across Cloudflare R2 and Azure Container Apps.

## 🚀 Quick Deploy

### Via GitHub Actions UI

1. Go to **Actions** tab
2. Select **"Multi-Cloud Deployment"** workflow
3. Click **"Run workflow"**
4. Select:
   - **Environment**: `dev`, `staging`, or `production`
   - **Deploy Cloudflare**: ✓ (checked)
   - **Deploy Azure**: ✓ (checked)
5. Click **"Run workflow"** button

### Via GitHub CLI

```bash
# Deploy everything to dev
gh workflow run multi-cloud-deployment.yml \
  -f environment=dev \
  -f deploy_cloudflare=true \
  -f deploy_azure=true

# Deploy only to staging
gh workflow run multi-cloud-deployment.yml \
  -f environment=staging \
  -f deploy_cloudflare=true \
  -f deploy_azure=true

# Deploy only Cloudflare R2 to production
gh workflow run multi-cloud-deployment.yml \
  -f environment=production \
  -f deploy_cloudflare=true \
  -f deploy_azure=false
```

## 📋 Prerequisites Checklist

Before deploying, ensure you have:

### Repository Secrets (All Environments)

- [ ] `AZURE_CLIENT_ID`
- [ ] `AZURE_TENANT_ID`
- [ ] `AZURE_SUBSCRIPTION_ID`
- [ ] `CLOUDFLARE_API_TOKEN`
- [ ] `CLOUDFLARE_ACCOUNT_ID`
- [ ] `DOCKER_USERNAME`
- [ ] `DOCKER_PASSWORD`

### Environment Secrets (Per Environment)

For each environment (dev, staging, production):

- [ ] `MONGODB_CONNECTION_STRING`
- [ ] `BETTER_AUTH_SECRET`
- [ ] `S3_PUBLIC_CDN_URL`
- [ ] `PUBLIC_S3_ACCESS_KEY`
- [ ] `PUBLIC_S3_SECRET_KEY`
- [ ] `PUBLIC_S3_ENDPOINT`
- [ ] `S3_PRIVATE_BUCKET_NAME`
- [ ] `S3_PUBLIC_BUCKET_NAME`
- [ ] `CORS_ORIGINS`

## 🔧 Setup Commands

### 1. Set Repository Secrets

```bash
# Azure OIDC
gh secret set AZURE_CLIENT_ID --body "your-client-id"
gh secret set AZURE_TENANT_ID --body "your-tenant-id"
gh secret set AZURE_SUBSCRIPTION_ID --body "your-subscription-id"

# Cloudflare
gh secret set CLOUDFLARE_API_TOKEN --body "your-api-token"
gh secret set CLOUDFLARE_ACCOUNT_ID --body "your-account-id"

# Docker Hub
gh secret set DOCKER_USERNAME --body "your-username"
gh secret set DOCKER_PASSWORD --body "your-token"
```

### 2. Set Environment Secrets (Dev Example)

```bash
# MongoDB
gh secret set MONGODB_CONNECTION_STRING --env dev \
  --body "mongodb+srv://user:pass@cluster.mongodb.net/dbname"

# Authentication (generate random secret)
gh secret set BETTER_AUTH_SECRET --env dev \
  --body "$(openssl rand -base64 32)"

# Cloudflare R2
gh secret set S3_PUBLIC_CDN_URL --env dev --body "https://cdn.dev.dculus.com"
gh secret set PUBLIC_S3_ACCESS_KEY --env dev --body "your-r2-access-key"
gh secret set PUBLIC_S3_SECRET_KEY --env dev --body "your-r2-secret-key"
gh secret set PUBLIC_S3_ENDPOINT --env dev \
  --body "https://your-account-id.r2.cloudflarestorage.com"
gh secret set S3_PRIVATE_BUCKET_NAME --env dev --body "dculus-forms-private-dev"
gh secret set S3_PUBLIC_BUCKET_NAME --env dev --body "dculus-forms-public-dev"

# CORS
gh secret set CORS_ORIGINS --env dev \
  --body "http://localhost:3000,http://localhost:5173,http://localhost:3002"
```

### 3. Repeat for Staging and Production

```bash
# Just change --env flag to staging or production
gh secret set MONGODB_CONNECTION_STRING --env staging --body "..."
gh secret set MONGODB_CONNECTION_STRING --env production --body "..."
# ... etc
```

## 📊 Deployment Flow

```
1. Push code → GitHub
2. Build Docker image (build.yml)
3. Run multi-cloud deployment:
   ├─ Setup Azure backend (Terraform state)
   ├─ Check Docker image exists
   ├─ Plan Cloudflare R2 changes     } Parallel
   ├─ Plan Azure Container Apps       }
   ├─ Apply Cloudflare R2
   ├─ Apply Azure Container Apps
   ├─ Run health checks
   └─ Generate deployment summary
```

## 🔍 Monitoring Deployment

### Watch Workflow Progress

```bash
# List recent workflow runs
gh run list --workflow=multi-cloud-deployment.yml

# Watch specific run
gh run watch RUN_ID

# View logs
gh run view RUN_ID --log
```

### Check Deployment Outputs

After successful deployment, the workflow provides:

**Cloudflare R2:**
- Private Bucket: `dculus-forms-private-{env}`
- Public Bucket: `dculus-forms-public-{env}`
- R2 Endpoint: `https://{account_id}.r2.cloudflarestorage.com`

**Azure Container Apps:**
- Backend URL: `https://dculus-forms-{env}-backend.{region}.azurecontainerapps.io`
- GraphQL Endpoint: `{backend_url}/graphql`
- Health Check: `{backend_url}/health`

### Test Deployment

```bash
# Get backend URL from workflow output, then:
BACKEND_URL="https://dculus-forms-dev-backend.eastus.azurecontainerapps.io"

# Test health endpoint
curl $BACKEND_URL/health

# Test GraphQL endpoint
curl -X POST $BACKEND_URL/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __typename }"}'
```

## 🐛 Quick Troubleshooting

### Docker Image Not Found

```bash
# Build the Docker image first
gh workflow run build.yml
gh run watch # Wait for completion
# Then run deployment
gh workflow run multi-cloud-deployment.yml -f environment=dev
```

### Health Check Failures

```bash
# Check container logs
az containerapp logs show \
  --name dculus-forms-dev-backend \
  --resource-group dculus-forms-dev-rg \
  --follow
```

### Terraform State Lock

```bash
# Force unlock (use with caution)
cd infrastructure/multi-cloud/terraform/azure/environments/dev
terraform force-unlock LOCK_ID
```

### Azure Authentication Issues

- Verify secrets in GitHub Settings → Secrets and variables → Actions
- Check federated identity in Azure AD App Registration
- Ensure GitHub Actions is in allowed subjects

## 📦 Resource Sizes by Environment

| Environment | CPU | Memory | Min Replicas | Max Replicas | Log Retention |
|-------------|-----|--------|--------------|--------------|---------------|
| Dev | 0.25 | 0.5 Gi | 1 | 3 | 30 days |
| Staging | 0.5 | 1.0 Gi | 1 | 5 | 30 days |
| Production | 1.0 | 2.0 Gi | 2 | 10 | 90 days |

## 🔄 Common Workflows

### Deploy Everything to All Environments

```bash
# Dev
gh workflow run multi-cloud-deployment.yml -f environment=dev

# Wait for completion, then staging
gh workflow run multi-cloud-deployment.yml -f environment=staging

# Wait for completion, then production
gh workflow run multi-cloud-deployment.yml -f environment=production
```

### Update Only Azure Backend

```bash
gh workflow run multi-cloud-deployment.yml \
  -f environment=dev \
  -f deploy_cloudflare=false \
  -f deploy_azure=true
```

### Update Only Cloudflare R2

```bash
gh workflow run multi-cloud-deployment.yml \
  -f environment=dev \
  -f deploy_cloudflare=true \
  -f deploy_azure=false
```

## 🔗 Useful Links

- **Full Documentation**: [MULTI_CLOUD_DEPLOYMENT_GUIDE.md](./MULTI_CLOUD_DEPLOYMENT_GUIDE.md)
- **Cloudflare Terraform**: [cloudflare/README.md](./cloudflare/README.md)
- **Azure Terraform**: [azure/README.md](./azure/README.md)
- **GitHub Actions Workflow**: [.github/workflows/multi-cloud-deployment.yml](../../../.github/workflows/multi-cloud-deployment.yml)

## 💡 Tips

1. **Always deploy to dev first** - Test changes before promoting
2. **Monitor deployment summaries** - Check GitHub Actions summary for URLs
3. **Use manual workflow dispatch** - Don't rely on auto-deploys for production
4. **Rotate secrets regularly** - Update `BETTER_AUTH_SECRET` periodically
5. **Check cost management** - Review Azure and Cloudflare billing monthly

## ❓ Need Help?

- Read the full guide: `MULTI_CLOUD_DEPLOYMENT_GUIDE.md`
- Check workflow logs in GitHub Actions
- Review Terraform plan outputs before applying
- Contact DevOps team for support

---

**Quick Reference Card**

```bash
# Deploy to dev
gh workflow run multi-cloud-deployment.yml -f environment=dev

# Check deployment status
gh run list --workflow=multi-cloud-deployment.yml

# Test health
curl https://dculus-forms-{env}-backend.{region}.azurecontainerapps.io/health

# View logs
az containerapp logs show --name dculus-forms-{env}-backend --resource-group dculus-forms-{env}-rg --follow
```

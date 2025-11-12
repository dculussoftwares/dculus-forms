# Multi-Cloud Deployment Guide

Complete guide for deploying dculus-forms infrastructure across Cloudflare R2 and Azure Container Apps using the unified multi-cloud deployment pipeline.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [GitHub Secrets Configuration](#github-secrets-configuration)
- [Environment Setup](#environment-setup)
- [Deployment Instructions](#deployment-instructions)
- [Troubleshooting](#troubleshooting)
- [Rollback Procedures](#rollback-procedures)

## Overview

The multi-cloud deployment pipeline automates the provisioning and deployment of:

- **Cloudflare R2**: S3-compatible object storage for file uploads (private and public buckets)
- **Azure Container Apps**: Serverless container platform for backend API deployment

Both services are deployed in parallel across three environments: dev, staging, and production.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   GitHub Actions Workflow                    │
│              multi-cloud-deployment.yml                      │
└─────────────────────────────────────────────────────────────┘
                           │
                ┌──────────┴──────────┐
                │                     │
        ┌───────▼───────┐     ┌──────▼──────┐
        │  Cloudflare   │     │    Azure    │
        │      R2       │     │ Container   │
        │   Terraform   │     │    Apps     │
        │               │     │  Terraform  │
        └───────┬───────┘     └──────┬──────┘
                │                     │
        ┌───────▼───────┐     ┌──────▼──────┐
        │ Private Bucket│     │   Backend   │
        │ Public Bucket │     │  Container  │
        │ R2 Endpoint   │     │   +Logs     │
        └───────────────┘     └─────────────┘
```

### Resource Naming Convention

All resources follow the pattern: `{project_name}-{environment}-{resource_type}`

**Examples:**
- Dev: `dculus-forms-dev-backend`, `dculus-forms-private-dev`
- Staging: `dculus-forms-staging-backend`, `dculus-forms-public-staging`
- Production: `dculus-forms-production-backend`, `dculus-forms-private-production`

### Terraform State Management

Terraform state is stored in Azure Storage Account with separate containers per environment and cloud provider:

- **Storage Account**: `dculusterraformstates`
- **Resource Group**: `dculus-global-terraform-assets-resource-grp`
- **Containers**:
  - `dculus-forms-cloudflare-r2-{env}-state`
  - `dculus-forms-azure-backend-{env}-state`

## Prerequisites

### Required Tools (for local development)

- [Terraform](https://www.terraform.io/downloads.html) >= 1.6.0
- [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli) >= 2.50.0
- [Docker](https://docs.docker.com/get-docker/) >= 20.10 (for image building)
- [Git](https://git-scm.com/downloads) >= 2.30

### Cloud Accounts

1. **Azure Account**
   - Active subscription with Container Apps enabled
   - OIDC federated identity configured for GitHub Actions

2. **Cloudflare Account**
   - Active account with R2 enabled
   - API token with R2 read/write permissions

3. **MongoDB Atlas Account** (or other MongoDB provider)
   - Separate database clusters for each environment

4. **Docker Hub Account**
   - For storing backend container images

### GitHub Repository Settings

Enable the following in your repository settings:

- **Actions**: Enabled
- **Environments**: Create `dev`, `staging`, and `production` environments
- **OIDC**: Federated identity for Azure

## GitHub Secrets Configuration

### Repository-Level Secrets

These secrets are shared across all environments:

| Secret Name | Description | How to Get |
|-------------|-------------|------------|
| `AZURE_CLIENT_ID` | Azure AD App Registration Client ID | Azure Portal → App Registrations → Overview |
| `AZURE_TENANT_ID` | Azure AD Tenant ID | Azure Portal → Azure Active Directory → Overview |
| `AZURE_SUBSCRIPTION_ID` | Azure Subscription ID | Azure Portal → Subscriptions |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token | Cloudflare Dashboard → My Profile → API Tokens |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID | Cloudflare Dashboard → Account Home |
| `DOCKER_USERNAME` | Docker Hub username | Docker Hub account |
| `DOCKER_PASSWORD` | Docker Hub access token | Docker Hub → Account Settings → Security |

### Environment-Specific Secrets

Configure these secrets for **each environment** (dev, staging, production):

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `MONGODB_CONNECTION_STRING` | MongoDB connection string | `mongodb+srv://user:pass@cluster.mongodb.net/dbname` |
| `BETTER_AUTH_SECRET` | Authentication secret (min 32 chars) | Generate with `openssl rand -base64 32` |
| `S3_PUBLIC_CDN_URL` | CDN URL serving public assets | `https://cdn.dev.dculus.com` |
| `S3_ACCESS_KEY` | Cloudflare R2 API token access key | From Cloudflare R2 dashboard |
| `S3_SECRET_KEY` | Cloudflare R2 API token secret key | From Cloudflare R2 dashboard |
| `S3_ENDPOINT` | R2 endpoint URL | `https://{account_id}.r2.cloudflarestorage.com` |
| `S3_PRIVATE_BUCKET_NAME` | Private bucket name | `dculus-forms-private-{env}` |
| `S3_PUBLIC_BUCKET_NAME` | Public bucket name | `dculus-forms-public-{env}` |
| `CORS_ORIGINS` | Allowed CORS origins (comma-separated) | `https://dev.example.com,https://admin-dev.example.com` |

### Setting Up Secrets via GitHub CLI

```bash
# Repository secrets
gh secret set AZURE_CLIENT_ID --body "your-client-id"
gh secret set AZURE_TENANT_ID --body "your-tenant-id"
gh secret set AZURE_SUBSCRIPTION_ID --body "your-subscription-id"
gh secret set CLOUDFLARE_API_TOKEN --body "your-api-token"
gh secret set CLOUDFLARE_ACCOUNT_ID --body "your-account-id"

# Environment secrets (repeat for dev, staging, production)
gh secret set MONGODB_CONNECTION_STRING --env dev --body "your-connection-string"
gh secret set BETTER_AUTH_SECRET --env dev --body "$(openssl rand -base64 32)"
gh secret set S3_PUBLIC_CDN_URL --env dev --body "https://cdn.dev.dculus.com"
gh secret set S3_ACCESS_KEY --env dev --body "your-r2-access-key"
gh secret set S3_SECRET_KEY --env dev --body "your-r2-secret-key"
gh secret set S3_ENDPOINT --env dev --body "https://your-account-id.r2.cloudflarestorage.com"
gh secret set S3_PRIVATE_BUCKET_NAME --env dev --body "dculus-forms-private-dev"
gh secret set S3_PUBLIC_BUCKET_NAME --env dev --body "dculus-forms-public-dev"
gh secret set CORS_ORIGINS --env dev --body "http://localhost:3000,http://localhost:5173"
```

## Environment Setup

### Dev Environment Configuration

**Purpose**: Development and testing
**Resources**:
- CPU: 0.25 cores
- Memory: 0.5 Gi
- Replicas: 1-3
- Log Retention: 30 days

**Terraform Variables** (`infrastructure/multi-cloud/terraform/azure/environments/dev/terraform.tfvars`):

```hcl
project_name        = "dculus-forms"
environment         = "dev"
location            = "East US"
container_image     = "dculus/forms-backend"
container_image_tag = "latest"
cpu_cores           = 0.25
memory_gb           = 0.5
min_replicas        = 1
max_replicas        = 3
```

### Staging Environment Configuration

**Purpose**: Pre-production testing and QA
**Resources**:
- CPU: 0.5 cores
- Memory: 1.0 Gi
- Replicas: 1-5
- Log Retention: 30 days

**Terraform Variables** (`infrastructure/multi-cloud/terraform/azure/environments/staging/terraform.tfvars`):

```hcl
project_name        = "dculus-forms"
environment         = "staging"
location            = "East US"
container_image     = "dculus/forms-backend"
container_image_tag = "latest"
cpu_cores           = 0.5
memory_gb           = 1.0
min_replicas        = 1
max_replicas        = 5
```

### Production Environment Configuration

**Purpose**: Live production workloads
**Resources**:
- CPU: 1.0 cores
- Memory: 2.0 Gi
- Replicas: 2-10
- Log Retention: 90 days

**Terraform Variables** (`infrastructure/multi-cloud/terraform/azure/environments/production/terraform.tfvars`):

```hcl
project_name        = "dculus-forms"
environment         = "production"
location            = "East US"
container_image     = "dculus/forms-backend"
container_image_tag = "latest"
cpu_cores           = 1.0
memory_gb           = 2.0
min_replicas        = 2
max_replicas        = 10
```

## Deployment Instructions

### Automated Deployment via GitHub Actions

#### 1. Deploy to Dev Environment

```bash
# Via GitHub UI
1. Go to Actions tab → "Multi-Cloud Deployment"
2. Click "Run workflow"
3. Select environment: dev
4. Toggle: Deploy Cloudflare ✓, Deploy Azure ✓
5. Click "Run workflow"

# Via GitHub CLI
gh workflow run multi-cloud-deployment.yml \
  -f environment=dev \
  -f deploy_cloudflare=true \
  -f deploy_azure=true
```

#### 2. Deploy to Staging Environment

```bash
gh workflow run multi-cloud-deployment.yml \
  -f environment=staging \
  -f deploy_cloudflare=true \
  -f deploy_azure=true
```

#### 3. Deploy to Production Environment

```bash
gh workflow run multi-cloud-deployment.yml \
  -f environment=production \
  -f deploy_cloudflare=true \
  -f deploy_azure=true
```

#### 4. Deploy Only Cloudflare R2

```bash
gh workflow run multi-cloud-deployment.yml \
  -f environment=dev \
  -f deploy_cloudflare=true \
  -f deploy_azure=false
```

#### 5. Deploy Only Azure Container Apps

```bash
gh workflow run multi-cloud-deployment.yml \
  -f environment=dev \
  -f deploy_cloudflare=false \
  -f deploy_azure=true
```

### Manual Deployment via Terraform CLI

#### Cloudflare R2 Deployment

```bash
cd infrastructure/multi-cloud/terraform/cloudflare/environments/dev

# Copy shared Terraform files
cp ../../main.tf .
cp ../../variables.tf .
cp ../../r2-buckets.tf .
cp ../../outputs.tf .

# Initialize Terraform
terraform init

# Plan deployment
terraform plan \
  -var="cloudflare_account_id=YOUR_ACCOUNT_ID" \
  -var="cloudflare_api_token=YOUR_API_TOKEN"

# Apply deployment
terraform apply \
  -var="cloudflare_account_id=YOUR_ACCOUNT_ID" \
  -var="cloudflare_api_token=YOUR_API_TOKEN"
```

#### Azure Container Apps Deployment

```bash
cd infrastructure/multi-cloud/terraform/azure/environments/dev

# Copy shared Terraform files
cp ../../main.tf .
cp ../../variables.tf .
cp ../../outputs.tf .

# Initialize Terraform
terraform init

# Plan deployment
terraform plan \
  -var="mongodb_connection_string=YOUR_CONNECTION_STRING" \
  -var="better_auth_secret=YOUR_SECRET" \
  -var="container_image_tag=latest"

# Apply deployment
terraform apply \
  -var="mongodb_connection_string=YOUR_CONNECTION_STRING" \
  -var="better_auth_secret=YOUR_SECRET" \
  -var="container_image_tag=latest"
```

## Workflow Job Structure

The multi-cloud deployment workflow consists of the following jobs:

1. **determine-environment**: Sets target environment and deployment flags
2. **setup-azure-backend**: Creates Terraform state containers
3. **check-docker-image**: Verifies Docker image availability
4. **terraform-cloudflare-plan**: Plans Cloudflare R2 changes (parallel)
5. **terraform-azure-plan**: Plans Azure Container Apps changes (parallel)
6. **terraform-cloudflare-apply**: Applies Cloudflare R2 changes
7. **terraform-azure-apply**: Applies Azure Container Apps changes
8. **health-checks**: Validates backend health and GraphQL endpoints
9. **deployment-summary**: Generates comprehensive deployment report

## Deployment Outputs

After successful deployment, you'll receive:

### Cloudflare R2 Outputs

- **Private Bucket Name**: `dculus-forms-private-{env}`
- **Public Bucket Name**: `dculus-forms-public-{env}`
- **R2 Endpoint URL**: `https://{account_id}.r2.cloudflarestorage.com`

### Azure Container Apps Outputs

- **Backend URL**: `https://dculus-forms-{env}-backend.{region}.azurecontainerapps.io`
- **GraphQL Endpoint**: `{backend_url}/graphql`
- **Health Check Endpoint**: `{backend_url}/health`
- **Container App Name**: `dculus-forms-{env}-backend`
- **Resource Group**: `dculus-forms-{env}-rg`

## Troubleshooting

### Common Issues

#### 1. Docker Image Not Found

**Error**: `Docker image dculus/forms-backend:{sha} does not exist`

**Solution**:
```bash
# Run build workflow first to create the image
gh workflow run build.yml

# Wait for build to complete, then run deployment
gh workflow run multi-cloud-deployment.yml -f environment=dev
```

#### 2. Terraform State Lock

**Error**: `Error acquiring the state lock`

**Solution**:
```bash
# List active locks
az storage blob list \
  --account-name dculusterraformstates \
  --container-name dculus-forms-azure-backend-dev-state

# Force unlock (use with caution)
cd infrastructure/multi-cloud/terraform/azure/environments/dev
terraform force-unlock LOCK_ID
```

#### 3. Azure Authentication Failed

**Error**: `OIDC authentication failed`

**Solution**:
- Verify `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, and `AZURE_SUBSCRIPTION_ID` secrets
- Check federated identity configuration in Azure AD App Registration
- Ensure GitHub Actions is allowed in the federated credential settings

#### 4. Cloudflare API Error

**Error**: `Error creating R2 bucket: authentication failed`

**Solution**:
- Verify `CLOUDFLARE_API_TOKEN` has R2 edit permissions
- Check `CLOUDFLARE_ACCOUNT_ID` is correct
- Generate new API token if needed

#### 5. Health Check Failures

**Error**: `Health check failed after 5 attempts`

**Solution**:
```bash
# Check container logs
az containerapp logs show \
  --name dculus-forms-dev-backend \
  --resource-group dculus-forms-dev-rg \
  --follow

# Check container status
az containerapp show \
  --name dculus-forms-dev-backend \
  --resource-group dculus-forms-dev-rg \
  --query "properties.runningStatus"
```

### Debugging Commands

#### View Terraform State

```bash
# Cloudflare R2 state
cd infrastructure/multi-cloud/terraform/cloudflare/environments/dev
terraform state list
terraform show

# Azure Container Apps state
cd infrastructure/multi-cloud/terraform/azure/environments/dev
terraform state list
terraform show
```

#### Check Azure Resources

```bash
# List all resources in environment
az resource list \
  --resource-group dculus-forms-dev-rg \
  --output table

# Get container app details
az containerapp show \
  --name dculus-forms-dev-backend \
  --resource-group dculus-forms-dev-rg
```

#### Check Cloudflare R2 Buckets

```bash
# List R2 buckets (via Cloudflare API)
curl -X GET "https://api.cloudflare.com/client/v4/accounts/{account_id}/r2/buckets" \
  -H "Authorization: Bearer {api_token}"
```

## Rollback Procedures

### Rollback Azure Container Apps

#### Option 1: Rollback to Previous Revision

```bash
# List revisions
az containerapp revision list \
  --name dculus-forms-dev-backend \
  --resource-group dculus-forms-dev-rg \
  --output table

# Activate previous revision
az containerapp revision activate \
  --name dculus-forms-dev-backend \
  --resource-group dculus-forms-dev-rg \
  --revision PREVIOUS_REVISION_NAME
```

#### Option 2: Redeploy Previous Docker Image

```bash
# Update container image to previous tag
az containerapp update \
  --name dculus-forms-dev-backend \
  --resource-group dculus-forms-dev-rg \
  --image dculus/forms-backend:PREVIOUS_TAG
```

#### Option 3: Terraform State Rollback

```bash
cd infrastructure/multi-cloud/terraform/azure/environments/dev

# List Terraform state versions
az storage blob list \
  --account-name dculusterraformstates \
  --container-name dculus-forms-azure-backend-dev-state

# Download previous state
az storage blob download \
  --account-name dculusterraformstates \
  --container-name dculus-forms-azure-backend-dev-state \
  --name terraform.tfstate \
  --file previous-state.tfstate

# Restore and apply
terraform state push previous-state.tfstate
terraform apply
```

### Rollback Cloudflare R2

R2 buckets are rarely changed, but if needed:

```bash
cd infrastructure/multi-cloud/terraform/cloudflare/environments/dev

# Restore previous Terraform state
az storage blob download \
  --account-name dculusterraformstates \
  --container-name dculus-forms-cloudflare-r2-dev-state \
  --name terraform.tfstate \
  --file previous-state.tfstate

terraform state push previous-state.tfstate
terraform apply
```

## Best Practices

### 1. Environment Promotion Strategy

Always promote changes through environments:

```
dev → staging → production
```

### 2. Testing Before Production

- Deploy to dev first
- Run integration tests
- Deploy to staging
- Run smoke tests and QA
- Deploy to production with monitoring

### 3. Monitoring Deployments

- Watch health check results
- Monitor Azure Application Insights
- Check container logs during deployment
- Set up alerts for deployment failures

### 4. Secret Rotation

Rotate secrets regularly:

```bash
# Generate new secrets
NEW_SECRET=$(openssl rand -base64 32)

# Update GitHub secrets
gh secret set BETTER_AUTH_SECRET --env production --body "$NEW_SECRET"

# Redeploy
gh workflow run multi-cloud-deployment.yml -f environment=production
```

### 5. Cost Optimization

- Use appropriate resource sizes per environment
- Enable auto-scaling based on load
- Monitor resource usage via Azure Cost Management
- Review Cloudflare R2 storage costs monthly

## Additional Resources

- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [Azure Container Apps Documentation](https://docs.microsoft.com/en-us/azure/container-apps/)
- [Terraform Azure Provider](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs)
- [Terraform Cloudflare Provider](https://registry.terraform.io/providers/cloudflare/cloudflare/latest/docs)
- [GitHub Actions OIDC with Azure](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-azure)

## Support

For issues or questions:

- Check [Troubleshooting](#troubleshooting) section
- Review GitHub Actions workflow logs
- Check Terraform plan outputs
- Contact DevOps team

---

**Last Updated**: 2025-01-09
**Version**: 1.0.0

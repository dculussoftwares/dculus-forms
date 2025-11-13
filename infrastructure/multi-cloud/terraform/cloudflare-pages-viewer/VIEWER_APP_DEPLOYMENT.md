# Form Viewer App Deployment Guide

## Overview

This module provisions Cloudflare Pages infrastructure for deploying the **form-viewer** React application across multiple environments (dev, staging, production).

## Domain Pattern

The form-viewer app is accessible at:
- **Dev**: `https://viewer-app-dev.dculus.com`
- **Staging**: `https://viewer-app-staging.dculus.com`
- **Production**: `https://viewer-app.dculus.com`

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     GitHub Actions                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 1. Build form-viewer with environment-specific vars │  │
│  │    - VITE_GRAPHQL_URL                                │  │
│  │    - VITE_API_URL                                    │  │
│  │    - VITE_CDN_ENDPOINT                               │  │
│  └─────────────────┬────────────────────────────────────┘  │
│                    │                                        │
│  ┌─────────────────▼────────────────────────────────────┐  │
│  │ 2. Deploy to Cloudflare Pages via Wrangler          │  │
│  │    - Project: viewer-app-{env}                       │  │
│  │    - Branch: main                                    │  │
│  └─────────────────┬────────────────────────────────────┘  │
└────────────────────┼────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Cloudflare Pages Infrastructure                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Cloudflare Pages Project                             │  │
│  │  - Name: viewer-app-{env}                            │  │
│  │  - Build Config: None (pre-built)                    │  │
│  │  - Production Branch: main                           │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Custom Domain                                         │  │
│  │  - Domain: viewer-app-{env}.dculus.com               │  │
│  │  - Zone: dculus.com                                  │  │
│  │  - DNS: CNAME → Pages URL                            │  │
│  │  - Certificate: Auto (Cloudflare Universal SSL)      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Infrastructure Components

### 1. Cloudflare Pages Project
```hcl
resource "cloudflare_pages_project" "viewer_app"
```
- **Purpose**: Host the static form-viewer React application
- **Project Name**: `viewer-app-{environment}`
- **Build Configuration**: Disabled (pre-built by GitHub Actions)
- **Deployment Source**: Direct uploads via Wrangler CLI

### 2. Custom Domain Configuration
```hcl
resource "cloudflare_pages_domain" "viewer_app"
resource "cloudflare_record" "viewer_app_cname"
```
- **Custom Domain**: `viewer-app-{env}.dculus.com` or `viewer-app.dculus.com`
- **DNS Record**: CNAME pointing to `{project-name}.pages.dev`
- **SSL/TLS**: Automatic certificate via Cloudflare Universal SSL

### 3. Environment-Specific State Storage
Each environment maintains separate Terraform state in Azure Storage:
- **Dev**: `dculus-forms-cloudflare-pages-viewer-dev-state`
- **Staging**: `dculus-forms-cloudflare-pages-viewer-staging-state`
- **Production**: `dculus-forms-cloudflare-pages-viewer-production-state`

## File Structure

```
cloudflare-pages-viewer/
├── VIEWER_APP_DEPLOYMENT.md        # This documentation
├── main.tf                          # Core Pages project and domain resources
├── variables.tf                     # Input variables
├── outputs.tf                       # Resource outputs
├── cloudflare-pages-domain.tf       # Custom domain resources
└── environments/
    ├── dev/
    │   └── backend.tf               # Azure backend config for dev
    ├── staging/
    │   └── backend.tf               # Azure backend config for staging
    └── production/
        └── backend.tf               # Azure backend config for production
```

## Deployment Process

### Prerequisites
1. **Cloudflare Account** with Pages enabled
2. **Azure Storage Account** (`dculusterraformstates`)
3. **GitHub Secrets** configured:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
   - `CLOUDFLARE_ZONE_ID`
   - `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`

### Deployment Flow

1. **Tag Release**:
   ```bash
   git tag v1.2.3
   git push origin v1.2.3
   ```

2. **GitHub Actions Workflow**:
   - Determines environment from tag (e.g., `v1.2.3` → production)
   - Runs `terraform-cloudflare-pages-viewer` job:
     - Initializes Terraform with Azure backend
     - Creates/updates Cloudflare Pages project
     - Configures custom domain and DNS
   - Runs `deploy-cloudflare-pages-viewer-app` job:
     - Downloads source code from tagged release
     - Installs dependencies (`pnpm install`)
     - Builds shared packages (`@dculus/types`, `@dculus/utils`, `@dculus/ui`)
     - Builds form-viewer with environment-specific vars
     - Deploys to Cloudflare Pages via `wrangler pages deploy`
     - Performs health check on custom domain

3. **Health Checks**:
   - Waits 60 seconds for DNS propagation
   - Retries HTTP GET 5 times with 30-second intervals
   - Validates HTTP 200 response

## Manual Deployment

### Initialize Terraform
```bash
cd infrastructure/multi-cloud/terraform/cloudflare-pages-viewer/environments/production

# Copy shared files
cp ../../main.tf .
cp ../../variables.tf .
cp ../../outputs.tf .
cp ../../cloudflare-pages-domain.tf .

terraform init
```

### Plan Changes
```bash
terraform plan \
  -var="environment=production" \
  -var="cloudflare_account_id=${CLOUDFLARE_ACCOUNT_ID}" \
  -var="cloudflare_api_token=${CLOUDFLARE_API_TOKEN}" \
  -var="cloudflare_zone_id=${CLOUDFLARE_ZONE_ID}" \
  -var="root_domain=dculus.com"
```

### Apply Infrastructure
```bash
terraform apply \
  -var="environment=production" \
  -var="cloudflare_account_id=${CLOUDFLARE_ACCOUNT_ID}" \
  -var="cloudflare_api_token=${CLOUDFLARE_API_TOKEN}" \
  -var="cloudflare_zone_id=${CLOUDFLARE_ZONE_ID}" \
  -var="root_domain=dculus.com"
```

### Deploy Application
```bash
# Build form-viewer
cd apps/form-viewer
pnpm install
pnpm build

# Deploy to Cloudflare Pages
wrangler pages deploy dist \
  --project-name=viewer-app-production \
  --branch=main \
  --commit-hash=$(git rev-parse HEAD) \
  --commit-message="Manual deployment"
```

## Environment Variables

### Build-Time Variables (Vite)
Set in GitHub Actions workflow during `pnpm --filter form-viewer build`:

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_GRAPHQL_URL` | GraphQL endpoint URL | `https://api-production.dculus.com/graphql` |
| `VITE_API_URL` | Backend REST API URL | `https://api-production.dculus.com` |
| `VITE_CDN_ENDPOINT` | Cloudflare R2 CDN URL | `https://cdn.dculus.com` |

### Terraform Variables
| Variable | Type | Description | Required |
|----------|------|-------------|----------|
| `environment` | string | Deployment environment | Yes |
| `cloudflare_account_id` | string | Cloudflare Account ID | Yes |
| `cloudflare_api_token` | string | Cloudflare API Token | Yes |
| `cloudflare_zone_id` | string | Cloudflare Zone ID for dculus.com | Yes |
| `root_domain` | string | Root domain name | Yes (default: `dculus.com`) |

## Outputs

After successful Terraform apply:

```hcl
pages_project_name = "viewer-app-production"
pages_url = "https://viewer-app-production.pages.dev"
custom_domain = "https://viewer-app.dculus.com"
```

## Troubleshooting

### Health Check Failures
- **Symptom**: `❌ Health check failed after 5 attempts`
- **Causes**:
  - DNS propagation delay (wait up to 5 minutes)
  - Build errors in form-viewer app
  - Incorrect Wrangler project name
- **Solution**:
  ```bash
  # Check Cloudflare Pages dashboard
  https://dash.cloudflare.com/{ACCOUNT_ID}/pages/view/viewer-app-production
  
  # Verify DNS
  dig viewer-app.dculus.com
  
  # Check deployment logs
  wrangler pages deployment list --project-name=viewer-app-production
  ```

### Custom Domain Not Resolving
- **Symptom**: Domain returns `ERR_NAME_NOT_RESOLVED`
- **Causes**:
  - CNAME record not created
  - Cloudflare proxy disabled
- **Solution**:
  ```bash
  # Verify CNAME record
  curl -X GET "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" | jq '.result[] | select(.name=="viewer-app.dculus.com")'
  
  # Check custom domain status
  curl -X GET "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/viewer-app-production" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" | jq '.result.domains'
  ```

### Build Failures
- **Symptom**: `pnpm build` fails during deployment
- **Causes**:
  - Missing environment variables
  - TypeScript errors
  - Shared package build failures
- **Solution**:
  ```bash
  # Test build locally
  pnpm --filter @dculus/types build
  pnpm --filter @dculus/utils build
  pnpm --filter @dculus/ui build
  pnpm --filter form-viewer build
  
  # Check environment variables
  echo $VITE_GRAPHQL_URL
  echo $VITE_API_URL
  ```

## Security Considerations

1. **API Token Permissions**:
   - Cloudflare API token requires `Cloudflare Pages:Edit` permission
   - Zone-level permissions for DNS management
   - Store securely in GitHub Secrets

2. **CORS Configuration**:
   - Backend CORS updated to allow `viewer-app-{env}.dculus.com`
   - See `infrastructure/multi-cloud/terraform/azure/main.tf`

3. **State Storage**:
   - Terraform state encrypted at rest in Azure Storage
   - OIDC authentication (no static credentials)

## Related Documentation

- [Multi-Cloud Deployment Workflow](../.github/workflows/multi-cloud-deployment.yml)
- [Form App Deployment](../cloudflare-pages/FORM_APP_DEPLOYMENT.md)
- [Admin App Deployment](../cloudflare-pages-admin/ADMIN_APP_DEPLOYMENT.md)
- [Azure CORS Configuration](../azure/main.tf)
- [GitHub Secrets Setup](../../../../GITHUB_SECRETS_SETUP.md)

## Monitoring

### Check Deployment Status
```bash
# GitHub Actions
https://github.com/natheeshkumar/dculus-forms/actions

# Cloudflare Pages Dashboard
https://dash.cloudflare.com/{ACCOUNT_ID}/pages/view/viewer-app-production

# Application Health
curl -I https://viewer-app.dculus.com
```

### Key Metrics
- **Build Time**: ~5-10 minutes (includes pnpm install + build)
- **Deployment Time**: ~2-3 minutes (Wrangler upload + activation)
- **DNS Propagation**: ~1-5 minutes (Cloudflare CDN)
- **Total Deployment**: ~10-15 minutes end-to-end

---

**Version**: 1.0  
**Last Updated**: 2025-01-12  
**Maintainer**: Dculus Infrastructure Team

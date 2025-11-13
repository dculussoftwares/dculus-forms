# Admin App Deployment Guide

## Overview

This document provides a comprehensive guide for deploying the `admin-app` to Cloudflare Pages with Terraform infrastructure management. The deployment follows the same pattern as `form-app` with environment-specific configurations.

## Architecture Summary

### Infrastructure Components

1. **Cloudflare Pages Project**: Hosts the admin-app static site
2. **Custom Domain**: `admin-app-{env}.dculus.com` (where env is dev, staging, or production)
3. **Azure Terraform State Storage**: Manages deployment state across environments
4. **Azure Backend CORS**: Configured to allow admin-app origins

### URL Structure

| Environment | URL |
|------------|-----|
| Development | `https://form-admin-app-dev.dculus.com` |
| Staging | `https://form-admin-app-staging.dculus.com` |
| Production | `https://form-admin-app-production.dculus.com` |

## Terraform Infrastructure

### Directory Structure

```
infrastructure/multi-cloud/terraform/cloudflare-pages-admin/
├── main.tf                      # Cloudflare Pages project definition
├── variables.tf                 # Input variables
├── outputs.tf                   # Output values
├── cloudflare-pages-domain.tf   # Custom domain and DNS configuration
└── environments/
    ├── dev/
    │   └── backend.tf           # Dev environment backend config
    ├── staging/
    │   └── backend.tf           # Staging environment backend config
    └── production/
        └── backend.tf           # Production environment backend config
```

### Key Terraform Resources

#### 1. Cloudflare Pages Project (`main.tf`)

```terraform
resource "cloudflare_pages_project" "admin_app" {
  account_id        = var.cloudflare_account_id
  name              = "form-admin-app-${var.environment}"
  production_branch = "main"
  
  build_config {
    build_command   = ""
    destination_dir = ""
  }
  
  deployment_configs {
    production {
      compatibility_date  = "2024-01-01"
      compatibility_flags = []
    }
  }
}
```

#### 2. Custom Domain (`cloudflare-pages-domain.tf`)

```terraform
resource "cloudflare_pages_domain" "admin_app" {
  account_id   = var.cloudflare_account_id
  project_name = cloudflare_pages_project.admin_app.name
  domain       = "form-admin-app-${var.environment}.${var.root_domain}"
}

resource "cloudflare_record" "admin_app_cname" {
  zone_id = var.cloudflare_zone_id
  name    = "form-admin-app-${var.environment}"
  type    = "CNAME"
  value   = cloudflare_pages_project.admin_app.subdomain
  proxied = true
  ttl     = 1
  comment = "Custom domain for admin-app ${var.environment} environment"
}
```

#### 3. Backend State Storage

Each environment has its own Terraform state container in Azure:
- Dev: `dculus-forms-cloudflare-pages-admin-dev-state`
- Staging: `dculus-forms-cloudflare-pages-admin-staging-state`
- Production: `dculus-forms-cloudflare-pages-admin-production-state`

## GitHub Actions Deployment Workflow

### Workflow Jobs

The deployment consists of two main jobs:

#### 1. `terraform-cloudflare-pages-admin`

**Purpose**: Provisions Cloudflare Pages infrastructure for admin-app

**Responsibilities**:
- Creates Cloudflare Pages project
- Configures custom domain (`admin-app-{env}.dculus.com`)
- Sets up DNS CNAME record
- Manages Terraform state in Azure

**Dependencies**:
- `determine-environment`
- `setup-azure-backend`
- `terraform-infrastructure-deploy`

**Outputs**:
- `pages_project_name`: Name of the Cloudflare Pages project
- `pages_url`: Default Cloudflare Pages URL (*.pages.dev)
- `custom_domain`: Custom domain URL

#### 2. `deploy-cloudflare-pages-admin-app`

**Purpose**: Builds and deploys admin-app to Cloudflare Pages

**Build Process**:
1. Downloads release source code from Git tag
2. Installs pnpm dependencies
3. Builds shared packages (`@dculus/types`, `@dculus/utils`, `@dculus/ui`)
4. Builds admin-app with environment variables:
   - `VITE_GRAPHQL_URL`: Backend GraphQL endpoint
   - `VITE_API_URL`: Backend API URL
   - `VITE_CDN_ENDPOINT`: Public CDN endpoint
5. Deploys to Cloudflare Pages via Wrangler CLI

**Health Checks**:
- Waits 60 seconds for DNS propagation
- Retries up to 5 times with 30-second intervals
- Validates HTTP 200 response from custom domain

**Dependencies**:
- `determine-environment`
- `terraform-infrastructure-deploy`
- `terraform-cloudflare-service-domain`
- `terraform-cloudflare-pages-admin`

## CORS Configuration

The Azure backend is pre-configured to accept requests from admin-app origins. This is managed in `infrastructure/multi-cloud/terraform/azure/main.tf`:

```terraform
locals {
  # Dynamically generate frontend URLs based on environment
  form_app_domain    = "form-app-${var.environment}.${var.root_domain}"
  form_viewer_domain = "form-viewer-${var.environment}.${var.root_domain}"
  admin_app_domain   = "admin-app-${var.environment}.${var.root_domain}"
  
  # Build CORS origins dynamically
  frontend_domains = [
    "https://${local.form_app_domain}",
    "https://${local.form_viewer_domain}",
    "https://${local.admin_app_domain}"  # ✅ Admin app included
  ]
  
  # For production, also include apex domain aliases
  production_domains = var.environment == "production" ? [
    "https://form-app.${var.root_domain}",
    "https://form-viewer.${var.root_domain}",
    "https://admin-app.${var.root_domain}"
  ] : []
  
  # Development localhost URLs (only for dev/staging)
  localhost_origins = var.environment != "production" ? [
    "http://localhost:3000",  # form-app
    "http://localhost:3002",  # admin-app
    "http://localhost:5173"   # form-viewer
  ] : []
}
```

**Key Points**:
- Environment-specific URLs are automatically generated
- Production includes apex domain aliases
- Localhost origins enabled for dev/staging only
- All origins combined and passed to backend as `CORS_ORIGINS` env var

## Deployment Steps

### Prerequisites

1. **GitHub Secrets** (already configured):
   - `AZURE_CLIENT_ID`
   - `AZURE_TENANT_ID`
   - `AZURE_SUBSCRIPTION_ID`
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
   - `CLOUDFLARE_ZONE_ID`

2. **Azure Resources**:
   - Resource group: `dculus-global-terraform-assets-resource-grp`
   - Storage account: `dculusterraformstates`
   - Containers (auto-created):
     - `dculus-forms-cloudflare-pages-admin-dev-state`
     - `dculus-forms-cloudflare-pages-admin-staging-state`
     - `dculus-forms-cloudflare-pages-admin-production-state`

### Manual Deployment

Use the GitHub Actions workflow dispatch:

```bash
# Navigate to: Actions > Multi-Cloud Deployment (Cloudflare R2 + Azure Container Apps)

# Fill in:
# - Environment: dev | staging | production
# - Release tag: v1.2.3 (must exist as Git tag)
# - Deploy Cloudflare: ✅
# - Deploy Azure: ✅ (if backend changes needed)
# - Deploy MongoDB: ✅ (if database changes needed)
```

### Automated Deployment

The workflow can be triggered via:
1. Manual workflow dispatch (as above)
2. Pull requests (plan-only mode, no apply)

## Environment Variables

### Build-time Variables (Vite)

Admin-app uses the following environment variables during build:

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_GRAPHQL_URL` | Backend GraphQL endpoint | `https://form-services-dev.dculus.com/graphql` |
| `VITE_API_URL` | Backend API URL | `https://form-services-dev.dculus.com` |
| `VITE_CDN_ENDPOINT` | Public CDN for static files | `https://public-cdn-dev.dculus.com` |

These are injected during the build step in the GitHub Actions workflow.

## Verification & Health Checks

### Post-Deployment Verification

1. **Custom Domain Check**:
   ```bash
   curl -I https://form-admin-app-dev.dculus.com
   # Expected: HTTP/2 200
   ```

2. **Backend Connectivity**:
   ```bash
   # From admin-app browser console
   fetch('https://form-services-dev.dculus.com/graphql', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ query: '{ __typename }' })
   })
   ```

3. **CORS Verification**:
   ```bash
   curl -I https://form-services-dev.dculus.com/graphql \
     -H "Origin: https://form-admin-app-dev.dculus.com" \
     -H "Access-Control-Request-Method: POST"
   # Expected: Access-Control-Allow-Origin header present
   ```

### Deployment Summary

After successful deployment, the GitHub Actions summary includes:

```markdown
## 🔧 admin-app Deployment (Cloudflare Pages)

- **Project**: `form-admin-app-dev`
- **Custom Domain**: [https://form-admin-app-dev.dculus.com](https://form-admin-app-dev.dculus.com)
- **Pages URL**: [https://form-admin-app-dev-xxx.pages.dev](https://form-admin-app-dev-xxx.pages.dev)
- **Backend**: `https://form-services-dev.dculus.com`
- **Status**: ✅ Deployed and health check passed
```

## Troubleshooting

### Common Issues

#### 1. DNS Not Resolving

**Symptom**: `form-admin-app-{env}.dculus.com` doesn't resolve

**Solution**:
- Check Cloudflare DNS records in dashboard
- Verify CNAME record points to Pages subdomain
- Allow up to 60 seconds for propagation

#### 2. CORS Errors

**Symptom**: GraphQL requests fail with CORS error

**Solution**:
- Verify backend CORS configuration in Azure Container App
- Check `CORS_ORIGINS` environment variable includes admin-app URL
- Ensure backend redeploy after CORS changes

#### 3. Build Failures

**Symptom**: Build step fails in GitHub Actions

**Solution**:
- Check shared package builds complete successfully
- Verify environment variables are set correctly
- Review build logs for TypeScript errors

#### 4. Health Check Failures

**Symptom**: Health check retries exhaust and fail

**Solution**:
- Check Cloudflare Pages deployment status in dashboard
- Verify DNS propagation completed
- Manually test URL in browser

### Useful Commands

```bash
# Check Terraform state
cd infrastructure/multi-cloud/terraform/cloudflare-pages-admin/environments/dev
terraform init
terraform state list

# Validate Terraform configuration
terraform validate

# Plan without applying
terraform plan

# View outputs
terraform output

# Check Cloudflare Pages deployments
wrangler pages deployments list --project-name=admin-app-dev

# Test custom domain
curl -v https://form-admin-app-dev.dculus.com
```

## Rollback Strategy

### Rolling Back a Deployment

1. **Identify Previous Release**:
   ```bash
   git tag --sort=-version:refname | head -n 5
   ```

2. **Trigger Deployment with Previous Tag**:
   - Use GitHub Actions workflow dispatch
   - Select same environment
   - Provide previous working tag (e.g., `v1.2.2` instead of `v1.2.3`)

3. **Terraform State Rollback** (if infrastructure changed):
   ```bash
   # List state versions
   az storage blob list \
     --container-name dculus-forms-cloudflare-pages-admin-dev-state \
     --account-name dculusterraformstates

   # Download previous state (if needed)
   az storage blob download \
     --container-name dculus-forms-cloudflare-pages-admin-dev-state \
     --name terraform.tfstate \
     --file terraform.tfstate.backup
   ```

## Maintenance

### Regular Maintenance Tasks

1. **Update Terraform Providers**:
   ```bash
   cd infrastructure/multi-cloud/terraform/cloudflare-pages-admin
   terraform init -upgrade
   ```

2. **Review Terraform State**:
   - Periodically check state file size
   - Verify no drift between infrastructure and state

3. **Monitor Deployments**:
   - Check Cloudflare Pages analytics
   - Review GitHub Actions workflow runs
   - Monitor Azure storage costs for Terraform state

### Updating Infrastructure

When making infrastructure changes:

1. Create feature branch
2. Update Terraform files
3. Create PR (triggers plan-only workflow)
4. Review Terraform plan output
5. Merge PR
6. Manually deploy via workflow dispatch

## Related Documentation

- [Multi-Cloud Deployment Guide](./MULTI_CLOUD_DEPLOYMENT_GUIDE.md)
- [Terraform Quick Start](./QUICK_START.md)
- [Backend CORS Configuration](../azure/README.md)
- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review GitHub Actions workflow logs
3. Consult Cloudflare Pages dashboard
4. Check Azure Container Apps CORS configuration
5. Contact DevOps team

---

**Last Updated**: 2025-01-13  
**Version**: 1.0.0  
**Maintainer**: DevOps Team

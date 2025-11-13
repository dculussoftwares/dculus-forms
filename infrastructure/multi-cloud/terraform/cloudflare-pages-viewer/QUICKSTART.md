# Viewer App Deployment Quick Reference

## 🚀 Quick Deploy

```bash
# Tag and deploy to dev
git tag v1.2.4-dev.1
git push origin v1.2.4-dev.1

# Tag and deploy to staging
git tag v1.2.4-staging.1
git push origin v1.2.4-staging.1

# Tag and deploy to production
git tag v1.2.4
git push origin v1.2.4
```

## 🌐 URLs

| Environment | URL |
|-------------|-----|
| **Dev** | https://viewer-app-dev.dculus.com |
| **Staging** | https://viewer-app-staging.dculus.com |
| **Production** | https://viewer-app.dculus.com |

## 📁 Key Files

```
infrastructure/multi-cloud/terraform/cloudflare-pages-viewer/
├── main.tf                     # Cloudflare Pages project
├── variables.tf                # Terraform variables
├── outputs.tf                  # Terraform outputs
├── cloudflare-pages-domain.tf  # Custom domain config
└── environments/
    ├── dev/backend.tf
    ├── staging/backend.tf
    └── production/backend.tf
```

## 🔧 Manual Terraform Commands

```bash
# Navigate to environment
cd infrastructure/multi-cloud/terraform/cloudflare-pages-viewer/environments/production

# Copy shared files
cp ../../{main,variables,outputs,cloudflare-pages-domain}.tf .

# Initialize
terraform init

# Plan
terraform plan \
  -var="environment=production" \
  -var="cloudflare_account_id=${CLOUDFLARE_ACCOUNT_ID}" \
  -var="cloudflare_api_token=${CLOUDFLARE_API_TOKEN}" \
  -var="cloudflare_zone_id=${CLOUDFLARE_ZONE_ID}"

# Apply
terraform apply \
  -var="environment=production" \
  -var="cloudflare_account_id=${CLOUDFLARE_ACCOUNT_ID}" \
  -var="cloudflare_api_token=${CLOUDFLARE_API_TOKEN}" \
  -var="cloudflare_zone_id=${CLOUDFLARE_ZONE_ID}"
```

## 📦 Manual Build & Deploy

```bash
# Install dependencies
pnpm install

# Build shared packages
pnpm --filter @dculus/types build
pnpm --filter @dculus/utils build
pnpm --filter @dculus/ui build

# Build form-viewer
pnpm --filter form-viewer build

# Deploy to Cloudflare Pages
wrangler pages deploy apps/form-viewer/dist \
  --project-name=viewer-app-production \
  --branch=main
```

## 🩺 Health Checks

```bash
# Check HTTP status
curl -I https://viewer-app.dculus.com

# Check GraphQL connectivity
curl -X POST https://api-production.dculus.com/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __typename }"}'

# Check DNS
dig viewer-app.dculus.com
```

## 🔄 Rollback

```bash
# List deployments
wrangler pages deployment list --project-name=viewer-app-production

# Rollback to specific deployment
wrangler pages deployment rollback <deployment-id> --project-name=viewer-app-production
```

## 📊 Monitoring

- **GitHub Actions**: https://github.com/natheeshkumar/dculus-forms/actions
- **Cloudflare Dashboard**: https://dash.cloudflare.com/{ACCOUNT_ID}/pages/view/viewer-app-production
- **Application**: https://viewer-app.dculus.com

## 🐛 Common Issues

**DNS not resolving**:
```bash
# Wait 1-5 minutes for propagation
watch -n 10 dig viewer-app.dculus.com
```

**CORS errors**:
```bash
# Verify backend allows viewer-app domain
cd infrastructure/multi-cloud/terraform/azure/environments/production
terraform output cors_allowed_origins
```

**Build failures**:
```bash
# Test locally
pnpm --filter form-viewer build

# Check environment variables
echo $VITE_GRAPHQL_URL
echo $VITE_API_URL
```

## 📖 Documentation

- [Full Deployment Guide](./VIEWER_APP_DEPLOYMENT.md)
- [Implementation Summary](../../../../VIEWER_APP_IMPLEMENTATION_SUMMARY.md)
- [GitHub Workflow](../../../../.github/workflows/multi-cloud-deployment.yml)

---

**Last Updated**: 2025-01-12

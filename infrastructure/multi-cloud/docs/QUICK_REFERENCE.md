# Custom Domain Configuration - Quick Reference

## 🚀 Quick Start

### Automatic (via Pipeline)
1. Push changes to trigger workflow
2. Workflow automatically configures domain and certificate
3. Verify at: `https://form-services-{env}.dculus.com/health`

### Manual Execution
```bash
# Set environment
export ENVIRONMENT="dev"
export RESOURCE_GROUP="dculus-forms-dev-rg"
export CONTAINER_APP_NAME="dculus-forms-dev-backend"
export CONTAINER_ENV_NAME="dculus-forms-dev-env"
export CUSTOM_DOMAIN="form-services-dev.dculus.com"
export CLOUDFLARE_ZONE_ID="<your-zone-id>"
export CLOUDFLARE_API_TOKEN="<your-api-token>"

# Run script
./.github/scripts/configure-azure-custom-domain.sh
```

## 📋 Verification Checklist

### Check Custom Domain
```bash
az containerapp hostname list \
  --name dculus-forms-dev-backend \
  --resource-group dculus-forms-dev-rg \
  --output table
```
✅ Expected: `BindingType: SniEnabled`

### Check Certificate
```bash
az containerapp env certificate list \
  --name dculus-forms-dev-env \
  --resource-group dculus-forms-dev-rg \
  --managed-certificates-only \
  --output table
```
✅ Expected: `ProvisioningState: Succeeded`

### Test HTTPS Endpoint
```bash
curl -I https://form-services-dev.dculus.com/health
```
✅ Expected: `HTTP/2 200`

### Check DNS
```bash
dig form-services-dev.dculus.com +short
```
✅ Expected: Cloudflare IPs (172.67.x.x, 104.21.x.x)

## 🔧 Common Commands

### View Container App Details
```bash
az containerapp show \
  --name dculus-forms-dev-backend \
  --resource-group dculus-forms-dev-rg \
  --query "{fqdn: properties.configuration.ingress.fqdn, customDomains: properties.configuration.ingress.customDomains}"
```

### View All Certificates
```bash
az containerapp env certificate list \
  --name dculus-forms-dev-env \
  --resource-group dculus-forms-dev-rg \
  --output table
```

### Remove Custom Domain
```bash
az containerapp hostname delete \
  --hostname form-services-dev.dculus.com \
  --name dculus-forms-dev-backend \
  --resource-group dculus-forms-dev-rg
```

### Delete Certificate
```bash
az containerapp env certificate delete \
  --name <certificate-name> \
  --environment dculus-forms-dev-env \
  --resource-group dculus-forms-dev-rg
```

## 🌐 Environment URLs

| Environment | Custom Domain | Default FQDN |
|------------|---------------|--------------|
| **Dev** | https://form-services-dev.dculus.com | https://dculus-forms-dev-backend.ashybush-*.eastus.azurecontainerapps.io |
| **Staging** | https://form-services-staging.dculus.com | https://dculus-forms-staging-backend.*.eastus.azurecontainerapps.io |
| **Production** | https://form-services.dculus.com | https://dculus-forms-backend.*.eastus.azurecontainerapps.io |

## 🐛 Troubleshooting Quick Fixes

### Certificate Stuck in "Pending"
```bash
# Check if Cloudflare proxy is disabled
dig form-services-dev.dculus.com A +short
# Should show Azure IP (134.33.x.x), not Cloudflare IPs

# If showing Cloudflare IPs, disable proxy:
# 1. Go to Cloudflare Dashboard
# 2. DNS > Records
# 3. Click orange cloud to make it grey
# 4. Wait 2-3 minutes
# 5. Re-run script
```

### HTTPS Shows 525 Error
```bash
# 1. Verify certificate is bound
az containerapp hostname list --name dculus-forms-dev-backend --resource-group dculus-forms-dev-rg

# 2. Check Cloudflare SSL/TLS mode
# Go to Cloudflare Dashboard > SSL/TLS > Overview
# Set to "Full" or "Full (strict)"

# 3. Wait 2-5 minutes for propagation
```

### Script Fails to Create TXT Record
```bash
# Verify Cloudflare credentials
echo $CLOUDFLARE_API_TOKEN  # Should not be empty
echo $CLOUDFLARE_ZONE_ID    # Should not be empty

# Test API access
curl -X GET "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" | jq '.success'
# Should return: true
```

## 📊 Pipeline Status

View deployment status:
- **GitHub Actions**: https://github.com/yourusername/dculus-forms/actions
- **Workflow**: Multi-Cloud Deployment (Cloudflare R2 + Azure Container Apps)
- **Job**: Configure Custom Domain & Certificate

## 🔐 Required Permissions

### Azure
- Container Apps Contributor
- Managed Identity Operator (for OIDC)
- Reader on Resource Group

### Cloudflare
- API Token with permissions:
  - Zone:DNS:Edit
  - Zone:Zone:Read

### GitHub
- OIDC authentication configured
- Secrets configured:
  - `AZURE_CLIENT_ID`
  - `AZURE_TENANT_ID`
  - `AZURE_SUBSCRIPTION_ID`
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ZONE_ID`

## 📚 Documentation

- **Full Setup Guide**: [CUSTOM_DOMAIN_SETUP.md](./CUSTOM_DOMAIN_SETUP.md)
- **Deployment Summary**: [DEPLOYMENT_SUMMARY.md](./DEPLOYMENT_SUMMARY.md)
- **Configuration Script**: [.github/scripts/configure-azure-custom-domain.sh](../../../.github/scripts/configure-azure-custom-domain.sh)
- **Workflow**: [.github/workflows/multi-cloud-deployment.yml](../../../.github/workflows/multi-cloud-deployment.yml)

## 🆘 Getting Help

### View Script Logs
```bash
# During pipeline execution, check GitHub Actions logs
# Look for job: "Configure Custom Domain & Certificate"
```

### View Container App Logs
```bash
az containerapp logs show \
  --name dculus-forms-dev-backend \
  --resource-group dculus-forms-dev-rg \
  --follow
```

### Check Certificate Details
```bash
az containerapp env certificate show \
  --name mc-dculus-forms-dev-backend-form-services-dev-dculus-com \
  --environment dculus-forms-dev-env \
  --resource-group dculus-forms-dev-rg
```

## ⚡ Performance Tips

1. **Certificate Provisioning**: Takes 5-15 minutes on first run
2. **DNS Propagation**: Allow 2-5 minutes after proxy changes
3. **Pipeline Execution**: Full deployment takes ~20-30 minutes
4. **Subsequent Runs**: Much faster if certificate already exists

## 🎯 Success Indicators

✅ Pipeline job "Configure Custom Domain & Certificate" shows green checkmark
✅ Custom domain returns HTTP 200 on HTTPS
✅ Certificate binding shows "SniEnabled"
✅ Certificate provisioning state is "Succeeded"
✅ Cloudflare proxy is enabled (orange cloud)
✅ DNS resolves to Cloudflare IPs

## 🔄 Rollback Procedure

If something goes wrong:

```bash
# 1. Remove custom domain
az containerapp hostname delete \
  --hostname form-services-dev.dculus.com \
  --name dculus-forms-dev-backend \
  --resource-group dculus-forms-dev-rg

# 2. Delete certificate (optional)
az containerapp env certificate delete \
  --name mc-dculus-forms-dev-backend-form-services-dev-dculus-com \
  --environment dculus-forms-dev-env \
  --resource-group dculus-forms-dev-rg

# 3. Re-run pipeline or script
```

---

**Last Updated**: November 12, 2025
**Version**: 1.0.0

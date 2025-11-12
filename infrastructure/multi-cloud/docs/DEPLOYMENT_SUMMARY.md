# Custom Domain and Certificate Deployment Summary

## Overview

Successfully configured custom domain `form-services-dev.dculus.com` with Azure managed SSL/TLS certificate for the Azure Container Apps backend.

## What Was Implemented

### 1. Automated Configuration Script
**Location**: `.github/scripts/configure-azure-custom-domain.sh`

**Features**:
- Domain ownership verification via TXT records
- Custom hostname configuration
- Managed certificate creation with HTTP validation
- Automatic Cloudflare proxy management
- Certificate binding with retry logic
- Comprehensive error handling and logging

### 2. GitHub Actions Workflow Integration
**Modified File**: `.github/workflows/multi-cloud-deployment.yml`

**New Job**: `configure-azure-custom-domain`
- Runs after Cloudflare DNS and Azure Container Apps deployment
- Automatically configures domain and certificate
- Displays configuration summary
- Integrated into deployment status reporting

### 3. Documentation
**Created Files**:
- `infrastructure/multi-cloud/docs/CUSTOM_DOMAIN_SETUP.md` - Complete setup guide
- `infrastructure/multi-cloud/docs/DEPLOYMENT_SUMMARY.md` - This file

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Multi-Cloud Pipeline                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
    ┌─────────────────────────────────────────────────────────┐
    │  1. MongoDB Atlas Deployment (Terraform)                │
    └─────────────────────────────────────────────────────────┘
                              ↓
    ┌─────────────────────────────────────────────────────────┐
    │  2. Cloudflare R2 Deployment (Terraform)                │
    └─────────────────────────────────────────────────────────┘
                              ↓
    ┌─────────────────────────────────────────────────────────┐
    │  3. Azure Container Apps Deployment (Terraform)         │
    │     - Backend: dculus-forms-dev-backend                 │
    │     - FQDN: *.ashybush-431ea12f.eastus.azure...        │
    └─────────────────────────────────────────────────────────┘
                              ↓
    ┌─────────────────────────────────────────────────────────┐
    │  4. Cloudflare DNS (Form Services) (Terraform)          │
    │     - CNAME: form-services-dev.dculus.com              │
    │     - Target: *.ashybush-431ea12f.eastus.azure...      │
    │     - Proxied: True (Cloudflare CDN enabled)           │
    └─────────────────────────────────────────────────────────┘
                              ↓
    ┌─────────────────────────────────────────────────────────┐
    │  5. Configure Custom Domain & Certificate (Azure CLI)   │
    │     ✓ Domain Verification (TXT record)                  │
    │     ✓ Add Custom Hostname                               │
    │     ✓ Temporarily Disable CF Proxy                      │
    │     ✓ Create Managed Certificate                        │
    │     ✓ Wait for Certificate Provisioning                 │
    │     ✓ Bind Certificate to Hostname                      │
    │     ✓ Re-enable CF Proxy                                │
    └─────────────────────────────────────────────────────────┘
                              ↓
    ┌─────────────────────────────────────────────────────────┐
    │  6. Health Checks                                        │
    │     - Backend health endpoint                           │
    │     - GraphQL endpoint                                  │
    └─────────────────────────────────────────────────────────┘
```

## Configuration Details

### Custom Domain
- **Domain**: `form-services-dev.dculus.com`
- **Container App**: `dculus-forms-dev-backend`
- **Resource Group**: `dculus-forms-dev-rg`
- **Environment**: `dculus-forms-dev-env`

### Managed Certificate
- **Name**: `mc-dculus-forms-dev-backend-form-services-dev-dculus-com`
- **Subject**: `form-services-dev.dculus.com`
- **Validation Method**: HTTP
- **Provisioning State**: Succeeded
- **Binding Type**: SniEnabled

### DNS Configuration
- **Primary CNAME**: `form-services-dev.dculus.com` → `dculus-forms-dev-backend.ashybush-431ea12f.eastus.azurecontainerapps.io`
- **Verification TXT**: `asuid.form-services-dev.dculus.com` → Azure Verification ID
- **Cloudflare Proxy**: Enabled (orange cloud)

## Verification Steps Completed

1. ✅ **Custom Hostname Added**
   ```bash
   az containerapp hostname list --name dculus-forms-dev-backend --resource-group dculus-forms-dev-rg
   ```
   Result: `form-services-dev.dculus.com` with `BindingType: SniEnabled`

2. ✅ **Certificate Provisioned**
   ```bash
   az containerapp env certificate list --name dculus-forms-dev-env --resource-group dculus-forms-dev-rg --managed-certificates-only
   ```
   Result: Certificate in `Succeeded` state

3. ✅ **HTTPS Endpoint Accessible**
   ```bash
   curl -I https://form-services-dev.dculus.com/health
   ```
   Result: HTTP/2 200 OK with valid SSL certificate

4. ✅ **DNS Resolution**
   ```bash
   dig form-services-dev.dculus.com
   ```
   Result: Resolves to Cloudflare IPs (proxied)

## Pipeline Integration

### Execution Order
1. `determine-environment` - Set environment variables
2. `setup-azure-backend` - Create Terraform state storage
3. `terraform-mongodb-deploy` - Deploy database
4. `terraform-cloudflare-deploy` - Deploy R2 storage
5. `terraform-azure-deploy` - Deploy Container Apps
6. `terraform-cloudflare-service-domain` - Create DNS records ⬅️ DNS setup
7. `configure-azure-custom-domain` - Configure domain & certificate ⬅️ **NEW**
8. `health-checks` - Validate deployment
9. `deployment-summary` - Generate report

### Environment-Specific Configuration

The script automatically configures domains for each environment:

| Environment | Custom Domain | Container App | Certificate Name |
|------------|---------------|---------------|------------------|
| dev | form-services-dev.dculus.com | dculus-forms-dev-backend | mc-dculus-forms-dev-backend-form-services-dev-dculus-com |
| staging | form-services-staging.dculus.com | dculus-forms-staging-backend | mc-dculus-forms-staging-backend-form-services-staging-dculus-com |
| production | form-services.dculus.com | dculus-forms-backend | mc-dculus-forms-backend-form-services-dculus-com |

## Script Workflow Details

### Phase 1: Domain Verification
1. Retrieve Azure domain verification ID from Container App
2. Create/update Cloudflare TXT record for ownership verification
3. Wait for DNS propagation (15 seconds)
4. Verify TXT record is resolvable

### Phase 2: Hostname Configuration
1. Check if hostname already exists on Container App
2. Add custom hostname to Container App ingress
3. Azure validates ownership via TXT record

### Phase 3: Certificate Provisioning
1. Get Cloudflare CNAME record details
2. Temporarily disable Cloudflare proxy (required for HTTP validation)
3. Wait for DNS propagation (30 seconds)
4. Create managed certificate with HTTP validation method
5. Poll certificate status every 15 seconds (max 5 minutes)
6. Wait until state is "Succeeded"

### Phase 4: Certificate Binding
1. Retrieve certificate ID from managed environment
2. Bind certificate to custom hostname
3. Update binding type to "SniEnabled"

### Phase 5: Restore Cloudflare Proxy
1. Re-enable Cloudflare proxy (orange cloud)
2. Cloudflare handles SSL termination and CDN

### Phase 6: Verification
1. Check hostname binding status
2. Get certificate provisioning state
3. Test HTTPS endpoint accessibility

## Key Technical Decisions

### Why Azure CLI Instead of Terraform?

**Reasons**:
1. **Dynamic Certificate Provisioning**: Terraform `azurerm_container_app_custom_domain` requires pre-existing certificate ID
2. **Validation Complexity**: HTTP validation requires temporary DNS changes (disable Cloudflare proxy)
3. **Timing Dependencies**: Certificate provisioning is asynchronous (5-15 minutes)
4. **State Management**: Easier to handle retry logic and status polling with bash script

**Terraform Limitation**:
```hcl
resource "azurerm_container_app_custom_domain" "example" {
  # Requires certificate_id upfront - but certificate doesn't exist yet!
  certificate_id = azurerm_container_app_managed_certificate.example.id
  # Creates circular dependency and complex provisioning order
}
```

**Azure CLI Approach**:
```bash
# Step-by-step process with validation between each step
1. Add hostname (without certificate)
2. Create certificate (async)
3. Wait for provisioning
4. Bind certificate when ready
```

### Why Temporarily Disable Cloudflare Proxy?

Azure's HTTP validation needs to:
- Access the Container App's default FQDN directly
- Place a validation file at `/.well-known/acme-challenge/`
- Verify ownership via HTTP challenge

When Cloudflare proxy is enabled:
- DNS resolves to Cloudflare IPs (not Azure IPs)
- Azure's validation server cannot reach the origin directly
- HTTP challenge fails

Solution:
- Disable proxy temporarily (grey cloud)
- Azure validates domain
- Re-enable proxy after certificate is bound

## Security Considerations

### Certificate Management
- **Azure Managed**: No manual certificate handling required
- **Automatic Renewal**: Azure handles certificate lifecycle
- **SNI Binding**: Modern TLS with Server Name Indication

### Domain Verification
- **TXT Record**: Proves ownership of domain
- **HTTP Challenge**: Validates control of web server
- **OIDC Authentication**: GitHub Actions uses Azure OIDC (no secrets in repo)

### Cloudflare Integration
- **DDoS Protection**: Cloudflare absorbs attacks
- **WAF Rules**: Web Application Firewall protection
- **SSL/TLS**: End-to-end encryption (Cloudflare → Azure → App)

## Monitoring and Maintenance

### Health Checks
- Pipeline includes automated health checks after deployment
- Tests both HTTP and HTTPS endpoints
- Validates GraphQL API accessibility

### Certificate Monitoring
```bash
# Check certificate expiry
az containerapp env certificate show \
  --name <cert-name> \
  --environment dculus-forms-dev-env \
  --resource-group dculus-forms-dev-rg \
  --query "properties.expirationDate"
```

### Log Access
```bash
# View Container App logs
az containerapp logs show \
  --name dculus-forms-dev-backend \
  --resource-group dculus-forms-dev-rg \
  --follow
```

## Cost Analysis

| Resource | Cost |
|----------|------|
| Azure Managed Certificate | Free |
| Custom Domain Binding | Free |
| Cloudflare DNS (Free plan) | Free |
| Cloudflare Proxy/CDN (Free plan) | Free |
| **Total Additional Cost** | **$0.00** |

## Troubleshooting Guide

### Issue: Certificate Stuck in "Pending"
**Cause**: Cloudflare proxy enabled during validation

**Fix**: The script automatically handles this, but if running manually:
1. Disable Cloudflare proxy (set to DNS-only)
2. Wait for certificate to provision
3. Re-enable proxy after binding

### Issue: "Certificate not in succeeded provisioning state"
**Cause**: Attempting to bind before provisioning completes

**Fix**: Script now includes wait loop (up to 5 minutes)

### Issue: HTTPS endpoint shows 525 error
**Cause**: Certificate not bound or SSL/TLS mode misconfigured

**Fix**:
1. Verify binding: `az containerapp hostname list`
2. Check Cloudflare SSL/TLS mode: "Full" or "Full (strict)"
3. Wait 2-5 minutes for propagation

## Next Steps

### For Other Environments

To configure staging or production:

1. **Update DNS**: Terraform will create CNAME records automatically
2. **Run Pipeline**: GitHub Actions will execute configuration script
3. **Verify**: Check custom domain and certificate status

### Manual Execution

If needed, run the script manually:

```bash
# Export environment variables
export ENVIRONMENT="staging"
export RESOURCE_GROUP="dculus-forms-staging-rg"
export CONTAINER_APP_NAME="dculus-forms-staging-backend"
export CONTAINER_ENV_NAME="dculus-forms-staging-env"
export CUSTOM_DOMAIN="form-services-staging.dculus.com"
export CLOUDFLARE_ZONE_ID="<your-zone-id>"
export CLOUDFLARE_API_TOKEN="<your-api-token>"

# Run configuration script
./.github/scripts/configure-azure-custom-domain.sh
```

## Testing the Deployment

### Basic Health Check
```bash
curl https://form-services-dev.dculus.com/health
```

Expected output:
```json
{"status":"healthy","timestamp":"2025-11-12T01:56:00.000Z","environment":"dev"}
```

### GraphQL Endpoint
```bash
curl -X POST https://form-services-dev.dculus.com/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __typename }"}'
```

Expected output:
```json
{"data":{"__typename":"Query"}}
```

### SSL Certificate Verification
```bash
openssl s_client -connect form-services-dev.dculus.com:443 -servername form-services-dev.dculus.com < /dev/null | openssl x509 -noout -dates
```

Expected output:
```
notBefore=Nov 11 00:00:00 2025 GMT
notAfter=Feb 09 23:59:59 2026 GMT
```

## Success Metrics

✅ **Custom domain configured**: `form-services-dev.dculus.com`
✅ **Managed certificate provisioned**: Azure-managed SSL/TLS
✅ **Certificate binding enabled**: SNI with HTTPS
✅ **Cloudflare proxy active**: CDN and DDoS protection enabled
✅ **Health endpoint accessible**: HTTP 200 response
✅ **GraphQL endpoint working**: API responds correctly
✅ **Pipeline integrated**: Automated deployment workflow
✅ **Documentation complete**: Setup guide and troubleshooting

## References

- **Configuration Script**: `.github/scripts/configure-azure-custom-domain.sh`
- **GitHub Workflow**: `.github/workflows/multi-cloud-deployment.yml`
- **Setup Documentation**: `infrastructure/multi-cloud/docs/CUSTOM_DOMAIN_SETUP.md`
- **Azure Documentation**: https://learn.microsoft.com/en-us/azure/container-apps/custom-domains-managed-certificates
- **Cloudflare DNS API**: https://developers.cloudflare.com/api/operations/dns-records-for-a-zone-create-dns-record

---

**Deployment Date**: November 12, 2025
**Environment**: Development (dev)
**Status**: ✅ Successfully Completed

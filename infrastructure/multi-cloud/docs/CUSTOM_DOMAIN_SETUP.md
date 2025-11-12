# Azure Container Apps Custom Domain & Certificate Setup

This document explains how custom domains and managed certificates are configured for Azure Container Apps with Cloudflare DNS integration in the multi-cloud deployment pipeline.

## Overview

The setup involves:
1. **Cloudflare DNS**: CNAME record pointing custom domain to Azure Container App
2. **Azure Domain Verification**: TXT record for ownership verification
3. **Azure Managed Certificate**: Free SSL/TLS certificate managed by Azure
4. **Automatic Binding**: Certificate bound to custom domain hostname

## Architecture

```
User Request
    ↓
Cloudflare (SSL termination, CDN, DDoS protection)
    ↓
Azure Container App (Custom domain with managed certificate)
    ↓
Backend Application
```

### Domain Structure

- **Production**: `form-services.dculus.com` → `dculus-forms-backend.*.azurecontainerapps.io`
- **Staging**: `form-services-staging.dculus.com` → `dculus-forms-staging-backend.*.azurecontainerapps.io`
- **Development**: `form-services-dev.dculus.com` → `dculus-forms-dev-backend.*.azurecontainerapps.io`

## Deployment Process

### Pipeline Execution Order

1. **Terraform: Cloudflare DNS (Form Services)** - Creates CNAME record
2. **Configure Custom Domain & Certificate** - Adds domain and certificate to Azure Container App
3. **Health Checks** - Validates deployment

### Configuration Script

The custom domain configuration is automated via `.github/scripts/configure-azure-custom-domain.sh`:

#### Step-by-Step Process

1. **Get Azure Domain Verification ID**
   - Retrieves the unique verification ID from the Container App
   - Format: `asuid.{custom-domain}` TXT record

2. **Create/Update Cloudflare TXT Record**
   - Creates TXT record: `asuid.form-services-{env}.dculus.com`
   - Value: Azure verification ID
   - Waits for DNS propagation

3. **Add Custom Hostname**
   - Adds custom domain to Container App ingress configuration
   - Azure validates domain ownership via TXT record

4. **Temporarily Disable Cloudflare Proxy**
   - Changes CNAME from proxied (orange cloud) to DNS-only (grey cloud)
   - Required for Azure HTTP validation to work
   - Waits 30 seconds for DNS propagation

5. **Create Managed Certificate**
   - Uses HTTP validation method
   - Azure provisions free SSL/TLS certificate
   - Can take 5-15 minutes to complete

6. **Wait for Certificate Provisioning**
   - Polls certificate status every 15 seconds
   - Maximum wait time: 5 minutes
   - States: `Pending` → `Succeeded` or `Failed`

7. **Bind Certificate to Hostname**
   - Associates the managed certificate with custom domain
   - Updates hostname binding type to `SniEnabled`

8. **Re-enable Cloudflare Proxy**
   - Restores proxied status (orange cloud)
   - Cloudflare handles SSL termination and CDN

9. **Verification**
   - Checks binding status
   - Tests HTTPS endpoint
   - Displays configuration summary

## Environment Variables

The script requires the following environment variables:

```bash
ENVIRONMENT="dev|staging|production"
RESOURCE_GROUP="dculus-forms-{env}-rg"
CONTAINER_APP_NAME="dculus-forms-{env}-backend"
CONTAINER_ENV_NAME="dculus-forms-{env}-env"
CUSTOM_DOMAIN="form-services-{env}.dculus.com"
CLOUDFLARE_ZONE_ID="<cloudflare-zone-id>"
CLOUDFLARE_API_TOKEN="<cloudflare-api-token>"
```

## GitHub Actions Integration

### Workflow Job: `configure-azure-custom-domain`

```yaml
configure-azure-custom-domain:
  name: Configure Custom Domain & Certificate
  runs-on: ubuntu-latest
  needs: [terraform-azure-deploy, terraform-cloudflare-service-domain]
  environment: ${{ needs.determine-environment.outputs.environment }}
  steps:
    - name: Checkout code
    - name: Azure Login (OIDC)
    - name: Set environment variables
    - name: Run custom domain configuration script
    - name: Display configuration summary
```

### Dependencies

- **Runs after**: `terraform-cloudflare-service-domain` (DNS setup)
- **Runs before**: `health-checks` (endpoint validation)
- **Requires**: Azure CLI, Cloudflare API access, jq

## Manual Configuration

If needed, you can run the script manually:

```bash
# Set environment variables
export ENVIRONMENT="dev"
export RESOURCE_GROUP="dculus-forms-dev-rg"
export CONTAINER_APP_NAME="dculus-forms-dev-backend"
export CONTAINER_ENV_NAME="dculus-forms-dev-env"
export CUSTOM_DOMAIN="form-services-dev.dculus.com"
export CLOUDFLARE_ZONE_ID="your-zone-id"
export CLOUDFLARE_API_TOKEN="your-api-token"

# Run the script
./.github/scripts/configure-azure-custom-domain.sh
```

## Verification

### Check Custom Domain Status

```bash
# List custom hostnames
az containerapp hostname list \
  --name dculus-forms-dev-backend \
  --resource-group dculus-forms-dev-rg \
  --output table

# Expected output:
# Name                              BindingType    CertificateId
# --------------------------------  -------------  ----------------
# form-services-dev.dculus.com      SniEnabled     /subscriptions/.../managedCertificates/...
```

### Check Certificate Status

```bash
# List managed certificates
az containerapp env certificate list \
  --name dculus-forms-dev-env \
  --resource-group dculus-forms-dev-rg \
  --managed-certificates-only \
  --output table

# Expected output:
# Name                                          SubjectName                      ProvisioningState
# --------------------------------------------  -------------------------------  -------------------
# mc-dculus-forms-dev-backend-form-services...  form-services-dev.dculus.com     Succeeded
```

### Test HTTPS Endpoint

```bash
# Test health endpoint
curl -v https://form-services-dev.dculus.com/health

# Expected: HTTP 200 with valid SSL certificate
```

### Check DNS Configuration

```bash
# Verify CNAME record
dig form-services-dev.dculus.com CNAME +short
# Output: dculus-forms-dev-backend.*.azurecontainerapps.io

# Verify TXT record
dig asuid.form-services-dev.dculus.com TXT +short
# Output: "1E4404CC17F83CCCA968DD44092A66EABBC9EA8875599971F350E76A7EDFCB79"

# Check resolved IP (when Cloudflare proxy is enabled)
dig form-services-dev.dculus.com A +short
# Output: Cloudflare IPs (172.67.x.x, 104.21.x.x)
```

## Troubleshooting

### Certificate Stuck in "Pending" State

**Cause**: Azure cannot validate domain ownership via HTTP challenge

**Solutions**:
1. Ensure Cloudflare proxy is disabled during certificate creation
2. Verify CNAME points directly to Azure Container App FQDN
3. Check Container App is accessible via HTTP (not just HTTPS)
4. Wait longer - provisioning can take up to 15 minutes

### "Certificate is not in succeeded provisioning state" Error

**Cause**: Attempting to bind certificate before it's fully provisioned

**Solution**: The script now waits for certificate provisioning. If this still occurs, increase `MAX_WAIT` in the script.

### "Not found CNAME of hostname directly pointing to a default hostname" Error

**Cause**: Cloudflare proxy is enabled (orange cloud), preventing Azure from seeing the direct CNAME

**Solution**: The script automatically disables proxy during validation and re-enables it afterward.

### Domain Accessible via HTTP but HTTPS Shows Error

**Cause**: Certificate not properly bound or Cloudflare SSL mode misconfigured

**Solutions**:
1. Check certificate binding: `az containerapp hostname list`
2. Verify Cloudflare SSL/TLS mode is set to "Full" or "Full (strict)"
3. Wait for DNS propagation (up to 5 minutes)

### Script Fails to Create TXT Record

**Cause**: Invalid Cloudflare API token or zone ID

**Solutions**:
1. Verify `CLOUDFLARE_API_TOKEN` has "DNS:Edit" permission
2. Confirm `CLOUDFLARE_ZONE_ID` matches the domain zone
3. Check token is not expired

## SSL/TLS Configuration

### Cloudflare SSL Modes

- **Full**: Cloudflare to origin uses any SSL certificate (recommended)
- **Full (strict)**: Cloudflare to origin requires valid certificate
- **Flexible**: Not recommended (HTTP to origin, HTTPS to client only)

### Certificate Chain

```
Client → Cloudflare (Cloudflare certificate)
       → Azure Container App (Azure managed certificate)
       → Application
```

## Cost

- **Azure Managed Certificates**: Free
- **Cloudflare DNS**: Free (on Free plan)
- **Custom Domains**: No additional charge

## Security Considerations

1. **Domain Verification**: TXT record proves domain ownership
2. **Certificate Validation**: HTTP challenge validates control
3. **Automatic Renewal**: Azure manages certificate lifecycle
4. **Cloudflare Protection**: DDoS protection, WAF, rate limiting

## Maintenance

- **Certificate Renewal**: Automatic (Azure handles renewal)
- **DNS Changes**: Update via Terraform (Cloudflare module)
- **Domain Changes**: Re-run configuration script
- **Monitoring**: Check certificate expiry in Azure Portal

## References

- [Azure Container Apps Custom Domains](https://learn.microsoft.com/en-us/azure/container-apps/custom-domains-managed-certificates)
- [Cloudflare DNS Records](https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/)
- [Cloudflare SSL/TLS Settings](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/)

## Related Documentation

- [Multi-Cloud Deployment Pipeline](../README.md)
- [Terraform Cloudflare DNS Configuration](../terraform/cloudflare-service-domain/README.md)
- [Azure Container Apps Infrastructure](../terraform/azure/README.md)

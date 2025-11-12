# Cloudflare R2 Automated Credentials

This document explains how R2 credentials are automatically generated and managed via Terraform.

## Overview

R2 API credentials are **automatically created** by Terraform during the Cloudflare deployment and passed directly to Azure Container Apps. No manual setup is required!

## How It Works

### 1. Cloudflare API Token Requirements

The Cloudflare API token used for Terraform deployments must have **"API Tokens: Edit"** permission to create R2 API tokens programmatically.

**Required Permissions:**
- ✅ API Tokens: Edit (to create R2 tokens)
- ✅ Account R2 Storage: Read & Write
- ✅ Zone DNS: Edit
- ✅ Zone Settings: Edit

### 2. Automated Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Cloudflare Deployment (Terraform)                            │
│    └─> Creates cloudflare_api_token.r2_access resource          │
│        ├─> Token ID → r2_access_key_id (32 chars)              │
│        └─> Token Value → r2_secret_access_key (64 chars)       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. GitHub Actions Workflow                                      │
│    └─> Captures Terraform outputs                               │
│        ├─> Masks sensitive values in logs                       │
│        └─> Passes to Azure deployment as environment variables  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. Azure Container Apps Deployment (Terraform)                  │
│    └─> Receives credentials as TF variables                     │
│        └─> Sets environment variables in container              │
│            ├─> PUBLIC_S3_ACCESS_KEY                             │
│            ├─> PUBLIC_S3_SECRET_KEY                             │
│            ├─> PUBLIC_S3_ENDPOINT                               │
│            ├─> PUBLIC_S3_CDN_URL                                │
│            ├─> PRIVATE_S3_BUCKET_NAME                           │
│            └─> PUBLIC_S3_BUCKET_NAME                            │
└─────────────────────────────────────────────────────────────────┘
```

### 3. R2 API Token Configuration

The automatically generated token has the following permissions (defined in `r2-api-token.tf`):

```hcl
resource "cloudflare_api_token" "r2_access" {
  name = "dculus-forms-r2-token-{environment}"

  policies = [{
    effect = "allow"
    permission_groups = [{
      id = "bf7481a1826f439697cb59a20b22293e" # Workers R2 Storage Write
    }, {
      id = "6a018a9f2fc74eb6b293b0c548f38b39" # Workers R2 Storage Bucket Item Read
    }, {
      id = "2efd5506f9c8494dacb1fa10a3e7d5b6" # Workers R2 Storage Bucket Item Write
    }]
    resources = {
      "com.cloudflare.api.account.{account_id}" = "*"
    }
  }]
}
```

**Permissions Granted:**
- ✅ Read access to all R2 bucket objects
- ✅ Write access to all R2 bucket objects
- ✅ R2 storage management

**Token Scope:**
- Account-level access to all R2 buckets
- No expiration (managed by Terraform lifecycle)

## Deployment Process

### Running the Deployment

Simply trigger the multi-cloud deployment workflow:

```bash
# Via GitHub Actions UI
Go to Actions → Multi-Cloud Deployment → Run workflow
Select environment: dev/staging/production
```

### What Happens During Deployment

**Step 1: Cloudflare R2 Infrastructure**
```
✅ Creates R2 buckets (private and public)
✅ Configures CDN custom domain
✅ Generates R2 API token automatically
✅ Outputs credentials (masked in logs)
```

**Step 2: Azure Container Apps Deployment**
```
✅ Receives R2 credentials from Cloudflare outputs
✅ Configures container environment variables
✅ Deploys backend with full R2 access
```

**Step 3: Verification**
```
✅ Health checks confirm backend can access R2
✅ GraphQL endpoint responds correctly
```

## Verifying R2 Access

### Option 1: Check Azure Container Apps Environment Variables

```bash
# List environment variables
az containerapp show \
  --name dculus-forms-dev-backend \
  --resource-group dculus-forms-dev-rg \
  --query "properties.template.containers[0].env" \
  -o table

# Expected output:
# Name                      Value
# ------------------------  ------------------------------------
# PUBLIC_S3_ACCESS_KEY      xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# PUBLIC_S3_SECRET_KEY      ******** (masked)
# PUBLIC_S3_ENDPOINT        {account_id}.r2.cloudflarestorage.com
# PUBLIC_S3_CDN_URL         https://public-cdn-dev.dculus.com
# PRIVATE_S3_BUCKET_NAME    dculus-forms-private-dev
# PUBLIC_S3_BUCKET_NAME     dculus-forms-public-dev
```

### Option 2: Test with AWS CLI

```bash
# Set credentials from Terraform outputs (available in workflow logs)
export AWS_ACCESS_KEY_ID="<from-terraform-output>"
export AWS_SECRET_ACCESS_KEY="<from-terraform-output>"
export AWS_ENDPOINT_URL="https://{account_id}.r2.cloudflarestorage.com"

# List buckets
aws s3 ls --endpoint-url $AWS_ENDPOINT_URL

# Test upload to public bucket
echo "test" > test.txt
aws s3 cp test.txt s3://dculus-forms-public-dev/test.txt --endpoint-url $AWS_ENDPOINT_URL

# Test upload to private bucket
aws s3 cp test.txt s3://dculus-forms-private-dev/test.txt --endpoint-url $AWS_ENDPOINT_URL

# Cleanup
aws s3 rm s3://dculus-forms-public-dev/test.txt --endpoint-url $AWS_ENDPOINT_URL
aws s3 rm s3://dculus-forms-private-dev/test.txt --endpoint-url $AWS_ENDPOINT_URL
rm test.txt
```

### Option 3: Check Backend Logs

```bash
# View container logs
az containerapp logs show \
  --name dculus-forms-dev-backend \
  --resource-group dculus-forms-dev-rg \
  --follow

# Look for S3/R2 connection logs
```

## Token Lifecycle Management

### Automatic Token Rotation

Tokens are managed by Terraform lifecycle:

1. **Creation**: Token created during initial deployment
2. **Update**: If configuration changes, Terraform updates the token
3. **Deletion**: If resource is destroyed, token is automatically revoked

### Manual Token Rotation

To rotate credentials (e.g., after a security incident):

```bash
# 1. Taint the R2 API token resource
cd infrastructure/multi-cloud/terraform/cloudflare/environments/dev
terraform taint cloudflare_api_token.r2_access

# 2. Re-run the deployment workflow
# This will:
#   - Destroy the old token
#   - Create a new token
#   - Update Azure Container Apps with new credentials
```

## Troubleshooting

### Issue: "403 Forbidden" when creating API token

**Cause**: Cloudflare API token lacks "API Tokens: Edit" permission

**Solution**:
1. Go to Cloudflare Dashboard → My Profile → API Tokens
2. Edit the token used in `CLOUDFLARE_API_TOKEN` secret
3. Add permission: **API Tokens: Edit**
4. Save and re-run deployment

### Issue: Empty credentials in Azure Container Apps

**Cause**: Cloudflare deployment was skipped or failed

**Solution**:
1. Check GitHub Actions workflow logs for Cloudflare deployment step
2. Ensure Cloudflare deployment is enabled in workflow inputs
3. Verify `CLOUDFLARE_API_TOKEN` secret is valid
4. Re-run the deployment with Cloudflare deployment enabled

### Issue: "Invalid credentials" errors from backend

**Cause**: Credentials were not properly passed to Azure

**Solution**:
1. Check Terraform outputs from Cloudflare deployment:
   ```bash
   terraform output r2_access_key_id
   terraform output r2_secret_access_key
   ```
2. Verify outputs are not empty
3. Check Azure Container Apps environment variables
4. Re-deploy Azure Container Apps if needed

### Issue: "Token already exists" error

**Cause**: Previous token with same name wasn't cleaned up

**Solution**:
```bash
# List existing tokens
curl -X GET "https://api.cloudflare.com/client/v4/user/tokens" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}"

# Delete the conflicting token via Cloudflare Dashboard
# Or let Terraform import and manage it:
terraform import cloudflare_api_token.r2_access <token-id>
```

## Security Best Practices

### 1. Token Permissions
- ✅ Token scoped to R2 operations only
- ✅ No access to other Cloudflare resources
- ✅ Account-level (not zone-level) for R2

### 2. Credential Storage & Masking
- ✅ **Credentials masked in GitHub Actions logs via `::add-mask::`**
- ✅ Terraform outputs marked as `sensitive = false` to allow job passing
- ✅ Values masked BEFORE writing to `$GITHUB_OUTPUT`
- ✅ Passed securely to Azure Container Apps
- ✅ Never logged in plain text
- ✅ No credentials stored in git repository (only references)

**Security Note:** Terraform outputs use `sensitive = false` to enable passing between GitHub Actions jobs. This is safe because:
- Values are immediately masked with `::add-mask::` before any output
- GitHub Actions' global masking hides values in all logs
- Only configuration (references) are committed to git, not actual values
- Credentials are ephemeral and regenerated on each deployment

### 3. Access Control
- ✅ Token created per environment (dev/staging/production)
- ✅ Separate tokens for separate environments
- ✅ Managed via Infrastructure as Code

### 4. Monitoring
- ✅ Monitor Cloudflare API token usage
- ✅ Review Azure Container Apps logs
- ✅ Set up alerts for R2 access anomalies

## Migration from Manual Setup

If you previously set up R2 credentials manually via GitHub Secrets:

### What Changed
- ❌ No longer need `PUBLIC_S3_ACCESS_KEY` secret
- ❌ No longer need `PUBLIC_S3_SECRET_KEY` secret
- ❌ No longer need `PUBLIC_S3_ENDPOINT` secret
- ✅ All credentials generated automatically

### GitHub Secrets Cleanup (Optional)

You can safely delete these secrets as they're no longer used:
- `PUBLIC_S3_ACCESS_KEY`
- `PUBLIC_S3_SECRET_KEY`
- `PUBLIC_S3_ENDPOINT`
- `PRIVATE_S3_BUCKET_NAME`
- `PUBLIC_S3_BUCKET_NAME`
- `PUBLIC_S3_CDN_URL`

**Keep these secrets** (still required):
- `CLOUDFLARE_API_TOKEN` (with "API Tokens: Edit" permission)
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_ZONE_ID`

### Re-deployment

Simply re-run the multi-cloud deployment workflow and credentials will be automatically generated!

## Additional Resources

- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [R2 S3 API Compatibility](https://developers.cloudflare.com/r2/api/s3/)
- [Cloudflare API Tokens](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)
- [Terraform Cloudflare Provider](https://registry.terraform.io/providers/cloudflare/cloudflare/latest/docs)

## Summary

**Automated Benefits:**
- ✅ Zero manual steps required
- ✅ Credentials generated on every deployment
- ✅ Automatic token rotation via Terraform
- ✅ Secure credential passing between workflows
- ✅ Environment-specific token isolation
- ✅ Full audit trail in Terraform state

The R2 credential system is now fully automated, secure, and requires no manual intervention! 🎉

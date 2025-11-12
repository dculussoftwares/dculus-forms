# Troubleshooting: 403 Forbidden Error When Creating R2 API Token

## Problem

The deployment fails with a **403 Forbidden** error when trying to create the R2 API token:

```
POST "https://api.cloudflare.com/client/v4/user/tokens": 403 Forbidden
{"code":9109,"message":"Unauthorized to access requested resource"}
```

This causes the Azure Container Apps to have **empty values** for:
- `PUBLIC_S3_ACCESS_KEY`
- `PUBLIC_S3_SECRET_KEY`
- `PUBLIC_S3_ENDPOINT`

## Root Cause

The Cloudflare API token stored in the `CLOUDFLARE_API_TOKEN` GitHub Secret is **missing the "API Tokens: Edit" permission**.

Without this permission, Terraform cannot create new API tokens programmatically for R2 access.

## Solution

### Step 1: Add the Missing Permission

1. Go to your Cloudflare dashboard: https://dash.cloudflare.com/profile/api-tokens
2. Find the API token you're using for `CLOUDFLARE_API_TOKEN`
3. Click **"Edit"** on that token
4. Add the permission: **"API Tokens: Edit"** (also called "API Tokens Write")
5. Click **"Continue to summary"**
6. Click **"Update Token"**

### Step 2: Verify the Token Has All Required Permissions

Your token should now have **ALL** of these permissions:

- ✅ **API Tokens: Edit** ← **NEWLY ADDED**
- ✅ Account R2 Storage: Read & Write
- ✅ Zone DNS: Edit
- ✅ Zone Settings: Edit

### Step 3: Update GitHub Secret (if token value changed)

If Cloudflare regenerated a new token value:

1. Copy the new token value from Cloudflare
2. Go to your GitHub repository: Settings → Secrets and variables → Actions
3. Update the `CLOUDFLARE_API_TOKEN` secret with the new value

### Step 4: Re-run the Deployment

Simply re-run the failed workflow:

1. Go to: https://github.com/dculussoftwares/dculus-forms/actions
2. Find the failed "Multi-Cloud Deployment" workflow run
3. Click **"Re-run all jobs"**

OR trigger a new deployment:

1. Go to: Actions → Multi-Cloud Deployment
2. Click **"Run workflow"**
3. Select environment: `dev`
4. Click **"Run workflow"**

## Verification

After the deployment succeeds, verify R2 credentials in Azure:

```bash
# Check environment variables in Azure Container App
az containerapp show \
  --name dculus-forms-dev-backend \
  --resource-group dculus-forms-dev-rg \
  --query "properties.template.containers[0].env" \
  -o table

# Expected output:
# Name                      Value
# ------------------------  ------------------------------------
# PUBLIC_S3_ACCESS_KEY      xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx  (32 chars)
# PUBLIC_S3_SECRET_KEY      ******** (masked, 64 chars)
# PUBLIC_S3_ENDPOINT        {account_id}.r2.cloudflarestorage.com
# PUBLIC_S3_CDN_URL         https://public-cdn-dev.dculus.com
# PRIVATE_S3_BUCKET_NAME    dculus-forms-private-dev
# PUBLIC_S3_BUCKET_NAME     dculus-forms-public-dev
```

## How the Fix Works

After adding the permission, the automated flow works as follows:

1. **Cloudflare Terraform** creates `cloudflare_api_token.r2_access` resource
2. **Token ID** becomes the R2 Access Key ID (32 characters)
3. **Token Value** becomes the R2 Secret Access Key (64 characters)
4. **GitHub Actions** captures these outputs and masks them in logs
5. **Azure Terraform** receives credentials as environment variables
6. **Container App** launches with full R2 access configured

## Prevention

The workflow now includes **safety checks** to prevent deploying with empty credentials:

1. **Job-level condition**: Azure deployment only runs if Cloudflare succeeds
2. **Validation step**: Explicit check for R2 credentials before deployment
3. **Clear error messages**: Helpful guidance when credentials are missing

If you see this error in the future:

```
❌ ERROR: R2 Access Key ID is empty!
This usually means Cloudflare deployment failed.
Please check the Cloudflare deployment logs and ensure:
  1. CLOUDFLARE_API_TOKEN has 'API Tokens: Edit' permission
  2. Cloudflare deployment completed successfully
```

Follow the steps in this guide to resolve it.

## Additional Resources

- [R2 Credentials Setup Guide](./R2_CREDENTIALS_SETUP.md) - Full automation documentation
- [Cloudflare API Tokens Documentation](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)
- [GitHub Actions Workflow](.github/workflows/multi-cloud-deployment.yml) - Deployment configuration

## Need Help?

If you're still experiencing issues after following this guide:

1. Check the workflow logs for the specific error message
2. Verify all GitHub Secrets are correctly set
3. Ensure your Cloudflare account has access to create API tokens
4. Confirm your Cloudflare account has R2 enabled

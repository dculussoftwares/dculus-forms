# Cloudflare R2 Credentials Setup Guide

This guide explains how to create R2 API credentials and configure them in GitHub Secrets for automated deployment.

## Why Manual Credential Creation?

Cloudflare R2 credentials **cannot** be created programmatically via Terraform due to security restrictions:

1. **Permission Requirements**: Creating API tokens via the Cloudflare API requires "API Tokens: Edit" permission
2. **Security Risk**: A token that can create unlimited tokens poses a significant security risk
3. **Industry Standard**: Manual credential creation is the standard practice for S3-compatible storage services

This one-time manual setup provides better security and is the recommended approach by Cloudflare.

## Prerequisites

- Cloudflare account with R2 enabled
- Access to GitHub repository settings
- R2 buckets already deployed via Terraform (run the multi-cloud-deployment workflow first)

## Step 1: Deploy R2 Buckets (One-Time)

Run the multi-cloud-deployment workflow to create the R2 buckets and CDN infrastructure:

```bash
# Trigger via GitHub Actions UI
# Go to Actions → Multi-Cloud Deployment → Run workflow
# Select environment: dev/staging/production
```

After deployment, note down:
- Private bucket name: `dculus-forms-private-{env}`
- Public bucket name: `dculus-forms-public-{env}`
- Account ID: `e1498f66f9581a21c633ca4c9a59cfcc`

## Step 2: Create R2 API Token

### Via Cloudflare Dashboard:

1. **Navigate to R2 API Tokens**:
   - Go to: https://dash.cloudflare.com/e1498f66f9581a21c633ca4c9a59cfcc/r2/api-tokens
   - Or: Cloudflare Dashboard → R2 → Manage R2 API Tokens

2. **Create API Token**:
   - Click "Create API Token"
   - **Token Name**: `dculus-forms-r2-{env}-token` (e.g., `dculus-forms-r2-dev-token`)

3. **Configure Permissions**:
   - **Permission Type**: "Object Read & Write"
   - This grants both read and write access to R2 objects

4. **Apply to Buckets** (Recommended Scope):
   - Select "Apply to specific buckets only"
   - Choose buckets:
     - ✓ `dculus-forms-private-{env}`
     - ✓ `dculus-forms-public-{env}`
   - This limits the token to only these buckets for better security

   **Alternative (Not Recommended)**:
   - You can also select "Apply to all buckets in this account"
   - Only use this if you need access to other R2 buckets

5. **TTL (Time to Live)**:
   - Leave as "Forever" for production deployments
   - Or set an expiration date if you prefer rotating credentials

6. **Create and Save**:
   - Click "Create API Token"
   - **IMPORTANT**: Copy both values immediately (they won't be shown again):
     - **Access Key ID**: 20-character alphanumeric string (example: `AKIA...`)
     - **Secret Access Key**: 40-character string (example: `wJal...`)

## Step 3: Configure GitHub Secrets

Add the R2 credentials to your GitHub repository secrets:

### Via GitHub UI:

1. **Navigate to Repository Secrets**:
   - Go to: https://github.com/YOUR_ORG/dculus-forms/settings/secrets/actions
   - Or: Repository → Settings → Secrets and variables → Actions

2. **Add Environment Secrets**:

   For each environment (dev, staging, production):

   **Navigate to Environment**:
   - Click on "Environments" tab
   - Select your environment (e.g., "dev")
   - Click "Add secret"

   **Add PUBLIC_S3_ACCESS_KEY**:
   - Name: `PUBLIC_S3_ACCESS_KEY`
   - Value: Paste the **Access Key ID** from Step 2
   - Click "Add secret"

   **Add PUBLIC_S3_SECRET_KEY**:
   - Name: `PUBLIC_S3_SECRET_KEY`
   - Value: Paste the **Secret Access Key** from Step 2
   - Click "Add secret"

   **Existing Required Secrets** (should already be configured):
   - `PUBLIC_S3_ENDPOINT`: Already set to `{account_id}.r2.cloudflarestorage.com`
   - `PUBLIC_S3_CDN_URL`: Already set to `https://public-cdn-{env}.dculus.com`
   - `PRIVATE_S3_BUCKET_NAME`: Auto-populated by Terraform output
   - `PUBLIC_S3_BUCKET_NAME`: Auto-populated by Terraform output

3. **Repeat for All Environments**:
   - Dev environment: `PUBLIC_S3_ACCESS_KEY`, `PUBLIC_S3_SECRET_KEY`
   - Staging environment: `PUBLIC_S3_ACCESS_KEY`, `PUBLIC_S3_SECRET_KEY`
   - Production environment: `PUBLIC_S3_ACCESS_KEY`, `PUBLIC_S3_SECRET_KEY`

## Step 4: Verify Configuration

Test that the credentials are working:

### Option A: Via GitHub Actions

1. Trigger a new deployment workflow
2. Check the Azure Container Apps deployment logs
3. Verify that `PUBLIC_S3_ACCESS_KEY` and `PUBLIC_S3_SECRET_KEY` are no longer empty
4. Check the health check endpoint to ensure the backend can access R2

### Option B: Via AWS CLI (Local Testing)

```bash
# Configure AWS CLI with R2 credentials
export AWS_ACCESS_KEY_ID="<your-access-key-id>"
export AWS_SECRET_ACCESS_KEY="<your-secret-access-key>"
export AWS_ENDPOINT_URL="https://e1498f66f9581a21c633ca4c9a59cfcc.r2.cloudflarestorage.com"

# Test upload to private bucket
echo "test" > test.txt
aws s3 cp test.txt s3://dculus-forms-private-dev/test.txt --endpoint-url $AWS_ENDPOINT_URL

# Test upload to public bucket
aws s3 cp test.txt s3://dculus-forms-public-dev/test.txt --endpoint-url $AWS_ENDPOINT_URL

# Test access via CDN (wait 1-2 minutes for propagation)
curl -I https://public-cdn-dev.dculus.com/test.txt

# Cleanup
aws s3 rm s3://dculus-forms-private-dev/test.txt --endpoint-url $AWS_ENDPOINT_URL
aws s3 rm s3://dculus-forms-public-dev/test.txt --endpoint-url $AWS_ENDPOINT_URL
rm test.txt
```

## Step 5: Redeploy Azure Container Apps

After configuring the secrets, redeploy Azure Container Apps to pick up the credentials:

```bash
# Trigger via GitHub Actions UI
# Go to Actions → Multi-Cloud Deployment → Run workflow
# Select environment: dev/staging/production
# Enable: "Deploy Azure Container Apps backend"
```

The deployment will now use the R2 credentials from GitHub Secrets and pass them to Azure Container Apps environment variables.

## Troubleshooting

### Empty Environment Variables in Azure

**Symptom**: `PUBLIC_S3_ACCESS_KEY` and `PUBLIC_S3_SECRET_KEY` are empty in Azure Container Apps

**Solution**:
1. Verify the secrets are added to the **environment-specific** secrets (not repository secrets)
2. Ensure the secret names match exactly: `PUBLIC_S3_ACCESS_KEY` and `PUBLIC_S3_SECRET_KEY`
3. Retrigger the deployment workflow after adding secrets
4. Check the workflow logs for "::add-mask::" entries indicating secrets were loaded

### 403 Forbidden Errors

**Symptom**: Backend returns 403 when accessing R2

**Possible Causes**:
1. **Wrong bucket scope**: Token not applied to the correct buckets
2. **Insufficient permissions**: Token needs "Object Read & Write" permission
3. **Expired token**: Check token TTL and create a new one if expired
4. **Wrong endpoint**: Ensure endpoint uses your account ID

**Solution**:
1. Recreate the R2 API token with correct bucket scope
2. Update GitHub Secrets with new credentials
3. Redeploy Azure Container Apps

### CORS Errors

**Symptom**: Browser shows CORS errors when uploading files

**Solution**:
CORS configuration must be done via AWS S3 API (not Cloudflare dashboard):

```bash
# Create CORS configuration
cat > cors.json <<EOF
{
  "CORSRules": [
    {
      "AllowedOrigins": ["https://form-app-dev.dculus.com"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3600
    }
  ]
}
EOF

# Apply CORS to public bucket
aws s3api put-bucket-cors \
  --bucket dculus-forms-public-dev \
  --cors-configuration file://cors.json \
  --endpoint-url https://e1498f66f9581a21c633ca4c9a59cfcc.r2.cloudflarestorage.com

# Verify CORS
aws s3api get-bucket-cors \
  --bucket dculus-forms-public-dev \
  --endpoint-url https://e1498f66f9581a21c633ca4c9a59cfcc.r2.cloudflarestorage.com
```

## Security Best Practices

1. **Scope to Specific Buckets**: Always limit R2 tokens to specific buckets, not all buckets
2. **Rotate Credentials**: Set token expiration and rotate credentials periodically
3. **Use Environment-Specific Tokens**: Create separate tokens for dev/staging/production
4. **Monitor Usage**: Check Cloudflare R2 analytics for unusual access patterns
5. **Revoke Compromised Tokens**: If a token is compromised, revoke it immediately in Cloudflare dashboard

## Credential Rotation

To rotate R2 credentials:

1. **Create New Token** (Step 2 above)
2. **Update GitHub Secrets** with new credentials (Step 3 above)
3. **Redeploy Azure Container Apps** (Step 5 above)
4. **Revoke Old Token** in Cloudflare dashboard after verifying new deployment works
5. **Test thoroughly** before revoking the old token

## Additional Resources

- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [R2 API Token Permissions](https://developers.cloudflare.com/r2/api/s3/tokens/)
- [AWS S3 CLI with R2](https://developers.cloudflare.com/r2/examples/aws-cli/)
- [R2 CORS Configuration](https://developers.cloudflare.com/r2/buckets/cors/)

## Summary

This one-time setup provides:
- ✅ Secure R2 credentials scoped to specific buckets
- ✅ Automated deployment via GitHub Actions
- ✅ Environment-specific credential management
- ✅ Integration with Azure Container Apps

The credentials are created once manually, stored securely in GitHub Secrets, and automatically injected into Azure Container Apps during deployment.

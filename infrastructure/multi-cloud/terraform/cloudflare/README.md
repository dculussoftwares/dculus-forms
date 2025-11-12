# Cloudflare R2 Bucket Infrastructure

This directory contains Terraform configuration for managing Cloudflare R2 buckets across multiple environments (dev, staging, production).

## Overview

This infrastructure creates two R2 buckets per environment:
- **Private Bucket**: For form attachments, user uploads, and sensitive data
- **Public Bucket**: For public assets, form backgrounds, and static content

All buckets are created in the **APAC** (Asia-Pacific) region for optimal performance.

## CDN Configuration

The public bucket is configured with a **custom domain CDN** for fast, global content delivery:

| Environment | CDN Domain | Description |
|-------------|------------|-------------|
| dev | `public-cdn-dev.dculus.com` | Development CDN endpoint |
| staging | `public-cdn-staging.dculus.com` | Staging CDN endpoint |
| production | `public-cdn-production.dculus.com` | Production CDN endpoint |

### CDN Features

- **Cloudflare Proxy**: All traffic is proxied through Cloudflare's global network (orange cloud)
- **Cache Optimization**: Page Rules configured for aggressive caching:
  - Edge Cache TTL: 2 hours
  - Browser Cache TTL: 1 hour
  - Cache Everything enabled
- **HTTPS**: Automatic SSL/TLS certificates managed by Cloudflare
- **DDoS Protection**: Built-in DDoS mitigation at the edge
- **Performance**: Sub-100ms response times globally via Cloudflare's CDN

## Prerequisites

- [Terraform](https://www.terraform.io/downloads.html) >= 1.6.0
- [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli) (for backend state management)
- Cloudflare account with R2 enabled
- Access to the following:
  - Cloudflare Account ID
  - Cloudflare API Token with R2 permissions
  - Azure subscription (for Terraform state storage)

## Directory Structure

```
cloudflare/
├── main.tf                          # Provider configuration
├── variables.tf                     # Variable definitions
├── r2-buckets.tf                    # R2 bucket resources
├── r2-custom-domains.tf             # CDN custom domain configuration
├── outputs.tf                       # Output values
├── README.md                        # This file
├── .terraform-version               # Terraform version constraint
└── environments/
    ├── dev/
    │   ├── backend.tf               # Dev backend configuration
    │   └── terraform.tfvars         # Dev variables
    ├── staging/
    │   ├── backend.tf               # Staging backend configuration
    │   └── terraform.tfvars         # Staging variables
    └── production/
        ├── backend.tf               # Production backend configuration
        └── terraform.tfvars         # Production variables
```

## Terraform State Management

This configuration uses **Azure Storage** as the Terraform backend for state management. State files are stored separately for each environment:

- Dev: `cloudflare-r2-dev-state` container
- Staging: `cloudflare-r2-staging-state` container
- Production: `cloudflare-r2-production-state` container

All containers are in the existing storage account:
- Resource Group: `dculus-global-terraform-assets-resource-grp`
- Storage Account: `dculusterraformstates`

## GitHub Environment Setup

This project uses **GitHub Environments** for secure secret management. Configure secrets using GitHub CLI:

### Quick Setup with GitHub CLI

```bash
# Set your values
ACCOUNT_ID="your-cloudflare-account-id"
ZONE_ID="your-cloudflare-zone-id"
API_TOKEN="your-api-token-here"

# Development environment
gh secret set CLOUDFLARE_ACCOUNT_ID --body "$ACCOUNT_ID" --env development
gh secret set CLOUDFLARE_ZONE_ID --body "$ZONE_ID" --env development
gh secret set CLOUDFLARE_API_TOKEN --body "$API_TOKEN" --env development

# Staging environment
gh secret set CLOUDFLARE_ACCOUNT_ID --body "$ACCOUNT_ID" --env staging
gh secret set CLOUDFLARE_ZONE_ID --body "$ZONE_ID" --env staging
gh secret set CLOUDFLARE_API_TOKEN --body "$API_TOKEN" --env staging

# Production environment
gh secret set CLOUDFLARE_ACCOUNT_ID --body "$ACCOUNT_ID" --env production
gh secret set CLOUDFLARE_ZONE_ID --body "$ZONE_ID" --env production
gh secret set CLOUDFLARE_API_TOKEN --body "$API_TOKEN" --env production
```

### Manual Setup via GitHub UI

Alternatively, configure environments manually:

### 1. Development Environment

**Settings → Environments → New environment → "development"**

Protection Rules:
- ✅ None (no approval required)

Deployment Branches:
- All branches (allow deployments from `main`)

Required Secrets:
```
CLOUDFLARE_ACCOUNT_ID       = <your-cloudflare-account-id>
CLOUDFLARE_ZONE_ID          = <your-cloudflare-zone-id>
CLOUDFLARE_API_TOKEN        = <api-token-with-r2-permissions>
```

### 2. Staging Environment

**Settings → Environments → New environment → "staging"**

Protection Rules:
- ⚠️ Required reviewers: 1 person
- ⏱️ Wait timer: 0 minutes

Deployment Branches:
- All branches (allow deployments from `main`)

Required Secrets:
```
CLOUDFLARE_ACCOUNT_ID       = <your-cloudflare-account-id>
CLOUDFLARE_ZONE_ID          = <your-cloudflare-zone-id>
CLOUDFLARE_API_TOKEN        = <api-token-with-r2-permissions>
```

### 3. Production Environment

**Settings → Environments → New environment → "production"**

Protection Rules:
- 🛡️ Required reviewers: 2 people
- ⏱️ Wait timer: 5 minutes
- ✅ Prevent administrators from bypassing

Deployment Branches:
- All branches (allow deployments from `main`)

Required Secrets:
```
CLOUDFLARE_ACCOUNT_ID       = <your-cloudflare-account-id>
CLOUDFLARE_ZONE_ID          = <your-cloudflare-zone-id>
CLOUDFLARE_API_TOKEN        = <api-token-with-r2-permissions>
```

## Cloudflare API Token Creation

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Go to **My Profile** → **API Tokens**
3. Click **Create Token**
4. Use the **Edit Cloudflare Workers** template or create custom token
5. Permissions required:
   - **Account** → **R2** → **Edit**
6. Account Resources: Include → Specific account → Select your account
7. TTL: Set appropriate expiration (or leave blank for no expiration)
8. Create token and save it securely
9. Add to GitHub Environment secrets as `CLOUDFLARE_API_TOKEN`

## Local Development Workflow

### 1. Authenticate with Azure

```bash
az login
```

### 2. Navigate to Environment Directory

```bash
cd infrastructure/multi-cloud/terraform/cloudflare/environments/dev
```

### 3. Copy Root Terraform Files

Create symbolic links to share the root configuration:

```bash
# From the dev environment directory
ln -s ../../main.tf main.tf
ln -s ../../variables.tf variables.tf
ln -s ../../r2-buckets.tf r2-buckets.tf
ln -s ../../outputs.tf outputs.tf
```

Or copy the files:

```bash
cp ../../*.tf .
```

### 4. Initialize Terraform

```bash
terraform init
```

This will:
- Download the Cloudflare provider
- Configure the Azure backend
- Create the state container if it doesn't exist

### 5. Review the Plan

```bash
terraform plan \
  -var="cloudflare_account_id=YOUR_ACCOUNT_ID" \
  -var="cloudflare_api_token=YOUR_API_TOKEN"
```

### 6. Apply Changes

```bash
terraform apply \
  -var="cloudflare_account_id=YOUR_ACCOUNT_ID" \
  -var="cloudflare_api_token=YOUR_API_TOKEN"
```

### 7. Verify CDN Deployment

After `terraform apply` completes successfully, the custom domain will be automatically connected to your R2 bucket via the `cloudflare_r2_custom_domain` resource.

Wait 1-2 minutes for DNS propagation, then test:

```bash
# Upload a test file
aws s3 cp test.jpg s3://dculus-forms-public-dev/ \
  --endpoint-url https://{ACCOUNT_ID}.r2.cloudflarestorage.com

# Access via CDN
curl -I https://public-cdn-dev.dculus.com/test.jpg
```

You should see HTTP 200 response with Cloudflare headers (`cf-cache-status`, `cf-ray`, etc.).

The CDN URL will be available immediately:
- Dev: `https://public-cdn-dev.dculus.com`
- Staging: `https://public-cdn-staging.dculus.com`
- Production: `https://public-cdn-production.dculus.com`

## CI/CD Pipeline Deployment

The GitHub Actions workflow uses a **single main branch** with **manual deployment** via GitHub Environments:

| Environment | Bucket Names                           | Approval Required | Trigger |
|-------------|----------------------------------------|-------------------|---------|
| dev         | `dculus-forms-{private/public}-dev`    | None              | Manual  |
| staging     | `dculus-forms-{private/public}-staging`| 1 reviewer        | Manual  |
| production  | `dculus-forms-{private/public}-prod`   | 2 reviewers       | Manual  |

### Workflow Triggers

- **Manual Workflow Dispatch**: Go to Actions → Terraform - Cloudflare R2 Deployment → Run workflow → Select environment
- **Pull Requests**: Automatically runs `terraform plan` (no deployment) for validation

### Deployment Process

**To deploy to any environment:**

1. **Go to GitHub Actions**:
   - Navigate to your repository → Actions tab
   - Select "Terraform - Cloudflare R2 Deployment" workflow

2. **Run Workflow**:
   - Click "Run workflow" button
   - Select branch: `main` (always use main branch)
   - Choose environment: `dev`, `staging`, or `production`
   - Click "Run workflow"

3. **Approval Process** (for staging/production):
   - Staging: 1 reviewer must approve
   - Production: 2 reviewers must approve + 5 minute wait timer
   - Approvers will receive notification to review deployment

4. **Monitor Deployment**:
   - Terraform plan is generated and uploaded as artifact
   - Review the plan in workflow logs
   - Terraform applies the changes after approval
   - Bucket URLs and next steps are displayed in logs

**For Pull Requests:**
- Workflow automatically runs `terraform plan` for validation
- No deployment occurs (plan-only mode)
- Results are commented on the PR

## Post-Deployment Configuration

### 1. Generate R2 API Tokens

After buckets are created, generate API tokens for application access:

1. Go to [Cloudflare R2 Dashboard](https://dash.cloudflare.com/)
2. Navigate to **R2** → **Overview**
3. Click **Manage R2 API Tokens**
4. Create new token:
   - **Permissions**: Object Read & Write
   - **Scope**: Select your buckets (`dculus-forms-private-{env}` and `dculus-forms-public-{env}`)
5. Save the **Access Key ID** and **Secret Access Key**

### 2. Update Backend Application

Add the following environment variables to your backend application:

**For Development:**
```bash
PUBLIC_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_REGION=auto
S3_PRIVATE_BUCKET_NAME=dculus-forms-private-dev
S3_PUBLIC_BUCKET_NAME=dculus-forms-public-dev
S3_PUBLIC_CDN_URL=https://public-cdn-dev.dculus.com
PUBLIC_S3_ACCESS_KEY=<r2-access-key-id>
PUBLIC_S3_SECRET_KEY=<r2-secret-access-key>
```

**For Staging:**
```bash
PUBLIC_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_REGION=auto
S3_PRIVATE_BUCKET_NAME=dculus-forms-private-staging
S3_PUBLIC_BUCKET_NAME=dculus-forms-public-staging
S3_PUBLIC_CDN_URL=https://public-cdn-staging.dculus.com
PUBLIC_S3_ACCESS_KEY=<r2-access-key-id>
PUBLIC_S3_SECRET_KEY=<r2-secret-access-key>
```

**For Production:**
```bash
PUBLIC_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_REGION=auto
S3_PRIVATE_BUCKET_NAME=dculus-forms-private-production
S3_PUBLIC_BUCKET_NAME=dculus-forms-public-production
S3_PUBLIC_CDN_URL=https://public-cdn-production.dculus.com
PUBLIC_S3_ACCESS_KEY=<r2-access-key-id>
PUBLIC_S3_SECRET_KEY=<r2-secret-access-key>
```

### 3. Using the CDN in Your Application

When serving public assets, use the `S3_PUBLIC_CDN_URL` environment variable:

```typescript
// Instead of constructing direct R2 URLs
const imageUrl = `${process.env.S3_PUBLIC_CDN_URL}/${filePath}`;

// Example: https://public-cdn-dev.dculus.com/form-backgrounds/hero.jpg
```

**Benefits:**
- Faster global delivery via Cloudflare's CDN
- Automatic caching and optimization
- HTTPS with managed SSL certificates
- DDoS protection included

### 4. Configure CORS (Optional)

CORS configuration must be done using the AWS S3 SDK, as the Cloudflare Terraform provider doesn't support CORS configuration yet.

**Using AWS CLI:**

```bash
# Install AWS CLI
brew install awscli  # macOS
# or: apt-get install awscli  # Linux

# Configure AWS CLI for R2
aws configure --profile r2
# AWS Access Key ID: <r2-access-key-id>
# AWS Secret Access Key: <r2-secret-access-key>
# Default region name: auto
# Default output format: json

# Create CORS configuration file
cat > cors.json <<EOF
{
  "CORSRules": [
    {
      "AllowedOrigins": ["https://dculus-forms-app.pages.dev"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3600
    }
  ]
}
EOF

# Apply CORS configuration
aws s3api put-bucket-cors \
  --bucket dculus-forms-public-production \
  --cors-configuration file://cors.json \
  --endpoint-url https://<account-id>.r2.cloudflarestorage.com \
  --profile r2
```

**Using Node.js (AWS SDK):**

```javascript
import { S3Client, PutBucketCorsCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const corsConfig = {
  Bucket: 'dculus-forms-public-production',
  CORSConfiguration: {
    CORSRules: [
      {
        AllowedOrigins: ['https://dculus-forms-app.pages.dev'],
        AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE'],
        AllowedHeaders: ['*'],
        MaxAgeSeconds: 3600,
      },
    ],
  },
};

await s3Client.send(new PutBucketCorsCommand(corsConfig));
```

### 4. Setup Custom Domain for Public Bucket (Optional)

To serve public assets via a custom domain:

1. Go to [Cloudflare R2 Dashboard](https://dash.cloudflare.com/)
2. Select your public bucket (e.g., `dculus-forms-public-production`)
3. Go to **Settings** → **Public Access**
4. Click **Connect Domain**
5. Enter your custom domain (e.g., `cdn.dculus.com`)
6. Follow DNS configuration instructions
7. Update `public_bucket_custom_domain` variable in `terraform.tfvars`
8. Re-run Terraform to apply changes

**Benefits of Custom Domain:**
- Cloudflare CDN caching
- WAF and security features
- Custom SSL certificates
- DDoS protection
- Bot management

## Bucket Naming Convention

Buckets follow this naming pattern:

```
{project_name}-{bucket_type}-{environment}
```

Examples:
- `dculus-forms-private-dev`
- `dculus-forms-public-dev`
- `dculus-forms-private-staging`
- `dculus-forms-public-staging`
- `dculus-forms-private-production`
- `dculus-forms-public-production`

## Security Best Practices

### ✅ Implemented

- **Environment Isolation**: Separate state files per environment
- **Least Privilege**: API tokens scoped to specific buckets
- **Private by Default**: Public bucket requires explicit configuration
- **Encrypted State**: Azure Storage with encryption enabled
- **No Hardcoded Secrets**: All secrets in GitHub Environments
- **Approval Workflows**: Production requires manual approval

### 🔒 Recommended

- **Rotate API Tokens**: Set 90-day expiration and rotate regularly
- **Monitor Access Logs**: Enable R2 analytics and review access patterns
- **Implement Lifecycle Policies**: Auto-delete old files to reduce costs
- **Enable Versioning**: Protect against accidental deletions
- **Use Pre-signed URLs**: For temporary public access instead of making buckets public

## Troubleshooting

### Error: "An A, AAAA, or CNAME record with that host already exists" (DNS Record Conflict)

**Cause**: The DNS record for the custom domain already exists in Cloudflare.

**✅ FIXED!** The Terraform configuration has been redesigned to eliminate this issue entirely:

**How the new approach works:**

1. **Automatic DNS Management**: The `cloudflare_r2_custom_domain` resource automatically creates and manages the DNS CNAME record
2. **No Manual DNS Records**: We don't create a separate `cloudflare_dns_record` resource, preventing conflicts
3. **Zero Configuration**: The DNS record is created automatically when you deploy the R2 custom domain
4. **Read-Only Protection**: Cloudflare marks the auto-created DNS record as read-only, ensuring consistency

**What happens during deployment:**

```
1. Terraform creates R2 buckets (private and public)
2. Terraform creates cloudflare_r2_custom_domain resource
   → This automatically creates DNS CNAME: public-cdn-{env}.dculus.com → public.r2.dev
   → DNS record is proxied through Cloudflare (orange cloud)
   → Record is marked as read_only (managed by R2)
3. Terraform creates page rules for CDN caching
```

**Why this is better:**

- ✅ No import scripts needed
- ✅ No state management issues
- ✅ No circular dependencies
- ✅ DNS record always matches R2 configuration
- ✅ Simpler, more maintainable infrastructure code

**If you see this error:**

This should no longer happen with the current configuration. If you do encounter it:

1. Check that you're using the latest Terraform configuration from `main` branch
2. Ensure you don't have a manual `cloudflare_dns_record.public_cdn` resource in your code
3. The `cloudflare_r2_custom_domain` resource handles DNS automatically - no separate DNS record needed

### Error: "Backend initialization required"

**Solution:**
```bash
terraform init -reconfigure
```

### Error: "Access Denied" when creating buckets

**Cause**: Insufficient Cloudflare API token permissions

**Solution:**
1. Verify API token has **R2 Edit** permissions
2. Check token hasn't expired
3. Ensure token is scoped to the correct account

### Error: "Container does not exist" in Azure backend

**Cause**: State container not created in Azure Storage

**Solution:**
```bash
az storage container create \
  --name cloudflare-r2-dev-state \
  --account-name dculusterraformstates
```

### Error: "State lock timeout"

**Cause**: Previous Terraform operation didn't release the state lock

**Solution:**
```bash
terraform force-unlock <lock-id>
```

### Bucket already exists

**Cause**: Bucket was created manually or in a different Terraform state

**Solution:**
```bash
# Import existing bucket
terraform import cloudflare_r2_bucket.private <account-id>/dculus-forms-private-dev
terraform import cloudflare_r2_bucket.public <account-id>/dculus-forms-public-dev
```

## Cost Estimation

### R2 Pricing (As of 2024)

- **Storage**: $0.015 per GB/month
- **Class A Operations** (write, list): $4.50 per million requests
- **Class B Operations** (read): $0.36 per million requests
- **Egress**: FREE (no bandwidth charges)

### Example Monthly Cost

**Development Environment:**
- Storage: 10 GB × $0.015 = $0.15
- Write operations: 100,000 × $4.50/1M = $0.45
- Read operations: 500,000 × $0.36/1M = $0.18
- **Total**: ~$0.78/month

**Production Environment:**
- Storage: 100 GB × $0.015 = $1.50
- Write operations: 1M × $4.50/1M = $4.50
- Read operations: 10M × $0.36/1M = $3.60
- **Total**: ~$9.60/month

## Useful Commands

```bash
# Initialize Terraform
terraform init

# Format Terraform files
terraform fmt -recursive

# Validate configuration
terraform validate

# Plan changes
terraform plan

# Apply changes
terraform apply

# Show current state
terraform show

# List resources
terraform state list

# Destroy all resources (use with caution!)
terraform destroy

# Output values
terraform output

# Output specific value
terraform output private_bucket_name
```

## Additional Resources

- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [Terraform Cloudflare Provider](https://registry.terraform.io/providers/cloudflare/cloudflare/latest/docs)
- [R2 S3 API Compatibility](https://developers.cloudflare.com/r2/api/s3/)
- [GitHub Environments Documentation](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment)

## Support

For issues or questions:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review Cloudflare R2 documentation
3. Open an issue in the repository
4. Contact the DevOps team

---

**Last Updated**: 2024
**Maintained By**: Dculus Team
**Terraform Version**: >= 1.6.0
**Cloudflare Provider**: ~> 4.0

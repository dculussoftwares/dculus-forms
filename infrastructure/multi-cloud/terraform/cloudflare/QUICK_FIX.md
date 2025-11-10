# Quick Fix for "Bucket Already Exists" Error

## Problem
The workflow fails with:
```
Error: failed to create R2 bucket
The bucket you tried to create already exists, and you own it. (10004)
```

## Quick Solution (2 minutes)

### Step 1: Set Environment Variables

```bash
export CLOUDFLARE_ACCOUNT_ID="your-account-id"
export CLOUDFLARE_API_TOKEN="your-api-token"
```

**Get these from:**
- Account ID: Cloudflare Dashboard → Account Home (on the right sidebar)
- API Token: Cloudflare Dashboard → My Profile → API Tokens

### Step 2: Run the Import Script

```bash
cd infrastructure/multi-cloud/terraform/cloudflare

# Import dev environment buckets
./import-r2-buckets.sh dev

# Or for other environments
./import-r2-buckets.sh staging
./import-r2-buckets.sh production
```

### Step 3: Re-run the Workflow

```bash
gh workflow run multi-cloud-deployment.yml -f environment=dev
```

**Or via GitHub UI:**
1. Go to Actions tab
2. Select "Multi-Cloud Deployment"
3. Click "Run workflow"
4. Select environment: dev
5. Click "Run workflow"

## What This Does

The script:
1. ✅ Copies shared Terraform files
2. ✅ Initializes Terraform with Azure backend
3. ✅ Imports existing R2 buckets into Terraform state
4. ✅ Verifies the import was successful
5. ✅ Shows you a plan of any configuration drift

## Troubleshooting

### "Authentication failed"
- Verify your `CLOUDFLARE_API_TOKEN` is correct
- Check the token has R2 permissions
- Try regenerating the token in Cloudflare Dashboard

### "Bucket not found"
- Check bucket exists in Cloudflare Dashboard → R2
- Verify the bucket name matches: `dculus-forms-{private|public}-{env}`

### "State lock error"
- Wait a few minutes and try again
- Check no other Terraform operations are running

## Alternative: Delete and Recreate (Dev Only)

⚠️ **ONLY for dev environment if buckets are empty!**

```bash
# Delete via Cloudflare Dashboard
1. Go to R2 → Buckets
2. Delete dculus-forms-private-dev
3. Delete dculus-forms-public-dev
4. Re-run workflow

# Or via CLI (if wrangler is installed)
wrangler r2 bucket delete dculus-forms-private-dev
wrangler r2 bucket delete dculus-forms-public-dev
```

## After Import

Once the import is successful:
- ✅ Cloudflare R2 deployment will pass
- ✅ Azure Container Apps will deploy
- ✅ Health checks will run
- ✅ You'll get deployment URLs

## Need Help?

- Full guide: `IMPORT_EXISTING_RESOURCES.md`
- Check bucket names: Cloudflare Dashboard → R2 → Buckets
- Verify API token: Cloudflare Dashboard → My Profile → API Tokens

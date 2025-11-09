# Importing Existing Cloudflare R2 Buckets

If you encounter an error like "The bucket you tried to create already exists, and you own it" during Terraform deployment, you need to import the existing R2 buckets into Terraform state.

## Error Message

```
Error: failed to create R2 bucket
The bucket you tried to create already exists, and you own it. (10004)
```

## Solution: Import Existing Buckets

### For Dev Environment

```bash
cd infrastructure/multi-cloud/terraform/cloudflare/environments/dev

# Copy shared Terraform files
cp ../../main.tf .
cp ../../variables.tf .
cp ../../r2-buckets.tf .
cp ../../outputs.tf .

# Initialize Terraform
terraform init

# Import existing private bucket
terraform import \
  -var="cloudflare_account_id=YOUR_ACCOUNT_ID" \
  -var="cloudflare_api_token=YOUR_API_TOKEN" \
  cloudflare_r2_bucket.private \
  dculus-forms-private-dev

# Import existing public bucket
terraform import \
  -var="cloudflare_account_id=YOUR_ACCOUNT_ID" \
  -var="cloudflare_api_token=YOUR_API_TOKEN" \
  cloudflare_r2_bucket.public \
  dculus-forms-public-dev

# Verify import was successful
terraform plan \
  -var="cloudflare_account_id=YOUR_ACCOUNT_ID" \
  -var="cloudflare_api_token=YOUR_API_TOKEN"
```

### For Staging Environment

```bash
cd infrastructure/multi-cloud/terraform/cloudflare/environments/staging

# Copy shared files
cp ../../main.tf .
cp ../../variables.tf .
cp ../../r2-buckets.tf .
cp ../../outputs.tf .

# Initialize
terraform init

# Import buckets
terraform import \
  -var="cloudflare_account_id=YOUR_ACCOUNT_ID" \
  -var="cloudflare_api_token=YOUR_API_TOKEN" \
  cloudflare_r2_bucket.private \
  dculus-forms-private-staging

terraform import \
  -var="cloudflare_account_id=YOUR_ACCOUNT_ID" \
  -var="cloudflare_api_token=YOUR_API_TOKEN" \
  cloudflare_r2_bucket.public \
  dculus-forms-public-staging
```

### For Production Environment

```bash
cd infrastructure/multi-cloud/terraform/cloudflare/environments/production

# Copy shared files
cp ../../main.tf .
cp ../../variables.tf .
cp ../../r2-buckets.tf .
cp ../../outputs.tf .

# Initialize
terraform init

# Import buckets
terraform import \
  -var="cloudflare_account_id=YOUR_ACCOUNT_ID" \
  -var="cloudflare_api_token=YOUR_API_TOKEN" \
  cloudflare_r2_bucket.private \
  dculus-forms-private-production

terraform import \
  -var="cloudflare_account_id=YOUR_ACCOUNT_ID" \
  -var="cloudflare_api_token=YOUR_API_TOKEN" \
  cloudflare_r2_bucket.public \
  dculus-forms-public-production
```

## Automated Import via GitHub Actions

If you prefer to run the import via GitHub Actions, you can manually run these commands in the workflow:

1. Go to **Actions** → **Multi-Cloud Deployment**
2. Click **Run workflow**
3. Select the environment
4. The workflow will fail with the "bucket already exists" error
5. Connect to your local environment and run the import commands above
6. Re-run the workflow

## Verifying the Import

After importing, verify the state:

```bash
# List resources in Terraform state
terraform state list

# Should show:
# cloudflare_r2_bucket.private
# cloudflare_r2_bucket.public

# Check the details
terraform state show cloudflare_r2_bucket.private
terraform state show cloudflare_r2_bucket.public
```

## Alternative: Delete and Recreate (NOT RECOMMENDED for Production)

⚠️ **WARNING**: Only use this approach for dev/test environments where data loss is acceptable!

If the buckets are empty and you don't need to preserve them:

```bash
# Via Cloudflare Dashboard
1. Go to R2 → Buckets
2. Delete dculus-forms-private-{env}
3. Delete dculus-forms-public-{env}
4. Re-run the Terraform deployment

# Via Cloudflare API
curl -X DELETE \
  "https://api.cloudflare.com/client/v4/accounts/{account_id}/r2/buckets/dculus-forms-private-dev" \
  -H "Authorization: Bearer {api_token}"

curl -X DELETE \
  "https://api.cloudflare.com/client/v4/accounts/{account_id}/r2/buckets/dculus-forms-public-dev" \
  -H "Authorization: Bearer {api_token}"
```

## Why This Happens

This error occurs when:
1. Buckets were created manually or via a previous deployment
2. Terraform state was lost or recreated
3. Deploying to a new environment with existing bucket names

## Prevention

To prevent this issue in the future:
1. Always maintain Terraform state backups (already configured via Azure Storage)
2. Use consistent naming conventions
3. Document manual resource creation
4. Import resources immediately after manual creation

## Troubleshooting

### "Resource not found" during import

The bucket name might be incorrect. List your R2 buckets:

```bash
curl -X GET \
  "https://api.cloudflare.com/client/v4/accounts/{account_id}/r2/buckets" \
  -H "Authorization: Bearer {api_token}" | jq '.result[] | .name'
```

### "Authentication failed"

Verify your API token has R2 permissions:
1. Go to Cloudflare Dashboard → My Profile → API Tokens
2. Check the token has "Account.Cloudflare R2 Storage:Edit" permission
3. Regenerate token if needed

### Import succeeded but plan shows changes

This is normal. Terraform may detect configuration drift. Review the changes:
- If they're cosmetic (ordering, defaults), apply them
- If they're structural, investigate why the configuration differs

## Next Steps

After successful import:
1. Run `terraform plan` to verify no unexpected changes
2. Run `terraform apply` if there are configuration drifts to fix
3. Re-run the GitHub Actions workflow
4. The deployment should now succeed

## Support

For further assistance:
- Check Terraform state: `terraform state list`
- Review state details: `terraform state show cloudflare_r2_bucket.private`
- Check bucket existence: Cloudflare Dashboard → R2 → Buckets
- Verify API permissions: Cloudflare Dashboard → API Tokens

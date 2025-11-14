# Cloudflare Managed Transforms - Manual Configuration Required

## Overview

Cloudflare's "Add visitor location headers" Managed Transform must be **manually enabled** in the Cloudflare Dashboard. Terraform currently doesn't support managing this resource type directly.

## Quick Setup (5 minutes)

### Enable in Cloudflare Dashboard

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Select your domain (`dculus.com`)
3. Go to **Rules** > **Transform Rules** > **Managed Transforms**
4. Find **"Add visitor location headers"**
5. Toggle the switch to **ON** (blue)
6. Changes apply immediately (no deployment needed)

### Verify It's Working

```bash
curl -s https://form-services-dev.dculus.com/debug/cloudflare | jq .cloudflareHeaders
```

You should now see all location headers:
```json
{
  "cf-ipcountry": "IN",
  "cf-ipcontinent": "AS",
  "cf-ipcity": "Chennai",
  "cf-region": "Tamil Nadu",
  ...
}
```

## Why Manual Configuration?

The Cloudflare Terraform provider doesn't yet support the `cloudflare_managed_headers` resource for Managed Transforms. Options:

1. **Manual Dashboard** (current approach) ✅
   - Simple, one-time setup
   - Works immediately
   - No Terraform complexity

2. **Cloudflare API** (future enhancement)
   - Could be automated via API calls
   - Requires custom scripting
   - More complex to maintain

3. **Wait for Provider Support**
   - Cloudflare may add this in future provider versions
   - Would enable full IaC approach

## Current Implementation

The file `managed-transforms.tf` exists as documentation only and doesn't create any resources. It serves as a reminder to enable the managed transform manually.

## What This Enables

Once deployed, all requests to your backend will automatically include:

```
cf-ipcountry: IN
cf-ipcontinent: AS
cf-ipcity: Chennai
cf-region: Tamil Nadu
cf-region-code: TN
cf-postal-code: 600001
cf-iplatitude: 13.0827
cf-iplongitude: 80.2707
cf-timezone: Asia/Kolkata
cf-connecting-ip: <visitor-ip>
cf-ray: <ray-id>
```

## One-Time Manual Setup Required

**⚠️ Important**: After deploying infrastructure, you must manually enable the managed transform once:

1. Go to Cloudflare Dashboard
2. Rules > Transform Rules > Managed Transforms  
3. Enable "Add visitor location headers"

This is a **one-time setup** and will work for all environments (dev, staging, production).

## Deployment

### Automatic (via GitHub Actions)

Run the deployment workflow:
```bash
./auto-release-tag.sh
# Then manually trigger deployment in GitHub Actions
```

The managed transform will be applied automatically during the "5.1. Configure Backend Service Domain DNS" phase.

### Manual (via Terraform)

```bash
cd infrastructure/multi-cloud/terraform/cloudflare-service-domain/environments/dev

# Copy shared Terraform files
cp ../../*.tf .

# Initialize
terraform init

# Plan
terraform plan

# Apply
terraform apply
```

## Verification

### 1. Check Terraform State
```bash
terraform output managed_transforms_id
terraform output visitor_location_headers_enabled
```

### 2. Test Headers
```bash
curl -s https://form-services-dev.dculus.com/debug/cloudflare | jq .
```

You should see all location headers populated.

### 3. Check Cloudflare Dashboard
1. Go to **Rules** > **Transform Rules** > **Managed Transforms**
2. "Add visitor location headers" should show as **ON**

## Scope

The managed transform is applied at the **zone level** (entire `dculus.com` domain), not just the specific subdomain. This means:

- ✅ All subdomains benefit from geolocation headers
- ✅ No per-environment configuration needed
- ✅ Consistent across dev/staging/production

## Rollback

To disable the managed transform:

### Via Terraform
```bash
# Comment out or delete managed-transforms.tf
# Then apply
terraform apply
```

### Via Cloudflare Dashboard
1. Go to **Rules** > **Transform Rules** > **Managed Transforms**
2. Toggle "Add visitor location headers" to **OFF**

## Cost

**FREE** - Managed Transforms are available on all Cloudflare plans, including Free.

## Related Files

- Backend middleware: `apps/backend/src/middleware/cloudflare-geolocation.ts`
- Debug endpoint: `apps/backend/src/routes/debug.ts`
- Documentation: `CLOUDFLARE_GEOLOCATION_GUIDE.md`
- Setup guide: `CLOUDFLARE_MANAGED_TRANSFORM_SETUP.md`

## Next Steps

1. Deploy infrastructure changes
2. Test geolocation headers
3. Use location data in your resolvers/analytics

## References

- [Cloudflare Managed Transforms Docs](https://developers.cloudflare.com/rules/transform/managed-transforms/)
- [Terraform cloudflare_managed_headers](https://registry.terraform.io/providers/cloudflare/cloudflare/latest/docs/resources/managed_headers)
- [Add visitor location headers](https://developers.cloudflare.com/rules/transform/managed-transforms/reference/#add-visitor-location-headers)

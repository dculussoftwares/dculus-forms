# Cloudflare Managed Transforms - Terraform Implementation

## Overview

Added Terraform configuration to automatically enable Cloudflare's "Add visitor location headers" Managed Transform for the backend service domain. This eliminates manual configuration in the Cloudflare dashboard.

## Changes Made

### 1. New Terraform Resource
**File:** `infrastructure/multi-cloud/terraform/cloudflare-service-domain/managed-transforms.tf`

```terraform
resource "cloudflare_managed_headers" "add_visitor_location_headers" {
  zone_id = var.cloudflare_zone_id

  managed_request_headers {
    id      = "add_visitor_location_headers"
    enabled = true
  }
}
```

This configures Cloudflare to add all visitor location headers to requests sent to your backend.

### 2. Updated Outputs
**File:** `infrastructure/multi-cloud/terraform/cloudflare-service-domain/outputs.tf`

Added:
- `managed_transforms_id` - ID of the managed transforms configuration
- `visitor_location_headers_enabled` - Boolean flag (always true when deployed)

### 3. Updated Deployment Workflow
**File:** `.github/workflows/multi-cloud-deployment.yml`

- Captures managed transforms status in job outputs
- Displays in deployment summary: "Visitor Location Headers: ✅ Enabled"

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

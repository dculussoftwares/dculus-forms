# Pipeline Fix: ContainerAppTcpRequiresVnet Error

## Issue Description

The deployment pipeline failed with the following error:

```
Error: creating Container App (Subscription: "***"
Resource Group Name: "dculus-mongodb-rg"
Container App Name: "dculus-mongodb"): performing CreateOrUpdate: unexpected status 400 (400 Bad Request) with error: ContainerAppTcpRequiresVnet: Applications with external TCP ingress can only be deployed to Container App Environments that have a custom VNET.
```

## Root Cause

Azure Container Apps with **TCP ingress and external access enabled** require a custom Virtual Network (VNET). The original configuration had:

```terraform
ingress {
  external_enabled = var.mongodb_external_access  # This was set to true
  target_port      = 27017
  transport        = "tcp"
}
```

## Solution Applied

### 1. Changed Default Configuration

**Modified `main.tf`:**
- Set `external_enabled = false` to make MongoDB internal-only
- This eliminates the VNET requirement and improves security

**Modified `variables.tf`:**
- Changed default value of `mongodb_external_access` from `true` to `false`
- Updated description to explain VNET requirement for external access

**Modified `terraform.tfvars.example`:**
- Set `mongodb_external_access = false` in the example

### 2. Updated Documentation

**Enhanced `README.md`:**
- Added comprehensive "Connecting to MongoDB" section
- Explained internal vs external access options
- Provided VNET configuration example for external access
- Added development/testing connection methods

### 3. Security Benefits

The fix provides several security improvements:

- **Reduced Attack Surface**: MongoDB is not accessible from the internet
- **Network Isolation**: Only applications in the same Container Apps Environment can connect
- **Best Practice Alignment**: Databases should typically be internal-only
- **Simplified Setup**: No VNET configuration required for basic deployment

## Connection After Fix

### For Applications in the Same Container Apps Environment

Applications can connect using the internal FQDN:

```bash
# Get connection string
terraform output -raw mongodb_connection_string
```

### For External Access (If Needed)

If external access is required:

1. Set `mongodb_external_access = true` in `terraform.tfvars`
2. Add VNET configuration to `main.tf` (see README.md for example)
3. Redeploy the infrastructure

## Next Steps

1. **Re-run the pipeline** - The deployment should now succeed
2. **Update application configurations** - Use the internal connection string
3. **Test connectivity** - Verify applications can connect to MongoDB
4. **Monitor logs** - Check Container Apps logs for any issues

## Files Modified

- `infrastructure/mongodb-container-app/main.tf`
- `infrastructure/mongodb-container-app/variables.tf`
- `infrastructure/mongodb-container-app/terraform.tfvars.example`
- `infrastructure/mongodb-container-app/README.md`
- `infrastructure/mongodb-container-app/PIPELINE_FIX.md` (this file)

## Verification Commands

After successful deployment:

```bash
# Check container status
az containerapp show --name dculus-mongodb --resource-group dculus-mongodb-rg

# View logs
az containerapp logs show --name dculus-mongodb --resource-group dculus-mongodb-rg

# Test internal connectivity (from another container in the same environment)
az containerapp exec --name dculus-mongodb --resource-group dculus-mongodb-rg --command "mongosh --version"
```

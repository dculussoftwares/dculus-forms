# Azure PostgreSQL Flexible Server - Minimal Cost Configuration

This Terraform configuration deploys a very low-cost Azure PostgreSQL Flexible Server for the dculus-forms backend.

## Cost Optimization Features

### Compute Tier: Burstable (B_Standard_B1ms)
- **1 vCore** and **2 GiB RAM**
- Burstable performance (lowest cost option)
- Perfect for development and low-traffic staging environments
- Estimated cost: ~$12-15/month (varies by region)

### Storage Configuration
- **Minimum storage**: 32 GiB (required for Flexible Server)
- **Storage tier**: P4 (lowest tier)
- **No geo-redundant backups** (disabled for cost savings)
- **7-day backup retention** (minimum allowed)

### High Availability
- **Disabled** for cost savings
- Can be enabled in production if needed

### Network Access
- **Dev environment**: Public access allowed (for development convenience)
- **Staging/Production**: Public access restricted (Azure services only)
- Firewall rules configured to allow Azure Container Apps

## Database Naming

- **Server name**: `dculus-forms-{env}-pg-server`
- **Database name**: `dculus-forms-{env}-backend-database`
- **Resource group**: `dculus-forms-{env}-postgres-rg`

## Deployment

### Via GitHub Actions

The deployment is integrated into the multi-cloud deployment workflow:

```bash
# Manual trigger with PostgreSQL deployment enabled
gh workflow run multi-cloud-deployment.yml \
  --field environment=dev \
  --field release_tag=v1.0.0 \
  --field deploy_postgres=true
```

### Local Deployment

```bash
# Navigate to environment directory
cd environments/dev

# Initialize Terraform
terraform init \
  -backend-config="resource_group_name=dculus-global-terraform-assets-resource-grp" \
  -backend-config="storage_account_name=dculusterraformstates" \
  -backend-config="container_name=dculus-forms-postgres-dev-state" \
  -backend-config="key=terraform.tfstate"

# Authenticate to Azure (if needed)
az login

# Plan deployment
terraform plan -out=tfplan

# Apply deployment
terraform apply tfplan

# View outputs (connection string is sensitive)
terraform output
terraform output -raw connection_string
```

## Environment Variables

### Required GitHub Secrets

- `AZURE_CLIENT_ID`: Azure service principal client ID
- `AZURE_TENANT_ID`: Azure tenant ID
- `AZURE_SUBSCRIPTION_ID`: Azure subscription ID
- `POSTGRES_ADMIN_PASSWORD`: PostgreSQL admin password (optional - auto-generated if not provided)

## Outputs

The Terraform configuration provides these outputs:

- `server_name`: PostgreSQL server name
- `server_fqdn`: Fully qualified domain name
- `database_name`: Database name
- `admin_username`: Admin username
- `admin_password`: Admin password (sensitive)
- `connection_string`: Full connection string (sensitive)
- `resource_group_name`: Resource group name
- `server_id`: Azure resource ID

## Connection String Format

**Via PgBouncer (recommended):**
```
postgresql://pgadmin:PASSWORD@SERVER.postgres.database.azure.com:6432/DATABASE_NAME?sslmode=require
```

**Direct connection (bypasses pooling):**
```
postgresql://pgadmin:PASSWORD@SERVER.postgres.database.azure.com:5432/DATABASE_NAME?sslmode=require
```

## Security Best Practices

1. **Use Azure Key Vault** for password storage in production
2. **Restrict firewall rules** to specific IP ranges in production
3. **Enable private endpoints** for production environments
4. **Regular backups** - consider longer retention periods for production
5. **Monitor resource usage** and scale up if needed

## Scaling Up

If you need more performance, you can modify the SKU:

```hcl
# From: B_Standard_B1ms (1 vCore, 2 GiB RAM)
# To: B_Standard_B2s (2 vCore, 4 GiB RAM) - ~$25/month
# To: GP_Standard_D2s_v3 (2 vCore, 8 GiB RAM) - ~$120/month
```

## Notes

- **SSL is required** by default (enforced in connection string)
- **Collation**: en_US.UTF8
- **Charset**: UTF8
- **PgBouncer enabled**: Free connection pooling on port 6432 for efficient connection handling
- **Shared buffers**: Optimized for low resource usage (128MB)

## Parallel Deployment with MongoDB

The PostgreSQL deployment job (`terraform-postgres-deploy`) runs in parallel with MongoDB deployment (`terraform-mongodb-deploy`) during Phase 3 of the multi-cloud deployment workflow. Both databases are provisioned simultaneously to optimize deployment time.

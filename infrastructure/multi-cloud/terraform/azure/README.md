# Azure Container Apps Deployment

This directory contains Terraform configuration for deploying the Dculus Forms backend to Azure Container Apps.

## Prerequisites

### 1. Azure Service Principal
Ensure you have the following GitHub secrets configured:
- `AZURE_CLIENT_ID`: Azure service principal client ID
- `AZURE_TENANT_ID`: Azure tenant ID
- `AZURE_SUBSCRIPTION_ID`: Azure subscription ID

### 2. Application Secrets
The following secrets must be configured in your GitHub repository:

**Required:**
- `MONGODB_CONNECTION_STRING`: MongoDB Atlas or Azure Cosmos DB connection string
- `BETTER_AUTH_SECRET`: Better Auth signing secret (minimum 32 characters)

**Optional (for file uploads / CDN overrides):**
- `S3_ACCESS_KEY`: S3 access key
- `S3_SECRET_KEY`: S3 secret key
- `S3_ENDPOINT`: S3 endpoint URL
- `S3_PRIVATE_BUCKET_NAME`: Private bucket name
- `S3_PUBLIC_BUCKET_NAME`: Public bucket name
- `S3_PUBLIC_CDN_URL`: CDN endpoint that serves public assets (defaults to `https://public-cdn-${environment}.dculus.com` if omitted)

## Infrastructure Components

The Terraform configuration creates:

1. **Resource Group**: `dculus-forms-rg`
2. **Log Analytics Workspace**: For container monitoring and logging
3. **Container App Environment**: Shared environment for container apps
4. **Container App**: Backend service with auto-scaling

## Configuration

### Default Values
- **App Name**: `dculus-forms`
- **Location**: `East US`
- **Resource Group**: `dculus-forms-rg`
- **Min Replicas**: 1
- **Max Replicas**: 10
- **CPU**: 1.0 cores
- **Memory**: 2Gi

### Auto-scaling
- Scales based on concurrent HTTP requests (threshold: 10 requests)
- Health checks on `/health` endpoint
- Startup, liveness, and readiness probes configured

## Deployment Process

The deployment is automated via GitHub Actions:

1. **Triggered**: On push to `main` branch
2. **Prerequisites**: Docker image must be built and pushed first
3. **Process**:
   - Setup Terraform backend (Azure Storage)
   - Initialize Terraform
   - Plan and apply infrastructure changes
   - Deploy latest Docker image from `dculus/forms-backend:latest`
   - Run health checks
   - Output deployment URLs

## Monitoring and Health Checks

### Health Endpoints
- **Health Check**: `https://[app-url]/health`
- **GraphQL Endpoint**: `https://[app-url]/graphql`

### Logs
Access container logs via:
```bash
# View logs
az containerapp logs show \
  --name dculus-forms-backend \
  --resource-group dculus-forms-rg \
  --follow

# View revisions
az containerapp revision list \
  --name dculus-forms-backend \
  --resource-group dculus-forms-rg
```

## Manual Deployment

For manual deployment:

```bash
# 1. Set environment variables
export TF_VAR_mongodb_connection_string="your-mongodb-connection-string"
export TF_VAR_jwt_secret="your-jwt-secret-min-32-chars"
export TF_VAR_better_auth_secret="your-better-auth-secret-min-32-chars"

# 2. Initialize Terraform
cd terraform
terraform init

# 3. Plan deployment
terraform plan

# 4. Apply changes
terraform apply
```

## Customization

To customize the deployment, modify variables in `variables.tf` or pass them during deployment:

```bash
terraform apply \
  -var="app_name=my-custom-app" \
  -var="location=West Europe" \
  -var="resource_group_name=my-custom-rg"
```

## Troubleshooting

### Common Issues

1. **Health Check Fails**: Check container logs and environment variables
2. **MongoDB Connection**: Verify connection string and network access
3. **Resource Limits**: Adjust CPU/memory in `main.tf` if needed

### Debugging Commands
```bash
# Check container app status
az containerapp show \
  --name dculus-forms-backend \
  --resource-group dculus-forms-rg

# View container logs
az containerapp logs show \
  --name dculus-forms-backend \
  --resource-group dculus-forms-rg

# Test endpoints
curl https://[your-app-url]/health
curl -X POST https://[your-app-url]/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __schema { types { name } } }"}'
```

## Clean Up

To destroy all resources:
```bash
cd terraform
terraform destroy
```

**Warning**: This will permanently delete all resources created by this configuration.

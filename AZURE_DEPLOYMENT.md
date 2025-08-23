# Azure Container Apps Deployment

This document describes the Azure Container Apps deployment for Dculus Forms, consisting of MongoDB and backend services.

## Architecture Overview

The deployment creates the following resources:

### Core Infrastructure
- **Resource Group**: Contains all Azure resources
- **Container App Environment**: Shared environment for both container apps
- **Log Analytics Workspace**: For monitoring and debugging
- **Key Vault**: Stores sensitive environment variables
- **Storage Account**: Provides persistent storage for MongoDB data

### Container Apps
- **MongoDB Container App**: Internal-only MongoDB database with persistent storage
- **Backend Container App**: Public-facing Express.js + GraphQL API

## Environment Variables

The backend container app uses these environment variables:

### Required Secrets (stored in Key Vault)
- `DATABASE_URL`: MongoDB connection string
- `JWT_SECRET`: JWT authentication secret (32+ characters)
- `BETTER_AUTH_SECRET`: Better Auth secret (32+ characters)
- `BETTER_AUTH_URL`: Backend URL for Better Auth callbacks
- `BASE_URL`: Base URL for the backend service

### Optional Secrets (Cloudflare R2)
- `CLOUDFLARE_R2_ACCESS_KEY`: Access key for R2 storage
- `CLOUDFLARE_R2_SECRET_KEY`: Secret key for R2 storage
- `CLOUDFLARE_R2_ENDPOINT`: R2 endpoint URL
- `CLOUDFLARE_R2_PRIVATE_BUCKET_NAME`: Private bucket name
- `CLOUDFLARE_R2_PUBLIC_BUCKET_NAME`: Public bucket name

### Environment Variables
- `NODE_ENV`: Set to "production"
- `PORT`: Set to "4000"

## Deployment Process

### GitHub Actions Workflow

The deployment is automated through GitHub Actions with two main jobs:

1. **deploy-mongodb-container-app**: Deploys MongoDB and supporting infrastructure
2. **deploy-backend-container-app**: Deploys the backend application

### Manual Deployment

For manual deployment using Terraform:

1. **Prerequisites**:
   ```bash
   # Install required tools
   az login
   terraform --version  # Requires Terraform >= 1.0
   ```

2. **Set Required Variables**:
   ```bash
   export TF_VAR_mongodb_admin_password="your-secure-mongodb-password"
   export TF_VAR_jwt_secret="your-jwt-secret-32-chars-minimum"
   export TF_VAR_better_auth_secret="your-auth-secret-32-chars-minimum"
   ```

3. **Deploy Infrastructure**:
   ```bash
   cd terraform
   terraform init
   terraform plan
   terraform apply
   ```

## Security Features

- **Key Vault Integration**: All secrets stored securely in Azure Key Vault
- **Managed Identity**: Container apps use system-assigned identity for Key Vault access
- **Internal MongoDB**: Database is not publicly accessible
- **HTTPS Only**: Backend enforces HTTPS connections
- **Network Security**: Container apps communicate through Azure's internal network

## Monitoring & Debugging

- **Log Analytics**: All container logs are sent to Azure Log Analytics
- **Health Checks**: Both containers have configured health probes
- **Metrics**: Azure Monitor provides performance and availability metrics

### Accessing Logs

```bash
# View backend logs
az containerapp logs show --name <backend-container-app-name> --resource-group <resource-group-name>

# View MongoDB logs
az containerapp logs show --name <mongodb-container-app-name> --resource-group <resource-group-name>
```

## Testing the Deployment

Once deployed, test the backend:

```bash
# Health check
curl https://<backend-url>/health

# GraphQL endpoint
curl -X POST https://<backend-url>/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __typename }"}'
```

## Cost Optimization

- **Container Apps**: Pay-per-use pricing with automatic scaling
- **MongoDB**: Single replica optimized for development/staging
- **Storage**: Standard LRS replication for cost efficiency
- **Log Retention**: 30 days to balance cost and debugging needs

## Troubleshooting

### Common Issues

1. **Container startup failures**: Check container logs and environment variables
2. **Database connection issues**: Verify MongoDB container is running and network connectivity
3. **Secret access issues**: Ensure managed identity has Key Vault permissions
4. **Health check failures**: Verify the `/health` endpoint responds correctly

### Debug Commands

```bash
# Check container app status
az containerapp show --name <app-name> --resource-group <resource-group-name>

# View environment variables (sensitive values masked)
az containerapp show --name <app-name> --resource-group <resource-group-name> --query "properties.template.containers[0].env"

# Test internal connectivity
az containerapp exec --name <backend-app-name> --resource-group <resource-group-name> --command "nc -zv <mongodb-app-name> 27017"
```
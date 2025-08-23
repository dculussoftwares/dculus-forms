# Backend Container App Deployment

This directory contains Terraform configuration to deploy the Dculus Forms backend to Azure Container Apps, using the existing MongoDB Container App as the database.

## Architecture

The backend deployment includes:

- **Azure Container App**: Hosts the Express.js + GraphQL backend
- **Azure Container Registry**: Stores the backend Docker images
- **Azure Key Vault**: Stores application secrets and credentials
- **Managed Identity**: Secure authentication between services
- **Integration**: Connects to existing MongoDB Container App infrastructure

## Prerequisites

1. **MongoDB Container App**: Must be deployed first using `infrastructure/mongodb-container-app/`
2. **Azure CLI**: Installed and logged in with appropriate permissions
3. **Terraform**: Version >= 1.0
4. **GitHub Repository**: Configured with required secrets and variables

## GitHub Configuration

### Required Secrets

Configure these secrets in your GitHub repository (`Settings > Secrets and variables > Actions > Secrets`):

```bash
# Azure Authentication (Service Principal)
AZURE_CLIENT_ID         # Service Principal Client ID
AZURE_TENANT_ID         # Azure Tenant ID  
AZURE_SUBSCRIPTION_ID   # Azure Subscription ID

# Cloudflare R2 Storage (Optional)
CLOUDFLARE_R2_ACCESS_KEY  # R2 Access Key
CLOUDFLARE_R2_SECRET_KEY  # R2 Secret Key
```

### Required Variables

Configure these variables in your GitHub repository (`Settings > Secrets and variables > Actions > Variables`):

```bash
# Azure Authentication (same as secrets for OIDC)
AZURE_CLIENT_ID
AZURE_TENANT_ID
AZURE_SUBSCRIPTION_ID

# Cloudflare R2 Storage (Optional)
CLOUDFLARE_R2_ENDPOINT="https://your-account-id.r2.cloudflarestorage.com"
CLOUDFLARE_R2_PRIVATE_BUCKET_NAME="your-private-bucket"
CLOUDFLARE_R2_PUBLIC_BUCKET_NAME="your-public-bucket"
```

## Azure Service Principal Setup

If you don't already have a Service Principal from the MongoDB deployment, create one:

```bash
# Create service principal for GitHub Actions
az ad sp create-for-rbac \
  --name "dculus-forms-github-actions" \
  --role contributor \
  --scopes /subscriptions/YOUR_SUBSCRIPTION_ID \
  --json-auth

# The output will provide the required values for GitHub secrets
```

For OIDC authentication (recommended), also configure federated credentials:

```bash
# Get the Service Principal Object ID
SP_OBJECT_ID=$(az ad sp list --display-name "dculus-forms-github-actions" --query "[0].id" -o tsv)

# Create federated credential for main branch
az ad app federated-credential create \
  --id $SP_OBJECT_ID \
  --parameters '{
    "name": "dculus-forms-main-branch",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:YOUR_GITHUB_USERNAME/dculus-forms:ref:refs/heads/main",
    "audiences": ["api://AzureADTokenExchange"]
  }'

# Create federated credential for pull requests
az ad app federated-credential create \
  --id $SP_OBJECT_ID \
  --parameters '{
    "name": "dculus-forms-pull-requests", 
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:YOUR_GITHUB_USERNAME/dculus-forms:pull_request",
    "audiences": ["api://AzureADTokenExchange"]
  }'
```

## Local Development and Testing

### Prerequisites

```bash
# Install dependencies
az login
terraform --version  # Should be >= 1.0
```

### Manual Deployment

1. **Initialize Terraform**:
   ```bash
   cd infrastructure/backend-container-app
   terraform init
   ```

2. **Plan the deployment**:
   ```bash
   terraform plan \
     -var="environment=dev" \
     -var="cloudflare_r2_access_key=your-key" \
     -var="cloudflare_r2_secret_key=your-secret"
   ```

3. **Apply the configuration**:
   ```bash
   terraform apply
   ```

4. **Get outputs**:
   ```bash
   # Get the backend URL
   terraform output backend_url
   
   # Get the container registry details
   terraform output container_registry_login_server
   terraform output -raw container_registry_admin_password
   ```

### Build and Deploy Container Image

After infrastructure is deployed:

```bash
# Get registry credentials
REGISTRY_NAME=$(terraform output -raw container_registry_name)
az acr login --name $REGISTRY_NAME

# Build and tag image (from repository root)
docker build -f apps/backend/Dockerfile -t $REGISTRY_NAME.azurecr.io/dculus-backend:latest .

# Push image
docker push $REGISTRY_NAME.azurecr.io/dculus-backend:latest

# Update container app
az containerapp update \
  --name dculus-backend \
  --resource-group dculus-backend-rg \
  --image $REGISTRY_NAME.azurecr.io/dculus-backend:latest
```

## Configuration

### Default Variables

The deployment uses these default values (can be overridden):

- **Resource Group**: `dculus-backend-rg`
- **Location**: `East US`  
- **Environment**: `dev` (set to `prod` for main branch)
- **Container CPU**: `1.0`
- **Container Memory**: `2Gi`
- **Min Replicas**: `1`
- **Max Replicas**: `3`

### MongoDB Integration

The backend automatically connects to the existing MongoDB infrastructure by:

1. **Reading connection string** from MongoDB's Key Vault
2. **Using same Container App Environment** for internal networking
3. **Referencing existing resources** via data sources

Required MongoDB resources (created by `mongodb-container-app`):
- Resource Group: `dculus-mongodb-rg`
- Container App Environment: `dculus-mongodb-env`  
- Key Vault: `dculus-mongodb-kv`

## Environment Variables

The Container App is configured with these environment variables:

### Core Application
- `NODE_ENV`: Environment (dev/prod)
- `PORT`: 4000
- `BASE_URL`: Public URL of the backend
- `DATABASE_URL`: MongoDB connection string (from Key Vault)

### Authentication
- `JWT_SECRET`: Generated secret for JWT tokens
- `JWT_EXPIRES_IN`: Token expiration (7d)
- `BETTER_AUTH_SECRET`: Generated secret for Better Auth
- `BETTER_AUTH_URL`: Public URL for auth callbacks

### Storage (Optional)
- `CLOUDFLARE_R2_ACCESS_KEY`: R2 access key
- `CLOUDFLARE_R2_SECRET_KEY`: R2 secret key  
- `CLOUDFLARE_R2_ENDPOINT`: R2 endpoint URL
- `CLOUDFLARE_R2_PRIVATE_BUCKET_NAME`: Private bucket name
- `CLOUDFLARE_R2_PUBLIC_BUCKET_NAME`: Public bucket name

## Deployment Workflow

The GitHub Actions workflow (`deploy-backend-container-app.yml`) runs on:

1. **Push to main**: Deploys infrastructure and container image to production
2. **Pull Request**: Runs plan and validation only
3. **Manual Dispatch**: Allows plan/apply/destroy actions

### Workflow Jobs

1. **terraform**: Deploys infrastructure (Container Registry, Key Vault, Container App)
2. **build-and-deploy**: Builds Docker image and deploys to Container App
3. **output-summary**: Creates deployment summary in GitHub

## Endpoints

After successful deployment, these endpoints are available:

- **Health Check**: `https://{backend_fqdn}/health`
- **GraphQL API**: `https://{backend_fqdn}/graphql`
- **Auth API**: `https://{backend_fqdn}/api/auth/*`
- **Forms API**: `https://{backend_fqdn}/api/forms/*`

## Monitoring and Troubleshooting

### View Container App Logs

```bash
az containerapp logs show \
  --name dculus-backend \
  --resource-group dculus-backend-rg \
  --tail 100
```

### Check Container App Status

```bash
az containerapp show \
  --name dculus-backend \
  --resource-group dculus-backend-rg \
  --query "properties.provisioningState"
```

### Test Connectivity

```bash
# Health check
curl https://your-backend-url/health

# GraphQL endpoint
curl -X POST https://your-backend-url/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query { __typename }"}'
```

## Security Features

- ✅ **Managed Identity**: Container App uses system-assigned identity
- ✅ **Key Vault Integration**: Secrets stored in Azure Key Vault
- ✅ **Private MongoDB**: Internal connection to MongoDB Container App
- ✅ **Container Registry**: Private registry with authentication
- ✅ **Network Isolation**: Container App Environment provides network boundary
- ✅ **HTTPS Only**: All endpoints use HTTPS

## Cost Optimization

- **Container Apps**: Pay per request with automatic scaling
- **Container Registry**: Basic tier for development
- **Key Vault**: Standard tier with minimal operations
- **Auto-scaling**: Scales down to 1 replica when idle

## Cleanup

To remove all resources:

```bash
# Via Terraform
terraform destroy

# Or via Azure CLI
az group delete --name dculus-backend-rg --yes --no-wait
```

## Next Steps

1. **Custom Domain**: Configure custom domain for production
2. **SSL Certificate**: Use Azure-managed SSL certificates  
3. **Monitoring**: Set up Application Insights
4. **Load Testing**: Test auto-scaling behavior
5. **CI/CD**: Enhance workflow with testing stages
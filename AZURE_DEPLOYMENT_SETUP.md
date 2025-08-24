# Azure Container Apps Deployment Setup

This guide helps you set up automated deployment of the Dculus Forms backend to Azure Container Apps.

## 🎯 Quick Start

Your deployment is already configured! Just add the required secrets to trigger deployments.

## 📋 Required GitHub Secrets

Add these secrets in your GitHub repository settings (`Settings` → `Secrets and variables` → `Actions`):

### Azure Authentication
- `AZURE_CLIENT_ID` ✅ (already configured)
- `AZURE_TENANT_ID` ✅ (already configured) 
- `AZURE_SUBSCRIPTION_ID` ✅ (already configured)

### Application Configuration
**Required:**
```
MONGODB_CONNECTION_STRING=mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long
BETTER_AUTH_SECRET=your-better-auth-secret-minimum-32-characters-long
```

**Optional (for file uploads):**
```
CLOUDFLARE_R2_ACCESS_KEY=your-r2-access-key
CLOUDFLARE_R2_SECRET_KEY=your-r2-secret-key
CLOUDFLARE_R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
CLOUDFLARE_R2_PRIVATE_BUCKET_NAME=your-private-bucket
CLOUDFLARE_R2_PUBLIC_BUCKET_NAME=your-public-bucket
```

## 🚀 How It Works

### Automatic Deployment
1. **Push to main** → GitHub Actions triggers
2. **Build & Push** → Docker image pushed to Docker Hub
3. **Deploy to Azure** → Terraform provisions infrastructure
4. **Health Check** → Validates deployment
5. **Ready!** → Backend accessible at generated URL

### Infrastructure Created
- **Resource Group**: `dculus-forms-rg`
- **Container App Environment**: Shared environment with monitoring
- **Container App**: Auto-scaling backend service (1-10 replicas)
- **Log Analytics**: For monitoring and debugging

## 📊 Deployment Flow

```mermaid
graph LR
    A[Push to main] --> B[Build & Test]
    B --> C[Build Docker Image]
    C --> D[Push to Docker Hub]
    D --> E[Deploy to Azure]
    E --> F[Health Check]
    F --> G[Ready! 🎉]
```

## 🔧 Generated Secret Examples

### JWT_SECRET
```bash
# Generate a secure JWT secret (32+ characters)
openssl rand -base64 32
```

### BETTER_AUTH_SECRET  
```bash
# Generate a secure Better Auth secret (32+ characters)
openssl rand -base64 32
```

## 📍 After Deployment

Once deployed, you'll get:
- **Backend URL**: `https://dculus-forms-backend-[random].eastus.azurecontainerapps.io`
- **GraphQL Endpoint**: `[backend-url]/graphql`
- **Health Check**: `[backend-url]/health`

## 🔍 Testing Your Deployment

```bash
# Replace with your actual backend URL
BACKEND_URL="https://dculus-forms-backend-abc123.eastus.azurecontainerapps.io"

# Test health endpoint
curl $BACKEND_URL/health

# Test GraphQL endpoint
curl -X POST $BACKEND_URL/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __schema { types { name } } }"}'
```

## 🛠️ Managing Your Deployment

### View Logs
```bash
az containerapp logs show \
  --name dculus-forms-backend \
  --resource-group dculus-forms-rg \
  --follow
```

### Scale Manually
```bash
az containerapp update \
  --name dculus-forms-backend \
  --resource-group dculus-forms-rg \
  --min-replicas 2 \
  --max-replicas 20
```

### Update Environment Variables
```bash
az containerapp update \
  --name dculus-forms-backend \
  --resource-group dculus-forms-rg \
  --set-env-vars "NEW_VARIABLE=new-value"
```

## 🚨 Troubleshooting

### Common Issues

1. **"Health check failed"**
   - Check MongoDB connection string
   - Verify all required secrets are set
   - Check container logs

2. **"Terraform apply failed"**
   - Ensure Azure service principal has proper permissions
   - Check if resource names are unique
   - Verify subscription has Container Apps enabled

3. **"GraphQL endpoint not responding"**
   - Wait 2-3 minutes after deployment
   - Check if all environment variables are set
   - Review application logs

### Debug Commands
```bash
# Check deployment status
az containerapp show \
  --name dculus-forms-backend \
  --resource-group dculus-forms-rg \
  --query "{Name:name,Status:properties.provisioningState,URL:properties.configuration.ingress.fqdn}"

# View recent logs
az containerapp logs show \
  --name dculus-forms-backend \
  --resource-group dculus-forms-rg \
  --tail 50
```

## 💰 Cost Optimization

### Free Tier
- Container Apps: 180,000 vCPU-seconds + 360,000 GiB-seconds/month free
- Log Analytics: 5GB data ingestion/month free

### Production Recommendations
- Set appropriate min/max replicas based on traffic
- Use consumption-based pricing for variable workloads
- Monitor costs in Azure Cost Management

## 🔒 Security Best Practices

✅ **Already Configured:**
- Service principal authentication (no long-lived keys)
- Secrets stored in GitHub Secrets (encrypted)
- HTTPS-only ingress
- Container runs as non-root user

📋 **Additional Recommendations:**
- Rotate JWT secrets periodically
- Use Azure Key Vault for production secrets
- Enable Azure Monitor alerts for failures
- Review access logs regularly

## 🎉 Next Steps

1. **Add secrets** → Push to main branch
2. **Watch deployment** → Check Actions tab
3. **Test your API** → Use the generated URLs
4. **Connect frontend** → Update frontend configuration
5. **Monitor** → Set up alerts and monitoring

Your backend will be automatically deployed and updated with every push to the main branch! 🚀
# MongoDB on Azure Container Apps

This Terraform configuration deploys MongoDB Community Edition using Azure Container Apps with persistent storage - a cost-effective, serverless alternative to traditional VMs.

## 🏗️ Architecture Overview (2024 Best Practices)

- **Container Platform**: Azure Container Apps (serverless, latest azurerm provider)
- **MongoDB**: Official MongoDB 7.x Docker image (mongo:7-jammy)
- **Storage**: Azure Files with ZRS replication for high availability
- **Security**: Key Vault integration, managed identity, NSG rules
- **Monitoring**: TCP health probes, Azure Log Analytics integration
- **Networking**: Internal-first with optional external access
- **Cost**: ~$15-30/month with enhanced features

## 💰 Cost Comparison

| Component | Container Apps 2024 | VM Alternative |
|-----------|---------------------|----------------|
| Compute | $8-15/month | $30-35/month |
| Storage (ZRS) | $2-4/month | $5-10/month |
| Key Vault | $1/month | $0 (self-managed) |
| Monitoring | $2-5/month | $3-8/month |
| **Total** | **$15-30/month** | **$35-45/month** |

## 🚀 Deployment Options

### Option 1: GitHub Actions (Recommended)

1. **Go to Actions** → "Deploy MongoDB Container App"
2. **Configure deployment**:
   - **Action**: `apply` (to deploy)
   - **CPU**: `0.5` (default, can increase to 1.0+ for more performance)
   - **Memory**: `1.0Gi` (default, can increase to 2.0Gi+)
   - **Storage**: `10` GB (can increase as needed)
   - **Location**: `East US` (or your preferred region)

3. **Run workflow** and get connection details

### Option 2: Local Deployment

```bash
cd infrastructure/mongodb-container-app

# Initialize Terraform
terraform init

# Plan deployment
terraform plan \
  -var="container_cpu=0.5" \
  -var="container_memory=1.0Gi" \
  -var="storage_size_gb=10"

# Apply deployment
terraform apply
```

## 🔗 Connection Details

After deployment, you'll receive:

### Connection String Format
```
mongodb://admin:SecureRootPassword123!@<app-fqdn>:27017/dculus_forms
```

### Example Usage
```javascript
// Node.js with MongoDB driver
const { MongoClient } = require('mongodb');
const uri = "mongodb://admin:SecureRootPassword123!@your-app-fqdn:27017/dculus_forms";
const client = new MongoClient(uri);

// Or with Mongoose
const mongoose = require('mongoose');
mongoose.connect('mongodb://admin:SecureRootPassword123!@your-app-fqdn:27017/dculus_forms');
```

## 📊 Container Configuration

### CPU & Memory Options
- **Minimum**: 0.25 CPU, 0.5Gi RAM (~$5/month)
- **Recommended**: 0.5 CPU, 1.0Gi RAM (~$10/month)
- **High Performance**: 1.0+ CPU, 2.0Gi+ RAM (~$15-25/month)

### Storage Options
- **Development**: 5-10GB (~$1-2/month)
- **Production**: 20-100GB (~$3-15/month)
- **Enterprise**: 100GB+ (~$15+/month)

## 🔧 Key Features

### ✅ Advantages over VM
- **Serverless**: No server management required
- **Auto-scaling**: Scales to zero when not used (saves costs)
- **HTTPS by default**: Automatic SSL/TLS certificates
- **Integrated logging**: Built-in Azure Log Analytics
- **Faster deployment**: ~2-3 minutes vs ~10-15 minutes for VM
- **Lower cost**: ~60-70% cheaper than equivalent VM

### 🔒 Security Features (2024 Enhanced)
- **Key Vault Integration**: Passwords stored securely in Azure Key Vault
- **Managed Identity**: System-assigned identity for secure resource access
- **Network Security Groups**: Configurable firewall rules for external access
- **Internal-first networking**: Secure by default with optional external exposure
- **Zone-Redundant Storage**: Enhanced data durability and availability
- **Health probes**: TCP-based startup, liveness, and readiness checks
- **Container isolation**: Secure container runtime with resource limits

## 🛠️ Management

### Monitor Container
```bash
# View logs via Azure CLI
az containerapp logs show \
  --name <container-app-name> \
  --resource-group <resource-group>

# View metrics
az monitor metrics list \
  --resource <container-app-resource-id>
```

### Scale Container
```bash
# Update CPU/Memory via Terraform
terraform apply \
  -var="container_cpu=1.0" \
  -var="container_memory=2.0Gi"
```

### Backup Data
MongoDB data is persisted in Azure Files, which provides:
- **Built-in redundancy** (LRS by default)
- **Snapshot capability** for backups
- **Cross-region replication** options

## 🔧 Customization

### Environment Variables
The container supports MongoDB environment variables:
- `MONGO_INITDB_ROOT_USERNAME=admin`
- `MONGO_INITDB_ROOT_PASSWORD=<password>`
- `MONGO_INITDB_DATABASE=dculus_forms`

### Persistent Storage
- **Path**: `/data/db` (MongoDB data directory)
- **Type**: Azure Files (SMB share)
- **Performance**: Standard tier (can upgrade to Premium)

## 📝 Production Considerations

### Security
1. **Change default passwords** immediately
2. **Restrict network access** via Container Apps policies
3. **Enable audit logging** for compliance
4. **Use Azure Key Vault** for password management

### Performance
1. **Monitor CPU/Memory** usage via Azure Monitor
2. **Scale horizontally** if needed (multiple replicas)
3. **Upgrade storage tier** for better I/O performance
4. **Consider dedicated compute** for consistent performance

### Reliability
1. **Enable health checks** (configured by default)
2. **Set up alerts** for container failures
3. **Configure backup strategy** for Azure Files
4. **Use multiple regions** for disaster recovery

## 🗑️ Cleanup

```bash
# Destroy via Terraform
terraform destroy

# Or via GitHub Actions
# Select "destroy" action in workflow
```

## 📞 Support

- **Azure Container Apps**: https://docs.microsoft.com/en-us/azure/container-apps/
- **MongoDB Docker Image**: https://hub.docker.com/_/mongo
- **Terraform AzureRM Provider**: https://registry.terraform.io/providers/hashicorp/azurerm/latest

## 🎉 Benefits Summary

✅ **60-70% cost reduction** vs VM  
✅ **Serverless architecture** - no server management  
✅ **Faster deployments** - 2-3 minutes  
✅ **HTTPS by default** - automatic SSL/TLS  
✅ **Integrated monitoring** - Azure Log Analytics  
✅ **Persistent storage** - data survives restarts  
✅ **Auto-scaling** - scales based on demand  
✅ **Container security** - isolated execution environment
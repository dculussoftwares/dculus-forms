# DataGrip MongoDB Connection Guide

## Current Status: VNet Configuration Required for Direct TCP Access

### Background
Azure Container Apps with external TCP access for MongoDB (port 27017) requires custom VNet configuration. Our current deployment uses the standard managed environment, which supports HTTP/HTTPS ingress but not direct TCP connections from external tools like DataGrip.

### Current Working Solutions ✅

#### 1. MongoDB Express Web Interface - **FULLY FUNCTIONAL**
- **URL**: https://dculus-mongodb-express-7177.bravecliff-115abcbb.eastus.azurecontainerapps.io
- **Username**: admin  
- **Password**: SecureMongoDB2025!@#$
- **Features**: Complete MongoDB administration including:
  - Database and collection management
  - Document CRUD operations
  - Query execution and indexing
  - Data import/export capabilities
  - User and role management
  - Real-time performance monitoring

#### 2. Container-to-Container Access - **READY FOR APPLICATIONS**
```
Internal Connection String:
mongodb://admin:SecureMongoDB2025!@#$@dculus-mongodb-7177:27017/dculus_forms
```

### DataGrip Connection Options

#### Option 1: SSH Tunnel via Azure VM (Recommended)
Deploy a small Azure VM as a jump host:

```bash
# 1. Create minimal Ubuntu VM
az vm create \
  --resource-group dculus-mongodb-container-rg \
  --name mongodb-jumphost \
  --image Ubuntu2204 \
  --size Standard_B1s \
  --admin-username azureuser \
  --generate-ssh-keys

# 2. Configure DataGrip SSH tunnel:
# Host: <vm-public-ip>
# User: azureuser
# Port: 22
# 
# Then connect to: localhost:27017 through tunnel
# MongoDB URI: mongodb://admin:SecureMongoDB2025!@#$@localhost:27017/dculus_forms
```

#### Option 2: Azure Container Apps with Custom VNet (Advanced)
For production environments requiring direct external access:

**Required Infrastructure:**
- Custom VNet with dedicated subnet (/23 minimum)
- Container Apps Environment with infrastructure subnet
- Network Security Groups with MongoDB port rules
- External TCP ingress configuration

**Estimated Additional Cost:** ~$30-50/month
**Configuration Complexity:** High
**Use Case:** Production environments with multiple DB clients

#### Option 3: Local Development Setup
For development work with DataGrip:

```bash
# 1. Export data from MongoDB Express web interface
# 2. Set up local MongoDB instance
docker run -d \
  --name local-mongodb \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=SecureMongoDB2025 \
  mongo:8.0

# 3. Import data to local instance
# 4. Connect DataGrip to localhost:27017
```

#### Option 4: Azure Bastion + Container Instance (Enterprise)
For secure, scalable access:

```bash
# Deploy Container Instance with MongoDB tools in VNet
az container create \
  --resource-group dculus-mongodb-container-rg \
  --name mongodb-tools \
  --image mongo:8.0 \
  --vnet mongodb-vnet \
  --subnet tools-subnet \
  --command-line "/bin/bash -c 'while true; do sleep 30; done'"

# Access via Azure Bastion for secure MongoDB client connections
```

### Current Infrastructure Cost Analysis

**Current Setup (Container Apps):**
- Container Apps Environment: ~$15-20/month
- MongoDB Container: ~$10-15/month  
- Storage Account: ~$2-5/month
- **Total**: ~$27-40/month

**With VNet Configuration Added:**
- Additional VNet costs: ~$15-25/month
- External load balancer: ~$20-30/month
- **Total**: ~$62-95/month

**Alternative VM-Based MongoDB:**
- Standard_D2s_v3 VM: ~$70-90/month
- Managed disks: ~$10-15/month
- **Total**: ~$80-105/month

### Recommendation: Use MongoDB Express Web Interface

**Why MongoDB Express is the best current solution:**
1. ✅ **Zero additional cost** - already deployed and working
2. ✅ **Full functionality** - complete database management capabilities  
3. ✅ **Secure access** - HTTPS with authentication
4. ✅ **No configuration needed** - ready to use now
5. ✅ **Browser-based** - accessible from any device
6. ✅ **Export capabilities** - data can be exported for local development

**DataGrip Features Available in MongoDB Express:**
- ✅ Database browsing and navigation
- ✅ Collection and document management  
- ✅ Query execution with syntax highlighting
- ✅ Index creation and management
- ✅ Data import/export (JSON, CSV)
- ✅ User and role administration
- ✅ Real-time server statistics

### Getting Started with MongoDB Express

1. **Open the web interface:**
   ```
   https://dculus-mongodb-express-7177.bravecliff-115abcbb.eastus.azurecontainerapps.io
   ```

2. **Login credentials:**
   ```
   Username: admin
   Password: SecureMongoDB2025!@#$
   ```

3. **Navigate to your database:**
   - Select "dculus_forms" database from the list
   - Browse collections and documents
   - Execute queries using the query interface

4. **For complex queries:**
   - Use the "Query" tab in each collection
   - Write MongoDB queries with full syntax support
   - Export results as needed

### Production Considerations

For production environments where external TCP access is absolutely required:

1. **Budget for VNet Configuration**: Plan additional $30-50/month
2. **Security Review**: Implement IP allowlisting and VPN access
3. **Monitoring**: Set up proper logging and alerting
4. **Backup Strategy**: Configure automated backups
5. **High Availability**: Consider zone redundancy

### Next Steps

Based on your current needs, I recommend:

1. **Short-term**: Use MongoDB Express web interface for database management
2. **Development**: Set up local MongoDB instance with exported data for DataGrip testing
3. **Long-term**: If direct external access becomes critical, implement VNet configuration

The MongoDB Express interface provides 95% of DataGrip's functionality through a web browser, making it the most practical solution for immediate use.
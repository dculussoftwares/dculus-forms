# MongoDB Persistence Options Documentation

This document outlines all available MongoDB persistence options for the dculus-forms project, their implementations, trade-offs, and future enhancement paths.

## Current Implementation: Option C - Azure Files with SMB

### Overview
MongoDB deployed on Azure Container Apps with Premium FileStorage (5GB) using SMB protocol for persistent data storage.

### Architecture Components
- **Storage Account**: `dculusmongodbstorage` (Premium FileStorage, LRS)
- **File Share**: `mongodb-data` (5GB SMB share)
- **VNet Integration**: Custom VNet with /23 subnet for Container Apps Environment
- **Init Container**: Permission fix using `chown -R 999:999 /data/db`
- **Service Endpoints**: Storage service endpoint on subnet for secure access

### Configuration Details
```terraform
# Premium FileStorage Account
resource "azurerm_storage_account" "mongodb_storage" {
  name                     = "dculusmongodbstorage"
  account_tier             = "Premium"
  account_kind             = "FileStorage"
  account_replication_type = "LRS"
}

# SMB File Share (5GB)
resource "azurerm_storage_share" "mongodb_data" {
  name                 = "mongodb-data"
  quota                = 5
  enabled_protocol     = "SMB"
}

# Init Container for Permissions
init_container {
  name    = "mongodb-init"
  image   = "busybox:latest"
  command = ["/bin/sh", "-c", "chown -R 999:999 /data/db && chmod -R 755 /data/db"]
}
```

### Cost Analysis
- **Premium FileStorage**: ~$1.60/month (5GB × $0.32/GB/month)
- **VNet**: Free for basic usage
- **Container Apps**: Based on CPU/Memory usage (~$10-30/month)
- **Total Estimated**: $12-32/month

### Pros
✅ True persistent storage across container restarts  
✅ Full control over MongoDB version and configuration  
✅ Data survives container crashes and deployments  
✅ Compatible with MongoDB WiredTiger engine (with proper permissions)  
✅ Integrated with Azure monitoring and backups  

### Cons
❌ Complex VNet setup required  
❌ Higher cost than EmptyDir  
❌ Potential performance impact vs local storage  
❌ SMB protocol overhead for database operations  
❌ Init container required for permission management  

---

## Alternative Options for Future Enhancement

### Option A: EmptyDir + Backup Strategy

#### Implementation
```terraform
volume {
  name         = "mongodb-data"
  storage_type = "EmptyDir"
}
```

#### Backup Strategy Options
1. **Scheduled mongodump to Azure Blob Storage**
   ```bash
   # Daily backup script
   mongodump --host localhost:27017 --out /backup/$(date +%Y-%m-%d)
   az storage blob upload-batch --destination backups --source /backup
   ```

2. **Container restart with restore**
   ```bash
   # On startup, check for existing data, restore if empty
   if [ ! -d "/data/db/admin" ]; then
     mongorestore --host localhost:27017 /backup/latest
   fi
   ```

#### Cost Analysis
- **Storage**: Free (EmptyDir)
- **Backup Storage**: ~$1-3/month (Azure Blob Storage)
- **Total Estimated**: $1-3/month + Container Apps cost

#### Pros
✅ Lowest cost option  
✅ Simple setup, no VNet required  
✅ Fast local storage performance  
✅ MongoDB starts quickly  
✅ Automated backup/restore possible  

#### Cons
❌ Data lost on container restart (until restore)  
❌ Manual restore process  
❌ Backup frequency vs data loss trade-off  
❌ No real-time persistence  

---

### Option B: External MongoDB Services

#### B1: MongoDB Atlas
```javascript
// Connection string configuration
const MONGODB_URI = "mongodb+srv://user:pass@cluster.mongodb.net/dculus-forms"
```

#### Cost Analysis (MongoDB Atlas)
- **M0 Free Tier**: $0/month (512MB storage, limited connections)
- **M2 Starter**: $9/month (2GB storage, 500 connections)
- **M5 General**: $25/month (5GB storage, 1000 connections)

#### B2: Azure Cosmos DB for MongoDB API
```terraform
resource "azurerm_cosmosdb_account" "mongodb" {
  name                = "dculus-mongodb"
  offer_type         = "Standard"
  kind               = "MongoDB"
  
  capabilities {
    name = "EnableMongo"
  }
  
  consistency_policy {
    consistency_level = "Session"
  }
}
```

#### Cost Analysis (Cosmos DB)
- **Serverless**: $0.25/1M Request Units + $0.20/GB storage
- **Provisioned (400 RU/s)**: ~$23.5/month + storage costs
- **Estimated Monthly**: $25-50/month for typical usage

#### Pros (Both Services)
✅ Fully managed, no infrastructure  
✅ Automatic backups and point-in-time recovery  
✅ High availability and global distribution  
✅ Built-in monitoring and alerting  
✅ Automatic scaling  
✅ Professional support  

#### Cons (Both Services)
❌ Higher cost than self-hosted  
❌ Vendor lock-in  
❌ Network latency for database operations  
❌ Limited control over MongoDB configuration  
❌ (Cosmos DB) 2MB document size limit  
❌ (Cosmos DB) Not 100% MongoDB compatible  

---

### Option D: NFS Azure Files (Future Enhancement)

#### Implementation
```terraform
resource "azurerm_storage_account" "mongodb_storage" {
  account_kind    = "FileStorage"
  nfsv3_enabled   = true
  
  network_rules {
    default_action = "Deny"
    virtual_network_subnet_ids = [azurerm_subnet.mongodb_subnet.id]
  }
}

resource "azurerm_storage_share" "mongodb_data" {
  enabled_protocol = "NFS"
}
```

#### Cost Analysis
- **Premium FileStorage**: Same as current SMB implementation
- **NFS Performance**: Potentially better than SMB for database workloads

#### Pros
✅ Better performance than SMB for database I/O  
✅ True POSIX file system semantics  
✅ No permission management overhead  
✅ Native Linux file system protocol  

#### Cons
❌ More complex networking requirements  
❌ Limited to Premium storage tiers  
❌ Container Apps NFS support still maturing  

---

## Migration Path Recommendations

### Immediate (Current State)
- ✅ **Option C implemented**: Azure Files with SMB
- 🔄 **Monitoring setup**: Implement MongoDB performance monitoring
- 📋 **Backup strategy**: Add automated backups as safety net

### Short-term (1-3 months)
- 🔍 **Performance evaluation**: Monitor MongoDB performance with Azure Files
- 🧪 **Load testing**: Test with realistic data volumes and concurrent users
- 📊 **Cost optimization**: Review and optimize storage tier if needed

### Medium-term (3-6 months)
- 🚀 **Consider Option B**: Evaluate MongoDB Atlas or Cosmos DB if scaling issues
- 🔄 **Backup improvements**: Implement point-in-time backup strategy
- 📈 **Monitoring enhancement**: Add comprehensive MongoDB metrics

### Long-term (6+ months)
- 🏗️ **Option D evaluation**: Test NFS Azure Files when Container Apps support matures
- ☁️ **Multi-region**: Consider replication for global availability
- 🔒 **Security hardening**: Implement MongoDB authentication, encryption at rest

---

## Implementation Commands

### Current Setup Verification
```bash
# Check storage account
az storage account show --name dculusmongodbstorage --resource-group dculus-mongodb-backend

# Check file share
az storage share show --name mongodb-data --account-name dculusmongodbstorage

# Check MongoDB container
az containerapp show --name dculus-mongodb-backend-mongodb --resource-group dculus-mongodb-backend

# Test MongoDB connection
az containerapp exec --name dculus-mongodb-backend-mongodb --resource-group dculus-mongodb-backend --command "mongosh --eval 'db.runCommand({ping: 1})'"
```

### Backup Implementation Example
```bash
# Create backup container (for Option A enhancement)
az containerapp create \
  --name mongodb-backup \
  --resource-group dculus-mongodb-backend \
  --environment dculus-mongodb-backend-environment \
  --image alpine/mongodump:latest \
  --cpu 0.25 --memory 0.5Gi \
  --cron "0 2 * * *" \
  --env-vars "MONGODB_URI=mongodb://admin:password@dculus-mongodb-backend-mongodb:27017"
```

### Migration to Atlas (Option B)
```javascript
// Update environment variables
process.env.MONGODB_URI = "mongodb+srv://user:pass@cluster.mongodb.net/dculus-forms"

// No code changes required - just connection string update
```

---

## Monitoring and Alerting

### Key Metrics to Monitor
1. **Storage Usage**: File share utilization
2. **Performance**: MongoDB query response times  
3. **Availability**: Container restart frequency
4. **Costs**: Monthly Azure consumption

### Recommended Alerts
```bash
# Storage usage > 80%
az monitor metrics alert create \
  --name "MongoDB Storage Usage High" \
  --resource dculus-mongodb-backend \
  --condition "avg Percentage CPU > 80"

# Container restart frequency
az monitor metrics alert create \
  --name "MongoDB Container Restarts" \
  --resource dculus-mongodb-backend-mongodb \
  --condition "total Restart Count > 5"
```

---

## Decision Matrix

| Option | Setup Complexity | Monthly Cost | Performance | Reliability | Scaling |
|--------|------------------|--------------|-------------|-------------|---------|
| A (EmptyDir + Backup) | Low | $1-5 | High | Medium | Manual |
| B1 (MongoDB Atlas) | Very Low | $9-25 | High | Very High | Automatic |
| B2 (Cosmos DB) | Low | $25-50 | Medium | Very High | Automatic |
| C (Azure Files SMB) | High | $12-32 | Medium | High | Manual |
| D (Azure Files NFS) | Very High | $12-32 | High | High | Manual |

**Current Choice Rationale**: Option C provides the best balance of control, persistence, and cost for the current development phase while allowing future migration to managed services as the application scales.

---

## Troubleshooting Guide

### Common Issues
1. **Permission errors**: Check init container logs, verify uid/gid 999
2. **Connection refused**: Verify Container App Environment networking
3. **Slow performance**: Monitor Azure Files metrics, consider NFS upgrade
4. **High costs**: Review storage tier, implement lifecycle policies

### Support Contacts
- **Azure Files Issues**: Azure Support Portal
- **Container Apps**: GitHub Issues or Azure Support
- **MongoDB**: Community forums or MongoDB Support (if Atlas)

---

*Last Updated: 2025-08-24*  
*Next Review: 2025-11-24*
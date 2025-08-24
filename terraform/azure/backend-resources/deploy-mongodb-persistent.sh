#!/bin/bash

# MongoDB with Azure Files Persistent Storage Deployment Script
# This script deploys MongoDB on Azure Container Apps with persistent Azure Files storage

set -e

echo "🚀 Starting MongoDB with Azure Files persistent storage deployment..."

# Configuration
RESOURCE_GROUP="dculus-mongodb-backend"
LOCATION="eastus" 
STORAGE_ACCOUNT="dculusmongodbstorage"
VNET_NAME="dculus-mongodb-backend-vnet"
SUBNET_NAME="dculus-mongodb-backend-subnet"
CONTAINER_ENV="dculus-mongodb-backend-environment"
CONTAINER_APP="dculus-mongodb-backend-mongodb"
FILE_SHARE="mongodb-data"

# Set MongoDB password (change this!)
export MONGODB_ADMIN_PASSWORD="${MONGODB_ADMIN_PASSWORD:-TEOGyZBTnQ0o0kQqW8v7HNNoKZC3pjIz}"

echo "📋 Configuration:"
echo "  Resource Group: $RESOURCE_GROUP"
echo "  Location: $LOCATION"
echo "  Storage Account: $STORAGE_ACCOUNT"
echo "  File Share Size: 5GB"

# Step 1: Create Virtual Network
echo "🌐 Creating Virtual Network and Subnet..."
az network vnet create \
  --name $VNET_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --address-prefix 10.0.0.0/16 \
  --subnet-name $SUBNET_NAME \
  --subnet-prefixes 10.0.0.0/23 \
  --tags Environment=production Project=dculus-forms

# Add service endpoint for storage
az network vnet subnet update \
  --resource-group $RESOURCE_GROUP \
  --vnet-name $VNET_NAME \
  --name $SUBNET_NAME \
  --service-endpoints Microsoft.Storage

# Step 2: Create Premium FileStorage Account
echo "💾 Creating Premium FileStorage Account..."
az storage account create \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Premium_LRS \
  --kind FileStorage \
  --tags Environment=production Project=dculus-forms

# Step 3: Create File Share
echo "📁 Creating Azure File Share (5GB)..."
az storage share create \
  --name $FILE_SHARE \
  --account-name $STORAGE_ACCOUNT \
  --quota 5

# Step 4: Create Container App Environment with VNet
echo "🏗️ Creating Container App Environment..."
SUBNET_ID="/subscriptions/$(az account show --query id -o tsv)/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.Network/virtualNetworks/$VNET_NAME/subnets/$SUBNET_NAME"

az containerapp env create \
  --name $CONTAINER_ENV \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --infrastructure-subnet-resource-id $SUBNET_ID \
  --tags Environment=production Project=dculus-forms

# Step 5: Add Storage to Container App Environment
echo "🔗 Configuring Container App Environment Storage..."
STORAGE_KEY=$(az storage account keys list --resource-group $RESOURCE_GROUP --account-name $STORAGE_ACCOUNT --query "[0].value" --output tsv)

az containerapp env storage set \
  --name $CONTAINER_ENV \
  --resource-group $RESOURCE_GROUP \
  --storage-name mongodb-storage \
  --azure-file-account-name $STORAGE_ACCOUNT \
  --azure-file-account-key $STORAGE_KEY \
  --azure-file-share-name $FILE_SHARE \
  --access-mode ReadWrite

# Step 6: Create MongoDB Container App with Init Container
echo "🍃 Creating MongoDB Container App..."
cat > mongodb-config.yaml << EOF
location: $LOCATION
resourceGroup: $RESOURCE_GROUP
type: Microsoft.App/containerApps
name: $CONTAINER_APP
properties:
  environmentId: /subscriptions/$(az account show --query id -o tsv)/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.App/managedEnvironments/$CONTAINER_ENV
  configuration:
    ingress:
      external: false
      targetPort: 27017
      transport: tcp
      traffic:
      - weight: 100
        latestRevision: true
    secrets:
    - name: mongodb-admin-password
      value: $MONGODB_ADMIN_PASSWORD
  template:
    initContainers:
    - name: mongodb-init
      image: busybox:latest
      command:
      - /bin/sh
      - -c
      - chown -R 999:999 /data/db && chmod -R 755 /data/db
      resources:
        cpu: 0.25
        memory: 0.5Gi
      volumeMounts:
      - volumeName: mongodb-data
        mountPath: /data/db
    containers:
    - name: mongodb
      image: mongo:latest
      env:
      - name: MONGO_INITDB_ROOT_USERNAME
        value: admin
      - name: MONGO_INITDB_ROOT_PASSWORD
        secretRef: mongodb-admin-password
      - name: MONGODB_USER_ID
        value: "999"
      - name: MONGODB_GROUP_ID
        value: "999"
      resources:
        cpu: 1.0
        memory: 2Gi
      volumeMounts:
      - volumeName: mongodb-data
        mountPath: /data/db
      probes:
      - type: liveness
        tcpSocket:
          port: 27017
        initialDelaySeconds: 30
        periodSeconds: 10
      - type: readiness
        tcpSocket:
          port: 27017
        initialDelaySeconds: 5
        periodSeconds: 5
    scale:
      minReplicas: 1
      maxReplicas: 1
    volumes:
    - name: mongodb-data
      storageType: azureFile
      storageName: mongodb-storage
  tags:
    Environment: production
    Project: dculus-forms
    Service: mongodb
EOF

az containerapp create --yaml mongodb-config.yaml

# Step 7: Verify Deployment
echo "✅ Verifying MongoDB deployment..."
sleep 30

CONTAINER_STATUS=$(az containerapp show --name $CONTAINER_APP --resource-group $RESOURCE_GROUP --query "properties.runningStatus" -o tsv)
echo "MongoDB Container Status: $CONTAINER_STATUS"

if [ "$CONTAINER_STATUS" = "Running" ]; then
    echo "🎉 MongoDB with Azure Files persistent storage deployed successfully!"
    
    # Get connection info
    FQDN=$(az containerapp show --name $CONTAINER_APP --resource-group $RESOURCE_GROUP --query "properties.configuration.ingress.fqdn" -o tsv)
    echo "📡 Internal MongoDB Endpoint: $FQDN:27017"
    echo "🔑 Connection String: mongodb://admin:$MONGODB_ADMIN_PASSWORD@$FQDN:27017/dculus-forms?authSource=admin"
    
    echo ""
    echo "📊 Storage Information:"
    echo "  Account: $STORAGE_ACCOUNT"
    echo "  Share: $FILE_SHARE (5GB)"
    echo "  Type: Premium FileStorage (SMB)"
    
    echo ""
    echo "🔍 Monitoring Commands:"
    echo "  Check logs: az containerapp logs show --name $CONTAINER_APP --resource-group $RESOURCE_GROUP"
    echo "  Check status: az containerapp show --name $CONTAINER_APP --resource-group $RESOURCE_GROUP"
    echo "  Check storage: az storage share show --name $FILE_SHARE --account-name $STORAGE_ACCOUNT"
else
    echo "❌ Deployment failed. Check logs:"
    az containerapp logs show --name $CONTAINER_APP --resource-group $RESOURCE_GROUP --tail 50
    exit 1
fi

# Cleanup temporary file
rm -f mongodb-config.yaml

echo ""
echo "✨ Next Steps:"
echo "1. Update your application connection string to use the internal endpoint"
echo "2. Set up monitoring and alerting (see MONGODB-PERSISTENCE-OPTIONS.md)"
echo "3. Configure automated backups as additional safety measure"
echo "4. Review cost and performance after initial usage period"

echo ""
echo "📚 Documentation: See MONGODB-PERSISTENCE-OPTIONS.md for all persistence options and migration paths"
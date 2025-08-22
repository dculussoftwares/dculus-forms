# MongoDB Community Edition on Azure VM

This Terraform configuration deploys MongoDB Community Edition on an Azure Standard_B2s VM (cheapest viable option for MongoDB).

## 🏗️ Infrastructure Overview

- **VM**: Standard_B2s (2 vCPUs, 4 GB RAM, ~$30/month)
- **OS**: Ubuntu 22.04 LTS
- **MongoDB**: Community Edition 8.0 (latest stable)
- **Storage**: 30GB Standard SSD
- **Network**: Public IP with restricted access via Network Security Group
- **Authentication**: SSH key-based + MongoDB authentication enabled

## 🚀 Deployment Options

### Option 1: GitHub Actions (Recommended)

1. **Required GitHub Secrets** (already configured):
   - `AZURE_SUBSCRIPTION_ID`
   - `AZURE_CLIENT_ID`
   - `AZURE_TENANT_ID`
   - `SSH_PUBLIC_KEY` (your SSH public key content)

2. **Deploy via GitHub Actions**:
   - Go to Actions → "Deploy MongoDB VM"
   - Select "Run workflow"
   - Choose action: `plan` (to review) or `apply` (to deploy)
   - Optionally customize VM size and location

### Option 2: Local Deployment

```bash
# Navigate to terraform directory
cd infrastructure/mongodb-vm

# Initialize Terraform
terraform init

# Plan deployment (review changes)
terraform plan \
  -var="admin_ssh_public_key=$(cat ~/.ssh/id_rsa.pub)" \
  -var="allowed_ssh_ips=[\"$(curl -s ifconfig.me)/32\"]" \
  -var="allowed_mongodb_ips=[\"$(curl -s ifconfig.me)/32\"]"

# Apply deployment
terraform apply \
  -var="admin_ssh_public_key=$(cat ~/.ssh/id_rsa.pub)" \
  -var="allowed_ssh_ips=[\"$(curl -s ifconfig.me)/32\"]" \
  -var="allowed_mongodb_ips=[\"$(curl -s ifconfig.me)/32\"]"
```

## 🔒 Security Configuration

### Default Security Settings (Change These!)

```hcl
# Variables to customize
variable "allowed_ssh_ips" {
  default = ["0.0.0.0/0"]  # ⚠️ WARNING: Open to world
}

variable "allowed_mongodb_ips" {
  default = ["0.0.0.0/0"]  # ⚠️ WARNING: Open to world
}
```

### Recommended Security Settings

```hcl
# Restrict to your IP only
allowed_ssh_ips = ["YOUR_IP_ADDRESS/32"]
allowed_mongodb_ips = ["YOUR_IP_ADDRESS/32"]

# Or specific IP ranges
allowed_ssh_ips = ["192.168.1.0/24", "10.0.0.0/8"]
allowed_mongodb_ips = ["192.168.1.0/24"]
```

## 📋 Post-Deployment Steps

### 1. Connect to VM

```bash
# Get connection details from Terraform output
terraform output ssh_connection_command

# SSH to VM
ssh azureuser@<PUBLIC_IP>
```

### 2. Verify MongoDB Installation

```bash
# Check installation details
cat /home/azureuser/mongodb-info.txt

# Check MongoDB status
sudo systemctl status mongod

# View installation logs
sudo tail -f /var/log/mongodb-install.log
```

### 3. Test MongoDB Connection

```bash
# Local connection (from VM)
mongosh "mongodb://admin:SecureAdminPassword123!@localhost:27017/admin"

# Application database connection
mongosh "mongodb://dculus_app:DculusAppPassword123!@localhost:27017/dculus_forms"
```

### 4. Remote Connection

```bash
# From your local machine (replace <VM_IP>)
mongosh "mongodb://dculus_app:DculusAppPassword123!@<VM_IP>:27017/dculus_forms"
```

## 🔑 Default Credentials (Change These!)

### Admin User
- **Username**: `admin`
- **Password**: `SecureAdminPassword123!`
- **Database**: `admin`
- **Roles**: Full admin access

### Application User
- **Username**: `dculus_app`
- **Password**: `DculusAppPassword123!`
- **Database**: `dculus_forms`
- **Roles**: Read/Write access to dculus_forms database

## 💰 Cost Information

- **VM Cost**: ~$30-35/month (Standard_B2s)
- **Storage Cost**: ~$5-10/month (30GB Standard SSD)
- **Network Cost**: Minimal for typical usage
- **Total**: ~$35-45/month

### Cost Optimization Options

1. **Auto-shutdown**: Schedule VM shutdown during non-use hours
2. **Spot Instances**: Up to 90% savings (with interruption risk)
3. **Smaller Storage**: Reduce disk size for development environments

## 🛠️ Customization Options

### VM Sizes

```hcl
# Available options (increasing cost)
vm_size = "Standard_B1s"   # 1 vCPU, 1GB RAM (too small for MongoDB)
vm_size = "Standard_B2s"   # 2 vCPU, 4GB RAM (minimum recommended)
vm_size = "Standard_B4ms"  # 4 vCPU, 16GB RAM (better performance)
```

### MongoDB Configuration

```hcl
# MongoDB version
mongodb_version = "8.0"    # Latest stable
mongodb_version = "7.0"    # Previous stable

# Storage size
disk_size_gb = 30          # Minimum
disk_size_gb = 100         # More data storage
```

## 🔧 Troubleshooting

### VM Access Issues

```bash
# Check VM status
az vm show --resource-group dculus-mongodb-rg --name <VM_NAME>

# Check NSG rules
az network nsg show --resource-group dculus-mongodb-rg --name dculus-mongodb-nsg
```

### MongoDB Issues

```bash
# Check MongoDB service
sudo systemctl status mongod

# Check MongoDB logs
sudo tail -f /var/log/mongodb/mongod.log

# Check installation logs
sudo tail -f /var/log/mongodb-install.log

# Restart MongoDB
sudo systemctl restart mongod
```

### Network Connectivity

```bash
# Test MongoDB port from external machine
telnet <VM_IP> 27017

# Check firewall rules on VM
sudo ufw status

# Test MongoDB connection
mongosh --host <VM_IP> --port 27017
```

## 🗑️ Cleanup

### Destroy Infrastructure

```bash
# Via Terraform
terraform destroy

# Or via GitHub Actions
# Select "destroy" action in workflow
```

### Manual Cleanup

```bash
# Delete resource group (removes everything)
az group delete --name dculus-mongodb-rg --yes --no-wait
```

## 📞 Support

- **MongoDB Docs**: https://www.mongodb.com/docs/manual/
- **Azure VM Docs**: https://docs.microsoft.com/en-us/azure/virtual-machines/
- **Terraform Azure Provider**: https://registry.terraform.io/providers/hashicorp/azurerm/latest

## ⚠️ Important Reminders

1. **Change default passwords immediately**
2. **Restrict IP access in security groups**
3. **Enable SSL/TLS for production use**
4. **Set up automated backups**
5. **Monitor costs and usage**
6. **Keep MongoDB updated**
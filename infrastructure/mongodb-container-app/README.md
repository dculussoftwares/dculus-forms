# MongoDB on Azure Container Apps - Terraform Infrastructure

This Terraform configuration deploys MongoDB on Azure Container Apps with persistent storage and security best practices.

## Architecture

- **Azure Container Apps**: Hosts MongoDB container with auto-scaling capabilities
- **Azure Files**: Provides persistent storage for MongoDB data
- **Azure Key Vault**: Securely stores MongoDB credentials
- **Azure Log Analytics**: Centralized logging and monitoring
- **Azure Storage Account**: Blob storage for persistent data

## Features

- ✅ MongoDB 7.0 (latest free version)
- ✅ Persistent data storage using Azure Files
- ✅ Automatic password generation
- ✅ Secure credential storage in Key Vault
- ✅ External access configuration
- ✅ Centralized logging
- ✅ Infrastructure as Code with Terraform
- ✅ GitHub Actions deployment pipeline

## Prerequisites

1. **Azure CLI** installed and authenticated
2. **Terraform** >= 1.0 installed
3. **Azure subscription** with appropriate permissions
4. **GitHub repository** with OIDC configured (already done for this repo)

## Required GitHub Variables

Configure the following variables in your GitHub repository (Settings → Secrets and variables → Actions → Variables):

```
AZURE_SUBSCRIPTION_ID  # Your Azure subscription ID
AZURE_CLIENT_ID        # Service principal app ID (already configured)
AZURE_TENANT_ID        # Your Azure tenant ID
```

See `GITHUB_SECRETS_SETUP.md` for detailed setup instructions.

## Quick Start

### 1. Local Deployment

```bash
# Clone the repository
git clone <repository-url>
cd dculus-forms/infrastructure/mongodb-container-app

# Copy and customize variables
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your preferences

# Initialize Terraform
terraform init

# Plan the deployment
terraform plan

# Apply the configuration
terraform apply
```

### 2. GitHub Actions Deployment

Push changes to the `main` branch to trigger automatic deployment via GitHub Actions.

## Configuration

### Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `resource_group_name` | Azure Resource Group name | `dculus-mongodb-rg` | No |
| `location` | Azure region | `East US` | No |
| `prefix` | Resource name prefix | `dculus` | No |
| `mongodb_image` | MongoDB Docker image | `mongo:7.0` | No |
| `mongodb_cpu` | CPU allocation | `1.0` | No |
| `mongodb_memory` | Memory allocation | `2Gi` | No |
| `mongodb_root_username` | Root username | `root` | No |
| `mongodb_init_database` | Initial database | `dculus_forms` | No |
| `mongodb_external_access` | Enable external access | `true` | No |
| `environment` | Environment name | `dev` | No |

### Outputs

The configuration provides the following outputs:

- `mongodb_fqdn`: MongoDB connection endpoint
- `mongodb_connection_string`: Full connection string (sensitive)
- `mongodb_root_password`: Root password (sensitive)
- `key_vault_name`: Key Vault name for credential retrieval

## Security Considerations

1. **Network Security**: Container Apps provide built-in network isolation
2. **Credential Management**: All sensitive data stored in Azure Key Vault
3. **Access Control**: Use Azure RBAC for resource access
4. **Encryption**: Data encrypted at rest and in transit
5. **Monitoring**: Centralized logging with Log Analytics

## Monitoring and Maintenance

### Access Logs
```bash
# View container logs
az containerapp logs show \
  --name dculus-mongodb \
  --resource-group dculus-mongodb-rg
```

### Scale Configuration
```bash
# Update scaling rules
az containerapp update \
  --name dculus-mongodb \
  --resource-group dculus-mongodb-rg \
  --min-replicas 1 \
  --max-replicas 3
```

### Backup Strategy

1. **Data Persistence**: MongoDB data is stored on Azure Files
2. **Key Vault Backup**: Credentials are backed up automatically
3. **Infrastructure Backup**: Terraform state is stored remotely

## Cost Optimization

- **Container Apps**: Pay-per-use pricing model
- **Azure Files**: Standard storage tier for cost efficiency
- **Log Analytics**: 30-day retention to manage costs
- **Key Vault**: Standard tier for basic secret management

## Troubleshooting

### Common Issues

1. **Connection Timeout**: Check network security groups and firewall rules
2. **Authentication Failed**: Verify credentials in Key Vault
3. **Storage Issues**: Check Azure Files mount permissions
4. **Resource Creation Failed**: Verify Azure subscription limits

### Debug Commands

```bash
# Check container status
az containerapp show --name dculus-mongodb --resource-group dculus-mongodb-rg

# View resource group resources
az resource list --resource-group dculus-mongodb-rg

# Test connectivity
az containerapp exec --name dculus-mongodb --resource-group dculus-mongodb-rg --command "mongosh --version"
```

## Cleanup

To destroy all resources:

```bash
terraform destroy
```

**Warning**: This will permanently delete all MongoDB data and resources.

## Support

For issues and questions:

1. Check the [GitHub Issues](../../issues)
2. Review Azure Container Apps documentation
3. Consult Terraform Azure provider documentation

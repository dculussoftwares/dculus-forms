# GitHub Variables Setup for MongoDB Infrastructure

Since OIDC federated credentials are already configured for this repository, you only need to set up the GitHub repository variables.

## Required GitHub Variables

The following variables must be configured in your GitHub repository settings as **Variables** (not secrets):

### Azure Authentication Variables

| Variable Name | Description | How to Get |
|---------------|-------------|------------|
| `AZURE_SUBSCRIPTION_ID` | Your Azure subscription ID | `az account show --query id -o tsv` |
| `AZURE_CLIENT_ID` | Service Principal App ID | Already configured for this repo |
| `AZURE_TENANT_ID` | Azure AD Tenant ID | `az account show --query tenantId -o tsv` |

## Quick Setup

### 1. Get Azure Details

```bash
# Login to Azure
az login

# Get your subscription and tenant IDs
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)

echo "Subscription ID: $SUBSCRIPTION_ID"
echo "Tenant ID: $TENANT_ID"
```

### 2. Get Service Principal Client ID

Since the federated credentials are already configured, you need to get the existing service principal's client ID:

```bash
# Get the client ID of the existing service principal
CLIENT_ID=$(az ad sp list --display-name "dculus-mongodb-github-actions" --query "[0].appId" -o tsv)

echo "Client ID: $CLIENT_ID"
```

### 3. Configure GitHub Repository Variables

1. Go to your GitHub repository: `https://github.com/dculussoftwares/dculus-forms`
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click on the **Variables** tab
4. Add the following repository variables:

#### AZURE_SUBSCRIPTION_ID
- **Value**: The subscription ID from step 1

#### AZURE_CLIENT_ID
- **Value**: The client ID from step 2

#### AZURE_TENANT_ID
- **Value**: The tenant ID from step 1

### 4. Test the Configuration

Once you've added the variables, test the configuration:

1. Push a change to the `infrastructure/mongodb-container-app/` directory
2. Check the Actions tab in your GitHub repository
3. Verify that the workflow runs successfully

## Workflow Behavior

- **Pull Requests**: Only runs `terraform plan` and shows the plan in PR comments
- **Push to main**: Runs `terraform plan` and `terraform apply` automatically
- **Manual Dispatch**: Choose between `plan`, `apply`, or `destroy` actions

## Security Benefits

✅ **No Secrets Stored**: Only public variables, no sensitive data in GitHub  
✅ **OIDC Authentication**: Short-lived tokens issued by Azure AD  
✅ **Federated Trust**: GitHub identity provider trusted by Azure  
✅ **Audit Trail**: All authentication logged in Azure AD  

## Verification Commands

To verify your setup:

```bash
# Check if service principal exists
az ad sp list --display-name "dculus-mongodb-github-actions"

# Check federated credentials
CLIENT_ID=$(az ad sp list --display-name "dculus-mongodb-github-actions" --query "[0].appId" -o tsv)
az ad app federated-credential list --id $CLIENT_ID

# Test Azure access
az account show
```

## Troubleshooting

### Common Issues

#### Variable Not Found Errors
- Ensure variables are set as **Variables**, not **Secrets**
- Check variable names match exactly: `AZURE_SUBSCRIPTION_ID`, `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`

#### Authentication Failures
- Verify the service principal has Contributor role
- Check that federated credentials are configured for your repository
- Ensure you're using the correct subscription

#### Permission Denied
- Verify subscription limits and quotas
- Check that required resource providers are enabled

## Troubleshooting

### Common Issues

#### Authentication Failed
- Verify all three secrets are correctly set
- Check that the service principal has Contributor role
- Ensure OIDC federated credentials are configured

#### Permission Denied
- Verify the service principal has sufficient permissions
- Check Azure subscription limits
- Ensure resource providers are registered

### Useful Commands

```bash
# Check service principal permissions
az role assignment list --assignee $CLIENT_ID

# List federated credentials
az ad app federated-credential list --id $SP_OBJECT_ID

# Test Azure authentication
az login --service-principal \
  --username $CLIENT_ID \
  --tenant $TENANT_ID \
  --password $CLIENT_SECRET
```

## Support

If you encounter issues:

1. Check the GitHub Actions logs for detailed error messages
2. Verify Azure service principal permissions
3. Ensure all required secrets are configured
4. Review Azure resource quotas and limits

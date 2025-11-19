# Azure PostgreSQL Infrastructure (Flexible Server)

This module provisions a lightweight Azure PostgreSQL Flexible Server tailored for Dculus Forms backends. It follows the same environment-based Terraform backend pattern as the other infrastructure modules so that each environment (dev/staging/production) keeps its state isolated, and resource names follow the `dculus-forms-{env}-backend-database` convention.

## State & Backend

- Each environment stores its Terraform state inside Azure Storage containers named `dculus-forms-azure-postgres-{environment}-state`.
- The backend files live under `./environments/{dev,staging,production}/backend.tf`.
- The state containers are created in the `dculusterraformstates` storage account inside `dculus-global-terraform-assets-resource-grp`.
- Resources are created inside their own resource group whose default name is `dculus-forms-{environment}-postgres-rg`, keeping the PostgreSQL lifecycle separate from the container-app RG.

## Prerequisites

### Azure Authentication
Make sure the following GitHub secrets are configured:

| Secret | Description |
|--------|-------------|
| `AZURE_CLIENT_ID` | Azure service principal client ID |
| `AZURE_TENANT_ID` | Azure tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID |

### PostgreSQL Credentials
- `AZURE_POSTGRES_ADMIN_PASSWORD` (optional): When provided, Terraform uses it for the PostgreSQL administrator. When omitted, the module automatically generates a strong 24-character password (stored in Terraform state and used in outputs).
- Optionally, `AZURE_POSTGRES_ADMIN_USERNAME` can be provided if you want to override the default (`dculusadmin`). If the secret is missing, Terraform defaults to `dculusadmin`.

## Deployment

The GitHub Actions workflow (`.github/workflows/multi-cloud-deployment.yml`) now includes a dedicated job to deploy this module in parallel with the MongoDB job. The job:

1. Fetches the Azure Storage account key to communicate with the shared Terraform backend.
2. Initializes Terraform inside `infrastructure/multi-cloud/terraform/azure-postgres/environments/<env>`.
3. Plans and applies the configuration.
4. Outputs the connection string, server FQDN, and database name for downstream consumption.

You can also manage the resources manually:

```bash
cd infrastructure/multi-cloud/terraform/azure-postgres/environments/dev
terraform init
terraform plan
terraform apply
```

> **Tip**: When running locally you can omit `TF_VAR_postgres_admin_password` to let Terraform generate a compliant password, or set it explicitly with `export TF_VAR_postgres_admin_password='...'`.

## Customization

- Adjust storage, SKU, and backup settings via `variables.tf`/build-time variable overrides.
- Firewall configuration defaults to allowing all IPs (`postgres_firewall_allow_all = true`) but can be tightened by disabling that flag and supplying `postgres_firewall_start_ip` / `postgres_firewall_end_ip`.
- Add or override tags using the `tags` variable; the module automatically merges the provided map with `Environment = <env>`.

## Cleanup

To destroy the resources:

```bash
cd infrastructure/multi-cloud/terraform/azure-postgres/environments/dev
terraform destroy
```

Ensure you know which environment you are targeting before destroying production infrastructure.

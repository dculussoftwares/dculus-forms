# Azure Subscription Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate all Azure Terraform resources from Visual Studio Enterprise Subscription (`0457bed2-fd60-4a5e-9562-04b8d65711a5`) to Azure Sponsorship Subscription (`dc874d0f-03b3-48f6-8294-363581fc260b`), with zero changes to Cloudflare, NeonDB, or application code.

**Architecture:** The migration involves three layers: (1) re-creating the OIDC federated identity / service principal in the new subscription so GitHub Actions can authenticate, (2) recreating the Terraform state storage account (`dculusterraformstates`) in the new subscription, and (3) running `terraform import` in the new subscription for every Azure resource that already exists (or doing a fresh `terraform apply` after copying state). All GitHub Actions secrets that reference `AZURE_*` must point to the new subscription.

**Tech Stack:** Azure CLI (`az`), Terraform 1.9.8, GitHub Actions OIDC (`azure/login@v2`), `gh` CLI for updating secrets.

---

## What Is NOT Changing

- Cloudflare R2 buckets, Pages projects, DNS records
- NeonDB / database connection strings
- Application code, Docker images, Docker Hub tags
- All non-Azure GitHub secrets

---

## Pre-Flight Checklist (read before starting)

- [ ] You have Owner or Contributor + User Access Administrator on the **new** Sponsorship subscription (`dc874d0f-...`).
- [ ] You have the Azure CLI installed and can run `az login`.
- [ ] You have the `gh` CLI installed and authenticated (`gh auth status`).
- [ ] The existing resources in the old subscription are currently running (no planned downtime gap before this migration is complete).
- [ ] The GitHub repo is `dculus-forms` — confirm with `gh repo view`.

---

## Task 1: Audit Existing Old-Subscription Azure Resources

**Files:** Read-only audit — no file changes.

- [ ] **Step 1: List all resource groups in old subscription**

```bash
az account set --subscription "0457bed2-fd60-4a5e-9562-04b8d65711a5"
az group list --output table
```

Expected output includes:
- `dculus-forms-dev-rg`
- `dculus-forms-staging-rg`
- `dculus-forms-production-rg`
- `dculus-global-terraform-assets-resource-grp`

- [ ] **Step 2: List all resources in each app resource group**

```bash
for env in dev staging production; do
  echo "=== dculus-forms-${env}-rg ==="
  az resource list --resource-group "dculus-forms-${env}-rg" --output table 2>/dev/null || echo "(not found)"
done
```

- [ ] **Step 3: List Terraform state containers in the storage account**

```bash
az storage container list \
  --account-name dculusterraformstates \
  --resource-group dculus-global-terraform-assets-resource-grp \
  --output table \
  --auth-mode login
```

- [ ] **Step 4: Read current GitHub Actions secrets for Azure (names only)**

```bash
gh secret list --repo $(gh repo view --json nameWithOwner -q .nameWithOwner)
```

Note which `AZURE_*` secrets exist across all environments. Expected:
- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`

(Repeated per GitHub environment: `dev`, `staging`, `production`.)

- [ ] **Step 5: Note the current OIDC app registration name**

```bash
az ad app list --display-name "dculus" --output table 2>/dev/null || \
az ad app list --output table | grep -i dculus
```

Record the `appId` (client ID). This is what `AZURE_CLIENT_ID` currently points to.

---

## Task 2: Create OIDC Service Principal in New Subscription

GitHub Actions uses OIDC (`id-token: write`) to authenticate to Azure without storing long-lived credentials. We need to create a new app registration + service principal in the **new subscription's tenant** (or the same Entra ID tenant if they share one) and give it the right federated credential.

- [ ] **Step 1: Switch CLI context to new subscription**

```bash
az account set --subscription "dc874d0f-03b3-48f6-8294-363581fc260b"
az account show --output table
```

Confirm `id` shows `dc874d0f-03b3-48f6-8294-363581fc260b`.

- [ ] **Step 2: Check if both subscriptions share the same Entra ID tenant**

```bash
az account list --output table | grep -E "0457bed2|dc874d0f"
```

If both rows show the **same `tenantId`**, the existing app registration works — you only need to add a new role assignment on the new subscription. If tenants differ, you must create a new app registration (follow Step 3a; otherwise follow Step 3b).

- [ ] **Step 3a: (Same tenant) Assign existing service principal to new subscription**

Skip to Step 4 if you are doing the same-tenant path — you only need the new role assignment.

```bash
# Get the existing service principal object ID
SP_OBJECT_ID=$(az ad sp show --id "<AZURE_CLIENT_ID_value>" --query id -o tsv)

# Assign Contributor on new subscription
az role assignment create \
  --assignee-object-id "$SP_OBJECT_ID" \
  --assignee-principal-type ServicePrincipal \
  --role "Contributor" \
  --scope "/subscriptions/dc874d0f-03b3-48f6-8294-363581fc260b"

# Assign Storage Blob Data Contributor for Terraform state storage
az role assignment create \
  --assignee-object-id "$SP_OBJECT_ID" \
  --assignee-principal-type ServicePrincipal \
  --role "Storage Blob Data Contributor" \
  --scope "/subscriptions/dc874d0f-03b3-48f6-8294-363581fc260b"
```

Expected output: JSON role assignment objects with `principalId` matching `$SP_OBJECT_ID`.

- [ ] **Step 3b: (Different tenant) Create new app registration**

```bash
APP_ID=$(az ad app create \
  --display-name "dculus-forms-github-oidc" \
  --query appId -o tsv)
echo "New App ID: $APP_ID"

SP_OBJECT_ID=$(az ad sp create --id "$APP_ID" --query id -o tsv)
echo "SP Object ID: $SP_OBJECT_ID"
```

- [ ] **Step 4: Create federated credentials for each GitHub environment + main branch**

Run the following for each GitHub environment (`dev`, `staging`, `production`) and for the main branch OIDC token:

```bash
REPO="<org>/dculus-forms"   # e.g. "MyOrg/dculus-forms" — check with: gh repo view --json nameWithOwner -q .nameWithOwner

# Main branch (for pull_request and workflow_run triggers)
az ad app federated-credential create \
  --id "$APP_ID" \
  --parameters "{
    \"name\": \"github-main-branch\",
    \"issuer\": \"https://token.actions.githubusercontent.com\",
    \"subject\": \"repo:${REPO}:ref:refs/heads/main\",
    \"audiences\": [\"api://AzureADTokenExchange\"]
  }"

# Per environment (workflow uses GitHub Environments for deploy jobs)
for env in dev staging production; do
  az ad app federated-credential create \
    --id "$APP_ID" \
    --parameters "{
      \"name\": \"github-env-${env}\",
      \"issuer\": \"https://token.actions.githubusercontent.com\",
      \"subject\": \"repo:${REPO}:environment:${env}\",
      \"audiences\": [\"api://AzureADTokenExchange\"]
    }"
done

# Pull requests
az ad app federated-credential create \
  --id "$APP_ID" \
  --parameters "{
    \"name\": \"github-pull-request\",
    \"issuer\": \"https://token.actions.githubusercontent.com\",
    \"subject\": \"repo:${REPO}:pull_request\",
    \"audiences\": [\"api://AzureADTokenExchange\"]
  }"
```

- [ ] **Step 5: Assign Contributor + Storage Blob Data Contributor to new subscription**

```bash
az role assignment create \
  --assignee-object-id "$SP_OBJECT_ID" \
  --assignee-principal-type ServicePrincipal \
  --role "Contributor" \
  --scope "/subscriptions/dc874d0f-03b3-48f6-8294-363581fc260b"

az role assignment create \
  --assignee-object-id "$SP_OBJECT_ID" \
  --assignee-principal-type ServicePrincipal \
  --role "Storage Blob Data Contributor" \
  --scope "/subscriptions/dc874d0f-03b3-48f6-8294-363581fc260b"
```

- [ ] **Step 6: Record the new values for GitHub secrets**

```bash
NEW_CLIENT_ID="$APP_ID"
NEW_TENANT_ID=$(az account show --query tenantId -o tsv)
NEW_SUBSCRIPTION_ID="dc874d0f-03b3-48f6-8294-363581fc260b"
echo "CLIENT_ID: $NEW_CLIENT_ID"
echo "TENANT_ID: $NEW_TENANT_ID"
echo "SUBSCRIPTION_ID: $NEW_SUBSCRIPTION_ID"
```

---

## Task 3: Create Terraform State Storage in New Subscription

The Terraform backend (`dculusterraformstates` storage account) currently lives in the old subscription. We need to recreate it in the new subscription and copy all state files.

- [ ] **Step 1: Create the resource group in the new subscription**

```bash
az account set --subscription "dc874d0f-03b3-48f6-8294-363581fc260b"

az group create \
  --name "dculus-global-terraform-assets-resource-grp" \
  --location "centralindia"
```

Expected: `"provisioningState": "Succeeded"`

- [ ] **Step 2: Create the storage account**

```bash
az storage account create \
  --name "dculusterraformstates" \
  --resource-group "dculus-global-terraform-assets-resource-grp" \
  --location "centralindia" \
  --sku Standard_LRS \
  --kind StorageV2 \
  --allow-blob-public-access false \
  --min-tls-version TLS1_2
```

Expected: `"provisioningState": "Succeeded"`

- [ ] **Step 3: Create all state containers in the new storage account**

```bash
for env in dev staging production; do
  for container in \
    "dculus-forms-cloudflare-r2-${env}-state" \
    "dculus-forms-cloudflare-services-${env}-state" \
    "dculus-forms-azure-backend-${env}-state" \
    "dculus-forms-cloudflare-pages-${env}-state" \
    "dculus-forms-cloudflare-pages-admin-${env}-state" \
    "dculus-forms-cloudflare-pages-viewer-${env}-state" \
    "dculus-forms-neon-${env}-state"; do
    az storage container create \
      --name "$container" \
      --account-name "dculusterraformstates" \
      --auth-mode login
    echo "Created: $container"
  done
done
```

Expected: `"created": true` for each, or `"created": false` (already exists).

- [ ] **Step 4: Copy state files from old subscription to new**

```bash
# Get key from OLD subscription's storage account
az account set --subscription "0457bed2-fd60-4a5e-9562-04b8d65711a5"
OLD_KEY=$(az storage account keys list \
  --resource-group dculus-global-terraform-assets-resource-grp \
  --account-name dculusterraformstates \
  --query '[0].value' -o tsv)

# Get key from NEW subscription's storage account
az account set --subscription "dc874d0f-03b3-48f6-8294-363581fc260b"
NEW_KEY=$(az storage account keys list \
  --resource-group dculus-global-terraform-assets-resource-grp \
  --account-name dculusterraformstates \
  --query '[0].value' -o tsv)

# Copy state blobs — one per container
for env in dev staging production; do
  for container in \
    "dculus-forms-cloudflare-r2-${env}-state" \
    "dculus-forms-cloudflare-services-${env}-state" \
    "dculus-forms-azure-backend-${env}-state" \
    "dculus-forms-cloudflare-pages-${env}-state" \
    "dculus-forms-cloudflare-pages-admin-${env}-state" \
    "dculus-forms-cloudflare-pages-viewer-${env}-state" \
    "dculus-forms-neon-${env}-state"; do
    
    # Check if source blob exists before copying
    EXISTS=$(az storage blob exists \
      --container-name "$container" \
      --name "terraform.tfstate" \
      --account-name dculusterraformstates \
      --account-key "$OLD_KEY" \
      --query exists -o tsv 2>/dev/null || echo "false")
    
    if [ "$EXISTS" = "true" ]; then
      az storage blob copy start \
        --source-account-name dculusterraformstates \
        --source-account-key "$OLD_KEY" \
        --source-container "$container" \
        --source-blob "terraform.tfstate" \
        --destination-container "$container" \
        --destination-blob "terraform.tfstate" \
        --account-name dculusterraformstates \
        --account-key "$NEW_KEY"
      echo "Copied: $container/terraform.tfstate"
    else
      echo "Skipped (empty): $container"
    fi
  done
done
```

- [ ] **Step 5: Verify state files were copied**

```bash
az account set --subscription "dc874d0f-03b3-48f6-8294-363581fc260b"
for env in dev staging production; do
  for container in \
    "dculus-forms-cloudflare-r2-${env}-state" \
    "dculus-forms-azure-backend-${env}-state" \
    "dculus-forms-cloudflare-pages-${env}-state"; do
    
    SIZE=$(az storage blob show \
      --container-name "$container" \
      --name "terraform.tfstate" \
      --account-name dculusterraformstates \
      --auth-mode login \
      --query properties.contentLength -o tsv 2>/dev/null || echo "0")
    echo "$container: ${SIZE} bytes"
  done
done
```

Expected: each Azure-related state container shows > 0 bytes.

---

## Task 4: Migrate Azure App Resources (Container Apps + AI Foundry)

The Azure Container Apps and AI Foundry resources live in the old subscription resource groups. We have two options:

**Option A (Recommended): Re-deploy via Terraform in new subscription** — the Container Apps are stateless (no user data stored); redeploy is safe and clean. This is the preferred path.

**Option B: Azure Resource Move** — `az resource move` can move resources between subscriptions but has many restrictions (e.g., AI Foundry / Cognitive Accounts cannot be moved between subscriptions). Given `azurerm_cognitive_account.ai` is in scope, Option A is required.

We will use **Option A** — re-deploy in new subscription after updating state.

- [ ] **Step 1: For each environment, pull the current Azure state and remove old subscription resource IDs**

The copied state still contains resource IDs pointing to the old subscription. We must re-import them under the new subscription, or destroy-and-recreate. Since these are stateless Container Apps + AI resources, the clean path is: **remove the Azure resources from state, then terraform apply** to create fresh ones in the new subscription.

For each environment (`dev`, `staging`, `production`), do the following **locally**:

```bash
cd infrastructure/multi-cloud/terraform/azure/environments/dev  # repeat for staging, production

# Export the new subscription's storage key
export ARM_ACCESS_KEY=$(az storage account keys list \
  --resource-group dculus-global-terraform-assets-resource-grp \
  --account-name dculusterraformstates \
  --subscription "dc874d0f-03b3-48f6-8294-363581fc260b" \
  --query '[0].value' -o tsv)

# Copy shared terraform files (same as CI does)
cp ../../main.tf .
cp ../../variables.tf .
cp ../../outputs.tf .
cp ../../ai.tf .

# Init pointing at the new subscription's backend
terraform init \
  -backend-config="resource_group_name=dculus-global-terraform-assets-resource-grp" \
  -backend-config="storage_account_name=dculusterraformstates" \
  -backend-config="container_name=dculus-forms-azure-backend-dev-state" \
  -backend-config="key=terraform.tfstate" \
  -reconfigure
```

- [ ] **Step 2: Remove old-subscription Azure resources from Terraform state**

```bash
# List all resources in state
terraform state list

# Remove resources that have the old subscription ID baked into their IDs
# These are the Azure-specific ones (not Cloudflare/Neon resources)
terraform state rm azurerm_resource_group.main          || true
terraform state rm azurerm_container_app_environment.main || true
terraform state rm azurerm_container_app.backend         || true
terraform state rm azurerm_cognitive_account.ai          || true
terraform state rm azurerm_cognitive_deployment.gpt4o    || true
terraform state rm azurerm_cognitive_deployment.gpt4o_mini || true
```

Expected: `Removed azurerm_resource_group.main` etc. for each removed resource.

- [ ] **Step 3: Set required TF_VARs for a plan (use placeholder values for secrets)**

```bash
# Use the actual secret values from your password manager / 1Password / secrets vault
# DO NOT hardcode these in any file — set them only in your shell session
export TF_VAR_subscription_id="dc874d0f-03b3-48f6-8294-363581fc260b"
export TF_VAR_postgres_connection_string="<DATABASE_URL>"
export TF_VAR_postgres_direct_url="<DIRECT_URL>"
export TF_VAR_better_auth_secret="<BETTER_AUTH_SECRET>"
export TF_VAR_public_s3_access_key="<R2_ACCESS_KEY>"
export TF_VAR_public_s3_secret_key="<R2_SECRET_KEY>"
export TF_VAR_public_s3_endpoint="<R2_ENDPOINT>"
export TF_VAR_container_image_tag="latest"
```

- [ ] **Step 4: Run terraform plan — confirm only Azure resources will be created**

```bash
terraform plan
```

Expected: Plan shows creates for `azurerm_resource_group.main`, `azurerm_container_app_environment.main`, `azurerm_container_app.backend`, `azurerm_cognitive_account.ai`, `azurerm_cognitive_deployment.gpt4o`, `azurerm_cognitive_deployment.gpt4o_mini`. No destroys for Cloudflare or Neon resources.

- [ ] **Step 5: Apply — repeat for each environment**

```bash
terraform apply -auto-approve
```

Expected: All 6 Azure resources created successfully. Note the new Container App FQDN from output.

- [ ] **Step 6: Update `better_auth_url` in tfvars to new Container App FQDN**

After apply, `terraform output backend_fqdn` will show the new FQDN. Update:

Modify: `infrastructure/multi-cloud/terraform/azure/environments/dev/terraform.tfvars`
Modify: `infrastructure/multi-cloud/terraform/azure/environments/staging/terraform.tfvars`
Modify: `infrastructure/multi-cloud/terraform/azure/environments/production/terraform.tfvars`

Change the `better_auth_url` value from the old `*.kindocean-e9e3f3f1.eastus.azurecontainerapps.io` FQDN to the new one:

```hcl
# OLD:
better_auth_url = "https://dculus-forms-dev-backend.kindocean-e9e3f3f1.eastus.azurecontainerapps.io"

# NEW (fill in the actual new FQDN from `terraform output backend_fqdn`):
better_auth_url = "https://dculus-forms-dev-backend.<new-suffix>.eastus.azurecontainerapps.io"
```

- [ ] **Step 7: Commit the tfvars changes**

```bash
git add infrastructure/multi-cloud/terraform/azure/environments/*/terraform.tfvars
git commit -m "chore(infra): update backend FQDNs after subscription migration to Azure Sponsorship"
```

---

## Task 5: Update GitHub Actions Secrets

All three GitHub environments (`dev`, `staging`, `production`) have `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, and `AZURE_SUBSCRIPTION_ID` secrets. Update them to the new values.

- [ ] **Step 1: Update secrets for each GitHub environment**

```bash
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
NEW_CLIENT_ID="<APP_ID from Task 2>"
NEW_TENANT_ID="<tenant ID from Task 2>"
NEW_SUBSCRIPTION_ID="dc874d0f-03b3-48f6-8294-363581fc260b"

for env in dev staging production; do
  gh secret set AZURE_CLIENT_ID \
    --env "$env" \
    --body "$NEW_CLIENT_ID" \
    --repo "$REPO"
  
  gh secret set AZURE_TENANT_ID \
    --env "$env" \
    --body "$NEW_TENANT_ID" \
    --repo "$REPO"
  
  gh secret set AZURE_SUBSCRIPTION_ID \
    --env "$env" \
    --body "$NEW_SUBSCRIPTION_ID" \
    --repo "$REPO"
  
  echo "Updated Azure secrets for environment: $env"
done
```

Expected: No error output. Each `gh secret set` returns silently on success.

- [ ] **Step 2: Verify secrets are set**

```bash
for env in dev staging production; do
  echo "=== $env ==="
  gh secret list --env "$env" --repo "$REPO" | grep AZURE
done
```

Expected: All three `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` visible for each environment.

---

## Task 6: Reconfigure Cloudflare Service Domain DNS to Point to New Container App FQDNs

The Cloudflare DNS CNAME records (`form-services-dev.dculus.com` etc.) currently point to the old Container App FQDNs. After Task 4, the FQDNs changed. Terraform will update these automatically when the deployment workflow runs, but you should also run the Cloudflare service-domain Terraform manually to update DNS immediately.

- [ ] **Step 1: For each environment, re-run the cloudflare-service-domain Terraform**

```bash
cd infrastructure/multi-cloud/terraform/cloudflare-service-domain/environments/dev

cp ../../main.tf .
cp ../../variables.tf .
cp ../../outputs.tf .

export ARM_ACCESS_KEY=$(az storage account keys list \
  --resource-group dculus-global-terraform-assets-resource-grp \
  --account-name dculusterraformstates \
  --subscription "dc874d0f-03b3-48f6-8294-363581fc260b" \
  --query '[0].value' -o tsv)

terraform init \
  -backend-config="resource_group_name=dculus-global-terraform-assets-resource-grp" \
  -backend-config="storage_account_name=dculusterraformstates" \
  -backend-config="container_name=dculus-forms-cloudflare-services-dev-state" \
  -backend-config="key=terraform.tfstate" \
  -reconfigure

terraform apply \
  -var="backend_fqdn=<new-dev-backend-fqdn>" \
  -auto-approve
```

Expected: Cloudflare CNAME updated to new Azure FQDN.

- [ ] **Step 2: Confirm DNS propagation**

```bash
dig +short CNAME form-services-dev.dculus.com
```

Expected: Returns the new Azure Container Apps FQDN.

---

## Task 7: Re-run SSL Certificate Configuration

The Azure Container App custom domain binding and managed certificate (`configure-azure-custom-domain.sh`) must be re-run because the Container App was recreated.

- [ ] **Step 1: Run the custom domain script for each environment**

```bash
# Set required vars
export RESOURCE_GROUP="dculus-forms-dev-rg"
export CONTAINER_APP_NAME="dculus-forms-dev-backend"
export CONTAINER_ENV_NAME="dculus-forms-dev-env"
export CUSTOM_DOMAIN="form-services-dev.dculus.com"
export ENVIRONMENT="dev"
export CLOUDFLARE_ZONE_ID="<from GitHub secret>"
export CLOUDFLARE_API_TOKEN="<from GitHub secret>"

az account set --subscription "dc874d0f-03b3-48f6-8294-363581fc260b"

chmod +x .github/scripts/configure-azure-custom-domain.sh
./.github/scripts/configure-azure-custom-domain.sh
```

Expected: Managed certificate provisioned, custom domain binding set to `SniEnabled`.

- [ ] **Step 2: Verify binding status**

```bash
az containerapp hostname list \
  --name "dculus-forms-dev-backend" \
  --resource-group "dculus-forms-dev-rg" \
  --output table
```

Expected: `form-services-dev.dculus.com` shows `bindingType: SniEnabled`.

---

## Task 8: Validate End-to-End via GitHub Actions Deployment

Run the deployment workflow manually to confirm everything works from GitHub Actions with the new credentials.

- [ ] **Step 1: Trigger the deployment workflow for dev environment**

```bash
gh workflow run multi-cloud-deployment.yml \
  --repo $(gh repo view --json nameWithOwner -q .nameWithOwner) \
  -f environment=dev \
  -f release_tag=<latest-image-tag> \
  -f deploy_cloudflare=true \
  -f deploy_azure=true
```

- [ ] **Step 2: Watch the workflow run**

```bash
gh run watch --repo $(gh repo view --json nameWithOwner -q .nameWithOwner)
```

Expected: All jobs succeed, particularly:
- `1.2. Setup Azure Terraform Backend` — confirms OIDC login works with new credentials
- `4.1. Deploy Core Infrastructure` — confirms Terraform applies cleanly
- `7.1. Configure Backend SSL Certificate` — confirms custom domain binding
- `8.1. Run Health Checks` — confirms backend is responding

- [ ] **Step 3: Check backend health endpoint**

```bash
curl -sf https://form-services-dev.dculus.com/health
```

Expected: `{"status":"ok"}` or similar JSON health response.

---

## Task 9: Decommission Old Subscription Resources (After Validation)

Only perform this task after Task 8 succeeds and you have confirmed the new subscription is fully operational.

- [ ] **Step 1: Delete old resource groups in the old subscription**

```bash
az account set --subscription "0457bed2-fd60-4a5e-9562-04b8d65711a5"

for env in dev staging production; do
  GROUP="dculus-forms-${env}-rg"
  if az group exists --name "$GROUP" | grep -q "true"; then
    echo "Deleting resource group: $GROUP"
    az group delete --name "$GROUP" --yes --no-wait
  fi
done
```

- [ ] **Step 2: Delete the old Terraform state storage account (optional — contains no live data)**

```bash
az group delete \
  --name "dculus-global-terraform-assets-resource-grp" \
  --subscription "0457bed2-fd60-4a5e-9562-04b8d65711a5" \
  --yes \
  --no-wait
```

- [ ] **Step 3: Remove old service principal role assignments on old subscription (if same tenant)**

```bash
# Only needed if keeping the same SP for both subscriptions — remove old assignment
az role assignment delete \
  --assignee "<SP_OBJECT_ID>" \
  --role "Contributor" \
  --scope "/subscriptions/0457bed2-fd60-4a5e-9562-04b8d65711a5"
```

---

## Risk Notes

| Risk | Mitigation |
|------|-----------|
| AI Foundry quota not available in Central India on new subscription | AI resources use `eastus` (`ai_location` variable default). Verify quota with `az cognitiveservices usage list --location eastus` before running `terraform apply` |
| `dculusterraformstates` name already taken globally | Storage account names are globally unique. If taken, you'll see a 409 error — choose a different name and update all `backend-config` references in `multi-cloud-deployment.yml` and `multi-cloud-destroy.yml` |
| DNS TTL causes temporary downtime during FQDN change | The Cloudflare CNAME TTL is typically 5 minutes. Deploy at off-peak hours |
| New OIDC token subject mismatch | The federated credential `subject` must exactly match the GitHub Actions token. Use both `ref:refs/heads/main` AND `environment:<name>` subjects as created in Task 2 Step 4 |

---

## Files Modified

| File | Change |
|------|--------|
| `infrastructure/multi-cloud/terraform/azure/environments/dev/terraform.tfvars` | Update `better_auth_url` to new FQDN |
| `infrastructure/multi-cloud/terraform/azure/environments/staging/terraform.tfvars` | Update `better_auth_url` to new FQDN |
| `infrastructure/multi-cloud/terraform/azure/environments/production/terraform.tfvars` | Update `better_auth_url` to new FQDN |

No workflow YAML changes are needed — the workflows already read `AZURE_SUBSCRIPTION_ID` from GitHub secrets.

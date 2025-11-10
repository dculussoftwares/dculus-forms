# Multi-Cloud Infrastructure Destruction Guide

This guide explains how to safely destroy infrastructure using the automated GitHub Actions workflow.

## ⚠️ CRITICAL WARNING

**Destroying infrastructure results in PERMANENT DATA LOSS:**
- MongoDB Atlas databases contain ALL application data (forms, responses, users)
- Cloudflare R2 buckets contain ALL uploaded files and assets
- **M0 Free Tier MongoDB has NO backups** - data cannot be recovered
- **This action is IRREVERSIBLE**

## Overview

The Multi-Cloud Infrastructure Destroy workflow allows you to selectively destroy infrastructure components across three cloud providers:

1. **Azure Container Apps** - Backend API (stateless, safe to destroy/recreate)
2. **Cloudflare R2** - File storage (ALL files permanently deleted)
3. **MongoDB Atlas** - Database (ALL data permanently deleted)

## Prerequisites

- GitHub repository write access
- Understanding of what infrastructure exists in the environment
- Confirmation that data has been backed up (if needed)
- Team approval for infrastructure destruction

## Workflow Location

```
.github/workflows/multi-cloud-destroy.yml
```

## Available Environments

The workflow supports destruction of:
- ✅ **dev** environment
- ✅ **staging** environment
- ❌ **production** environment (NOT AVAILABLE in workflow - must be destroyed manually)

Production destruction requires manual approval and local terraform destroy with proper authorization.

## How to Destroy Infrastructure

### Step 1: Navigate to GitHub Actions

1. Go to your repository on GitHub
2. Click **Actions** tab
3. Select **Multi-Cloud Infrastructure Destroy** workflow
4. Click **Run workflow** button

### Step 2: Configure Destruction

Fill in the workflow inputs:

#### Environment
Select which environment to destroy:
- `dev` - Development environment
- `staging` - Staging environment

#### Destroy Options

Select which providers to destroy:

**🔥 Destroy MongoDB Atlas (PERMANENT DATA LOSS - Cannot be recovered)**
- ☑️ Check to destroy MongoDB cluster and ALL database data
- ☐ Leave unchecked to preserve database

**🔥 Destroy Cloudflare R2 (ALL FILES DELETED - Cannot be recovered)**
- ☑️ Check to destroy R2 buckets and ALL files
- ☐ Leave unchecked to preserve file storage

**Destroy Azure Container Apps (Stateless - Safe to recreate)**
- ☑️ Check to destroy Azure backend infrastructure
- ☐ Leave unchecked to preserve Azure resources

#### Confirmation

**Type exactly**: `DESTROY-{environment}`

Examples:
- For dev: Type `DESTROY-dev`
- For staging: Type `DESTROY-staging`

⚠️ **The workflow will FAIL if confirmation doesn't match exactly**

### Step 3: Review and Execute

1. Double-check your selections
2. Ensure confirmation text is correct
3. Click **Run workflow**
4. Monitor the workflow execution

### Step 4: Monitor Destruction

The workflow executes in this order:

1. ✅ **Validation** - Confirms your inputs
2. 🔷 **Azure Destroy** - (if selected) Destroys Container Apps
3. ☁️ **Cloudflare Destroy** - (if selected) Destroys R2 buckets and files
4. 🍃 **MongoDB Destroy** - (if selected) Destroys database and ALL data
5. 📊 **Summary** - Shows what was destroyed

Each step includes warnings and confirmations.

## What Gets Destroyed

### Azure Container Apps

**Resources Deleted:**
- Resource Group: `dculus-forms-{env}-rg`
- Container App: `dculus-forms-{env}-backend`
- Container Environment
- Log Analytics Workspace
- All monitoring data

**Data Loss:** None (stateless infrastructure)
**Recovery Time:** ~5-10 minutes to recreate

### Cloudflare R2

**Resources Deleted:**
- Private Bucket: `dculus-forms-private-{env}`
- Public Bucket: `dculus-forms-public-{env}`

**Data Loss:**
- ALL user uploads (forms attachments, documents)
- ALL public assets (images, backgrounds)
- ALL files in both buckets

**Recovery:** CANNOT be recovered - no backups exist
**Workaround:** Download files before destruction using R2 API/CLI

### MongoDB Atlas

**Resources Deleted:**
- MongoDB Project: `dculus-forms-{env}`
- M0 Cluster: `dculus-forms-{env}-mongodb`
- Database Users
- Network Access Rules

**Data Loss:**
- ALL forms
- ALL form responses
- ALL users and authentication data
- ALL organizations
- ALL configuration data

**Recovery:** **CANNOT be recovered** - M0 free tier has no backups
**Workaround:** Export data manually before destruction (see below)

## Data Backup Before Destruction

### MongoDB Data Export

If you want to preserve data before destroying MongoDB:

```bash
# Using mongodump (requires MongoDB tools installed)
mongodump --uri="<connection-string>" --out=./backup/mongodb/

# Connection string format:
# mongodb+srv://username:password@cluster-host/?retryWrites=true&w=majority
```

### R2 Files Download

If you want to preserve files before destroying R2:

```bash
# Using AWS CLI with R2 endpoint
aws s3 sync s3://dculus-forms-private-{env} ./backup/r2/private/ \
  --endpoint-url https://<account-id>.r2.cloudflarestorage.com

aws s3 sync s3://dculus-forms-public-{env} ./backup/r2/public/ \
  --endpoint-url https://<account-id>.r2.cloudflarestorage.com
```

## Destruction Examples

### Example 1: Destroy Everything (Dev)

**Scenario**: Completely tear down dev environment

**Settings:**
```
Environment: dev
Destroy MongoDB: ✅
Destroy Cloudflare: ✅
Destroy Azure: ✅
Confirmation: DESTROY-dev
```

**Result:**
- All infrastructure destroyed
- All data permanently deleted
- Clean slate for rebuilding

**Use Case:**
- Resetting dev environment
- Major infrastructure changes
- Testing deployment from scratch

### Example 2: Destroy Only Azure (Staging)

**Scenario**: Recreate backend without losing data

**Settings:**
```
Environment: staging
Destroy MongoDB: ☐
Destroy Cloudflare: ☐
Destroy Azure: ✅
Confirmation: DESTROY-staging
```

**Result:**
- Azure Container Apps destroyed and recreated
- Database and files preserved
- Backend reconnects to existing data

**Use Case:**
- Backend configuration changes
- Container image updates
- Troubleshooting backend issues

### Example 3: Destroy R2 Only (Dev)

**Scenario**: Clean up file storage

**Settings:**
```
Environment: dev
Destroy MongoDB: ☐
Destroy Cloudflare: ✅
Destroy Azure: ☐
Confirmation: DESTROY-dev
```

**Result:**
- R2 buckets and all files deleted
- Database and backend preserved
- File storage can be recreated

**Use Case:**
- Clearing test uploads
- Resetting file storage
- Fixing corrupt files

## After Destruction

### Recreating Infrastructure

To recreate destroyed infrastructure:

1. Go to **Actions** → **Multi-Cloud Deployment**
2. Select the same environment
3. Choose which providers to deploy
4. Run the workflow

**Result:**
- Infrastructure recreated from scratch
- **Data will be EMPTY** (no recovery from backups)
- Application starts fresh

### Terraform State

**State is preserved** in Azure Blob Storage:
- State files are NOT deleted
- Can recreate infrastructure from state
- State tracking continues after recreation

### What Remains After Destruction

Even after destroying everything:
- ✅ Terraform state (in Azure Blob Storage)
- ✅ GitHub secrets
- ✅ Workflow files
- ✅ Infrastructure code

You can redeploy at any time using the deployment workflow.

## Production Destruction

**Production is NOT available in the destroy workflow.**

To destroy production infrastructure:

1. **Get Team Approval** - Document reason and get sign-off
2. **Backup Data** - Export MongoDB data and R2 files
3. **Manual Terraform** - Run terraform destroy locally:
   ```bash
   cd infrastructure/multi-cloud/terraform/{provider}/environments/production
   terraform destroy
   ```
4. **Verify Destruction** - Check cloud provider dashboards

**Safety Checks:**
- Requires multiple team approvals
- Must be done manually (no automation)
- Backup verification required
- Documented approval trail

## Safety Features

The destroy workflow includes multiple safety mechanisms:

✅ **Manual Confirmation Required**
- Must type exact confirmation string
- Workflow fails if confirmation doesn't match

✅ **Environment Restrictions**
- Production not available in workflow
- Only dev and staging can be destroyed automatically

✅ **Selective Destruction**
- Choose which providers to destroy
- Can preserve data while recreating infrastructure

✅ **Ordered Destruction**
- Azure → Cloudflare → MongoDB
- Least to most destructive
- Gives time to cancel before data loss

✅ **Clear Warnings**
- Multiple warnings about data loss
- 10-second delay before MongoDB destruction
- Clear labels on destructive options

✅ **Audit Trail**
- GitHub Actions logs who destroyed what
- Timestamp and confirmation recorded
- Full execution log preserved

## Troubleshooting

### Destroy Fails with "Confirmation does not match"

**Cause:** Confirmation string doesn't match expected format

**Solution:**
- Check spelling: `DESTROY-dev` (not `destroy-dev` or `DESTROY DEV`)
- Match environment exactly: `DESTROY-staging` for staging

### Destroy Fails with "No providers selected"

**Cause:** No checkboxes selected for destruction

**Solution:** Select at least one provider (MongoDB, Cloudflare, or Azure)

### MongoDB Destroy Fails with "401 Unauthorized"

**Cause:** MongoDB Atlas API credentials expired or invalid

**Solution:**
- Verify GitHub secrets are set correctly
- Check MongoDB Atlas API keys are still valid
- Regenerate API keys if needed

### Terraform State Lock Error

**Cause:** Another operation is running on the same state

**Solution:**
- Wait for other operation to complete
- Or force-unlock state (use with caution):
  ```bash
  terraform force-unlock <lock-id>
  ```

### Partial Destruction

**Scenario:** Some providers destroyed, others failed

**What to Do:**
1. Check workflow logs for failure reason
2. Fix the issue (credentials, permissions, etc.)
3. Re-run destroy workflow for failed providers only
4. Or manually run terraform destroy for failed provider

## Recovery Scenarios

### "I accidentally destroyed MongoDB"

**Bad News:** Data cannot be recovered from M0 free tier (no backups)

**Options:**
1. If you have a manual backup: Import from backup
2. If no backup: Start fresh with empty database
3. Lesson learned: Always backup before destroying

### "I destroyed R2 but need the files back"

**Bad News:** Files cannot be recovered (no R2 backups configured)

**Options:**
1. If you have local copies: Re-upload to new bucket
2. If no copies: Files are permanently lost
3. Lesson learned: Download files before destroying

### "I destroyed Azure but backend won't reconnect"

**Solution:** Redeploy Azure Container Apps via deployment workflow
- Azure is stateless - safe to destroy/recreate
- New backend will reconnect to existing MongoDB and R2
- Check connection strings in GitHub secrets

## Best Practices

✅ **DO:**
- Backup data before destroying MongoDB or R2
- Test destroy workflow on dev first
- Verify confirmation string before submitting
- Document reason for destruction
- Notify team before destroying shared environments

❌ **DON'T:**
- Destroy production via workflow (use manual process)
- Destroy without checking what data exists
- Assume data can be recovered (no backups on free tier)
- Destroy without team knowledge
- Rush through confirmations

## Support

For issues or questions:
- **Workflow Problems**: Check GitHub Actions logs
- **Terraform Errors**: Review Terraform output in workflow
- **Data Recovery**: Contact team lead (may not be possible)
- **Production Destruction**: Contact DevOps team

## Related Documentation

- [Multi-Cloud Deployment Guide](./MULTI_CLOUD_DEPLOYMENT_GUIDE.md)
- [MongoDB Terraform Module](./mongodb/README.md)
- [GitHub Secrets Setup](./mongodb/GITHUB_SECRETS_SETUP.md)

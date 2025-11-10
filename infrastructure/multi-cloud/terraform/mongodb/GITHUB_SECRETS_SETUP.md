# GitHub Secrets Setup Guide for MongoDB Atlas Deployment

This guide walks you through setting up the required GitHub secrets for automated MongoDB Atlas deployment via GitHub Actions.

## Prerequisites

- Access to your GitHub repository settings
- MongoDB Atlas account credentials (provided)
- Repository admin permissions

## Required Secrets Overview

You need to configure **2 types** of secrets:

1. **Repository Secrets** (3 secrets) - Used across all environments
2. **Environment Secrets** (1 secret per environment × 3 environments = 3 secrets) - Unique per environment

---

## Part 1: Repository Secrets

These secrets are shared across all environments (dev, staging, production).

### Step 1: Navigate to Repository Secrets

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click on the **Secrets** tab
4. You should see **Repository secrets** section

### Step 2: Add MongoDB Atlas API Credentials

Click **New repository secret** for each of the following:

#### Secret 1: `MONGODB_ATLAS_PUBLIC_KEY`

```
Name: MONGODB_ATLAS_PUBLIC_KEY
Value: kobtbgvv
```

**Description**: MongoDB Atlas public API key for authentication

---

#### Secret 2: `MONGODB_ATLAS_PRIVATE_KEY`

```
Name: MONGODB_ATLAS_PRIVATE_KEY
Value: 5c4e95f4-94e8-4a27-90d9-4040cdc255e1
```

**Description**: MongoDB Atlas private API key for authentication

⚠️ **IMPORTANT**: This is a sensitive credential. Never commit it to code.

---

#### Secret 3: `MONGODB_ATLAS_ORG_ID`

```
Name: MONGODB_ATLAS_ORG_ID
Value: <your-mongodb-atlas-organization-id>
```

**Description**: MongoDB Atlas organization ID

**How to find your Organization ID:**

1. Log in to [MongoDB Atlas](https://cloud.mongodb.com)
2. Click on your organization name in the top-left
3. Click **Settings**
4. Copy the **Organization ID**

Alternatively, use the MongoDB Atlas API:
```bash
curl -X GET \
  -u "kobtbgvv:5c4e95f4-94e8-4a27-90d9-4040cdc255e1" \
  "https://cloud.mongodb.com/api/atlas/v1.0/orgs"
```

The response will contain your organization ID in the `id` field.

---

## Part 2: Environment Secrets

These secrets are **unique per environment** and must be set separately for dev, staging, and production.

### Step 1: Navigate to Environments

1. Go to your GitHub repository
2. Click **Settings** → **Environments**
3. You should see three environments:
   - **Development** (or dev)
   - **Staging**
   - **Production**

If environments don't exist, create them:
- Click **New environment**
- Name: `Development` (or `dev` - match your workflow)
- Click **Configure environment**
- Repeat for `Staging` and `Production`

### Step 2: Add Database Password for Each Environment

For **each environment**, add the following secret:

#### Development Environment

1. Click on **Development** (or **dev**) environment
2. Scroll to **Environment secrets**
3. Click **Add secret**

```
Name: MONGODB_DATABASE_PASSWORD
Value: <generate-random-32-character-password>
```

**How to generate a secure password:**

```bash
# Using OpenSSL (recommended)
openssl rand -base64 32

# Using Python
python3 -c "import secrets; print(secrets.token_urlsafe(32))"

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Example output: `Kj8mN3pQ7rT9sW2xY6zA1bC5dE4fG8hI0jK3lM7nO9pQ`

⚠️ **IMPORTANT**:
- Use a **different password** for each environment
- Save these passwords in a secure location (password manager)
- Never use the same password across environments

---

#### Staging Environment

1. Click on **Staging** environment
2. Scroll to **Environment secrets**
3. Click **Add secret**

```
Name: MONGODB_DATABASE_PASSWORD
Value: <generate-new-random-32-character-password>
```

Generate a **new, different** password for staging.

---

#### Production Environment

1. Click on **Production** environment
2. Scroll to **Environment secrets**
3. Click **Add secret**

```
Name: MONGODB_DATABASE_PASSWORD
Value: <generate-new-random-32-character-password>
```

Generate a **new, different** password for production.

⚠️ **PRODUCTION NOTE**: Use an extra-strong password for production and store it in your team's password manager.

---

## Verification Checklist

Before running the deployment workflow, verify you have:

### Repository Secrets (Settings → Secrets and variables → Actions → Repository secrets)

- [ ] `MONGODB_ATLAS_PUBLIC_KEY` = `kobtbgvv`
- [ ] `MONGODB_ATLAS_PRIVATE_KEY` = `5c4e95f4-94e8-4a27-90d9-4040cdc255e1`
- [ ] `MONGODB_ATLAS_ORG_ID` = `<your-org-id>`

### Development Environment Secrets (Settings → Environments → Development)

- [ ] `MONGODB_DATABASE_PASSWORD` = `<unique-dev-password>`

### Staging Environment Secrets (Settings → Environments → Staging)

- [ ] `MONGODB_DATABASE_PASSWORD` = `<unique-staging-password>`

### Production Environment Secrets (Settings → Environments → Production)

- [ ] `MONGODB_DATABASE_PASSWORD` = `<unique-production-password>`

---

## Testing the Setup

Once all secrets are configured, test the deployment:

1. Go to **Actions** → **Multi-Cloud Deployment**
2. Click **Run workflow**
3. Select **dev** environment
4. Ensure **Deploy MongoDB Atlas infrastructure** is checked
5. Click **Run workflow**

Monitor the workflow execution:
- **terraform-mongodb-plan** should succeed
- **terraform-mongodb-apply** should succeed
- Connection string should be passed to Azure deployment
- Check deployment summary for MongoDB status

---

## Troubleshooting

### Error: "Authentication required"

**Cause**: Repository secrets not set correctly

**Solution**:
1. Verify `MONGODB_ATLAS_PUBLIC_KEY` is exactly: `kobtbgvv`
2. Verify `MONGODB_ATLAS_PRIVATE_KEY` is exactly: `5c4e95f4-94e8-4a27-90d9-4040cdc255e1`
3. Ensure no extra spaces or newlines in secret values

---

### Error: "Organization not found"

**Cause**: Incorrect `MONGODB_ATLAS_ORG_ID`

**Solution**:
1. Log in to MongoDB Atlas
2. Go to Organization Settings
3. Copy the exact Organization ID
4. Update the secret value

---

### Error: "Invalid password"

**Cause**: Environment secret `MONGODB_DATABASE_PASSWORD` not set

**Solution**:
1. Check you're adding the secret to the **correct environment** (dev/staging/prod)
2. Ensure secret name is exactly: `MONGODB_DATABASE_PASSWORD` (case-sensitive)
3. Generate a new strong password and try again

---

### Workflow runs but doesn't deploy MongoDB

**Cause**: `deploy_mongodb` input not checked

**Solution**:
When manually triggering workflow, ensure **"Deploy MongoDB Atlas infrastructure"** checkbox is checked.

---

## Security Best Practices

✅ **DO**:
- Use different passwords for each environment
- Store passwords in a secure password manager
- Rotate passwords periodically (every 90 days)
- Use GitHub's "Update secret" feature to rotate credentials
- Monitor MongoDB Atlas audit logs

❌ **DON'T**:
- Share passwords via email or Slack
- Commit passwords to code or documentation
- Reuse passwords across environments
- Use weak or predictable passwords
- Give production credentials to developers (use dev/staging)

---

## Rotating Secrets

To rotate MongoDB database passwords:

1. **Generate new password**:
   ```bash
   openssl rand -base64 32
   ```

2. **Update GitHub environment secret**:
   - Settings → Environments → [env] → Edit secret
   - Replace old password with new password

3. **Run deployment**:
   - Actions → Multi-Cloud Deployment
   - Select environment
   - Check "Deploy MongoDB Atlas infrastructure"
   - Run workflow

4. **Verify**:
   - Check deployment summary
   - Test Azure Container Apps connectivity
   - Confirm application is functioning

---

## Support

For issues with:
- **GitHub secrets**: Contact your DevOps team
- **MongoDB Atlas API**: Check [MongoDB Atlas API documentation](https://www.mongodb.com/docs/atlas/api/)
- **Deployment workflow**: Review workflow logs in Actions tab

---

## Additional Resources

- [GitHub Actions Secrets Documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [MongoDB Atlas API Keys](https://www.mongodb.com/docs/atlas/configure-api-access/)
- [MongoDB Atlas Organizations](https://www.mongodb.com/docs/atlas/tutorial/manage-organizations/)
- [Multi-Cloud Deployment Guide](../MULTI_CLOUD_DEPLOYMENT_GUIDE.md)

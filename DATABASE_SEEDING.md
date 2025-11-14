# Database Seeding Guide

This guide explains how database seeding works in Dculus Forms, both locally and in production deployments.

## Overview

The seeding system automatically populates the database with:
- **Template forms** - Pre-built form templates for users to start with
- **Static files** - Background images and other assets uploaded to CDN
- **Sample data** - Organizations, forms, and responses (development only)

## Seed Script Location

```
apps/backend/src/scripts/seed.ts
```

## What Gets Seeded

### 1. Static Files Upload
- Reads files from `static-files/` directory
- Uploads to S3/R2 bucket
- Returns keys for use in templates

### 2. Template Forms
- Creates `FormTemplate` records in database
- Links to uploaded static files
- Provides starting point for users

### 3. Database Cleanup (Development)
- Clears all existing data before seeding
- Only runs in development/staging environments

## Local Development

### Manual Seeding

```bash
# From repository root
pnpm db:seed

# Or from backend directory
cd apps/backend
pnpm db:seed
```

### Automatic Seeding on Docker

The Dockerfile includes a startup script that checks the `RUN_SEED` environment variable:

```dockerfile
# In Docker container startup
if [ "$RUN_SEED" = "true" ]; then
  echo "🌱 Running database seed..."
  node dist/apps/backend/src/scripts/seed.js
fi
```

## Production Deployment (Azure)

### Automatic Seeding

Seeding is controlled by the `run_seed` Terraform variable in Azure Container Apps deployment.

**Configuration Files:**
- `infrastructure/multi-cloud/terraform/azure/variables.tf` - Defines `run_seed` variable
- `infrastructure/multi-cloud/terraform/azure/main.tf` - Sets `RUN_SEED` environment variable
- `.github/workflows/multi-cloud-deployment.yml` - Passes `TF_VAR_run_seed: true` during deployment

### Deployment Workflow

```yaml
# In multi-cloud-deployment.yml
env:
  TF_VAR_run_seed: true  # Enable seeding on first deployment
```

### When Seeding Runs

- **First deployment**: Automatically seeds templates and uploads static files
- **Subsequent deployments**: Can be disabled by setting `TF_VAR_run_seed: false`
- **Container restart**: Re-runs seeding if `RUN_SEED=true` environment variable is set

### Manual Seeding in Production

If you need to manually seed production:

```bash
# Option 1: Using Azure CLI to exec into container
az containerapp exec \
  --name dculus-forms-production-backend \
  --resource-group dculus-forms-production-rg \
  --command "node dist/apps/backend/src/scripts/seed.js"

# Option 2: Update environment variable and trigger restart
az containerapp update \
  --name dculus-forms-production-backend \
  --resource-group dculus-forms-production-rg \
  --set-env-vars RUN_SEED=true

# After restart, disable it again
az containerapp update \
  --name dculus-forms-production-backend \
  --resource-group dculus-forms-production-rg \
  --set-env-vars RUN_SEED=false
```

## Environment Variables Required

For seeding to work, these environment variables must be set:

```bash
# Database
DATABASE_URL=mongodb+srv://...

# S3/R2 Storage (for static files)
PUBLIC_S3_ACCESS_KEY=...
PUBLIC_S3_SECRET_KEY=...
PUBLIC_S3_ENDPOINT=https://...
PUBLIC_S3_BUCKET_NAME=...

# Optional: Control seeding
RUN_SEED=true  # Set to "true" to enable seeding on startup
```

## Customizing Seed Data

### Adding New Templates

1. Create form templates in `apps/backend/src/scripts/seed-templates.ts`
2. Link to uploaded static files using their keys
3. Templates will be created on next seed run

### Adding New Static Files

1. Add files to `static-files/` directory in repository root
2. Files are automatically uploaded during seeding
3. Keys are returned and can be used in templates

### Seed Script Structure

```typescript
// apps/backend/src/scripts/seed.ts

async function seed() {
  // 1. Clear existing data (dev only)
  await prisma.user.deleteMany();
  // ... other models

  // 2. Upload static files
  const uploadedFiles = await uploadStaticFiles();

  // 3. Seed templates with uploaded file keys
  await seedTemplates(uploadedFiles);

  // 4. Create sample data (optional)
  // ...
}
```

## Troubleshooting

### Seeding Not Running in Docker

**Check environment variable:**
```bash
docker exec <container> env | grep RUN_SEED
```

**View startup logs:**
```bash
docker logs <container> | grep -i seed
```

### Static Files Not Uploading

**Check `static-files/` directory exists:**
```bash
ls -la static-files/
```

**Verify S3/R2 credentials:**
```bash
# Test connection
docker exec <container> node -e "
const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3');
const client = new S3Client({
  endpoint: process.env.PUBLIC_S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.PUBLIC_S3_ACCESS_KEY,
    secretAccessKey: process.env.PUBLIC_S3_SECRET_KEY,
  },
});
client.send(new ListBucketsCommand({})).then(console.log);
"
```

### Templates Not Appearing

**Check database connection:**
```bash
# Verify DATABASE_URL is set
docker exec <container> env | grep DATABASE_URL

# Check Prisma can connect
docker exec <container> node dist/scripts/seed.js
```

### Seeding Takes Too Long

**Monitor progress:**
```bash
# Follow logs during seeding
docker logs -f <container>
```

**Expected duration:**
- Static file upload: ~10-30 seconds (depends on file count/size)
- Template creation: ~5-10 seconds
- Total: Usually under 1 minute

## Best Practices

### Development
- ✅ Run seeding frequently to test with fresh data
- ✅ Keep `static-files/` directory in version control
- ✅ Clear database before seeding to avoid duplicates

### Staging
- ✅ Enable seeding on first deployment
- ✅ Test seeding matches production behavior
- ⚠️ Disable seeding after initial setup

### Production
- ✅ Enable seeding on first deployment only
- ✅ Set `TF_VAR_run_seed: false` for subsequent deployments
- ⚠️ Never clear existing data in production
- ⚠️ Only re-seed if absolutely necessary

## Security Considerations

1. **Static files** are uploaded to PUBLIC bucket (world-readable)
2. **S3/R2 credentials** must have write permissions
3. **Database credentials** must have full access for seeding
4. **Production seeding** should be monitored carefully

## Related Files

- `apps/backend/Dockerfile` - Docker startup script with seeding logic
- `apps/backend/src/scripts/seed.ts` - Main seed script
- `apps/backend/src/scripts/seed-templates.ts` - Template definitions
- `infrastructure/multi-cloud/terraform/azure/variables.tf` - Terraform variables
- `infrastructure/multi-cloud/terraform/azure/main.tf` - Container app environment config
- `.github/workflows/multi-cloud-deployment.yml` - CI/CD deployment workflow

## Quick Reference

| Task | Command |
|------|---------|
| Seed locally | `pnpm db:seed` |
| Seed in Docker | `docker run -e RUN_SEED=true ...` |
| Enable in Terraform | `TF_VAR_run_seed=true` |
| Disable in Terraform | `TF_VAR_run_seed=false` |
| Manual Azure exec | `az containerapp exec --command "node dist/scripts/seed.js"` |

---

**Version**: 1.0  
**Last Updated**: 2025-11-14

# Database Seeding Issues Analysis

## Issues Found

### Issue 1: `backgroundImageKey` is NULL in Templates

**Root Cause:**
The `static-files/` directory is **NOT being copied into the Docker container** during the build process.

**Why This Happens:**

1. **Dockerfile copies source with `COPY . .`** (line 22)
   - This copies everything from the repository root
   - However, the seed script runs INSIDE the container at runtime
   
2. **Seed script looks for static-files at runtime** (`seed.ts` line 13):
   ```typescript
   const staticFilesPath = path.join(process.cwd(), '..', '..', 'static-files');
   ```
   - From `/app/apps/backend`, it goes up to `/app/static-files`
   - This path should exist because `COPY . .` copies everything
   
3. **BUT: The actual problem is the files upload successfully, but...**
   - Looking at `seed-templates.ts` line 73-79:
   ```typescript
   const backgroundImages = uploadedFiles.filter(file => 
     file.type === 'FormBackground' || 
     file.filename?.includes('background')
   );
   ```
   - Your static files are named:
     - `company-logo.jpg` - **does NOT contain "background"**
     - `dculus-high-resolution-logo.png` - **does NOT contain "background"**
   
4. **File type detection** (`seed.ts` line 61-65):
   ```typescript
   let fileType = 'FormTemplate'; // default
   if (fileName.includes('logo')) {
     fileType = 'OrganizationLogo';  // ← Both files get this type!
   } else if (fileName.includes('background')) {
     fileType = 'FormBackground';
   }
   ```

5. **Result**:
   - Both files are uploaded as `OrganizationLogo` type
   - Filter looks for `FormBackground` or filename with "background"
   - No files match → `availableImages` array is empty
   - `getImageKey()` returns `""` (empty string)
   - Templates are created with `backgroundImageKey: ""`

**Why NULL in Database:**
Prisma likely treats empty string `""` as `null` when storing in MongoDB.

---

### Issue 2: Data Deletion on Seeding

**Root Cause:**
The seed script **explicitly deletes all data** before seeding (lines 89-98 in `seed.ts`):

```typescript
// Clear existing data
logger.info('🧹 Clearing existing data...');
await prisma.response.deleteMany();
await prisma.form.deleteMany();
await prisma.formTemplate.deleteMany();
await prisma.member.deleteMany();
await prisma.invitation.deleteMany();
await prisma.organization.deleteMany();
await prisma.session.deleteMany();
await prisma.account.deleteMany();
await prisma.user.deleteMany();
```

**Why This Happens:**
This is **intentional behavior** for seeding:
- Seeds are meant to create a clean, known state
- Common in development environments
- Ensures templates are created fresh without duplicates
- Standard practice in database seeding patterns

**Is This OK for Dev?**
✅ **YES, this is fine for development:**
- Dev environments should be ephemeral
- Data should be recreatable
- Prevents stale/duplicate data
- Forces you to test the full user journey

⚠️ **BUT: Should NOT happen in production:**
- Production data is permanent
- Users expect data persistence
- Should only seed on **first deployment**

---

## R2 Bucket & CDN Architecture

Based on Terraform configuration analysis:

### 1. **R2 Buckets** (`r2-buckets.tf`)
```
Private Bucket: dculus-forms-private-{env}
Public Bucket:  dculus-forms-public-{env}
```

- **Private Bucket**: Form responses, user uploads, sensitive data
- **Public Bucket**: Static assets, form backgrounds, templates
- Both use Cloudflare R2 (S3-compatible storage)

### 2. **CDN Configuration** (`r2-custom-domains.tf`)

**Custom Domain:**
```
public-cdn-{env}.dculus.com
```
- Points to public R2 bucket
- Proxied through Cloudflare CDN
- Automatic SSL/TLS certificates
- Edge caching enabled (2hr TTL)

**How It Works:**
1. Files uploaded to: `PUBLIC_S3_BUCKET_NAME` (dculus-forms-public-dev)
2. Using endpoint: `{account_id}.r2.cloudflarestorage.com`
3. Files accessible via CDN: `https://public-cdn-dev.dculus.com/{key}`

### 3. **Environment Variables Flow**

**From Terraform → Azure Container App:**
```bash
PUBLIC_S3_ENDPOINT="{account_id}.r2.cloudflarestorage.com"
PUBLIC_S3_BUCKET_NAME="dculus-forms-public-dev"
PUBLIC_S3_CDN_URL="https://public-cdn-dev.dculus.com"
PUBLIC_S3_ACCESS_KEY="{generated_token_id}"
PUBLIC_S3_SECRET_KEY="{generated_token_value}"
```

**In Code (`lib/env.ts`):**
```typescript
s3Config.endpoint       // Upload endpoint (R2)
s3Config.publicCdnUrl   // Public access URL (CDN)
```

**File Upload Process:**
1. `uploadFile()` uploads to R2 using S3 API
2. `constructCdnUrl()` creates CDN URL from key
3. Returns: `https://public-cdn-dev.dculus.com/files/form-background/...`

### 4. **Why CDN Instead of Direct R2?**

- ⚡ **Performance**: Global edge caching
- 🔒 **Security**: Hides R2 bucket details
- 🌍 **Latency**: Serves from nearest Cloudflare edge
- 💰 **Cost**: Reduces R2 egress charges
- 🎯 **Control**: Page rules, cache policies

---

## Solutions

### Solution 1: Fix Background Image Keys

**Option A: Rename Static Files** (Easiest)
```bash
# In static-files/
mv company-logo.jpg form-background-01.jpg
mv dculus-high-resolution-logo.png form-background-02.png
```

**Option B: Update Filter Logic** (More Flexible)
```typescript
// In seed-templates.ts, line 73-79
const backgroundImages = uploadedFiles.filter(file => 
  file.type === 'FormBackground' || 
  file.type === 'OrganizationLogo' ||  // ← Add this
  file.filename?.includes('background') ||
  file.filename?.includes('logo')       // ← Add this
);
```

**Option C: Add Actual Background Images**
```bash
# Add proper background images to static-files/
curl -o static-files/background-01.jpg "https://source.unsplash.com/1920x1080/?abstract,gradient"
curl -o static-files/background-02.jpg "https://source.unsplash.com/1920x1080/?nature,landscape"
```

### Solution 2: Control Data Deletion

**For Development: Keep Current Behavior**
✅ Data deletion is fine - just reseed when needed

**For Production: Add Environment Check**
```typescript
async function seed() {
  logger.info('🌱 Starting database seed...');

  try {
    // Only clear data in non-production environments
    if (process.env.NODE_ENV !== 'production') {
      logger.info('🧹 Clearing existing data...');
      await prisma.response.deleteMany();
      await prisma.form.deleteMany();
      // ... other deletes
      logger.info('✅ Database cleared successfully');
    } else {
      logger.info('⏭️  Skipping data clearing in production');
    }
    
    // Upload static files
    const uploadedFiles = await uploadStaticFiles();
    
    // Seed templates with uploaded files
    await seedTemplates(uploadedFiles);
    
    // ... rest of seed
  }
}
```

**Or: Check if Templates Already Exist**
```typescript
// Only seed if no templates exist
const existingTemplates = await prisma.formTemplate.count();
if (existingTemplates > 0) {
  logger.info('⏭️  Templates already exist, skipping seed');
  return;
}
```

---

## Recommendations

### Immediate Actions:

1. **Fix Background Images** - Use Option A (rename files)
2. **Keep Data Deletion in Dev** - It's working as intended
3. **Add Static Files to Docker** - Already working (COPY . . includes them)

### Before Production:

1. **Add environment check** for data deletion
2. **Add idempotency check** (don't reseed if templates exist)
3. **Set RUN_SEED=false** after first production deployment
4. **Add real background images** to static-files/

### Testing:

```bash
# 1. Rename files locally
cd static-files/
mv company-logo.jpg form-background-01.jpg
mv dculus-high-resolution-logo.png form-background-02.png

# 2. Test locally
cd ../apps/backend
pnpm db:seed

# 3. Check database
pnpm db:studio
# Look at formTemplate.formSchema.layout.backgroundImageKey

# 4. Commit and deploy
git add static-files/
git commit -m "fix: rename static files for form backgrounds"
git push
```

---

## Summary

| Issue | Root Cause | Solution | Priority |
|-------|-----------|----------|----------|
| NULL backgroundImageKey | Files named "logo" not "background" | Rename files | High |
| Data deletion on seed | Intentional for clean state | Expected behavior | Low |
| Static files missing | Files ARE included, just misnamed | Rename or add filter | High |

**Environment is fine** - This is normal dev behavior. Data deletion keeps your dev environment clean and testable.

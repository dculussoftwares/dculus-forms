# Deployment Guide

This guide explains how to use the build artifacts from GitHub Releases to deploy Dculus Forms to any cloud provider.

## Table of Contents

- [Overview](#overview)
- [Creating a Release](#creating-a-release)
- [Downloading Build Artifacts](#downloading-build-artifacts)
- [Backend Deployment](#backend-deployment)
  - [Docker Deployment (Recommended)](#docker-deployment-recommended)
  - [Node.js Direct Deployment](#nodejs-direct-deployment)
- [Frontend Deployment to Cloud Providers](#frontend-deployment-to-cloud-providers)
  - [AWS S3 + CloudFront](#aws-s3--cloudfront)
  - [Azure Static Web Apps](#azure-static-web-apps)
  - [Cloudflare Pages](#cloudflare-pages)
  - [Netlify](#netlify)
  - [Vercel](#vercel)
  - [nginx (Self-hosted)](#nginx-self-hosted)
  - [Google Cloud Storage](#google-cloud-storage)
- [Environment Variables](#environment-variables)
- [Troubleshooting](#troubleshooting)

## Overview

Dculus Forms provides production-ready build artifacts for all applications:

**Backend:**
- **Backend API** - Express.js + GraphQL backend (backend-build)
  - Available as Docker image (recommended)
  - Available as Node.js ZIP artifact (alternative)

**Frontend Applications:**
- **Form App** - Form builder application (form-app)
- **Form Viewer** - Form viewing and submission application (form-viewer)
- **Admin App** - System administration dashboard (admin-app)

Each release includes ZIP archives containing optimized, minified production builds ready for deployment to any hosting provider.

## Creating a Release

Build artifacts are automatically created when you push a version tag to the repository:

```bash
# Create and push a version tag
git tag v1.0.0
git push origin v1.0.0
```

The GitHub Actions workflow will:
1. Build all three frontend applications
2. Create ZIP archives for each app
3. Create a GitHub Release with the archives attached
4. Build and push the backend Docker image to Docker Hub

**Tag Format**: `v{major}.{minor}.{patch}` (e.g., `v1.0.0`, `v2.1.3`)

**Pre-release Tags**: Tags containing `alpha`, `beta`, or `rc` will be marked as pre-releases (e.g., `v1.0.0-beta`, `v2.0.0-rc1`)

## Downloading Build Artifacts

1. Go to the [Releases page](https://github.com/your-org/dculus-forms/releases)
2. Find the desired release version
3. Download the ZIP file(s) for the application(s) you want to deploy:
   - `backend-build-v{version}.zip` - Backend API (Node.js)
   - `form-app-build-v{version}.zip` - Form Builder
   - `form-viewer-build-v{version}.zip` - Form Viewer
   - `admin-app-build-v{version}.zip` - Admin Dashboard

## Backend Deployment

The backend can be deployed using either Docker (recommended) or Node.js directly from the ZIP artifact.

### Docker Deployment (Recommended)

Docker provides the most consistent and reliable deployment experience.

**Prerequisites:**
- Docker Engine 20.10+ or Docker Desktop
- MongoDB 5.0+ (local, Atlas, or managed service)
- S3-compatible storage

**Step 1: Pull the Docker image**
```bash
docker pull dculus/forms-backend:v1.0.0
# Or for latest:
docker pull dculus/forms-backend:latest
```

**Step 2: Create environment file**
```bash
cat > .env << 'EOF'
DATABASE_URL=mongodb+srv://user:pass@cluster.mongodb.net/dculus_forms
BETTER_AUTH_SECRET=$(openssl rand -hex 32)
BETTER_AUTH_URL=https://api.yourdomain.com
CORS_ORIGINS=https://app.yourdomain.com,https://admin.yourdomain.com
PUBLIC_S3_ACCESS_KEY=your-access-key
PUBLIC_S3_SECRET_KEY=your-secret-key
PUBLIC_S3_ENDPOINT=https://s3.amazonaws.com
S3_REGION=us-east-1
PRIVATE_S3_BUCKET_NAME=dculus-private
PUBLIC_S3_BUCKET_NAME=dculus-public
EOF
```

**Step 3: Run the container**
```bash
docker run -d \
  --name dculus-backend \
  -p 4000:4000 \
  --env-file .env \
  --restart unless-stopped \
  dculus/forms-backend:v1.0.0
```

**Step 4: Verify deployment**
```bash
# Check container status
docker ps | grep dculus-backend

# Check logs
docker logs dculus-backend

# Test health endpoint
curl http://localhost:4000/health
# Should return: {"status":"ok"}
```

**Using Docker Compose:**
```yaml
version: '3.8'
services:
  backend:
    image: dculus/forms-backend:v1.0.0
    ports:
      - "4000:4000"
    env_file: .env
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

Deploy with: `docker-compose up -d`

### Node.js Direct Deployment

Deploy from the ZIP artifact when you prefer running Node.js directly or have resource constraints.

**Prerequisites:**
- Node.js 18.x or higher
- MongoDB 5.0+
- S3-compatible storage

**Step 1: Download and extract**
```bash
# Download backend ZIP from GitHub Releases
wget https://github.com/your-org/dculus-forms/releases/download/v1.0.0/backend-build-v1.0.0.zip

# Extract
unzip backend-build-v1.0.0.zip
cd backend-build-v1.0.0
```

**Step 2: Configure environment**
```bash
# Copy example environment file
cp .env.example .env

# Edit with your values
nano .env  # or vim, code, etc.
```

**Required environment variables:**
```bash
DATABASE_URL=mongodb+srv://user:pass@cluster.mongodb.net/dculus_forms
BETTER_AUTH_SECRET=$(openssl rand -hex 32)
BETTER_AUTH_URL=https://api.yourdomain.com
CORS_ORIGINS=https://app.yourdomain.com,https://admin.yourdomain.com
PUBLIC_S3_ACCESS_KEY=your-s3-access-key
PUBLIC_S3_SECRET_KEY=your-s3-secret-key
PUBLIC_S3_ENDPOINT=https://s3.amazonaws.com
S3_REGION=us-east-1
PRIVATE_S3_BUCKET_NAME=dculus-forms-private
PUBLIC_S3_BUCKET_NAME=dculus-forms-public
```

**Step 3: Run the application**

**Option A: Direct execution (testing)**
```bash
node dist/apps/backend/src/index.js
```

**Option B: PM2 (production recommended)**
```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start dist/apps/backend/src/index.js \
  --name dculus-backend \
  --env production

# Save configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the instructions printed
```

**Option C: systemd service**

Create `/etc/systemd/system/dculus-backend.service`:
```ini
[Unit]
Description=Dculus Forms Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/dculus-backend
EnvironmentFile=/var/www/dculus-backend/.env
ExecStart=/usr/bin/node dist/apps/backend/src/index.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable dculus-backend
sudo systemctl start dculus-backend
sudo systemctl status dculus-backend
```

**Step 4: Verify deployment**
```bash
# Test health endpoint
curl http://localhost:4000/health

# Check logs (PM2)
pm2 logs dculus-backend

# Check logs (systemd)
sudo journalctl -u dculus-backend -f
```

**For detailed backend deployment instructions including nginx reverse proxy, SSL setup, monitoring, and troubleshooting, see the included `README-DEPLOYMENT.md` file in the backend ZIP archive.**

## Frontend Deployment to Cloud Providers

### AWS S3 + CloudFront

**Step 1: Extract the build**
```bash
unzip form-app-build-v1.0.0.zip
cd dist
```

**Step 2: Create S3 bucket and configure for static hosting**
```bash
# Create bucket
aws s3 mb s3://dculus-form-app

# Enable static website hosting
aws s3 website s3://dculus-form-app \
  --index-document index.html \
  --error-document index.html
```

**Step 3: Upload build files**
```bash
aws s3 sync . s3://dculus-form-app \
  --acl public-read \
  --cache-control "public,max-age=31536000,immutable" \
  --exclude "index.html"

# Upload index.html without cache (for SPA routing)
aws s3 cp index.html s3://dculus-form-app/index.html \
  --acl public-read \
  --cache-control "public,max-age=0,must-revalidate"
```

**Step 4: Create CloudFront distribution (optional but recommended)**
```bash
aws cloudfront create-distribution \
  --origin-domain-name dculus-form-app.s3.amazonaws.com \
  --default-root-object index.html
```

**Step 5: Configure environment variables**

Since static files can't use traditional env vars, you'll need to:
- Use CloudFront Functions or Lambda@Edge to inject environment variables
- OR use a runtime configuration file (see [Environment Variables](#environment-variables))

### Azure Static Web Apps

**Step 1: Extract the build**
```bash
unzip form-app-build-v1.0.0.zip
```

**Step 2: Create Azure Static Web App**
```bash
# Create resource group
az group create \
  --name dculus-forms-rg \
  --location eastus

# Create static web app
az staticwebapp create \
  --name dculus-form-app \
  --resource-group dculus-forms-rg \
  --location eastus
```

**Step 3: Deploy using Azure CLI**
```bash
# Install the Azure Static Web Apps CLI
npm install -g @azure/static-web-apps-cli

# Deploy
swa deploy ./dist \
  --deployment-token <your-deployment-token> \
  --app-location ./dist
```

**Step 4: Configure environment variables**

Go to Azure Portal → Your Static Web App → Configuration → Application settings:
- Add `VITE_API_URL`
- Add `VITE_GRAPHQL_URL`
- Add other required environment variables

### Cloudflare Pages

**Step 1: Extract the build**
```bash
unzip form-app-build-v1.0.0.zip
```

**Step 2: Install Wrangler CLI**
```bash
npm install -g wrangler
```

**Step 3: Login to Cloudflare**
```bash
wrangler login
```

**Step 4: Deploy to Cloudflare Pages**
```bash
wrangler pages deploy dist/ \
  --project-name=dculus-form-app \
  --branch=main
```

**Step 5: Configure environment variables**

```bash
# Set environment variables
wrangler pages secrets put VITE_API_URL
wrangler pages secrets put VITE_GRAPHQL_URL
```

Or configure via Cloudflare Dashboard → Pages → Your Project → Settings → Environment Variables

### Netlify

**Step 1: Extract the build**
```bash
unzip form-app-build-v1.0.0.zip
```

**Step 2: Install Netlify CLI**
```bash
npm install -g netlify-cli
```

**Step 3: Login to Netlify**
```bash
netlify login
```

**Step 4: Deploy**
```bash
netlify deploy --prod --dir=dist
```

**Step 5: Configure environment variables**

```bash
# Set environment variables
netlify env:set VITE_API_URL "https://your-backend-url.com"
netlify env:set VITE_GRAPHQL_URL "https://your-backend-url.com/graphql"
```

Or configure via Netlify Dashboard → Site Settings → Environment Variables

**Step 6: Configure SPA routing**

Create `dist/_redirects` file (if not already present):
```
/*    /index.html   200
```

### Vercel

**Step 1: Extract the build**
```bash
unzip form-app-build-v1.0.0.zip
```

**Step 2: Install Vercel CLI**
```bash
npm install -g vercel
```

**Step 3: Deploy**
```bash
vercel --prod dist/
```

**Step 4: Configure environment variables**

```bash
# Set environment variables
vercel env add VITE_API_URL production
vercel env add VITE_GRAPHQL_URL production
```

Or configure via Vercel Dashboard → Project → Settings → Environment Variables

### nginx (Self-hosted)

**Step 1: Extract the build**
```bash
unzip form-app-build-v1.0.0.zip
```

**Step 2: Copy files to nginx web root**
```bash
sudo cp -r dist/* /var/www/dculus-form-app/
sudo chown -R www-data:www-data /var/www/dculus-form-app
```

**Step 3: Configure nginx**

Create `/etc/nginx/sites-available/dculus-form-app`:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /var/www/dculus-form-app;
    index index.html;

    # Enable gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript
               application/javascript application/json application/xml+rss;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA routing - serve index.html for all routes
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, must-revalidate";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

**Step 4: Enable the site and restart nginx**
```bash
sudo ln -s /etc/nginx/sites-available/dculus-form-app /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

**Step 5: Configure environment variables**

Since nginx serves static files, you have two options:

**Option A: Build-time variables** (rebuild with your env vars)
```bash
# Download source, configure env, and rebuild
VITE_API_URL=https://api.your-domain.com pnpm build
```

**Option B: Runtime configuration**
Create a runtime config file that loads before your app. See [Environment Variables](#environment-variables) section.

### Google Cloud Storage

**Step 1: Extract the build**
```bash
unzip form-app-build-v1.0.0.zip
cd dist
```

**Step 2: Create GCS bucket**
```bash
# Create bucket
gsutil mb gs://dculus-form-app

# Make bucket publicly readable
gsutil iam ch allUsers:objectViewer gs://dculus-form-app
```

**Step 3: Configure for static website hosting**
```bash
gsutil web set -m index.html -e index.html gs://dculus-form-app
```

**Step 4: Upload build files**
```bash
# Upload all files
gsutil -m rsync -r . gs://dculus-form-app

# Set cache control
gsutil -m setmeta -h "Cache-Control:public,max-age=31536000,immutable" \
  gs://dculus-form-app/**.js
gsutil -m setmeta -h "Cache-Control:public,max-age=31536000,immutable" \
  gs://dculus-form-app/**.css
```

**Step 5: Configure Cloud CDN (optional)**
```bash
gcloud compute backend-buckets create dculus-form-app-backend \
  --gcs-bucket-name=dculus-form-app \
  --enable-cdn
```

## Environment Variables

Each frontend application requires different environment variables:

### Form App (`form-app`)

**Required:**
- `VITE_API_URL` - Backend API base URL (e.g., `https://api.your-domain.com`)
- `VITE_GRAPHQL_URL` - GraphQL endpoint URL (e.g., `https://api.your-domain.com/graphql`)

**Optional:**
- `VITE_CDN_ENDPOINT` - CDN endpoint for assets
- `VITE_PIXABAY_API_KEY` - Pixabay API key for image search

### Form Viewer (`form-viewer`)

The form viewer is designed to work with runtime configuration and typically doesn't require build-time environment variables. It detects the backend URL from the form link.

### Admin App (`admin-app`)

**Required:**
- `VITE_API_URL` - Backend API base URL (e.g., `https://api.your-domain.com`)
- `VITE_GRAPHQL_URL` - GraphQL endpoint URL (e.g., `https://api.your-domain.com/graphql`)

### Setting Environment Variables

**For platforms with native env var support** (Cloudflare Pages, Netlify, Vercel, Azure Static Web Apps):
- Configure via platform dashboard or CLI
- Platform will inject vars at build time or runtime

**For static hosting** (S3, GCS, nginx):

**Option 1: Rebuild with your variables**
```bash
# Clone repository
git clone https://github.com/your-org/dculus-forms.git
cd dculus-forms

# Install dependencies
pnpm install

# Build with your env vars
VITE_API_URL=https://api.your-domain.com \
VITE_GRAPHQL_URL=https://api.your-domain.com/graphql \
pnpm --filter form-app build

# Deploy the dist folder
```

**Option 2: Runtime configuration file**

Create `config.js` in your build's `dist/` folder:
```javascript
window.__RUNTIME_CONFIG__ = {
  VITE_API_URL: 'https://api.your-domain.com',
  VITE_GRAPHQL_URL: 'https://api.your-domain.com/graphql'
};
```

Then load it in `index.html` before your app bundle:
```html
<script src="/config.js"></script>
```

Update your app code to read from `window.__RUNTIME_CONFIG__` as a fallback.

## Backend Deployment

The backend is distributed as a Docker image on Docker Hub: `dculus/forms-backend:{version}`

**Pull the image:**
```bash
docker pull dculus/forms-backend:v1.0.0
```

**Run with Docker:**
```bash
docker run -d \
  -p 4000:4000 \
  --name dculus-backend \
  -e DATABASE_URL='your-mongodb-connection-string' \
  -e BETTER_AUTH_SECRET='your-auth-secret' \
  -e PUBLIC_S3_ACCESS_KEY='your-s3-access-key' \
  -e PUBLIC_S3_SECRET_KEY='your-s3-secret-key' \
  -e PUBLIC_S3_ENDPOINT='your-s3-endpoint' \
  -e PRIVATE_S3_BUCKET_NAME='your-private-bucket' \
  -e PUBLIC_S3_BUCKET_NAME='your-public-bucket' \
  -e CORS_ORIGINS='https://your-frontend-domain.com' \
  dculus/forms-backend:v1.0.0
```

**Deploy with Docker Compose:**
```yaml
version: '3.8'
services:
  backend:
    image: dculus/forms-backend:v1.0.0
    ports:
      - "4000:4000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}
      - PUBLIC_S3_ACCESS_KEY=${PUBLIC_S3_ACCESS_KEY}
      - PUBLIC_S3_SECRET_KEY=${PUBLIC_S3_SECRET_KEY}
      - PUBLIC_S3_ENDPOINT=${PUBLIC_S3_ENDPOINT}
      - PRIVATE_S3_BUCKET_NAME=${PRIVATE_S3_BUCKET_NAME}
      - PUBLIC_S3_BUCKET_NAME=${PUBLIC_S3_BUCKET_NAME}
      - CORS_ORIGINS=${CORS_ORIGINS}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

**Required environment variables:**
- `DATABASE_URL` - MongoDB connection string
- `BETTER_AUTH_SECRET` - Secret for authentication (generate with `openssl rand -hex 32`)
- `PUBLIC_S3_ACCESS_KEY` - S3-compatible storage access key
- `PUBLIC_S3_SECRET_KEY` - S3-compatible storage secret key
- `PUBLIC_S3_ENDPOINT` - S3-compatible storage endpoint
- `PRIVATE_S3_BUCKET_NAME` - Private S3 bucket name
- `PUBLIC_S3_BUCKET_NAME` - Public S3 bucket name
- `CORS_ORIGINS` - Comma-separated list of allowed origins

## Troubleshooting

### Issue: Blank page after deployment

**Cause:** Incorrect base path or routing configuration

**Solution:**
- Ensure your hosting provider is configured for SPA routing
- Add redirect rules to serve `index.html` for all routes
- Check browser console for errors

### Issue: Environment variables not working

**Cause:** Build was created without your environment variables

**Solution:**
- Rebuild from source with your variables, OR
- Use runtime configuration (see [Environment Variables](#environment-variables))

### Issue: API requests failing

**Cause:** CORS or incorrect backend URL

**Solution:**
- Verify `VITE_API_URL` and `VITE_GRAPHQL_URL` are correct
- Ensure backend `CORS_ORIGINS` includes your frontend domain
- Check backend health endpoint: `https://your-backend-url/health`

### Issue: 404 errors on page refresh

**Cause:** Hosting provider not configured for SPA routing

**Solution:**
- Add redirect rules (see platform-specific sections above)
- Ensure all routes redirect to `index.html`

### Issue: Assets not loading

**Cause:** Incorrect base path or missing files

**Solution:**
- Verify all files from `dist/` were uploaded
- Check network tab in browser dev tools
- Ensure asset paths in HTML are correct

## Support

For issues, questions, or contributions:
- GitHub Issues: https://github.com/your-org/dculus-forms/issues
- Documentation: See repository README.md
- Contact: support@dculus.com

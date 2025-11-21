# Environment Variables Guide

## Overview

This guide documents all environment variables used across Dculus Forms applications.

## Backend Environment Variables

Location: `apps/backend/.env`

### Required Variables

```bash
# Database Connection
DATABASE_URL="postgresql://user:password@host:port/database?schema=public"
# Example: postgresql://admin:password123@localhost:5432/dculus_forms?schema=public

# Authentication
BETTER_AUTH_SECRET="your-secret-key-minimum-32-characters"
BETTER_AUTH_URL="http://localhost:4000"  # Your backend URL

# Environment
NODE_ENV="development"  # development | production | test
PORT=4000
```

### Optional Variables

```bash
# CORS Configuration
CORS_ORIGIN="http://localhost:3000,http://localhost:5173,http://localhost:5174"

# Chargebee (Subscription Management)
CHARGEBEE_SITE="your-site-name"
CHARGEBEE_API_KEY="your-api-key"

# Email (SMTP)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
SMTP_FROM="noreply@yourdomain.com"

# File Storage (Azure Blob)
AZURE_STORAGE_CONNECTION_STRING="your-connection-string"
AZURE_STORAGE_CONTAINER="uploads"

# Logging
LOG_LEVEL="info"  # error | warn | info | debug

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100
```

## Frontend Environment Variables

### Form App (Builder)

Location: `apps/form-app/.env`

```bash
# API Configuration
VITE_API_URL="http://localhost:4000"
VITE_GRAPHQL_URL="http://localhost:4000/graphql"

# Other Apps
VITE_FORM_VIEWER_URL="http://localhost:5173"
VITE_ADMIN_APP_URL="http://localhost:5174"

# Optional: Analytics
VITE_GA_TRACKING_ID="G-XXXXXXXXXX"
```

### Form Viewer

Location: `apps/form-viewer/.env`

```bash
# API Configuration
VITE_API_URL="http://localhost:4000"
VITE_GRAPHQL_URL="http://localhost:4000/graphql"
```

### Admin App

Location: `apps/admin-app/.env`

```bash
# API Configuration
VITE_API_URL="http://localhost:4000"
VITE_GRAPHQL_URL="http://localhost:4000/graphql"
```

## Production Environment Variables

### Backend (Production)

```bash
# Database (with SSL)
DATABASE_URL="postgresql://user:password@host:5432/database?schema=public&sslmode=require"

# Authentication
BETTER_AUTH_SECRET="strong-random-secret-key-at-least-32-chars"
BETTER_AUTH_URL="https://api.yourdomain.com"

# Environment
NODE_ENV="production"
PORT=4000

# CORS
CORS_ORIGIN="https://app.yourdomain.com,https://viewer.yourdomain.com,https://admin.yourdomain.com"

# Chargebee
CHARGEBEE_SITE="your-production-site"
CHARGEBEE_API_KEY="live_api_key"

# Email
SMTP_HOST="smtp.sendgrid.net"
SMTP_PORT=587
SMTP_USER="apikey"
SMTP_PASS="your-sendgrid-api-key"

# Azure Storage
AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=..."
AZURE_STORAGE_CONTAINER="production-uploads"

# Logging
LOG_LEVEL="warn"
```

### Frontend Apps (Production)

Build-time environment variables:

```bash
# Form App
VITE_API_URL="https://api.yourdomain.com"
VITE_GRAPHQL_URL="https://api.yourdomain.com/graphql"
VITE_FORM_VIEWER_URL="https://viewer.yourdomain.com"
VITE_GA_TRACKING_ID="G-PRODUCTION-ID"

# Form Viewer
VITE_API_URL="https://api.yourdomain.com"
VITE_GRAPHQL_URL="https://api.yourdomain.com/graphql"

# Admin App
VITE_API_URL="https://api.yourdomain.com"
VITE_GRAPHQL_URL="https://api.yourdomain.com/graphql"
```

## Environment-Specific Configuration

### Development

```bash
# Backend
DATABASE_URL="postgresql://admin:password123@localhost:5432/dculus_forms?schema=public"
BETTER_AUTH_URL="http://localhost:4000"
NODE_ENV="development"

# Frontend
VITE_API_URL="http://localhost:4000"
VITE_GRAPHQL_URL="http://localhost:4000/graphql"
```

### Staging

```bash
# Backend
DATABASE_URL="postgresql://user:pass@staging-db:5432/dculus_forms?schema=public&sslmode=require"
BETTER_AUTH_URL="https://staging-api.yourdomain.com"
NODE_ENV="production"

# Frontend
VITE_API_URL="https://staging-api.yourdomain.com"
VITE_GRAPHQL_URL="https://staging-api.yourdomain.com/graphql"
```

### Production

See "Production Environment Variables" section above.

## Security Best Practices

### 1. Never Commit .env Files

```bash
# .gitignore should include:
.env
.env.local
.env.*.local
```

### 2. Use Strong Secrets

```bash
# Generate strong secrets:
openssl rand -base64 32

# For BETTER_AUTH_SECRET
BETTER_AUTH_SECRET="$(openssl rand -base64 32)"
```

### 3. Rotate Secrets Regularly

- Change secrets every 90 days
- Rotate immediately if compromised
- Use different secrets for each environment

### 4. Use Environment-Specific Values

- Never use production secrets in development
- Use separate databases for each environment
- Use test API keys in development

## Setting Environment Variables

### Local Development

Create `.env` files in respective directories:

```bash
# Backend
touch apps/backend/.env

# Frontend apps
touch apps/form-app/.env
touch apps/form-viewer/.env
touch apps/admin-app/.env
```

### Docker

```bash
docker run -d \
  -e DATABASE_URL='postgresql://...' \
  -e BETTER_AUTH_SECRET='...' \
  your-image
```

Or use `.env` file:

```bash
docker run -d --env-file .env your-image
```

### Azure Container Apps

```bash
az containerapp create \
  --name dculus-backend \
  --env-vars \
    DATABASE_URL='postgresql://...' \
    BETTER_AUTH_SECRET='...'
```

### Cloudflare Pages

1. Go to Settings → Environment Variables
2. Add variables for Production and Preview
3. Redeploy to apply changes

## Troubleshooting

### Environment Variables Not Loading

```bash
# Check if .env file exists
ls -la apps/backend/.env

# Verify file contents
cat apps/backend/.env

# Restart server after changes
pnpm backend:dev
```

### CORS Errors

```bash
# Ensure CORS_ORIGIN includes your frontend URL
CORS_ORIGIN="http://localhost:3000,http://localhost:5173"
```

### Database Connection Errors

```bash
# Verify DATABASE_URL format
# postgresql://user:password@host:port/database?schema=public

# Test connection
psql "postgresql://admin:password123@localhost:5432/dculus_forms"
```

### Build-Time vs Runtime Variables

**Vite (Frontend)**:
- Variables prefixed with `VITE_` are embedded at build time
- Cannot be changed after build
- Must rebuild to update

**Backend**:
- Variables loaded at runtime
- Can be changed without rebuild
- Restart server to apply changes

## Quick Reference

```bash
# Backend Required
DATABASE_URL
BETTER_AUTH_SECRET
BETTER_AUTH_URL
NODE_ENV

# Frontend Required
VITE_API_URL
VITE_GRAPHQL_URL

# Optional but Recommended
CORS_ORIGIN
SMTP_HOST
CHARGEBEE_SITE
```

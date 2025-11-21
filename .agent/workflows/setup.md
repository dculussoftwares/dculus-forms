---
description: Development environment setup
---

# Development Environment Setup

This workflow guides you through setting up the Dculus Forms development environment from scratch.

## Prerequisites

Before starting, ensure you have:
- **Node.js** >= 18.0.0 ([Download](https://nodejs.org/))
- **pnpm** >= 8.0.0 (Install: `npm install -g pnpm`)
- **Git** ([Download](https://git-scm.com/))
- **Docker** (for PostgreSQL) ([Download](https://www.docker.com/))

## Step 1: Clone Repository

```bash
git clone <repository-url>
cd dculus-forms
```

## Step 2: Install Dependencies

```bash
# Install all workspace dependencies
pnpm install
```

This will install dependencies for all apps and packages in the monorepo.

## Step 3: Set Up Environment Variables

### Backend Environment

Create `apps/backend/.env`:

```bash
# Database
DATABASE_URL="postgresql://admin:password123@localhost:5432/dculus_forms?schema=public"

# Authentication
BETTER_AUTH_SECRET="your-secret-key-here"
BETTER_AUTH_URL="http://localhost:4000"

# Environment
NODE_ENV="development"
PORT=4000

# CORS Origins
CORS_ORIGIN="http://localhost:3000,http://localhost:5173,http://localhost:5174"

# Optional: Chargebee (if using subscriptions)
CHARGEBEE_SITE="your-site"
CHARGEBEE_API_KEY="your-api-key"

# Optional: Email (if using email features)
SMTP_HOST="localhost"
SMTP_PORT=1025
SMTP_USER=""
SMTP_PASS=""
```

### Frontend Apps Environment

Create `apps/form-app/.env`:

```bash
VITE_API_URL="http://localhost:4000"
VITE_GRAPHQL_URL="http://localhost:4000/graphql"
VITE_FORM_VIEWER_URL="http://localhost:5173"
```

Create `apps/form-viewer/.env`:

```bash
VITE_API_URL="http://localhost:4000"
VITE_GRAPHQL_URL="http://localhost:4000/graphql"
```

Create `apps/admin-app/.env`:

```bash
VITE_API_URL="http://localhost:4000"
VITE_GRAPHQL_URL="http://localhost:4000/graphql"
```

## Step 4: Build Shared Packages

```bash
# Build all shared packages (@dculus/ui, @dculus/utils, @dculus/types)
pnpm build
```

This is required before running any apps, as they depend on these packages.

## Step 5: Set Up Database

### Start PostgreSQL

```bash
# Start PostgreSQL using Docker
pnpm docker:up

# Verify PostgreSQL is running
docker ps
```

### Initialize Database

```bash
# Generate Prisma client
pnpm db:generate

# Push schema to database (development)
pnpm db:push

# (Optional) Seed with sample data
pnpm db:seed
```

### Verify Database

```bash
# Open Prisma Studio to view database
pnpm db:studio
```

This opens a web interface at `http://localhost:5555` where you can view and edit data.

## Step 6: Start Development Servers

### Option A: Start All Services (Recommended)

```bash
pnpm dev
```

This starts:
- Backend: `http://localhost:4000`
- Form App: `http://localhost:3000`
- Form Viewer: `http://localhost:5173`
- Admin App: `http://localhost:5174`

### Option B: Start Services Individually

```bash
# Terminal 1: Backend
pnpm backend:dev

# Terminal 2: Form App
pnpm form-app:dev

# Terminal 3: Form Viewer
pnpm form-viewer:dev

# Terminal 4: Admin App
pnpm admin-app:dev
```

## Step 7: Verify Setup

### Check Backend

1. Open `http://localhost:4000/health`
   - Should return: `{"status": "ok"}`

2. Open `http://localhost:4000/graphql`
   - GraphQL Playground should load

### Check Frontend Apps

1. Form App: `http://localhost:3000`
   - Should show login/signup page

2. Form Viewer: `http://localhost:5173`
   - Should show form viewer interface

3. Admin App: `http://localhost:5174`
   - Should show admin dashboard

## Step 8: Create Test Account

### Option A: Using Seeded Data

If you ran `pnpm db:seed`, you can use:
- Email: `admin@example.com`
- Password: `password123`

### Option B: Create New Account

1. Go to `http://localhost:3000`
2. Click "Sign Up"
3. Fill in registration form
4. Verify account creation in Prisma Studio

## Troubleshooting

### Port Already in Use

If you get "port already in use" errors:

```bash
# Find process using port 4000 (backend)
lsof -i :4000

# Kill the process
kill -9 <PID>
```

### Database Connection Error

1. Verify PostgreSQL is running:
   ```bash
   docker ps
   ```

2. Check DATABASE_URL in `apps/backend/.env`

3. Restart PostgreSQL:
   ```bash
   pnpm docker:down
   pnpm docker:up
   ```

### Shared Package Not Found

If you get import errors for `@dculus/ui`, `@dculus/utils`, etc.:

```bash
# Rebuild shared packages
pnpm build

# Clear cache and reinstall
pnpm clean
pnpm install
pnpm build
```

### GraphQL Schema Errors

If GraphQL schema is not updating:

```bash
# Restart backend server
# Press Ctrl+C in backend terminal
pnpm backend:dev
```

### Frontend Build Errors

If Vite build fails:

```bash
# Clear Vite cache
rm -rf apps/form-app/node_modules/.vite
rm -rf apps/form-viewer/node_modules/.vite
rm -rf apps/admin-app/node_modules/.vite

# Restart dev server
pnpm dev
```

## Next Steps

- Read [context.md](../context.md) for project architecture overview
- Read [conventions.md](../conventions.md) for coding standards
- Check [testing.md](./testing.md) for running tests
- See [new-feature.md](./new-feature.md) for adding features

## Quick Reference

```bash
# Development
pnpm dev                    # Start all services
pnpm backend:dev           # Backend only
pnpm form-app:dev          # Form builder only

# Database
pnpm docker:up             # Start PostgreSQL
pnpm db:studio             # Open Prisma Studio
pnpm db:seed               # Seed sample data

# Build
pnpm build                 # Build all packages

# Clean
pnpm clean                 # Clean build artifacts
```

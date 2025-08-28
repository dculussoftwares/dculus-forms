# E2E Test Troubleshooting Guide

## Most Common Issues and Solutions

### 1. **Services Not Running**
**Problem**: `pnpm test:e2e:dev` expects backend and frontend to already be running.

**Solution**: Start services first in separate terminals:
```bash
# Terminal 1 - Backend
pnpm backend:dev

# Terminal 2 - Frontend  
pnpm form-app:dev

# Terminal 3 - Tests (once both services are running)
pnpm test:e2e:dev
```

**Check if services are running**:
```bash
# Check backend (should return JSON)
curl http://localhost:4000/health

# Check frontend (should return HTML)  
curl http://localhost:3000
```

### 2. **Port Conflicts**
**Problem**: Ports 3000 or 4000 are already in use.

**Solution**:
```bash
# Check what's running on these ports
lsof -i :3000
lsof -i :4000

# Kill processes if needed
kill -9 <PID>
```

### 3. **Playwright Browsers Not Installed**
**Problem**: Browser binaries missing.

**Solution**:
```bash
npx playwright install
# or
npx playwright install chromium
```

### 4. **Node Modules Issues**
**Problem**: Dependencies not properly installed.

**Solution**:
```bash
# Reinstall dependencies
pnpm install

# Clear cache if needed
pnpm store prune
```

### 5. **TypeScript Compilation Errors**
**Problem**: TS compilation fails.

**Solution**:
```bash
# Check TypeScript errors
pnpm type-check

# Build shared packages
pnpm build
```

### 6. **Environment Variables**
**Problem**: Missing environment configuration.

**Solution**:
```bash
# Set test environment variables
export E2E_BASE_URL=http://localhost:3000
export E2E_BACKEND_URL=http://localhost:4000
export PLAYWRIGHT_HEADLESS=true
```

### 7. **Database Connection Issues**
**Problem**: Backend can't connect to database.

**Solution**:
```bash
# If using Docker MongoDB
pnpm docker:up

# Check backend logs for database errors
# Look at the backend terminal output
```

## Quick Diagnosis Commands

Run these to quickly identify issues:

```bash
# 1. Check if services respond
echo "Testing backend..." && curl -f http://localhost:4000/health
echo "Testing frontend..." && curl -f http://localhost:3000

# 2. Check if dependencies are installed  
ls node_modules/@playwright
ls node_modules/@cucumber

# 3. Check if TypeScript compiles
pnpm type-check

# 4. Test health checks manually
node -e "
const { HealthCheckUtils } = require('./test/e2e/utils/health-check-utils');
const health = new HealthCheckUtils();
health.waitForAllServices().then(ready => console.log('Services ready:', ready));
"
```

## Alternative Commands

If `pnpm test:e2e:dev` still doesn't work, try:

```bash
# Manual command (more verbose)
TS_NODE_PROJECT=test/e2e/tsconfig.json cucumber-js 'test/e2e/features/*.feature' --require-module ts-node/register --require test/e2e/support/world.ts --require test/e2e/support/hooks.ts --require 'test/e2e/step-definitions/*.steps.ts'

# With visible browser (for debugging)
pnpm test:e2e:headed

# Full automated run (starts services automatically)  
pnpm test:e2e
```

## What to Share for Help

If you're still having issues, please share:

1. **Exact error message** you're seeing
2. **Output** from these commands:
   ```bash
   curl http://localhost:4000/health
   curl http://localhost:3000
   pnpm --version
   node --version
   ```
3. **Backend and frontend terminal outputs** (if running manually)
4. **Your operating system** and any specific environment details
# Quick Start Guide - Collaborative Form Builder V2

## Prerequisites

- ✅ Node.js 22.11+ (warning at 22.11, recommended 22.12+)
- ✅ pnpm 8.0+
- ✅ Backend running on port 4000

---

## First Time Setup

### 1. Install Dependencies

```bash
# From repository root
pnpm install
```

### 2. Build Shared Packages

**Important:** You must build shared packages before starting the dev server.

```bash
# Option A: Build all packages at once
pnpm --filter "@dculus/*" build

# Option B: Use the helper script
./start-form-builder-v2.sh

# Option C: Build individually
pnpm --filter @dculus/types build
pnpm --filter @dculus/ui build
pnpm --filter @dculus/utils build
pnpm --filter @dculus/ui-v2 build
```

### 3. Start Backend

```bash
# Terminal 1
pnpm backend:dev
```

Wait for: `Server ready at http://localhost:4000/graphql`

### 4. Start Form Builder V2

```bash
# Terminal 2
pnpm --filter form-app-v2 dev
```

### 5. Access the Application

- **Form Builder V2:** http://localhost:3001
- **Backend GraphQL:** http://localhost:4000/graphql

---

## Daily Development Workflow

### Quick Start (After Initial Setup)

```bash
# Terminal 1: Start backend
pnpm backend:dev

# Terminal 2: Start form-app-v2
pnpm --filter form-app-v2 dev
```

### If Packages Were Updated

When you pull new changes that affect `packages/*`, rebuild:

```bash
pnpm --filter "@dculus/*" build
pnpm --filter form-app-v2 dev
```

---

## Testing the Collaborative Builder

### 1. Create/Edit a Form

1. Navigate to http://localhost:3001/dashboard
2. Sign in with your credentials
3. Create a new form or select an existing one
4. Click the "Edit" button

### 2. Access the Builder

You'll be redirected to:
```
http://localhost:3001/dashboard/form/{formId}/collaborate/page-builder
```

### 3. Verify Connection

Check for:
- ✅ Green "Connected" badge in header
- ✅ Form title displayed
- ✅ Page count shown
- ✅ Your permission level (VIEWER/EDITOR/OWNER)
- ✅ Tab navigation working (Layout, Builder, Preview, Settings)

### 4. Test Real-Time Collaboration

1. Open the same form in two browser tabs
2. Both should show "Connected"
3. Watch browser console for YJS sync messages

---

## Available Tabs

Currently implemented (Phase 1):
- ✅ **Page Builder** - Placeholder UI
- ✅ **Layout** - Placeholder UI
- ✅ **Preview** - Placeholder UI
- ✅ **Settings** - Placeholder UI

Coming soon (Phase 2-6):
- 🚧 **Layout** - Visual layout designer (L1-L9)
- 🚧 **Page Builder** - Drag-and-drop form builder
- 🚧 **Preview** - Live form preview
- 🚧 **Settings** - Form configuration

---

## Troubleshooting

### Issue: Module Export Errors

```
Error: The requested module does not provide an export named 'FormLayout'
```

**Fix:**
```bash
pnpm --filter "@dculus/*" build
```

### Issue: Port Already in Use

```bash
# Kill process on port 3001
lsof -ti:3001 | xargs kill -9

# Or use different port
PORT=3002 pnpm --filter form-app-v2 dev
```

### Issue: Backend Connection Failed

1. Verify backend is running: `curl http://localhost:4000/graphql`
2. Check `.env` file has correct URLs
3. Look for CORS errors in browser console

### Issue: YJS Connection Failed

Check WebSocket URL in `.env`:
```bash
VITE_WS_URL=ws://localhost:4000/collaboration
```

📚 **Full troubleshooting guide:** [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

---

## Environment Variables

File: `apps/form-app-v2/.env`

```bash
# API Configuration
VITE_API_URL=http://localhost:4000
VITE_GRAPHQL_URL=http://localhost:4000/graphql

# Collaboration WebSocket
VITE_WS_URL=ws://localhost:4000/collaboration

# CDN Endpoint
VITE_CDN_ENDPOINT=http://localhost:4000/static-files

# Form Viewer URL
VITE_FORM_VIEWER_URL=http://localhost:5173
```

---

## Useful Commands

### Development
```bash
# Start form-app-v2
pnpm --filter form-app-v2 dev

# Start backend
pnpm backend:dev

# Start both (in separate terminals)
pnpm dev  # Starts all apps
```

### Building
```bash
# Build form-app-v2 for production
pnpm --filter form-app-v2 build

# Build all packages
pnpm --filter "@dculus/*" build

# Build everything
pnpm build
```

### Testing
```bash
# Run tests
pnpm --filter form-app-v2 test

# Run with coverage
pnpm --filter form-app-v2 test:coverage
```

### Linting
```bash
# Lint form-app-v2
pnpm --filter form-app-v2 lint
```

---

## Project Structure

```
apps/form-app-v2/
├── src/
│   ├── components/
│   │   └── collaborative-builder/  # Builder components (Phases 2-6)
│   ├── contexts/
│   │   └── FormPermissionContext.tsx  # Access control
│   ├── graphql/
│   │   └── formBuilder.ts  # GraphQL queries
│   ├── hooks/
│   │   └── useDragAndDrop.ts  # DnD functionality
│   ├── lib/
│   │   └── config.ts  # Environment config
│   ├── pages/
│   │   └── CollaborativeFormBuilder.tsx  # Main entry point
│   └── store/
│       └── useFormBuilderStore.ts  # Zustand + YJS store
└── .env  # Environment variables
```

---

## Current Status

**Phase 1: ✅ COMPLETE**
- Foundation infrastructure
- YJS collaboration working
- Basic routing and navigation
- Permission system
- GraphQL integration

**Next: Phase 2 (Layout Tab)**
- Visual layout designer
- Theme customization
- Background controls

---

## Getting Help

### Check These First
1. All packages built? `ls packages/types/dist`
2. Backend running? `curl http://localhost:4000/graphql`
3. Environment variables set? `cat apps/form-app-v2/.env`

### Documentation
- [Migration Plan](./COLLABORATIVE_FORM_BUILDER_V2_MIGRATION_PLAN.md)
- [Quick Reference](./COLLABORATIVE_BUILDER_V2_QUICK_REF.md)
- [Architecture](./COLLABORATIVE_BUILDER_V2_ARCHITECTURE.md)
- [Troubleshooting](./TROUBLESHOOTING.md)

---

**Last Updated:** October 27, 2025  
**Status:** Phase 1 Complete ✅

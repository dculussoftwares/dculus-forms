# Troubleshooting: Build and Runtime Issues

## Issue: Module Export Errors

### Problem
```
useFormBuilderStore.ts:10 Uncaught SyntaxError: 
The requested module does not provide an export named 'FormLayout'
```

### Cause
The shared packages (`@dculus/types`, `@dculus/ui`, `@dculus/utils`, `@dculus/ui-v2`) need to be built before being used in `form-app-v2`.

### Solution ✅

Build all shared packages from the repository root:

```bash
# Build all packages at once
pnpm --filter "@dculus/*" build

# Or build individually
pnpm --filter @dculus/types build
pnpm --filter @dculus/ui build
pnpm --filter @dculus/utils build
pnpm --filter @dculus/ui-v2 build
```

Then restart the dev server:
```bash
pnpm --filter form-app-v2 dev
```

---

## Issue: Node.js Version Warning

### Problem
```
You are using Node.js 22.11.0. Vite requires Node.js version 20.19+ or 22.12+
```

### Cause
Vite 7.1.12 recommends a newer Node.js version.

### Status
⚠️ **Warning only** - Server still works correctly. This is a non-blocking warning.

### Solution (Optional)

If you want to eliminate the warning, upgrade Node.js:

```bash
# Using nvm (recommended)
nvm install 22.12
nvm use 22.12

# Using Homebrew
brew upgrade node

# Verify version
node --version  # Should show 22.12+ or 20.19+
```

However, **this is not required** for development. The application works fine with Node.js 22.11.0.

---

## Issue: TypeScript Errors in Store

### Problem
Multiple `any` type warnings in `useFormBuilderStore.ts`

### Cause
The store was copied from V1 which has some loose typing.

### Status
⚠️ **Non-blocking** - Store functions correctly. This is technical debt.

### Solution
Will be addressed in **Phase 7: Testing & Polish**. For now, these can be ignored as they don't affect functionality.

---

## Common Development Issues

### 1. Port Already in Use

**Error:** `Port 3001 is already in use`

**Solution:**
```bash
# Kill process using port 3001
lsof -ti:3001 | xargs kill -9

# Or use a different port
PORT=3002 pnpm --filter form-app-v2 dev
```

### 2. Hot Module Replacement (HMR) Not Working

**Problem:** Changes don't reflect in browser

**Solutions:**
1. Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
2. Clear Vite cache:
   ```bash
   rm -rf apps/form-app-v2/node_modules/.vite
   pnpm --filter form-app-v2 dev
   ```

### 3. GraphQL Connection Errors

**Error:** `Network error: Failed to fetch`

**Solution:**
1. Ensure backend is running:
   ```bash
   pnpm backend:dev
   ```
2. Check backend URL in `.env`:
   ```bash
   VITE_API_URL=http://localhost:4000
   VITE_GRAPHQL_URL=http://localhost:4000/graphql
   ```

### 4. YJS Connection Failed

**Error:** `Failed to initialize collaboration`

**Solutions:**
1. Verify WebSocket URL:
   ```bash
   VITE_WS_URL=ws://localhost:4000/collaboration
   ```
2. Check backend collaboration service is running
3. Look for CORS errors in browser console

### 5. Missing Types from @dculus/types

**Error:** `Cannot find module '@dculus/types'`

**Solution:**
```bash
# Reinstall workspace dependencies
pnpm install

# Rebuild types package
pnpm --filter @dculus/types build
```

---

## Quick Fix Commands

### Full Reset
```bash
# From repository root
pnpm clean              # Clean all build artifacts
pnpm install            # Reinstall dependencies
pnpm build              # Build all packages
pnpm --filter form-app-v2 dev  # Start dev server
```

### Rebuild Packages Only
```bash
pnpm --filter "@dculus/*" build
```

### Check What's Running
```bash
# See all node processes
ps aux | grep node

# See what's using port 3001
lsof -i :3001

# See what's using port 4000 (backend)
lsof -i :4000
```

---

## Environment Variable Checklist

Ensure these are set in `apps/form-app-v2/.env`:

```bash
✅ VITE_API_URL=http://localhost:4000
✅ VITE_GRAPHQL_URL=http://localhost:4000/graphql
✅ VITE_WS_URL=ws://localhost:4000/collaboration
✅ VITE_CDN_ENDPOINT=http://localhost:4000/static-files
✅ VITE_FORM_VIEWER_URL=http://localhost:5173
```

---

## Development Workflow

### Recommended Startup Order

1. **Start Backend First:**
   ```bash
   # Terminal 1
   pnpm backend:dev
   ```

2. **Wait for Backend Ready:**
   Look for: `Server ready at http://localhost:4000/graphql`

3. **Start Form App V2:**
   ```bash
   # Terminal 2
   pnpm --filter form-app-v2 dev
   ```

4. **Access Application:**
   - Form App V2: http://localhost:3001
   - Backend GraphQL: http://localhost:4000/graphql

### Clean Development Start

```bash
# Kill all existing processes
pkill -f "vite|node"

# Start fresh
pnpm backend:dev &
sleep 5  # Wait for backend
pnpm --filter form-app-v2 dev
```

---

## Browser Console Debugging

### Expected Console Messages

When the collaborative builder loads successfully, you should see:

```
✅ 🔧 Initializing collaboration for form: {formId}
✅ [YJS] Connection established
✅ [Zustand] Store initialized
✅ Pages loaded: X
```

### Error Messages to Watch For

```
❌ Failed to initialize collaboration
   → Check VITE_WS_URL and backend running

❌ Network error: Failed to fetch
   → Check VITE_API_URL and backend GraphQL endpoint

❌ Cannot find module '@dculus/types'
   → Run: pnpm --filter @dculus/types build
```

---

## When to Rebuild Packages

Rebuild shared packages when:
- ✅ First time setting up the project
- ✅ After pulling new changes that modify packages/
- ✅ After running `pnpm clean`
- ✅ When you see import/export errors
- ✅ After adding new exports to package index files

---

## Performance Tips

### 1. Use Vite's Fast Refresh
Vite's HMR is much faster than full page reload. It should work automatically.

### 2. Lazy Load Heavy Components
For Phase 3+, consider lazy loading:
```tsx
const LayoutTab = lazy(() => import('./components/collaborative-builder/layout/LayoutTab'));
```

### 3. Monitor Bundle Size
```bash
pnpm --filter form-app-v2 build
# Check dist/ folder size
```

---

## Getting Help

### Check These First
1. ✅ All packages built (`pnpm --filter "@dculus/*" build`)
2. ✅ Backend running (`curl http://localhost:4000/graphql`)
3. ✅ Environment variables set (`cat apps/form-app-v2/.env`)
4. ✅ Node modules installed (`ls apps/form-app-v2/node_modules`)

### Logs to Collect
- Browser console output
- Terminal output from dev server
- Backend terminal output
- Network tab in DevTools (for API errors)

---

**Last Updated:** October 27, 2025  
**Status:** All issues resolved ✅

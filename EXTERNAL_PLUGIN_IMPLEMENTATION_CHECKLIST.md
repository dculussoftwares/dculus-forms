# External Plugin System: Implementation Checklist

This checklist provides a step-by-step guide for implementing the external plugin system. Each task includes file paths and code references.

**📘 Main Documentation**: See [EXTERNAL_PLUGIN_SYSTEM.md](./EXTERNAL_PLUGIN_SYSTEM.md) for complete architecture details.

---

## Phase 1: Database Schema & Types

### 1.1 Update Prisma Schema

**File**: `apps/backend/prisma/schema.prisma`

- [ ] Add new fields to `Plugin` model:
  ```prisma
  model Plugin {
    // ... existing fields ...

    // NEW FIELDS
    installUrl    String?   // Source URL
    backendCode   String?   // Backend bundle code
    frontendCode  String?   // Frontend bundle code
    manifest      Json?     // Full manifest JSON
    isExternal    Boolean   @default(false)
    installSource String?   // 'url' | 'upload' | 'internal'
  }
  ```

- [ ] Run migrations:
  ```bash
  pnpm db:generate
  pnpm db:push
  ```

### 1.2 Create TypeScript Types

**File**: `apps/backend/src/plugins/loader/types.ts` (NEW)

- [ ] Create `PluginManifest` interface
- [ ] Create bundle configuration types
- [ ] Export all types

**Reference**: See "Plugin Manifest Specification" section in main doc.

---

## Phase 2: Backend Core Components

### 2.1 Bundle Validator

**File**: `apps/backend/src/plugins/loader/BundleValidator.ts` (NEW)

- [ ] Create `BundleValidator` class
- [ ] Implement `validateManifest()` with Zod schema
- [ ] Implement `validateBackendBundle()`
- [ ] Implement `validateFrontendBundle()`
- [ ] Add security checks for dangerous patterns

**Code**: Complete implementation provided in main doc under "BundleValidator" section.

### 2.2 Dynamic Importer

**File**: `apps/backend/src/plugins/loader/DynamicImporter.ts` (NEW)

- [ ] Create `DynamicImporter` class
- [ ] Create temp directory for plugin code (`temp/plugins/`)
- [ ] Implement `importFromCode()` method
  - Write code to temp file
  - Use dynamic `import()`
  - Clean up temp file
- [ ] Handle errors gracefully

**Code**: Complete implementation provided in main doc under "DynamicImporter" section.

### 2.3 Plugin Loader Service

**File**: `apps/backend/src/plugins/loader/PluginLoader.ts` (NEW)

- [ ] Create `PluginLoader` class
- [ ] Implement `installFromUrl()` method:
  - Download manifest
  - Validate manifest
  - Check for duplicates
  - Download bundles
  - Validate bundles
  - Store in database
  - Load into runtime
- [ ] Implement `loadPlugin()` method
- [ ] Implement `uninstallPlugin()` method
- [ ] Implement `updatePlugin()` method
- [ ] Implement `loadAllPlugins()` for startup
- [ ] Export singleton `pluginLoader`

**Code**: Complete implementation provided in main doc under "PluginLoader Service" section.

### 2.4 Update Plugin Registry

**File**: `apps/backend/src/plugins/registry.ts`

- [ ] Add `unregister()` method for runtime plugin removal
- [ ] Fix event listener cleanup on unregister
- [ ] Ensure registry supports hot-reload

**Code**: See "Updated PluginRegistry" section in main doc.

### 2.5 Update Server Startup

**File**: `apps/backend/src/index.ts`

- [ ] Import `pluginLoader`
- [ ] Call `pluginLoader.loadAllPlugins()` after `pluginRegistry.initialize()`
- [ ] Add error handling for plugin loading failures

**Code**:
```typescript
import { pluginLoader } from './plugins/loader/PluginLoader.js';

async function startServer() {
  // ... existing setup ...

  // Register internal plugins
  pluginRegistry.register(new HelloWorldPlugin());

  // Initialize plugin system
  await pluginRegistry.initialize();

  // Load external plugins from database
  await pluginLoader.loadAllPlugins();

  // ... start server ...
}
```

---

## Phase 3: GraphQL API

### 3.1 Update GraphQL Schema

**File**: `apps/backend/src/graphql/schema.ts`

- [ ] Add new fields to `Plugin` type:
  ```graphql
  type Plugin {
    # ... existing fields ...
    isExternal: Boolean!
    installSource: String
    installUrl: String
    manifest: JSON
  }
  ```

- [ ] Add input types:
  ```graphql
  input InstallPluginInput {
    url: String!
  }

  type InstallPluginResult {
    success: Boolean!
    pluginId: String
    message: String
  }
  ```

- [ ] Add new mutations:
  ```graphql
  type Mutation {
    installPlugin(input: InstallPluginInput!): InstallPluginResult!
    uninstallPlugin(pluginId: ID!): InstallPluginResult!
    updatePlugin(pluginId: ID!): InstallPluginResult!
  }
  ```

- [ ] Add new query:
  ```graphql
  type Query {
    pluginConfigUI(pluginId: ID!): String
  }
  ```

### 3.2 Create Plugin Resolvers

**File**: `apps/backend/src/graphql/resolvers/plugins.ts`

- [ ] Implement `installPlugin` mutation resolver
- [ ] Implement `uninstallPlugin` mutation resolver
- [ ] Implement `updatePlugin` mutation resolver
- [ ] Implement `pluginConfigUI` query resolver
- [ ] Add authentication checks
- [ ] Add error handling

**Code**: Complete resolvers provided in main doc under "GraphQL Resolvers" section.

### 3.3 Register Resolvers

**File**: `apps/backend/src/graphql/resolvers.ts`

- [ ] Import `pluginResolvers`
- [ ] Merge with existing resolvers

---

## Phase 4: Frontend Implementation

### 4.1 Create GraphQL Queries/Mutations

**File**: `apps/form-app/src/graphql/plugins.ts` (NEW)

- [ ] Create `GET_PLUGINS` query
- [ ] Create `GET_PLUGIN_CONFIG_UI` query
- [ ] Create `INSTALL_PLUGIN` mutation
- [ ] Create `UNINSTALL_PLUGIN` mutation
- [ ] Create `UPDATE_PLUGIN` mutation

**Code**: Complete GraphQL operations provided in main doc under "GraphQL Queries/Mutations" section.

### 4.2 Plugin Config Loader Hook

**File**: `apps/form-app/src/hooks/usePluginConfigLoader.ts` (NEW)

- [ ] Create `usePluginConfigLoader` hook
- [ ] Fetch plugin config UI code from GraphQL
- [ ] Create blob URL from code
- [ ] Dynamic import the component
- [ ] Return component, loading, and error states
- [ ] Clean up blob URL on unmount

**Code**: Complete hook provided in main doc under "Dynamic Plugin Config Loader" section.

### 4.3 Dynamic Plugin Config Component

**File**: `apps/form-app/src/components/form-builder/plugins/DynamicPluginConfig.tsx` (NEW)

- [ ] Create component that uses `usePluginConfigLoader`
- [ ] Render loaded config component
- [ ] Handle loading and error states
- [ ] Pass `config` and `onChange` props

**Code**: Complete component provided in main doc.

### 4.4 Plugin Marketplace UI

**File**: `apps/form-app/src/components/form-builder/plugins/PluginMarketplace.tsx` (NEW)

- [ ] Create marketplace component
- [ ] Display list of available plugins (grid layout)
- [ ] Add "Install from URL" button
- [ ] Create install dialog with URL input
- [ ] Call `installPlugin` mutation
- [ ] Show success/error messages
- [ ] Refresh plugin list after installation
- [ ] Add plugin cards with:
  - Icon and name
  - Description
  - Category badge
  - Version number
  - "External" badge for external plugins

**Code**: Complete component provided in main doc under "Plugin Marketplace Component" section.

### 4.5 Update Existing Plugin Pages

**Files**:
- `apps/form-app/src/pages/FormPlugins.tsx`
- `apps/form-app/src/components/form-builder/plugins/FormPluginsNew.tsx`

- [ ] Add link to Plugin Marketplace
- [ ] Use `DynamicPluginConfig` for external plugins
- [ ] Show install source (internal vs external)
- [ ] Add update button for external plugins
- [ ] Add uninstall button for external plugins

---

## Phase 5: Plugin SDK Package

### 5.1 Create Package Structure

**Directory**: `packages/plugin-sdk/`

- [ ] Create directory structure:
  ```
  packages/plugin-sdk/
  ├── package.json
  ├── tsconfig.json
  ├── src/
  │   ├── index.ts
  │   ├── BasePlugin.ts      # Symlink or copy from backend
  │   ├── PluginContext.ts   # Symlink or copy from backend
  │   ├── types.ts
  │   └── build/
  │       ├── buildPlugin.ts
  │       └── config.ts
  ├── templates/
  │   └── basic-plugin/
  └── README.md
  ```

### 5.2 Package Configuration

**File**: `packages/plugin-sdk/package.json`

- [ ] Set package name: `@dculus/plugin-sdk`
- [ ] Add dependencies: `zod`, `esbuild`
- [ ] Add peer dependencies: `react`
- [ ] Add bin script: `dculus-plugin`
- [ ] Set main entry point

**Code**: Complete package.json provided in main doc under "Plugin SDK Package" section.

### 5.3 Build Script

**File**: `packages/plugin-sdk/src/build/buildPlugin.ts`

- [ ] Implement `buildPlugin()` function
- [ ] Use esbuild to bundle backend (ESM format)
- [ ] Use esbuild to bundle frontend (UMD/IIFE format)
- [ ] Set external dependencies (React for frontend)
- [ ] Copy manifest.json to dist
- [ ] Add error handling

**Code**: Complete implementation provided in main doc.

### 5.4 CLI Tool

**File**: `packages/plugin-sdk/src/cli.ts`

- [ ] Create CLI with commander
- [ ] Add `build` command
- [ ] Add `init` command (optional for MVP)
- [ ] Add help text

**Code**: Complete CLI provided in main doc under "CLI Tool" section.

### 5.5 Plugin Template

**Directory**: `packages/plugin-sdk/templates/basic-plugin/`

- [ ] Create basic plugin template:
  ```
  templates/basic-plugin/
  ├── package.json
  ├── manifest.json
  ├── tsconfig.json
  ├── src/
  │   ├── backend/
  │   │   └── index.ts
  │   └── frontend/
  │       └── ConfigUI.tsx
  └── README.md
  ```

- [ ] Template should have:
  - Basic plugin class extending BasePlugin
  - Simple config UI
  - Build scripts in package.json
  - Instructions in README

### 5.6 Monorepo Integration

**File**: `pnpm-workspace.yaml`

- [ ] Add `packages/plugin-sdk` to workspace

**File**: Root `package.json`

- [ ] Add build script for plugin-sdk
- [ ] Add to global type-check and lint

---

## Phase 6: Testing

### 6.1 Unit Tests

- [ ] Test `BundleValidator`:
  - Valid manifest
  - Invalid manifest (missing fields)
  - Invalid version format
  - Dangerous code patterns

- [ ] Test `DynamicImporter`:
  - Valid ES module import
  - Invalid code (syntax error)
  - Cleanup of temp files

- [ ] Test `PluginLoader`:
  - Install from valid URL
  - Install with invalid URL (404)
  - Install with invalid manifest
  - Duplicate installation (should fail)
  - Uninstall plugin
  - Update plugin

### 6.2 Integration Tests

- [ ] End-to-end plugin installation flow:
  1. Call `installPlugin` mutation
  2. Verify plugin in database
  3. Verify plugin registered in runtime
  4. Configure plugin for a form
  5. Submit form
  6. Verify plugin executed

- [ ] Test plugin update flow
- [ ] Test plugin uninstall flow

### 6.3 Manual Testing

- [ ] Create test plugin and host locally
- [ ] Install via UI
- [ ] Configure plugin for a form
- [ ] Submit form and verify plugin triggered
- [ ] Update plugin version and verify update works
- [ ] Uninstall plugin and verify removal

---

## Phase 7: Documentation

### 7.1 Developer Documentation

- [ ] Write plugin development guide
- [ ] Create tutorial: "Building Your First Plugin"
- [ ] Document all PluginContext API methods
- [ ] Provide code examples for common use cases
- [ ] Document build process and tools

### 7.2 User Documentation

- [ ] Write user guide for installing plugins
- [ ] Document plugin marketplace UI
- [ ] Create FAQ
- [ ] Add troubleshooting section

### 7.3 README Updates

- [ ] Update main README with plugin system info
- [ ] Update CLAUDE.md with plugin architecture
- [ ] Create plugin-sdk README

---

## Phase 8: Deployment

### 8.1 Pre-Deployment

- [ ] Create backup of production database
- [ ] Test migrations on staging environment
- [ ] Create rollback plan

### 8.2 Database Migration

- [ ] Run `pnpm db:generate`
- [ ] Run `pnpm db:push` on production
- [ ] Verify new Plugin fields exist
- [ ] Manually check database

### 8.3 Backend Deployment

- [ ] Ensure `temp/plugins/` directory exists (or is writable)
- [ ] Deploy updated backend
- [ ] Verify server starts successfully
- [ ] Check logs for plugin loading

### 8.4 Frontend Deployment

- [ ] Build and deploy updated form-app
- [ ] Test plugin marketplace UI
- [ ] Test install flow
- [ ] Test dynamic config loading

### 8.5 SDK Package

- [ ] Build plugin-sdk package: `pnpm --filter @dculus/plugin-sdk build`
- [ ] Publish to npm: `npm publish` (if publishing publicly)
- [ ] Or document local installation: `npm install file:../path/to/plugin-sdk`

### 8.6 Post-Deployment

- [ ] Monitor logs for errors
- [ ] Test installing a real external plugin
- [ ] Verify existing internal plugins still work
- [ ] Check performance metrics

---

## Phase 9: Example Plugins

### 9.1 Create Example Plugins

Create at least 2-3 example plugins to demonstrate:

- [ ] **Email Plugin**: Send email on form submission
- [ ] **Slack Plugin**: Post to Slack channel
- [ ] **Webhook Plugin**: POST to custom webhook URL

### 9.2 Host Example Plugins

- [ ] Build each example plugin
- [ ] Host on GitHub Pages or CDN
- [ ] Test installation from hosted URL
- [ ] Document installation URLs

---

## Phase 10: Polish & Optimization

### 10.1 Error Handling

- [ ] Improve error messages for users
- [ ] Add validation error details
- [ ] Handle network failures gracefully
- [ ] Add retry logic for downloads

### 10.2 Performance

- [ ] Add caching for downloaded bundles
- [ ] Optimize bundle size (minification)
- [ ] Add loading indicators in UI
- [ ] Implement lazy loading for plugin configs

### 10.3 Security

- [ ] Add basic security checks (dangerous patterns)
- [ ] Implement plugin code size limits
- [ ] Add rate limiting on installations (future)
- [ ] Document security best practices for plugin developers

### 10.4 UX Improvements

- [ ] Add plugin search/filter in marketplace
- [ ] Show plugin loading states
- [ ] Add plugin installation progress
- [ ] Provide better feedback on errors
- [ ] Add plugin categories/tags

---

## Verification Checklist

Before marking implementation as complete, verify:

### Backend
- [ ] Database has new Plugin fields
- [ ] PluginLoader service exists and works
- [ ] Dynamic import() successfully loads plugins
- [ ] GraphQL mutations work (test with GraphQL Playground)
- [ ] Plugins loaded on server startup
- [ ] Event listeners properly registered for external plugins

### Frontend
- [ ] Plugin marketplace UI accessible
- [ ] Can install plugin from URL
- [ ] Dynamic config UI loads correctly
- [ ] Can configure external plugins
- [ ] Can uninstall plugins
- [ ] Error messages are user-friendly

### SDK
- [ ] `@dculus/plugin-sdk` package builds successfully
- [ ] CLI tool works (`dculus-plugin build`)
- [ ] Can build example plugin
- [ ] Generated bundles are valid

### End-to-End
- [ ] Install external plugin from URL
- [ ] Configure plugin for a form
- [ ] Submit form response
- [ ] Verify plugin executed (check logs)
- [ ] Update plugin to new version
- [ ] Uninstall plugin

---

## Quick Start Guide (For Implementer)

**Recommended Implementation Order**:

1. **Start with Database** (Phase 1): Update schema first
2. **Backend Core** (Phase 2): Build loader service
3. **GraphQL API** (Phase 3): Add mutations/queries
4. **Test Backend** (Phase 6.1): Verify core functionality works
5. **Frontend UI** (Phase 4): Build marketplace
6. **Plugin SDK** (Phase 5): Create SDK package
7. **Create Example** (Phase 9): Build test plugin
8. **Test E2E** (Phase 6.2): Full integration test
9. **Documentation** (Phase 7): Write guides
10. **Deploy** (Phase 8): Release to production

**Estimated Implementation Time**:
- Backend Core: 8-12 hours
- Frontend UI: 4-6 hours
- Plugin SDK: 4-6 hours
- Testing: 4-6 hours
- Documentation: 3-4 hours
- **Total: 23-34 hours** (~3-4 days)

---

## Files Summary

### New Files to Create

**Backend:**
- `apps/backend/src/plugins/loader/types.ts`
- `apps/backend/src/plugins/loader/BundleValidator.ts`
- `apps/backend/src/plugins/loader/DynamicImporter.ts`
- `apps/backend/src/plugins/loader/PluginLoader.ts`

**Frontend:**
- `apps/form-app/src/graphql/plugins.ts`
- `apps/form-app/src/hooks/usePluginConfigLoader.ts`
- `apps/form-app/src/components/form-builder/plugins/PluginMarketplace.tsx`
- `apps/form-app/src/components/form-builder/plugins/DynamicPluginConfig.tsx`

**Plugin SDK:**
- `packages/plugin-sdk/package.json`
- `packages/plugin-sdk/src/index.ts`
- `packages/plugin-sdk/src/build/buildPlugin.ts`
- `packages/plugin-sdk/src/cli.ts`
- `packages/plugin-sdk/templates/basic-plugin/*`

### Files to Modify

**Backend:**
- `apps/backend/prisma/schema.prisma` (add Plugin fields)
- `apps/backend/src/plugins/registry.ts` (add unregister method)
- `apps/backend/src/index.ts` (load external plugins)
- `apps/backend/src/graphql/schema.ts` (add types/mutations)
- `apps/backend/src/graphql/resolvers/plugins.ts` (add resolvers)
- `apps/backend/src/graphql/resolvers.ts` (merge resolvers)

**Frontend:**
- `apps/form-app/src/pages/FormPlugins.tsx` (add marketplace link)
- `apps/form-app/src/components/form-builder/plugins/FormPluginsNew.tsx` (support external plugins)

**Root:**
- `pnpm-workspace.yaml` (add plugin-sdk package)

---

## Support & Questions

For questions about implementation:

1. **Read the main documentation**: [EXTERNAL_PLUGIN_SYSTEM.md](./EXTERNAL_PLUGIN_SYSTEM.md)
2. **Check code examples**: All code is provided in the main doc
3. **Review old implementation**: Check `archive/old-plugin-docs/` for reference
4. **Test incrementally**: Build and test each phase before moving to next

**Key Reference Sections in Main Doc:**
- Database Schema → Phase 1
- PluginLoader Service → Phase 2.3
- GraphQL Resolvers → Phase 3.2
- Frontend Components → Phase 4
- Plugin SDK → Phase 5

Good luck with implementation! 🚀

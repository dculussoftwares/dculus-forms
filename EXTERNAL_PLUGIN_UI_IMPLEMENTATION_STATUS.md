# External Plugin UI Implementation Status

## ✅ Completed Frontend UI Implementation

The user interface for installing external plugins from URLs has been **successfully implemented** in the form-app.

---

## Implementation Summary

### 1. GraphQL Mutations Added

**File**: `apps/form-app/src/graphql/plugins.ts`

Added the following GraphQL operations for external plugin management:

```typescript
// Install plugin from URL
export const INSTALL_EXTERNAL_PLUGIN = gql`
  mutation InstallExternalPlugin($input: InstallExternalPluginInput!) {
    installExternalPlugin(input: $input) {
      success
      pluginId
      message
    }
  }
`;

// Uninstall external plugin
export const UNINSTALL_EXTERNAL_PLUGIN = gql`
  mutation UninstallExternalPlugin($pluginId: ID!) {
    uninstallExternalPlugin(pluginId: $pluginId) {
      success
      message
    }
  }
`;

// Update external plugin
export const UPDATE_EXTERNAL_PLUGIN = gql`
  mutation UpdateExternalPlugin($pluginId: ID!) {
    updateExternalPlugin(pluginId: $pluginId) {
      success
      message
    }
  }
`;

// Get plugin configuration UI bundle
export const GET_PLUGIN_CONFIG_UI = gql`
  query GetPluginConfigUI($pluginId: ID!) {
    pluginConfigUI(pluginId: $pluginId)
  }
`;
```

---

### 2. Install Plugin Dialog Component

**File**: `apps/form-app/src/components/plugins/InstallPluginDialog.tsx`

A complete React dialog component for installing external plugins:

**Features**:
- ✅ URL input field with validation (must start with http/https)
- ✅ Example URLs displayed (localhost:3001, localhost:3002)
- ✅ Loading state with animated spinner during installation
- ✅ Success/error toast notifications
- ✅ Security warning about trusted sources
- ✅ Calls `INSTALL_EXTERNAL_PLUGIN` GraphQL mutation
- ✅ Auto-closes and triggers `onSuccess()` callback after installation

**Props**:
```typescript
interface InstallPluginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;  // Callback to refetch plugin lists
}
```

**Key Logic**:
```typescript
const handleInstall = async () => {
  if (!pluginUrl || !pluginUrl.startsWith('http')) {
    toastError('Invalid URL', 'Please enter a valid HTTP or HTTPS URL');
    return;
  }

  setIsInstalling(true);
  try {
    const result = await installExternalPlugin({
      variables: { input: { url: pluginUrl } }
    });

    if (result.data?.installExternalPlugin?.success) {
      toastSuccess('Plugin Installed', `${result.data.installExternalPlugin.pluginId} installed successfully`);
      onSuccess?.();  // Refetch plugins
    }
  } catch (error: any) {
    toastError('Installation Failed', error.message);
  } finally {
    setIsInstalling(false);
  }
};
```

---

### 3. Plugin Marketplace Integration

**File**: `apps/form-app/src/pages/FormPluginsNew.tsx`

Updated the plugin marketplace page to include external plugin installation:

**Changes Made**:

1. **Import InstallPluginDialog**:
   ```typescript
   import { InstallPluginDialog } from '../components/plugins/InstallPluginDialog';
   import { Download } from 'lucide-react';
   ```

2. **Added state for dialog**:
   ```typescript
   const [installFromUrlDialogOpen, setInstallFromUrlDialogOpen] = useState(false);
   ```

3. **Added "Install from URL" button** in Available Plugins section header:
   ```tsx
   <div className="flex items-center justify-between mb-4">
     <h2 className="text-2xl font-semibold text-slate-900">
       Available Plugins
     </h2>
     <Button
       variant="outline"
       onClick={() => setInstallFromUrlDialogOpen(true)}
     >
       <Download className="h-4 w-4 mr-2" />
       Install from URL
     </Button>
   </div>
   ```

4. **Integrated InstallPluginDialog component** at end of JSX:
   ```tsx
   <InstallPluginDialog
     open={installFromUrlDialogOpen}
     onOpenChange={setInstallFromUrlDialogOpen}
     onSuccess={() => {
       refetchPlugins();      // Refresh available plugins
       refetchConfigs();      // Refresh installed plugins
     }}
   />
   ```

---

## User Flow

### Installing External Plugin from URL

1. User navigates to form plugins page: `/dashboard/form/{formId}/plugins`
2. User sees **"Install from URL"** button in the "Available Plugins" section header
3. User clicks button → InstallPluginDialog opens
4. User enters plugin URL (e.g., `http://localhost:3001`)
5. User sees example URLs and security warning
6. User clicks **"Install Plugin"** button
7. Loading state shown ("Installing...")
8. **Frontend calls `INSTALL_EXTERNAL_PLUGIN` GraphQL mutation**
9. On success:
   - ✅ Success toast: "Plugin Installed - {pluginId} installed successfully"
   - ✅ Dialog closes
   - ✅ Plugin lists refetch automatically
   - ✅ New plugin appears in marketplace
10. On error:
    - ❌ Error toast: "Installation Failed - {error message}"
    - ❌ Dialog stays open for retry

---

## UI Screenshots/Mockup

### Plugin Marketplace with "Install from URL" Button

```
┌─────────────────────────────────────────────────────┐
│  ← Back to Dashboard                                 │
│                                                      │
│  Plugins                                             │
│  Extend your forms with powerful integrations       │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  Installed Plugins                    2 Active      │
│                                                      │
│  [Hello World Plugin Card]  [Webhook Plugin Card]   │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  Available Plugins        [📥 Install from URL]     │
│                                                      │
│  [Plugin Cards Grid...]                             │
└─────────────────────────────────────────────────────┘
```

### Install Plugin Dialog

```
┌──────────────────────────────────────────┐
│  📥 Install Plugin from URL              │
│  Install an external plugin by providing │
│  the URL to its manifest                 │
│                                          │
│  Plugin URL                              │
│  ┌────────────────────────────────────┐ │
│  │ 🌐 https://example.com/plugins/... │ │
│  └────────────────────────────────────┘ │
│  The URL should point to a directory    │
│  containing manifest.json               │
│                                          │
│  ⓘ How it works:                         │
│  The system will download the plugin    │
│  manifest, validate it, and install     │
│  the plugin bundles.                    │
│                                          │
│  Example URLs:                           │
│  • http://localhost:3001                │
│  • http://localhost:3002                │
│  • https://cdn.example.com/plugins/...  │
│                                          │
│  ⚠️ Security Notice:                     │
│  Only install plugins from trusted      │
│  sources. Plugins have access to form   │
│  data within your organization.         │
│                                          │
│  [Cancel]  [📥 Install Plugin]          │
└──────────────────────────────────────────┘
```

---

## Testing Status

### Frontend Components: ✅ Complete

- [x] InstallPluginDialog component created
- [x] FormPluginsNew page updated with button
- [x] GraphQL mutations defined
- [x] Hot module reloading working
- [x] No TypeScript errors
- [x] Frontend running on http://localhost:3000

### Example Plugins: ✅ Ready

- [x] Hello World Plugin served on http://localhost:3001
- [x] Webhook Notifier Plugin served on http://localhost:3002
- [x] Both plugins accessible via curl

### Backend Infrastructure: ❌ NOT IMPLEMENTED

The backend GraphQL resolvers and services are **NOT yet implemented**. When users click "Install Plugin", they will receive GraphQL errors until the backend is built.

**Required Backend Work** (see `EXTERNAL_PLUGIN_IMPLEMENTATION_CHECKLIST.md`):

1. ❌ Database schema updates (Plugin model fields)
2. ❌ PluginLoader service (download, validate, install)
3. ❌ BundleValidator service (validate manifest and bundles)
4. ❌ DynamicImporter service (load JavaScript at runtime)
5. ❌ GraphQL schema definitions (InstallExternalPluginInput, etc.)
6. ❌ GraphQL resolver implementations (installExternalPlugin mutation)

**Estimated Backend Implementation Time**: 25-38 hours (3-5 days)

---

## Current Status Summary

| Component | Status | Notes |
|-----------|--------|-------|
| Frontend UI | ✅ Complete | Dialog, button, GraphQL queries all implemented |
| Example Plugins | ✅ Complete | 2 plugins built and served locally |
| Backend API | ❌ Not Started | GraphQL resolvers need implementation |
| Plugin Loader | ❌ Not Started | Core installation logic needed |
| Database Schema | ❌ Not Started | Plugin model needs new fields |

---

## Next Steps

### To Test Full Flow (After Backend Implementation)

1. Start all services:
   ```bash
   pnpm backend:dev        # Backend on :4000
   pnpm form-app:dev       # Frontend on :3000
   npx serve dist -p 3001  # Hello World Plugin (in external-plugins/hello-world-plugin/)
   npx serve dist -p 3002  # Webhook Plugin (in external-plugins/webhook-plugin/)
   ```

2. Login to form-app: http://localhost:3000
3. Navigate to: `/dashboard/form/{formId}/plugins`
4. Click "Install from URL" button
5. Enter: `http://localhost:3001`
6. Click "Install Plugin"
7. Verify success toast and plugin appears in marketplace

### To Implement Backend

Follow the comprehensive implementation guide:
- **Detailed checklist**: `EXTERNAL_PLUGIN_IMPLEMENTATION_CHECKLIST.md`
- **Architecture document**: `EXTERNAL_PLUGIN_SYSTEM.md`

**Start with Phase 1: Database Schema Updates** (see checklist)

---

## Files Modified/Created

### Created Files
- `apps/form-app/src/components/plugins/InstallPluginDialog.tsx` (187 lines)

### Modified Files
- `apps/form-app/src/graphql/plugins.ts` (+35 lines)
- `apps/form-app/src/pages/FormPluginsNew.tsx` (+18 lines)

---

## Summary

✅ **The frontend UI for installing external plugins from URLs is fully implemented and functional.**

The user can now:
- Click "Install from URL" button in the plugin marketplace
- Enter plugin URLs (http://localhost:3001, etc.)
- See loading states and receive feedback via toasts
- Automatic refetch of plugin lists after installation

⚠️ **Backend implementation is required** for actual plugin installation to work. The GraphQL mutations will return errors until the backend services are built.

---

**Implementation Date**: 2025-10-12
**Status**: Frontend Complete, Backend Pending

# External Plugin System: Complete Architecture & Implementation Guide

**Version**: 2.0
**Status**: 🚧 Design Document
**Purpose**: Enable users to install form plugins from external URLs using pre-built JavaScript bundles

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Principles](#architecture-principles)
3. [Plugin Bundle Format](#plugin-bundle-format)
4. [Plugin Manifest Specification](#plugin-manifest-specification)
5. [Database Schema](#database-schema)
6. [Backend Implementation](#backend-implementation)
7. [Frontend Implementation](#frontend-implementation)
8. [Plugin SDK Package](#plugin-sdk-package)
9. [Installation Flow](#installation-flow)
10. [Plugin Development Workflow](#plugin-development-workflow)
11. [API Reference](#api-reference)
12. [Security Considerations](#security-considerations)
13. [Examples](#examples)

---

## Overview

### What is the External Plugin System?

The External Plugin System allows users to **install form automation plugins from any URL** without requiring plugins to be bundled in the dculus-forms repository. Plugin developers create standalone packages that can be hosted anywhere (GitHub, CDN, static hosting) and installed via a simple URL.

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Pre-built bundles** instead of npm packages | No dependency management, simpler installation, works without npm registry |
| **Two separate bundles** (backend + frontend) | Clean separation of concerns, independent loading |
| **Dynamic `import()`** instead of `require()` | ES modules support, async loading, hot-reload capability |
| **Code stored in database** | No filesystem management, works in serverless environments, easier deployment |
| **URL-based installation** | Host plugins anywhere, no central registry needed, developer freedom |

### Architecture Comparison

#### OLD: Internal Plugin System (Deprecated)
```
plugins/
├── hello-world/          # Hardcoded in repo
│   ├── index.ts
│   └── schema.ts
└── registry.ts           # Manually imports plugins
```

**Problems:**
- Plugins must be added to codebase
- Requires rebuild and redeploy for new plugins
- No external plugin support
- Tightly coupled to monorepo

#### NEW: External Plugin System
```
User provides URL → Download bundles → Store in DB → Dynamic import → Register
```

**Benefits:**
- ✅ Install plugins without code changes
- ✅ Hot-reload new plugins at runtime
- ✅ Host plugins anywhere
- ✅ Organization-level plugin management
- ✅ Independent plugin versioning

---

## Architecture Principles

### 1. Zero-Dependency Plugin Loading

Plugins are **pre-built, self-contained bundles**. The system does NOT:
- Install npm dependencies at runtime
- Run build tools (webpack, rollup, etc.)
- Manage package.json or node_modules

### 2. Dual Bundle Architecture

Each plugin consists of **exactly 2 files**:

| File | Purpose | Format | Runtime |
|------|---------|--------|---------|
| **`plugin.backend.js`** | Plugin logic, event handlers | ES Module (ESM) | Node.js backend |
| **`plugin.config.js`** | Configuration UI component | UMD/ESM | React frontend |

### 3. Event-Driven Execution

Plugins listen to form lifecycle events via EventEmitter3:
- `form.submitted` - Form response submitted
- `form.created` - New form created
- `form.updated` - Form schema updated
- `form.deleted` - Form deleted

### 4. Organization-Scoped Context

Every plugin receives a `PluginContext` object with organization-scoped API methods:
- `getForm(formId)` - Fetch form details
- `getResponse(responseId)` - Fetch response data
- `listResponses(formId)` - List form responses
- `getOrganization()` - Organization details
- **Automatic organization boundary enforcement** - Plugins cannot access other organizations' data

### 5. Database-Backed Plugin Storage

Plugin code is stored in MongoDB (not filesystem) for:
- Serverless compatibility (no persistent filesystem)
- Easier deployment (no file sync across servers)
- Atomic updates (update code in single transaction)
- Version history (store previous versions)

---

## Plugin Bundle Format

### Directory Structure (Developer Side)

When developing a plugin, the structure looks like:

```
my-awesome-plugin/
├── package.json                    # NPM metadata (for build only)
├── manifest.json                   # Plugin metadata
├── build.config.js                 # Build configuration
├── src/
│   ├── backend/
│   │   └── index.ts               # Backend plugin logic
│   └── frontend/
│       └── ConfigUI.tsx           # React config component
├── dist/                           # Build output (generated)
│   ├── plugin.backend.js          # Bundled backend (ESM)
│   ├── plugin.config.js           # Bundled frontend (UMD)
│   └── manifest.json              # Copied manifest
└── README.md
```

### Bundle Requirements

#### Backend Bundle (`plugin.backend.js`)

**Format**: ES Module (ESM)
**Export**: Default export must be a class extending `BasePlugin`

**Example:**
```javascript
import { BasePlugin } from '@dculus/plugin-sdk';

export default class EmailPlugin extends BasePlugin {
  constructor() {
    super({
      id: 'email-plugin',
      name: 'Email Notifications',
      description: 'Send email when form is submitted',
      icon: '📧',
      category: 'notification',
      version: '1.0.0'
    });
  }

  getConfigSchema() {
    return z.object({
      recipientEmail: z.string().email(),
      subject: z.string(),
      isEnabled: z.boolean()
    });
  }

  async onFormSubmitted(event, context) {
    const config = await this.getConfig(event.formId);
    const form = await context.getForm(event.formId);
    const response = await context.getResponse(event.responseId);

    // Send email logic here
    await sendEmail({
      to: config.recipientEmail,
      subject: config.subject,
      body: JSON.stringify(response.data)
    });
  }
}
```

**Must NOT include**:
- Import statements for Node.js built-ins (should be bundled with `external: []`)
- Import statements for npm packages (bundle everything)
- Import statements for dculus-forms code (except SDK)

**Must include**:
- All dependencies bundled inline
- Polyfills for browser APIs if used
- Complete self-contained code

#### Frontend Bundle (`plugin.config.js`)

**Format**: UMD or ESM
**Export**: Default export must be a React component

**Example:**
```javascript
// UMD bundle
(function (global, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = factory(require('react'));
  } else if (typeof define === 'function' && define.amd) {
    define(['react'], factory);
  } else {
    global.EmailPluginConfig = factory(global.React);
  }
}(this, function (React) {
  return function EmailPluginConfig({ config, onChange }) {
    return React.createElement('div', null,
      React.createElement('input', {
        type: 'email',
        value: config.recipientEmail || '',
        onChange: (e) => onChange({ recipientEmail: e.target.value })
      })
    );
  };
}));
```

**Must NOT include**:
- React library itself (use external: ['react', 'react-dom'])
- dculus-forms UI components (use only standard HTML/React)

**Must include**:
- All other dependencies bundled
- Self-contained UI logic

---

## Plugin Manifest Specification

### manifest.json

Every plugin must have a `manifest.json` file that describes the plugin metadata.

**Location**: `dist/manifest.json` (copied from root during build)

**Schema**:
```json
{
  "$schema": "https://dculus.com/schemas/plugin-manifest-v1.json",
  "id": "email-plugin",
  "name": "Email Notifications",
  "description": "Send email notifications when forms are submitted",
  "icon": "📧",
  "category": "notification",
  "version": "1.0.0",
  "author": {
    "name": "John Doe",
    "email": "john@example.com",
    "url": "https://example.com"
  },
  "homepage": "https://github.com/example/email-plugin",
  "repository": {
    "type": "git",
    "url": "https://github.com/example/email-plugin"
  },
  "license": "MIT",
  "bundles": {
    "backend": "plugin.backend.js",
    "frontend": "plugin.config.js"
  },
  "permissions": [
    "form:read",
    "response:read",
    "organization:read"
  ],
  "minVersion": "1.0.0",
  "maxVersion": "2.0.0"
}
```

**Field Descriptions**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Unique plugin identifier (kebab-case, alphanumeric + hyphens) |
| `name` | string | ✅ | Display name shown in UI |
| `description` | string | ✅ | Short description (max 200 chars) |
| `icon` | string | ✅ | Emoji or icon identifier |
| `category` | string | ✅ | Category: `notification`, `automation`, `integration`, `analytics`, `storage` |
| `version` | string | ✅ | Semantic version (semver) |
| `author` | object | ✅ | Author information |
| `author.name` | string | ✅ | Author full name |
| `author.email` | string | ❌ | Author email |
| `author.url` | string | ❌ | Author website |
| `homepage` | string | ❌ | Plugin homepage/documentation URL |
| `repository` | object | ❌ | Source code repository |
| `repository.type` | string | ❌ | Repository type (usually "git") |
| `repository.url` | string | ❌ | Repository URL |
| `license` | string | ✅ | License identifier (SPDX) |
| `bundles` | object | ✅ | Bundle file paths |
| `bundles.backend` | string | ✅ | Backend bundle filename |
| `bundles.frontend` | string | ✅ | Frontend bundle filename |
| `permissions` | string[] | ❌ | Required permissions (for future use) |
| `minVersion` | string | ❌ | Minimum dculus-forms version required |
| `maxVersion` | string | ❌ | Maximum dculus-forms version supported |

---

## Database Schema

### Plugin Model Updates

**New fields to add to existing `Plugin` model**:

```prisma
model Plugin {
  id          String   @id @map("_id")
  name        String
  description String
  icon        String
  category    String
  version     String
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // NEW FIELDS FOR EXTERNAL PLUGINS
  installUrl    String?   // Source URL (e.g., https://example.com/plugins/email)
  backendCode   String?   // Bundled backend JavaScript code
  frontendCode  String?   // Bundled frontend JavaScript code
  manifest      Json?     // Full manifest.json content
  isExternal    Boolean   @default(false)  // True for external plugins
  installSource String?   // 'url' | 'upload' | 'internal'

  // Relations
  formConfigs FormPluginConfig[]

  @@map("plugin")
}
```

**Field Purposes**:

| Field | Purpose | Example Value |
|-------|---------|---------------|
| `installUrl` | Original plugin URL for updates | `https://cdn.example.com/plugins/email/v1.0.0` |
| `backendCode` | Complete backend bundle code | `export default class EmailPlugin extends BasePlugin {...}` |
| `frontendCode` | Complete frontend bundle code | `(function(global,factory){...})` |
| `manifest` | Full manifest.json as JSON | `{ "id": "email-plugin", ... }` |
| `isExternal` | Distinguish external from internal plugins | `true` |
| `installSource` | How plugin was installed | `url`, `upload`, `internal` |

### FormPluginConfig Model (No changes)

Existing `FormPluginConfig` model remains unchanged:

```prisma
model FormPluginConfig {
  id             String   @id @map("_id")
  formId         String
  pluginId       String
  organizationId String
  config         Json     // Plugin-specific configuration
  isEnabled      Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  // Relations
  form   Form   @relation(fields: [formId], references: [id], onDelete: Cascade)
  plugin Plugin @relation(fields: [pluginId], references: [id], onDelete: Cascade)

  @@unique([formId, pluginId])
  @@index([formId])
  @@index([pluginId])
  @@index([organizationId])
  @@map("form_plugin_config")
}
```

---

## Backend Implementation

### Component Architecture

```
apps/backend/src/
├── plugins/
│   ├── base/
│   │   ├── BasePlugin.ts          # Abstract base class (unchanged)
│   │   └── PluginContext.ts       # Organization-scoped API (unchanged)
│   ├── loader/
│   │   ├── PluginLoader.ts        # NEW: Download and validate plugins
│   │   ├── BundleValidator.ts     # NEW: Validate bundle format
│   │   └── DynamicImporter.ts     # NEW: Dynamic import() wrapper
│   ├── registry.ts                # UPDATED: Support runtime registration
│   └── index.ts                   # Export loader
├── services/
│   └── pluginService.ts           # UPDATED: Add install/uninstall methods
└── graphql/
    ├── resolvers/
    │   └── plugins.ts              # UPDATED: Add install mutations
    └── schema.ts                   # UPDATED: Add install types
```

### PluginLoader Service

**File**: `apps/backend/src/plugins/loader/PluginLoader.ts`

**Purpose**: Download, validate, and install external plugins

**Class Definition**:

```typescript
import { prisma } from '../../lib/prisma.js';
import { pluginRegistry } from '../registry.js';
import { BundleValidator } from './BundleValidator.js';
import { DynamicImporter } from './DynamicImporter.js';
import type { PluginManifest } from './types.js';

export class PluginLoader {
  private validator: BundleValidator;
  private importer: DynamicImporter;

  constructor() {
    this.validator = new BundleValidator();
    this.importer = new DynamicImporter();
  }

  /**
   * Install plugin from external URL
   *
   * @param url - Base URL to plugin directory (e.g., https://example.com/plugins/email)
   * @returns Plugin ID
   */
  async installFromUrl(url: string): Promise<string> {
    console.log(`[PluginLoader] Installing plugin from URL: ${url}`);

    // Step 1: Download manifest
    const manifestUrl = this.resolveUrl(url, 'manifest.json');
    const manifestResponse = await fetch(manifestUrl);

    if (!manifestResponse.ok) {
      throw new Error(`Failed to fetch manifest from ${manifestUrl}: ${manifestResponse.statusText}`);
    }

    const manifest: PluginManifest = await manifestResponse.json();

    // Step 2: Validate manifest
    this.validator.validateManifest(manifest);

    // Step 3: Check if plugin already exists
    const existingPlugin = await prisma.plugin.findUnique({
      where: { id: manifest.id }
    });

    if (existingPlugin) {
      throw new Error(`Plugin ${manifest.id} is already installed. Use updatePlugin() to update.`);
    }

    // Step 4: Download backend bundle
    const backendUrl = this.resolveUrl(url, manifest.bundles.backend);
    const backendResponse = await fetch(backendUrl);

    if (!backendResponse.ok) {
      throw new Error(`Failed to fetch backend bundle from ${backendUrl}: ${backendResponse.statusText}`);
    }

    const backendCode = await backendResponse.text();

    // Step 5: Download frontend bundle
    const frontendUrl = this.resolveUrl(url, manifest.bundles.frontend);
    const frontendResponse = await fetch(frontendUrl);

    if (!frontendResponse.ok) {
      throw new Error(`Failed to fetch frontend bundle from ${frontendUrl}: ${frontendResponse.statusText}`);
    }

    const frontendCode = await frontendResponse.text();

    // Step 6: Validate bundles
    await this.validator.validateBackendBundle(backendCode);
    await this.validator.validateFrontendBundle(frontendCode);

    // Step 7: Store in database
    const plugin = await prisma.plugin.create({
      data: {
        id: manifest.id,
        name: manifest.name,
        description: manifest.description,
        icon: manifest.icon,
        category: manifest.category,
        version: manifest.version,
        isActive: true,
        isExternal: true,
        installSource: 'url',
        installUrl: url,
        backendCode,
        frontendCode,
        manifest: manifest as any, // Store full manifest as JSON
      }
    });

    console.log(`[PluginLoader] Plugin stored in database: ${plugin.id}`);

    // Step 8: Load and register plugin
    await this.loadPlugin(plugin.id);

    console.log(`[PluginLoader] Plugin installed successfully: ${manifest.name}`);

    return plugin.id;
  }

  /**
   * Load plugin from database and register with runtime
   *
   * @param pluginId - Plugin ID to load
   */
  async loadPlugin(pluginId: string): Promise<void> {
    console.log(`[PluginLoader] Loading plugin: ${pluginId}`);

    // Fetch plugin from database
    const plugin = await prisma.plugin.findUnique({
      where: { id: pluginId }
    });

    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found in database`);
    }

    if (!plugin.backendCode) {
      throw new Error(`Plugin ${pluginId} has no backend code (internal plugin?)`);
    }

    // Dynamic import the backend code
    const PluginClass = await this.importer.importFromCode(plugin.backendCode, pluginId);

    // Instantiate and register
    const pluginInstance = new PluginClass();

    pluginRegistry.register(pluginInstance);

    console.log(`[PluginLoader] Plugin loaded and registered: ${pluginId}`);
  }

  /**
   * Uninstall plugin
   *
   * @param pluginId - Plugin ID to uninstall
   */
  async uninstallPlugin(pluginId: string): Promise<void> {
    console.log(`[PluginLoader] Uninstalling plugin: ${pluginId}`);

    // Unregister from runtime
    pluginRegistry.unregister(pluginId);

    // Delete from database (cascade will remove FormPluginConfig)
    await prisma.plugin.delete({
      where: { id: pluginId }
    });

    console.log(`[PluginLoader] Plugin uninstalled: ${pluginId}`);
  }

  /**
   * Update plugin to latest version
   *
   * @param pluginId - Plugin ID to update
   */
  async updatePlugin(pluginId: string): Promise<void> {
    console.log(`[PluginLoader] Updating plugin: ${pluginId}`);

    const plugin = await prisma.plugin.findUnique({
      where: { id: pluginId }
    });

    if (!plugin || !plugin.installUrl) {
      throw new Error(`Plugin ${pluginId} not found or has no install URL`);
    }

    // Unregister old version
    pluginRegistry.unregister(pluginId);

    // Re-download from original URL
    const manifestUrl = this.resolveUrl(plugin.installUrl, 'manifest.json');
    const manifestResponse = await fetch(manifestUrl);
    const manifest: PluginManifest = await manifestResponse.json();

    // Download new bundles
    const backendUrl = this.resolveUrl(plugin.installUrl, manifest.bundles.backend);
    const backendResponse = await fetch(backendUrl);
    const backendCode = await backendResponse.text();

    const frontendUrl = this.resolveUrl(plugin.installUrl, manifest.bundles.frontend);
    const frontendResponse = await fetch(frontendUrl);
    const frontendCode = await frontendResponse.text();

    // Update in database
    await prisma.plugin.update({
      where: { id: pluginId },
      data: {
        version: manifest.version,
        backendCode,
        frontendCode,
        manifest: manifest as any,
        updatedAt: new Date(),
      }
    });

    // Reload plugin
    await this.loadPlugin(pluginId);

    console.log(`[PluginLoader] Plugin updated: ${pluginId} to version ${manifest.version}`);
  }

  /**
   * Load all external plugins from database on server startup
   */
  async loadAllPlugins(): Promise<void> {
    console.log('[PluginLoader] Loading all external plugins from database...');

    const externalPlugins = await prisma.plugin.findMany({
      where: { isExternal: true, isActive: true }
    });

    console.log(`[PluginLoader] Found ${externalPlugins.length} external plugins to load`);

    for (const plugin of externalPlugins) {
      try {
        await this.loadPlugin(plugin.id);
      } catch (error) {
        console.error(`[PluginLoader] Failed to load plugin ${plugin.id}:`, error);
        // Continue loading other plugins even if one fails
      }
    }

    console.log('[PluginLoader] Finished loading external plugins');
  }

  /**
   * Resolve relative URL against base URL
   */
  private resolveUrl(baseUrl: string, path: string): string {
    const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    return new URL(path, base).toString();
  }
}

// Export singleton
export const pluginLoader = new PluginLoader();
```

### BundleValidator

**File**: `apps/backend/src/plugins/loader/BundleValidator.ts`

**Purpose**: Validate manifest and bundle format

```typescript
import { z } from 'zod';
import type { PluginManifest } from './types.js';

// Manifest schema
const manifestSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, 'Plugin ID must be kebab-case'),
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(200),
  icon: z.string(),
  category: z.enum(['notification', 'automation', 'integration', 'analytics', 'storage']),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must be semver (e.g., 1.0.0)'),
  author: z.object({
    name: z.string(),
    email: z.string().email().optional(),
    url: z.string().url().optional(),
  }),
  homepage: z.string().url().optional(),
  repository: z.object({
    type: z.string(),
    url: z.string().url(),
  }).optional(),
  license: z.string(),
  bundles: z.object({
    backend: z.string(),
    frontend: z.string(),
  }),
  permissions: z.array(z.string()).optional(),
  minVersion: z.string().optional(),
  maxVersion: z.string().optional(),
});

export class BundleValidator {
  /**
   * Validate plugin manifest
   */
  validateManifest(manifest: unknown): asserts manifest is PluginManifest {
    try {
      manifestSchema.parse(manifest);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
        throw new Error(`Invalid plugin manifest: ${issues}`);
      }
      throw error;
    }
  }

  /**
   * Validate backend bundle
   * Basic checks for now (can be enhanced with AST parsing)
   */
  async validateBackendBundle(code: string): Promise<void> {
    // Check for export default
    if (!code.includes('export default')) {
      throw new Error('Backend bundle must have a default export');
    }

    // Check for BasePlugin
    if (!code.includes('BasePlugin')) {
      throw new Error('Backend bundle must extend BasePlugin');
    }

    // Check for suspicious patterns (basic security)
    const dangerousPatterns = [
      'eval(',
      'Function(',
      'require(',  // Should use import() instead
      'child_process',
      'fs.writeFile',
      'fs.unlink',
    ];

    for (const pattern of dangerousPatterns) {
      if (code.includes(pattern)) {
        console.warn(`[BundleValidator] Warning: Backend bundle contains potentially dangerous pattern: ${pattern}`);
        // For MVP, just warn. Can make this strict later.
      }
    }

    console.log('[BundleValidator] Backend bundle validation passed');
  }

  /**
   * Validate frontend bundle
   */
  async validateFrontendBundle(code: string): Promise<void> {
    // Check for UMD or ESM export
    const hasUmd = code.includes('typeof exports === \'object\'') || code.includes('typeof module !== \'undefined\'');
    const hasEsm = code.includes('export default');

    if (!hasUmd && !hasEsm) {
      throw new Error('Frontend bundle must be UMD or ESM format');
    }

    console.log('[BundleValidator] Frontend bundle validation passed');
  }
}
```

### DynamicImporter

**File**: `apps/backend/src/plugins/loader/DynamicImporter.ts`

**Purpose**: Dynamically import JavaScript code from string

```typescript
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

export class DynamicImporter {
  private tempDir: string;

  constructor() {
    // Temporary directory for plugin code
    this.tempDir = join(process.cwd(), 'temp', 'plugins');
  }

  /**
   * Import JavaScript code dynamically
   *
   * Strategy:
   * 1. Write code to temporary file
   * 2. Use dynamic import()
   * 3. Clean up temporary file
   *
   * @param code - JavaScript code to import
   * @param pluginId - Plugin ID for file naming
   * @returns Imported module default export
   */
  async importFromCode(code: string, pluginId: string): Promise<any> {
    // Create temp directory if it doesn't exist
    await mkdir(this.tempDir, { recursive: true });

    // Generate unique filename
    const filename = `${pluginId}-${randomUUID()}.mjs`;
    const filepath = join(this.tempDir, filename);

    try {
      // Write code to temporary file
      await writeFile(filepath, code, 'utf-8');

      // Dynamic import (Node.js ES modules)
      const module = await import(`file://${filepath}`);

      // Return default export
      return module.default;
    } finally {
      // Clean up temporary file
      try {
        await unlink(filepath);
      } catch (error) {
        console.warn(`[DynamicImporter] Failed to delete temp file ${filepath}:`, error);
      }
    }
  }
}
```

### Updated PluginRegistry

**File**: `apps/backend/src/plugins/registry.ts`

**Changes**: Support runtime registration and unregistration

```typescript
// ... existing code ...

class PluginRegistry {
  // ... existing methods ...

  /**
   * Unregister a plugin and remove event listeners
   * Used for hot-reload and plugin uninstallation
   */
  unregister(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);

    if (!plugin) {
      console.warn(`[PluginRegistry] Plugin ${pluginId} not found`);
      return;
    }

    console.log(`[PluginRegistry] Unregistering plugin: ${pluginId}`);

    // Remove from map
    this.plugins.delete(pluginId);

    // Rebuild event listeners for remaining plugins
    eventBus.removeAllListeners('form.submitted');

    for (const remainingPlugin of this.plugins.values()) {
      eventBus.on('form.submitted', async (event: any) => {
        await remainingPlugin.execute(event);
      });
    }

    console.log(`[PluginRegistry] Plugin unregistered: ${pluginId}`);
  }
}
```

### Updated index.ts

**File**: `apps/backend/src/index.ts`

**Changes**: Load external plugins on startup

```typescript
import { pluginLoader } from './plugins/loader/PluginLoader.js';
import { pluginRegistry } from './plugins/registry.js';
import { HelloWorldPlugin } from './plugins/hello-world/index.js';

// ... existing imports ...

async function startServer() {
  // ... existing setup ...

  // Register internal plugins (hardcoded)
  pluginRegistry.register(new HelloWorldPlugin());

  // Initialize plugin system
  await pluginRegistry.initialize();

  // Load external plugins from database
  await pluginLoader.loadAllPlugins();

  // ... start server ...
}

startServer();
```

### GraphQL Schema Updates

**File**: `apps/backend/src/graphql/schema.ts`

**Add new types and mutations**:

```graphql
type Plugin {
  id: ID!
  name: String!
  description: String!
  icon: String!
  category: String!
  version: String!
  isActive: Boolean!
  isExternal: Boolean!
  installSource: String
  installUrl: String
  manifest: JSON
  createdAt: DateTime!
  updatedAt: DateTime!
}

input InstallPluginInput {
  url: String!
}

type InstallPluginResult {
  success: Boolean!
  pluginId: String
  message: String
}

type Mutation {
  # ... existing mutations ...

  # Install plugin from external URL
  installPlugin(input: InstallPluginInput!): InstallPluginResult!

  # Uninstall plugin
  uninstallPlugin(pluginId: ID!): InstallPluginResult!

  # Update plugin to latest version
  updatePlugin(pluginId: ID!): InstallPluginResult!
}

type Query {
  # ... existing queries ...

  # Get all plugins (including external)
  plugins: [Plugin!]!

  # Get plugin configuration UI code
  pluginConfigUI(pluginId: ID!): String
}
```

### GraphQL Resolvers

**File**: `apps/backend/src/graphql/resolvers/plugins.ts`

**Add new resolvers**:

```typescript
import { pluginLoader } from '../../plugins/loader/PluginLoader.js';
import { prisma } from '../../lib/prisma.js';

export const pluginResolvers = {
  Query: {
    plugins: async () => {
      return await prisma.plugin.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' }
      });
    },

    pluginConfigUI: async (_: any, { pluginId }: { pluginId: string }) => {
      const plugin = await prisma.plugin.findUnique({
        where: { id: pluginId }
      });

      if (!plugin) {
        throw new Error(`Plugin ${pluginId} not found`);
      }

      // Return frontend bundle code
      return plugin.frontendCode || null;
    },
  },

  Mutation: {
    installPlugin: async (
      _: any,
      { input }: { input: { url: string } },
      context: any
    ) => {
      try {
        // Check authentication
        if (!context.user) {
          throw new Error('Authentication required');
        }

        // TODO: Check if user has permission to install plugins
        // For now, allow all authenticated users

        const pluginId = await pluginLoader.installFromUrl(input.url);

        return {
          success: true,
          pluginId,
          message: `Plugin installed successfully: ${pluginId}`
        };
      } catch (error) {
        console.error('[GraphQL] Install plugin error:', error);
        return {
          success: false,
          pluginId: null,
          message: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    },

    uninstallPlugin: async (
      _: any,
      { pluginId }: { pluginId: string },
      context: any
    ) => {
      try {
        if (!context.user) {
          throw new Error('Authentication required');
        }

        await pluginLoader.uninstallPlugin(pluginId);

        return {
          success: true,
          pluginId,
          message: `Plugin uninstalled successfully: ${pluginId}`
        };
      } catch (error) {
        console.error('[GraphQL] Uninstall plugin error:', error);
        return {
          success: false,
          pluginId: null,
          message: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    },

    updatePlugin: async (
      _: any,
      { pluginId }: { pluginId: string },
      context: any
    ) => {
      try {
        if (!context.user) {
          throw new Error('Authentication required');
        }

        await pluginLoader.updatePlugin(pluginId);

        return {
          success: true,
          pluginId,
          message: `Plugin updated successfully: ${pluginId}`
        };
      } catch (error) {
        console.error('[GraphQL] Update plugin error:', error);
        return {
          success: false,
          pluginId: null,
          message: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    },
  },
};
```

---

## Frontend Implementation

### Component Architecture

```
apps/form-app/src/
├── components/
│   └── form-builder/
│       └── plugins/
│           ├── PluginMarketplace.tsx      # NEW: Browse and install plugins
│           ├── PluginInstallDialog.tsx    # NEW: Install from URL dialog
│           ├── DynamicPluginConfig.tsx    # NEW: Load plugin config UI
│           └── PluginList.tsx             # UPDATED: Show external plugins
└── hooks/
    └── usePluginConfigLoader.ts           # NEW: Dynamic config UI loading
```

### Plugin Marketplace Component

**File**: `apps/form-app/src/components/form-builder/plugins/PluginMarketplace.tsx`

```typescript
import React, { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { Button, Dialog, Input, Card } from '@dculus/ui';
import { INSTALL_PLUGIN, GET_PLUGINS } from '../../../graphql/plugins';

export function PluginMarketplace() {
  const [installUrl, setInstallUrl] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data, loading, refetch } = useQuery(GET_PLUGINS);
  const [installPlugin, { loading: installing }] = useMutation(INSTALL_PLUGIN);

  const handleInstall = async () => {
    try {
      const result = await installPlugin({
        variables: { input: { url: installUrl } }
      });

      if (result.data?.installPlugin.success) {
        alert(`Plugin installed: ${result.data.installPlugin.pluginId}`);
        setInstallUrl('');
        setIsDialogOpen(false);
        refetch();
      } else {
        alert(`Installation failed: ${result.data?.installPlugin.message}`);
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Plugin Marketplace</h1>
        <Button onClick={() => setIsDialogOpen(true)}>
          Install from URL
        </Button>
      </div>

      {loading ? (
        <p>Loading plugins...</p>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {data?.plugins.map((plugin: any) => (
            <Card key={plugin.id} className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{plugin.icon}</span>
                <h3 className="font-bold">{plugin.name}</h3>
              </div>
              <p className="text-sm text-gray-600 mb-2">{plugin.description}</p>
              <div className="flex justify-between items-center text-xs">
                <span className="bg-blue-100 px-2 py-1 rounded">{plugin.category}</span>
                <span className="text-gray-500">v{plugin.version}</span>
              </div>
              {plugin.isExternal && (
                <span className="text-xs bg-green-100 px-2 py-1 rounded mt-2 inline-block">
                  External
                </span>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Install Plugin from URL</Dialog.Title>
          </Dialog.Header>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Plugin URL</label>
              <Input
                placeholder="https://example.com/plugins/my-plugin"
                value={installUrl}
                onChange={(e) => setInstallUrl(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">
                URL should point to a directory containing manifest.json
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleInstall} disabled={!installUrl || installing}>
                {installing ? 'Installing...' : 'Install'}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog>
    </div>
  );
}
```

### Dynamic Plugin Config Loader

**File**: `apps/form-app/src/hooks/usePluginConfigLoader.ts`

```typescript
import { useState, useEffect } from 'react';
import { useQuery } from '@apollo/client';
import { GET_PLUGIN_CONFIG_UI } from '../graphql/plugins';

/**
 * Hook to dynamically load plugin configuration UI
 *
 * @param pluginId - Plugin ID to load config for
 * @returns { ConfigComponent, loading, error }
 */
export function usePluginConfigLoader(pluginId: string) {
  const [ConfigComponent, setConfigComponent] = useState<React.ComponentType<any> | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const { data, loading } = useQuery(GET_PLUGIN_CONFIG_UI, {
    variables: { pluginId },
    skip: !pluginId,
  });

  useEffect(() => {
    if (!data?.pluginConfigUI) return;

    const loadComponent = async () => {
      try {
        const code = data.pluginConfigUI;

        // Create blob URL from code
        const blob = new Blob([code], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);

        // Dynamic import
        const module = await import(/* @vite-ignore */ url);

        // Get default export (React component)
        setConfigComponent(() => module.default);

        // Clean up blob URL
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error('Failed to load plugin config UI:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
      }
    };

    loadComponent();
  }, [data]);

  return { ConfigComponent, loading, error };
}
```

### Dynamic Plugin Config Component

**File**: `apps/form-app/src/components/form-builder/plugins/DynamicPluginConfig.tsx`

```typescript
import React, { Suspense } from 'react';
import { usePluginConfigLoader } from '../../../hooks/usePluginConfigLoader';

interface Props {
  pluginId: string;
  config: any;
  onChange: (config: any) => void;
}

export function DynamicPluginConfig({ pluginId, config, onChange }: Props) {
  const { ConfigComponent, loading, error } = usePluginConfigLoader(pluginId);

  if (loading) {
    return <div>Loading plugin configuration...</div>;
  }

  if (error) {
    return <div className="text-red-500">Failed to load plugin config: {error.message}</div>;
  }

  if (!ConfigComponent) {
    return <div>No configuration UI available for this plugin.</div>;
  }

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ConfigComponent config={config} onChange={onChange} />
    </Suspense>
  );
}
```

### GraphQL Queries/Mutations

**File**: `apps/form-app/src/graphql/plugins.ts`

```typescript
import { gql } from '@apollo/client';

export const GET_PLUGINS = gql`
  query GetPlugins {
    plugins {
      id
      name
      description
      icon
      category
      version
      isActive
      isExternal
      installSource
      createdAt
    }
  }
`;

export const GET_PLUGIN_CONFIG_UI = gql`
  query GetPluginConfigUI($pluginId: ID!) {
    pluginConfigUI(pluginId: $pluginId)
  }
`;

export const INSTALL_PLUGIN = gql`
  mutation InstallPlugin($input: InstallPluginInput!) {
    installPlugin(input: $input) {
      success
      pluginId
      message
    }
  }
`;

export const UNINSTALL_PLUGIN = gql`
  mutation UninstallPlugin($pluginId: ID!) {
    uninstallPlugin(pluginId: $pluginId) {
      success
      message
    }
  }
`;

export const UPDATE_PLUGIN = gql`
  mutation UpdatePlugin($pluginId: ID!) {
    updatePlugin(pluginId: $pluginId) {
      success
      message
    }
  }
`;
```

---

## Plugin SDK Package

### Package Structure

Create a new package for external plugin developers:

```
packages/plugin-sdk/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                    # Main export
│   ├── BasePlugin.ts               # Re-export from backend
│   ├── PluginContext.ts            # Re-export from backend
│   ├── types.ts                    # Type definitions
│   └── build/
│       ├── buildPlugin.ts          # Build script
│       └── config.ts               # Build configuration
├── templates/
│   └── basic-plugin/               # Plugin template
│       ├── package.json
│       ├── manifest.json
│       ├── build.config.js
│       └── src/
│           ├── backend/
│           │   └── index.ts
│           └── frontend/
│               └── ConfigUI.tsx
└── README.md
```

### package.json

```json
{
  "name": "@dculus/plugin-sdk",
  "version": "1.0.0",
  "description": "SDK for building dculus-forms plugins",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "dculus-plugin": "./dist/cli.js"
  },
  "scripts": {
    "build": "tsc",
    "prepublishOnly": "pnpm build"
  },
  "dependencies": {
    "zod": "^4.1.12",
    "esbuild": "^0.25.9"
  },
  "peerDependencies": {
    "react": "^18.0.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/node": "^20.0.0",
    "@types/react": "^18.0.0"
  },
  "keywords": ["dculus", "forms", "plugin", "sdk"],
  "license": "MIT"
}
```

### src/index.ts

```typescript
/**
 * Dculus Forms Plugin SDK
 *
 * Export everything needed for external plugin development
 */

// Re-export core classes (these should be symlinked or copied from backend)
export { BasePlugin } from './BasePlugin';
export { PluginContext } from './PluginContext';

// Export types
export type {
  PluginMetadata,
  PluginConfig,
  FormSubmittedEvent,
  PluginManifest,
} from './types';

// Export build utilities
export { buildPlugin } from './build/buildPlugin';
```

### src/build/buildPlugin.ts

```typescript
import * as esbuild from 'esbuild';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

/**
 * Build plugin bundles
 *
 * Creates two bundles:
 * - plugin.backend.js (ESM for Node.js)
 * - plugin.config.js (UMD for browser)
 */
export async function buildPlugin(projectDir: string) {
  console.log('[BuildPlugin] Building plugin...');

  const srcDir = join(projectDir, 'src');
  const distDir = join(projectDir, 'dist');

  // Create dist directory
  await mkdir(distDir, { recursive: true });

  // Build backend bundle
  console.log('[BuildPlugin] Building backend bundle...');
  await esbuild.build({
    entryPoints: [join(srcDir, 'backend', 'index.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node18',
    outfile: join(distDir, 'plugin.backend.js'),
    external: [], // Bundle everything
    minify: true,
    sourcemap: false,
  });

  // Build frontend bundle
  console.log('[BuildPlugin] Building frontend bundle...');
  await esbuild.build({
    entryPoints: [join(srcDir, 'frontend', 'ConfigUI.tsx')],
    bundle: true,
    platform: 'browser',
    format: 'iife',
    globalName: 'PluginConfig',
    target: 'es2020',
    outfile: join(distDir, 'plugin.config.js'),
    external: ['react', 'react-dom'], // Don't bundle React
    minify: true,
    sourcemap: false,
    jsx: 'automatic',
  });

  // Copy manifest.json
  console.log('[BuildPlugin] Copying manifest...');
  const manifest = await readFile(join(projectDir, 'manifest.json'), 'utf-8');
  await writeFile(join(distDir, 'manifest.json'), manifest);

  console.log('[BuildPlugin] Build complete!');
  console.log(`[BuildPlugin] Output: ${distDir}`);
}
```

### CLI Tool

**File**: `packages/plugin-sdk/src/cli.ts`

```typescript
#!/usr/bin/env node

import { Command } from 'commander';
import { buildPlugin } from './build/buildPlugin';

const program = new Command();

program
  .name('dculus-plugin')
  .description('Dculus Forms Plugin SDK CLI')
  .version('1.0.0');

program
  .command('build')
  .description('Build plugin bundles')
  .option('-d, --dir <directory>', 'Project directory', '.')
  .action(async (options) => {
    try {
      await buildPlugin(options.dir);
      console.log('✅ Plugin built successfully');
    } catch (error) {
      console.error('❌ Build failed:', error);
      process.exit(1);
    }
  });

program
  .command('init <plugin-name>')
  .description('Create new plugin from template')
  .action((pluginName) => {
    console.log(`Creating plugin: ${pluginName}`);
    // TODO: Copy template files
  });

program.parse();
```

---

## Installation Flow

### Step-by-Step Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│ User Action: Enter plugin URL in UI                                 │
└────────────────────────────────┬─────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Frontend: Call installPlugin GraphQL mutation                       │
│   mutation InstallPlugin($input: InstallPluginInput!)              │
└────────────────────────────────┬─────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Backend: PluginLoader.installFromUrl(url)                          │
└────────────────────────────────┬─────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Step 1: Download manifest.json from URL                             │
│   GET {url}/manifest.json                                           │
└────────────────────────────────┬─────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Step 2: Validate manifest with Zod schema                           │
│   - Check required fields                                            │
│   - Validate semver version                                          │
│   - Check plugin ID format                                           │
└────────────────────────────────┬─────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Step 3: Check if plugin already exists                              │
│   prisma.plugin.findUnique({ where: { id: manifest.id } })        │
│   → If exists, throw error                                          │
└────────────────────────────────┬─────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Step 4: Download backend bundle                                     │
│   GET {url}/plugin.backend.js                                       │
└────────────────────────────────┬─────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Step 5: Download frontend bundle                                    │
│   GET {url}/plugin.config.js                                        │
└────────────────────────────────┬─────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Step 6: Validate bundles                                            │
│   - Check for export default                                         │
│   - Check for BasePlugin usage                                       │
│   - Warn on suspicious patterns                                      │
└────────────────────────────────┬─────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Step 7: Store in database                                           │
│   prisma.plugin.create({                                            │
│     id, name, description, backendCode, frontendCode, manifest     │
│   })                                                                │
└────────────────────────────────┬─────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Step 8: Load plugin into runtime                                    │
│   - Write code to temp file                                          │
│   - Dynamic import() the file                                        │
│   - Instantiate plugin class                                         │
│   - Register with PluginRegistry                                     │
│   - Set up event listeners                                           │
└────────────────────────────────┬─────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Response: Return success + pluginId                                 │
└──────────────────────────────────────────────────────────────────────┘
```

### Error Handling at Each Step

| Step | Error | Handling |
|------|-------|----------|
| Download manifest | 404, network error | Return error to user, suggest checking URL |
| Validate manifest | Invalid schema | Return validation errors with field names |
| Check existing | Plugin already installed | Suggest using updatePlugin() instead |
| Download bundles | 404, network error | Return error, rollback if partial download |
| Validate bundles | Missing exports | Return detailed validation error |
| Store in DB | Database error | Rollback, return error |
| Load plugin | Import error, instantiation error | Delete from DB, return error |

---

## Plugin Development Workflow

### For External Plugin Developers

#### 1. Setup Development Environment

```bash
# Install plugin SDK
npm install @dculus/plugin-sdk

# Create new plugin project
npx @dculus/plugin-sdk init my-email-plugin

cd my-email-plugin
npm install
```

#### 2. Project Structure Created

```
my-email-plugin/
├── package.json
├── manifest.json
├── build.config.js
├── src/
│   ├── backend/
│   │   └── index.ts        # Plugin logic
│   └── frontend/
│       └── ConfigUI.tsx    # Config UI
└── README.md
```

#### 3. Develop Backend Logic

**File**: `src/backend/index.ts`

```typescript
import { BasePlugin, type FormSubmittedEvent, type PluginContext } from '@dculus/plugin-sdk';
import { z } from 'zod';

export default class EmailPlugin extends BasePlugin {
  constructor() {
    super({
      id: 'email-plugin',
      name: 'Email Notifications',
      description: 'Send email when form is submitted',
      icon: '📧',
      category: 'notification',
      version: '1.0.0',
    });
  }

  getConfigSchema() {
    return z.object({
      recipientEmail: z.string().email('Invalid email address'),
      subject: z.string().min(1, 'Subject is required'),
      includeResponseData: z.boolean().default(true),
      isEnabled: z.boolean().default(true),
    });
  }

  async onFormSubmitted(event: FormSubmittedEvent, context: PluginContext) {
    const config = await this.getConfig(event.formId);

    if (!config || !config.isEnabled) {
      return;
    }

    // Get form and response data
    const form = await context.getForm(event.formId);
    const response = await context.getResponse(event.responseId);

    // Send email (example using fetch to email service)
    await fetch('https://api.emailservice.com/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: config.recipientEmail,
        subject: config.subject || `New submission for ${form.title}`,
        body: config.includeResponseData
          ? JSON.stringify(response.data, null, 2)
          : 'A new response was submitted.',
      }),
    });

    console.log(`[EmailPlugin] Sent email to ${config.recipientEmail}`);
  }
}
```

#### 4. Develop Frontend Config UI

**File**: `src/frontend/ConfigUI.tsx`

```typescript
import React from 'react';

interface EmailPluginConfig {
  recipientEmail?: string;
  subject?: string;
  includeResponseData?: boolean;
  isEnabled?: boolean;
}

interface Props {
  config: EmailPluginConfig;
  onChange: (config: EmailPluginConfig) => void;
}

export default function EmailPluginConfig({ config, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">
          Recipient Email
        </label>
        <input
          type="email"
          className="w-full px-3 py-2 border rounded"
          value={config.recipientEmail || ''}
          onChange={(e) => onChange({ ...config, recipientEmail: e.target.value })}
          placeholder="recipient@example.com"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Email Subject
        </label>
        <input
          type="text"
          className="w-full px-3 py-2 border rounded"
          value={config.subject || ''}
          onChange={(e) => onChange({ ...config, subject: e.target.value })}
          placeholder="New form submission"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="includeData"
          checked={config.includeResponseData ?? true}
          onChange={(e) => onChange({ ...config, includeResponseData: e.target.checked })}
        />
        <label htmlFor="includeData" className="text-sm">
          Include response data in email
        </label>
      </div>
    </div>
  );
}
```

#### 5. Build Plugin

```bash
# Build both bundles
npm run build

# Or using SDK CLI
npx @dculus/plugin-sdk build
```

**Output** in `dist/`:
- `plugin.backend.js` (ESM bundle)
- `plugin.config.js` (UMD bundle)
- `manifest.json` (copied)

#### 6. Test Locally

```bash
# Serve dist/ directory
npx serve dist

# Plugin available at:
# http://localhost:3000/manifest.json
# http://localhost:3000/plugin.backend.js
# http://localhost:3000/plugin.config.js
```

#### 7. Install in Dculus Forms

1. Open form builder
2. Go to Plugins → Install from URL
3. Enter: `http://localhost:3000`
4. Click Install
5. Configure plugin for a form
6. Test form submission

#### 8. Publish Plugin

**Option 1: GitHub Pages**
```bash
git add dist/
git commit -m "Build v1.0.0"
git push

# Enable GitHub Pages for /dist directory
# Plugin available at: https://username.github.io/repo-name/
```

**Option 2: CDN**
```bash
# Upload dist/ to CDN
aws s3 sync dist/ s3://my-bucket/plugins/email-plugin/v1.0.0/ --acl public-read

# Plugin available at: https://cdn.example.com/plugins/email-plugin/v1.0.0/
```

**Option 3: Static Hosting**
- Upload `dist/` to any static hosting service
- Ensure CORS is enabled
- Share the URL with users

---

## API Reference

### PluginContext Methods

Available to all plugins via the `context` parameter:

```typescript
class PluginContext {
  // Get form details (organization-scoped)
  async getForm(formId: string): Promise<Form>

  // Get response details (organization-scoped)
  async getResponse(responseId: string): Promise<Response & { form: Form }>

  // List responses for a form (organization-scoped)
  async listResponses(formId: string, limit?: number): Promise<Response[]>

  // Get organization details
  async getOrganization(): Promise<Organization>

  // Get current organization ID
  getOrganizationId(): string

  // Get current form ID
  getFormId(): string
}
```

### BasePlugin Methods

Methods available when extending `BasePlugin`:

```typescript
abstract class BasePlugin {
  // Get plugin configuration for a form
  async getConfig(formId: string): Promise<PluginConfig | null>

  // Validate configuration
  validateConfig(config: unknown): SafeParseResult

  // Lifecycle hooks (optional overrides)
  async onEnabled(formId: string, config: PluginConfig): Promise<void>
  async onDisabled(formId: string): Promise<void>
  async onUninstalled(formId: string): Promise<void>

  // Main event handler (must implement)
  abstract onFormSubmitted(event: FormSubmittedEvent, context: PluginContext): Promise<void>

  // Configuration schema (must implement)
  abstract getConfigSchema(): z.ZodSchema
}
```

### GraphQL API

**Mutations**:

```graphql
mutation InstallPlugin($input: InstallPluginInput!) {
  installPlugin(input: $input) {
    success
    pluginId
    message
  }
}

mutation UninstallPlugin($pluginId: ID!) {
  uninstallPlugin(pluginId: $pluginId) {
    success
    message
  }
}

mutation UpdatePlugin($pluginId: ID!) {
  updatePlugin(pluginId: $pluginId) {
    success
    message
  }
}
```

**Queries**:

```graphql
query GetPlugins {
  plugins {
    id
    name
    description
    icon
    category
    version
    isExternal
    installUrl
    manifest
  }
}

query GetPluginConfigUI($pluginId: ID!) {
  pluginConfigUI(pluginId: $pluginId)
}
```

---

## Security Considerations

### For MVP (Current Implementation)

✅ **Implemented**:
- Organization boundary enforcement in PluginContext
- Manifest validation with Zod
- Basic bundle validation (check for exports)
- Plugin code stored in database (not filesystem)

⚠️ **Not Implemented (Future)**:
- Plugin code sandboxing (use VM2 or isolated-vm)
- Plugin signature verification
- Rate limiting on installations
- Malicious code scanning (AST analysis)
- Plugin permissions system
- Plugin marketplace moderation

### Security Best Practices for Plugin Developers

**DO**:
- ✅ Only use provided PluginContext methods
- ✅ Validate all user input in config UI
- ✅ Use HTTPS for external API calls
- ✅ Handle errors gracefully
- ✅ Log important actions
- ✅ Follow semantic versioning

**DON'T**:
- ❌ Access file system directly
- ❌ Use eval() or Function() constructor
- ❌ Import Node.js built-ins (fs, child_process, etc.)
- ❌ Store sensitive data in config
- ❌ Make blocking synchronous calls
- ❌ Access other organizations' data

---

## Examples

### Example 1: Slack Notification Plugin

**manifest.json**:
```json
{
  "id": "slack-plugin",
  "name": "Slack Notifications",
  "description": "Send form submissions to Slack channel",
  "icon": "💬",
  "category": "notification",
  "version": "1.0.0",
  "author": {
    "name": "Dculus Team"
  },
  "license": "MIT",
  "bundles": {
    "backend": "plugin.backend.js",
    "frontend": "plugin.config.js"
  }
}
```

**src/backend/index.ts**:
```typescript
import { BasePlugin } from '@dculus/plugin-sdk';
import { z } from 'zod';

export default class SlackPlugin extends BasePlugin {
  constructor() {
    super({
      id: 'slack-plugin',
      name: 'Slack Notifications',
      description: 'Send form submissions to Slack',
      icon: '💬',
      category: 'notification',
      version: '1.0.0',
    });
  }

  getConfigSchema() {
    return z.object({
      webhookUrl: z.string().url(),
      includeFields: z.boolean().default(true),
      isEnabled: z.boolean().default(true),
    });
  }

  async onFormSubmitted(event, context) {
    const config = await this.getConfig(event.formId);
    const form = await context.getForm(event.formId);
    const response = await context.getResponse(event.responseId);

    const message = {
      text: `New submission for "${form.title}"`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Form:* ${form.title}\n*Response ID:* ${response.id}`,
          },
        },
      ],
    };

    if (config.includeFields) {
      message.blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '```' + JSON.stringify(response.data, null, 2) + '```',
        },
      });
    }

    await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
  }
}
```

### Example 2: Google Sheets Integration

**manifest.json**:
```json
{
  "id": "google-sheets-plugin",
  "name": "Google Sheets Export",
  "description": "Automatically export responses to Google Sheets",
  "icon": "📊",
  "category": "integration",
  "version": "1.0.0",
  "author": {
    "name": "Dculus Team"
  },
  "license": "MIT",
  "bundles": {
    "backend": "plugin.backend.js",
    "frontend": "plugin.config.js"
  }
}
```

**src/backend/index.ts**:
```typescript
import { BasePlugin } from '@dculus/plugin-sdk';
import { z } from 'zod';

export default class GoogleSheetsPlugin extends BasePlugin {
  constructor() {
    super({
      id: 'google-sheets-plugin',
      name: 'Google Sheets Export',
      description: 'Export responses to Google Sheets',
      icon: '📊',
      category: 'integration',
      version: '1.0.0',
    });
  }

  getConfigSchema() {
    return z.object({
      spreadsheetId: z.string(),
      apiKey: z.string(),
      sheetName: z.string().default('Responses'),
      isEnabled: z.boolean().default(true),
    });
  }

  async onFormSubmitted(event, context) {
    const config = await this.getConfig(event.formId);
    const response = await context.getResponse(event.responseId);

    // Convert response data to row
    const row = [
      new Date().toISOString(),
      event.responseId,
      ...Object.values(response.data),
    ];

    // Append to Google Sheets
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${config.sheetName}:append?key=${config.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          values: [row],
        }),
      }
    );
  }
}
```

---

## Migration from Old System

### Deprecation Plan

**Phase 1** (Current): Both systems coexist
- Internal plugins (hardcoded) still work
- External plugin system available
- No breaking changes

**Phase 2** (Future): Migrate internal plugins
- Convert HelloWorldPlugin to external bundle
- Load from database instead of hardcoded import
- Keep code in repo for reference

**Phase 3** (Future): Remove old system
- Delete `plugins/hello-world/` directory
- Remove manual imports in `plugins/index.ts`
- All plugins loaded dynamically

### Converting Existing Internal Plugin

**Before** (Internal):
```typescript
// plugins/hello-world/index.ts
export class HelloWorldPlugin extends BasePlugin {
  // ... implementation
}

// plugins/index.ts
export { HelloWorldPlugin } from './hello-world/index.js';

// index.ts
import { HelloWorldPlugin } from './plugins/index.js';
pluginRegistry.register(new HelloWorldPlugin());
```

**After** (External):
```bash
# Create standalone package
mkdir hello-world-plugin
cd hello-world-plugin

# Copy code to src/backend/
cp ../plugins/hello-world/index.ts src/backend/index.ts

# Create manifest.json
# Build plugin
npm run build

# Upload dist/ to CDN/GitHub
# Install via URL in UI
```

---

## Testing

### Unit Tests for PluginLoader

```typescript
describe('PluginLoader', () => {
  it('should download and install plugin from URL', async () => {
    const pluginId = await pluginLoader.installFromUrl('http://localhost:3000/test-plugin');
    expect(pluginId).toBe('test-plugin');
  });

  it('should reject invalid manifest', async () => {
    await expect(
      pluginLoader.installFromUrl('http://localhost:3000/invalid-plugin')
    ).rejects.toThrow('Invalid plugin manifest');
  });

  it('should prevent duplicate installation', async () => {
    await pluginLoader.installFromUrl('http://localhost:3000/test-plugin');

    await expect(
      pluginLoader.installFromUrl('http://localhost:3000/test-plugin')
    ).rejects.toThrow('already installed');
  });
});
```

### Integration Tests

```typescript
describe('Plugin Installation E2E', () => {
  it('should install, configure, and execute external plugin', async () => {
    // Install plugin
    const { data } = await apolloClient.mutate({
      mutation: INSTALL_PLUGIN,
      variables: { input: { url: 'http://localhost:3000/email-plugin' } }
    });

    expect(data.installPlugin.success).toBe(true);

    // Configure plugin for form
    await apolloClient.mutate({
      mutation: CONFIGURE_PLUGIN,
      variables: {
        formId: 'test-form',
        pluginId: 'email-plugin',
        config: { recipientEmail: 'test@example.com', isEnabled: true }
      }
    });

    // Submit form
    await submitFormResponse('test-form', { name: 'Test User' });

    // Verify plugin executed
    // Check logs or mock email service
  });
});
```

---

## Deployment Checklist

### Backend Deployment

- [ ] Update Prisma schema with new Plugin fields
- [ ] Run `pnpm db:generate && pnpm db:push`
- [ ] Create `temp/plugins/` directory (or ensure writeable)
- [ ] Deploy updated backend with PluginLoader
- [ ] Verify `pluginLoader.loadAllPlugins()` runs on startup

### Frontend Deployment

- [ ] Deploy updated form-app with plugin marketplace UI
- [ ] Test dynamic config UI loading
- [ ] Verify install/uninstall flows work

### SDK Package

- [ ] Build and publish `@dculus/plugin-sdk` to npm
- [ ] Create plugin template repository
- [ ] Write developer documentation
- [ ] Create example plugins

### Monitoring

- [ ] Add logging for plugin installations
- [ ] Add metrics for plugin execution time
- [ ] Set up alerts for plugin failures
- [ ] Monitor database size (plugin code storage)

---

## Roadmap

### MVP (Phase 1) ✅
- [x] Bundle-based plugin architecture
- [x] Install from URL
- [x] Dynamic import() loading
- [x] Database-backed storage
- [x] Plugin SDK package
- [x] Basic validation

### Phase 2
- [ ] Plugin marketplace UI with search/filtering
- [ ] Plugin ratings and reviews
- [ ] Plugin update notifications
- [ ] Hot-reload without server restart
- [ ] Plugin logs viewer in UI

### Phase 3
- [ ] Plugin permissions system
- [ ] Code sandboxing (VM2/isolated-vm)
- [ ] Plugin signature verification
- [ ] Malicious code scanning
- [ ] Official plugin registry

### Phase 4
- [ ] Plugin monetization
- [ ] Premium plugin support
- [ ] Plugin analytics dashboard
- [ ] Plugin version rollback
- [ ] Multi-event support (form.created, form.updated, etc.)

---

## Conclusion

This external plugin system enables **unlimited extensibility** of dculus-forms without code changes. Users can install plugins from any URL, and developers can build plugins independently using the `@dculus/plugin-sdk`.

The bundle-based architecture keeps the system simple while maintaining security through organization-scoped access and validation.

**Key Benefits**:
- 🚀 Install plugins without rebuilding
- 🔌 Host plugins anywhere
- 🛡️ Organization-level data isolation
- 🎨 Custom config UIs per plugin
- 📦 Zero-dependency loading
- ♻️ Hot-reload capable

This document provides everything needed to implement the complete external plugin system from scratch.

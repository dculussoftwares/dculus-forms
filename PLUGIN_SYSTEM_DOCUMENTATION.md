# Plugin System Documentation

## Overview

This document describes the **implemented event-driven plugin system** for dculus-forms. The system allows developers to create plugins that react to form lifecycle events in real-time using EventEmitter3.

**Status**: ✅ Fully Implemented and Tested

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Components](#core-components)
   - Base Plugin Class
   - Plugin Context API
   - Plugin Registry
   - Plugin Service
3. [Event System](#event-system)
4. [Database Schema](#database-schema)
5. [Plugin Development Guide](#plugin-development-guide)
6. [GraphQL API](#graphql-api)
7. [Frontend Integration](#frontend-integration)
8. [Testing](#testing)
9. [Deployment](#deployment)

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (React + Apollo)                     │
│                                                                   │
│  ┌────────────────────────┐      ┌────────────────────────┐    │
│  │ Plugin Marketplace      │      │ Plugin Config Dialogs  │    │
│  │ (FormPluginsNew.tsx)    │◀────▶│ (HelloWorldConfig.tsx) │    │
│  └────────────────────────┘      └────────────────────────┘    │
│            │                                 │                   │
│            │   GraphQL (Apollo Client)       │                   │
│            ▼                                 ▼                   │
└────────────┼─────────────────────────────────┼───────────────────┘
             │                                 │
             │                                 │
┌────────────┼─────────────────────────────────┼───────────────────┐
│            │          Backend (Node.js)      │                   │
│            ▼                                 ▼                   │
│   ┌─────────────────┐              ┌──────────────────┐         │
│   │ GraphQL          │              │ Plugin Service   │         │
│   │ Resolvers        │─────────────▶│ (CRUD Operations)│         │
│   │ (plugins.ts)     │              └──────────────────┘         │
│   └─────────────────┘                        │                   │
│            │                                 │                   │
│            │                                 ▼                   │
│            │                   ┌─────────────────────────┐       │
│            │                   │   Plugin Registry       │       │
│            │                   │   (Singleton)           │       │
│            │                   │ - register()            │       │
│            │                   │ - initialize()          │       │
│            │                   │ - getAllMetadata()      │       │
│            │                   └─────────────────────────┘       │
│            │                                 │                   │
│            │                                 ▼                   │
│   ┌─────────────────┐              ┌──────────────────┐         │
│   │ Form Response    │    emit      │   Event Bus      │         │
│   │ Resolver         │─────────────▶│ (EventEmitter3)  │         │
│   │ (responses.ts)   │              └──────────────────┘         │
│   └─────────────────┘                        │                   │
│                                              │                   │
│                        form.submitted ───────┘                   │
│                        form.created                              │
│                        form.updated                              │
│                                              │                   │
│                                              ▼                   │
│                        ┌────────────────────────────────┐        │
│                        │    Plugin Instances            │        │
│                        │  ┌──────────────────────┐      │        │
│                        │  │ HelloWorldPlugin     │      │        │
│                        │  │ extends BasePlugin   │      │        │
│                        │  └──────────────────────┘      │        │
│                        │  ┌──────────────────────┐      │        │
│                        │  │ Future Plugins...    │      │        │
│                        │  │ (Email, Slack, etc.) │      │        │
│                        │  └──────────────────────┘      │        │
│                        └────────────────────────────────┘        │
│                                              │                   │
│                                              ▼                   │
│                        ┌────────────────────────────────┐        │
│                        │  Database (MongoDB/Prisma)     │        │
│                        │  - Plugin (metadata)           │        │
│                        │  - FormPluginConfig            │        │
│                        └────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Event Bus** | EventEmitter3 | High-performance typed event emitter |
| **Database** | MongoDB + Prisma | Plugin metadata and configuration storage |
| **API** | Apollo GraphQL | Type-safe API for plugin management |
| **Validation** | Zod | Runtime schema validation |
| **Frontend** | React + Apollo Client | Plugin marketplace UI |
| **UI Components** | shadcn/ui | Consistent UI components |

---

## Core Components

### 1. Event Bus (`apps/backend/src/lib/events.ts`)

The event bus is the central communication hub using **EventEmitter3** for type-safe, high-performance event handling.

**File Location**: [apps/backend/src/lib/events.ts](apps/backend/src/lib/events.ts)

**Key Features**:
- Typed event interfaces
- Singleton pattern
- Development logging
- Asynchronous event handling

**Event Types**:

```typescript
export interface FormSubmittedEvent {
  formId: string;
  responseId: string;
  organizationId: string;
  data: Record<string, any>;
  submittedAt: Date;
}

export interface FormCreatedEvent {
  formId: string;
  organizationId: string;
  createdBy: string;
  createdAt: Date;
}

export interface FormUpdatedEvent {
  formId: string;
  organizationId: string;
  updatedBy: string;
  updatedAt: Date;
}

export type EventMap = {
  'form.submitted': FormSubmittedEvent;
  'form.created': FormCreatedEvent;
  'form.updated': FormUpdatedEvent;
};
```

**Usage Example**:

```typescript
import { eventBus } from '../lib/events.js';

// Emit an event
eventBus.emit('form.submitted', {
  formId: 'abc123',
  responseId: 'xyz789',
  organizationId: 'org123',
  data: { name: 'John Doe', email: 'john@example.com' },
  submittedAt: new Date(),
});

// Listen to events
eventBus.on('form.submitted', async (event) => {
  console.log(`Form ${event.formId} submitted!`);
});
```

### 2. Base Plugin Class (`apps/backend/src/plugins/base/BasePlugin.ts`)

Abstract base class that all plugins extend, providing common functionality and enforcing plugin contracts.

**File Location**: [apps/backend/src/plugins/base/BasePlugin.ts](apps/backend/src/plugins/base/BasePlugin.ts)

**Plugin Metadata Interface**:

```typescript
export interface PluginMetadata {
  id: string;                // Unique plugin identifier (e.g., 'hello-world')
  name: string;              // Display name (e.g., 'Hello World')
  description: string;       // User-friendly description
  icon: string;              // Emoji or icon identifier
  category: string;          // Plugin category (e.g., 'automation')
  version: string;           // Semantic version (e.g., '1.0.0')
}
```

**Abstract Methods** (Must be implemented by plugins):

| Method | Return Type | Purpose |
|--------|------------|---------|
| `getConfigSchema()` | `z.ZodSchema` | Returns Zod validation schema for plugin config |
| `onFormSubmitted(event, context)` | `Promise<void>` | Main execution logic when form is submitted. Receives event data and organization-scoped PluginContext |

**Optional Lifecycle Hooks**:

| Hook | Parameters | Purpose |
|------|-----------|---------|
| `onEnabled(formId, config)` | `string, any` | Called when plugin is installed/enabled for a form |
| `onDisabled(formId)` | `string` | Called when plugin is disabled |
| `onUninstalled(formId)` | `string` | Called when plugin is uninstalled |

**Built-in Methods**:

```typescript
// Retrieve plugin configuration from database
async getConfig(formId: string): Promise<any | null>

// Validate configuration against Zod schema
validateConfig(config: any): z.SafeParseResult

// Main execution wrapper (called by event bus)
async execute(event: FormSubmittedEvent): Promise<void>
```

**Implementation Pattern**:

```typescript
import { BasePlugin } from '../base/BasePlugin.js';
import { z } from 'zod';

export class MyPlugin extends BasePlugin {
  constructor() {
    super({
      id: 'my-plugin',
      name: 'My Awesome Plugin',
      description: 'Does amazing things when forms are submitted',
      icon: '🚀',
      category: 'automation',
      version: '1.0.0',
    });
  }

  getConfigSchema() {
    return z.object({
      apiKey: z.string().min(1, 'API key is required'),
      webhookUrl: z.string().url('Must be a valid URL'),
      isEnabled: z.boolean().default(true),
    });
  }

  async onFormSubmitted(
    event: FormSubmittedEvent,
    context: PluginContext  // Organization-scoped context
  ): Promise<void> {
    const config = await this.getConfig(event.formId);

    console.log(`Processing form ${event.formId} with config:`, config);

    // Use context to access form data
    const form = await context.getForm(event.formId);
    const response = await context.getResponse(event.responseId);

    console.log(`Form: "${form.title}"`);
    console.log(`Response data:`, response.data);

    // Your plugin logic here
    // - Make API calls
    // - Send notifications
    // - Transform data
    // - etc.
  }

  async onEnabled(formId: string, config: any): Promise<void> {
    console.log(`Plugin enabled for form ${formId}`);
    // Optional: Initialize resources, validate API keys, etc.
  }
}
```

### 3. Plugin Context API (`apps/backend/src/plugins/base/PluginContext.ts`)

Provides organization-scoped API access to plugins without requiring custom API keys. Plugins receive a `PluginContext` instance automatically when events are triggered.

**File Location**: [apps/backend/src/plugins/base/PluginContext.ts](apps/backend/src/plugins/base/PluginContext.ts)

**Key Features**:
- **Automatic organization scoping**: All methods enforce organization boundaries
- **No authentication needed**: Context inherits organization from event
- **Type-safe API**: Leverages existing Prisma models
- **Security by design**: Plugins cannot access other organizations' data

**Available Methods**:

```typescript
class PluginContext {
  // Get form details (automatically scoped to plugin's organization)
  async getForm(formId: string): Promise<Form>

  // Get response details with form included
  async getResponse(responseId: string): Promise<Response & { form: Form }>

  // List responses for a form (with optional limit, default 100, max 1000)
  async listResponses(formId: string, limit?: number): Promise<Response[]>

  // Get organization details
  async getOrganization(): Promise<Organization>

  // Get current organization ID (for logging/debugging)
  getOrganizationId(): string

  // Get current form ID (for logging/debugging)
  getFormId(): string
}
```

**Usage Example**:

```typescript
import { BasePlugin, PluginContext } from '../base/BasePlugin.js';
import type { FormSubmittedEvent } from '../../lib/events.js';

export class MyPlugin extends BasePlugin {
  async onFormSubmitted(
    event: FormSubmittedEvent,
    context: PluginContext  // Organization-scoped context
  ): Promise<void> {
    // Get form details
    const form = await context.getForm(event.formId);
    console.log(`Form title: ${form.title}`);

    // Get response details
    const response = await context.getResponse(event.responseId);
    console.log(`Response data:`, response.data);

    // List all responses for this form
    const allResponses = await context.listResponses(event.formId, 50);
    console.log(`Total responses: ${allResponses.length}`);

    // Get organization info
    const org = await context.getOrganization();
    console.log(`Organization: ${org.name}`);

    // Context methods automatically enforce organization boundaries
    // Attempting to access data from other organizations will throw an error
  }
}
```

**Security Model**:

The PluginContext automatically scopes all operations to the organization that owns the form. This means:

✅ **Allowed**:
- Access forms within the same organization
- Access responses for forms in the same organization
- List responses for forms in the same organization

❌ **Blocked** (throws error):
- Access forms from other organizations
- Access responses from other organizations
- Cross-organization data access

**Error Handling**:

```typescript
try {
  const form = await context.getForm(formId);
  // Process form...
} catch (error) {
  // Error thrown if:
  // - Form not found
  // - Form belongs to different organization
  // - Database error
  console.error('Failed to access form:', error.message);
}
```

### 4. Plugin Registry (`apps/backend/src/plugins/registry.ts`)

Centralized singleton that manages all plugin instances and coordinates the plugin lifecycle.

**File Location**: [apps/backend/src/plugins/registry.ts](apps/backend/src/plugins/registry.ts)

**Key Responsibilities**:
- Register plugin instances
- Attach event listeners to event bus
- Sync plugin metadata to database
- Provide plugin instances to services

**Public Methods**:

```typescript
class PluginRegistry {
  // Register a new plugin and attach event listeners
  register(plugin: BasePlugin): void

  // Initialize the plugin system (sync with database)
  async initialize(): Promise<void>

  // Get a specific plugin instance
  get(pluginId: string): BasePlugin | undefined

  // Get all registered plugin instances
  getAll(): BasePlugin[]

  // Get all plugin metadata from database (with isActive, timestamps)
  async getAllMetadata(): Promise<Plugin[]>

  // Check if a plugin is registered
  has(pluginId: string): boolean
}
```

**Initialization Flow**:

```typescript
// 1. Server startup - register plugins
import { HelloWorldPlugin } from './plugins/hello-world/index.js';
import { pluginRegistry } from './plugins/registry.js';

pluginRegistry.register(new HelloWorldPlugin());

// 2. Initialize (syncs metadata to database)
await pluginRegistry.initialize();

// 3. Plugins are now ready to receive events
```

**Event Listener Registration**:

When a plugin is registered, the registry automatically attaches an event listener:

```typescript
register(plugin: BasePlugin): void {
  // ... registration logic ...

  // Attach event listener for form.submitted
  eventBus.on('form.submitted', async (event: any) => {
    await plugin.execute(event);
  });
}
```

**Important Implementation Detail**:

The `getAllMetadata()` method queries the database directly (not just in-memory metadata) to include additional fields required by GraphQL:

```typescript
async getAllMetadata() {
  const pluginIds = Array.from(this.plugins.keys());

  const dbPlugins = await prisma.plugin.findMany({
    where: {
      id: { in: pluginIds },
    },
  });

  return dbPlugins; // Returns full Plugin records with isActive, createdAt, updatedAt
}
```

### 4. Plugin Service (`apps/backend/src/services/pluginService.ts`)

Business logic layer for plugin operations, used by GraphQL resolvers.

**File Location**: [apps/backend/src/services/pluginService.ts](apps/backend/src/services/pluginService.ts)

**Service Functions**:

| Function | Parameters | Returns | Purpose |
|----------|-----------|---------|---------|
| `getAvailablePlugins()` | - | `Plugin[]` | Get all available plugins from registry |
| `getFormPluginConfigs()` | `formId, organizationId` | `FormPluginConfig[]` | Get installed plugins for a form |
| `getPluginConfig()` | `formId, pluginId, organizationId` | `FormPluginConfig \| null` | Get specific plugin configuration |
| `installPlugin()` | `InstallPluginInput` | `FormPluginConfig` | Install and enable plugin for a form |
| `updatePluginConfig()` | `UpdatePluginConfigInput` | `FormPluginConfig` | Update plugin configuration |
| `togglePlugin()` | `formId, pluginId, organizationId, isEnabled` | `FormPluginConfig` | Enable/disable plugin |
| `uninstallPlugin()` | `formId, pluginId, organizationId` | `boolean` | Uninstall plugin from form |

**Example: Install Plugin**:

```typescript
export async function installPlugin(input: InstallPluginInput) {
  const { formId, pluginId, organizationId, config } = input;

  // 1. Get plugin from registry
  const plugin = pluginRegistry.get(pluginId);
  if (!plugin) {
    throw new GraphQLError(`Plugin "${pluginId}" not found`);
  }

  // 2. Validate configuration with Zod
  const validation = plugin.validateConfig(config);
  if (!validation.success) {
    throw new GraphQLError(
      `Invalid plugin configuration: ${validation.error.message}`
    );
  }

  // 3. Save to database
  const pluginConfig = await prisma.formPluginConfig.create({
    data: {
      id: nanoid(),
      formId,
      pluginId,
      organizationId,
      config: config,
      isEnabled: true,
    },
    include: {
      plugin: true,
    },
  });

  // 4. Call lifecycle hook
  await plugin.onEnabled(formId, config as any);

  return pluginConfig;
}
```

---

## Event System

### Event Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. User submits form via GraphQL mutation                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. GraphQL Resolver: submitResponse()                           │
│    File: apps/backend/src/graphql/resolvers/responses.ts        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Response saved to database via Prisma                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Event emitted to event bus                                   │
│    eventBus.emit('form.submitted', {                            │
│      formId, responseId, organizationId, data, submittedAt      │
│    })                                                            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Plugin Registry forwards to all registered plugins           │
│    (EventEmitter3 handles async execution)                      │
└────────────────────────┬────────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ HelloWorld   │ │ Email        │ │ Slack        │
│ Plugin       │ │ Plugin       │ │ Plugin       │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       │                │                │
       ▼                ▼                ▼
┌──────────────────────────────────────────────────┐
│ 6. Each plugin's execute() method called         │
│    - Retrieves config from database              │
│    - Checks if enabled for this form             │
│    - Validates config is present                 │
└──────┬───────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────┐
│ 7. Plugin executes onFormSubmitted() logic      │
│    - Makes API calls                            │
│    - Sends notifications                        │
│    - Logs output                                │
│    - etc.                                       │
└─────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────┐
│ 8. Plugin execution completes                   │
│    (Errors are caught and logged, don't crash)  │
└─────────────────────────────────────────────────┘
```

### Event Emission Points

**Form Submission** ([apps/backend/src/graphql/resolvers/responses.ts](apps/backend/src/graphql/resolvers/responses.ts)):

```typescript
// After saving response to database
eventBus.emit('form.submitted', {
  formId: input.formId,
  responseId: response.id,
  organizationId: form.organizationId,
  data: input.data,
  submittedAt: response.submittedAt,
});
```

**Future Event Points** (not yet implemented):

```typescript
// Form creation
eventBus.emit('form.created', {
  formId: form.id,
  organizationId: form.organizationId,
  createdBy: context.user.id,
  createdAt: form.createdAt,
});

// Form updates
eventBus.emit('form.updated', {
  formId: form.id,
  organizationId: form.organizationId,
  updatedBy: context.user.id,
  updatedAt: new Date(),
});
```

---

## Database Schema

### Plugin Model

Stores plugin metadata synchronized from the plugin registry.

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

  formConfigs FormPluginConfig[]

  @@map("plugin")
}
```

**Fields**:
- `id`: Unique plugin identifier (e.g., 'hello-world')
- `name`: Display name shown in marketplace
- `description`: User-friendly description
- `icon`: Emoji or icon identifier
- `category`: Plugin category for filtering
- `version`: Semantic version string
- `isActive`: Whether plugin is available (always true for registered plugins)
- `createdAt`: When plugin was first registered
- `updatedAt`: Last time plugin metadata was updated

### FormPluginConfig Model

Stores per-form plugin configurations (plugin instances).

```prisma
model FormPluginConfig {
  id             String   @id @map("_id")
  formId         String
  pluginId       String
  organizationId String
  config         Json
  isEnabled      Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  form   Form   @relation(fields: [formId], references: [id], onDelete: Cascade)
  plugin Plugin @relation(fields: [pluginId], references: [id], onDelete: Cascade)

  @@unique([formId, pluginId])
  @@map("form_plugin_config")
}
```

**Fields**:
- `id`: Unique configuration record ID (nanoid)
- `formId`: The form this plugin is configured for
- `pluginId`: The plugin type (e.g., 'hello-world')
- `organizationId`: Organization owning the form
- `config`: JSON object with plugin-specific configuration
- `isEnabled`: Whether this plugin instance is active
- `createdAt`: When plugin was installed for this form
- `updatedAt`: Last time configuration was updated

**Constraints**:
- Unique constraint on `[formId, pluginId]` - Each plugin can only be installed once per form
- Cascade delete on form deletion
- Cascade delete on plugin deletion

---

## Plugin Development Guide

### Step 1: Create Plugin Directory

```bash
mkdir -p apps/backend/src/plugins/my-plugin
cd apps/backend/src/plugins/my-plugin
```

### Step 2: Define Configuration Schema

Create `schema.ts`:

```typescript
import { z } from 'zod';

export const myPluginConfigSchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
  webhookUrl: z.string().url('Must be a valid URL'),
  timeout: z.number().min(1000).max(30000).default(5000),
  isEnabled: z.boolean().default(true),
});

export type MyPluginConfig = z.infer<typeof myPluginConfigSchema>;
```

### Step 3: Implement Plugin Class

Create `index.ts`:

```typescript
import { BasePlugin } from '../base/BasePlugin.js';
import { myPluginConfigSchema, type MyPluginConfig } from './schema.js';
import type { FormSubmittedEvent } from '../../lib/events.js';

export class MyPlugin extends BasePlugin {
  constructor() {
    super({
      id: 'my-plugin',
      name: 'My Plugin',
      description: 'Sends form data to external webhook',
      icon: '🔌',
      category: 'webhooks',
      version: '1.0.0',
    });
  }

  getConfigSchema() {
    return myPluginConfigSchema;
  }

  async onFormSubmitted(
    event: FormSubmittedEvent,
    context: PluginContext  // Organization-scoped context
  ): Promise<void> {
    const config = await this.getConfig(event.formId) as MyPluginConfig;

    console.log(`[${this.metadata.id}] Processing form submission...`);

    try {
      // Use context to get form details
      const form = await context.getForm(event.formId);
      const response = await context.getResponse(event.responseId);

      // Make webhook request
      const webhookResponse = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          formId: event.formId,
          formTitle: form.title,  // Now we have access to form title!
          responseId: event.responseId,
          data: response.data,
          submittedAt: event.submittedAt,
          organizationId: event.organizationId,
        }),
        signal: AbortSignal.timeout(config.timeout),
      });

      if (!webhookResponse.ok) {
        throw new Error(`Webhook request failed: ${webhookResponse.statusText}`);
      }

      console.log(`[${this.metadata.id}] Webhook sent successfully for form "${form.title}"`);
    } catch (error: any) {
      console.error(`[${this.metadata.id}] Webhook failed:`, error.message);
      throw error; // Re-throw to be caught by execute() wrapper
    }
  }

  async onEnabled(formId: string, config: any): Promise<void> {
    console.log(`[${this.metadata.id}] Enabled for form ${formId}`);
    // Optional: Test webhook connection
  }

  async onDisabled(formId: string): Promise<void> {
    console.log(`[${this.metadata.id}] Disabled for form ${formId}`);
  }

  async onUninstalled(formId: string): Promise<void> {
    console.log(`[${this.metadata.id}] Uninstalled from form ${formId}`);
  }
}
```

### Step 4: Register Plugin

Edit [apps/backend/src/index.ts](apps/backend/src/index.ts):

```typescript
import { MyPlugin } from './plugins/my-plugin/index.js';

// Initialize plugin system
console.log('🔌 Initializing plugin system...');
pluginRegistry.register(new HelloWorldPlugin());
pluginRegistry.register(new MyPlugin()); // <-- Add your plugin
await pluginRegistry.initialize();
```

### Step 5: Create Frontend Configuration Component

Create `apps/form-app/src/plugins/my-plugin/ConfigDialog.tsx`:

```typescript
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@dculus/ui';
import { Button, Input, Label } from '@dculus/ui';

interface MyPluginConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialConfig?: any;
  onSave: (config: any) => void;
  isEditing?: boolean;
}

export function MyPluginConfigDialog({
  open,
  onOpenChange,
  initialConfig,
  onSave,
  isEditing = false,
}: MyPluginConfigDialogProps) {
  const [apiKey, setApiKey] = useState(initialConfig?.apiKey || '');
  const [webhookUrl, setWebhookUrl] = useState(initialConfig?.webhookUrl || '');
  const [timeout, setTimeout] = useState(initialConfig?.timeout || 5000);

  const handleSave = () => {
    onSave({
      apiKey,
      webhookUrl,
      timeout,
      isEnabled: true,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Configure' : 'Install'} My Plugin
          </DialogTitle>
          <DialogDescription>
            Configure webhook settings for form submissions
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your API key..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhookUrl">Webhook URL</Label>
            <Input
              id="webhookUrl"
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://api.example.com/webhooks"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="timeout">Timeout (ms)</Label>
            <Input
              id="timeout"
              type="number"
              value={timeout}
              onChange={(e) => setTimeout(parseInt(e.target.value))}
              min="1000"
              max="30000"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {isEditing ? 'Save Changes' : 'Install Plugin'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### Step 6: Integrate in Plugin Marketplace

Edit [apps/form-app/src/pages/FormPluginsNew.tsx](apps/form-app/src/pages/FormPluginsNew.tsx):

```typescript
import { MyPluginConfigDialog } from '../plugins/my-plugin/ConfigDialog';

// Add to dialog rendering logic
{selectedPluginConfig?.pluginId === 'my-plugin' && (
  <MyPluginConfigDialog
    open={isConfigDialogOpen}
    onOpenChange={setIsConfigDialogOpen}
    initialConfig={selectedPluginConfig?.config}
    onSave={handleUpdatePluginConfig}
    isEditing={true}
  />
)}

{installDialogPlugin?.id === 'my-plugin' && (
  <MyPluginConfigDialog
    open={isInstallDialogOpen}
    onOpenChange={setIsInstallDialogOpen}
    onSave={handleInstallPlugin}
    isEditing={false}
  />
)}
```

### Step 7: Test Your Plugin

1. **Start development servers**:
   ```bash
   pnpm dev
   ```

2. **Navigate to plugin marketplace**:
   ```
   http://localhost:3000/dashboard/form/{formId}/plugins
   ```

3. **Install your plugin** with test configuration

4. **Submit a form response**:
   ```bash
   curl -X POST http://localhost:4000/graphql \
     -H "Content-Type: application/json" \
     -d '{
       "query": "mutation { submitResponse(input: {formId: \"...\", data: {}}) { id } }"
     }'
   ```

5. **Check backend console** for plugin execution logs

---

## GraphQL API

### Complete Schema

**File Location**: [apps/backend/src/graphql/schema.ts](apps/backend/src/graphql/schema.ts)

```graphql
type Plugin {
  id: ID!
  name: String!
  description: String!
  icon: String!
  category: String!
  version: String!
  isActive: Boolean!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type FormPluginConfig {
  id: ID!
  formId: ID!
  pluginId: ID!
  organizationId: ID!
  config: JSON!
  isEnabled: Boolean!
  createdAt: DateTime!
  updatedAt: DateTime!
  plugin: Plugin!
}

input InstallPluginInput {
  formId: ID!
  pluginId: ID!
  organizationId: ID!
  config: JSON!
}

input UpdatePluginConfigInput {
  formId: ID!
  pluginId: ID!
  organizationId: ID!
  config: JSON!
}

extend type Query {
  availablePlugins: [Plugin!]!
  formPluginConfigs(formId: ID!): [FormPluginConfig!]!
  pluginConfig(formId: ID!, pluginId: ID!): FormPluginConfig
}

extend type Mutation {
  installPlugin(input: InstallPluginInput!): FormPluginConfig!
  updatePluginConfig(input: UpdatePluginConfigInput!): FormPluginConfig!
  togglePlugin(formId: ID!, pluginId: ID!, isEnabled: Boolean!): FormPluginConfig!
  uninstallPlugin(formId: ID!, pluginId: ID!): Boolean!
}
```

### Query Examples

**Get Available Plugins**:

```graphql
query GetAvailablePlugins {
  availablePlugins {
    id
    name
    description
    icon
    category
    version
    isActive
  }
}
```

**Get Installed Plugins for a Form**:

```graphql
query GetFormPluginConfigs($formId: ID!) {
  formPluginConfigs(formId: $formId) {
    id
    pluginId
    config
    isEnabled
    createdAt
    plugin {
      name
      icon
      description
    }
  }
}
```

**Get Specific Plugin Configuration**:

```graphql
query GetPluginConfig($formId: ID!, $pluginId: ID!) {
  pluginConfig(formId: $formId, pluginId: $pluginId) {
    id
    config
    isEnabled
    plugin {
      name
      description
    }
  }
}
```

### Mutation Examples

**Install Plugin**:

```graphql
mutation InstallPlugin($input: InstallPluginInput!) {
  installPlugin(input: $input) {
    id
    pluginId
    config
    isEnabled
    plugin {
      name
    }
  }
}

# Variables:
{
  "input": {
    "formId": "abc123",
    "pluginId": "hello-world",
    "organizationId": "org123",
    "config": {
      "message": "Hello from my form!",
      "isEnabled": true
    }
  }
}
```

**Update Plugin Configuration**:

```graphql
mutation UpdatePluginConfig($input: UpdatePluginConfigInput!) {
  updatePluginConfig(input: $input) {
    id
    config
    updatedAt
  }
}

# Variables:
{
  "input": {
    "formId": "abc123",
    "pluginId": "hello-world",
    "organizationId": "org123",
    "config": {
      "message": "Updated message!",
      "isEnabled": true
    }
  }
}
```

**Toggle Plugin (Enable/Disable)**:

```graphql
mutation TogglePlugin($formId: ID!, $pluginId: ID!, $isEnabled: Boolean!) {
  togglePlugin(formId: $formId, pluginId: $pluginId, isEnabled: $isEnabled) {
    id
    isEnabled
  }
}

# Variables:
{
  "formId": "abc123",
  "pluginId": "hello-world",
  "isEnabled": false
}
```

**Uninstall Plugin**:

```graphql
mutation UninstallPlugin($formId: ID!, $pluginId: ID!) {
  uninstallPlugin(formId: $formId, pluginId: $pluginId)
}

# Variables:
{
  "formId": "abc123",
  "pluginId": "hello-world"
}
```

### Authorization

All plugin operations require:
1. **Authentication**: Valid user session
2. **Organization Membership**: User must be member of form's organization
3. **Form Access**: Form must exist and belong to user's organization

GraphQL resolvers check these conditions and throw `GraphQLError` if unauthorized.

---

## Frontend Integration

### Plugin Marketplace Page

**File Location**: [apps/form-app/src/pages/FormPluginsNew.tsx](apps/form-app/src/pages/FormPluginsNew.tsx)

**Key Features**:
- Microsoft Teams-style interface
- Two sections: Installed Plugins and Available Plugins
- Action buttons: Configure, Enable/Disable, Uninstall, Install
- Dynamic configuration dialogs
- Real-time updates with Apollo Client
- Toast notifications for user feedback

**UI Structure**:

```
┌─────────────────────────────────────────────────────────────┐
│  Plugins                                                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  📦 Installed Plugins (2)                                    │
│  ┌────────────────────┐  ┌────────────────────┐            │
│  │ 👋 Hello World     │  │ 📧 Email           │            │
│  │ v1.0.0 • ENABLED   │  │ v1.0.0 • DISABLED  │            │
│  │                    │  │                    │            │
│  │ [Configure] [...]  │  │ [Configure] [...]  │            │
│  └────────────────────┘  └────────────────────┘            │
│                                                              │
│  🔍 Available Plugins (5)                                    │
│  ┌────────────────────┐  ┌────────────────────┐            │
│  │ 🔔 Slack           │  │ 🔗 Webhooks        │            │
│  │ v1.0.0             │  │ v1.0.0             │            │
│  │ Send to Slack...   │  │ HTTP webhooks...   │            │
│  │ [Install]          │  │ [Install]          │            │
│  └────────────────────┘  └────────────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

**GraphQL Integration**:

```typescript
// Fetch available plugins
const { data: pluginsData } = useQuery(GET_AVAILABLE_PLUGINS);

// Fetch installed configs
const { data: configsData } = useQuery(GET_FORM_PLUGIN_CONFIGS, {
  variables: { formId },
});

// Install plugin mutation
const [installPlugin] = useMutation(INSTALL_PLUGIN, {
  refetchQueries: ['GetFormPluginConfigs'],
});

// Usage
const handleInstallPlugin = async (config: any) => {
  await installPlugin({
    variables: {
      input: {
        formId,
        pluginId: installDialogPlugin?.id,
        organizationId,
        config,
      },
    },
  });
  toastSuccess('Plugin installed successfully');
};
```

### Configuration Dialogs

Each plugin provides its own configuration dialog component that:
- Accepts `initialConfig` prop for editing mode
- Validates user input
- Calls `onSave` callback with configuration object
- Displays helpful descriptions and examples

**Pattern**:

```typescript
interface PluginConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialConfig?: any;
  onSave: (config: any) => void;
  isEditing?: boolean;
}
```

---

## Testing

### Manual Testing Checklist

**Prerequisites**:
- [ ] Backend running on port 4000
- [ ] Frontend running on port 3000
- [ ] Test user logged in (`testing@testing.com` / `testing@testing.com`)

**Plugin Installation**:
- [ ] Navigate to `/dashboard/form/{formId}/plugins`
- [ ] See available plugins listed
- [ ] Click "Install" on a plugin
- [ ] Configuration dialog opens
- [ ] Fill configuration form
- [ ] Submit configuration
- [ ] See success toast notification
- [ ] Plugin appears in "Installed Plugins" section

**Plugin Configuration**:
- [ ] Click "Configure" on installed plugin
- [ ] Configuration dialog opens with existing values
- [ ] Modify configuration
- [ ] Save changes
- [ ] See success toast notification

**Plugin Toggling**:
- [ ] Click dropdown menu on installed plugin
- [ ] Click "Disable" option
- [ ] Plugin badge changes to "DISABLED"
- [ ] Click "Enable" to re-enable
- [ ] Plugin badge changes back to "ENABLED"

**Plugin Uninstallation**:
- [ ] Click dropdown menu on installed plugin
- [ ] Click "Uninstall" option
- [ ] Plugin removed from installed section
- [ ] Plugin reappears in available section

**Plugin Execution**:
- [ ] Install and enable a plugin (e.g., Hello World)
- [ ] Submit a form response via GraphQL or form viewer
- [ ] Check backend console logs
- [ ] Verify plugin execution output
- [ ] Verify event details are correct

### Example Test Flow

**Hello World Plugin Test**:

```bash
# 1. Start servers
pnpm dev

# 2. Login at http://localhost:3000
# Email: testing@testing.com
# Password: testing@testing.com

# 3. Navigate to plugins page
# URL: http://localhost:3000/dashboard/form/hj93jhebrg7mgkntaec/plugins

# 4. Install Hello World plugin with message: "Testing the plugin system!"

# 5. Submit a form response
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=YOUR_SESSION_TOKEN" \
  -d '{
    "query": "mutation { submitResponse(input: {formId: \"hj93jhebrg7mgkntaec\", data: {name: \"Test User\"}}) { id } }"
  }'

# 6. Check backend console for output:
# ============================================================
# 🎉 HELLO WORLD PLUGIN TRIGGERED!
# ============================================================
# 📝 Message: Testing the plugin system!
# 📋 Form ID: hj93jhebrg7mgkntaec
# 🆔 Response ID: xyz789
# 🏢 Organization ID: org123
# ⏰ Timestamp: 1/10/2025, 8:14:09 PM
# ============================================================
```

### Integration Testing

**Future Enhancements**:
- [ ] Automated integration tests with Jest
- [ ] GraphQL operation tests
- [ ] Plugin lifecycle tests
- [ ] Event emission tests
- [ ] Error handling tests

---

## Deployment

### Environment Variables

No additional environment variables required beyond existing dculus-forms configuration.

### Build Process

The plugin system is part of the main backend application:

```bash
# Build all packages
pnpm build

# Build backend specifically
pnpm --filter backend build
```

### Production Considerations

**Plugin Registration**:
- Plugins must be registered in [apps/backend/src/index.ts](apps/backend/src/index.ts) before deployment
- Plugin code is compiled with the backend

**Database Migration**:
```bash
# Generate Prisma client
pnpm db:generate

# Push schema to database
pnpm db:push
```

**Monitoring**:
- Plugin execution logs are written to console (stdout)
- Consider integrating with logging service (e.g., Winston, Pino)
- Monitor for plugin execution failures

**Error Handling**:
- Plugin errors are caught and logged but don't crash the server
- Consider adding error tracking (e.g., Sentry)

**Performance**:
- Plugins execute asynchronously and don't block event emitter
- Consider adding execution time tracking
- Monitor database query performance for plugin config lookups

---

## Troubleshooting

### Plugin Not Appearing in Marketplace

**Symptoms**: Plugin not listed in available plugins

**Checklist**:
- [ ] Plugin registered in `apps/backend/src/index.ts`?
- [ ] `pluginRegistry.initialize()` called on server startup?
- [ ] Check backend console for registration logs
- [ ] Check Plugin collection in MongoDB

**Solution**:
```typescript
// apps/backend/src/index.ts
import { MyPlugin } from './plugins/my-plugin/index.js';

pluginRegistry.register(new MyPlugin());
await pluginRegistry.initialize();
```

### Plugin Not Executing

**Symptoms**: Form submitted but plugin doesn't run

**Checklist**:
- [ ] Plugin enabled in form configuration?
- [ ] Event emitted in response resolver?
- [ ] Plugin configuration exists in database?
- [ ] Check backend console for event emission logs

**Debug**:
```typescript
// Add to plugin execute() method
async execute(event: FormSubmittedEvent): Promise<void> {
  console.log(`[DEBUG] Plugin ${this.metadata.id} execute() called`);
  const config = await this.getConfig(event.formId);
  console.log(`[DEBUG] Config:`, config);

  if (!config || !config.isEnabled) {
    console.log(`[DEBUG] Plugin skipped - no config or disabled`);
    return;
  }

  await this.onFormSubmitted(event);
}
```

### Configuration Validation Errors

**Symptoms**: "Invalid plugin configuration" error when installing

**Checklist**:
- [ ] Zod schema matches expected configuration structure?
- [ ] All required fields provided?
- [ ] Field types match schema (string, number, boolean)?

**Example**:
```typescript
// Schema expects:
z.object({
  apiKey: z.string().min(1),  // Required, non-empty string
  timeout: z.number(),         // Required number
})

// But received:
{
  apiKey: '',        // ❌ Empty string
  timeout: '5000',   // ❌ String instead of number
}

// Should be:
{
  apiKey: 'abc123',  // ✅
  timeout: 5000,     // ✅
}
```

### GraphQL Errors

**"Cannot return null for non-nullable field Plugin.isActive"**

**Cause**: `getAllMetadata()` returning incomplete data

**Solution**: Already fixed in current implementation - `getAllMetadata()` queries database directly

---

## Example Plugin: Hello World

### Complete Implementation

**Schema** ([apps/backend/src/plugins/hello-world/schema.ts](apps/backend/src/plugins/hello-world/schema.ts)):

```typescript
import { z } from 'zod';

export const helloWorldConfigSchema = z.object({
  message: z.string().min(1).max(500),
  isEnabled: z.boolean().default(true),
});

export type HelloWorldConfig = z.infer<typeof helloWorldConfigSchema>;
```

**Plugin Class** ([apps/backend/src/plugins/hello-world/index.ts](apps/backend/src/plugins/hello-world/index.ts)):

```typescript
import { BasePlugin } from '../base/BasePlugin.js';
import { helloWorldConfigSchema } from './schema.js';
import type { FormSubmittedEvent } from '../../lib/events.js';

export class HelloWorldPlugin extends BasePlugin {
  constructor() {
    super({
      id: 'hello-world',
      name: 'Hello World',
      description: 'A simple plugin that logs a custom message when forms are submitted. Perfect for testing the plugin system!',
      icon: '👋',
      category: 'automation',
      version: '1.0.0',
    });
  }

  getConfigSchema() {
    return helloWorldConfigSchema;
  }

  async onEnabled(formId: string, config: any): Promise<void> {
    console.log(
      `[HelloWorld] Plugin enabled for form ${formId} with message: "${config.message}"`
    );
  }

  async onFormSubmitted(
    event: FormSubmittedEvent,
    context: PluginContext  // Organization-scoped context
  ): Promise<void> {
    const config = await this.getConfig(event.formId);

    if (!config) {
      console.log(`[HelloWorld] No configuration found for form: ${event.formId}`);
      return;
    }

    // Use context to get form and response details
    const form = await context.getForm(event.formId);
    const response = await context.getResponse(event.responseId);

    const separator = '='.repeat(60);
    const timestamp = new Date(event.submittedAt).toLocaleString();

    console.log('\n' + separator);
    console.log('🎉 HELLO WORLD PLUGIN TRIGGERED!');
    console.log(separator);
    console.log(`📝 Message: ${config.message}`);
    console.log(`📋 Form: "${form.title}" (${event.formId})`);
    console.log(`🆔 Response ID: ${event.responseId}`);
    console.log(`🏢 Organization ID: ${event.organizationId}`);
    console.log(`⏰ Timestamp: ${timestamp}`);
    console.log('📊 Response Data:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log(separator + '\n');
  }
}
```

**Frontend Config Dialog** ([apps/form-app/src/plugins/hello-world/ConfigDialog.tsx](apps/form-app/src/plugins/hello-world/ConfigDialog.tsx)):

```typescript
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Label,
} from '@dculus/ui';

interface HelloWorldConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialConfig?: any;
  onSave: (config: any) => void;
  isEditing?: boolean;
}

export function HelloWorldConfigDialog({
  open,
  onOpenChange,
  initialConfig,
  onSave,
  isEditing = false,
}: HelloWorldConfigDialogProps) {
  const [message, setMessage] = useState(
    initialConfig?.message || 'Hello from my form!'
  );

  const handleSave = () => {
    onSave({ message, isEnabled: true });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Configure' : 'Install'} Hello World Plugin
          </DialogTitle>
          <DialogDescription>
            Configure the message that will be logged on the backend console when
            your form is submitted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="message">Custom Message</Label>
            <Input
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter your custom message..."
            />
            <p className="text-sm text-slate-500">
              This message will be logged to the backend console every time someone
              submits your form.
            </p>
          </div>

          <div className="rounded-lg bg-slate-50 p-4 space-y-2">
            <p className="text-sm font-medium text-slate-700">Example Output:</p>
            <pre className="text-xs bg-slate-900 text-slate-100 p-3 rounded overflow-x-auto">
{`==================================================
🎉 HELLO WORLD PLUGIN TRIGGERED!
==================================================
📝 Message: ${message}
📋 Form ID: abc123
🆔 Response ID: xyz789
⏰ Timestamp: ${new Date().toLocaleString()}
==================================================`}
            </pre>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {isEditing ? 'Save Changes' : 'Install Plugin'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

## Future Enhancements

### Planned Features

- [ ] **Additional Events**: `form.created`, `form.updated`, `response.edited`, `response.deleted`
- [ ] **Email Plugin**: Send email notifications with customizable templates
- [ ] **Slack Plugin**: Post form submissions to Slack channels
- [ ] **Webhooks Plugin**: Generic HTTP webhook integration
- [ ] **Google Sheets Plugin**: Export responses to Google Sheets
- [ ] **Conditional Execution**: Execute plugins based on form data conditions
- [ ] **Rate Limiting**: Prevent plugin abuse with rate limits
- [ ] **Execution Logs UI**: View plugin execution history in frontend
- [ ] **Plugin Testing**: Test plugin configuration before enabling
- [ ] **Plugin Marketplace**: Browse and install community plugins
- [ ] **Plugin Templates**: Starter templates for common plugin types
- [ ] **Scheduled Execution**: Run plugins on schedule (e.g., daily digest)
- [ ] **Error Notifications**: Alert users when plugins fail
- [ ] **Plugin Permissions**: Fine-grained control over plugin capabilities

### Architecture Improvements

- [ ] **Job Queue System**: Migrate to Bree or Bull for reliable job processing
- [ ] **Retry Logic**: Automatic retries for failed plugin executions
- [ ] **Execution Logs Database**: Store execution history in MongoDB
- [ ] **Plugin Metrics**: Track execution time, success rate, error rate
- [ ] **Plugin Versioning**: Support multiple plugin versions
- [ ] **Hot Reload**: Reload plugins without server restart
- [ ] **Plugin Sandboxing**: Isolate plugin execution with worker threads
- [ ] **Plugin Discovery**: Auto-discover plugins from filesystem
- [ ] **Plugin Dependencies**: Manage plugin dependencies and conflicts

---

## Additional Resources

### Key Files Reference

**Backend**:
- [Event Bus](apps/backend/src/lib/events.ts) - EventEmitter3 singleton
- [Base Plugin](apps/backend/src/plugins/base/BasePlugin.ts) - Abstract plugin class
- [Plugin Registry](apps/backend/src/plugins/registry.ts) - Plugin management
- [Plugin Service](apps/backend/src/services/pluginService.ts) - Business logic
- [GraphQL Schema](apps/backend/src/graphql/schema.ts) - API types
- [GraphQL Resolvers](apps/backend/src/graphql/resolvers/plugins.ts) - API implementation
- [Response Resolver](apps/backend/src/graphql/resolvers/responses.ts) - Event emission
- [Hello World Plugin](apps/backend/src/plugins/hello-world/index.ts) - Example plugin
- [Database Schema](apps/backend/prisma/schema.prisma) - Plugin models

**Frontend**:
- [Plugin Marketplace](apps/form-app/src/pages/FormPluginsNew.tsx) - Main UI
- [GraphQL Queries](apps/form-app/src/graphql/plugins.ts) - API operations
- [Hello World Config](apps/form-app/src/plugins/hello-world/ConfigDialog.tsx) - Example dialog

### External Documentation

- [EventEmitter3](https://github.com/primus/eventemitter3) - Event emitter library
- [Zod](https://zod.dev/) - Schema validation
- [Apollo GraphQL](https://www.apollographql.com/docs/) - GraphQL server/client
- [Prisma](https://www.prisma.io/docs/) - Database ORM
- [shadcn/ui](https://ui.shadcn.com/) - UI components

---

**Document Version**: 1.0.0
**Last Updated**: January 10, 2025
**Status**: ✅ Fully Implemented and Tested

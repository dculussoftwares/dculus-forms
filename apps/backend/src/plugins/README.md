# Plugins Directory

This directory contains all backend plugin implementations for the dculus-forms plugin system.

## Overview

Plugins extend form functionality by reacting to lifecycle events like form submissions. Each plugin is self-contained with its own configuration schema and execution logic.

## Directory Structure

```
plugins/
├── README.md                    # This file
├── base/
│   ├── BasePlugin.ts            # Abstract base class for all plugins
│   └── PluginContext.ts         # Organization-scoped API access
├── hello-world/
│   ├── index.ts                 # Example plugin implementation
│   ├── schema.ts                # Example configuration schema
│   └── README.md                # Plugin documentation
└── registry.ts                  # Plugin registry (singleton)
```

## Available Plugins

### Hello World Plugin

**ID**: `hello-world`
**Description**: A simple demo plugin that logs custom messages when forms are submitted.
**Category**: automation
**Status**: ✅ Production Ready

**Configuration**:
- `message` (string): Custom message to log
- `isEnabled` (boolean): Whether the plugin is active

**Use Case**: Testing the plugin system, learning plugin development

**Files**:
- [index.ts](hello-world/index.ts) - Plugin implementation
- [schema.ts](hello-world/schema.ts) - Configuration schema

---

## Creating a New Plugin

### Quick Start

1. **Create plugin directory**:
   ```bash
   mkdir -p apps/backend/src/plugins/my-plugin
   ```

2. **Create schema** (`schema.ts`):
   ```typescript
   import { z } from 'zod';

   export const myPluginConfigSchema = z.object({
     apiKey: z.string().min(1),
     isEnabled: z.boolean().default(true),
   });

   export type MyPluginConfig = z.infer<typeof myPluginConfigSchema>;
   ```

3. **Create plugin class** (`index.ts`):
   ```typescript
   import { BasePlugin } from '../base/BasePlugin.js';
   import { myPluginConfigSchema } from './schema.js';
   import type { FormSubmittedEvent } from '../../lib/events.js';

   export class MyPlugin extends BasePlugin {
     constructor() {
       super({
         id: 'my-plugin',
         name: 'My Plugin',
         description: 'What this plugin does',
         icon: '🚀',
         category: 'automation',
         version: '1.0.0',
       });
     }

     getConfigSchema() {
       return myPluginConfigSchema;
     }

     async onFormSubmitted(
       event: FormSubmittedEvent,
       context: PluginContext
     ): Promise<void> {
       const config = await this.getConfig(event.formId);

       // Use context to access form data
       const form = await context.getForm(event.formId);
       const response = await context.getResponse(event.responseId);

       console.log(`Form: "${form.title}"`);
       // Your plugin logic here
     }
   }
   ```

4. **Register plugin** (`apps/backend/src/index.ts`):
   ```typescript
   import { MyPlugin } from './plugins/my-plugin/index.js';

   pluginRegistry.register(new MyPlugin());
   await pluginRegistry.initialize();
   ```

5. **Create frontend UI** (see Frontend section below)

### Detailed Guide

For comprehensive instructions, see:
- [Plugin Development Guide](../../../../../PLUGIN_DEVELOPMENT_GUIDE.md)
- [Plugin System Documentation](../../../../../PLUGIN_SYSTEM_DOCUMENTATION.md)

---

## Base Plugin Class

All plugins must extend `BasePlugin` and implement:

### Required Methods

```typescript
abstract class BasePlugin {
  // Return Zod schema for configuration validation
  abstract getConfigSchema(): z.ZodSchema;

  // Main execution logic when form is submitted
  // Receives event data and organization-scoped PluginContext
  abstract onFormSubmitted(
    event: FormSubmittedEvent,
    context: PluginContext
  ): Promise<void>;
}
```

### Optional Lifecycle Hooks

```typescript
// Called when plugin is installed/enabled
async onEnabled(formId: string, config: any): Promise<void> { }

// Called when plugin is disabled
async onDisabled(formId: string): Promise<void> { }

// Called when plugin is uninstalled
async onUninstalled(formId: string): Promise<void> { }
```

### Plugin Context API

Plugins receive a `PluginContext` instance that provides organization-scoped access to form data:

```typescript
class PluginContext {
  // Get form details (organization-scoped)
  async getForm(formId: string): Promise<Form>

  // Get response details with form included
  async getResponse(responseId: string): Promise<Response & { form: Form }>

  // List responses for a form (default limit: 100, max: 1000)
  async listResponses(formId: string, limit?: number): Promise<Response[]>

  // Get organization details
  async getOrganization(): Promise<Organization>

  // Get organization/form IDs (for logging)
  getOrganizationId(): string
  getFormId(): string
}
```

**Security**: All methods automatically enforce organization boundaries. Attempting to access data from other organizations will throw an error.

**Example Usage**:

```typescript
async onFormSubmitted(
  event: FormSubmittedEvent,
  context: PluginContext
): Promise<void> {
  // Get form and response details
  const form = await context.getForm(event.formId);
  const response = await context.getResponse(event.responseId);

  console.log(`Form: "${form.title}"`);
  console.log(`Response:`, response.data);

  // List all responses
  const responses = await context.listResponses(event.formId, 50);
  console.log(`Total responses: ${responses.length}`);
}
```

### Built-in Methods

```typescript
// Get plugin configuration for a specific form
async getConfig(formId: string): Promise<any | null>

// Validate configuration against schema
validateConfig(config: any): z.SafeParseResult

// Main execution wrapper (called by event bus)
async execute(event: FormSubmittedEvent): Promise<void>
```

---

## Plugin Events

### Currently Supported

**`form.submitted`** - Triggered when a form response is submitted

Event payload:
```typescript
interface FormSubmittedEvent {
  formId: string;
  responseId: string;
  organizationId: string;
  data: Record<string, any>;  // Form response data
  submittedAt: Date;
}
```

### Future Events (Planned)

- `form.created` - When a new form is created
- `form.updated` - When a form is modified
- `response.edited` - When a response is edited
- `response.deleted` - When a response is deleted

---

## Configuration Schema Guidelines

Use **Zod** for runtime validation:

```typescript
import { z } from 'zod';

export const configSchema = z.object({
  // Required string
  apiKey: z.string().min(1, 'API key required'),

  // URL validation
  webhookUrl: z.string().url('Must be valid URL'),

  // Number with range
  timeout: z.number().min(1000).max(30000).default(5000),

  // Enum/Select
  priority: z.enum(['low', 'medium', 'high']).default('medium'),

  // Boolean
  enabled: z.boolean().default(true),

  // Optional field
  description: z.string().optional(),

  // Array
  recipients: z.array(z.string().email()).min(1),

  // Nested object
  smtp: z.object({
    host: z.string(),
    port: z.number(),
  }),
});
```

---

## Frontend Integration

Create a configuration dialog in `apps/form-app/src/plugins/my-plugin/ConfigDialog.tsx`:

```typescript
import { useState } from 'react';
import { Dialog, DialogContent, Button, Input, Label } from '@dculus/ui';

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
  isEditing
}: MyPluginConfigDialogProps) {
  const [apiKey, setApiKey] = useState(initialConfig?.apiKey || '');

  const handleSave = () => {
    onSave({ apiKey, isEnabled: true });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Your form fields */}
        <Button onClick={handleSave}>
          {isEditing ? 'Save' : 'Install'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
```

Then integrate in `apps/form-app/src/pages/FormPluginsNew.tsx` (see examples).

---

## Testing Your Plugin

### 1. Backend Testing

```bash
# Start backend
pnpm backend:dev

# Look for registration logs:
# ✅ Registered plugin: My Plugin (my-plugin)
# [PluginRegistry] Initialized 2 plugin(s): [ 'hello-world', 'my-plugin' ]
```

### 2. Frontend Testing

```bash
# Start frontend
pnpm form-app:dev

# Navigate to:
# http://localhost:3000/dashboard/form/{formId}/plugins
```

### 3. Integration Testing

```bash
# Submit a test form
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { submitResponse(input: {formId: \"abc123\", data: {}}) { id } }"
  }'

# Check backend logs for plugin execution
```

---

## Best Practices

### Security

```typescript
// ❌ Never log sensitive data
console.log('[Plugin] Config:', config);

// ✅ Redact sensitive fields
console.log('[Plugin] Config:', {
  ...config,
  apiKey: '***REDACTED***',
});

// ✅ Use HTTPS for webhooks
url: z.string().url().refine(
  url => url.startsWith('https://'),
  { message: 'Only HTTPS URLs allowed' }
),
```

### Error Handling

```typescript
async onFormSubmitted(
  event: FormSubmittedEvent,
  context: PluginContext
): Promise<void> {
  try {
    const form = await context.getForm(event.formId);
    // Your logic here
  } catch (error: any) {
    console.error(`[${this.metadata.id}] Error:`, error.message);
    throw error; // Let BasePlugin.execute() handle it
  }
}
```

### Performance

```typescript
// ✅ Use timeouts for external API calls
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), timeout);

try {
  await fetch(url, { signal: controller.signal });
} finally {
  clearTimeout(timeoutId);
}

// ✅ Run independent operations in parallel
const [result1, result2] = await Promise.all([
  operation1(),
  operation2(),
]);
```

---

## Plugin Categories

Use these standard categories:

| Category | Description | Examples |
|----------|-------------|----------|
| `automation` | Automated actions and workflows | Hello World, Auto-responders |
| `communication` | Notifications and messaging | Email, Slack, Discord |
| `webhooks` | HTTP integrations | Webhooks, REST APIs |
| `productivity` | Data management and export | Google Sheets, Airtable |
| `analytics` | Tracking and monitoring | Google Analytics, Mixpanel |

---

## Plugin Metadata

Required fields for `super()` constructor:

```typescript
super({
  id: 'unique-plugin-id',           // Kebab-case, unique identifier
  name: 'Display Name',              // Human-readable name
  description: 'What it does...',    // User-friendly description
  icon: '🚀',                        // Emoji or icon identifier
  category: 'automation',            // One of the standard categories
  version: '1.0.0',                  // Semantic versioning
});
```

---

## Troubleshooting

### Plugin not appearing in marketplace

**Check**:
1. Plugin registered in `apps/backend/src/index.ts`?
2. `pluginRegistry.initialize()` called?
3. Backend console shows registration log?

**Fix**:
```typescript
// apps/backend/src/index.ts
pluginRegistry.register(new MyPlugin());
await pluginRegistry.initialize();
```

### Plugin not executing

**Check**:
1. Plugin configuration exists in database?
2. Plugin is enabled (`isEnabled: true`)?
3. Event is being emitted?

**Debug**:
```typescript
async execute(event: FormSubmittedEvent): Promise<void> {
  console.log(`[DEBUG] Execute called for form ${event.formId}`);
  const config = await this.getConfig(event.formId);
  console.log(`[DEBUG] Config:`, config);

  if (!config || !config.isEnabled) {
    console.log('[DEBUG] Skipping');
    return;
  }

  // Create context and call plugin
  const context = new PluginContext(event.organizationId, event.formId);
  await this.onFormSubmitted(event, context);
}
```

### Configuration validation failing

**Debug schema**:
```typescript
const result = myPluginConfigSchema.safeParse(config);
if (!result.success) {
  console.log('Validation errors:', result.error.format());
}
```

---

## Resources

**Documentation**:
- [Plugin Development Guide](../../../../../PLUGIN_DEVELOPMENT_GUIDE.md) - Complete tutorial
- [Plugin System Documentation](../../../../../PLUGIN_SYSTEM_DOCUMENTATION.md) - Architecture overview
- [Project Documentation](../../../../../CLAUDE.md) - General project info

**Code Examples**:
- [Hello World Plugin](hello-world/) - Simple example
- [Base Plugin Class](base/BasePlugin.ts) - Abstract base class
- [Plugin Registry](registry.ts) - Registration system

**External Resources**:
- [Zod Documentation](https://zod.dev/) - Schema validation
- [EventEmitter3](https://github.com/primus/eventemitter3) - Event system

---

## Contributing

When creating new plugins:

1. Follow the directory structure
2. Include comprehensive JSDoc comments
3. Add validation for all config fields
4. Handle errors gracefully
5. Create user-friendly frontend dialog
6. Test thoroughly before deployment
7. Update this README with plugin info

---

**Happy Plugin Development! 🚀**

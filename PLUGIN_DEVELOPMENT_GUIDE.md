# Plugin Development Guide

Complete guide for creating custom plugins for the dculus-forms plugin system.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Plugin Structure](#plugin-structure)
4. [Step-by-Step Tutorial](#step-by-step-tutorial)
5. [Configuration Schema](#configuration-schema)
6. [Frontend Components](#frontend-components)
7. [Testing](#testing)
8. [Best Practices](#best-practices)

---

## Prerequisites

**Required Knowledge**:
- TypeScript fundamentals
- Node.js and async/await
- React and React Hooks
- Zod schema validation

**Development Environment**:
- Node.js >=18.0.0
- pnpm >=8.0.0
- Running dculus-forms backend and frontend

**Resources**:
- [Plugin System Documentation](./PLUGIN_SYSTEM_DOCUMENTATION.md)
- [Zod Documentation](https://zod.dev/)
- [shadcn/ui Components](https://ui.shadcn.com/)

---

## Quick Start

```bash
# 1. Create plugin directories
mkdir -p apps/backend/src/plugins/my-plugin
mkdir -p apps/form-app/src/plugins/my-plugin

# 2. Create schema file (see examples below)
# 3. Create plugin class (see examples below)
# 4. Create config dialog (see examples below)
# 5. Register plugin in apps/backend/src/index.ts
# 6. Add dialog to apps/form-app/src/pages/FormPluginsNew.tsx
# 7. Test!
```

---

## Plugin Structure

### Directory Layout

```
apps/backend/src/plugins/my-plugin/
├── index.ts      # Plugin class
└── schema.ts     # Zod validation schema

apps/form-app/src/plugins/my-plugin/
└── ConfigDialog.tsx   # React configuration UI
```

---

## Step-by-Step Tutorial

### Example: Webhook Plugin

#### Step 1: Create Schema (`apps/backend/src/plugins/webhook/schema.ts`)

```typescript
import { z } from 'zod';

export const webhookConfigSchema = z.object({
  url: z.string().url('Must be a valid URL').min(1),
  headers: z.record(z.string(), z.string()).optional().default({}),
  timeout: z.number().min(1000).max(30000).default(5000),
  retryOnFailure: z.boolean().default(true),
  maxRetries: z.number().min(0).max(5).default(3),
  isEnabled: z.boolean().default(true),
});

export type WebhookConfig = z.infer<typeof webhookConfigSchema>;
```

#### Step 2: Implement Plugin (`apps/backend/src/plugins/webhook/index.ts`)

```typescript
import { BasePlugin } from '../base/BasePlugin.js';
import { webhookConfigSchema, type WebhookConfig } from './schema.js';
import type { FormSubmittedEvent } from '../../lib/events.js';

export class WebhookPlugin extends BasePlugin {
  constructor() {
    super({
      id: 'webhook',
      name: 'Webhooks',
      description: 'Send form submissions to external webhooks via HTTP POST',
      icon: '🔗',
      category: 'webhooks',
      version: '1.0.0',
    });
  }

  getConfigSchema() {
    return webhookConfigSchema;
  }

  async onFormSubmitted(event: FormSubmittedEvent): Promise<void> {
    const config = await this.getConfig(event.formId) as WebhookConfig;

    console.log(`[Webhook] Sending to ${config.url}`);

    const payload = {
      event: 'form.submitted',
      timestamp: event.submittedAt.toISOString(),
      form: { id: event.formId, organizationId: event.organizationId },
      response: { id: event.responseId, data: event.data },
    };

    await this.sendWithRetry(config, payload);
  }

  private async sendWithRetry(config: WebhookConfig, payload: any): Promise<void> {
    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        await this.sendWebhook(config, payload);
        console.log(`[Webhook] Success`);
        return;
      } catch (error: any) {
        if (attempt < config.maxRetries && config.retryOnFailure) {
          console.log(`[Webhook] Retry ${attempt + 1}/${config.maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        } else {
          console.error(`[Webhook] Failed:`, error.message);
          throw error;
        }
      }
    }
  }

  private async sendWebhook(config: WebhookConfig, payload: any): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);

    try {
      const response = await fetch(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'dculus-forms-webhook/1.0',
          ...config.headers,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
```

#### Step 3: Register Plugin (`apps/backend/src/index.ts`)

```typescript
import { WebhookPlugin } from './plugins/webhook/index.js';

// Add to initialization
pluginRegistry.register(new WebhookPlugin());
await pluginRegistry.initialize();
```

#### Step 4: Create Config Dialog (`apps/form-app/src/plugins/webhook/ConfigDialog.tsx`)

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
  Switch,
} from '@dculus/ui';

interface WebhookConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialConfig?: any;
  onSave: (config: any) => void;
  isEditing?: boolean;
}

export function WebhookConfigDialog({
  open,
  onOpenChange,
  initialConfig,
  onSave,
  isEditing = false,
}: WebhookConfigDialogProps) {
  const [url, setUrl] = useState(initialConfig?.url || '');
  const [timeout, setTimeout] = useState(initialConfig?.timeout || 5000);
  const [retryOnFailure, setRetryOnFailure] = useState(
    initialConfig?.retryOnFailure ?? true
  );
  const [maxRetries, setMaxRetries] = useState(initialConfig?.maxRetries || 3);

  const handleSave = () => {
    onSave({
      url,
      headers: {},
      timeout,
      retryOnFailure,
      maxRetries,
      isEnabled: true,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Configure' : 'Install'} Webhook Plugin
          </DialogTitle>
          <DialogDescription>
            Send form submissions to external webhooks via HTTP POST
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="url">Webhook URL *</Label>
            <Input
              id="url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://api.example.com/webhooks"
              required
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

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="retry">Retry on Failure</Label>
              <p className="text-sm text-slate-500">
                Automatically retry failed requests
              </p>
            </div>
            <Switch
              id="retry"
              checked={retryOnFailure}
              onCheckedChange={setRetryOnFailure}
            />
          </div>

          {retryOnFailure && (
            <div className="space-y-2 pl-4 border-l-2">
              <Label htmlFor="maxRetries">Max Retries</Label>
              <Input
                id="maxRetries"
                type="number"
                value={maxRetries}
                onChange={(e) => setMaxRetries(parseInt(e.target.value))}
                min="0"
                max="5"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!url}>
            {isEditing ? 'Save Changes' : 'Install Plugin'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

#### Step 5: Add to Marketplace (`apps/form-app/src/pages/FormPluginsNew.tsx`)

```typescript
import { WebhookConfigDialog } from '../plugins/webhook/ConfigDialog';

// Add dialog rendering
{selectedPluginConfig?.pluginId === 'webhook' && (
  <WebhookConfigDialog
    open={isConfigDialogOpen}
    onOpenChange={setIsConfigDialogOpen}
    initialConfig={selectedPluginConfig?.config}
    onSave={handleUpdatePluginConfig}
    isEditing={true}
  />
)}

{installDialogPlugin?.id === 'webhook' && (
  <WebhookConfigDialog
    open={isInstallDialogOpen}
    onOpenChange={setIsInstallDialogOpen}
    onSave={handleInstallPlugin}
    isEditing={false}
  />
)}
```

---

## Configuration Schema

### Common Zod Patterns

```typescript
import { z } from 'zod';

export const configSchema = z.object({
  // Required string
  apiKey: z.string().min(1, 'API key is required'),

  // URL validation
  webhookUrl: z.string().url('Must be a valid URL'),

  // Email validation
  email: z.string().email('Must be a valid email'),

  // Number with range
  timeout: z.number().min(1000).max(30000).default(5000),

  // Enum/Select
  priority: z.enum(['low', 'medium', 'high']).default('medium'),

  // Boolean with default
  enabled: z.boolean().default(true),

  // Optional string
  description: z.string().optional(),

  // Array of strings
  recipients: z.array(z.string().email()).min(1),

  // Nested object
  smtp: z.object({
    host: z.string(),
    port: z.number(),
    secure: z.boolean(),
  }),

  // Record/Map
  headers: z.record(z.string(), z.string()).optional().default({}),

  // Pattern matching
  token: z.string().regex(/^[a-zA-Z0-9]{32}$/, 'Invalid token format'),
});

export type Config = z.infer<typeof configSchema>;
```

---

## Frontend Components

### Common UI Patterns

**Text Input**:
```typescript
<div className="space-y-2">
  <Label htmlFor="apiKey">API Key *</Label>
  <Input
    id="apiKey"
    type="password"
    value={apiKey}
    onChange={(e) => setApiKey(e.target.value)}
    placeholder="Enter API key"
  />
  <p className="text-sm text-slate-500">Helper text</p>
</div>
```

**Number Input**:
```typescript
<Input
  type="number"
  value={timeout}
  onChange={(e) => setTimeout(parseInt(e.target.value))}
  min="1000"
  max="30000"
/>
```

**Toggle Switch**:
```typescript
<Switch
  checked={enabled}
  onCheckedChange={setEnabled}
/>
```

**Select Dropdown**:
```typescript
<Select value={priority} onValueChange={setPriority}>
  <SelectTrigger><SelectValue /></SelectTrigger>
  <SelectContent>
    <SelectItem value="low">Low</SelectItem>
    <SelectItem value="medium">Medium</SelectItem>
    <SelectItem value="high">High</SelectItem>
  </SelectContent>
</Select>
```

---

## Testing

### Manual Testing Checklist

1. **Backend**:
   - [ ] Plugin registered (check console logs)
   - [ ] Appears in available plugins
   - [ ] Configuration validates correctly
   - [ ] Executes on form submission
   - [ ] Errors are logged

2. **Frontend**:
   - [ ] Plugin card displays correctly
   - [ ] Install dialog opens
   - [ ] Configuration saves
   - [ ] Shows in installed section
   - [ ] Configure/Enable/Disable works
   - [ ] Uninstall removes plugin

3. **Integration**:
   - [ ] Submit form via GraphQL
   - [ ] Check backend console logs
   - [ ] Verify external API received data

### Test with cURL

```bash
# Submit form
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { submitResponse(input: {formId: \"abc123\", data: {test: \"value\"}}) { id } }"
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
  apiKey: config.apiKey ? '***' : undefined,
});

// ✅ Validate URLs (HTTPS only)
url: z.string()
  .url()
  .refine(url => url.startsWith('https://'), {
    message: 'Only HTTPS URLs allowed',
  }),
```

### Error Handling

```typescript
async onFormSubmitted(event: FormSubmittedEvent): Promise<void> {
  try {
    // Your logic
  } catch (error: any) {
    console.error(`[${this.metadata.id}] Error:`, error.message);
    throw error; // Let BasePlugin.execute() handle it
  }
}
```

### Performance

```typescript
// ✅ Use AbortController for timeouts
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), config.timeout);

try {
  await fetch(url, { signal: controller.signal });
} finally {
  clearTimeout(timeoutId);
}

// ✅ Parallel API calls when possible
const [result1, result2] = await Promise.all([
  apiCall1(),
  apiCall2(),
]);
```

### Code Organization

```typescript
// ✅ Extract helper methods
class MyPlugin extends BasePlugin {
  async onFormSubmitted(event: FormSubmittedEvent): Promise<void> {
    const payload = this.buildPayload(event);
    await this.sendWithRetry(payload);
  }

  private buildPayload(event: FormSubmittedEvent) { /* ... */ }
  private sendWithRetry(payload: any) { /* ... */ }
}
```

---

## Common Patterns

### Retry Logic

```typescript
private async executeWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt < maxRetries) {
        const delay = 1000 * Math.pow(2, attempt); // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
  throw new Error('Should not reach here');
}
```

### Template Rendering

```typescript
private renderTemplate(template: string, data: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, field) => {
    return data[field] !== undefined ? String(data[field]) : match;
  });
}

// Usage:
const message = renderTemplate('Hello {{name}}!', { name: 'John' });
// Result: "Hello John!"
```

---

## Troubleshooting

### Plugin not appearing

```typescript
// Check: Is plugin registered?
pluginRegistry.register(new MyPlugin());
await pluginRegistry.initialize();

// Look for log: "✅ Registered plugin: My Plugin (my-plugin)"
```

### Plugin not executing

```typescript
// Add debug logs:
async execute(event: FormSubmittedEvent): Promise<void> {
  console.log(`[DEBUG] Execute called for form ${event.formId}`);
  const config = await this.getConfig(event.formId);
  console.log(`[DEBUG] Config:`, config);

  if (!config || !config.isEnabled) {
    console.log('[DEBUG] Skipping - no config or disabled');
    return;
  }

  await this.onFormSubmitted(event);
}
```

### Validation errors

```typescript
// Test schema manually:
const result = myPluginConfigSchema.safeParse(yourConfig);
if (!result.success) {
  console.log('Validation errors:', result.error.format());
}
```

---

## Next Steps

1. **Study Examples**:
   - [Hello World Plugin](apps/backend/src/plugins/hello-world/)
   - [Event Bus](apps/backend/src/lib/events.ts)
   - [Base Plugin Class](apps/backend/src/plugins/base/BasePlugin.ts)

2. **Read Documentation**:
   - [Plugin System Documentation](./PLUGIN_SYSTEM_DOCUMENTATION.md)
   - [Project Documentation](./CLAUDE.md)

3. **Build Your Plugin**:
   - Follow the step-by-step tutorial above
   - Test thoroughly
   - Share with the community!

---

**Happy Plugin Development! 🚀**

For help or questions:
- [GitHub Issues](https://github.com/your-repo/issues)
- [Plugin System Documentation](./PLUGIN_SYSTEM_DOCUMENTATION.md)

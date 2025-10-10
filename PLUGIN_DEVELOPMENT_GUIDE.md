# Plugin Development Guide
## How to Create Custom Plugins for Dculus Forms

---

## 📋 **Table of Contents**

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Quick Start](#quick-start)
4. [Plugin Structure](#plugin-structure)
5. [Step-by-Step Tutorial](#step-by-step-tutorial)
6. [Advanced Topics](#advanced-topics)
7. [Best Practices](#best-practices)
8. [Testing](#testing)
9. [Publishing](#publishing)

---

## 🎯 **Overview**

Dculus Forms plugins are self-contained modules that extend form functionality by responding to form events (like submissions, updates, etc.). Each plugin consists of:

- **Backend logic** - Executes when triggered
- **Frontend UI** - Configuration interface
- **Manifest** - Plugin metadata
- **Schema** - Configuration validation

### **Supported Trigger Events**

- `form.submitted` - When a form response is submitted
- `form.updated` - When a form is edited
- `response.edited` - When a response is modified
- `response.deleted` - When a response is deleted

---

## ✅ **Prerequisites**

- Node.js >= 18.0.0
- TypeScript knowledge
- Understanding of React and Express.js
- Familiarity with Zod for validation

---

## 🚀 **Quick Start**

### **1. Create Plugin Directory**

```bash
cd plugins
mkdir my-plugin
cd my-plugin
```

### **2. Initialize Plugin**

```bash
pnpm init
mkdir -p backend frontend
```

### **3. Create Manifest**

Create `plugin.manifest.json`:

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "Plugin description",
  "category": "automation",
  "icon": "zap",
  "author": "Your Name",
  "triggers": ["form.submitted"],
  "dependencies": {}
}
```

### **4. Implement Backend**

Create `backend/index.ts`:

```typescript
import { IPlugin, ExecutionContext, ExecutionResult } from '@dculus/plugins-core';
import { z } from 'zod';

// Define config schema
const configSchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
  endpoint: z.string().url('Invalid URL')
});

export class MyPlugin implements IPlugin {
  id = 'my-plugin';
  name = 'My Plugin';
  version = '1.0.0';
  description = 'Plugin description';
  category = 'automation' as const;
  icon = 'zap';

  configSchema = configSchema;
  defaultConfig = {
    apiKey: '',
    endpoint: 'https://api.example.com'
  };

  triggers = ['form.submitted'] as const;

  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const { config, payload } = context;

    try {
      // Your plugin logic here
      console.log('Executing plugin with:', config, payload);

      return {
        success: true,
        data: { message: 'Success' }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async validate(config: unknown) {
    try {
      this.configSchema.parse(config);
      return { valid: true };
    } catch (error: any) {
      return {
        valid: false,
        errors: error.errors.map((e: any) => e.message)
      };
    }
  }

  async test(config: unknown) {
    try {
      const parsedConfig = this.configSchema.parse(config);
      // Test connection/API

      return {
        success: true,
        message: 'Connection successful'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}

export default new MyPlugin();
```

### **5. Create Frontend Config Form**

Create `frontend/ConfigForm.tsx`:

```typescript
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input } from '@dculus/ui';
import { configSchema } from '../backend/schema';

export const MyPluginConfigForm = ({ initialConfig, onSave, onTest }) => {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(configSchema),
    defaultValues: initialConfig
  });

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4">
      <Input
        label="API Key"
        type="password"
        {...register('apiKey')}
        error={errors.apiKey?.message}
      />

      <Input
        label="API Endpoint"
        {...register('endpoint')}
        error={errors.endpoint?.message}
      />

      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={handleSubmit(onTest)}>
          Test Connection
        </Button>
        <Button type="submit">
          Save Configuration
        </Button>
      </div>
    </form>
  );
};
```

---

## 📁 **Plugin Structure**

```
my-plugin/
├── package.json                    # Plugin dependencies
├── plugin.manifest.json            # Plugin metadata
├── README.md                       # Plugin documentation
├── backend/
│   ├── index.ts                    # Main plugin class (exports default)
│   ├── schema.ts                   # Zod validation schemas
│   ├── types.ts                    # TypeScript types (optional)
│   └── utils.ts                    # Helper functions (optional)
└── frontend/
    ├── ConfigForm.tsx              # Configuration UI
    ├── Icon.tsx                    # Plugin icon (optional)
    └── index.tsx                   # Frontend exports
```

---

## 📝 **Step-by-Step Tutorial: Creating a Slack Plugin**

### **Step 1: Setup**

```bash
mkdir plugins/slack
cd plugins/slack
pnpm init
mkdir -p backend frontend
```

### **Step 2: Create Manifest**

`plugin.manifest.json`:

```json
{
  "id": "slack",
  "name": "Slack Notifications",
  "version": "1.0.0",
  "description": "Send notifications to Slack channels",
  "category": "communication",
  "icon": "message-square",
  "author": "Dculus",
  "triggers": ["form.submitted", "response.edited"],
  "dependencies": {
    "@slack/web-api": "^7.0.0"
  }
}
```

### **Step 3: Define Configuration Schema**

`backend/schema.ts`:

```typescript
import { z } from 'zod';

export const slackConfigSchema = z.object({
  webhookUrl: z.string().url('Invalid webhook URL'),
  channel: z.string().min(1, 'Channel is required'),
  username: z.string().default('Form Bot'),
  iconEmoji: z.string().default(':robot_face:'),
  messageTemplate: z.string().min(1, 'Message template is required')
});

export type SlackConfig = z.infer<typeof slackConfigSchema>;
```

### **Step 4: Implement Backend Logic**

`backend/index.ts`:

```typescript
import { IPlugin, ExecutionContext, ExecutionResult } from '@dculus/plugins-core';
import { WebClient } from '@slack/web-api';
import { slackConfigSchema, SlackConfig } from './schema';

export class SlackPlugin implements IPlugin {
  id = 'slack';
  name = 'Slack Notifications';
  version = '1.0.0';
  description = 'Send notifications to Slack channels';
  category = 'communication' as const;
  icon = 'message-square';

  configSchema = slackConfigSchema;
  defaultConfig = {
    webhookUrl: '',
    channel: '#general',
    username: 'Form Bot',
    iconEmoji: ':robot_face:',
    messageTemplate: 'New form submission received!'
  };

  triggers = ['form.submitted', 'response.edited'] as const;

  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const config = context.config as SlackConfig;
    const { payload } = context;

    try {
      // Extract webhook token from URL
      const token = this.extractToken(config.webhookUrl);
      const client = new WebClient(token);

      // Render message template
      const message = this.renderTemplate(config.messageTemplate, payload);

      // Send to Slack
      const result = await client.chat.postMessage({
        channel: config.channel,
        text: message,
        username: config.username,
        icon_emoji: config.iconEmoji
      });

      return {
        success: true,
        data: {
          messageTs: result.ts,
          channel: result.channel
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async validate(config: unknown) {
    try {
      this.configSchema.parse(config);
      return { valid: true };
    } catch (error: any) {
      return {
        valid: false,
        errors: error.errors.map((e: any) => e.message)
      };
    }
  }

  async test(config: unknown) {
    try {
      const parsedConfig = this.configSchema.parse(config) as SlackConfig;
      const token = this.extractToken(parsedConfig.webhookUrl);
      const client = new WebClient(token);

      // Test authentication
      await client.auth.test();

      return {
        success: true,
        message: 'Slack connection successful'
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Slack test failed: ${error.message}`
      };
    }
  }

  private extractToken(webhookUrl: string): string {
    // Extract token from webhook URL
    const match = webhookUrl.match(/hooks\/([^\/]+)/);
    return match ? match[1] : webhookUrl;
  }

  private renderTemplate(template: string, data: any): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, field) => {
      return data[field] || match;
    });
  }
}

export default new SlackPlugin();
```

### **Step 5: Create Frontend Form**

`frontend/ConfigForm.tsx`:

```typescript
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input, Textarea } from '@dculus/ui';
import { slackConfigSchema } from '../backend/schema';

export const SlackConfigForm = ({ initialConfig, onSave, onTest }) => {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(slackConfigSchema),
    defaultValues: initialConfig
  });

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4">
      <div>
        <h3 className="font-semibold mb-3">Slack Settings</h3>

        <Input
          label="Webhook URL"
          type="url"
          placeholder="https://hooks.slack.com/services/..."
          {...register('webhookUrl')}
          error={errors.webhookUrl?.message}
        />

        <Input
          label="Channel"
          placeholder="#general"
          {...register('channel')}
          error={errors.channel?.message}
        />

        <Input
          label="Username"
          {...register('username')}
          error={errors.username?.message}
        />

        <Input
          label="Icon Emoji"
          placeholder=":robot_face:"
          {...register('iconEmoji')}
          error={errors.iconEmoji?.message}
        />

        <Textarea
          label="Message Template"
          rows={4}
          placeholder="Use {{fieldName}} for dynamic values"
          {...register('messageTemplate')}
          error={errors.messageTemplate?.message}
        />
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={handleSubmit(onTest)}>
          Test Connection
        </Button>
        <Button type="submit">
          Save Configuration
        </Button>
      </div>
    </form>
  );
};
```

---

## 🔧 **Advanced Topics**

### **1. Accessing Form Data**

```typescript
async execute(context: ExecutionContext): Promise<ExecutionResult> {
  const { formId, payload, config } = context;

  // Access form schema
  const form = await prisma.form.findUnique({
    where: { id: formId },
    include: { organization: true }
  });

  // Process form fields
  const formSchema = form.formSchema as any;
  const fields = formSchema.pages.flatMap(p => p.fields);

  // Use form data
  console.log('Form:', form.title);
  console.log('Response data:', payload);
}
```

### **2. Storing Plugin State**

```typescript
// Use plugin config to store state
async execute(context: ExecutionContext): Promise<ExecutionResult> {
  const { pluginConfigId, config } = context;

  // Update plugin config with new state
  await prisma.pluginConfig.update({
    where: { id: pluginConfigId },
    data: {
      config: {
        ...config,
        lastExecuted: new Date(),
        executionCount: (config.executionCount || 0) + 1
      }
    }
  });
}
```

### **3. External API Integration**

```typescript
import axios from 'axios';

async execute(context: ExecutionContext): Promise<ExecutionResult> {
  const { config, payload } = context;

  try {
    const response = await axios.post(config.apiEndpoint, {
      data: payload,
      timestamp: new Date().toISOString()
    }, {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    });

    return {
      success: true,
      data: response.data
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}
```

### **4. Conditional Execution**

```typescript
async execute(context: ExecutionContext): Promise<ExecutionResult> {
  const { config, payload } = context;

  // Only execute if certain conditions are met
  if (config.condition === 'email_only' && !payload.email) {
    return {
      success: true,
      data: { skipped: true, reason: 'No email field' }
    };
  }

  // Execute plugin logic
  // ...
}
```

### **5. Template Rendering**

```typescript
private renderTemplate(template: string, data: any): string {
  // Support for nested fields
  return template.replace(/\{\{([\w.]+)\}\}/g, (match, path) => {
    const value = path.split('.').reduce((obj, key) => obj?.[key], data);
    return value !== undefined ? String(value) : match;
  });
}

// Usage
const message = this.renderTemplate(
  'Hello {{user.name}}, your order {{order.id}} is {{order.status}}',
  {
    user: { name: 'John' },
    order: { id: '12345', status: 'confirmed' }
  }
);
// Output: "Hello John, your order 12345 is confirmed"
```

---

## ✨ **Best Practices**

### **1. Error Handling**

```typescript
async execute(context: ExecutionContext): Promise<ExecutionResult> {
  try {
    // Plugin logic
    return { success: true, data: result };
  } catch (error: any) {
    // Log error for debugging
    console.error(`[${this.id}] Execution failed:`, error);

    // Return user-friendly error
    return {
      success: false,
      error: this.getUserFriendlyError(error)
    };
  }
}

private getUserFriendlyError(error: any): string {
  if (error.code === 'ECONNREFUSED') {
    return 'Unable to connect to API. Please check your endpoint.';
  }
  if (error.code === 'ETIMEDOUT') {
    return 'Request timed out. Please try again.';
  }
  return error.message || 'An unexpected error occurred';
}
```

### **2. Validation**

```typescript
// Use strict validation
const configSchema = z.object({
  apiKey: z.string()
    .min(10, 'API key must be at least 10 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid API key format'),

  endpoint: z.string()
    .url('Invalid URL')
    .refine(url => url.startsWith('https://'), {
      message: 'Endpoint must use HTTPS'
    }),

  retries: z.number()
    .int()
    .min(0)
    .max(5)
    .default(3)
});
```

### **3. Security**

```typescript
// Never log sensitive data
console.log('Config:', {
  ...config,
  apiKey: '***REDACTED***',
  password: '***REDACTED***'
});

// Validate input data
const sanitizedData = {
  email: payload.email?.toString().toLowerCase().trim(),
  message: payload.message?.toString().slice(0, 1000) // Limit length
};

// Use HTTPS for external requests
if (!config.endpoint.startsWith('https://')) {
  throw new Error('Endpoint must use HTTPS');
}
```

### **4. Performance**

```typescript
// Use timeouts
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000);

try {
  const response = await fetch(url, {
    signal: controller.signal,
    // ...
  });
} finally {
  clearTimeout(timeoutId);
}

// Batch operations when possible
const results = await Promise.all(
  items.map(item => this.processItem(item))
);
```

### **5. Logging**

```typescript
async execute(context: ExecutionContext): Promise<ExecutionResult> {
  const startTime = Date.now();

  try {
    console.log(`[${this.id}] Starting execution`, {
      event: context.event,
      formId: context.formId
    });

    const result = await this.performAction(context);

    const duration = Date.now() - startTime;
    console.log(`[${this.id}] Execution completed in ${duration}ms`);

    return { success: true, data: result };
  } catch (error: any) {
    console.error(`[${this.id}] Execution failed:`, error);
    return { success: false, error: error.message };
  }
}
```

---

## 🧪 **Testing**

### **Unit Tests**

Create `backend/__tests__/plugin.test.ts`:

```typescript
import { MyPlugin } from '../index';

describe('MyPlugin', () => {
  const plugin = new MyPlugin();

  it('should validate config correctly', async () => {
    const result = await plugin.validate({
      apiKey: 'test-key',
      endpoint: 'https://api.example.com'
    });

    expect(result.valid).toBe(true);
  });

  it('should reject invalid config', async () => {
    const result = await plugin.validate({
      apiKey: '',
      endpoint: 'invalid-url'
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
  });

  it('should execute successfully', async () => {
    const result = await plugin.execute({
      pluginConfigId: 'test-id',
      event: 'form.submitted',
      payload: { name: 'Test' },
      config: { apiKey: 'key', endpoint: 'https://api.example.com' },
      formId: 'form-id'
    });

    expect(result.success).toBe(true);
  });
});
```

### **Integration Tests**

```typescript
// Test with real MongoDB and Bree
describe('Plugin Integration', () => {
  beforeAll(async () => {
    // Setup test database
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should create and execute job', async () => {
    const config = await prisma.pluginConfig.create({
      data: {
        formId: 'test-form',
        pluginId: 'my-plugin',
        enabled: true,
        config: { apiKey: 'test' },
        triggerEvents: ['form.submitted']
      }
    });

    const job = await jobExecutor.createJob({
      pluginConfigId: config.id,
      event: 'form.submitted',
      payload: { test: true }
    });

    expect(job.status).toBe('pending');
  });
});
```

---

## 📦 **Publishing Your Plugin**

### **1. Documentation**

Create `README.md`:

```markdown
# My Plugin

Short description of what the plugin does.

## Features

- Feature 1
- Feature 2

## Configuration

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| apiKey | string | Yes | Your API key |
| endpoint | string | Yes | API endpoint URL |

## Supported Events

- `form.submitted` - Triggered when form is submitted
- `response.edited` - Triggered when response is edited

## Usage

1. Install the plugin
2. Configure your API credentials
3. Select trigger events
4. Save and enable

## Support

For issues, contact: support@example.com
```

### **2. Package for Distribution**

```bash
# Build plugin
pnpm build

# Create distributable package
pnpm pack
```

### **3. Submit to Plugin Registry**

(Coming soon: Official plugin registry)

---

## 📚 **Resources**

- [Plugin Architecture](./PLUGIN_ARCHITECTURE.md)
- [GraphQL API Documentation](./docs/GRAPHQL_API.md)
- [Example Plugins](./plugins/)
- [Community Forum](https://community.dculus.com)

---

## 🆘 **Troubleshooting**

### **Plugin not showing in UI**

- Ensure `plugin.manifest.json` is valid
- Check plugin is exported as default in `backend/index.ts`
- Verify plugin directory is in `/plugins`

### **Execution errors**

- Check worker thread logs
- Verify configuration schema matches data
- Test plugin with `test()` method first

### **Configuration validation failing**

- Review Zod schema
- Check for typos in field names
- Ensure all required fields are provided

---

**Happy Plugin Development!** 🚀

**Version**: 1.0.0
**Last Updated**: 2025-01-10

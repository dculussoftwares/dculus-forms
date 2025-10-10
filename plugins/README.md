# Dculus Forms Plugins

A powerful, extensible plugin system for Dculus Forms that allows you to integrate with external services and automate workflows.

---

## 🚀 **Quick Start**

### **Installation**

```bash
# Install core dependencies
pnpm add bree emittery

# Generate Prisma schema
pnpm db:generate && pnpm db:push
```

### **Available Plugins**

| Plugin | Description | Category | Triggers |
|--------|-------------|----------|----------|
| [Email](./email/) | Send email notifications | Communication | form.submitted, response.edited |
| [Webhooks](./webhooks/) | Send data to custom endpoints | Webhooks & API | form.submitted, response.edited |
| [Google Sheets](./google-sheets/) | Sync responses to spreadsheets | Productivity | form.submitted |
| [Slack](./slack/) | Send Slack notifications | Communication | form.submitted, response.edited |

---

## 📖 **Documentation**

- **[Plugin Architecture](../PLUGIN_ARCHITECTURE.md)** - Complete technical architecture
- **[Development Guide](../PLUGIN_DEVELOPMENT_GUIDE.md)** - How to create plugins
- **[GraphQL API](../docs/GRAPHQL_API.md)** - Plugin API reference

---

## 🎯 **Features**

✅ **Event-Driven** - Plugins trigger on form events (submissions, updates, etc.)
✅ **Type-Safe** - Full TypeScript support with Zod validation
✅ **Persistent Jobs** - Jobs survive server restarts (MongoDB storage)
✅ **Worker Threads** - Non-blocking execution with Bree
✅ **Retry Logic** - Automatic retries with configurable attempts
✅ **Execution Logs** - Complete audit trail of all executions
✅ **Easy Config** - UI-based configuration with validation
✅ **No Redis Required** - Uses existing MongoDB database

---

## 🔧 **Usage**

### **1. Enable a Plugin**

Navigate to your form's plugins page:
```
/dashboard/form/{formId}/plugins
```

### **2. Configure the Plugin**

Click on a plugin card to open the configuration modal:

- **Email**: SMTP settings, recipients, templates
- **Webhooks**: Endpoint URL, headers, payload
- **Google Sheets**: Sheet ID, authentication
- **Slack**: Webhook URL, channel, message template

### **3. Test Configuration**

Use the "Test Connection" button to verify your settings before saving.

### **4. Save & Enable**

Save the configuration and toggle the plugin to enabled.

---

## 🔌 **Plugin Structure**

Each plugin follows this structure:

```
plugin-name/
├── package.json                 # Dependencies
├── plugin.manifest.json         # Metadata
├── README.md                    # Documentation
├── backend/
│   ├── index.ts                 # Main plugin class
│   ├── schema.ts                # Zod validation
│   └── utils.ts                 # Helper functions
└── frontend/
    ├── ConfigForm.tsx           # Configuration UI
    └── index.tsx                # Exports
```

---

## 📝 **Creating Your First Plugin**

### **1. Create Plugin Directory**

```bash
mkdir plugins/my-plugin
cd plugins/my-plugin
```

### **2. Create Manifest**

`plugin.manifest.json`:
```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "Plugin description",
  "category": "automation",
  "icon": "zap",
  "triggers": ["form.submitted"]
}
```

### **3. Implement Backend**

`backend/index.ts`:
```typescript
import { IPlugin, ExecutionContext, ExecutionResult } from '@dculus/plugins-core';
import { z } from 'zod';

const configSchema = z.object({
  apiKey: z.string().min(1)
});

export class MyPlugin implements IPlugin {
  id = 'my-plugin';
  name = 'My Plugin';
  version = '1.0.0';
  description = 'Plugin description';
  category = 'automation' as const;
  icon = 'zap';
  configSchema = configSchema;
  defaultConfig = { apiKey: '' };
  triggers = ['form.submitted'] as const;

  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    // Your logic here
    return { success: true, data: {} };
  }

  async validate(config: unknown) {
    try {
      this.configSchema.parse(config);
      return { valid: true };
    } catch (error: any) {
      return { valid: false, errors: error.errors };
    }
  }

  async test(config: unknown) {
    return { success: true, message: 'Test passed' };
  }
}

export default new MyPlugin();
```

### **4. Create Frontend Form**

`frontend/ConfigForm.tsx`:
```typescript
import React from 'react';
import { useForm } from 'react-hook-form';
import { Button, Input } from '@dculus/ui';

export const MyPluginConfigForm = ({ initialConfig, onSave }) => {
  const { register, handleSubmit } = useForm({
    defaultValues: initialConfig
  });

  return (
    <form onSubmit={handleSubmit(onSave)}>
      <Input label="API Key" {...register('apiKey')} />
      <Button type="submit">Save</Button>
    </form>
  );
};
```

See the [Development Guide](../PLUGIN_DEVELOPMENT_GUIDE.md) for detailed instructions.

---

## 🎨 **Plugin Categories**

### **Communication**
- Email notifications
- Slack messages
- SMS alerts
- WhatsApp messages

### **Productivity**
- Google Sheets sync
- Microsoft Excel export
- Airtable integration
- Notion database

### **Automation**
- n8n workflows
- Zapier webhooks
- Make.com scenarios

### **Webhooks & API**
- Custom webhooks
- REST API calls
- GraphQL mutations

---

## 🔒 **Security**

### **Configuration Encryption**

Sensitive fields (API keys, passwords) are encrypted before storage:

```typescript
// Automatic encryption for sensitive fields
const encryptedConfig = await encryptSensitiveFields(config, [
  'apiKey',
  'password',
  'secret'
]);
```

### **Input Validation**

All plugin configurations are validated using Zod schemas:

```typescript
const configSchema = z.object({
  endpoint: z.string().url().refine(
    url => url.startsWith('https://'),
    'Endpoint must use HTTPS'
  )
});
```

### **Rate Limiting**

Plugins are rate-limited to prevent abuse:
- Max 100 executions per hour per plugin
- Configurable retry delays

---

## 📊 **Monitoring & Logs**

### **Execution Logs**

View detailed logs for each plugin execution:
- Execution time
- Success/failure status
- Input/output data
- Error messages and stack traces

### **GraphQL Query**

```graphql
query GetPluginLogs($configId: ID!, $limit: Int) {
  pluginExecutionLogs(configId: $configId, limit: $limit) {
    id
    event
    status
    executedAt
    executionTime
    errorMessage
    outputData
  }
}
```

---

## 🔄 **Job Queue System**

### **How It Works**

1. **Event Trigger** - Form event occurs (e.g., submission)
2. **Job Creation** - Plugin job created in MongoDB
3. **Scheduling** - Bree schedules job for execution
4. **Worker Thread** - Job runs in isolated worker thread
5. **Logging** - Results stored in execution logs
6. **Retry** - Failed jobs automatically retry (3 attempts by default)

### **Server Restart Recovery**

Jobs persist in MongoDB and automatically recover on server restart:

```typescript
// On server start
await jobExecutor.initialize(); // Loads pending jobs from MongoDB
await bree.start();             // Reschedules all pending jobs
```

### **Graceful Shutdown**

```typescript
// On SIGTERM/SIGINT
await bree.stop();              // Stop accepting new jobs
await prisma.pluginJob.updateMany({
  where: { status: 'running' },
  data: { status: 'pending' }   // Mark running jobs as pending
});
```

---

## 🛠️ **Development Tools**

### **Testing Plugins**

```bash
# Run unit tests
pnpm test plugins/my-plugin

# Run integration tests
pnpm test:integration
```

### **Debugging**

Enable debug logs:
```bash
DEBUG=plugin:* pnpm dev
```

### **Hot Reload**

Plugins are automatically reloaded during development:
```bash
pnpm dev  # Watch mode enabled
```

---

## 📚 **API Reference**

### **Plugin Interface**

```typescript
interface IPlugin {
  id: string;
  name: string;
  version: string;
  description: string;
  category: PluginCategory;
  icon: string;
  configSchema: z.ZodSchema;
  defaultConfig: Record<string, any>;
  triggers: TriggerEvent[];

  execute(context: ExecutionContext): Promise<ExecutionResult>;
  validate(config: unknown): Promise<ValidationResult>;
  test(config: unknown): Promise<TestResult>;
}
```

### **Execution Context**

```typescript
interface ExecutionContext {
  pluginConfigId: string;
  event: TriggerEvent;
  payload: Record<string, any>;
  config: Record<string, any>;
  formId: string;
}
```

### **Trigger Events**

- `form.submitted` - Form response submitted
- `form.updated` - Form schema updated
- `response.edited` - Response data edited
- `response.deleted` - Response deleted

---

## 🤝 **Contributing**

We welcome plugin contributions!

### **Submission Process**

1. Fork the repository
2. Create your plugin in `plugins/your-plugin`
3. Add tests and documentation
4. Submit a pull request

### **Plugin Requirements**

✅ Full TypeScript implementation
✅ Zod schema validation
✅ Frontend configuration form
✅ Unit tests (>80% coverage)
✅ README with usage instructions
✅ Error handling and logging

---

## 🆘 **Troubleshooting**

### **Plugin not executing**

1. Check plugin is enabled in config
2. Verify trigger event matches
3. Review execution logs for errors
4. Test configuration using "Test Connection"

### **Jobs stuck in pending**

1. Check Bree is running: `await jobExecutor.initialize()`
2. Verify MongoDB connection
3. Check worker thread logs

### **Configuration not saving**

1. Validate schema matches form data
2. Check GraphQL mutation response
3. Verify user has permission to edit form

---

## 📖 **Learn More**

- [Plugin Architecture](../PLUGIN_ARCHITECTURE.md) - Technical deep-dive
- [Development Guide](../PLUGIN_DEVELOPMENT_GUIDE.md) - Build your own plugin
- [Example Plugins](./email/) - Reference implementations
- [GraphQL API](../docs/GRAPHQL_API.md) - API documentation

---

## 📞 **Support**

- **Documentation**: https://docs.dculus.com
- **Issues**: https://github.com/dculus/dculus-forms/issues
- **Community**: https://community.dculus.com
- **Email**: support@dculus.com

---

## 📜 **License**

MIT License - see [LICENSE.md](../LICENSE.md) for details.

---

**Built with ❤️ by the Dculus team**

**Version**: 1.0.0
**Last Updated**: 2025-01-10

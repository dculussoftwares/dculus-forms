# Hello World Plugin

A simple demo plugin that logs custom messages to the console when forms are submitted.

## Overview

**Plugin ID**: `hello-world`
**Category**: automation
**Version**: 1.0.0
**Status**: ✅ Production Ready

The Hello World plugin is the perfect starting point for understanding the dculus-forms plugin system. It demonstrates:
- Basic plugin structure
- Configuration schema with Zod
- Event handling (form.submitted)
- Lifecycle hooks
- Frontend configuration UI

## Features

- ✅ Custom message configuration
- ✅ Beautifully formatted console output
- ✅ Form submission event handling
- ✅ Enable/disable functionality
- ✅ Simple configuration UI

## Configuration

### Schema

```typescript
{
  message: string,      // Custom message to log (1-500 characters)
  isEnabled: boolean    // Whether the plugin is active (default: true)
}
```

### Example Configuration

```json
{
  "message": "New form submission received!",
  "isEnabled": true
}
```

## How It Works

1. **User submits a form** via the form viewer or API
2. **Backend emits `form.submitted` event** with form data
3. **Plugin receives the event** through the plugin registry
4. **Plugin retrieves its configuration** from the database
5. **Plugin logs formatted output** to the backend console

## Output Example

When a form is submitted, you'll see this in the backend console:

```
============================================================
🎉 HELLO WORLD PLUGIN TRIGGERED!
============================================================
📝 Message: Testing the Hello World plugin!
📋 Form ID: hj93jhebrg7mgkntaec
🆔 Response ID: dpm06b4l9lcmgmdyyup
🏢 Organization ID: uccz8mzLRfAoTXNJxngyGf31aNNJEY3l
⏰ Timestamp: 1/10/2025, 8:14:09 PM
============================================================
```

## Installation

### 1. Via Plugin Marketplace (Recommended)

1. Navigate to the plugins page:
   ```
   http://localhost:3000/dashboard/form/{formId}/plugins
   ```

2. Find "Hello World" in the available plugins

3. Click "Install"

4. Enter your custom message in the dialog

5. Click "Install Plugin"

### 2. Via GraphQL API

```graphql
mutation InstallHelloWorld {
  installPlugin(input: {
    formId: "your-form-id"
    pluginId: "hello-world"
    organizationId: "your-org-id"
    config: {
      message: "Hello from my form!"
      isEnabled: true
    }
  }) {
    id
    pluginId
    isEnabled
    config
  }
}
```

## Configuration

### Via Plugin Marketplace

1. Go to plugins page for your form
2. Find Hello World in installed plugins section
3. Click "Configure"
4. Update the message
5. Click "Save Changes"

### Via GraphQL API

```graphql
mutation UpdateHelloWorld {
  updatePluginConfig(input: {
    formId: "your-form-id"
    pluginId: "hello-world"
    organizationId: "your-org-id"
    config: {
      message: "Updated message!"
      isEnabled: true
    }
  }) {
    id
    config
    updatedAt
  }
}
```

## Testing

### 1. Install Plugin

```bash
# Start servers
pnpm dev

# Login: testing@testing.com / testing@testing.com
# Navigate to: http://localhost:3000/dashboard/form/{formId}/plugins
# Install Hello World plugin with message: "Testing!"
```

### 2. Submit Form

```bash
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { submitResponse(input: {formId: \"your-form-id\", data: {name: \"Test User\"}}) { id } }"
  }'
```

### 3. Check Console Output

Look for the formatted output in your backend console logs.

## Implementation Details

### Backend Files

**[index.ts](index.ts)** - Plugin Class
```typescript
export class HelloWorldPlugin extends BasePlugin {
  constructor() {
    super({
      id: 'hello-world',
      name: 'Hello World',
      description: 'A simple plugin that logs a custom message...',
      icon: '👋',
      category: 'automation',
      version: '1.0.0',
    });
  }

  getConfigSchema() {
    return helloWorldConfigSchema;
  }

  async onFormSubmitted(event: FormSubmittedEvent): Promise<void> {
    const config = await this.getConfig(event.formId);
    // Logs formatted output with config.message
  }
}
```

**[schema.ts](schema.ts)** - Configuration Schema
```typescript
export const helloWorldConfigSchema = z.object({
  message: z.string().min(1).max(500),
  isEnabled: z.boolean().default(true),
});

export type HelloWorldConfig = z.infer<typeof helloWorldConfigSchema>;
```

### Frontend Files

**apps/form-app/src/plugins/hello-world/ConfigDialog.tsx**
- React component for configuration UI
- Text input for custom message
- Live preview of console output
- Save/cancel buttons

## Use Cases

### 1. Learning Plugin Development

Perfect first plugin to study when learning the plugin system:
- Simple, focused functionality
- Clear code structure
- Comprehensive comments
- Minimal external dependencies

### 2. Testing Plugin System

Use Hello World to verify:
- Plugin registration works
- Event emission works
- Configuration persistence works
- Frontend integration works

### 3. Debugging Form Submissions

Enable Hello World on a form to:
- Verify forms are submitting correctly
- See submission timestamps
- Check form and response IDs
- Debug event flow

### 4. Monitoring Development

During development:
- Track when test forms are submitted
- Verify form data is being processed
- Debug timing issues
- Monitor server logs

## Troubleshooting

### Plugin not logging anything

**Check**:
1. Is plugin installed for the form?
2. Is plugin enabled (`isEnabled: true`)?
3. Did form submission succeed?
4. Is backend console visible?

**Solution**:
```bash
# Check plugin config in database
# Navigate to plugin marketplace
# Verify "ENABLED" badge appears
# Submit test form via GraphQL
# Watch backend console logs
```

### Output format is wrong

**Check**:
1. Using latest version of plugin?
2. Configuration includes `message` field?

**Solution**:
```bash
# Reinstall plugin
# Update configuration
# Test again
```

### Can't find plugin in marketplace

**Check**:
1. Plugin registered in `apps/backend/src/index.ts`?
2. Backend server restarted?

**Solution**:
```typescript
// apps/backend/src/index.ts
pluginRegistry.register(new HelloWorldPlugin());
await pluginRegistry.initialize();
```

## Extending This Plugin

Want to add more features? Here are some ideas:

### 1. Conditional Messages

```typescript
async onFormSubmitted(event: FormSubmittedEvent): Promise<void> {
  const config = await this.getConfig(event.formId);

  // Different messages based on form data
  const name = event.data.name;
  const message = name
    ? `Hello ${name}! ${config.message}`
    : config.message;

  console.log('📝 Message:', message);
}
```

### 2. Count Submissions

```typescript
private submissionCounts = new Map<string, number>();

async onFormSubmitted(event: FormSubmittedEvent): Promise<void> {
  const count = (this.submissionCounts.get(event.formId) || 0) + 1;
  this.submissionCounts.set(event.formId, count);

  console.log('📊 Total Submissions:', count);
}
```

### 3. Log to File

```typescript
import fs from 'fs';

async onFormSubmitted(event: FormSubmittedEvent): Promise<void> {
  const logEntry = {
    timestamp: event.submittedAt,
    formId: event.formId,
    responseId: event.responseId,
    message: config.message,
  };

  fs.appendFileSync(
    'form-submissions.log',
    JSON.stringify(logEntry) + '\n'
  );
}
```

## Related Documentation

- [Plugin Development Guide](../../../../../PLUGIN_DEVELOPMENT_GUIDE.md) - Complete tutorial
- [Plugin System Documentation](../../../../../PLUGIN_SYSTEM_DOCUMENTATION.md) - Architecture
- [Plugins Directory README](../README.md) - All plugins overview
- [Base Plugin Class](../base/BasePlugin.ts) - Parent class reference

## Contributing

Want to improve this plugin? Contributions welcome!

1. Make your changes
2. Test thoroughly
3. Update this README
4. Submit a pull request

## License

Part of the dculus-forms project.

---

**Happy Testing! 👋**

For questions or issues, see:
- [Project Documentation](../../../../../CLAUDE.md)
- [Plugin System Documentation](../../../../../PLUGIN_SYSTEM_DOCUMENTATION.md)

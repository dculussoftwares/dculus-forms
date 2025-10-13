# Hello World External Plugin

A simple example external plugin for dculus-forms that demonstrates the bundle-based plugin architecture.

## Features

- ✅ **Customizable Greeting**: Configure your own greeting message
- ✅ **Configurable Logging**: Choose what data to display in logs
- ✅ **Enable/Disable Toggle**: Turn the plugin on/off per form
- ✅ **Organization-Scoped**: Automatic data isolation using PluginContext
- ✅ **Dynamic UI**: React configuration component loaded on-demand

## What This Plugin Does

When a form is submitted, this plugin:
1. Logs a customizable greeting message
2. Shows form title and response ID
3. Displays organization information
4. Optionally shows timestamp and response data

## Development

### Prerequisites

- Node.js >= 18
- npm or pnpm

### Setup

```bash
# Install dependencies
npm install

# Build the plugin
npm run build

# Serve locally for testing
npm run serve
```

### Build Output

The build process creates three files in `dist/`:

1. **`plugin.backend.js`** - Backend logic (ESM bundle for Node.js)
2. **`plugin.config.js`** - Config UI (UMD bundle for browser)
3. **`manifest.json`** - Plugin metadata

### Project Structure

```
hello-world-plugin/
├── src/
│   ├── backend/
│   │   └── index.ts          # Plugin logic (extends BasePlugin)
│   └── frontend/
│       └── ConfigUI.tsx      # Configuration UI (React component)
├── dist/                      # Build output (generated)
│   ├── plugin.backend.js
│   ├── plugin.config.js
│   └── manifest.json
├── manifest.json              # Plugin metadata
├── build.js                   # Build script using esbuild
├── package.json
└── README.md
```

## Installation in Dculus Forms

### Option 1: Local Development

```bash
# 1. Build the plugin
npm run build

# 2. Serve it locally
npm run serve
# Plugin available at: http://localhost:3001

# 3. In dculus-forms UI:
#    - Go to Plugins → Install from URL
#    - Enter: http://localhost:3001
#    - Click Install
```

### Option 2: Deploy to CDN/GitHub Pages

```bash
# 1. Build the plugin
npm run build

# 2. Deploy dist/ directory to:
#    - GitHub Pages
#    - Cloudflare Pages
#    - AWS S3 + CloudFront
#    - Any static hosting

# 3. Install using your public URL:
#    https://your-domain.com/plugins/hello-world
```

## Configuration Options

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `greeting` | string | "Hello World" | Greeting message shown in logs |
| `showTimestamp` | boolean | `true` | Show submission timestamp |
| `showResponseData` | boolean | `true` | Show form response data |
| `isEnabled` | boolean | `true` | Enable/disable plugin |

## Example Output

When a form is submitted with this plugin enabled:

```
======================================================================
👋 HELLO WORLD - EXTERNAL PLUGIN!
======================================================================
⏰ Timestamp: 10/12/2025, 12:00:00 PM
📋 Form: "Contact Form" (form-123)
🆔 Response ID: resp-456
🏢 Organization: "Acme Corp" (org-789)
📊 Response Data:
{
  "name": "John Doe",
  "email": "john@example.com",
  "message": "Hello!"
}
======================================================================
```

## Plugin Architecture

This plugin demonstrates the **external plugin system** architecture:

### Backend (`src/backend/index.ts`)

- Extends `BasePlugin` from `@dculus/plugin-sdk`
- Implements `onFormSubmitted()` event handler
- Defines configuration schema with Zod
- Uses `PluginContext` for org-scoped data access

### Frontend (`src/frontend/ConfigUI.tsx`)

- React component for plugin configuration
- Simple form with inputs and checkboxes
- Live preview of greeting message
- Props: `config` (current values) and `onChange` (update callback)

### Manifest (`manifest.json`)

- Plugin metadata (id, name, description, etc.)
- Bundle file paths
- Version and author information
- Permissions (for future use)

## Advanced Usage

### Extending This Plugin

You can modify this plugin to:

1. **Send Webhooks**: POST data to external APIs
2. **Email Notifications**: Send emails via SendGrid/Mailgun
3. **Database Storage**: Store responses in external DB
4. **Analytics**: Track submission metrics
5. **Integrations**: Connect to Slack, Discord, etc.

### Example: Adding Webhook Support

```typescript
// In src/backend/index.ts

async onFormSubmitted(event, context) {
  const config = await this.getConfig(event.formId);
  const response = await context.getResponse(event.responseId);

  // Send to webhook
  await fetch(config.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      formId: event.formId,
      responseId: event.responseId,
      data: response.data
    })
  });
}
```

## Troubleshooting

### Build Fails

- Check Node.js version (>= 18 required)
- Run `npm install` to ensure dependencies are installed
- Check TypeScript errors: `npx tsc --noEmit`

### Plugin Not Loading

- Verify manifest.json is valid JSON
- Check bundle paths in manifest match build output
- Ensure CORS is enabled on hosting server
- Check browser console for errors

### Plugin Not Triggering

- Verify plugin is enabled for the form
- Check `isEnabled` is set to `true` in config
- Look for plugin logs in backend console
- Verify form submission is successful

## Contributing

Feel free to use this plugin as a template for your own external plugins!

## License

MIT

## Resources

- [Dculus Forms Plugin Documentation](../../EXTERNAL_PLUGIN_SYSTEM.md)
- [Plugin SDK Reference](../../packages/plugin-sdk/README.md)
- [Plugin Development Guide](../../EXTERNAL_PLUGIN_IMPLEMENTATION_CHECKLIST.md)

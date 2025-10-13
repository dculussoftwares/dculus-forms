# External Plugins Directory

This directory contains example external plugins for dculus-forms that demonstrate the bundle-based plugin architecture.

## Available Plugins

### 1. Hello World Plugin

**Location**: `hello-world-plugin/`

A simple example plugin that demonstrates:
- ✅ Customizable greeting messages
- ✅ Organization-scoped data access via PluginContext
- ✅ React-based configuration UI
- ✅ ESM backend bundle + UMD frontend bundle
- ✅ Complete build and deployment workflow

**Quick Start**:
```bash
cd hello-world-plugin
npm install
npm run build
npm run serve
```

Plugin available at: `http://localhost:3001`

## Plugin Architecture

External plugins follow this structure:

```
my-plugin/
├── src/
│   ├── backend/
│   │   └── index.ts          # Plugin logic (extends BasePlugin)
│   └── frontend/
│       └── ConfigUI.tsx      # Config UI (React component)
├── dist/                      # Build output
│   ├── plugin.backend.js     # Backend bundle (ESM)
│   ├── plugin.config.js      # Frontend bundle (UMD)
│   └── manifest.json         # Plugin metadata
├── manifest.json              # Source manifest
├── build.js                   # Build script
├── package.json
└── README.md
```

## Installation in Dculus Forms

### Option 1: Local Testing

```bash
# 1. Build the plugin
cd hello-world-plugin
npm run build

# 2. Serve it locally
npm run serve

# 3. In dculus-forms UI:
#    - Go to Plugins → Install from URL
#    - Enter: http://localhost:3001
#    - Click Install
```

### Option 2: Production Deployment

```bash
# 1. Build the plugin
npm run build

# 2. Deploy dist/ directory to:
#    - GitHub Pages
#    - Cloudflare Pages
#    - AWS S3 + CloudFront
#    - Vercel
#    - Netlify
#    - Any static hosting

# 3. Install using public URL:
#    https://your-domain.com/plugins/my-plugin
```

## Creating Your Own Plugin

### Method 1: Clone Hello World Template

```bash
# Copy the hello-world-plugin
cp -r hello-world-plugin my-awesome-plugin
cd my-awesome-plugin

# Update manifest.json with your plugin details
# Update src/backend/index.ts with your logic
# Update src/frontend/ConfigUI.tsx with your UI

# Build and test
npm install
npm run build
npm run serve
```

### Method 2: Use Plugin SDK (Future)

```bash
# Once @dculus/plugin-sdk is published
npx @dculus/plugin-sdk init my-awesome-plugin
cd my-awesome-plugin
npm install
npm run build
```

## Plugin Development Guidelines

### Backend Plugin (`src/backend/index.ts`)

**Must Have**:
- Default export class extending `BasePlugin`
- Constructor with plugin metadata
- `getConfigSchema()` method returning Zod schema
- `onFormSubmitted()` method with event handler logic

**Can Use**:
- `PluginContext` methods:
  - `getForm(formId)` - Get form details
  - `getResponse(responseId)` - Get response data
  - `listResponses(formId, limit)` - List form responses
  - `getOrganization()` - Get organization details
  - `getOrganizationId()` - Get org ID
  - `getFormId()` - Get form ID

**Should NOT**:
- Access file system directly
- Use `eval()` or `Function()` constructor
- Import Node.js built-ins (bundle them instead)
- Access other organizations' data

### Frontend Config UI (`src/frontend/ConfigUI.tsx`)

**Must Have**:
- Default export React component
- Props: `{ config, onChange }`
- Handle user input and call `onChange(newConfig)`

**Can Use**:
- React hooks (useState, useEffect, etc.)
- Standard HTML elements
- Inline styles or CSS-in-JS
- External libraries (must be bundled)

**Should NOT**:
- Import React (it's external - provided by host)
- Use dculus-forms internal components
- Make API calls directly (use backend instead)

### Manifest (`manifest.json`)

**Required Fields**:
- `id` - Unique kebab-case identifier
- `name` - Display name
- `description` - Short description (max 200 chars)
- `icon` - Emoji or icon
- `category` - Plugin category
- `version` - Semantic version (x.y.z)
- `author` - Author information
- `license` - License identifier (SPDX)
- `bundles.backend` - Backend bundle filename
- `bundles.frontend` - Frontend bundle filename

**Optional Fields**:
- `homepage` - Plugin homepage URL
- `repository` - Source code repository
- `permissions` - Required permissions (future use)
- `minVersion` - Minimum dculus-forms version
- `maxVersion` - Maximum dculus-forms version

## Build Process

Plugins use **esbuild** to create two bundles:

### Backend Bundle (ESM)

```javascript
esbuild.build({
  entryPoints: ['src/backend/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  outfile: 'dist/plugin.backend.js',
  external: [], // Bundle everything
  minify: true,
});
```

### Frontend Bundle (UMD/IIFE)

```javascript
esbuild.build({
  entryPoints: ['src/frontend/ConfigUI.tsx'],
  bundle: true,
  platform: 'browser',
  format: 'iife',
  globalName: 'PluginConfig',
  target: 'es2020',
  outfile: 'dist/plugin.config.js',
  external: ['react', 'react-dom'], // React is external
  minify: true,
  jsx: 'automatic',
});
```

## Testing Plugins

### 1. Unit Tests (Backend)

Test your plugin logic in isolation:

```typescript
import { describe, it, expect } from 'vitest';
import MyPlugin from './src/backend/index';

describe('MyPlugin', () => {
  it('should have correct metadata', () => {
    const plugin = new MyPlugin();
    expect(plugin.metadata.id).toBe('my-plugin');
  });

  it('should validate config schema', () => {
    const plugin = new MyPlugin();
    const result = plugin.validateConfig({
      isEnabled: true,
      someField: 'value'
    });
    expect(result.success).toBe(true);
  });
});
```

### 2. Integration Tests

Test plugin installation and execution:

```bash
# 1. Build plugin
npm run build

# 2. Serve locally
npm run serve

# 3. Install in dculus-forms (manual or automated)
# 4. Configure plugin for a test form
# 5. Submit form and verify plugin triggered
# 6. Check logs for expected output
```

### 3. Manual Testing Checklist

- [ ] Build succeeds without errors
- [ ] Manifest.json is valid JSON
- [ ] Backend bundle exports default class
- [ ] Frontend bundle renders without errors
- [ ] Plugin installs successfully via URL
- [ ] Config UI loads and functions correctly
- [ ] Plugin triggers on form submission
- [ ] Expected output appears in logs
- [ ] Plugin can be disabled/enabled
- [ ] Plugin can be uninstalled

## Common Issues

### Build Errors

**Problem**: `Cannot find module 'BasePlugin'`
**Solution**: Check import paths - use relative paths for internal codebase

**Problem**: `React is not defined`
**Solution**: Ensure React is marked as `external` in frontend build

**Problem**: `Transform failed with 1 error`
**Solution**: Check TypeScript errors: `npx tsc --noEmit`

### Installation Errors

**Problem**: `Failed to fetch manifest`
**Solution**: Check CORS is enabled on hosting server

**Problem**: `Invalid plugin manifest`
**Solution**: Validate manifest.json against schema

**Problem**: `Plugin already installed`
**Solution**: Uninstall existing plugin first or use update

### Runtime Errors

**Problem**: Plugin doesn't trigger on form submission
**Solution**: Check `isEnabled` is true in plugin config

**Problem**: `Organization access denied`
**Solution**: PluginContext automatically scopes - don't access other org data

**Problem**: Config UI doesn't load
**Solution**: Check browser console for import errors

## Documentation

- **Architecture Guide**: [../../EXTERNAL_PLUGIN_SYSTEM.md](../../EXTERNAL_PLUGIN_SYSTEM.md)
- **Implementation Checklist**: [../../EXTERNAL_PLUGIN_IMPLEMENTATION_CHECKLIST.md](../../EXTERNAL_PLUGIN_IMPLEMENTATION_CHECKLIST.md)
- **Plugin SDK**: `packages/plugin-sdk/README.md` (coming soon)

## Example Plugins Ideas

### Simple Plugins
- ✅ Hello World (completed)
- Email notifications via SendGrid
- Slack notifications via webhook
- Discord notifications
- Console logger with filters

### Integration Plugins
- Google Sheets export
- Airtable sync
- Notion database update
- Webhook POST to custom API
- Zapier integration

### Advanced Plugins
- Form analytics tracker
- Response PDF generator
- Auto-responder email
- CRM integration (Salesforce, HubSpot)
- Payment processing (Stripe webhook)

## Contributing

Want to contribute an example plugin?

1. Create your plugin in this directory
2. Follow the structure of `hello-world-plugin`
3. Include comprehensive README
4. Test thoroughly
5. Submit PR

## Support

For questions about plugin development:
- Read the [main documentation](../../EXTERNAL_PLUGIN_SYSTEM.md)
- Check [implementation checklist](../../EXTERNAL_PLUGIN_IMPLEMENTATION_CHECKLIST.md)
- Review `hello-world-plugin` source code
- Open an issue on GitHub

## License

All example plugins in this directory are MIT licensed.

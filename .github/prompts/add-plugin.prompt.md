---
description: "Add a new plugin to the form plugin system"
mode: "agent"
---

# Add New Form Plugin

Follow these steps to add a new built-in plugin type (e.g., Slack, Discord, Zapier):

## Step 1: Create Plugin Handler

Create `apps/backend/src/plugins/{pluginType}/handler.ts`:

```typescript
import { PluginHandler, PluginExecutionContext } from '../types';

export const myPluginHandler: PluginHandler = {
  type: 'my-plugin',
  
  async execute(context: PluginExecutionContext) {
    const { plugin, event, form, response } = context;
    const config = plugin.config as MyPluginConfig;
    
    // Plugin logic here
    
    return {
      success: true,
      data: { /* result data */ },
    };
  },
  
  async validate(config: unknown) {
    // Validate plugin configuration
    return true;
  },
};
```

## Step 2: Register Plugin

In `apps/backend/src/plugins/registry.ts`:

```typescript
import { myPluginHandler } from './my-plugin/handler';

registry.register(myPluginHandler);
```

## Step 3: Create Plugin Config UI

Create `apps/form-app/src/components/plugins/MyPluginConfig.tsx`:

```typescript
export function MyPluginConfig({ plugin, onSave }: PluginConfigProps) {
  // Configuration form UI
}
```

## Step 4: Create Plugin Dialog

Create `apps/form-app/src/components/plugins/MyPluginDialog.tsx` for the setup dialog.

## Step 5: Add Translations

Create translation files:
- `apps/form-app/src/locales/en/myPluginConfig.json`
- `apps/form-app/src/locales/en/myPluginDialog.json`

Register in `apps/form-app/src/locales/index.ts`.

## Step 6: Register in Plugin List

Update `apps/form-app/src/pages/Plugins.tsx` to include the new plugin type.

# Plugin System Architecture

## Overview

The Dculus Forms plugin system provides an extensible, event-driven architecture for integrating external services and automating workflows. The system uses a unified database schema with JSON configuration, making it easy to add new plugin types without schema changes.

## Core Principles

1. **Single Source of Truth**: One `FormPlugin` table stores all plugin types
2. **Event-Driven**: Plugins react to form events (submissions, tests)
3. **Plugin Registry**: Self-registering plugins with automatic discovery
4. **PluginContext**: Injected context with helper functions for easy plugin development
5. **Type-Safe**: Full TypeScript support with discriminated unions
6. **Functional**: Pure functions, easy to test and maintain
7. **Generic API**: Same GraphQL mutations/queries work for all plugins
8. **No Auto-Retry**: Plugins execute once, failures are logged for manual review

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Event Sources                            │
│  (Form Submission, Form Update, Response Edit, etc.)            │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │ emitPluginEvent()
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Plugin Event Emitter                          │
│              (Node.js EventEmitter pattern)                      │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │ event listeners
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Plugin Executor                             │
│  1. Query enabled plugins for this form + event                 │
│  2. Get handler from registry                                    │
│  3. Execute handler                                              │
│  4. Log success/failure to PluginDelivery                        │
└──────────────────────┬──────────────────────────────────────────┘
                       │
         ┌─────────────┼─────────────┬─────────────┐
         │             │             │             │
         ▼             ▼             ▼             ▼
   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
   │ Webhook │   │  Email  │   │  Slack  │   │ Custom  │
   │ Handler │   │ Handler │   │ Handler │   │ Handler │
   └─────────┘   └─────────┘   └─────────┘   └─────────┘
         │             │             │             │
         └─────────────┴─────────────┴─────────────┘
                       │
                       ▼
            ┌──────────────────────┐
            │  PluginDelivery Log  │
            │  (success/failure)   │
            └──────────────────────┘
```

---

## Database Schema

### FormPlugin Model

Single unified table storing all plugin configurations:

```prisma
model FormPlugin {
  id        String   @id @map("_id")
  formId    String   // Reference to Form
  type      String   // "webhook", "email", "slack", etc.
  name      String   // User-friendly name (e.g., "Notify Sales Team")
  enabled   Boolean  @default(true)
  config    Json     // Plugin-specific configuration (flexible)
  events    String[] // Events that trigger this plugin
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  form       Form             @relation(fields: [formId], references: [id], onDelete: Cascade)
  deliveries PluginDelivery[]

  @@index([formId])
  @@index([type])
  @@index([enabled])
  @@map("form_plugin")
}
```

**Key Fields:**
- `type`: Plugin type identifier (webhook, email, slack, custom)
- `name`: User-friendly label shown in UI
- `enabled`: Toggle plugin on/off without deleting
- `config`: JSON object containing plugin-specific settings
- `events`: Array of event types that trigger this plugin

**Example Records:**

```json
// Webhook plugin
{
  "id": "plugin_abc123",
  "formId": "form_xyz789",
  "type": "webhook",
  "name": "CRM Integration",
  "enabled": true,
  "config": {
    "url": "https://api.example.com/webhook",
    "secret": "abc123xyz",
    "headers": {
      "X-API-Key": "my-api-key"
    }
  },
  "events": ["form.submitted"]
}

// Email plugin (future)
{
  "id": "plugin_def456",
  "formId": "form_xyz789",
  "type": "email",
  "name": "Admin Notification",
  "enabled": true,
  "config": {
    "recipientEmail": "admin@example.com",
    "subject": "New Form Submission",
    "sendToSubmitter": false
  },
  "events": ["form.submitted"]
}
```

### PluginDelivery Model

Tracks every plugin execution attempt:

```prisma
model PluginDelivery {
  id           String   @id @map("_id")
  pluginId     String   // Reference to FormPlugin
  eventType    String   // "form.submitted", "form.updated", etc.
  status       String   // "success", "failed"
  payload      Json     // Event data sent to plugin
  response     Json?    // Response from plugin (if applicable)
  errorMessage String?  // Error details if failed
  deliveredAt  DateTime @default(now())

  plugin FormPlugin @relation(fields: [pluginId], references: [id], onDelete: Cascade)

  @@index([pluginId])
  @@index([eventType])
  @@index([status])
  @@index([deliveredAt])
  @@map("plugin_delivery")
}
```

**Key Fields:**
- `status`: Either "success" or "failed" (no pending state)
- `payload`: Copy of event data sent to plugin
- `response`: Plugin execution result (webhook response, email delivery status, etc.)
- `errorMessage`: Error details for debugging failed executions

---

## Event System

### Available Events

**Currently Supported Events:**

| Event Type | When Triggered | Payload Data |
|------------|---------------|--------------|
| `form.submitted` | User submits form response | `{ formId, responseId, organizationId }` |
| `plugin.test` | Manual test trigger from UI | `{ formId, organizationId, test: true, triggeredBy: userId }` |

**Future Events** (not yet implemented):

| Event Type | When Triggered | Payload Data |
|------------|---------------|--------------|
| `form.created` | New form created | `{ formId, organizationId, createdById }` |
| `form.updated` | Form schema/settings changed | `{ formId, organizationId, changes }` |
| `response.edited` | Existing response edited | `{ responseId, formId, changes }` |
| `response.deleted` | Response deleted | `{ responseId, formId }` |
| `form.published` | Form published status changed | `{ formId, organizationId, isPublished }` |

### Event Payload Structure

```typescript
interface PluginEvent {
  type: 'form.submitted' | 'plugin.test';  // Currently supported event types
  formId: string;                          // Form ID
  organizationId: string;                  // Organization ID
  data: Record<string, any>;               // Event-specific data
  timestamp: Date;                         // When event occurred
}
```

**Event-Specific Data:**
- **form.submitted**: `{ responseId: string }`
- **plugin.test**: `{ test: true, triggeredBy: string }`

### Event Flow

1. **Trigger**: Event occurs (form submission, update, etc.)
2. **Emit**: `emitPluginEvent(eventType, data)` called from resolver
3. **Listen**: EventEmitter routes to registered listener
4. **Execute**: Plugin executor queries enabled plugins and runs handlers
5. **Log**: Results logged to `PluginDelivery` table

---

## Plugin Registry Pattern

### Registry Structure

The plugin registry maps plugin types to their handler functions:

```typescript
// apps/backend/src/plugins/registry.ts
export const pluginRegistry: Record<string, PluginHandler> = {
  webhook: executeWebhook,
  email: executeEmail,     // Future
  slack: executeSlack,     // Future
  custom: executeCustom,   // Future
};
```

### Handler Function Signature

```typescript
type PluginHandler = (
  plugin: { config: PluginConfig },
  event: PluginEvent,
  context: PluginContext  // Injected context with helpers
) => Promise<any>;
```

**Handler Requirements:**
- Must be async function
- Receives plugin config, event data, and context
- Returns result object (any structure)
- Throws error on failure
- Should be pure function (no side effects except external API calls)
- Use context helpers instead of importing services directly

### Dynamic Handler Resolution

```typescript
const handler = getPluginHandler(plugin.type);
const context = createPluginContext(); // Create context with helpers
const result = await handler(plugin, event, context); // Pass context
```

No hard-coded switch statements - registry automatically routes to correct handler. Context is created once and injected into all plugin handlers.

---

## PluginContext

Every plugin handler receives a **PluginContext** object with helper functions, eliminating the need to import services directly in plugins.

### Context Interface

```typescript
interface PluginContext {
  // Database access
  prisma: PrismaClient;

  // Service helpers (pre-bound functions)
  getFormById: (formId: string) => Promise<Form | null>;
  getResponseById: (responseId: string) => Promise<FormResponse | null>;
  getResponsesByFormId: (formId: string) => Promise<FormResponse[]>;

  // Organization helpers
  getOrganization: (orgId: string) => Promise<Organization | null>;

  // User helpers
  getUserById: (userId: string) => Promise<User | null>;

  // Logger (automatically prefixed with [Plugin])
  logger: {
    info: (message: string, meta?: any) => void;
    error: (message: string, error?: any) => void;
    warn: (message: string, meta?: any) => void;
  };
}
```

### Usage in Plugin Handlers

```typescript
export const executeMyPlugin: PluginHandler = async (plugin, event, context) => {
  // Get form details using context
  const form = await context.getFormById(event.formId);
  context.logger.info(`Processing form: ${form?.title}`);

  // Get response data if available
  if (event.data.responseId) {
    const response = await context.getResponseById(event.data.responseId);
    context.logger.info('Response data:', response.data);
  }

  // Get organization for additional context
  const organization = await context.getOrganization(event.organizationId);
  context.logger.info(`Organization: ${organization?.name}`);

  // Direct prisma access for advanced queries
  const pluginCount = await context.prisma.formPlugin.count({
    where: { formId: event.formId },
  });
  context.logger.info(`Total plugins for this form: ${pluginCount}`);

  // Your plugin logic here
  return { success: true };
};
```

### Context Creation

The context is created once by the plugin executor before running plugins:

```typescript
// In executor.ts
const context = createPluginContext();

for (const plugin of plugins) {
  const handler = getPluginHandler(plugin.type);
  const result = await handler(plugin, event, context);
}
```

### Benefits of PluginContext

✅ **No service imports** - Context provides all needed functions
✅ **Consistent API** - All plugins use same helpers
✅ **Easy testing** - Simple to mock context for unit tests
✅ **Type safety** - Full TypeScript support
✅ **Logging** - Built-in logger with [Plugin] prefix
✅ **Flexibility** - Direct prisma access for advanced queries
✅ **Maintainability** - Update context in one place, all plugins benefit

---

## Adding a New Plugin (Developer Guide)

### Step 1: Define Plugin Types

Create `apps/backend/src/plugins/<plugin-name>/types.ts`:

```typescript
import { PluginConfig } from '../types';

export interface MyPluginConfig extends PluginConfig {
  type: 'my-plugin';
  apiKey: string;
  endpoint?: string;
  // Add any config fields needed
}

export const MY_PLUGIN_TYPE = 'my-plugin';
```

### Step 2: Implement Plugin Handler

Create `apps/backend/src/plugins/<plugin-name>/handler.ts`:

```typescript
import { PluginHandler } from '../registry';
import { MyPluginConfig } from './types';

export const executeMyPlugin: PluginHandler = async (plugin, event, context) => {
  const config = plugin.config as MyPluginConfig;

  try {
    // Use context to get form details
    const form = await context.getFormById(event.formId);
    context.logger.info(`Executing MyPlugin for form: ${form?.title}`);

    // Your plugin logic here
    const result = await callExternalAPI(config, event, context);

    context.logger.info('MyPlugin executed successfully');
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    context.logger.error('MyPlugin failed', error);
    throw new Error(`MyPlugin failed: ${error.message}`);
  }
};

// Helper functions (can use context if needed)
const callExternalAPI = async (
  config: MyPluginConfig,
  event: PluginEvent,
  context: PluginContext
) => {
  // Can access context.prisma, context.logger, etc.
  // Implementation
};
```

### Step 3: Register Plugin

Update `apps/backend/src/plugins/registry.ts`:

```typescript
import { executeMyPlugin } from './my-plugin/handler';
import { MY_PLUGIN_TYPE } from './my-plugin/types';

export const pluginRegistry = {
  webhook: executeWebhook,
  [MY_PLUGIN_TYPE]: executeMyPlugin, // Add here
};
```

### Step 4: Add TypeScript Types

Update `packages/types/src/index.ts`:

```typescript
// Add to PluginConfig union
export type PluginConfig =
  | WebhookConfig
  | EmailConfig
  | MyPluginConfig; // Add here

export interface MyPluginConfig {
  apiKey: string;
  endpoint?: string;
}

export type PluginType = 'webhook' | 'email' | 'my-plugin';
```

### Step 5: Create Frontend UI

Create `apps/form-app/src/plugins/<plugin-name>/components/MyPluginDialog.tsx`:

```typescript
export const MyPluginDialog = ({ onSave, initialData }) => {
  const { register, handleSubmit } = useForm({
    defaultValues: initialData?.config || {},
  });

  const onSubmit = (data) => {
    onSave({
      type: 'my-plugin',
      name: data.name,
      config: {
        apiKey: data.apiKey,
        endpoint: data.endpoint,
      },
      events: ['form.submitted'],
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Input {...register('name')} placeholder="Plugin Name" />
      <Input {...register('apiKey')} type="password" placeholder="API Key" />
      <Input {...register('endpoint')} placeholder="Endpoint URL" />
      <Button type="submit">Save Plugin</Button>
    </form>
  );
};
```

### Step 6: Update Plugins Page

Add your plugin to the type selector in `apps/form-app/src/pages/Plugins.tsx`.

---

## Webhook Plugin Implementation

### Configuration

```typescript
interface WebhookPluginConfig {
  type: 'webhook';
  url: string;              // Webhook endpoint URL
  secret?: string;          // HMAC signature secret
  headers?: Record<string, string>; // Custom HTTP headers
}
```

### Features

- **HTTP POST** to configured URL
- **HMAC-SHA256 signature** in `X-Webhook-Signature` header
- **10 second timeout** for webhook requests
- **Minimal payload** (IDs only, not full form data)
- **Custom headers** support for authentication

### Payload Format

```json
{
  "event": "form.submitted",
  "formId": "form_abc123",
  "responseId": "response_xyz789",
  "organizationId": "org_def456",
  "timestamp": "2025-10-17T10:30:00Z"
}
```

### Security

**HMAC Signature Generation:**

```typescript
const signature = crypto
  .createHmac('sha256', secret)
  .update(JSON.stringify(payload))
  .digest('hex');

headers['X-Webhook-Signature'] = `sha256=${signature}`;
```

**Webhook Receiver Verification:**

```javascript
// Node.js example
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expectedSignature = `sha256=${crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex')}`;

  return signature === expectedSignature;
}
```

### Error Handling

- **Timeout**: 10s abort signal
- **Non-2xx responses**: Logged as failure with status code
- **Network errors**: Logged with error message
- **No retries**: Failed deliveries logged for manual review

---

## GraphQL API

### Queries

#### Get Form Plugins

```graphql
query GetFormPlugins($formId: ID!) {
  formPlugins(formId: $formId) {
    id
    type
    name
    enabled
    config
    events
    createdAt
    updatedAt
  }
}
```

#### Get Plugin Delivery Log

```graphql
query GetPluginDeliveries($pluginId: ID!, $limit: Int) {
  pluginDeliveries(pluginId: $pluginId, limit: $limit) {
    id
    eventType
    status
    payload
    response
    errorMessage
    deliveredAt
  }
}
```

#### Get Available Plugin Types

```graphql
query GetAvailablePluginTypes {
  availablePluginTypes
}
```

### Mutations

#### Create Plugin

```graphql
mutation CreatePlugin($input: CreatePluginInput!) {
  createPlugin(input: $input) {
    id
    type
    name
    enabled
    config
    events
  }
}
```

**Input:**
```json
{
  "formId": "form_abc123",
  "type": "webhook",
  "name": "CRM Integration",
  "config": {
    "url": "https://api.example.com/webhook",
    "secret": "abc123"
  },
  "events": ["form.submitted"]
}
```

#### Update Plugin

```graphql
mutation UpdatePlugin($id: ID!, $input: UpdatePluginInput!) {
  updatePlugin(id: $id, input: $input) {
    id
    name
    enabled
    config
    events
  }
}
```

#### Delete Plugin

```graphql
mutation DeletePlugin($id: ID!) {
  deletePlugin(id: $id) {
    success
  }
}
```

#### Test Plugin

```graphql
mutation TestPlugin($id: ID!) {
  testPlugin(id: $id) {
    success
    message
  }
}
```

Triggers plugin with test event for manual verification.

---

## Frontend Components

### Plugins Page Structure

```
Plugins.tsx
├── Plugin Type Selector (Webhook, Email, etc.)
├── PluginsList
│   ├── Plugin Card
│   │   ├── Name, Type, Status
│   │   ├── Enable/Disable Toggle
│   │   ├── Edit Button
│   │   ├── Delete Button
│   │   └── View Deliveries Button
│   └── Add Plugin Button
└── Plugin Dialog (Modal)
    ├── WebhookDialog
    ├── EmailDialog (future)
    └── CustomDialog (future)
```

### Webhook Dialog Fields

- **Name**: User-friendly label
- **Webhook URL**: HTTP endpoint
- **Secret**: HMAC signature key (optional)
- **Custom Headers**: Key-value pairs
- **Events**: Checkboxes for event subscriptions
- **Test Button**: Manual test trigger

### Delivery Log Component

Table with columns:
- **Timestamp**: When delivery occurred
- **Event**: Event type that triggered plugin
- **Status**: Badge (success/failed)
- **Response**: HTTP status code and body (expandable)
- **Error**: Error message (if failed)

---

## Best Practices

### Plugin Development

✅ **DO:**
- Use PluginContext helpers instead of importing services
- Use pure functions for handlers
- Return structured results for logging
- Handle errors gracefully with descriptive messages
- Validate config before execution
- Use TypeScript for type safety
- Add timeout to external API calls
- Use context.logger for all logging
- Document config fields in interface
- Use context.getFormById() instead of direct prisma queries when possible

❌ **DON'T:**
- Don't import services directly (use context instead)
- Don't modify global state
- Don't retry automatically (system logs failures)
- Don't expose sensitive data in logs
- Don't block event loop with long operations
- Don't assume config is valid
- Don't use synchronous operations
- Don't bypass context helpers unless necessary

### Configuration Security

- **Never log secrets**: Redact sensitive config fields in logs
- **Use environment variables**: For shared secrets
- **Encrypt at rest**: Consider encrypting config JSON in database
- **HMAC signatures**: Always use for webhooks
- **HTTPS only**: Validate webhook URLs start with https://

### Error Handling

```typescript
export const executeMyPlugin: PluginHandler = async (plugin, event, context) => {
  const config = plugin.config as MyPluginConfig;

  // Validate config
  if (!config.apiKey) {
    context.logger.error('API key is required');
    throw new Error('API key is required');
  }

  try {
    // Log execution start
    context.logger.info(`Executing plugin for form: ${event.formId}`);

    // Get form details using context
    const form = await context.getFormById(event.formId);
    context.logger.info(`Form title: ${form?.title}`);

    // Add timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const result = await fetch(config.endpoint, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Check response
    if (!result.ok) {
      context.logger.error(`API returned ${result.status}`);
      throw new Error(`API returned ${result.status}`);
    }

    context.logger.info('Plugin executed successfully');
    return { success: true, data: await result.json() };
  } catch (error) {
    // Log error using context
    context.logger.error('Plugin execution failed', error);
    // Don't expose internal details
    throw new Error(`Plugin execution failed: ${error.message}`);
  }
};
```

### Testing

**Unit Test Handler:**

```typescript
import { executeMyPlugin } from './handler';

test('executeMyPlugin handles success', async () => {
  const plugin = {
    config: { type: 'my-plugin', apiKey: 'test' }
  };

  const event = {
    type: 'form.submitted',
    formId: 'form-123',
    organizationId: 'org-123',
    data: { responseId: 'resp-123' },
    timestamp: new Date(),
  };

  const result = await executeMyPlugin(plugin, event);
  expect(result.success).toBe(true);
});
```

**Integration Test:**

```typescript
// 1. Create plugin via GraphQL
const { data } = await createPlugin({
  variables: {
    input: {
      formId: 'form-123',
      type: 'webhook',
      name: 'Test Webhook',
      config: { url: 'https://webhook.site/xxx' },
      events: ['form.submitted'],
    },
  },
});

// 2. Trigger event (submit form)
await submitResponse({ formId: 'form-123', data: {} });

// 3. Check delivery log
const deliveries = await getPluginDeliveries({
  variables: { pluginId: data.createPlugin.id },
});

expect(deliveries.data.pluginDeliveries[0].status).toBe('success');
```

---

## Configuration Validation

Use Zod schemas for runtime config validation:

```typescript
import { z } from 'zod';

const webhookConfigSchema = z.object({
  type: z.literal('webhook'),
  url: z.string().url(),
  secret: z.string().optional(),
  headers: z.record(z.string()).optional(),
});

export const validateWebhookConfig = (config: unknown) => {
  return webhookConfigSchema.parse(config);
};
```

Use in handler:

```typescript
export const executeWebhook: PluginHandler = async (plugin, event) => {
  const config = validateWebhookConfig(plugin.config);
  // Now config is validated and type-safe
};
```

---

## Debugging

### Enable Debug Logging

```bash
DEBUG=plugins:* pnpm backend:dev
```

### Check Plugin Execution

```typescript
console.log(`[${plugin.type}] Executing for event: ${event.type}`);
console.log(`[${plugin.type}] Config:`, JSON.stringify(config, null, 2));
console.log(`[${plugin.type}] Result:`, result);
```

### Query Recent Deliveries

```graphql
query RecentDeliveries($pluginId: ID!) {
  pluginDeliveries(pluginId: $pluginId, limit: 20) {
    status
    errorMessage
    deliveredAt
  }
}
```

---

## File Structure

```
apps/backend/src/plugins/
├── types.ts              # Core plugin types (PluginEvent, PluginConfig, etc.)
├── context.ts            # PluginContext factory (createPluginContext)
├── registry.ts           # Plugin registry (pluginRegistry, getPluginHandler)
├── executor.ts           # Plugin executor (executePlugins, creates context)
├── events.ts             # Event system (pluginEventEmitter, emitPluginEvent)
├── webhooks/
│   ├── types.ts          # Webhook-specific types (WebhookPluginConfig)
│   └── handler.ts        # Webhook handler (executeWebhook - uses context)
├── email/               # Future
│   ├── types.ts
│   └── handler.ts
└── slack/               # Future
    ├── types.ts
    └── handler.ts

apps/form-app/src/plugins/
├── webhooks/
│   ├── components/
│   │   ├── WebhookDialog.tsx
│   │   ├── WebhooksList.tsx
│   │   └── DeliveryLog.tsx
│   └── hooks/
│       └── useWebhooks.ts
└── email/               # Future
    └── components/
        └── EmailDialog.tsx
```

---

## Future Enhancements

### Plugin Marketplace
- Browse community plugins
- One-click installation
- Version management

### Advanced Features
- **Conditional Execution**: Run plugins based on form data conditions
- **Rate Limiting**: Throttle plugin executions
- **Retry Logic**: Optional exponential backoff
- **Batching**: Group multiple events into single delivery
- **Webhooks v2**: Support for response transformation, filtering

### Additional Plugin Types
- **Email**: Send notifications via SMTP/SendGrid
- **Slack**: Post to Slack channels
- **Zapier**: Integration with Zapier workflows
- **Google Sheets**: Append rows to spreadsheet
- **Airtable**: Create records in Airtable base
- **Custom API**: Generic HTTP API integration

---

## Performance Considerations

### Database Indexes
- `FormPlugin`: Indexed on `formId`, `type`, `enabled`
- `PluginDelivery`: Indexed on `pluginId`, `eventType`, `status`, `deliveredAt`

### Query Optimization
- Limit delivery log queries (default 50 records)
- Use pagination for large delivery histories
- Cache available plugin types

### Async Execution
- Plugins execute asynchronously (don't block response)
- Event emission is fire-and-forget
- Failed plugins don't affect form submission

---

## Security Considerations

### Authentication
- All GraphQL mutations require authentication
- Users can only manage plugins for forms they own
- Plugin execution uses server-side credentials (not exposed to client)

### Secrets Management
- Never log sensitive config fields
- Consider using environment variables for shared secrets
- Encrypt sensitive config data in database (future enhancement)

### Webhook Security
- Always use HTTPS for webhook URLs
- Implement HMAC signature verification
- Validate webhook URLs before saving
- Rate limit webhook requests

### Data Privacy
- Minimal payload approach (IDs only)
- Don't send sensitive form data to external services by default
- Log only necessary information in PluginDelivery

---

## Plugin Metadata System

### Overview

Plugins can store execution results and custom data in form response records using a **generic metadata system**. This allows any plugin to persist data without requiring database schema changes.

### Metadata Storage Structure

Response metadata is stored as a JSON field where each plugin type has its own key:

```json
{
  "metadata": {
    "quiz-grading": {
      "quizScore": 10,
      "totalMarks": 15,
      "percentage": 66.7,
      "fieldResults": [...],
      "gradedAt": "2025-01-15T10:30:00Z"
    },
    "email": {
      "deliveryStatus": "sent",
      "sentAt": "2025-01-15T10:30:05Z"
    },
    "custom-plugin": {
      "customData": {...}
    }
  }
}
```

**Key Benefits:**
- ✅ **Extensible** - Any plugin can add metadata without schema changes
- ✅ **Isolated** - Each plugin's data is separate under its own key
- ✅ **Type-Safe** - Plugin-specific TypeScript interfaces for compile-time safety
- ✅ **Flexible** - Runtime JSON storage for flexibility
- ✅ **Backward Compatible** - Metadata field is optional

### Storing Metadata from Plugin Handler

Plugins can update response metadata using the PluginContext:

```typescript
export const myPluginHandler: PluginHandler = async (plugin, event, context) => {
  const config = plugin.config as MyPluginConfig;
  const METADATA_KEY = 'my-plugin';

  // 1. Get response
  const response = await context.getResponseById(event.data.responseId);

  // 2. Perform plugin action
  const result = await performMyPluginAction(config, event);

  // 3. Store metadata using plugin type as key
  const existingMetadata = (response.metadata as any) || {};
  const updatedMetadata = {
    ...existingMetadata,
    [METADATA_KEY]: {
      // Your plugin-specific metadata
      customField1: result.data,
      customField2: new Date().toISOString(),
      // ... any JSON-serializable data
    },
  };

  // 4. Update response
  await context.prisma.response.update({
    where: { id: response.id },
    data: { metadata: updatedMetadata },
  });

  context.logger.info('Metadata stored successfully');

  return result;
};
```

### TypeScript Type Definitions

Define plugin-specific metadata interfaces for type safety:

```typescript
// Generic plugin metadata type (packages/types/src/index.ts)
export type PluginMetadata = Record<string, any>;

// Plugin-specific metadata interface
export interface MyPluginMetadata {
  customField1: string;
  customField2: string;
  processedAt: string;
  success: boolean;
}

// Update FormResponse interface
export interface FormResponse {
  id: string;
  formId: string;
  data: Record<string, any>;
  metadata?: PluginMetadata;  // Generic metadata for all plugins
  submittedAt: Date;
  // ... other fields
}
```

### GraphQL Schema

The Response type includes a generic metadata field:

```graphql
type Response {
  id: ID!
  formId: ID!
  data: JSON!
  metadata: JSON  # Generic JSON for all plugin metadata
  submittedAt: DateTime!
  # ... other fields
}
```

**No plugin-specific types in GraphQL** - keeps schema generic and extensible.

### Frontend Metadata Viewer Registry

Create a registry system to map plugin types to viewer components:

```typescript
// apps/form-app/src/components/response-metadata/MetadataViewerRegistry.tsx

import React from 'react';
import { QuizGradingMetadataViewer } from './QuizGradingMetadataViewer';
import { EmailMetadataViewer } from './EmailMetadataViewer';

// Registry mapping plugin types to viewer components
const METADATA_VIEWERS: Record<string, React.ComponentType<any>> = {
  'quiz-grading': QuizGradingMetadataViewer,
  'email': EmailMetadataViewer,
  // Add your custom plugin viewers here
};

interface MetadataViewerProps {
  metadata: Record<string, any>;
}

export const MetadataViewer: React.FC<MetadataViewerProps> = ({ metadata }) => {
  if (!metadata || Object.keys(metadata).length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {Object.entries(metadata).map(([pluginType, pluginMetadata]) => {
        const ViewerComponent = METADATA_VIEWERS[pluginType];

        if (!ViewerComponent) {
          // Fallback for unknown plugin types
          return (
            <Card key={pluginType}>
              <CardHeader>
                <CardTitle>Plugin Metadata: {pluginType}</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto">
                  {JSON.stringify(pluginMetadata, null, 2)}
                </pre>
              </CardContent>
            </Card>
          );
        }

        return <ViewerComponent key={pluginType} metadata={pluginMetadata} />;
      })}
    </div>
  );
};
```

### Plugin-Specific Metadata Viewer

Create a viewer component for each plugin type:

```typescript
// apps/form-app/src/components/response-metadata/MyPluginMetadataViewer.tsx

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@dculus/ui';

interface MyPluginMetadataViewerProps {
  metadata: {
    customField1: string;
    customField2: string;
    processedAt: string;
    success: boolean;
  };
}

export const MyPluginMetadataViewer: React.FC<MyPluginMetadataViewerProps> = ({
  metadata,
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>My Plugin Results</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <p><strong>Status:</strong> {metadata.success ? 'Success' : 'Failed'}</p>
          <p><strong>Field 1:</strong> {metadata.customField1}</p>
          <p><strong>Field 2:</strong> {metadata.customField2}</p>
          <p><strong>Processed:</strong> {new Date(metadata.processedAt).toLocaleString()}</p>
        </div>
      </CardContent>
    </Card>
  );
};
```

### Using Metadata Viewer in Response Pages

Display metadata in response viewer:

```typescript
// apps/form-app/src/pages/ResponsesIndividual.tsx

import { MetadataViewer } from '../components/response-metadata/MetadataViewerRegistry';

export const ResponsesIndividual = () => {
  const { data: response } = useQuery(GET_RESPONSE_BY_ID, { ... });

  return (
    <div>
      {/* Response Data */}
      <ResponseDataCard response={response} />

      {/* Plugin Metadata (dynamically rendered) */}
      {response.metadata && (
        <MetadataViewer metadata={response.metadata} />
      )}
    </div>
  );
};
```

### Dynamic Table Columns

Add metadata-based columns to responses table:

```typescript
// apps/form-app/src/pages/Responses.tsx

const columns = [
  // ... existing columns

  // Dynamic metadata column
  {
    accessorKey: 'metadata',
    header: 'Plugin Results',
    cell: ({ row }) => {
      const metadata = row.original.metadata;

      // Example: Show quiz score if quiz-grading metadata exists
      if (metadata && metadata['quiz-grading']) {
        const quiz = metadata['quiz-grading'];
        return (
          <Badge variant={quiz.percentage >= 60 ? 'success' : 'destructive'}>
            {quiz.quizScore} / {quiz.totalMarks}
          </Badge>
        );
      }

      return <span className="text-muted-foreground">-</span>;
    },
  },
];
```

### Best Practices

**DO:**
- ✅ Use plugin type as metadata key for isolation
- ✅ Define TypeScript interfaces for metadata structure
- ✅ Preserve existing metadata when updating
- ✅ Log metadata updates with context.logger
- ✅ Validate metadata before storage
- ✅ Register metadata viewer in MetadataViewerRegistry
- ✅ Handle missing/corrupted metadata gracefully

**DON'T:**
- ❌ Overwrite entire metadata object (preserve other plugins' data)
- ❌ Store sensitive data in metadata (use encrypted storage)
- ❌ Store large binary data (use file storage)
- ❌ Assume metadata structure without validation
- ❌ Hard-code metadata keys across plugins

### Example: Quiz Grading Plugin

Complete example of metadata usage in quiz grading plugin:

**Backend Handler:**
```typescript
// apps/backend/src/plugins/quiz/handler.ts

export const quizGradingHandler: PluginHandler = async (plugin, event, context) => {
  const config = plugin.config as QuizGradingPluginConfig;
  const METADATA_KEY = 'quiz-grading';

  // Get response
  const response = await context.getResponseById(event.data.responseId);

  // Grade quiz
  const quizMetadata = gradeQuizResponse(config.quizFields, response.data);

  // Update metadata
  const existingMetadata = (response.metadata as any) || {};
  await context.prisma.response.update({
    where: { id: response.id },
    data: {
      metadata: {
        ...existingMetadata,
        [METADATA_KEY]: {
          quizScore: quizMetadata.quizScore,
          totalMarks: quizMetadata.totalMarks,
          percentage: quizMetadata.percentage,
          fieldResults: quizMetadata.fieldResults,
          gradedAt: new Date().toISOString(),
          gradedBy: 'plugin',
        },
      },
    },
  });

  return { success: true };
};
```

**Frontend Viewer:**
```typescript
// apps/form-app/src/components/response-metadata/QuizGradingMetadataViewer.tsx

export const QuizGradingMetadataViewer: React.FC<Props> = ({ metadata }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quiz Results</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center mb-4">
          <div className="text-5xl font-bold">
            {metadata.quizScore} / {metadata.totalMarks}
          </div>
          <div className="text-2xl text-muted-foreground">
            {metadata.percentage.toFixed(1)}%
          </div>
          <Badge variant={metadata.percentage >= 60 ? 'success' : 'destructive'}>
            {metadata.percentage >= 60 ? 'PASSED' : 'FAILED'}
          </Badge>
        </div>

        {/* Field results breakdown */}
        {metadata.fieldResults.map((result, idx) => (
          <div key={idx} className="border rounded p-3 mb-2">
            <div className="font-medium">{result.fieldLabel}</div>
            <div className={result.isCorrect ? 'text-green-600' : 'text-red-600'}>
              Your answer: {result.userAnswer}
            </div>
            {!result.isCorrect && (
              <div className="text-green-600">
                Correct: {result.correctAnswer}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
```

**Registry:**
```typescript
// apps/form-app/src/components/response-metadata/MetadataViewerRegistry.tsx

const METADATA_VIEWERS = {
  'quiz-grading': QuizGradingMetadataViewer,
  // ... other viewers
};
```

See [QUIZ_GRADING_PLUGIN.md](./QUIZ_GRADING_PLUGIN.md) for complete implementation details.

### Multiple Plugins with Metadata

Multiple plugins can store metadata for the same response:

```json
{
  "metadata": {
    "quiz-grading": {
      "quizScore": 8,
      "totalMarks": 10,
      "percentage": 80
    },
    "email": {
      "notificationSent": true,
      "recipientEmail": "teacher@school.com",
      "sentAt": "2025-01-15T10:30:05Z"
    },
    "custom-analytics": {
      "completionTime": 120,
      "deviceType": "mobile",
      "location": "USA"
    }
  }
}
```

Each plugin's metadata is isolated and doesn't interfere with others.

---

## Support & Resources

### Documentation
- This file: `PLUGIN_SYSTEM.md` - Architecture overview
- `apps/backend/src/plugins/PLUGIN_DEVELOPMENT_GUIDE.md` - Developer guide
- Webhook example: `apps/backend/src/plugins/webhooks/`

### Code Examples
- Complete webhook implementation in `plugins/webhooks/`
- Generic plugin executor in `plugins/executor.ts`
- Frontend components in `apps/form-app/src/plugins/webhooks/`

### Getting Help
- Review existing plugin implementations
- Check GraphQL schema documentation
- Examine delivery logs for debugging
- Test plugins using `testPlugin` mutation

---

## Changelog

### v1.0 (Initial Release)
- Single unified FormPlugin table with JSON config
- **PluginContext with helper functions** - No service imports needed in plugins
- Event-driven architecture with EventEmitter
- **Two events**: `form.submitted` and `plugin.test`
- Plugin registry pattern for automatic discovery
- Webhook plugin with HMAC signature support
- GraphQL API for plugin management
- Delivery log tracking
- Frontend UI for webhook configuration

### v1.1 (Generic Metadata System)
- **Generic plugin metadata storage** - Response.metadata JSON field
- **Plugin-type-based metadata keys** - Each plugin stores under own key
- **Metadata viewer registry** - Dynamic frontend rendering by plugin type
- **Type-safe yet flexible** - TypeScript interfaces + runtime JSON storage
- **Backward compatible** - Metadata is optional
- Email plugin implementation
- Quiz auto-grading plugin (see QUIZ_GRADING_PLUGIN.md)

### Future Releases
- **Frontend PluginContext** for UI plugins
- **Additional events**: form.created, form.updated, response.edited, etc.
- Slack plugin
- Retry logic (optional)
- Conditional execution
- Plugin marketplace
- Metadata export/analytics

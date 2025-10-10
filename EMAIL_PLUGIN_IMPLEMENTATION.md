# Event-Driven Email Plugin Implementation
## Complete Implementation Summary

---

## 🎯 Overview

Successfully implemented a **production-ready, event-driven plugin system** for Dculus Forms with an **email notification plugin** as the first implementation. The system uses:

- **Emittery** - Event bus for decoupled communication
- **Bree** - Background job scheduler with worker threads
- **MongoDB** - Job persistence (no Redis required)
- **Worker Threads** - Isolated plugin execution

---

## 📦 Architecture Summary

### Event Flow
```
Form Submission → Event Bus (Emittery) → Job Queue (MongoDB) → Bree Worker → Email Plugin → Send Email
```

### Key Components

1. **Event Bus** (`apps/backend/src/lib/event-bus.ts`)
   - Emittery-based event system
   - Supports: `form.submitted`, `form.updated`, `response.edited`, `response.deleted`
   - Plugin job lifecycle events

2. **Job Executor** (`apps/backend/src/lib/job-executor.ts`)
   - Bree integration for background jobs
   - Loads pending jobs from MongoDB on startup
   - Handles retry logic (3 attempts by default)
   - Graceful shutdown support

3. **Plugin Worker** (`apps/backend/src/workers/plugin-worker.ts`)
   - Executes in isolated worker thread
   - Handles plugin execution with error handling
   - Updates job status and logs execution results

4. **Plugin Listener** (`apps/backend/src/lib/plugin-listener.ts`)
   - Listens to event bus events
   - Creates jobs for enabled plugins
   - Filters by trigger events

---

## 🗄️ Database Schema

Added three new collections to MongoDB:

### PluginConfig
```prisma
model PluginConfig {
  id             String   @id
  formId         String
  pluginId       String   // "email"
  pluginVersion  String
  enabled        Boolean
  config         Json     // Plugin settings
  triggerEvents  String[] // Events that trigger this plugin
  createdById    String
  createdAt      DateTime
  updatedAt      DateTime
}
```

### PluginJob
```prisma
model PluginJob {
  id              String    @id
  pluginConfigId  String
  jobName         String    @unique
  status          String    // pending, running, completed, failed
  scheduledFor    DateTime
  attempts        Int
  maxAttempts     Int
  payload         Json
}
```

### PluginExecutionLog
```prisma
model PluginExecutionLog {
  id              String   @id
  pluginConfigId  String
  event           String
  status          String
  executedAt      DateTime
  executionTime   Int
  errorMessage    String?
  outputData      Json?
}
```

---

## 🔌 Email Plugin Implementation

### Plugin Structure
```
plugins/email/
├── plugin.manifest.json       # Plugin metadata
├── backend/
│   └── schema.ts              # Zod validation schema
└── (frontend components TBD)
```

### Email Executor (`apps/backend/src/plugins/email-executor.ts`)

**Features:**
- Uses existing nodemailer configuration
- Field substitution with `{{fieldId}}` syntax
- Beautiful HTML email template
- Optional copy to form submitter
- Full form response data display

**Configuration Schema:**
```typescript
{
  recipientEmail: string (email)
  subject: string
  message: string
  sendToSubmitter?: boolean
  submitterEmailFieldId?: string
}
```

---

## 🚀 GraphQL API

### Queries
```graphql
formPlugins(formId: ID!): [PluginConfig!]!
formPlugin(id: ID!): PluginConfig
pluginExecutionLogs(pluginConfigId: ID!, limit: Int): [PluginExecutionLog!]!
```

### Mutations
```graphql
createFormPlugin(input: CreateFormPluginInput!): PluginConfig!
updateFormPlugin(input: UpdateFormPluginInput!): PluginConfig!
toggleFormPlugin(id: ID!, enabled: Boolean!): PluginConfig!
deleteFormPlugin(id: ID!): Boolean!
```

### Resolvers (`apps/backend/src/graphql/resolvers/plugins.ts`)
- Permission checks for organization membership
- CRUD operations for plugin configurations
- Execution log retrieval

---

## 🔄 Integration Points

### 1. Form Submission Event Emission
**File:** `apps/backend/src/graphql/resolvers/responses.ts:190-199`

```typescript
// Emit plugin event for form submission
await eventBus.emit('form.submitted', {
  formId: input.formId,
  responseId: response.id,
  data: input.data
});
```

### 2. Plugin System Initialization
**File:** `apps/backend/src/index.ts:237-240`

```typescript
// Initialize plugin system
await jobExecutor.initialize();
setupPluginListeners(jobExecutor);
console.log('🔌 Plugin system initialized');
```

### 3. Graceful Shutdown
**File:** `apps/backend/src/index.ts:243-255`

```typescript
process.on('SIGTERM', async () => {
  await jobExecutor.gracefulShutdown();
  await prisma.$disconnect();
  process.exit(0);
});
```

---

## 📝 Implementation Files

### Core System
- `apps/backend/src/lib/event-bus.ts` - Event bus with Emittery
- `apps/backend/src/lib/job-executor.ts` - Bree job executor
- `apps/backend/src/lib/plugin-listener.ts` - Event → Job bridge
- `apps/backend/src/workers/plugin-worker.ts` - Worker thread

### Email Plugin
- `plugins/email/plugin.manifest.json` - Manifest
- `plugins/email/backend/schema.ts` - Config schema
- `apps/backend/src/plugins/email-executor.ts` - Execution logic

### GraphQL
- `apps/backend/src/graphql/schema.ts` - Types (lines 782-921)
- `apps/backend/src/graphql/resolvers/plugins.ts` - Resolvers
- `apps/backend/src/graphql/resolvers.ts` - Integration

### Database
- `apps/backend/prisma/schema.prisma` - Models (lines 350-420)

---

## ✅ Testing Guide

### 1. Create Email Plugin Configuration

```graphql
mutation CreateEmailPlugin {
  createFormPlugin(input: {
    formId: "your-form-id"
    pluginId: "email"
    config: {
      recipientEmail: "admin@example.com"
      subject: "New Form Submission: {{name}}"
      message: "You received a new submission!"
      sendToSubmitter: false
    }
    triggerEvents: ["form.submitted"]
  }) {
    id
    enabled
  }
}
```

### 2. Enable the Plugin

```graphql
mutation EnablePlugin {
  toggleFormPlugin(
    id: "plugin-config-id"
    enabled: true
  ) {
    id
    enabled
  }
}
```

### 3. Submit a Form Response

When a form is submitted, the system will:
1. ✅ Emit `form.submitted` event
2. ✅ Create a plugin job in MongoDB
3. ✅ Execute job in worker thread
4. ✅ Send email via nodemailer
5. ✅ Log execution result

### 4. Check Execution Logs

```graphql
query GetPluginLogs {
  pluginExecutionLogs(pluginConfigId: "plugin-config-id", limit: 10) {
    id
    status
    executedAt
    executionTime
    errorMessage
    outputData
  }
}
```

---

## 🔍 How It Works

### Complete Flow Example

**Step 1: Form Submission**
```
User submits form → GraphQL submitResponse mutation executed
```

**Step 2: Event Emission**
```typescript
// In responses.ts:190
await eventBus.emit('form.submitted', {
  formId: 'abc123',
  responseId: 'xyz789',
  data: { name: 'John', email: 'john@example.com' }
});
```

**Step 3: Plugin Listener**
```typescript
// In plugin-listener.ts
eventBus.on('form.submitted', async ({ formId, responseId, data }) => {
  // Find enabled email plugins for this form
  const configs = await prisma.pluginConfig.findMany({
    where: { formId, enabled: true, triggerEvents: { has: 'form.submitted' }}
  });

  // Create job for each plugin
  for (const config of configs) {
    await jobExecutor.createJob({
      pluginConfigId: config.id,
      event: 'form.submitted',
      payload: { formId, responseId, data }
    });
  }
});
```

**Step 4: Job Execution**
```typescript
// In plugin-worker.ts - runs in isolated worker thread
const config = await prisma.pluginConfig.findUnique({ where: { id } });

if (config.pluginId === 'email') {
  const { executeEmailPlugin } = await import('../plugins/email-executor.js');
  result = await executeEmailPlugin({
    pluginConfigId: config.id,
    event: 'form.submitted',
    payload: data,
    config: config.config,
    formId: config.formId
  });
}
```

**Step 5: Email Sending**
```typescript
// In email-executor.ts
const transporter = nodemailer.createTransport({ ... });

await transporter.sendMail({
  to: config.recipientEmail,
  subject: renderTemplate(config.subject, payload),
  html: renderEmailTemplate(config.message, payload, form.title)
});
```

**Step 6: Logging**
```typescript
// Worker sends result to main thread
parentPort?.postMessage({
  type: 'job.completed',
  jobId,
  result,
  executionTime
});

// Main thread logs execution
await prisma.pluginExecutionLog.create({
  data: {
    pluginConfigId,
    event: 'form.submitted',
    status: 'success',
    executionTime,
    outputData: result
  }
});
```

---

## 🎨 Email Template Features

The email plugin sends beautifully formatted HTML emails:

- **Header** - Form title and submission notification
- **Custom Message** - With field substitution support
- **Submission Details Table** - All form field values
- **Timestamp** - Submission date and time
- **Footer** - Branding

**Template Variables:**
- Use `{{fieldId}}` in subject or message
- Automatically replaced with submitted values
- Falls back to `{{fieldId}}` if field not found

---

## 🎨 Frontend Integration

### Plugin Management UI
The frontend now includes a complete plugin management interface integrated with the GraphQL API.

**Files Added:**
- `apps/form-app/src/graphql/plugins.graphql.ts` - GraphQL queries and mutations
- `apps/form-app/src/components/EmailPluginModal.tsx` - Email plugin configuration modal
- `packages/ui/src/switch.tsx` - Switch component for enable/disable toggle

**Files Modified:**
- `apps/form-app/src/pages/FormPlugins.tsx` - Updated to fetch and display real plugin data
- `packages/ui/src/index.ts` - Added Switch component export

### Features Implemented

**1. Plugin Display (`apps/form-app/src/pages/FormPlugins.tsx:293-359`)**
- Fetches configured plugins from GraphQL API
- Displays enabled/disabled status
- Shows trigger events as badges
- Enable/disable toggle with Switch component
- Configure button to edit plugin settings

**2. Email Plugin Configuration Modal (`apps/form-app/src/components/EmailPluginModal.tsx`)**
- Create new email plugin configuration
- Edit existing plugin settings
- Field validation with error messages
- Field substitution support ({{fieldId}} syntax)
- Send copy to submitter option
- Real-time configuration updates

**3. Available Integrations Section (`apps/form-app/src/pages/FormPlugins.tsx:469-534`)**
- Shows email plugin with "Configure" button if not configured
- Shows "Configured" badge if plugin already exists
- Displays placeholder integrations for upcoming plugins

### GraphQL Integration

**Queries:**
```typescript
GET_FORM_PLUGINS - Fetch all plugins for a form
GET_PLUGIN_EXECUTION_LOGS - Fetch execution logs
```

**Mutations:**
```typescript
CREATE_FORM_PLUGIN - Create new plugin configuration
UPDATE_FORM_PLUGIN - Update plugin settings
TOGGLE_FORM_PLUGIN - Enable/disable plugin
DELETE_FORM_PLUGIN - Remove plugin configuration
```

### User Flow

1. **Navigate to Plugins**: User goes to `/dashboard/form/{formId}/plugins`
2. **Configure Email Plugin**: Click "Configure" on Email integration card
3. **Fill Configuration**: Enter recipient email, subject, message
4. **Enable Plugin**: Toggle switch to enable the plugin
5. **Test**: Submit a form response to trigger email sending

### Toast Notifications
- Success: "Email plugin created" / "Email plugin updated"
- Error: "Failed to create plugin" with error message
- Enable/Disable: "Plugin enabled" / "Plugin disabled"

## 🚀 Next Steps

### Additional Plugins
Based on the same architecture, you can easily add:
- **Webhooks Plugin** - POST data to custom endpoints
- **Slack Plugin** - Send Slack notifications
- **Google Sheets Plugin** - Sync responses to spreadsheets
- **SMS Plugin** - Send SMS notifications

### Plugin Development Template
```typescript
// plugins/your-plugin/backend/index.ts
export async function executeYourPlugin(context: ExecutionContext) {
  const { config, payload } = context;

  try {
    // Your plugin logic here
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Update worker to support new plugin
if (config.pluginId === 'your-plugin') {
  const { executeYourPlugin } = await import('../plugins/your-plugin.js');
  result = await executeYourPlugin(context);
}
```

---

## 🔒 Security & Best Practices

✅ **Implemented:**
- Permission checks for all plugin operations
- Organization membership validation
- Event-driven decoupling
- Worker thread isolation
- Graceful shutdown handling
- Retry logic with max attempts
- Execution logging for audit trail

🔐 **Recommendations:**
- Encrypt sensitive config fields (API keys, passwords)
- Implement rate limiting per plugin
- Add plugin execution timeouts
- Validate plugin configurations with Zod
- Monitor plugin performance metrics

---

## 📊 Benefits of This Architecture

✅ **Scalability** - Worker threads don't block main process
✅ **Reliability** - Jobs persist in MongoDB, survive restarts
✅ **Extensibility** - Easy to add new plugins
✅ **Monitoring** - Full execution logs
✅ **Maintainability** - Clean separation of concerns
✅ **No New Infrastructure** - Uses existing MongoDB
✅ **Event-Driven** - Loose coupling between components

---

## 🎉 Summary

You now have a **production-ready, n8n-style event-driven plugin system** with:

1. ✅ **Event Bus** (Emittery) - For decoupled event communication
2. ✅ **Job Queue** (Bree + MongoDB) - For reliable background execution
3. ✅ **Worker Threads** - For isolated plugin execution
4. ✅ **Email Plugin** - Working implementation with templates
5. ✅ **GraphQL API** - Full CRUD operations for plugins
6. ✅ **Execution Logs** - Complete audit trail
7. ✅ **Graceful Shutdown** - Proper cleanup on server restart
8. ✅ **Retry Logic** - Automatic retries on failure

The system is **independent**, **extensible**, and **production-ready**! 🚀

---

**Implementation Date:** October 10, 2025
**Architecture Pattern:** Event-Driven Microservices with Background Jobs
**Technology Stack:** Bree + Emittery + MongoDB + Worker Threads

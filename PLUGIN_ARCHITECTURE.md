# Plugin Architecture Documentation
## Technology Stack: Bree + MongoDB + Emittery (No Redis, No New Servers)

---

## 📦 **Core Libraries**

```json
{
  "bree": "^9.1.3",              // Job scheduler with worker threads
  "emittery": "^1.0.3",          // Async event emitter
  "zod": "^3.22.4"               // Schema validation (already installed)
}
```

---

## 📁 **Directory Structure**

```
/plugins/                                    # Root plugins directory
├── core/                                    # Core plugin system
│   ├── package.json
│   ├── src/
│   │   ├── types/
│   │   │   ├── plugin.interface.ts         # Base plugin interface
│   │   │   ├── execution-context.ts        # Execution context types
│   │   │   └── index.ts
│   │   ├── registry/
│   │   │   ├── plugin-registry.ts          # Plugin discovery & registration
│   │   │   └── index.ts
│   │   ├── executor/
│   │   │   ├── job-executor.ts             # Bree job executor
│   │   │   ├── job-worker.ts               # Worker thread handler
│   │   │   └── index.ts
│   │   ├── events/
│   │   │   ├── event-bus.ts                # Emittery event bus
│   │   │   └── event-types.ts              # Event type definitions
│   │   └── index.ts
│   └── tsconfig.json
│
├── email/                                   # Email plugin example
│   ├── package.json
│   ├── plugin.manifest.json
│   ├── frontend/
│   │   ├── EmailConfigForm.tsx
│   │   ├── EmailIcon.tsx
│   │   └── index.tsx
│   ├── backend/
│   │   ├── email-executor.ts               # Main execution logic
│   │   ├── email-schema.ts                 # Zod validation
│   │   ├── email-templates.ts              # Template rendering
│   │   └── index.ts
│   └── README.md
│
├── webhooks/                                # Webhooks plugin
├── google-sheets/                           # Google Sheets plugin
├── slack/                                   # Slack plugin
└── README.md                                # Plugin development guide
```

---

## 🗄️ **Database Schema (Prisma)**

Add to `apps/backend/prisma/schema.prisma`:

```prisma
// Plugin Configuration
model PluginConfig {
  id             String   @id @default(auto()) @map("_id") @db.ObjectId
  formId         String   @db.ObjectId
  pluginId       String   // "email", "webhooks", "google-sheets"
  pluginVersion  String   // Plugin version for compatibility
  enabled        Boolean  @default(false)
  config         Json     // Plugin-specific settings (encrypted if needed)
  triggerEvents  String[] // ["form.submitted", "response.edited"]
  createdById    String   @db.ObjectId
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  form        Form                  @relation(fields: [formId], references: [id], onDelete: Cascade)
  createdBy   User                  @relation(fields: [createdById], references: [id])
  jobs        PluginJob[]
  logs        PluginExecutionLog[]

  @@unique([formId, pluginId])
  @@index([formId])
  @@index([pluginId])
  @@index([enabled])
  @@map("plugin_config")
}

// Job Queue (Bree persistence)
model PluginJob {
  id              String   @id @default(auto()) @map("_id") @db.ObjectId
  pluginConfigId  String   @db.ObjectId
  jobName         String   // Unique job name for Bree
  status          String   @default("pending") // "pending", "running", "completed", "failed"
  priority        Int      @default(0)
  scheduledFor    DateTime
  startedAt       DateTime?
  completedAt     DateTime?
  attempts        Int      @default(0)
  maxAttempts     Int      @default(3)
  lastError       String?
  payload         Json     // Job execution data

  pluginConfig PluginConfig @relation(fields: [pluginConfigId], references: [id], onDelete: Cascade)

  @@unique([jobName])
  @@index([status])
  @@index([scheduledFor])
  @@index([pluginConfigId])
  @@map("plugin_job")
}

// Execution Logs
model PluginExecutionLog {
  id              String   @id @default(auto()) @map("_id") @db.ObjectId
  pluginConfigId  String   @db.ObjectId
  jobId           String?  @db.ObjectId
  event           String   // Trigger event name
  status          String   // "success", "failed", "timeout"
  executedAt      DateTime @default(now())
  executionTime   Int      // milliseconds
  errorMessage    String?
  errorStack      String?
  inputData       Json?
  outputData      Json?

  pluginConfig PluginConfig @relation(fields: [pluginConfigId], references: [id], onDelete: Cascade)

  @@index([pluginConfigId])
  @@index([executedAt])
  @@index([status])
  @@map("plugin_execution_log")
}
```

---

## 🔧 **Core Implementation**

### **1. Plugin Interface** (`plugins/core/src/types/plugin.interface.ts`)

```typescript
import { z } from 'zod';

export interface IPlugin {
  id: string;
  name: string;
  version: string;
  description: string;
  category: 'email' | 'productivity' | 'communication' | 'automation' | 'webhooks';
  icon: string;

  // Configuration
  configSchema: z.ZodSchema;
  defaultConfig: Record<string, any>;

  // Supported events
  triggers: TriggerEvent[];

  // Execution
  execute(context: ExecutionContext): Promise<ExecutionResult>;
  validate(config: unknown): Promise<ValidationResult>;
  test(config: unknown): Promise<TestResult>;
}

export type TriggerEvent =
  | 'form.submitted'
  | 'form.updated'
  | 'response.edited'
  | 'response.deleted';

export interface ExecutionContext {
  pluginConfigId: string;
  event: TriggerEvent;
  payload: Record<string, any>;
  config: Record<string, any>;
  formId: string;
}

export interface ExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

export interface TestResult {
  success: boolean;
  message: string;
  details?: any;
}
```

### **2. Event Bus** (`plugins/core/src/events/event-bus.ts`)

```typescript
import Emittery from 'emittery';

export interface PluginEvents {
  // Form events (triggers)
  'form.submitted': { formId: string; responseId: string; data: any };
  'form.updated': { formId: string; changes: any };
  'response.edited': { responseId: string; formId: string; changes: any };
  'response.deleted': { responseId: string; formId: string };

  // Plugin job lifecycle events
  'plugin.job.created': { jobId: string; pluginId: string };
  'plugin.job.started': { jobId: string; pluginId: string };
  'plugin.job.completed': { jobId: string; pluginId: string; result: any };
  'plugin.job.failed': { jobId: string; pluginId: string; error: string };
}

class PluginEventBus extends Emittery<PluginEvents> {}

export const eventBus = new PluginEventBus();
```

### **3. Plugin Registry** (`plugins/core/src/registry/plugin-registry.ts`)

```typescript
import { IPlugin } from '../types/plugin.interface';
import { readdirSync, existsSync } from 'fs';
import path from 'path';

class PluginRegistry {
  private plugins: Map<string, IPlugin> = new Map();

  register(plugin: IPlugin): void {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin ${plugin.id} is already registered`);
    }
    this.plugins.set(plugin.id, plugin);
    console.log(`✅ Registered plugin: ${plugin.name} (${plugin.id})`);
  }

  get(pluginId: string): IPlugin {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }
    return plugin;
  }

  list(): IPlugin[] {
    return Array.from(this.plugins.values());
  }

  async discover(pluginsDir: string): Promise<void> {
    const dirs = readdirSync(pluginsDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)
      .filter(name => name !== 'core');

    for (const dir of dirs) {
      const pluginPath = path.join(pluginsDir, dir, 'backend', 'index.ts');
      if (existsSync(pluginPath)) {
        const pluginModule = await import(pluginPath);
        if (pluginModule.default) {
          this.register(pluginModule.default);
        }
      }
    }

    console.log(`🔍 Discovered ${this.plugins.size} plugins`);
  }
}

export const pluginRegistry = new PluginRegistry();
```

### **4. Job Executor with Bree** (`plugins/core/src/executor/job-executor.ts`)

```typescript
import Bree from 'bree';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { eventBus } from '../events/event-bus';

export class JobExecutor {
  private bree: Bree;
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.bree = new Bree({
      root: path.join(__dirname, 'workers'),
      defaultExtension: 'ts',
      workerMessageHandler: this.handleWorkerMessage.bind(this),
      errorHandler: this.handleWorkerError.bind(this)
    });
  }

  async initialize() {
    // Load pending jobs from MongoDB on startup
    const pendingJobs = await this.prisma.pluginJob.findMany({
      where: {
        status: { in: ['pending', 'running'] },
        scheduledFor: { lte: new Date() }
      },
      include: { pluginConfig: true }
    });

    // Schedule all pending jobs in Bree
    for (const job of pendingJobs) {
      await this.scheduleJob(job);
    }

    await this.bree.start();
    console.log(`✅ Job executor initialized with ${pendingJobs.length} pending jobs`);
  }

  async scheduleJob(job: any) {
    this.bree.add({
      name: job.jobName,
      path: path.join(__dirname, 'workers', 'plugin-worker.ts'),
      worker: {
        workerData: {
          jobId: job.id,
          pluginConfigId: job.pluginConfigId,
          payload: job.payload
        }
      },
      date: job.scheduledFor
    });

    await this.bree.start(job.jobName);
    eventBus.emit('plugin.job.created', {
      jobId: job.id,
      pluginId: job.pluginConfig.pluginId
    });
  }

  async createJob(data: {
    pluginConfigId: string;
    event: string;
    payload: any;
    scheduledFor?: Date;
  }) {
    const job = await this.prisma.pluginJob.create({
      data: {
        pluginConfigId: data.pluginConfigId,
        jobName: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        payload: data.payload,
        scheduledFor: data.scheduledFor || new Date(),
        status: 'pending'
      },
      include: { pluginConfig: true }
    });

    await this.scheduleJob(job);
    return job;
  }

  private async handleWorkerMessage(message: any, workerMetadata: any) {
    if (message.type === 'job.completed') {
      await this.prisma.pluginJob.update({
        where: { id: message.jobId },
        data: {
          status: 'completed',
          completedAt: new Date()
        }
      });

      await this.prisma.pluginExecutionLog.create({
        data: {
          pluginConfigId: message.pluginConfigId,
          jobId: message.jobId,
          event: message.event,
          status: 'success',
          executedAt: new Date(),
          executionTime: message.executionTime,
          outputData: message.result
        }
      });

      eventBus.emit('plugin.job.completed', message);
    }
  }

  private async handleWorkerError(error: Error, workerMetadata: any) {
    console.error('Worker error:', error);
    eventBus.emit('plugin.job.failed', {
      jobId: workerMetadata.workerData.jobId,
      pluginId: workerMetadata.name,
      error: error.message
    });
  }

  async gracefulShutdown() {
    console.log('🔄 Gracefully shutting down job executor...');
    await this.bree.stop();

    // Mark running jobs as pending for restart
    await this.prisma.pluginJob.updateMany({
      where: { status: 'running' },
      data: { status: 'pending' }
    });

    console.log('✅ Job executor shutdown complete');
  }
}
```

### **5. Worker Thread** (`plugins/core/src/executor/workers/plugin-worker.ts`)

```typescript
import { parentPort, workerData } from 'worker_threads';
import { PrismaClient } from '@prisma/client';
import { pluginRegistry } from '../../registry/plugin-registry';

const prisma = new PrismaClient();

async function executeJob() {
  const startTime = Date.now();
  const { jobId, pluginConfigId, payload } = workerData;

  try {
    // Update job status to running
    await prisma.pluginJob.update({
      where: { id: jobId },
      data: { status: 'running', startedAt: new Date() }
    });

    // Get plugin config
    const config = await prisma.pluginConfig.findUnique({
      where: { id: pluginConfigId },
      include: { form: true }
    });

    if (!config || !config.enabled) {
      throw new Error('Plugin config not found or disabled');
    }

    // Get plugin from registry
    const plugin = pluginRegistry.get(config.pluginId);

    // Execute plugin
    const result = await plugin.execute({
      pluginConfigId: config.id,
      event: payload.event,
      payload: payload.data,
      config: config.config,
      formId: config.formId
    });

    const executionTime = Date.now() - startTime;

    // Send success message to main thread
    parentPort?.postMessage({
      type: 'job.completed',
      jobId,
      pluginConfigId,
      event: payload.event,
      result: result.data,
      executionTime
    });

  } catch (error: any) {
    // Handle failure and retry logic
    const job = await prisma.pluginJob.findUnique({
      where: { id: jobId },
      select: { attempts: true, maxAttempts: true }
    });

    if (job && job.attempts < job.maxAttempts) {
      // Retry - set back to pending
      await prisma.pluginJob.update({
        where: { id: jobId },
        data: {
          status: 'pending',
          attempts: { increment: 1 },
          lastError: error.message
        }
      });
    } else {
      // Max retries reached - mark as failed
      await prisma.pluginJob.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          lastError: error.message
        }
      });

      await prisma.pluginExecutionLog.create({
        data: {
          pluginConfigId,
          jobId,
          event: payload.event,
          status: 'failed',
          executedAt: new Date(),
          executionTime: Date.now() - startTime,
          errorMessage: error.message,
          errorStack: error.stack
        }
      });
    }

    parentPort?.postMessage({
      type: 'job.failed',
      jobId,
      error: error.message
    });
  } finally {
    await prisma.$disconnect();
  }
}

executeJob();
```

---

## 🔌 **Example Plugin: Email**

### **Manifest** (`plugins/email/plugin.manifest.json`)

```json
{
  "id": "email",
  "name": "Email Notifications",
  "version": "1.0.0",
  "description": "Send email notifications on form events",
  "category": "communication",
  "icon": "mail",
  "author": "Dculus",
  "triggers": ["form.submitted", "response.edited"],
  "dependencies": {
    "nodemailer": "^6.9.8"
  }
}
```

### **Backend Executor** (`plugins/email/backend/email-executor.ts`)

```typescript
import { IPlugin, ExecutionContext, ExecutionResult } from '@dculus/plugins-core';
import { z } from 'zod';
import nodemailer from 'nodemailer';
import { emailConfigSchema } from './email-schema';

export class EmailPlugin implements IPlugin {
  id = 'email';
  name = 'Email Notifications';
  version = '1.0.0';
  description = 'Send email notifications on form events';
  category = 'communication' as const;
  icon = 'mail';

  configSchema = emailConfigSchema;
  defaultConfig = {
    smtp: {
      host: '',
      port: 587,
      secure: false,
      auth: { user: '', pass: '' }
    },
    from: '',
    recipients: [],
    subject: 'New Form Submission',
    template: 'You received a new form submission!'
  };

  triggers = ['form.submitted', 'response.edited'] as const;

  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const { config, payload } = context;

    try {
      const transporter = nodemailer.createTransporter(config.smtp);

      // Render template with form data
      const emailBody = this.renderTemplate(config.template, payload);

      const result = await transporter.sendMail({
        from: config.from,
        to: config.recipients.join(', '),
        subject: config.subject,
        html: emailBody
      });

      return {
        success: true,
        data: { messageId: result.messageId }
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
      const transporter = nodemailer.createTransporter(parsedConfig.smtp);
      await transporter.verify();

      return {
        success: true,
        message: 'SMTP connection successful'
      };
    } catch (error: any) {
      return {
        success: false,
        message: `SMTP test failed: ${error.message}`
      };
    }
  }

  private renderTemplate(template: string, data: any): string {
    // Simple template rendering - replace {{field}} with values
    return template.replace(/\{\{(\w+)\}\}/g, (match, field) => {
      return data[field] || match;
    });
  }
}

export default new EmailPlugin();
```

---

## 🔗 **Integration with Express.js Backend**

### **Initialize Plugin System** (`apps/backend/src/index.ts`)

```typescript
import express from 'express';
import { JobExecutor } from '@dculus/plugins-core';
import { eventBus } from '@dculus/plugins-core/events';
import { pluginRegistry } from '@dculus/plugins-core/registry';
import { prisma } from './lib/prisma';
import path from 'path';

const app = express();

// Initialize plugin system
const jobExecutor = new JobExecutor(prisma);

async function startServer() {
  // ... existing Express middleware setup

  // Discover and register plugins
  await pluginRegistry.discover(path.join(__dirname, '../../../plugins'));

  // Initialize job executor (loads pending jobs from MongoDB)
  await jobExecutor.initialize();

  // Setup event listeners for plugin triggers
  setupPluginEventListeners();

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('🛑 SIGTERM received, shutting down gracefully...');
    await jobExecutor.gracefulShutdown();
    await prisma.$disconnect();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('🛑 SIGINT received, shutting down gracefully...');
    await jobExecutor.gracefulShutdown();
    await prisma.$disconnect();
    process.exit(0);
  });

  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

function setupPluginEventListeners() {
  // Listen for form submission events
  eventBus.on('form.submitted', async ({ formId, responseId, data }) => {
    const configs = await prisma.pluginConfig.findMany({
      where: {
        formId,
        enabled: true,
        triggerEvents: { has: 'form.submitted' }
      }
    });

    // Create jobs for each enabled plugin
    for (const config of configs) {
      await jobExecutor.createJob({
        pluginConfigId: config.id,
        event: 'form.submitted',
        payload: { formId, responseId, data }
      });
    }
  });

  // Similar listeners for other events...
}

startServer();
```

### **Emit Events in Services** (`apps/backend/src/services/formService.ts`)

```typescript
import { eventBus } from '@dculus/plugins-core/events';
import { prisma } from '../lib/prisma';

export async function submitFormResponse(formId: string, responseData: any) {
  const response = await prisma.response.create({
    data: {
      formId,
      data: responseData
    }
  });

  // Trigger plugin execution
  await eventBus.emit('form.submitted', {
    formId,
    responseId: response.id,
    data: responseData
  });

  return response;
}

export async function updateResponse(responseId: string, changes: any) {
  const response = await prisma.response.update({
    where: { id: responseId },
    data: { data: changes }
  });

  // Trigger plugin execution
  await eventBus.emit('response.edited', {
    responseId: response.id,
    formId: response.formId,
    changes
  });

  return response;
}
```

---

## 🚀 **Key Features Summary**

✅ **No Redis** - Uses MongoDB via Prisma for persistence
✅ **No New Servers** - Runs within Express.js process
✅ **Restart Recovery** - Jobs automatically reload from MongoDB on restart
✅ **Worker Threads** - Non-blocking execution with Bree
✅ **Event-Driven** - Emittery for async event handling
✅ **Type-Safe** - Full TypeScript support throughout
✅ **Retry Logic** - Configurable automatic retries (default 3 attempts)
✅ **Execution Logs** - Complete audit trail of all executions
✅ **Graceful Shutdown** - Proper cleanup on server shutdown
✅ **Plugin Discovery** - Automatic plugin registration
✅ **Scalable** - Production-ready architecture

---

## 📋 **Implementation Checklist**

### **Phase 1: Core Infrastructure** (Week 1)
- [ ] Install dependencies (Bree, Emittery)
- [ ] Add database models to Prisma schema
- [ ] Create `plugins/core` package structure
- [ ] Implement plugin interface and types
- [ ] Implement event bus with Emittery
- [ ] Implement plugin registry

### **Phase 2: Job Execution** (Week 2)
- [ ] Implement JobExecutor with Bree
- [ ] Create worker thread implementation
- [ ] Add job recovery on server restart
- [ ] Implement graceful shutdown
- [ ] Add retry logic
- [ ] Create execution logging

### **Phase 3: Backend Integration** (Week 3)
- [ ] Integrate job executor in Express server
- [ ] Add event listeners for form events
- [ ] Create GraphQL schema for plugins
- [ ] Implement GraphQL resolvers
- [ ] Migrate existing email plugin to new structure

### **Phase 4: Frontend UI** (Week 4)
- [ ] Create plugin configuration page
- [ ] Build plugin config forms
- [ ] Add execution logs viewer
- [ ] Implement test functionality
- [ ] Add enable/disable toggle

### **Phase 5: Additional Plugins** (Week 5)
- [ ] Implement webhooks plugin
- [ ] Implement Google Sheets plugin
- [ ] Implement Slack plugin
- [ ] Write plugin development documentation
- [ ] Add integration tests

---

## 📚 **Related Documentation**

- [Plugin Development Guide](./PLUGIN_DEVELOPMENT_GUIDE.md) - How to create new plugins
- [GraphQL API Documentation](./docs/GRAPHQL_API.md) - Plugin API endpoints
- [Example Plugins](./plugins/README.md) - Plugin examples and templates

---

## 🔧 **Troubleshooting**

### **Jobs not executing after restart**
- Check if `jobExecutor.initialize()` is called on server start
- Verify MongoDB connection is active
- Check `PluginJob` collection for pending jobs

### **Worker thread errors**
- Ensure worker file path is correct in Bree config
- Check TypeScript compilation for worker files
- Verify plugin is registered in registry

### **Event not triggering plugins**
- Confirm plugin config has correct `triggerEvents`
- Verify plugin is enabled (`enabled: true`)
- Check event is being emitted with `eventBus.emit()`

---

**Version**: 1.0.0
**Last Updated**: 2025-01-10

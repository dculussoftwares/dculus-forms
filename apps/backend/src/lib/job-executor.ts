import { PrismaClient } from '@prisma/client';
import { eventBus } from './event-bus.js';
import { generateId } from '@dculus/utils';

/**
 * Job Executor
 *
 * Manages background job execution for the plugin system.
 * Jobs persist in MongoDB and survive server restarts.
 * Executes plugin jobs in the main thread with async execution.
 */
export class JobExecutor {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Initialize job executor - loads pending jobs from MongoDB on startup
   */
  async initialize() {
    // Clean up stale jobs (jobs that were running when server shut down)
    await this.prisma.pluginJob.updateMany({
      where: { status: 'running' },
      data: { status: 'pending' }
    });

    // Load pending jobs from MongoDB on startup
    const pendingJobs = await this.prisma.pluginJob.findMany({
      where: {
        status: 'pending',
        scheduledFor: { lte: new Date() }
      },
      include: { pluginConfig: true }
    });

    // Execute all pending jobs
    for (const job of pendingJobs) {
      try {
        await this.scheduleJob(job);
      } catch (error) {
        console.error(`Failed to schedule job ${job.jobName}:`, error);
        // Mark job as failed
        await this.prisma.pluginJob.update({
          where: { id: job.id },
          data: {
            status: 'failed',
            lastError: error instanceof Error ? error.message : 'Unknown error'
          }
        });
      }
    }

    console.log(`✅ Job executor initialized with ${pendingJobs.length} pending jobs`);
  }

  /**
   * Schedule and execute a job immediately
   * Simplified approach: execute in main thread instead of worker threads
   */
  async scheduleJob(job: any) {
    // Execute job immediately in main thread
    setImmediate(() => this.executeJob(job));

    eventBus.emit('plugin.job.created', {
      jobId: job.id,
      pluginId: job.pluginConfig.pluginId
    });
  }

  /**
   * Execute a plugin job using event-driven dispatch
   */
  private async executeJob(job: any) {
    const startTime = Date.now();

    try {
      // Update job status to running
      await this.prisma.pluginJob.update({
        where: { id: job.id },
        data: { status: 'running', startedAt: new Date() }
      });

      // Get plugin config (might be included already)
      const config = job.pluginConfig || await this.prisma.pluginConfig.findUnique({
        where: { id: job.pluginConfigId },
        include: { form: true }
      });

      if (!config || !config.enabled) {
        throw new Error('Plugin config not found or disabled');
      }

      // Emit plugin-specific execution event (event-driven dispatch)
      // This allows plugins to be completely independent
      const executionEvent = `plugin.${config.pluginId}.execute` as keyof typeof eventBus;

      eventBus.emit(executionEvent as any, {
        jobId: job.id,
        pluginConfigId: config.id,
        formId: config.formId,
        config: config.config as Record<string, any>,
        payload: job.payload.data,
        event: job.payload.event
      });

      // Note: Actual job completion will be handled by event listeners
      // They will emit 'plugin.{pluginId}.completed' or 'plugin.{pluginId}.failed'
      // which will be caught by the completion handlers below

      console.log(`🚀 Plugin job ${job.jobName} dispatched to ${config.pluginId} plugin`);

    } catch (error: any) {
      console.error(`❌ Plugin job ${job.jobName} failed to dispatch:`, error);
      await this.handleJobFailure(job, error, Date.now() - startTime);
    }
  }

  /**
   * Handle job completion (called by plugin event listeners)
   */
  async handleJobCompletion(jobId: string, result: any) {
    try {
      const job = await this.prisma.pluginJob.findUnique({
        where: { id: jobId },
        include: { pluginConfig: true }
      });

      if (!job) {
        console.error(`Job ${jobId} not found for completion`);
        return;
      }

      const executionTime = job.startedAt
        ? Date.now() - job.startedAt.getTime()
        : 0;

      // Mark job as completed
      await this.prisma.pluginJob.update({
        where: { id: jobId },
        data: {
          status: 'completed',
          completedAt: new Date()
        }
      });

      // Log successful execution
      await this.prisma.pluginExecutionLog.create({
        data: {
          id: generateId(),
          pluginConfigId: job.pluginConfigId,
          jobId: job.id,
          event: job.payload.event,
          status: 'success',
          executedAt: new Date(),
          executionTime,
          outputData: result
        }
      });

      eventBus.emit('plugin.job.completed', {
        jobId: job.id,
        pluginConfigId: job.pluginConfigId,
        event: job.payload.event,
        result,
        executionTime
      });

      console.log(`✅ Plugin job ${job.jobName} completed in ${executionTime}ms`);
    } catch (error) {
      console.error(`Error handling job completion for ${jobId}:`, error);
    }
  }

  /**
   * Handle job failure (called by plugin event listeners or internally)
   */
  private async handleJobFailure(job: any, error: any, executionTime: number) {
    // Handle failure and retry logic
    const jobData = await this.prisma.pluginJob.findUnique({
      where: { id: job.id },
      select: { attempts: true, maxAttempts: true }
    });

    if (jobData && jobData.attempts < jobData.maxAttempts) {
      // Retry - set back to pending
      await this.prisma.pluginJob.update({
        where: { id: job.id },
        data: {
          status: 'pending',
          attempts: { increment: 1 },
          lastError: error.message
        }
      });

      // Reschedule with exponential backoff
      const retryDelay = Math.pow(2, jobData.attempts) * 1000; // 1s, 2s, 4s...
      setTimeout(() => this.executeJob(job), retryDelay);

      console.log(`🔄 Plugin job ${job.jobName} will retry in ${retryDelay}ms (attempt ${jobData.attempts + 1}/${jobData.maxAttempts})`);

    } else {
      // Max retries reached - mark as failed
      await this.prisma.pluginJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          completedAt: new Date(),
          lastError: error.message
        }
      });

      await this.prisma.pluginExecutionLog.create({
        data: {
          id: generateId(),
          pluginConfigId: job.pluginConfigId,
          jobId: job.id,
          event: job.payload.event,
          status: 'failed',
          executedAt: new Date(),
          executionTime,
          errorMessage: error.message,
          errorStack: error.stack
        }
      });

      eventBus.emit('plugin.job.failed', {
        jobId: job.id,
        error: error.message
      });

      console.log(`❌ Plugin job ${job.jobName} failed after ${jobData?.attempts || 0} attempts`);
    }
  }

  /**
   * Create a new job
   */
  async createJob(data: {
    pluginConfigId: string;
    event: string;
    payload: any;
    scheduledFor?: Date;
  }) {
    const job = await this.prisma.pluginJob.create({
      data: {
        id: generateId(),
        pluginConfigId: data.pluginConfigId,
        jobName: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        payload: {
          event: data.event,
          data: data.payload
        },
        scheduledFor: data.scheduledFor || new Date(),
        status: 'pending'
      },
      include: { pluginConfig: true }
    });

    await this.scheduleJob(job);
    return job;
  }

  /**
   * Graceful shutdown
   */
  async gracefulShutdown() {
    console.log('🔄 Gracefully shutting down job executor...');

    // Mark running jobs as pending for restart
    await this.prisma.pluginJob.updateMany({
      where: { status: 'running' },
      data: { status: 'pending' }
    });

    console.log('✅ Job executor shutdown complete');
  }
}

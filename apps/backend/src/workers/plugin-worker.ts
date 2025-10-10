import { parentPort, workerData } from 'worker_threads';
import { PrismaClient } from '@prisma/client';
import { generateId } from '@dculus/utils';

const prisma = new PrismaClient();

interface WorkerData {
  jobId: string;
  pluginConfigId: string;
  payload: {
    event: string;
    data: any;
  };
}

/**
 * Plugin Worker Thread
 *
 * This worker executes plugin logic in an isolated thread.
 * It receives job data from Bree, executes the plugin, and sends results back.
 */
async function executeJob() {
  const startTime = Date.now();
  const { jobId, pluginConfigId, payload } = workerData as WorkerData;

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

    // Execute plugin based on pluginId
    let result;
    if (config.pluginId === 'email') {
      // Dynamic import to avoid circular dependencies
      const { executeEmailPlugin } = await import('../plugins/email-executor.js');
      result = await executeEmailPlugin({
        pluginConfigId: config.id,
        event: payload.event,
        payload: payload.data,
        config: config.config as Record<string, any>,
        formId: config.formId
      });
    } else {
      throw new Error(`Unknown plugin type: ${config.pluginId}`);
    }

    const executionTime = Date.now() - startTime;

    // Send success message to main thread
    parentPort?.postMessage({
      type: 'job.completed',
      jobId,
      pluginConfigId,
      event: payload.event,
      result,
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
          id: generateId(),
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

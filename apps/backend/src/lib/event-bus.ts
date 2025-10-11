import Emittery from 'emittery';

/**
 * Plugin Events for the event-driven plugin system
 *
 * This event bus is used to trigger plugin executions when form events occur.
 * Plugins listen to specific events and execute their logic in background jobs.
 */
export interface PluginEvents {
  // Form events (triggers)
  'form.submitted': {
    formId: string;
    responseId: string;
    data: Record<string, any>;
  };

  'form.updated': {
    formId: string;
    changes: any;
  };

  'response.edited': {
    responseId: string;
    formId: string;
    changes: any;
  };

  'response.deleted': {
    responseId: string;
    formId: string;
  };

  // Plugin job lifecycle events
  'plugin.job.created': {
    jobId: string;
    pluginId: string;
  };

  'plugin.job.started': {
    jobId: string;
    pluginId: string;
  };

  'plugin.job.completed': {
    jobId: string;
    pluginId: string;
    result: any;
  };

  'plugin.job.failed': {
    jobId: string;
    pluginId: string;
    error: string;
  };
}

/**
 * Global event bus singleton for plugin system
 */
class PluginEventBus extends Emittery<PluginEvents> {}

export const eventBus = new PluginEventBus();

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

  // Generic plugin execution events
  'plugin.execute': {
    jobId: string;
    pluginConfigId: string;
    pluginId: string;
    formId: string;
    config: Record<string, any>;
    payload: Record<string, any>;
    event: string;
  };

  // Email plugin specific events
  'plugin.email.execute': {
    jobId: string;
    pluginConfigId: string;
    formId: string;
    config: Record<string, any>;
    payload: Record<string, any>;
    event: string;
  };

  'plugin.email.send': {
    jobId: string;
    pluginConfigId: string;
    formId: string;
    formTitle: string;
    recipientEmail: string;
    subject: string;
    message: string;
    submissionData: Record<string, any>;
    sendToSubmitter?: boolean;
    submitterEmailFieldId?: string;
  };

  'plugin.email.sent': {
    jobId: string;
    pluginConfigId: string;
    messageId: string;
    sentTo: string[];
  };

  'plugin.email.failed': {
    jobId: string;
    pluginConfigId: string;
    error: string;
  };
}

/**
 * Global event bus singleton for plugin system
 */
class PluginEventBus extends Emittery<PluginEvents> {}

export const eventBus = new PluginEventBus();

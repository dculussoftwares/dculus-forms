import type { PluginContext } from './context.js';

export type { PluginContext };

export interface PluginConfig {
  type: string;
  [key: string]: any;
}

export interface PluginEvent {
  type: 'form.submitted' | 'plugin.test';
  formId: string;
  organizationId: string;
  data: Record<string, any>;
  timestamp: Date;
}

export type PluginHandler = (
  plugin: { id: string; config: PluginConfig },
  event: PluginEvent,
  context: PluginContext
) => Promise<any>;

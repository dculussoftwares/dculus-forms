import { registerPlugin } from '../registry.js';
import { webhookHandler } from './handler.js';

/**
 * Register webhook plugin with the plugin registry
 */
export const registerWebhookPlugin = (): void => {
  registerPlugin('webhook', webhookHandler);
};

// Export types and handler for testing
export * from './types.js';
export { webhookHandler } from './handler.js';

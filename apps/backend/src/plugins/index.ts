/**
 * Plugin System Index
 * Central export point for all plugin functionality
 */

// Core plugin system
export * from './types.js';
export * from './context.js';
export * from './registry.js';
export * from './executor.js';
export * from './events.js';

// Webhook plugin
export * from './webhooks/index.js';

// Email plugin
export * from './email/index.js';

// Quiz grading plugin
export * from './quiz/index.js';

// Plugin initialization function
import { initializePluginEvents } from './events.js';
import { registerWebhookPlugin } from './webhooks/index.js';
import { registerEmailPlugin } from './email/index.js';
import { registerQuizGradingPlugin } from './quiz/index.js';

/**
 * Initialize the complete plugin system
 * Call this once during server startup
 */
export const initializePluginSystem = (): void => {
  console.log('[Plugin System] Initializing...');

  // Register all available plugins
  registerWebhookPlugin();
  registerEmailPlugin();
  registerQuizGradingPlugin();

  // Initialize event system
  initializePluginEvents();

  console.log('[Plugin System] Initialization complete');
};

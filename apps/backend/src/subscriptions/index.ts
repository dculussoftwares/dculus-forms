/**
 * Subscription System Module
 * Event-driven subscription management and usage tracking
 */

export * from './types.js';
export * from './events.js';
export * from './usageService.js';

import { initializeSubscriptionEvents } from './events.js';
import { initializeUsageService } from './usageService.js';
import { logger } from '../lib/logger.js';

/**
 * Initialize the entire subscription system
 * Call this once when the application starts
 */
export const initializeSubscriptionSystem = (): void => {
  logger.info('[Subscription System] Initializing...');

  // Initialize event emitter
  initializeSubscriptionEvents();

  // Initialize usage service (attaches listeners to events)
  initializeUsageService();

  logger.info('[Subscription System] Initialization complete');
};

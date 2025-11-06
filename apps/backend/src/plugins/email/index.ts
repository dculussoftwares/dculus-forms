/**
 * Email Plugin Module
 * Exports email plugin functionality and registration
 */

import { registerPlugin } from '../registry.js';
import { emailHandler } from './handler.js';
import { EMAIL_PLUGIN_TYPE } from './types.js';
import { logger } from '../../lib/logger.js';

// Export types
export * from './types.js';

// Export handler
export { emailHandler } from './handler.js';

/**
 * Register email plugin in the plugin registry
 * Called during plugin system initialization
 */
export const registerEmailPlugin = (): void => {
  registerPlugin(EMAIL_PLUGIN_TYPE, emailHandler);
  logger.info('[Email Plugin] Registered successfully');
};

import './webhook/index.js';
import './email/index.js';
import './quiz/index.js';
import './ai-tagger/index.js';
import './google-sheets/index.js';

import { initializePluginEvents } from './core/events.js';
import { logger } from '../lib/logger.js';

export const initializePluginSystem = (): void => {
  logger.info('[Plugin System] Initializing...');
  initializePluginEvents();
  logger.info('[Plugin System] Initialized');
};

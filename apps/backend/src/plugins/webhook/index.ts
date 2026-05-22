import { registerPlugin } from '../core/registry.js';
import { webhookHandler } from './handler.js';

registerPlugin('webhook', webhookHandler);

export * from './types.js';
export { webhookHandler } from './handler.js';

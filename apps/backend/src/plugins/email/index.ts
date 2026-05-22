import { registerPlugin } from '../core/registry.js';
import { emailHandler } from './handler.js';
import { EMAIL_PLUGIN_TYPE } from './types.js';

registerPlugin(EMAIL_PLUGIN_TYPE, emailHandler);

export * from './types.js';
export { emailHandler } from './handler.js';

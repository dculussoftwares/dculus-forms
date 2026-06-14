import { registerPlugin } from '../core/registry.js';
import { googleSheetsHandler } from './handler.js';

registerPlugin('google-sheets', googleSheetsHandler);

export * from './types.js';
export { googleSheetsHandler } from './handler.js';

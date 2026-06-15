import { registerPlugin } from '../core/registry.js';
import { microsoftSheetsHandler } from './handler.js';

registerPlugin('microsoft-sheets', microsoftSheetsHandler);

export * from './types.js';
export { microsoftSheetsHandler } from './handler.js';

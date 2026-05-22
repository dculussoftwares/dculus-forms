import { registerPlugin } from '../core/registry.js';
import { quizGradingHandler } from './handler.js';
import { QUIZ_GRADING_PLUGIN_TYPE } from './types.js';
import './export.js';

registerPlugin(QUIZ_GRADING_PLUGIN_TYPE, quizGradingHandler);

export * from './types.js';
export { quizGradingHandler } from './handler.js';

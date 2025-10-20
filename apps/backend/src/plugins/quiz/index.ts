import { registerPlugin } from '../registry.js';
import { quizGradingHandler } from './handler.js';
import { QUIZ_GRADING_PLUGIN_TYPE } from './types.js';

export const registerQuizGradingPlugin = (): void => {
  registerPlugin(QUIZ_GRADING_PLUGIN_TYPE, quizGradingHandler);
};

export * from './types.js';
export * from './handler.js';

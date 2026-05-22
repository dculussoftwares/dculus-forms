import type { PluginConfig } from '../core/types.js';

// Quiz field configuration (per field)
export interface QuizFieldConfig {
  fieldId: string;          // Form field ID
  fieldLabel?: string;      // Field label (stored in config for reliability)
  correctAnswer: string;    // The correct option value
  marks: number;            // Points for this question
}

// Main plugin configuration
export interface QuizGradingPluginConfig extends PluginConfig {
  type: 'quiz-grading';
  quizFields: QuizFieldConfig[];  // Array of quiz field configurations
  passThreshold: number;          // Pass percentage (default: 60)
  columnName?: string;            // Custom column header in Excel/CSV exports (default: "Quiz Score")
}

export const QUIZ_GRADING_PLUGIN_TYPE = 'quiz-grading' as const;
export const QUIZ_GRADING_METADATA_KEY = 'quiz-grading' as const;
export const quizMetadataKey = (pluginId: string) => `quiz-grading:${pluginId}`;

export type ValidatedQuizGradingConfig = QuizGradingPluginConfig;

// Result returned by plugin handler
export interface QuizGradingResult {
  success: boolean;
  quizScore: number;
  totalMarks: number;
  percentage: number;
  passed: boolean;
  responseId: string;
  error?: string;
}

/**
 * Quiz Plugin Export Columns
 *
 * Defines how quiz grading data should be exported to Excel/CSV files.
 */

import { QuizGradingMetadata } from '@dculus/types';
import { PluginExportColumn, registerPluginExport } from '../core/exportRegistry.js';
import { logger } from '../../lib/logger.js';

/**
 * Quiz plugin export column definition
 */
export const quizExportColumns: PluginExportColumn = {
  pluginType: 'quiz-grading',

  /**
   * Get quiz export column headers (static defaults)
   */
  getColumns(): string[] {
    return [
      'Quiz Score',
      'Quiz Percentage',
      'Quiz Status',
      'Quiz Pass Threshold',
    ];
  },

  /**
   * Get quiz export column headers using the stored plugin config.
   * Honours the user-configured `columnName` for the primary score column.
   */
  getColumnsWithConfig(pluginConfig: Record<string, any>): string[] {
    const primaryColumnName =
      typeof pluginConfig?.columnName === 'string' && pluginConfig.columnName.trim()
        ? pluginConfig.columnName.trim()
        : 'Quiz Score';

    return [
      primaryColumnName,
      'Quiz Percentage',
      'Quiz Status',
      'Quiz Pass Threshold',
    ];
  },

  /**
   * Extract quiz values from metadata for export
   */
  getValues(metadata: any): (string | number | null)[] {
    if (!metadata) {
      return [null, null, null, null];
    }

    const quiz = metadata as QuizGradingMetadata;

    // Format score as "X/Y" (e.g., "8/10")
    const scoreText = `${quiz.quizScore}/${quiz.totalMarks}`;

    // Format percentage with 1 decimal place
    const percentage = quiz.percentage.toFixed(1);

    // Determine pass/fail status
    const passThreshold = quiz.passThreshold ?? 60;
    const status = quiz.percentage >= passThreshold ? 'Pass' : 'Fail';

    // Pass threshold percentage
    const thresholdText = `${passThreshold}%`;

    return [
      scoreText,      // Quiz Score
      percentage,     // Quiz Percentage
      status,         // Quiz Status
      thresholdText,  // Quiz Pass Threshold
    ];
  },
};

/**
 * Register quiz export columns on module load
 * This ensures the quiz plugin is available for exports
 */
registerPluginExport(quizExportColumns);

logger.info('Quiz plugin export columns registered');

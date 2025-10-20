/**
 * Quiz Plugin - Response Table Column Registration
 *
 * Registers the quiz score column for the responses table.
 * This file is automatically imported to register the plugin.
 */

import { registerPluginColumn } from '../PluginColumnRegistry';
import { QuizScoreCell } from './QuizScoreCell';

/**
 * Register quiz plugin column
 */
registerPluginColumn({
  pluginType: 'quiz-grading',
  title: 'Quiz Score',
  size: 160,
  enableSorting: false,
  renderCell: ({ metadata, responseId, onViewDetails }) => (
    <QuizScoreCell
      metadata={metadata}
      responseId={responseId}
      onViewResults={(quizMetadata, responseId) => {
        if (onViewDetails) {
          onViewDetails(quizMetadata, responseId);
        }
      }}
    />
  ),
});

console.log('Quiz plugin response table column registered');

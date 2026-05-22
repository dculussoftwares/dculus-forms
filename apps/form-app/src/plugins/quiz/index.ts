import { registerFrontendPlugin } from '../core/registry';
import { QuizConfigForm } from './ConfigForm';
import { QuizResponseCell } from './ResponseCell';
import { QuizMetadataViewer } from './MetadataViewer';

registerFrontendPlugin({
  type: 'quiz-grading',
  ConfigForm: QuizConfigForm,
  ResponseCell: QuizResponseCell,
  /**
   * Fall back to the static 'Quiz Score' title when no columnName has been
   * configured yet (e.g. for pre-existing plugins or during initial save).
   */
  columnTitle: 'Quiz Score',
  getColumnTitle: (config) => {
    const name = config?.columnName;
    return typeof name === 'string' && name.trim() ? name.trim() : 'Quiz Score';
  },
  columnSize: 160,
  MetadataViewer: QuizMetadataViewer,
});

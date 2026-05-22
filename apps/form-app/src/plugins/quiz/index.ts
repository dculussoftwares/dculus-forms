import { registerFrontendPlugin } from '../core/registry';
import { QuizConfigForm } from './ConfigForm';
import { QuizResponseCell } from './ResponseCell';
import { QuizMetadataViewer } from './MetadataViewer';

registerFrontendPlugin({
  type: 'quiz-grading',
  ConfigForm: QuizConfigForm,
  ResponseCell: QuizResponseCell,
  columnTitle: 'Quiz Score',
  columnSize: 160,
  MetadataViewer: QuizMetadataViewer,
});

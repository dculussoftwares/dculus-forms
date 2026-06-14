import { registerFrontendPlugin } from '../core/registry';
import { QuizConfigForm } from './ConfigForm';
import { QuizResponseCell } from './ResponseCell';
import { QuizMetadataViewer } from './MetadataViewer';
import { QuizOverviewSummary } from './OverviewSummary';

registerFrontendPlugin({
  type: 'quiz-grading',
  ConfigForm: QuizConfigForm,
  ResponseCell: QuizResponseCell,
  columnTitle: 'Quiz Score',
  getColumnTitle: (config) => {
    const name = config?.columnName;
    return typeof name === 'string' && name.trim() ? name.trim() : 'Quiz Score';
  },
  columnSize: 160,
  MetadataViewer: QuizMetadataViewer,
  OverviewSummary: QuizOverviewSummary,
});

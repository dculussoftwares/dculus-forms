import { registerFrontendPlugin } from '../core/registry';
import { AiTaggerConfigForm } from './ConfigForm';
import { AiTaggerOverviewSummary } from './OverviewSummary';

registerFrontendPlugin({
  type: 'ai-tagger',
  ConfigForm: AiTaggerConfigForm,
  OverviewSummary: AiTaggerOverviewSummary,
});

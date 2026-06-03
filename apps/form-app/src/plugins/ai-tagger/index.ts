import { registerFrontendPlugin } from '../core/registry';
import { AiTaggerConfigForm } from './ConfigForm';

registerFrontendPlugin({
  type: 'ai-tagger',
  ConfigForm: AiTaggerConfigForm,
});

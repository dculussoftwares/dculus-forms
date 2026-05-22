import { registerFrontendPlugin } from '../core/registry';
import { WebhookConfigForm } from './ConfigForm';

registerFrontendPlugin({
  type: 'webhook',
  ConfigForm: WebhookConfigForm,
});

import { registerFrontendPlugin } from '../core/registry';
import { WebhookConfigForm } from './ConfigForm';
import { WebhookOverviewSummary } from './OverviewSummary';

registerFrontendPlugin({
  type: 'webhook',
  ConfigForm: WebhookConfigForm,
  OverviewSummary: WebhookOverviewSummary,
});

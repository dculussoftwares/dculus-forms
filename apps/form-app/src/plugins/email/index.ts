import { registerFrontendPlugin } from '../core/registry';
import { EmailConfigForm } from './ConfigForm';
import { EmailOverviewSummary } from './OverviewSummary';

registerFrontendPlugin({
  type: 'email',
  ConfigForm: EmailConfigForm,
  OverviewSummary: EmailOverviewSummary,
});

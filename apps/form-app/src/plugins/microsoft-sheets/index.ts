import { registerFrontendPlugin } from '../core/registry';
import { MicrosoftSheetsConfigForm } from './ConfigForm';
import { MicrosoftSheetsOverviewSummary } from './OverviewSummary';

registerFrontendPlugin({
  type: 'microsoft-sheets',
  ConfigForm: MicrosoftSheetsConfigForm,
  OverviewSummary: MicrosoftSheetsOverviewSummary,
});

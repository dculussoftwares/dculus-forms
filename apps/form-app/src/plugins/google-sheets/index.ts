import { registerFrontendPlugin } from '../core/registry';
import { GoogleSheetsConfigForm } from './ConfigForm';
import { GoogleSheetsOverviewSummary } from './OverviewSummary';

registerFrontendPlugin({
  type: 'google-sheets',
  ConfigForm: GoogleSheetsConfigForm,
  OverviewSummary: GoogleSheetsOverviewSummary,
});

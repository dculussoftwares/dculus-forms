import { registerFrontendPlugin } from '../core/registry';
import { GoogleSheetsConfigForm } from './ConfigForm';

registerFrontendPlugin({
  type: 'google-sheets',
  ConfigForm: GoogleSheetsConfigForm,
});

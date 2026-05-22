import { registerFrontendPlugin } from '../core/registry';
import { EmailConfigForm } from './ConfigForm';

registerFrontendPlugin({
  type: 'email',
  ConfigForm: EmailConfigForm,
});

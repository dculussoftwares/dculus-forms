/**
 * Plugin Response Table Columns Index
 *
 * This file imports all plugin column registrations.
 * Import this file to register all available plugin columns.
 */

// IMPORTANT: Import plugin registrations BEFORE exporting registry functions
// This ensures plugins are registered before getPluginColumns is called
import './quiz/quizColumnRegistration';

// Add future plugin registrations here:
// import './email/emailColumnRegistration';
// import './webhook/webhookColumnRegistration';

// Export the registry functions for use in Responses.tsx
export {
  getPluginColumns,
  hasPluginColumn,
  getRegisteredPluginTypes
} from './PluginColumnRegistry';

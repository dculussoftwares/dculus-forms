import type { ErrorLike } from '@apollo/client';
import { CombinedGraphQLErrors } from '@apollo/client';
import type { AutomationActionNodeData, ValidationErrorEntry } from './types';

/**
 * Cheap client-side mirror of the per-type config checks in
 * apps/backend/src/services/automation/graphValidator.ts (ACTION_CONFIG_SCHEMAS).
 * Only checks "is this config obviously incomplete" — not full zod validation — so the
 * canvas can show a live "Setup required" badge without round-tripping to the server on
 * every keystroke. The server remains the source of truth on Activate.
 */
export function isActionConfigIncomplete(data: AutomationActionNodeData): boolean {
  const { actionType, config } = data;
  if (!config || Object.keys(config).length === 0) return true;

  switch (actionType) {
    case 'email':
      return !(
        (config.recipientEmail?.trim?.() || config.recipientFieldId) &&
        config.subject?.trim?.() &&
        config.message?.trim?.()
      );
    case 'webhook':
      return !/^https:\/\/.+/.test(config.url ?? '');
    case 'google-sheets':
      return !config.googleToken;
    case 'microsoft-sheets':
      return !config.microsoftToken;
    case 'slack':
      return true; // no backend handler yet — always "not set up"
    default:
      return false;
  }
}

/**
 * Pulls the per-node `extensions.validationErrors` array (set by setAutomationStatus in
 * apps/backend/src/graphql/resolvers/automations.ts on AUTOMATION_INVALID_GRAPH) off an
 * Apollo error, for mapping onto node outlines/tooltips.
 */
export function extractValidationErrors(error?: ErrorLike | null): ValidationErrorEntry[] | undefined {
  if (!error) return undefined;
  if (CombinedGraphQLErrors.is(error)) {
    for (const gqlError of error.errors) {
      const errors = (gqlError.extensions as Record<string, unknown> | undefined)?.validationErrors;
      if (Array.isArray(errors)) return errors as ValidationErrorEntry[];
    }
  }
  return undefined;
}

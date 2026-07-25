/**
 * automations.json `triggerTypes.*` keys can't contain dots (the translate() key
 * splitter treats "." as a path separator), so raw trigger type strings like
 * "form.submitted" are mapped to dot-free keys here before being passed to t().
 */
export const TRIGGER_TYPE_I18N_KEYS: Record<string, string> = {
  'form.submitted': 'formSubmitted',
  'response.edited': 'responseEdited',
  schedule: 'schedule',
};

export const SUPPORTED_TRIGGER_TYPES = ['form.submitted', 'response.edited', 'schedule'] as const;

export const triggerTypeI18nKey = (triggerType: string): string =>
  TRIGGER_TYPE_I18N_KEYS[triggerType] ?? triggerType;

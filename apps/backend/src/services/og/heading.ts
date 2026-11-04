const FORM_WORD = /\b(form|survey|quiz|questionnaire|application|checklist|poll|test|waiver|order)\b/i;

/** Same rule as the landing site (src/lib/templates.ts): "Contact Us" → "Contact Us Form Template". */
export const templateHeading = (name: string): string =>
  FORM_WORD.test(name) ? `${name} Template` : `${name} Form Template`;

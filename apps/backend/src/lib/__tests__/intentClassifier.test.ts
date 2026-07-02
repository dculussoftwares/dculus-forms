import { describe, it, expect } from 'vitest';
import { classifyIntent, intentToModelTier, intentToToolTier } from '../intentClassifier.js';

describe('classifyIntent', () => {
  // ── Complex intents ──────────────────────────────────────────────────────
  describe('complex intents → mini model', () => {
    it.each([
      ['analyze this form', 'complex'],
      ['analyse the form and give feedback', 'complex'],
      ['review all my fields', 'complex'],
      ['audit the form structure', 'complex'],
      ['remix this form into a job application', 'complex'],
      ['transform this form for medical use', 'complex'],
      ['suggest improvements for the form', 'complex'],
      ['suggest validation rules for all fields', 'complex'],
      ['recommend changes to the structure', 'complex'],
      ['generate all fields for a contact form', 'complex'],
      ['create a complete set of fields for registration', 'complex'],
      ['merge page 1 and page 2 together', 'complex'],
      ['combine all pages into one', 'complex'],
      ['consolidate the pages', 'complex'],
      ['reorganize the form', 'complex'],
      ['restructure the pages', 'complex'],
      ['make this form better', 'complex'],
      ["what's wrong with my form", 'complex'],
      ['improve the form flow', 'complex'],
      ['apply validation to all fields', 'complex'],
      ['add validation rules to every field', 'complex'],
    ])('"%s" → %s', (message, expected) => {
      expect(classifyIntent(message)).toBe(expected);
    });
  });

  // ── Simple intents ───────────────────────────────────────────────────────
  describe('simple intents → nano model', () => {
    it.each([
      ['add an email field', 'simple'],
      ['create a text field called "Full Name"', 'simple'],
      ['insert a date field after the email', 'simple'],
      ['add a dropdown for country', 'simple'],
      ['put a checkbox field at the end', 'simple'],
      ['rename the "Name" field to "Full Name"', 'simple'],
      ['change the label of this field', 'simple'],
      ['remove the phone number field', 'simple'],
      ['delete the last page', 'simple'],
      ['make the email field required', 'simple'],
      ['set all these fields as optional', 'simple'],
      ['reorder the fields on page 2', 'simple'],
      ['move the phone field to the top', 'simple'],
      ['swap the first two fields', 'simple'],
      ['update the placeholder text', 'simple'],
      ['change the hint for this field', 'simple'],
      ['edit the options for the dropdown', 'simple'],
      ['add a new page', 'simple'],
      ['rename page 2 to "Contact Info"', 'simple'],
      ['move the email field to page 2', 'simple'],
      ['copy this field to the last page', 'simple'],
      ['change the button text', 'simple'],
      ['update the intro header', 'simple'],
      ['modify the CTA label', 'simple'],
    ])('"%s" → %s', (message, expected) => {
      expect(classifyIntent(message)).toBe(expected);
    });
  });

  // ── Question intents ─────────────────────────────────────────────────────
  describe('question intents → nano model, no agent', () => {
    it.each([
      ['what field types do you support?', 'question'],
      ['how do I add conditional logic?', 'question'],
      ['can you help me with validation?', 'question'],
      ['can you explain what a checkbox field is?', 'question'],
      ["what's the difference between radio and checkbox?", 'question'],
      ['do you support file uploads?', 'question'],
      ['what are the available field types?', 'question'],
      ['explain how pages work', 'question'],
      ['do you have a date field option?', 'question'],
    ])('"%s" → %s', (message, expected) => {
      expect(classifyIntent(message)).toBe(expected);
    });
  });

  // ── Fallback ─────────────────────────────────────────────────────────────
  describe('ambiguous / short messages → simple (cost-saving default)', () => {
    it.each([
      ['ok', 'simple'],
      ['thanks', 'simple'],
      ['yes please', 'simple'],
      ['', 'simple'],
      ['looks good', 'simple'],
    ])('"%s" → simple', (message) => {
      expect(classifyIntent(message)).toBe('simple');
    });
  });

  // ── Complex takes priority over simple when both match ───────────────────
  it('complex pattern takes priority over simple pattern', () => {
    // "analyze" is complex even though the message contains "field"
    expect(classifyIntent('analyze all the fields')).toBe('complex');
  });
});

describe('intentToModelTier', () => {
  it('maps simple → nano', () => expect(intentToModelTier('simple')).toBe('nano'));
  it('maps question → nano', () => expect(intentToModelTier('question')).toBe('nano'));
  it('maps complex → mini', () => expect(intentToModelTier('complex')).toBe('mini'));
});

describe('intentToToolTier', () => {
  it('maps question → minimal', () => expect(intentToToolTier('question')).toBe('minimal'));
  it('maps simple → core', () => expect(intentToToolTier('simple')).toBe('core'));
  it('maps complex → full', () => expect(intentToToolTier('complex')).toBe('full'));
});

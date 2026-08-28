import { ConditionalRule, FieldType, FormPage } from '@dculus/types';
import { buildLogicIndex } from '../logicVisuals';
import { buildRuleSentence } from '../ruleSentence';

const makePage = (id: string, title: string, fields: Array<{ id: string; label?: string; type: FieldType }>): FormPage =>
  ({ id, title, order: 0, fields } as unknown as FormPage);

const pages = [
  makePage('page-1', 'About you', [
    { id: 'email', label: 'Email Address', type: FieldType.EMAIL_FIELD },
    { id: 'name', label: 'Full Name', type: FieldType.TEXT_INPUT_FIELD },
  ]),
  makePage('page-2', 'Details', [{ id: 'age', label: 'Age', type: FieldType.NUMBER_FIELD }]),
];

const index = buildLogicIndex(pages);

/**
 * Minimal English stand-in for the real i18n `t`. Mirrors the shape the locale
 * files provide (templates with {{placeholders}}) so ordering bugs surface here
 * rather than only in the running app.
 */
const dictionary: Record<string, string> = {
  'card.deletedField': 'deleted field',
  'chip.untitledField': 'Untitled field',
  'card.deletedPage': 'deleted page',
  'sentence.and': 'and',
  'sentence.or': 'or',
  'sentence.actionJoin': ', and ',
  'sentence.termWithValue': '{{field}} {{operator}} "{{value}}"',
  'sentence.actionClause': '{{verb}} {{targets}}',
  'sentence.full': 'When {{condition}}, {{effect}}.',
  'sentence.verbs.showField': 'show',
  'sentence.verbs.hideField': 'hide',
  'sentence.verbs.requireField': 'require',
  'sentence.verbs.skipToPage': 'skip ahead to',
  'operators.equals': 'is equal to',
  'operators.isFilled': 'is filled',
  'editor.page': 'Page {{number}}',
};

const t = (key: string, options?: { values?: Record<string, string | number> }): string => {
  const template = dictionary[key] ?? key;
  if (!options?.values) return template;
  return Object.entries(options.values).reduce(
    (acc, [name, value]) => acc.replace(new RegExp(`{{${name}}}`, 'g'), String(value)),
    template
  );
};

const makeRule = (overrides: Partial<ConditionalRule>): ConditionalRule => ({
  id: 'rule-1',
  enabled: true,
  combinator: 'all',
  terms: [],
  actions: [],
  ...overrides,
});

describe('buildRuleSentence', () => {
  it('reads a single-term rule as one sentence', () => {
    const rule = makeRule({
      terms: [{ fieldId: 'email', operator: 'isFilled' }],
      actions: [{ type: 'requireField', fieldIds: ['age'] }],
    });

    expect(buildRuleSentence(rule, index, t)).toBe('When Email Address is filled, require Age.');
  });

  it('joins multiple terms with the combinator', () => {
    const rule = makeRule({
      combinator: 'any',
      terms: [
        { fieldId: 'email', operator: 'isFilled' },
        { fieldId: 'name', operator: 'equals', value: 'Ada' },
      ],
      actions: [{ type: 'showField', fieldIds: ['age'] }],
    });

    expect(buildRuleSentence(rule, index, t)).toBe(
      'When Email Address is filled or Full Name is equal to "Ada", show Age.'
    );
  });

  it('names a page action by its title', () => {
    const rule = makeRule({
      terms: [{ fieldId: 'email', operator: 'isFilled' }],
      actions: [{ type: 'skipToPage', pageId: 'page-2' }],
    });

    expect(buildRuleSentence(rule, index, t)).toBe(
      'When Email Address is filled, skip ahead to Details.'
    );
  });

  // The inspector renders this while the author is still assembling the rule, so
  // a not-yet-chosen field must read as absent rather than as "deleted field",
  // which would look like a broken reference the author had just created.
  it('omits terms and actions that have not been filled in yet', () => {
    const rule = makeRule({
      terms: [{ fieldId: '', operator: 'equals' }],
      actions: [{ type: 'showField', fieldIds: [] }],
    });

    expect(buildRuleSentence(rule, index, t)).toBe('');
  });

  it('still names a genuinely deleted reference', () => {
    const rule = makeRule({
      terms: [{ fieldId: 'gone', operator: 'isFilled' }],
      actions: [{ type: 'showField', fieldIds: ['age'] }],
    });

    expect(buildRuleSentence(rule, index, t)).toBe('When deleted field is filled, show Age.');
  });
});

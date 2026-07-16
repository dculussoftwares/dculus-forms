import { describe, it, expect } from 'vitest';
import {
  serializeFormSchema,
  deserializeFormSchema,
  FormSchema,
  FormPage,
  TextInputField,
  TextFieldValidation,
  SelectField,
  FillableFormFieldValidation,
  ThemeType,
  SpacingType,
  PageModeType,
  FormLayout,
} from './index.js';
import type { ConditionalRule } from './conditions.js';

const layout: FormLayout = {
  theme: ThemeType.LIGHT,
  textColor: '#000000',
  spacing: SpacingType.NORMAL,
  code: 'L1',
  content: '',
  customBackGroundColor: '',
  backgroundImageKey: '',
  pageMode: PageModeType.MULTIPAGE,
};

const makePages = (): FormPage[] => [
  {
    id: 'page-1',
    title: 'Page 1',
    order: 0,
    fields: [
      new TextInputField(
        'field-text',
        'Name',
        '',
        '',
        '',
        '',
        new TextFieldValidation(true)
      ),
      new SelectField(
        'field-select',
        'Country',
        '',
        '',
        '',
        new FillableFormFieldValidation(false),
        ['India', 'Other']
      ),
    ],
  },
];

const makeConditions = (): ConditionalRule[] => [
  {
    id: 'rule-1',
    enabled: true,
    combinator: 'all',
    terms: [
      { fieldId: 'field-select', operator: 'equals', value: 'India' },
      { fieldId: 'field-text', operator: 'isFilled' },
    ],
    actions: [
      { type: 'showField', fieldIds: ['field-text'] },
      { type: 'hidePage', pageId: 'page-1' },
    ],
  },
  {
    id: 'rule-2',
    enabled: false,
    combinator: 'any',
    terms: [{ fieldId: 'field-text', operator: 'lessThan', value: 42 }],
    actions: [{ type: 'skipToPage', pageId: 'page-1' }],
  },
];

describe('FormSchema conditions serialization', () => {
  it('round-trips conditions through serialize + deserialize unchanged', () => {
    const schema: FormSchema = {
      pages: makePages(),
      layout,
      isShuffleEnabled: false,
      conditions: makeConditions(),
    };

    const roundTripped = deserializeFormSchema(
      JSON.parse(JSON.stringify(serializeFormSchema(schema)))
    );

    expect(roundTripped.conditions).toEqual(makeConditions());
  });

  it('preserves value types (string, number, string[]) across the round trip', () => {
    const conditions: ConditionalRule[] = [
      {
        id: 'rule-values',
        enabled: true,
        combinator: 'any',
        terms: [
          { fieldId: 'a', operator: 'equals', value: 'text' },
          { fieldId: 'b', operator: 'greaterThan', value: 10 },
          { fieldId: 'c', operator: 'contains', value: ['Opt 1', 'Opt 2'] },
          { fieldId: 'd', operator: 'isEmpty' },
        ],
        actions: [{ type: 'hideField', fieldIds: ['x', 'y'] }],
      },
    ];
    const schema: FormSchema = {
      pages: makePages(),
      layout,
      isShuffleEnabled: false,
      conditions,
    };

    const roundTripped = deserializeFormSchema(
      JSON.parse(JSON.stringify(serializeFormSchema(schema)))
    );

    const terms = roundTripped.conditions![0].terms;
    expect(terms[0].value).toBe('text');
    expect(terms[1].value).toBe(10);
    expect(terms[2].value).toEqual(['Opt 1', 'Opt 2']);
    expect(terms[3].value).toBeUndefined();
  });

  it('leaves conditions absent when the schema has none (back-compat)', () => {
    const schema: FormSchema = {
      pages: makePages(),
      layout,
      isShuffleEnabled: false,
    };

    const roundTripped = deserializeFormSchema(
      JSON.parse(JSON.stringify(serializeFormSchema(schema)))
    );

    expect(roundTripped.conditions).toBeUndefined();
    expect('conditions' in roundTripped).toBe(false);
  });

  it('deserializes legacy schemas (plain JSON without conditions) untouched', () => {
    const legacy = {
      pages: [
        {
          id: 'page-1',
          title: 'Page 1',
          order: 0,
          fields: [
            {
              id: 'field-text',
              type: 'text_input_field',
              label: 'Name',
            },
          ],
        },
      ],
      layout,
      isShuffleEnabled: false,
    };

    const deserialized = deserializeFormSchema(legacy);

    expect(deserialized.conditions).toBeUndefined();
    expect(deserialized.pages[0].fields).toHaveLength(1);
  });

  it('still deserializes fields correctly when conditions are present', () => {
    const schema: FormSchema = {
      pages: makePages(),
      layout,
      isShuffleEnabled: false,
      conditions: makeConditions(),
    };

    const roundTripped = deserializeFormSchema(
      JSON.parse(JSON.stringify(serializeFormSchema(schema)))
    );

    expect(roundTripped.pages[0].fields[0]).toBeInstanceOf(TextInputField);
    expect(roundTripped.pages[0].fields[1]).toBeInstanceOf(SelectField);
    expect(roundTripped.layout).toEqual(layout);
  });
});

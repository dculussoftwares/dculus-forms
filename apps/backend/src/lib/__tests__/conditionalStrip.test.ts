import { describe, it, expect } from 'vitest';
import { stripConditionallyHiddenValues } from '../conditionalStrip.js';

const baseSchema = (conditions?: unknown[]) => ({
  layout: {},
  isShuffleEnabled: false,
  pages: [
    {
      id: 'p1',
      title: 'Page 1',
      order: 0,
      fields: [
        {
          id: 'trigger',
          type: 'radio_field',
          label: 'Trigger',
          options: ['Yes', 'No'],
          validation: { required: false, type: 'fillable_form_field' },
        },
        {
          id: 'bonus',
          type: 'text_input_field',
          label: 'Bonus',
          validation: { required: false, type: 'text_field_validation' },
        },
      ],
    },
    {
      id: 'p2',
      title: 'Details',
      order: 1,
      fields: [
        {
          id: 'details',
          type: 'text_input_field',
          label: 'Details',
          validation: { required: false, type: 'text_field_validation' },
        },
      ],
    },
  ],
  ...(conditions ? { conditions } : {}),
});

const showBonusRule = {
  id: 'r-show-bonus',
  enabled: true,
  combinator: 'all',
  terms: [{ fieldId: 'trigger', operator: 'equals', value: 'Yes' }],
  actions: [{ type: 'showField', fieldIds: ['bonus'] }],
};

const hideDetailsRule = {
  id: 'r-hide-details',
  enabled: true,
  combinator: 'all',
  terms: [{ fieldId: 'trigger', operator: 'equals', value: 'No' }],
  actions: [{ type: 'hidePage', pageId: 'p2' }],
};

describe('stripConditionallyHiddenValues', () => {
  it('returns the payload unchanged when the schema has no conditions', () => {
    const data = { trigger: 'Yes', bonus: 'kept', details: 'kept' };
    expect(stripConditionallyHiddenValues(baseSchema(), data)).toBe(data);
  });

  it('strips a default-hidden showField target when its rule does not match', () => {
    const result = stripConditionallyHiddenValues(baseSchema([showBonusRule]), {
      trigger: 'No',
      bonus: 'injected despite being hidden',
      details: 'kept',
    });
    expect(result).toEqual({ trigger: 'No', details: 'kept' });
  });

  it('keeps the showField target when its rule matches', () => {
    const result = stripConditionallyHiddenValues(baseSchema([showBonusRule]), {
      trigger: 'Yes',
      bonus: 'legitimately visible',
      details: 'kept',
    });
    expect(result).toEqual({
      trigger: 'Yes',
      bonus: 'legitimately visible',
      details: 'kept',
    });
  });

  it('strips every field on a conditionally hidden page', () => {
    const result = stripConditionallyHiddenValues(baseSchema([hideDetailsRule]), {
      trigger: 'No',
      details: 'crafted request value for a hidden page',
    });
    expect(result).toEqual({ trigger: 'No' });
  });

  it('passes keys that belong to no schema field through untouched', () => {
    const result = stripConditionallyHiddenValues(baseSchema([hideDetailsRule]), {
      trigger: 'No',
      details: 'stripped',
      'not-a-schema-field': 'untouched',
    });
    expect(result).toEqual({ trigger: 'No', 'not-a-schema-field': 'untouched' });
  });

  it('never throws on malformed schemas or payloads', () => {
    const data = { a: 1 };
    expect(stripConditionallyHiddenValues(null, data)).toBe(data);
    expect(stripConditionallyHiddenValues('junk', data)).toBe(data);
    expect(
      stripConditionallyHiddenValues({ pages: 'junk', conditions: [showBonusRule] }, data)
    ).toEqual(data);
    expect(
      stripConditionallyHiddenValues(baseSchema([null, showBonusRule]), {
        trigger: 'No',
        bonus: 'hidden',
      })
    ).toEqual({ trigger: 'No' });
  });
});

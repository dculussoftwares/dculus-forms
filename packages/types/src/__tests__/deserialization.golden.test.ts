/**
 * Phase 0c golden baseline (docs/grid-layout-strategy.md §15.5): what
 * deserializeFormSchema / serializeFormSchema produce for a grid-less form with
 * every field type. Grid phases must leave these snapshots byte-identical
 * (R2/R4); do not update them in a grid PR.
 */
import { describe, it, expect } from 'vitest';
import { deserializeFormSchema, serializeFormSchema } from '../index';

const validation = (type: string, required = false, extra: object = {}) => ({ required, type, ...extra });

const gridlessSchema = {
  pages: [
    {
      id: 'page-1',
      title: 'About you',
      order: 0,
      showPageName: true,
      fields: [
        {
          id: 'f-text',
          type: 'text_input_field',
          label: 'Name',
          defaultValue: '',
          prefix: 'Mr',
          hint: 'Full name',
          placeholder: 'Jane',
          validation: validation('text_input_field', true, { minLength: 2, maxLength: 40 }),
        },
        {
          id: 'f-area',
          type: 'text_area_field',
          label: 'Bio',
          defaultValue: '',
          prefix: '',
          hint: '',
          placeholder: '',
          validation: validation('text_area_field', false, { maxLength: 500 }),
        },
        {
          id: 'f-email',
          type: 'email_field',
          label: 'Email',
          defaultValue: '',
          prefix: '',
          hint: '',
          placeholder: '',
          validation: validation('email_field', true),
        },
        {
          id: 'f-phone',
          type: 'phone_number_field',
          label: 'Phone',
          defaultValue: '',
          prefix: '',
          hint: '',
          placeholder: '',
          defaultCountry: 'IN',
          validation: validation('phone_number_field'),
        },
        {
          id: 'f-number',
          type: 'number_field',
          label: 'Age',
          defaultValue: '',
          prefix: '',
          hint: '',
          placeholder: '',
          min: 1,
          max: 120,
          validation: validation('number_field'),
        },
        {
          id: 'f-date',
          type: 'date_field',
          label: 'Birthday',
          defaultValue: '',
          prefix: '',
          hint: '',
          placeholder: '',
          minDate: '1900-01-01',
          maxDate: '2100-01-01',
          validation: validation('date_field'),
        },
        {
          id: 'f-gone',
          type: 'text_input_field',
          label: 'Removed',
          defaultValue: '',
          prefix: '',
          hint: '',
          placeholder: '',
          deleted: true,
          validation: validation('text_input_field'),
        },
        { id: 'f-rich', type: 'rich_text_field', content: '<p>Welcome</p>' },
      ],
    },
    {
      id: 'page-2',
      title: 'Preferences',
      order: 1,
      showPageName: false,
      fields: [
        {
          id: 'f-select',
          type: 'select_field',
          label: 'Country',
          defaultValue: '',
          prefix: '',
          hint: '',
          options: ['IN', 'US'],
          validation: validation('select_field', true),
        },
        {
          id: 'f-radio',
          type: 'radio_field',
          label: 'Size',
          defaultValue: 'M',
          prefix: '',
          hint: '',
          options: ['S', 'M', 'L'],
          validation: validation('radio_field'),
        },
        {
          id: 'f-check',
          type: 'checkbox_field',
          label: 'Colours',
          defaultValues: ['Red'],
          prefix: '',
          hint: '',
          placeholder: '',
          options: ['Red', 'Blue'],
          validation: validation('checkbox_field', false, { minSelections: 1, maxSelections: 2 }),
        },
        {
          id: 'f-file',
          type: 'file_upload_field',
          label: 'Resume',
          prefix: '',
          hint: 'PDF only',
          allowedMimeTypes: ['application/pdf'],
          maxFileSizeMb: 5,
          maxFiles: 2,
          validation: validation('file_upload_field'),
        },
      ],
    },
  ],
  layout: {
    theme: 'light',
    textColor: '#111111',
    spacing: 'normal',
    code: 'L1',
    content: '<p>Hi</p>',
    customBackGroundColor: '#ffffff',
    backgroundImageKey: 'bg/key.png',
  },
  isShuffleEnabled: false,
};

describe('schema (de)serialization on a grid-less form (golden)', () => {
  it('deserializeFormSchema output', () => {
    expect(deserializeFormSchema(gridlessSchema)).toMatchSnapshot();
  });

  it('serializeFormSchema(deserializeFormSchema(x)) output', () => {
    expect(serializeFormSchema(deserializeFormSchema(gridlessSchema))).toMatchSnapshot();
  });

  it('a second round trip is a no-op', () => {
    const once = serializeFormSchema(deserializeFormSchema(gridlessSchema));
    const twice = serializeFormSchema(deserializeFormSchema(once));
    expect(twice).toEqual(once);
  });
});

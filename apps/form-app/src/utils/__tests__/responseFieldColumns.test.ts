// setupTests.ts mocks '@dculus/types' with a subset of field classes; these
// tests need the real class hierarchy for `instanceof FillableFormField`.
jest.unmock('@dculus/types');

import {
  TextFieldValidation,
  TextInputField,
  type FormResponse,
  type FormSchema,
} from '@dculus/types';
import { planResponseFieldColumns } from '../responseFieldColumns';

const validation = new TextFieldValidation(false);

const textField = (id: string, label: string, deleted = false) => {
  const field = new TextInputField(id, label, '', '', '', '', validation);
  if (deleted) field.deleted = true;
  return field;
};

// Deleted fields sit between active ones, as after removing a question mid-form.
const formSchema = {
  pages: [
    {
      id: 'page-1',
      title: 'Page 1',
      order: 0,
      fields: [
        textField('name', 'Name'),
        textField('old-answered', 'Old Answered', true),
        textField('old-empty', 'Old Empty', true),
        textField('city', 'City'),
      ],
    },
  ],
} as unknown as FormSchema;

const response = (id: string, data: Record<string, unknown>): FormResponse =>
  ({ id, formId: 'form-1', data, submittedAt: new Date(0) }) as FormResponse;

const plan = (
  answeredDeletedFieldIds: ReadonlySet<string> | undefined,
  responses: FormResponse[] = [],
  schema: FormSchema = formSchema
) => {
  const { fields, orphanIds } = planResponseFieldColumns(schema, responses, answeredDeletedFieldIds);
  return { fieldIds: fields.map((f) => f.id), orphanIds };
};

describe('planResponseFieldColumns', () => {
  it('keeps only answered deleted fields, after every active field', () => {
    expect(plan(new Set(['old-answered'])).fieldIds).toEqual(['name', 'city', 'old-answered']);
  });

  it('drops every deleted field when no response answered them', () => {
    expect(plan(new Set()).fieldIds).toEqual(['name', 'city']);
  });

  it('keeps every deleted field while answers are still unknown', () => {
    expect(plan(undefined).fieldIds).toEqual(['name', 'city', 'old-answered', 'old-empty']);
  });

  it('lists orphan ids only when a loaded response answered them', () => {
    const responses = [
      response('r1', { name: 'Ann', 'gone-answered': 'x', 'gone-blank': '' }),
      response('r2', { name: 'Bob', 'gone-blank': null, 'gone-empty-list': [] }),
    ];

    expect(plan(new Set(), responses).orphanIds).toEqual(['gone-answered']);
  });

  it('skips orphan detection until the schema has fields', () => {
    const emptySchema = { pages: [] } as unknown as FormSchema;
    expect(plan(new Set(), [response('r1', { anything: 'x' })], emptySchema).orphanIds).toEqual([]);
  });
});

import { describe, it, expect } from 'vitest';
import { deserializeFormSchema, FieldType } from '@dculus/types';
import { fileNameFromKey, listAnsweredQuestions } from './answerFormat';

const field = (id: string, type: FieldType, label: string, extra: Record<string, unknown> = {}) => ({
  id,
  type,
  label,
  defaultValue: '',
  prefix: '',
  hint: '',
  placeholder: '',
  validation: { required: false, type: FieldType.FILLABLE_FORM_FIELD },
  ...extra,
});

const schema = deserializeFormSchema({
  pages: [
    {
      id: 'p1',
      title: 'Page 1',
      order: 0,
      fields: [
        field('name', FieldType.TEXT_INPUT_FIELD, 'Name'),
        field('tags', FieldType.CHECKBOX_FIELD, 'Tags', { options: ['a', 'b'] }),
        field('cv', FieldType.FILE_UPLOAD_FIELD, 'CV'),
        { id: 'intro', type: FieldType.RICH_TEXT_FIELD, content: '<p>Hi</p>' },
      ],
    },
    { id: 'p2', title: 'Page 2', order: 1, fields: [field('age', FieldType.NUMBER_FIELD, 'Age')] },
  ],
  layout: {},
  isShuffleEnabled: false,
});

const labels = { yes: 'Yes', no: 'No' };

describe('listAnsweredQuestions', () => {
  it('lists every question in form order with its formatted answer', () => {
    expect(
      listAnsweredQuestions(
        schema,
        { name: 'Ada', tags: ['a', 'b'], cv: ['forms/f1/1712345678901-0f8fad5b-d9cb-469f-a165-70867728950e-cv.pdf'] },
        labels
      )
    ).toEqual([
      { fieldId: 'name', label: 'Name', answer: 'Ada' },
      { fieldId: 'tags', label: 'Tags', answer: 'a, b' },
      { fieldId: 'cv', label: 'CV', answer: 'cv.pdf' },
      { fieldId: 'age', label: 'Age', answer: null },
    ]);
  });

  it('treats blanks as unanswered', () => {
    const answers = listAnsweredQuestions(schema, { name: '', tags: [], age: 0 }, labels);
    expect(answers.map((q) => q.answer)).toEqual([null, null, null, '0']);
  });
});

describe('fileNameFromKey', () => {
  it('strips the folder and upload prefix', () => {
    expect(fileNameFromKey('a/b/1712345678901-0f8fad5b-d9cb-469f-a165-70867728950e-report.pdf')).toBe('report.pdf');
    expect(fileNameFromKey('plain.txt')).toBe('plain.txt');
  });
});

import {
  buildMetaFilterFields,
  buildPdfGeneratorMetaFields,
  groupMetaFieldsBySection,
  TRIGGER_QUIZ_META_FIELDS,
} from '../metaFilterFields';

describe('buildMetaFilterFields', () => {
  it('omits the Quiz section when quizEnabled is false/unset', () => {
    const fields = buildMetaFilterFields();
    expect(fields.some((f) => f.section === 'quiz')).toBe(false);
  });

  it('includes the Quiz section (score/passed/status/attempt) when quizEnabled is true', () => {
    const fields = buildMetaFilterFields({ quizEnabled: true });
    const quizIds = fields.filter((f) => f.section === 'quiz').map((f) => f.id);
    expect(quizIds).toEqual(['__gradePercentage', '__gradePassed', '__gradeStatus', '__gradeAttempt']);
  });

  it('always includes the universal sections (submission, respondent, editHistory, response)', () => {
    const fields = buildMetaFilterFields();
    const sections = new Set(fields.map((f) => f.section));
    expect(sections.has('submission')).toBe(true);
    expect(sections.has('respondent')).toBe(true);
    expect(sections.has('editHistory')).toBe(true);
    expect(sections.has('response')).toBe(true);
  });

  it('omits the PDF section when no generators are passed', () => {
    const fields = buildMetaFilterFields();
    expect(fields.some((f) => f.section === 'pdf')).toBe(false);
  });

  it('adds one PDF field per generator, prefixed and carrying the generator name', () => {
    const fields = buildMetaFilterFields({
      pdfGenerators: [
        { id: 'gen1', name: 'Certificate' },
        { id: 'gen2', name: 'Invoice' },
      ],
    });
    const pdfFields = fields.filter((f) => f.section === 'pdf');
    expect(pdfFields.map((f) => f.id)).toEqual(['__pdfGenerated_gen1', '__pdfGenerated_gen2']);
    expect(pdfFields[0].labelValues).toEqual({ name: 'Certificate' });
  });

  it('__completenessPercent overrides operators to drop IS_EMPTY/IS_NOT_EMPTY', () => {
    const fields = buildMetaFilterFields();
    const completeness = fields.find((f) => f.id === '__completenessPercent');
    expect(completeness?.operators).toBeDefined();
    expect(completeness?.operators).not.toContain('IS_EMPTY');
    expect(completeness?.operators).not.toContain('IS_NOT_EMPTY');
  });
});

describe('buildPdfGeneratorMetaFields', () => {
  it('gives every generator field a fixed true/false boolean choice', () => {
    const [field] = buildPdfGeneratorMetaFields([{ id: 'gen1', name: 'Certificate' }]);
    expect(field.kind).toBe('boolean');
    expect(field.booleanOptions?.map((o) => o.value)).toEqual(['true', 'false']);
  });
});

describe('groupMetaFieldsBySection', () => {
  it('groups fields by their section, preserving relative order within a section', () => {
    const fields = buildMetaFilterFields({ quizEnabled: true });
    const grouped = groupMetaFieldsBySection(fields);
    expect(grouped.get('quiz')?.map((f) => f.id)).toEqual([
      '__gradePercentage',
      '__gradePassed',
      '__gradeStatus',
      '__gradeAttempt',
    ]);
    expect(grouped.has('pdf')).toBe(false);
  });
});

describe('TRIGGER_QUIZ_META_FIELDS', () => {
  it('uses the quizFanout key names, not the __grade* SQL fieldIds', () => {
    const ids = TRIGGER_QUIZ_META_FIELDS.map((f) => f.id);
    expect(ids).toEqual(['quizPercentage', 'quizPassed']);
    expect(ids.some((id) => id.startsWith('__'))).toBe(false);
  });
});

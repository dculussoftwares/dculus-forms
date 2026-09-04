import { describe, it, expect } from 'vitest';
import {
  TextInputField,
  TextAreaField,
  EmailField,
  NumberField,
  SelectField,
  RadioField,
  CheckboxField,
  DateField,
  FileUploadField,
  PhoneNumberField,
  RichTextFormField,
  FillableFormField,
  TextFieldValidation,
  CheckboxFieldValidation,
  FillableFormFieldValidation,
  FieldType,
  serializeFormSchema,
  deserializeFormSchema,
  deserializeFormField,
  serializeFormField,
  type FormSchema,
  type FieldGrading,
} from '../index.js';
import {
  sanitizeFieldGrading,
  sanitizeQuizSettings,
  DEFAULT_QUIZ_SETTINGS,
  FIELD_TYPE_DEFAULT_GRADING_MODE,
  isGradableFieldType,
  buildAnswerKeyGrading,
} from '../quiz.js';

const exactGrading: FieldGrading = {
  mode: 'exact',
  pointValue: 5,
  acceptedAnswers: ['Paris'],
};

const setGrading: FieldGrading = {
  mode: 'set',
  pointValue: 10,
  acceptedAnswers: ['a', 'b'],
  set: { scoring: 'partial', wrongSelectionPenalty: 0.5 },
};

const textGrading: FieldGrading = {
  mode: 'text',
  pointValue: 2,
  acceptedAnswers: ['hello'],
  text: { caseSensitive: false, trimWhitespace: true },
};

const numericGrading: FieldGrading = {
  mode: 'numeric',
  pointValue: 3,
  acceptedAnswers: ['42'],
  numeric: { tolerance: 0.5 },
};

const manualGrading: FieldGrading = {
  mode: 'manual',
  pointValue: 8,
  acceptedAnswers: [],
};

function makeSchema(fields: ReturnType<typeof serializeFormField>[]): FormSchema {
  return {
    pages: [
      {
        id: 'page1',
        title: 'Page 1',
        order: 0,
        fields: fields as any,
      },
    ],
    layout: {
      theme: 'light' as any,
      textColor: '#000',
      spacing: 'normal' as any,
      code: 'L1',
      content: '',
      thankYouContent: '',
      customBackGroundColor: '',
      backgroundImageKey: '',
      pageMode: 'multipage' as any,
    },
    isShuffleEnabled: false,
  };
}

describe('quiz.ts — round-trip: grading through serializeFormSchema/deserializeFormSchema', () => {
  const gradableCases: Array<{
    name: string;
    build: () => InstanceType<
      | typeof TextInputField
      | typeof TextAreaField
      | typeof EmailField
      | typeof NumberField
      | typeof SelectField
      | typeof RadioField
      | typeof CheckboxField
      | typeof DateField
      | typeof FileUploadField
      | typeof PhoneNumberField
    >;
    grading: FieldGrading;
  }> = [
    {
      name: 'TEXT_INPUT_FIELD',
      build: () =>
        new TextInputField(
          'f1',
          'Label',
          '',
          '',
          '',
          '',
          new TextFieldValidation(false)
        ),
      grading: textGrading,
    },
    {
      name: 'TEXT_AREA_FIELD',
      build: () =>
        new TextAreaField(
          'f2',
          'Label',
          '',
          '',
          '',
          '',
          new TextFieldValidation(false)
        ),
      grading: manualGrading,
    },
    {
      name: 'EMAIL_FIELD',
      build: () =>
        new EmailField(
          'f3',
          'Label',
          '',
          '',
          '',
          '',
          new FillableFormFieldValidation(false)
        ),
      grading: textGrading,
    },
    {
      name: 'NUMBER_FIELD',
      build: () =>
        new NumberField(
          'f4',
          'Label',
          '',
          '',
          '',
          '',
          new FillableFormFieldValidation(false)
        ),
      grading: numericGrading,
    },
    {
      name: 'SELECT_FIELD',
      build: () =>
        new SelectField(
          'f5',
          'Label',
          '',
          '',
          '',
          new FillableFormFieldValidation(false),
          ['A', 'B']
        ),
      grading: exactGrading,
    },
    {
      name: 'RADIO_FIELD',
      build: () =>
        new RadioField(
          'f6',
          'Label',
          '',
          '',
          '',
          new FillableFormFieldValidation(false),
          ['A', 'B']
        ),
      grading: exactGrading,
    },
    {
      name: 'CHECKBOX_FIELD',
      build: () =>
        new CheckboxField(
          'f7',
          'Label',
          [],
          '',
          '',
          '',
          new CheckboxFieldValidation(false),
          ['A', 'B']
        ),
      grading: setGrading,
    },
    {
      name: 'DATE_FIELD',
      build: () =>
        new DateField(
          'f8',
          'Label',
          '',
          '',
          '',
          '',
          new FillableFormFieldValidation(false)
        ),
      grading: exactGrading,
    },
    {
      name: 'FILE_UPLOAD_FIELD',
      build: () =>
        new FileUploadField(
          'f9',
          'Label',
          '',
          '',
          new FillableFormFieldValidation(false)
        ),
      grading: manualGrading,
    },
    {
      name: 'PHONE_NUMBER_FIELD',
      build: () =>
        new PhoneNumberField(
          'f10',
          'Label',
          '',
          '',
          '',
          '',
          new FillableFormFieldValidation(false)
        ),
      grading: textGrading,
    },
  ];

  for (const { name, build, grading } of gradableCases) {
    it(`preserves grading for ${name} through a full schema round-trip`, () => {
      const field = build();
      field.grading = grading;

      const schema = makeSchema([serializeFormField(field)]);
      const serialized = serializeFormSchema(schema);
      const roundTripped = deserializeFormSchema(
        JSON.parse(JSON.stringify(serialized))
      );

      const deserializedField = roundTripped.pages[0].fields[0];
      expect(deserializedField).toBeInstanceOf(FillableFormField);
      expect((deserializedField as FillableFormField).grading).toEqual(grading);
    });
  }
});

describe('quiz.ts — absence of grading', () => {
  it('a field without grading deserializes with grading === undefined (not {} or null)', () => {
    const field = new TextInputField(
      'f1',
      'Label',
      '',
      '',
      '',
      '',
      new TextFieldValidation(false)
    );
    const deserialized = deserializeFormField(serializeFormField(field));
    expect(deserialized).toBeInstanceOf(FillableFormField);
    const grading = (deserialized as FillableFormField).grading;
    expect(grading).toBeUndefined();
    expect(grading).not.toEqual({});
    expect(grading).not.toBeNull();
  });

  it('RICH_TEXT_FIELD never receives grading, even if the input JSON contains one', () => {
    const data = {
      id: 'rt1',
      type: FieldType.RICH_TEXT_FIELD,
      content: '<p>Hello</p>',
      grading: exactGrading,
    };
    const deserialized = deserializeFormField(data);
    expect(deserialized).toBeInstanceOf(RichTextFormField);
    expect((deserialized as any).grading).toBeUndefined();
  });
});

describe('quiz.ts — sanitizeFieldGrading', () => {
  it('accepts well-formed grading', () => {
    expect(sanitizeFieldGrading(exactGrading)).toEqual(exactGrading);
  });

  it('drops grading with an invalid mode', () => {
    expect(
      sanitizeFieldGrading({ ...exactGrading, mode: 'bogus' })
    ).toBeUndefined();
  });

  it('drops grading missing pointValue', () => {
    const rest: Record<string, unknown> = { ...exactGrading };
    delete rest.pointValue;
    expect(sanitizeFieldGrading(rest)).toBeUndefined();
  });

  it('drops grading with non-array acceptedAnswers', () => {
    expect(
      sanitizeFieldGrading({ ...exactGrading, acceptedAnswers: 'Paris' })
    ).toBeUndefined();
  });

  it('drops null', () => {
    expect(sanitizeFieldGrading(null)).toBeUndefined();
  });

  it('drops a bare string', () => {
    expect(sanitizeFieldGrading('not grading')).toBeUndefined();
  });

  it('drops undefined', () => {
    expect(sanitizeFieldGrading(undefined)).toBeUndefined();
  });

  it('a field with malformed grading still deserializes fine, just without grading', () => {
    const data = {
      id: 'f1',
      type: FieldType.TEXT_INPUT_FIELD,
      label: 'Label',
      grading: { mode: 'bogus', pointValue: 'not-a-number' },
    };
    const deserialized = deserializeFormField(data);
    expect(deserialized).toBeInstanceOf(FillableFormField);
    expect((deserialized as FillableFormField).grading).toBeUndefined();
  });
});

describe('quiz.ts — sanitizeQuizSettings', () => {
  it('accepts DEFAULT_QUIZ_SETTINGS', () => {
    expect(sanitizeQuizSettings(DEFAULT_QUIZ_SETTINGS)).toEqual(
      DEFAULT_QUIZ_SETTINGS
    );
  });

  it('drops malformed quiz settings (missing respondentVisibility)', () => {
    expect(
      sanitizeQuizSettings({ enabled: true, gradeRelease: 'immediate' })
    ).toBeUndefined();
  });

  it('drops non-object input', () => {
    expect(sanitizeQuizSettings('quiz')).toBeUndefined();
    expect(sanitizeQuizSettings(null)).toBeUndefined();
  });

  it('drops passThresholdPercent outside 0..100', () => {
    expect(
      sanitizeQuizSettings({ ...DEFAULT_QUIZ_SETTINGS, passThresholdPercent: -1 })
    ).toBeUndefined();
    expect(
      sanitizeQuizSettings({ ...DEFAULT_QUIZ_SETTINGS, passThresholdPercent: 101 })
    ).toBeUndefined();
  });

  it('drops gradeRelease: "scheduled" without a releaseAt timestamp', () => {
    expect(
      sanitizeQuizSettings({
        ...DEFAULT_QUIZ_SETTINGS,
        gradeRelease: 'scheduled',
      })
    ).toBeUndefined();
  });

  it('drops a non-ISO-8601 releaseAt', () => {
    expect(
      sanitizeQuizSettings({
        ...DEFAULT_QUIZ_SETTINGS,
        gradeRelease: 'scheduled',
        releaseAt: 'not-a-date',
      })
    ).toBeUndefined();
  });

  it('accepts gradeRelease: "scheduled" with a valid ISO 8601 releaseAt', () => {
    const settings = {
      ...DEFAULT_QUIZ_SETTINGS,
      gradeRelease: 'scheduled' as const,
      releaseAt: '2026-09-01T00:00:00Z',
    };
    expect(sanitizeQuizSettings(settings)).toEqual(settings);
  });

  // These four fields are nullable GraphQL scalars (`Float`/`String`, no
  // `!`): a field never set on a quiz form resolves to `null` (not an
  // absent key) once read back from any query, not `undefined`. Without
  // `.nullish()` here, every save after the first would fail this
  // validation for any quiz form that never set these — a real regression
  // caught while manually verifying epic #289 Story 17 (#321) end-to-end.
  it('treats null (GraphQL-nullable-scalar round-trip) the same as absent for optional fields', () => {
    const settings = {
      ...DEFAULT_QUIZ_SETTINGS,
      passThresholdPercent: null,
      releaseAt: null,
      resultMessagePass: null,
      resultMessageFail: null,
    };
    const sanitized = sanitizeQuizSettings(settings);
    expect(sanitized).toBeDefined();
    expect(sanitized?.passThresholdPercent).toBeUndefined();
    expect(sanitized?.releaseAt).toBeUndefined();
    expect(sanitized?.resultMessagePass).toBeUndefined();
    expect(sanitized?.resultMessageFail).toBeUndefined();
  });
});

describe('quiz.ts — FIELD_TYPE_DEFAULT_GRADING_MODE / isGradableFieldType', () => {
  it('matches the epic default-mode table for gradable types', () => {
    expect(FIELD_TYPE_DEFAULT_GRADING_MODE[FieldType.RADIO_FIELD]).toBe(
      'exact'
    );
    expect(FIELD_TYPE_DEFAULT_GRADING_MODE[FieldType.CHECKBOX_FIELD]).toBe(
      'set'
    );
    expect(FIELD_TYPE_DEFAULT_GRADING_MODE[FieldType.TEXT_INPUT_FIELD]).toBe(
      'text'
    );
    expect(FIELD_TYPE_DEFAULT_GRADING_MODE[FieldType.TEXT_AREA_FIELD]).toBe(
      'manual'
    );
    expect(FIELD_TYPE_DEFAULT_GRADING_MODE[FieldType.NUMBER_FIELD]).toBe(
      'numeric'
    );
    expect(FIELD_TYPE_DEFAULT_GRADING_MODE[FieldType.DATE_FIELD]).toBe(
      'exact'
    );
    expect(FIELD_TYPE_DEFAULT_GRADING_MODE[FieldType.EMAIL_FIELD]).toBe(
      'text'
    );
    expect(
      FIELD_TYPE_DEFAULT_GRADING_MODE[FieldType.PHONE_NUMBER_FIELD]
    ).toBe('text');
    expect(FIELD_TYPE_DEFAULT_GRADING_MODE[FieldType.FILE_UPLOAD_FIELD]).toBe(
      'manual'
    );
  });

  it('RICH_TEXT_FIELD is not gradable (non-fillable)', () => {
    expect(FIELD_TYPE_DEFAULT_GRADING_MODE[FieldType.RICH_TEXT_FIELD]).toBeUndefined();
    expect(isGradableFieldType(FieldType.RICH_TEXT_FIELD)).toBe(false);
  });

  it('every field type in the table is reported gradable', () => {
    for (const type of Object.keys(FIELD_TYPE_DEFAULT_GRADING_MODE) as FieldType[]) {
      expect(isGradableFieldType(type)).toBe(true);
    }
  });
});

describe('quiz.ts — buildAnswerKeyGrading', () => {
  it('radio → exact mode, single accepted answer, 1 point default', () => {
    expect(buildAnswerKeyGrading('radio_field', ['Paris', 'Berlin'])).toEqual({
      mode: 'exact',
      pointValue: 1,
      acceptedAnswers: ['Paris'],
    });
  });

  it('checkbox → set mode with scoring "all" and every accepted answer', () => {
    expect(buildAnswerKeyGrading('checkbox_field', ['A', 'C'])).toEqual({
      mode: 'set',
      pointValue: 1,
      acceptedAnswers: ['A', 'C'],
      set: { scoring: 'all' },
    });
  });

  it('select → exact mode (single-select quiz question)', () => {
    expect(buildAnswerKeyGrading('select_field', ['Yes'])?.mode).toBe('exact');
  });

  it('honours a custom point value', () => {
    expect(buildAnswerKeyGrading('radio_field', ['x'], 5)?.pointValue).toBe(5);
  });

  it('trims and drops blank answers', () => {
    expect(buildAnswerKeyGrading('checkbox_field', ['  A  ', '', '   '])).toEqual({
      mode: 'set',
      pointValue: 1,
      acceptedAnswers: ['A'],
      set: { scoring: 'all' },
    });
  });

  it('returns undefined when there is nothing to key', () => {
    expect(buildAnswerKeyGrading('radio_field', [])).toBeUndefined();
    expect(buildAnswerKeyGrading('radio_field', null)).toBeUndefined();
    expect(buildAnswerKeyGrading('radio_field', undefined)).toBeUndefined();
  });

  it('returns undefined for manual / unknown field types', () => {
    expect(buildAnswerKeyGrading('text_area_field', ['essay'])).toBeUndefined();
    expect(buildAnswerKeyGrading('file_upload_field', ['x'])).toBeUndefined();
    expect(buildAnswerKeyGrading('not_a_field', ['x'])).toBeUndefined();
  });

  it('produces grading that survives sanitizeFieldGrading unchanged', () => {
    const g = buildAnswerKeyGrading('checkbox_field', ['A', 'B']);
    expect(sanitizeFieldGrading(g)).toEqual(g);
  });
});

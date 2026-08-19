import { describe, it, expect } from 'vitest';
import type { FieldGrading, FormLayout, FormSchema, QuizSettings } from '@dculus/types';
import { FieldType } from '@dculus/types';
import { gradeResponse } from '../gradingEngine.js';

const baseSettings: QuizSettings = {
  enabled: true,
  passThresholdPercent: 60,
  gradeRelease: 'immediate',
  respondentVisibility: {
    totalScore: true,
    perQuestionCorrectness: true,
    correctAnswers: false,
    pointValues: false,
    feedback: false,
    passFailBadge: true,
  },
};

interface FieldOpts {
  id: string;
  type: FieldType;
  label?: string;
  grading?: FieldGrading;
  deleted?: boolean;
}

const field = ({ id, type, label = id, grading, deleted }: FieldOpts) => ({
  id,
  type,
  label,
  grading,
  deleted,
});

const schemaWith = (fields: ReturnType<typeof field>[]): FormSchema => ({
  pages: [{ id: 'page-1', title: 'Page 1', fields: fields as FormSchema['pages'][number]['fields'], order: 0 }],
  layout: {} as FormLayout,
  isShuffleEnabled: false,
});

describe('gradeResponse', () => {
  describe('exact mode', () => {
    const grading: FieldGrading = { mode: 'exact', pointValue: 10, acceptedAnswers: ['Paris'] };
    const schema = schemaWith([field({ id: 'q1', type: FieldType.RADIO_FIELD, grading })]);

    it('awards full points on an exact match', () => {
      const result = gradeResponse(schema, baseSettings, { q1: 'Paris' });
      expect(result.score).toBe(10);
      expect(result.maxScore).toBe(10);
      expect(result.percentage).toBe(100);
      expect(result.questions[0].correct).toBe(true);
    });

    it('coerces and trims before comparing', () => {
      const result = gradeResponse(schema, baseSettings, { q1: '  Paris  ' });
      expect(result.questions[0].correct).toBe(true);
    });

    it('scores zero on mismatch', () => {
      const result = gradeResponse(schema, baseSettings, { q1: 'London' });
      expect(result.score).toBe(0);
      expect(result.questions[0].correct).toBe(false);
    });

    it('treats null and undefined submissions as incorrect, not a crash', () => {
      expect(gradeResponse(schema, baseSettings, { q1: null }).questions[0].correct).toBe(false);
      expect(gradeResponse(schema, baseSettings, { q1: undefined }).questions[0].correct).toBe(
        false
      );
    });
  });

  describe('set mode', () => {
    it('all: requires an exact set match', () => {
      const grading: FieldGrading = {
        mode: 'set',
        pointValue: 10,
        acceptedAnswers: ['A', 'B'],
        set: { scoring: 'all' },
      };
      const schema = schemaWith([field({ id: 'q1', type: FieldType.CHECKBOX_FIELD, grading })]);

      expect(gradeResponse(schema, baseSettings, { q1: ['A', 'B'] }).score).toBe(10);
      expect(gradeResponse(schema, baseSettings, { q1: ['A'] }).score).toBe(0);
      expect(gradeResponse(schema, baseSettings, { q1: ['A', 'B', 'C'] }).score).toBe(0);
    });

    it('all: dedupes duplicate selections', () => {
      const grading: FieldGrading = {
        mode: 'set',
        pointValue: 10,
        acceptedAnswers: ['A', 'B'],
        set: { scoring: 'all' },
      };
      const schema = schemaWith([field({ id: 'q1', type: FieldType.CHECKBOX_FIELD, grading })]);
      const result = gradeResponse(schema, baseSettings, { q1: ['A', 'A', 'B', 'B'] });
      expect(result.score).toBe(10);
      expect(result.questions[0].correct).toBe(true);
    });

    it('any: awards full points for at least one correct pick', () => {
      const grading: FieldGrading = {
        mode: 'set',
        pointValue: 10,
        acceptedAnswers: ['A', 'B'],
        set: { scoring: 'any' },
      };
      const schema = schemaWith([field({ id: 'q1', type: FieldType.CHECKBOX_FIELD, grading })]);
      expect(gradeResponse(schema, baseSettings, { q1: ['A', 'Z'] }).score).toBe(10);
      expect(gradeResponse(schema, baseSettings, { q1: ['Z'] }).score).toBe(0);
    });

    it('partial: applies the penalty formula and floors at zero', () => {
      const grading: FieldGrading = {
        mode: 'set',
        pointValue: 10,
        acceptedAnswers: ['A', 'B', 'C', 'D'],
        set: { scoring: 'partial', wrongSelectionPenalty: 1 },
      };
      const schema = schemaWith([field({ id: 'q1', type: FieldType.CHECKBOX_FIELD, grading })]);

      // picked ∩ key = 2 (A,B), picked \ key = 1 (Z) -> 10 * max(0, 2 - 1*1) / 4 = 2.5
      expect(gradeResponse(schema, baseSettings, { q1: ['A', 'B', 'Z'] }).score).toBe(2.5);

      // every wrong option picked -> never negative
      const grading2: FieldGrading = {
        mode: 'set',
        pointValue: 10,
        acceptedAnswers: ['A'],
        set: { scoring: 'partial', wrongSelectionPenalty: 1 },
      };
      const schema2 = schemaWith([field({ id: 'q1', type: FieldType.CHECKBOX_FIELD, grading: grading2 })]);
      const result = gradeResponse(schema2, baseSettings, { q1: ['X', 'Y', 'Z'] });
      expect(result.score).toBe(0);
    });

    it('partial: default penalty is 1 when unspecified', () => {
      const grading: FieldGrading = {
        mode: 'set',
        pointValue: 10,
        acceptedAnswers: ['A', 'B'],
        set: { scoring: 'partial' },
      };
      const schema = schemaWith([field({ id: 'q1', type: FieldType.CHECKBOX_FIELD, grading })]);
      // 1 correct, 1 wrong -> 10 * max(0, 1 - 1) / 2 = 0
      expect(gradeResponse(schema, baseSettings, { q1: ['A', 'Z'] }).score).toBe(0);
    });
  });

  describe('text mode', () => {
    it('normalizes case, whitespace, and matches any accepted answer', () => {
      const grading: FieldGrading = {
        mode: 'text',
        pointValue: 5,
        acceptedAnswers: ['blue whale', 'blue-whale'],
        text: { collapseWhitespace: true, trimWhitespace: true },
      };
      const schema = schemaWith([field({ id: 'q1', type: FieldType.TEXT_INPUT_FIELD, grading })]);
      expect(gradeResponse(schema, baseSettings, { q1: '  Blue   Whale  ' }).score).toBe(5);
    });

    it('respects caseSensitive', () => {
      const grading: FieldGrading = {
        mode: 'text',
        pointValue: 5,
        acceptedAnswers: ['Paris'],
        text: { caseSensitive: true },
      };
      const schema = schemaWith([field({ id: 'q1', type: FieldType.TEXT_INPUT_FIELD, grading })]);
      expect(gradeResponse(schema, baseSettings, { q1: 'paris' }).score).toBe(0);
      expect(gradeResponse(schema, baseSettings, { q1: 'Paris' }).score).toBe(5);
    });

    it('strips punctuation when ignorePunctuation is set', () => {
      const grading: FieldGrading = {
        mode: 'text',
        pointValue: 5,
        acceptedAnswers: ['dont stop'],
        text: { ignorePunctuation: true },
      };
      const schema = schemaWith([field({ id: 'q1', type: FieldType.TEXT_INPUT_FIELD, grading })]);
      expect(gradeResponse(schema, baseSettings, { q1: "Don't Stop!" }).score).toBe(5);
    });

    it('normalization order: trim -> collapse -> lowercase -> strip punctuation', () => {
      const grading: FieldGrading = {
        mode: 'text',
        pointValue: 5,
        acceptedAnswers: ['hello world'],
        text: { ignorePunctuation: true },
      };
      const schema = schemaWith([field({ id: 'q1', type: FieldType.TEXT_INPUT_FIELD, grading })]);
      expect(gradeResponse(schema, baseSettings, { q1: '  HELLO,   WORLD!  ' }).score).toBe(5);
    });

    describe('regex mode', () => {
      it('matches an anchored pattern', () => {
        const grading: FieldGrading = {
          mode: 'text',
          pointValue: 5,
          acceptedAnswers: ['\\d{3}-\\d{4}'],
          text: { regex: true },
        };
        const schema = schemaWith([field({ id: 'q1', type: FieldType.TEXT_INPUT_FIELD, grading })]);
        expect(gradeResponse(schema, baseSettings, { q1: '555-1234' }).score).toBe(5);
        expect(gradeResponse(schema, baseSettings, { q1: 'x555-1234x' }).score).toBe(0);
      });

      it('rejects patterns over 200 characters instead of matching', () => {
        const longPattern = 'a'.repeat(201);
        const grading: FieldGrading = {
          mode: 'text',
          pointValue: 5,
          acceptedAnswers: [longPattern],
          text: { regex: true },
        };
        const schema = schemaWith([field({ id: 'q1', type: FieldType.TEXT_INPUT_FIELD, grading })]);
        const result = gradeResponse(schema, baseSettings, { q1: longPattern });
        expect(result.score).toBe(0);
        expect(result.questions[0].correct).toBe(false);
      });

      it('scores zero instead of throwing on an invalid pattern', () => {
        const grading: FieldGrading = {
          mode: 'text',
          pointValue: 5,
          acceptedAnswers: ['[unclosed('],
          text: { regex: true },
        };
        const schema = schemaWith([field({ id: 'q1', type: FieldType.TEXT_INPUT_FIELD, grading })]);
        expect(() => gradeResponse(schema, baseSettings, { q1: 'anything' })).not.toThrow();
        expect(gradeResponse(schema, baseSettings, { q1: 'anything' }).score).toBe(0);
      });

      it('completes promptly against a long input for a catastrophic-backtracking pattern', () => {
        const grading: FieldGrading = {
          mode: 'text',
          pointValue: 5,
          acceptedAnswers: ['(a+)+$'],
          text: { regex: true },
        };
        const schema = schemaWith([field({ id: 'q1', type: FieldType.TEXT_INPUT_FIELD, grading })]);
        const longInput = 'a'.repeat(100_000);

        const start = Date.now();
        const result = gradeResponse(schema, baseSettings, { q1: longInput });
        const elapsedMs = Date.now() - start;

        expect(elapsedMs).toBeLessThan(1000);
        expect(result.score).toBe(5);
      });

      it('never interpolates the submitted value into the compiled pattern', () => {
        const grading: FieldGrading = {
          mode: 'text',
          pointValue: 5,
          acceptedAnswers: ['fixed'],
          text: { regex: true },
        };
        const schema = schemaWith([field({ id: 'q1', type: FieldType.TEXT_INPUT_FIELD, grading })]);
        // A submitted value crafted to look like it could hijack the pattern
        // must be treated as plain test input, never as a regex fragment.
        const result = gradeResponse(schema, baseSettings, { q1: ').*(' });
        expect(result.score).toBe(0);
      });
    });
  });

  describe('numeric mode', () => {
    it('scores zero for NaN submissions', () => {
      const grading: FieldGrading = { mode: 'numeric', pointValue: 5, acceptedAnswers: ['42'] };
      const schema = schemaWith([field({ id: 'q1', type: FieldType.NUMBER_FIELD, grading })]);
      expect(gradeResponse(schema, baseSettings, { q1: 'not-a-number' }).score).toBe(0);
      expect(gradeResponse(schema, baseSettings, { q1: null }).score).toBe(0);
      expect(gradeResponse(schema, baseSettings, { q1: '' }).score).toBe(0);
    });

    it('uses min/max range when present', () => {
      const grading: FieldGrading = {
        mode: 'numeric',
        pointValue: 5,
        acceptedAnswers: [],
        numeric: { min: 10, max: 20 },
      };
      const schema = schemaWith([field({ id: 'q1', type: FieldType.NUMBER_FIELD, grading })]);
      expect(gradeResponse(schema, baseSettings, { q1: 15 }).score).toBe(5);
      expect(gradeResponse(schema, baseSettings, { q1: 25 }).score).toBe(0);
      expect(gradeResponse(schema, baseSettings, { q1: 5 }).score).toBe(0);
    });

    it('uses absolute tolerance when no range is present', () => {
      const grading: FieldGrading = {
        mode: 'numeric',
        pointValue: 5,
        acceptedAnswers: ['100'],
        numeric: { tolerance: 5 },
      };
      const schema = schemaWith([field({ id: 'q1', type: FieldType.NUMBER_FIELD, grading })]);
      expect(gradeResponse(schema, baseSettings, { q1: 104 }).score).toBe(5);
      expect(gradeResponse(schema, baseSettings, { q1: 110 }).score).toBe(0);
    });

    it('uses relative tolerance percent when no range or absolute tolerance is present', () => {
      const grading: FieldGrading = {
        mode: 'numeric',
        pointValue: 5,
        acceptedAnswers: ['200'],
        numeric: { tolerancePercent: 10 },
      };
      const schema = schemaWith([field({ id: 'q1', type: FieldType.NUMBER_FIELD, grading })]);
      expect(gradeResponse(schema, baseSettings, { q1: 215 }).score).toBe(5); // within 20
      expect(gradeResponse(schema, baseSettings, { q1: 230 }).score).toBe(0); // outside 20
    });

    it('falls back to strict equality when no numeric options are present', () => {
      const grading: FieldGrading = { mode: 'numeric', pointValue: 5, acceptedAnswers: ['7'] };
      const schema = schemaWith([field({ id: 'q1', type: FieldType.NUMBER_FIELD, grading })]);
      expect(gradeResponse(schema, baseSettings, { q1: 7 }).score).toBe(5);
      expect(gradeResponse(schema, baseSettings, { q1: 7.01 }).score).toBe(0);
    });
  });

  describe('manual mode', () => {
    it('is unscored, marks correct as null, and forces NEEDS_REVIEW overall', () => {
      const grading: FieldGrading = { mode: 'manual', pointValue: 10, acceptedAnswers: [] };
      const schema = schemaWith([field({ id: 'q1', type: FieldType.TEXT_AREA_FIELD, grading })]);
      const result = gradeResponse(schema, baseSettings, { q1: 'a long essay answer' });

      expect(result.status).toBe('NEEDS_REVIEW');
      expect(result.questions[0].correct).toBeNull();
      expect(result.questions[0].pointsAwarded).toBe(0);
      // still counts toward the denominator
      expect(result.maxScore).toBe(10);
    });

    it('one manual question forces NEEDS_REVIEW even when other questions are auto-graded', () => {
      const gradingAuto: FieldGrading = { mode: 'exact', pointValue: 5, acceptedAnswers: ['A'] };
      const gradingManual: FieldGrading = { mode: 'manual', pointValue: 5, acceptedAnswers: [] };
      const schema = schemaWith([
        field({ id: 'q1', type: FieldType.RADIO_FIELD, grading: gradingAuto }),
        field({ id: 'q2', type: FieldType.TEXT_AREA_FIELD, grading: gradingManual }),
      ]);
      const result = gradeResponse(schema, baseSettings, { q1: 'A', q2: 'essay' });
      expect(result.status).toBe('NEEDS_REVIEW');
      expect(result.score).toBe(5);
      expect(result.maxScore).toBe(10);
    });
  });

  describe('denominator and participation semantics', () => {
    it('excludes a question absent from data (conditionally hidden) from maxScore entirely', () => {
      const grading: FieldGrading = { mode: 'exact', pointValue: 10, acceptedAnswers: ['A'] };
      const schema = schemaWith([
        field({ id: 'q1', type: FieldType.RADIO_FIELD, grading }),
        field({ id: 'q2', type: FieldType.RADIO_FIELD, grading }),
      ]);
      // q2 never appears in data at all (conditionally hidden)
      const result = gradeResponse(schema, baseSettings, { q1: 'A' });

      expect(result.maxScore).toBe(10);
      expect(result.score).toBe(10);
      expect(result.percentage).toBe(100);
      expect(result.questions).toHaveLength(1);
      expect(result.questions.find((q) => q.fieldId === 'q2')).toBeUndefined();
    });

    it('a present-but-empty answer still participates and is scored as wrong', () => {
      const grading: FieldGrading = { mode: 'exact', pointValue: 10, acceptedAnswers: ['A'] };
      const schema = schemaWith([field({ id: 'q1', type: FieldType.RADIO_FIELD, grading })]);
      const result = gradeResponse(schema, baseSettings, { q1: '' });

      expect(result.maxScore).toBe(10);
      expect(result.score).toBe(0);
      expect(result.questions).toHaveLength(1);
      expect(result.questions[0].correct).toBe(false);
    });

    it('pointValue: 0 reports correctness but adds nothing to the denominator', () => {
      const grading: FieldGrading = { mode: 'exact', pointValue: 0, acceptedAnswers: ['A'] };
      const schema = schemaWith([field({ id: 'q1', type: FieldType.RADIO_FIELD, grading })]);
      const result = gradeResponse(schema, baseSettings, { q1: 'A' });

      expect(result.maxScore).toBe(0);
      expect(result.score).toBe(0);
      expect(result.percentage).toBe(0);
      expect(result.questions[0].correct).toBe(true);
      expect(result.questions[0].pointsAwarded).toBe(0);
    });

    it('maxScore of 0 does not divide by zero', () => {
      const schema = schemaWith([]);
      const result = gradeResponse(schema, baseSettings, {});
      expect(result.maxScore).toBe(0);
      expect(result.percentage).toBe(0);
      expect(Number.isNaN(result.percentage)).toBe(false);
      expect(result.passed).toBe(false);
      expect(result.status).toBe('AUTO_GRADED');
    });

    it('skips fields without grading and deleted fields', () => {
      const grading: FieldGrading = { mode: 'exact', pointValue: 10, acceptedAnswers: ['A'] };
      const schema = schemaWith([
        field({ id: 'ungraded', type: FieldType.TEXT_INPUT_FIELD }),
        field({ id: 'deleted', type: FieldType.RADIO_FIELD, grading, deleted: true }),
        field({ id: 'graded', type: FieldType.RADIO_FIELD, grading }),
      ]);
      const result = gradeResponse(schema, baseSettings, {
        ungraded: 'whatever',
        deleted: 'A',
        graded: 'A',
      });
      expect(result.questions).toHaveLength(1);
      expect(result.questions[0].fieldId).toBe('graded');
      expect(result.maxScore).toBe(10);
    });
  });

  describe('pass/fail threshold', () => {
    it('uses settings.passThresholdPercent, defaulting to 60', () => {
      const grading: FieldGrading = { mode: 'exact', pointValue: 10, acceptedAnswers: ['A'] };
      const schema = schemaWith([
        field({ id: 'q1', type: FieldType.RADIO_FIELD, grading }),
        field({ id: 'q2', type: FieldType.RADIO_FIELD, grading }),
      ]);

      // 50% with default 60% threshold -> fail
      const result = gradeResponse(schema, baseSettings, { q1: 'A', q2: 'wrong' });
      expect(result.percentage).toBe(50);
      expect(result.passed).toBe(false);

      // same 50% with a lowered threshold -> pass
      const lenient: QuizSettings = { ...baseSettings, passThresholdPercent: 40 };
      expect(gradeResponse(schema, lenient, { q1: 'A', q2: 'wrong' }).passed).toBe(true);
    });

    it('defaults to 60 when passThresholdPercent is absent', () => {
      const grading: FieldGrading = { mode: 'exact', pointValue: 10, acceptedAnswers: ['A'] };
      const schema = schemaWith([field({ id: 'q1', type: FieldType.RADIO_FIELD, grading })]);
      const settingsWithoutThreshold: QuizSettings = {
        enabled: true,
        gradeRelease: 'immediate',
        respondentVisibility: baseSettings.respondentVisibility,
      };
      const result = gradeResponse(schema, settingsWithoutThreshold, { q1: 'A' });
      expect(result.passed).toBe(true);
    });
  });

  describe('feedback', () => {
    it('picks whenCorrect / whenIncorrect / general based on outcome', () => {
      const grading: FieldGrading = {
        mode: 'exact',
        pointValue: 10,
        acceptedAnswers: ['A'],
        whenCorrect: 'Nice!',
        whenIncorrect: 'Try again',
        general: 'General note',
      };
      const schema = schemaWith([field({ id: 'q1', type: FieldType.RADIO_FIELD, grading })]);
      expect(gradeResponse(schema, baseSettings, { q1: 'A' }).questions[0].feedbackShown).toBe(
        'Nice!'
      );
      expect(gradeResponse(schema, baseSettings, { q1: 'B' }).questions[0].feedbackShown).toBe(
        'Try again'
      );
    });

    it('falls back to general feedback when the specific one is absent', () => {
      const grading: FieldGrading = {
        mode: 'exact',
        pointValue: 10,
        acceptedAnswers: ['A'],
        general: 'General note',
      };
      const schema = schemaWith([field({ id: 'q1', type: FieldType.RADIO_FIELD, grading })]);
      expect(gradeResponse(schema, baseSettings, { q1: 'A' }).questions[0].feedbackShown).toBe(
        'General note'
      );
    });
  });

  describe('multi-question aggregation', () => {
    it('sums score and maxScore across a mix of modes and rounds percentage to 2dp', () => {
      const schema = schemaWith([
        field({
          id: 'q1',
          type: FieldType.RADIO_FIELD,
          grading: { mode: 'exact', pointValue: 3, acceptedAnswers: ['A'] },
        }),
        field({
          id: 'q2',
          type: FieldType.CHECKBOX_FIELD,
          grading: {
            mode: 'set',
            pointValue: 4,
            acceptedAnswers: ['X', 'Y'],
            set: { scoring: 'all' },
          },
        }),
        field({
          id: 'q3',
          type: FieldType.NUMBER_FIELD,
          grading: { mode: 'numeric', pointValue: 3, acceptedAnswers: ['10'] },
        }),
      ]);

      const result = gradeResponse(schema, baseSettings, {
        q1: 'A', // correct: 3
        q2: ['X'], // incorrect: 0
        q3: 10, // correct: 3
      });

      expect(result.score).toBe(6);
      expect(result.maxScore).toBe(10);
      expect(result.percentage).toBe(60);
      expect(result.status).toBe('AUTO_GRADED');
    });
  });
});

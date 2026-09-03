import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FieldType, type QuestionGradeResult, type QuizSettings } from '@dculus/types';
import {
  saveGrade,
  getGradeForResponse,
  getGradesForForm,
  toRespondentView,
  overrideGradeQuestion,
  releaseGrade,
  releaseGrades,
  toGradeRecordPayload,
} from '../gradingService.js';
import { responseGradeRepository, responseRepository, formRepository } from '../../../repositories/index.js';

vi.mock('../../../repositories/index.js');

const baseVisibility = {
  totalScore: true,
  perQuestionCorrectness: true,
  correctAnswers: true,
  pointValues: true,
  feedback: true,
  passFailBadge: true,
};

const allHiddenVisibility = {
  totalScore: false,
  perQuestionCorrectness: false,
  correctAnswers: false,
  pointValues: false,
  feedback: false,
  passFailBadge: false,
};

const baseSettings: QuizSettings = {
  enabled: true,
  passThresholdPercent: 60,
  gradeRelease: 'immediate',
  respondentVisibility: baseVisibility,
};

const question: QuestionGradeResult = {
  fieldId: 'field-1',
  fieldLabel: 'What is 2+2?',
  fieldType: FieldType.NUMBER_FIELD,
  mode: 'numeric',
  submittedValue: 4,
  acceptedAnswers: ['4'],
  correct: true,
  pointsAwarded: 5,
  pointValue: 5,
  autoPointsAwarded: 5,
  feedbackShown: 'Nice work!',
};

const makeGrade = (overrides: Partial<Record<string, any>> = {}) => ({
  id: 'grade-1',
  responseId: 'response-1',
  formId: 'form-1',
  score: 8,
  maxScore: 10,
  percentage: 80,
  passed: true,
  status: 'AUTO_GRADED',
  autoScore: 8,
  gradedAt: new Date('2026-01-01T00:00:00Z'),
  gradedById: null,
  releasedAt: null,
  schemaVersion: 1,
  detail: [question],
  attemptNumber: 1,
  integrity: null,
  ...overrides,
});

describe('gradingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('saveGrade', () => {
    it('resolves formId from the response and upserts through the repository, keyed on responseId', async () => {
      vi.mocked(responseRepository.findUnique).mockResolvedValue({ formId: 'form-1' } as any);
      vi.mocked(responseGradeRepository.upsertForResponse).mockResolvedValue(
        makeGrade() as any
      );

      await saveGrade({
        responseId: 'response-1',
        score: 8,
        maxScore: 10,
        percentage: 80,
        passed: true,
        status: 'AUTO_GRADED',
        autoScore: 8,
        detail: [question],
      });

      expect(responseRepository.findUnique).toHaveBeenCalledWith({
        where: { id: 'response-1' },
        select: { formId: true },
      });
      expect(responseGradeRepository.upsertForResponse).toHaveBeenCalledWith(
        'response-1',
        expect.objectContaining({
          formId: 'form-1',
          score: 8,
          maxScore: 10,
          percentage: 80,
          passed: true,
          status: 'AUTO_GRADED',
          autoScore: 8,
          detail: [question],
          gradedById: null,
          releasedAt: null,
        })
      );
    });

    it('ignores a formId smuggled onto the input — it is never trusted from the caller', async () => {
      vi.mocked(responseRepository.findUnique).mockResolvedValue({ formId: 'form-1' } as any);
      vi.mocked(responseGradeRepository.upsertForResponse).mockResolvedValue(
        makeGrade() as any
      );

      await saveGrade({
        responseId: 'response-1',
        // @ts-expect-error formId is intentionally not part of SaveGradeInput
        formId: 'attacker-controlled-form',
        score: 8,
        maxScore: 10,
        percentage: 80,
        passed: true,
        status: 'AUTO_GRADED',
        autoScore: 8,
        detail: [question],
      });

      expect(responseGradeRepository.upsertForResponse).toHaveBeenCalledWith(
        'response-1',
        expect.objectContaining({ formId: 'form-1' })
      );
    });

    it('throws when the response does not exist', async () => {
      vi.mocked(responseRepository.findUnique).mockResolvedValue(null);

      await expect(
        saveGrade({
          responseId: 'missing-response',
          score: 8,
          maxScore: 10,
          percentage: 80,
          passed: true,
          status: 'AUTO_GRADED',
          autoScore: 8,
          detail: [question],
        })
      ).rejects.toThrow('missing-response');

      expect(responseGradeRepository.upsertForResponse).not.toHaveBeenCalled();
    });

    it('rejects percentage outside 0..100', async () => {
      await expect(
        saveGrade({
          responseId: 'response-1',
          score: 8,
          maxScore: 10,
          percentage: 180,
          passed: true,
          status: 'AUTO_GRADED',
          autoScore: 8,
          detail: [question],
        })
      ).rejects.toThrow();

      expect(responseRepository.findUnique).not.toHaveBeenCalled();
    });

    it('rejects score greater than maxScore', async () => {
      await expect(
        saveGrade({
          responseId: 'response-1',
          score: 12,
          maxScore: 10,
          percentage: 80,
          passed: true,
          status: 'AUTO_GRADED',
          autoScore: 8,
          detail: [question],
        })
      ).rejects.toThrow();

      expect(responseRepository.findUnique).not.toHaveBeenCalled();
    });

    it('rejects autoScore greater than maxScore', async () => {
      await expect(
        saveGrade({
          responseId: 'response-1',
          score: 8,
          maxScore: 10,
          percentage: 80,
          passed: true,
          status: 'AUTO_GRADED',
          autoScore: 12,
          detail: [question],
        })
      ).rejects.toThrow();

      expect(responseRepository.findUnique).not.toHaveBeenCalled();
    });

    it('rejects a malformed detail entry', async () => {
      await expect(
        saveGrade({
          responseId: 'response-1',
          score: 8,
          maxScore: 10,
          percentage: 80,
          passed: true,
          status: 'AUTO_GRADED',
          autoScore: 8,
          detail: [{ fieldId: 'field-1' } as unknown as QuestionGradeResult],
        })
      ).rejects.toThrow();
    });

    it('rejects a submittedValue that is not JSON-safe (e.g. a Map)', async () => {
      await expect(
        saveGrade({
          responseId: 'response-1',
          score: 8,
          maxScore: 10,
          percentage: 80,
          passed: true,
          status: 'AUTO_GRADED',
          autoScore: 8,
          detail: [
            {
              ...question,
              submittedValue: new Map([['answer', 4]]) as unknown,
            },
          ],
        })
      ).rejects.toThrow();
    });

    it('normalizes an absent submittedValue to null rather than persisting undefined', async () => {
      vi.mocked(responseRepository.findUnique).mockResolvedValue({ formId: 'form-1' } as any);
      vi.mocked(responseGradeRepository.upsertForResponse).mockResolvedValue(
        makeGrade() as any
      );

      const { submittedValue, ...questionWithoutAnswer } = question;
      void submittedValue; // intentionally omitted from questionWithoutAnswer below

      await saveGrade({
        responseId: 'response-1',
        score: 0,
        maxScore: 10,
        percentage: 0,
        passed: false,
        status: 'NEEDS_REVIEW',
        autoScore: 0,
        detail: [questionWithoutAnswer as QuestionGradeResult],
      });

      expect(responseGradeRepository.upsertForResponse).toHaveBeenCalledWith(
        'response-1',
        expect.objectContaining({
          detail: [expect.objectContaining({ submittedValue: null })],
        })
      );
    });
  });

  describe('getGradeForResponse / getGradesForForm', () => {
    it('delegates to the repository', async () => {
      const grade = makeGrade();
      vi.mocked(responseGradeRepository.findByResponseId).mockResolvedValue(grade as any);

      const result = await getGradeForResponse('response-1');

      expect(responseGradeRepository.findByResponseId).toHaveBeenCalledWith('response-1');
      expect(result).toEqual(grade);
    });

    it('delegates listing to the repository with opts', async () => {
      vi.mocked(responseGradeRepository.findManyByFormId).mockResolvedValue([]);

      await getGradesForForm('form-1', { status: 'NEEDS_REVIEW' });

      expect(responseGradeRepository.findManyByFormId).toHaveBeenCalledWith('form-1', {
        status: 'NEEDS_REVIEW',
      });
    });
  });

  describe('toRespondentView — the security boundary', () => {
    it('immediate release returns the full view when everything is visible', () => {
      const view = toRespondentView(makeGrade() as any, baseSettings);

      expect(JSON.stringify(view)).toBe(
        JSON.stringify({
          released: true,
          score: 8,
          maxScore: 10,
          percentage: 80,
          passed: true,
          questions: [
            {
              fieldId: 'field-1',
              label: 'What is 2+2?',
              yourAnswer: 4,
              correct: true,
              pointsAwarded: 5,
              pointValue: 5,
              correctAnswer: ['4'],
              feedback: 'Nice work!',
            },
          ],
        })
      );
    });

    it.each<[string, QuizSettings]>([
      ['afterReview, not yet reviewed', { ...baseSettings, gradeRelease: 'afterReview' }],
      [
        'scheduled, releaseAt in the future',
        {
          ...baseSettings,
          gradeRelease: 'scheduled',
          releaseAt: new Date(Date.now() + 60_000).toISOString(),
        },
      ],
      ['never', { ...baseSettings, gradeRelease: 'never' }],
    ])('%s => { released: false } with every other field absent', (_label, settings) => {
      const view = toRespondentView(makeGrade() as any, settings);

      expect(JSON.stringify(view)).toBe(JSON.stringify({ released: false }));
      expect(Object.keys(view)).toEqual(['released']);
    });

    it('scheduled release is exposed once releaseAt has passed', () => {
      const settings: QuizSettings = {
        ...baseSettings,
        gradeRelease: 'scheduled',
        releaseAt: new Date(Date.now() - 60_000).toISOString(),
      };

      const view = toRespondentView(makeGrade() as any, settings);

      expect(view.released).toBe(true);
      expect(view.score).toBe(8);
    });

    it('afterReview is exposed once the grade has been reviewed', () => {
      const settings: QuizSettings = { ...baseSettings, gradeRelease: 'afterReview' };
      const reviewed = makeGrade({ status: 'REVIEWED' });

      const view = toRespondentView(reviewed as any, settings);

      expect(view.released).toBe(true);
      expect(view.score).toBe(8);
    });

    it('released grade with every visibility flag off exposes nothing beyond released:true', () => {
      const settings: QuizSettings = { ...baseSettings, respondentVisibility: allHiddenVisibility };

      const view = toRespondentView(makeGrade() as any, settings);

      expect(JSON.stringify(view)).toBe(JSON.stringify({ released: true }));
      expect(Object.keys(view)).toEqual(['released']);
    });

    describe('each respondentVisibility flag independently omits its own field', () => {
      it('totalScore=false hides score/maxScore/percentage but keeps other visible fields', () => {
        const settings: QuizSettings = {
          ...baseSettings,
          respondentVisibility: { ...baseVisibility, totalScore: false },
        };

        const view = toRespondentView(makeGrade() as any, settings);

        expect(view).not.toHaveProperty('score');
        expect(view).not.toHaveProperty('maxScore');
        expect(view).not.toHaveProperty('percentage');
        expect(view.passed).toBe(true);
        expect(view.questions).toBeDefined();
      });

      it('passFailBadge=false hides passed and message but keeps score', () => {
        const settings: QuizSettings = {
          ...baseSettings,
          respondentVisibility: { ...baseVisibility, passFailBadge: false },
          resultMessagePass: 'You passed!',
        };

        const view = toRespondentView(makeGrade() as any, settings);

        expect(view).not.toHaveProperty('passed');
        expect(view).not.toHaveProperty('message');
        expect(view.score).toBe(8);
      });

      it('perQuestionCorrectness=false hides per-question correct but keeps other question fields', () => {
        const settings: QuizSettings = {
          ...baseSettings,
          respondentVisibility: { ...baseVisibility, perQuestionCorrectness: false },
        };

        const view = toRespondentView(makeGrade() as any, settings);

        expect(view.questions?.[0]).not.toHaveProperty('correct');
        expect(view.questions?.[0]).toHaveProperty('correctAnswer');
        expect(view.questions?.[0]).toHaveProperty('pointsAwarded');
        expect(view.questions?.[0]).toHaveProperty('feedback');
      });

      it('correctAnswers=false hides correctAnswer only', () => {
        const settings: QuizSettings = {
          ...baseSettings,
          respondentVisibility: { ...baseVisibility, correctAnswers: false },
        };

        const view = toRespondentView(makeGrade() as any, settings);

        expect(view.questions?.[0]).not.toHaveProperty('correctAnswer');
        expect(view.questions?.[0]).toHaveProperty('correct');
      });

      it('pointValues=false hides pointsAwarded and pointValue only', () => {
        const settings: QuizSettings = {
          ...baseSettings,
          respondentVisibility: { ...baseVisibility, pointValues: false },
        };

        const view = toRespondentView(makeGrade() as any, settings);

        expect(view.questions?.[0]).not.toHaveProperty('pointsAwarded');
        expect(view.questions?.[0]).not.toHaveProperty('pointValue');
        expect(view.questions?.[0]).toHaveProperty('correct');
      });

      it('feedback=false hides feedback only', () => {
        const settings: QuizSettings = {
          ...baseSettings,
          respondentVisibility: { ...baseVisibility, feedback: false },
        };

        const view = toRespondentView(makeGrade() as any, settings);

        expect(view.questions?.[0]).not.toHaveProperty('feedback');
        expect(view.questions?.[0]).toHaveProperty('correct');
      });

      it('all four question-level flags off omits the questions array entirely', () => {
        const settings: QuizSettings = {
          ...baseSettings,
          respondentVisibility: {
            ...baseVisibility,
            perQuestionCorrectness: false,
            correctAnswers: false,
            pointValues: false,
            feedback: false,
          },
        };

        const view = toRespondentView(makeGrade() as any, settings);

        expect(view).not.toHaveProperty('questions');
      });
    });

    it('a question awaiting manual grading (correct: null) omits correct even when visible', () => {
      const pendingQuestion: QuestionGradeResult = {
        ...question,
        correct: null,
        pointsAwarded: 0,
        autoPointsAwarded: 0,
      };
      const grade = makeGrade({ detail: [pendingQuestion] });

      const view = toRespondentView(grade as any, baseSettings);

      expect(view.questions?.[0]).not.toHaveProperty('correct');
    });
  });

  describe('overrideGradeQuestion', () => {
    const pendingQuestion: QuestionGradeResult = {
      fieldId: 'field-2',
      fieldLabel: 'Explain your reasoning',
      fieldType: FieldType.TEXT_AREA_FIELD,
      mode: 'manual',
      submittedValue: 'because math',
      acceptedAnswers: [],
      correct: null,
      pointsAwarded: 0,
      pointValue: 5,
      autoPointsAwarded: 0,
    };

    it('scores a pending manual question, recomputes score/percentage/passed, and preserves status/releasedAt', async () => {
      const grade = makeGrade({ detail: [question, pendingQuestion], maxScore: 10 });
      vi.mocked(responseGradeRepository.findByResponseId).mockResolvedValue(grade as any);
      vi.mocked(formRepository.findUnique).mockResolvedValue({
        settings: { quiz: { passThresholdPercent: 60 } },
      } as any);
      vi.mocked(responseRepository.findUnique).mockResolvedValue({ formId: 'form-1' } as any);
      vi.mocked(responseGradeRepository.upsertForResponse).mockImplementation(
        (_id, data) => Promise.resolve({ ...grade, ...data } as any)
      );

      const result = await overrideGradeQuestion(
        {
          responseId: 'response-1',
          fieldId: 'field-2',
          correct: true,
          pointsAwarded: 5,
        },
        'grader-1'
      );

      expect(responseGradeRepository.upsertForResponse).toHaveBeenCalledWith(
        'response-1',
        expect.objectContaining({
          score: 10,
          percentage: 100,
          passed: true,
          status: 'AUTO_GRADED', // unchanged — release is a separate action
          releasedAt: null,
          gradedById: 'grader-1',
          detail: [
            question,
            expect.objectContaining({
              fieldId: 'field-2',
              correct: true,
              pointsAwarded: 5,
              overriddenBy: 'grader-1',
            }),
          ],
        })
      );
      expect(result).toBeDefined();
    });

    it('clamps pointsAwarded into [0, pointValue] rather than trusting the caller', async () => {
      const grade = makeGrade({ detail: [pendingQuestion], maxScore: 5, score: 0, autoScore: 0 });
      vi.mocked(responseGradeRepository.findByResponseId).mockResolvedValue(grade as any);
      vi.mocked(formRepository.findUnique).mockResolvedValue({
        settings: { quiz: { passThresholdPercent: 60 } },
      } as any);
      vi.mocked(responseRepository.findUnique).mockResolvedValue({ formId: 'form-1' } as any);
      vi.mocked(responseGradeRepository.upsertForResponse).mockResolvedValue(grade as any);

      await overrideGradeQuestion(
        { responseId: 'response-1', fieldId: 'field-2', correct: true, pointsAwarded: 999 },
        'grader-1'
      );

      expect(responseGradeRepository.upsertForResponse).toHaveBeenCalledWith(
        'response-1',
        expect.objectContaining({
          detail: [expect.objectContaining({ pointsAwarded: 5 })],
        })
      );
    });

    it('throws when the response has no grade row', async () => {
      vi.mocked(responseGradeRepository.findByResponseId).mockResolvedValue(null);

      await expect(
        overrideGradeQuestion(
          { responseId: 'missing', fieldId: 'field-2', correct: true, pointsAwarded: 5 },
          'grader-1'
        )
      ).rejects.toThrow();
    });

    it('throws when fieldId does not match any question on the grade', async () => {
      vi.mocked(responseGradeRepository.findByResponseId).mockResolvedValue(
        makeGrade({ detail: [question] }) as any
      );

      await expect(
        overrideGradeQuestion(
          { responseId: 'response-1', fieldId: 'not-on-response', correct: true, pointsAwarded: 5 },
          'grader-1'
        )
      ).rejects.toThrow();
    });
  });

  describe('releaseGrade', () => {
    it('blocks release while any question is still correct: null', async () => {
      const pending: QuestionGradeResult = { ...question, correct: null, pointsAwarded: 0 };
      vi.mocked(responseGradeRepository.findByResponseId).mockResolvedValue(
        makeGrade({ detail: [question, pending] }) as any
      );

      await expect(releaseGrade('response-1', 'grader-1')).rejects.toThrow(/manual grading/);
      expect(responseGradeRepository.upsertForResponse).not.toHaveBeenCalled();
    });

    it('sets status RELEASED, releasedAt, and gradedById once every question is graded', async () => {
      const grade = makeGrade({ detail: [question], status: 'NEEDS_REVIEW' });
      vi.mocked(responseGradeRepository.findByResponseId).mockResolvedValue(grade as any);
      vi.mocked(responseRepository.findUnique).mockResolvedValue({ formId: 'form-1' } as any);
      vi.mocked(responseGradeRepository.upsertForResponse).mockResolvedValue(grade as any);

      await releaseGrade('response-1', 'grader-1');

      expect(responseGradeRepository.upsertForResponse).toHaveBeenCalledWith(
        'response-1',
        expect.objectContaining({
          status: 'RELEASED',
          gradedById: 'grader-1',
          releasedAt: expect.any(Date),
        })
      );
    });

    it('is idempotent — releasing an already-released grade is a no-op, not an error', async () => {
      const released = makeGrade({ status: 'RELEASED', releasedAt: new Date('2026-01-02T00:00:00Z') });
      vi.mocked(responseGradeRepository.findByResponseId).mockResolvedValue(released as any);

      const result = await releaseGrade('response-1', 'grader-1');

      expect(result).toEqual(released);
      expect(responseGradeRepository.upsertForResponse).not.toHaveBeenCalled();
    });
  });

  describe('releaseGrades (bulk)', () => {
    it('releases eligible grades and skips ones with pending manual questions, scoped to formId', async () => {
      const pending: QuestionGradeResult = { ...question, correct: null, pointsAwarded: 0 };
      const eligible = makeGrade({ responseId: 'r1', detail: [question] });
      const blocked = makeGrade({ responseId: 'r2', detail: [pending] });
      const otherForm = makeGrade({ responseId: 'r3', formId: 'other-form', detail: [question] });

      vi.mocked(responseGradeRepository.findMany).mockResolvedValue([
        eligible,
        blocked,
        otherForm,
      ] as any);
      vi.mocked(responseRepository.findUnique).mockResolvedValue({ formId: 'form-1' } as any);
      vi.mocked(responseGradeRepository.upsertForResponse).mockResolvedValue(eligible as any);

      const result = await releaseGrades('form-1', ['r1', 'r2', 'r3'], 'grader-1');

      expect(result.releasedCount).toBe(1);
      expect(result.skippedCount).toBe(1);
      expect(result.skippedResponseIds).toEqual(['r2']);
      expect(responseGradeRepository.upsertForResponse).toHaveBeenCalledTimes(1);
    });

    it('counts an already-released grade toward releasedCount without re-saving it', async () => {
      const alreadyReleased = makeGrade({ responseId: 'r1', status: 'RELEASED' });
      vi.mocked(responseGradeRepository.findMany).mockResolvedValue([alreadyReleased] as any);

      const result = await releaseGrades('form-1', ['r1'], 'grader-1');

      expect(result.releasedCount).toBe(1);
      expect(result.skippedCount).toBe(0);
      expect(responseGradeRepository.upsertForResponse).not.toHaveBeenCalled();
    });
  });

  describe('toGradeRecordPayload', () => {
    it('projects the full builder-facing shape, including releasedAt', () => {
      const grade = makeGrade({ releasedAt: new Date('2026-01-03T00:00:00Z') });

      const payload = toGradeRecordPayload(grade as any);

      expect(payload).toEqual({
        score: 8,
        maxScore: 10,
        percentage: 80,
        passed: true,
        status: 'AUTO_GRADED',
        gradedAt: '2026-01-01T00:00:00.000Z',
        releasedAt: '2026-01-03T00:00:00.000Z',
        detail: [question],
      });
    });

    it('nulls releasedAt when the grade has not been released', () => {
      const payload = toGradeRecordPayload(makeGrade() as any);
      expect(payload.releasedAt).toBeNull();
    });
  });
});

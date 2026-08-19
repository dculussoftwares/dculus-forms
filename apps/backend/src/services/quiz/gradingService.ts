import { z } from 'zod';
import type { QuestionGradeResult, QuizSettings, RespondentGradeView } from '@dculus/types';
import type { ResponseGrade as ResponseGradeRow, Prisma } from '#prisma-client';
import { responseGradeRepository, responseRepository } from '../../repositories/index.js';

/**
 * Native Quiz persistence (D4, epic #289). Thin orchestration over
 * `responseGradeRepository` — no grading logic lives here (that's the pure
 * engine, Story 02/#291) and nothing here is wired into `submitResponse`
 * (that's Story 06/#295). This file only saves and reads grade rows, and
 * projects a grade into what a respondent is allowed to see.
 */

export type GradeStatus = 'AUTO_GRADED' | 'NEEDS_REVIEW' | 'REVIEWED' | 'RELEASED';

const gradeStatusSchema = z.enum(['AUTO_GRADED', 'NEEDS_REVIEW', 'REVIEWED', 'RELEASED']);

const questionGradeResultSchema = z.object({
  fieldId: z.string().min(1),
  fieldLabel: z.string(),
  fieldType: z.string(),
  mode: z.enum(['exact', 'set', 'text', 'numeric', 'manual']),
  submittedValue: z.unknown(),
  acceptedAnswers: z.array(z.string()),
  correct: z.boolean().nullable(),
  pointsAwarded: z.number(),
  pointValue: z.number(),
  autoPointsAwarded: z.number(),
  overriddenBy: z.string().optional(),
  graderComment: z.string().optional(),
  feedbackShown: z.string().optional(),
});

// `formId` is deliberately NOT accepted here — it is denormalized on
// ResponseGrade for query performance, but has no FK relation protecting it.
// Trusting a caller-supplied formId would let a mismatched value corrupt
// form-level listings and aggregates, so saveGrade always derives it from
// the response the grade belongs to.
const saveGradeInputSchema = z
  .object({
    responseId: z.string().min(1),
    score: z.number().min(0),
    maxScore: z.number().min(0),
    percentage: z.number().min(0).max(100),
    passed: z.boolean(),
    status: gradeStatusSchema,
    autoScore: z.number().min(0),
    detail: z.array(questionGradeResultSchema),
    gradedById: z.string().nullable().optional(),
    releasedAt: z.date().nullable().optional(),
    schemaVersion: z.number().int().positive().optional(),
    attemptNumber: z.number().int().positive().optional(),
    integrity: z.unknown().optional(),
  })
  .refine((data) => data.score <= data.maxScore, {
    message: 'score cannot exceed maxScore',
    path: ['score'],
  })
  .refine((data) => data.autoScore <= data.maxScore, {
    message: 'autoScore cannot exceed maxScore',
    path: ['autoScore'],
  });

export interface SaveGradeInput {
  responseId: string;
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  status: GradeStatus;
  autoScore: number;
  detail: QuestionGradeResult[];
  gradedById?: string | null;
  releasedAt?: Date | null;
  schemaVersion?: number;
  attemptNumber?: number;
  integrity?: unknown;
}

/**
 * Persist (create-or-replace) the grade for a response. `responseId` is
 * unique on the table, so this is always an upsert — a response can never
 * accumulate more than one grade row.
 *
 * `formId` is resolved from the response record rather than trusted from the
 * caller (see `saveGradeInputSchema` above), and the rest of the payload is
 * validated (score/percentage bounds, `detail` shape) before it is written.
 */
export const saveGrade = async (input: SaveGradeInput): Promise<ResponseGradeRow> => {
  const { responseId, ...rest } = saveGradeInputSchema.parse(input);

  const response = await responseRepository.findUnique({
    where: { id: responseId },
    select: { formId: true },
  });
  if (!response) {
    throw new Error(`Cannot save grade: response "${responseId}" was not found`);
  }

  return responseGradeRepository.upsertForResponse(responseId, {
    formId: response.formId,
    score: rest.score,
    maxScore: rest.maxScore,
    percentage: rest.percentage,
    passed: rest.passed,
    status: rest.status,
    autoScore: rest.autoScore,
    detail: rest.detail as unknown as Prisma.InputJsonValue,
    gradedById: rest.gradedById ?? null,
    releasedAt: rest.releasedAt ?? null,
    schemaVersion: rest.schemaVersion,
    attemptNumber: rest.attemptNumber,
    integrity: (rest.integrity ?? undefined) as Prisma.InputJsonValue | undefined,
  });
};

export const getGradeForResponse = async (
  responseId: string
): Promise<ResponseGradeRow | null> => responseGradeRepository.findByResponseId(responseId);

export const getGradesForForm = async (
  formId: string,
  opts?: { status?: GradeStatus }
): Promise<ResponseGradeRow[]> => responseGradeRepository.findManyByFormId(formId, opts);

/**
 * Read `detail` back out as `QuestionGradeResult[]`. Storage is `Json`, so
 * this is a defensive cast rather than a real parse — the shape is only
 * ever written by `saveGrade` above.
 */
const readDetail = (grade: ResponseGradeRow): QuestionGradeResult[] =>
  Array.isArray(grade.detail) ? (grade.detail as unknown as QuestionGradeResult[]) : [];

/**
 * Whether a grade's score is allowed to reach the respondent at all, per
 * `QuizSettings.gradeRelease`. This is evaluated independently of
 * `respondentVisibility` — visibility only narrows what an already-released
 * grade shows.
 */
const isReleased = (grade: ResponseGradeRow, settings: QuizSettings): boolean => {
  switch (settings.gradeRelease) {
    case 'immediate':
      return true;
    case 'afterReview':
      // A human has finalized the grade — AUTO_GRADED/NEEDS_REVIEW are not enough.
      return grade.status === 'REVIEWED' || grade.status === 'RELEASED';
    case 'scheduled':
      return !!settings.releaseAt && Date.now() >= new Date(settings.releaseAt).getTime();
    case 'never':
    default:
      return false;
  }
};

const messageFor = (grade: ResponseGradeRow, settings: QuizSettings): string | undefined =>
  grade.passed ? settings.resultMessagePass : settings.resultMessageFail;

/**
 * Project a persisted grade + the form's quiz policy into exactly what the
 * respondent may see. THIS IS THE SECURITY BOUNDARY (D5-adjacent): when the
 * grade is not released, the return value is `{ released: false }` with every
 * other field genuinely absent from the object (not `undefined`, not zeroed)
 * — callers must not be able to reach a score via any key on this object.
 * Each `respondentVisibility` flag independently controls its own field.
 */
export const toRespondentView = (
  grade: ResponseGradeRow,
  settings: QuizSettings
): RespondentGradeView => {
  if (!isReleased(grade, settings)) {
    return { released: false };
  }

  const visibility = settings.respondentVisibility;
  const message = visibility.passFailBadge ? messageFor(grade, settings) : undefined;

  const showQuestions =
    visibility.perQuestionCorrectness ||
    visibility.correctAnswers ||
    visibility.pointValues ||
    visibility.feedback;

  const questions = showQuestions
    ? readDetail(grade).map((q) => ({
        fieldId: q.fieldId,
        label: q.fieldLabel,
        yourAnswer: q.submittedValue,
        ...(visibility.perQuestionCorrectness && q.correct !== null
          ? { correct: q.correct }
          : {}),
        ...(visibility.pointValues
          ? { pointsAwarded: q.pointsAwarded, pointValue: q.pointValue }
          : {}),
        ...(visibility.correctAnswers ? { correctAnswer: q.acceptedAnswers } : {}),
        ...(visibility.feedback && q.feedbackShown ? { feedback: q.feedbackShown } : {}),
      }))
    : undefined;

  return {
    released: true,
    ...(visibility.totalScore
      ? { score: grade.score, maxScore: grade.maxScore, percentage: grade.percentage }
      : {}),
    ...(visibility.passFailBadge ? { passed: grade.passed } : {}),
    ...(message !== undefined ? { message } : {}),
    ...(questions !== undefined ? { questions } : {}),
  };
};

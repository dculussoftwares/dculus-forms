import type { QuestionGradeResult, QuizSettings, RespondentGradeView } from '@dculus/types';
import type { ResponseGrade as ResponseGradeRow, Prisma } from '#prisma-client';
import { responseGradeRepository } from '../../repositories/index.js';

/**
 * Native Quiz persistence (D4, epic #289). Thin orchestration over
 * `responseGradeRepository` — no grading logic lives here (that's the pure
 * engine, Story 02/#291) and nothing here is wired into `submitResponse`
 * (that's Story 06/#295). This file only saves and reads grade rows, and
 * projects a grade into what a respondent is allowed to see.
 */

export type GradeStatus = 'AUTO_GRADED' | 'NEEDS_REVIEW' | 'REVIEWED' | 'RELEASED';

export interface SaveGradeInput {
  responseId: string;
  formId: string;
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
 */
export const saveGrade = async (input: SaveGradeInput): Promise<ResponseGradeRow> => {
  const { responseId, ...rest } = input;
  return responseGradeRepository.upsertForResponse(responseId, {
    formId: rest.formId,
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

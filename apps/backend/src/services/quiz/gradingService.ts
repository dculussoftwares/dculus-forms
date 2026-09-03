import { z } from 'zod';
import type { QuestionGradeResult, QuizSettings, RespondentGradeView } from '@dculus/types';
import type { ResponseGrade as ResponseGradeRow, Prisma } from '#prisma-client';
import { responseGradeRepository, responseRepository, formRepository } from '../../repositories/index.js';
import { createGraphQLError } from '#graphql-errors';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Native Quiz persistence (D4, epic #289). Thin orchestration over
 * `responseGradeRepository` — no grading logic lives here (that's the pure
 * engine, Story 02/#291) and nothing here is wired into `submitResponse`
 * (that's Story 06/#295). This file only saves and reads grade rows, and
 * projects a grade into what a respondent is allowed to see.
 */

export type GradeStatus = 'AUTO_GRADED' | 'NEEDS_REVIEW' | 'REVIEWED' | 'RELEASED';

const gradeStatusSchema = z.enum(['AUTO_GRADED', 'NEEDS_REVIEW', 'REVIEWED', 'RELEASED']);

// `submittedValue` is `unknown` at the type level (packages/types/src/quiz.ts),
// but it's persisted into a Prisma `Json` column — a Map would silently
// serialize to `{}` and a BigInt would throw, so it's validated as JSON here
// rather than trusted as-is. Missing/`undefined` is normalized to `null`
// (an unanswered question is valid domain data, not a malformed payload).
const jsonSubmittedValueSchema = z.preprocess(
  (value) => (value === undefined ? null : value),
  z.json()
);

export const questionGradeResultSchema = z.object({
  fieldId: z.string().min(1),
  fieldLabel: z.string(),
  fieldType: z.string(),
  mode: z.enum(['exact', 'set', 'text', 'numeric', 'manual']),
  submittedValue: jsonSubmittedValueSchema,
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
    // Same JSON-safety concern as submittedValue above, but integrity is
    // genuinely optional (no value = not tracked), so undefined stays absent
    // rather than being coerced to null.
    integrity: z.json().nullable().optional(),
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
 * Grades for a specific set of responses (e.g. the final, filtered/selected
 * response set an export is about to render) rather than every grade a form
 * has ever accumulated. Empty input short-circuits to avoid an unbounded
 * `IN ()` query.
 */
export const getGradesForResponses = async (
  responseIds: string[]
): Promise<ResponseGradeRow[]> => {
  if (responseIds.length === 0) return [];
  return responseGradeRepository.findMany({ where: { responseId: { in: responseIds } } });
};

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

/**
 * Native Quiz (epic #289, Story 16/#320, D9): resolves a respondent's OWN
 * grade for a form, keeping resolvers thin per the Resolvers → Services →
 * Repositories → Prisma layering (CLAUDE.md) — the `myQuizResult` resolver
 * calls this instead of touching `responseRepository`/`responseGradeRepository`
 * directly. Caller (the resolver) is responsible for confirming the form is
 * a quiz and for auth; this only does the respondent-scoped lookup + the
 * same release/visibility projection every other read path uses.
 *
 * v1 limitation (documented, not a bug): a form that permits resubmission
 * can have more than one Response row for this respondent — only the most
 * recent by `submittedAt` is considered.
 */
export const getMyQuizResult = async (
  formId: string,
  respondentUserId: string,
  quizSettings: QuizSettings
): Promise<RespondentGradeView | null> => {
  const response = await responseRepository.findFirst({
    where: { formId, respondentUserId, deletedAt: null },
    orderBy: { submittedAt: 'desc' },
  });
  if (!response) return null;

  const gradeRow = await responseGradeRepository.findByResponseId(response.id);
  if (!gradeRow) return null;

  return toRespondentView(gradeRow, quizSettings);
};

/**
 * Builder-facing projection of a grade row — the full, unfiltered detail
 * (unlike `toRespondentView`, this ignores `gradeRelease`/`respondentVisibility`
 * entirely; callers are responsible for the EDITOR+ access check). Shared by
 * the `responseGrade` field resolver and the override/release mutations below
 * so the shape is defined exactly once.
 */
export interface GradeRecordPayload {
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  status: GradeStatus;
  gradedAt: string;
  releasedAt: string | null;
  detail: QuestionGradeResult[];
}

export const toGradeRecordPayload = (grade: ResponseGradeRow): GradeRecordPayload => ({
  score: grade.score,
  maxScore: grade.maxScore,
  percentage: grade.percentage,
  passed: grade.passed,
  status: grade.status as GradeStatus,
  gradedAt: grade.gradedAt.toISOString(),
  releasedAt: grade.releasedAt ? grade.releasedAt.toISOString() : null,
  detail: readDetail(grade),
});

const overrideGradeQuestionInputSchema = z.object({
  responseId: z.string().min(1),
  fieldId: z.string().min(1),
  correct: z.boolean(),
  pointsAwarded: z.number(),
  graderComment: z.string().nullish().transform((v) => v ?? undefined),
});

export interface OverrideGradeQuestionInput {
  responseId: string;
  fieldId: string;
  correct: boolean;
  pointsAwarded: number;
  graderComment?: string;
}

/**
 * Manually grade (or re-grade) one question on a response — works on any
 * question, not just `mode: 'manual'` ones, so an owner can also adjust an
 * auto-graded score (e.g. partial credit for a near-miss text answer).
 * Recomputes the grade row's score/percentage/passed from the full detail[]
 * array; leaves `status`/`releasedAt` untouched (release is a separate,
 * explicit action — see `releaseGrade` below).
 */
export const overrideGradeQuestion = async (
  input: OverrideGradeQuestionInput,
  graderId: string
): Promise<ResponseGradeRow> => {
  const { responseId, fieldId, correct, pointsAwarded, graderComment } =
    overrideGradeQuestionInputSchema.parse(input);

  const grade = await responseGradeRepository.findByResponseId(responseId);
  if (!grade) {
    throw createGraphQLError('Grade not found for this response', GRAPHQL_ERROR_CODES.RESPONSE_NOT_FOUND);
  }

  const detail = readDetail(grade);
  const index = detail.findIndex((q) => q.fieldId === fieldId);
  if (index === -1) {
    throw createGraphQLError('Question not found on this response\'s grade', GRAPHQL_ERROR_CODES.NOT_FOUND);
  }

  const question = detail[index];
  const clampedPoints = round2(Math.min(Math.max(pointsAwarded, 0), question.pointValue));

  const nextDetail = [...detail];
  nextDetail[index] = {
    ...question,
    correct,
    pointsAwarded: clampedPoints,
    overriddenBy: graderId,
    ...(graderComment !== undefined ? { graderComment } : {}),
  };

  const score = round2(nextDetail.reduce((sum, q) => sum + q.pointsAwarded, 0));
  const maxScore = grade.maxScore;
  const percentage = maxScore > 0 ? round2((score / maxScore) * 100) : 0;

  const formRow = await formRepository.findUnique({
    where: { id: grade.formId },
    select: { settings: true },
  });
  const passThresholdPercent =
    (formRow?.settings as { quiz?: { passThresholdPercent?: number } } | null)?.quiz
      ?.passThresholdPercent ?? 60;

  return saveGrade({
    responseId,
    score,
    maxScore,
    percentage,
    passed: percentage >= passThresholdPercent,
    status: grade.status as GradeStatus,
    autoScore: grade.autoScore,
    detail: nextDetail,
    gradedById: graderId,
    releasedAt: grade.releasedAt,
    schemaVersion: grade.schemaVersion,
    attemptNumber: grade.attemptNumber,
    integrity: grade.integrity,
  });
};

/**
 * Releases one response's grade to its respondent — the missing half of the
 * `gradeRelease: 'afterReview'` policy (`isReleased` above already treats
 * `RELEASED` as visible; nothing previously ever wrote that status). Blocks
 * while any question is still `correct: null` (unscored manual grading) so a
 * respondent can never see a score that was never actually finished.
 * Idempotent: releasing an already-released grade is a no-op, not an error.
 */
export const releaseGrade = async (
  responseId: string,
  actorId: string
): Promise<ResponseGradeRow> => {
  const grade = await responseGradeRepository.findByResponseId(responseId);
  if (!grade) {
    throw createGraphQLError('Grade not found for this response', GRAPHQL_ERROR_CODES.RESPONSE_NOT_FOUND);
  }

  if (grade.status === 'RELEASED') return grade;

  const pendingCount = readDetail(grade).filter((q) => q.correct === null).length;
  if (pendingCount > 0) {
    throw createGraphQLError(
      `${pendingCount} question${pendingCount === 1 ? '' : 's'} still need${pendingCount === 1 ? 's' : ''} manual grading before this response can be released`,
      GRAPHQL_ERROR_CODES.BAD_USER_INPUT
    );
  }

  return saveGrade({
    responseId,
    score: grade.score,
    maxScore: grade.maxScore,
    percentage: grade.percentage,
    passed: grade.passed,
    status: 'RELEASED',
    autoScore: grade.autoScore,
    detail: readDetail(grade),
    gradedById: actorId,
    releasedAt: new Date(),
    schemaVersion: grade.schemaVersion,
    attemptNumber: grade.attemptNumber,
    integrity: grade.integrity,
  });
};

export interface ReleaseGradesResult {
  releasedCount: number;
  skippedCount: number;
  skippedResponseIds: string[];
}

/**
 * Bulk counterpart to `releaseGrade` — releases every eligible grade among
 * `ids` (scoped defensively to `formId`, same non-trust posture as
 * `saveGrade`'s formId handling) and reports how many were skipped for still
 * having ungraded manual questions, so the caller can surface an honest
 * count rather than silently under-releasing.
 */
export const releaseGrades = async (
  formId: string,
  ids: string[],
  actorId: string
): Promise<ReleaseGradesResult> => {
  const rows = (await getGradesForResponses(ids)).filter((g) => g.formId === formId);

  const toRelease: ResponseGradeRow[] = [];
  const skippedResponseIds: string[] = [];
  let alreadyReleased = 0;

  for (const grade of rows) {
    if (grade.status === 'RELEASED') {
      alreadyReleased += 1;
      continue;
    }
    const hasPending = readDetail(grade).some((q) => q.correct === null);
    if (hasPending) {
      skippedResponseIds.push(grade.responseId);
    } else {
      toRelease.push(grade);
    }
  }

  await Promise.all(
    toRelease.map((grade) =>
      saveGrade({
        responseId: grade.responseId,
        score: grade.score,
        maxScore: grade.maxScore,
        percentage: grade.percentage,
        passed: grade.passed,
        status: 'RELEASED',
        autoScore: grade.autoScore,
        detail: readDetail(grade),
        gradedById: actorId,
        releasedAt: new Date(),
        schemaVersion: grade.schemaVersion,
        attemptNumber: grade.attemptNumber,
        integrity: grade.integrity,
      })
    )
  );

  return {
    releasedCount: toRelease.length + alreadyReleased,
    skippedCount: skippedResponseIds.length,
    skippedResponseIds,
  };
};

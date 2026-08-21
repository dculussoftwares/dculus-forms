/**
 * Native Quiz — v1 data model (types + sanitizers only).
 *
 * `grading` lives on the field (sibling to `validation`), plain JSON (no
 * classes), flowing through `serializeFormField` / `deserializeFormField` /
 * Y.js untouched. `QuizSettings` lives on `FormSettings.quiz` and carries
 * release/visibility policy. See docs/native-quiz-strategy.md and GitHub
 * issue #289 (epic) for the full rationale — this file implements the
 * "Data model" section verbatim.
 */

import { z } from 'zod';
import type { FieldType } from './index.js';

export type GradingMode = 'exact' | 'set' | 'text' | 'numeric' | 'manual';

export interface TextMatchOptions {
  caseSensitive?: boolean; // default false
  trimWhitespace?: boolean; // default true
  collapseWhitespace?: boolean; // default true
  ignorePunctuation?: boolean; // default false
  regex?: boolean; // anchored, length-capped — see Story 02
}

export interface NumericMatchOptions {
  tolerance?: number;
  tolerancePercent?: number;
  min?: number;
  max?: number;
}

export interface SetMatchOptions {
  scoring: 'all' | 'partial' | 'any';
  wrongSelectionPenalty?: number; // 0..1, default 1
}

export interface OptionFeedback {
  option: string;
  feedback: string;
}

export interface FieldGrading {
  mode: GradingMode;
  pointValue: number; // 0 is legal (ungraded but keyed)
  acceptedAnswers: string[];
  text?: TextMatchOptions;
  numeric?: NumericMatchOptions;
  set?: SetMatchOptions;
  whenCorrect?: string;
  whenIncorrect?: string;
  general?: string;
  optionFeedback?: OptionFeedback[];
  shuffleOptions?: boolean; // reserved for a later phase
}

export type GradeRelease = 'immediate' | 'afterReview' | 'scheduled' | 'never';

export interface QuizRespondentVisibility {
  totalScore: boolean;
  perQuestionCorrectness: boolean;
  correctAnswers: boolean;
  pointValues: boolean;
  feedback: boolean;
  passFailBadge: boolean;
}

export interface QuizSettings {
  enabled: boolean;
  passThresholdPercent?: number; // default 60
  gradeRelease: GradeRelease;
  releaseAt?: string; // ISO 8601, when gradeRelease === 'scheduled'
  respondentVisibility: QuizRespondentVisibility;
  resultMessagePass?: string;
  resultMessageFail?: string;
}

export interface QuestionGradeResult {
  fieldId: string;
  fieldLabel: string;
  fieldType: FieldType;
  mode: GradingMode;
  submittedValue: unknown;
  acceptedAnswers: string[];
  correct: boolean | null; // null = awaiting manual grading
  pointsAwarded: number;
  pointValue: number;
  autoPointsAwarded: number;
  overriddenBy?: string;
  graderComment?: string;
  feedbackShown?: string;
}

export interface RespondentGradeView {
  released: boolean; // false => every field below is absent
  score?: number;
  maxScore?: number;
  percentage?: number;
  passed?: boolean;
  message?: string;
  questions?: Array<{
    fieldId: string;
    label: string;
    correct?: boolean;
    pointsAwarded?: number;
    pointValue?: number;
    yourAnswer?: unknown;
    correctAnswer?: string[];
    feedback?: string;
  }>;
}

// Field type -> default grading mode (Stories 02 and 08 share this table
// rather than each inventing their own copy).
//
// Keys are the raw FieldType string values (not `[FieldType.X]` computed
// properties): `index.ts` and `quiz.ts` import each other (same cycle as
// `conditions.ts`), and index.ts imports quiz.ts before its own `FieldType`
// enum initializer has run. A computed-property access at module-eval time
// would read `FieldType` while it's still undefined; a literal object key
// only needs the *type* FieldType, resolved by the cast below.
export const FIELD_TYPE_DEFAULT_GRADING_MODE = {
  radio_field: 'exact',
  select_field: 'exact', // multi-select callers should use 'set' explicitly
  checkbox_field: 'set',
  text_input_field: 'text',
  text_area_field: 'manual',
  number_field: 'numeric',
  date_field: 'exact',
  email_field: 'text',
  phone_number_field: 'text',
  file_upload_field: 'manual',
} as Partial<Record<FieldType, GradingMode>>;

export const isGradableFieldType = (type: FieldType): boolean =>
  type in FIELD_TYPE_DEFAULT_GRADING_MODE;

export const DEFAULT_QUIZ_SETTINGS: QuizSettings = {
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

// Runtime (Zod) schemas for the persisted shapes. Used to sanitize grading
// data at trust boundaries — Y.js deserialization and deserializeFormSchema
// — so downstream code only ever sees valid, well-formed grading/quiz data.

const textMatchOptionsSchema = z.object({
  caseSensitive: z.boolean().optional(),
  trimWhitespace: z.boolean().optional(),
  collapseWhitespace: z.boolean().optional(),
  ignorePunctuation: z.boolean().optional(),
  regex: z.boolean().optional(),
});

const numericMatchOptionsSchema = z.object({
  tolerance: z.number().optional(),
  tolerancePercent: z.number().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
});

const setMatchOptionsSchema = z.object({
  scoring: z.enum(['all', 'partial', 'any']),
  wrongSelectionPenalty: z.number().min(0).max(1).optional(),
});

const optionFeedbackSchema = z.object({
  option: z.string(),
  feedback: z.string(),
});

export const fieldGradingSchema = z.object({
  mode: z.enum(['exact', 'set', 'text', 'numeric', 'manual']),
  pointValue: z.number(),
  acceptedAnswers: z.array(z.string()),
  text: textMatchOptionsSchema.optional(),
  numeric: numericMatchOptionsSchema.optional(),
  set: setMatchOptionsSchema.optional(),
  whenCorrect: z.string().optional(),
  whenIncorrect: z.string().optional(),
  general: z.string().optional(),
  optionFeedback: z.array(optionFeedbackSchema).optional(),
  shuffleOptions: z.boolean().optional(),
});

const quizRespondentVisibilitySchema = z.object({
  totalScore: z.boolean(),
  perQuestionCorrectness: z.boolean(),
  correctAnswers: z.boolean(),
  pointValues: z.boolean(),
  feedback: z.boolean(),
  passFailBadge: z.boolean(),
});

export const quizSettingsSchema = z
  .object({
    enabled: z.boolean(),
    // `.nullish()` (not `.optional()`) because these round-trip through a
    // GraphQL nullable scalar: a field never set on this form resolves to
    // `null` (not an absent key) once read back from a query, and plain
    // `.optional()` rejects `null` — every save after the first would
    // otherwise fail this validation for any quiz form that never set
    // these fields. Transformed to `undefined` to match the QuizSettings
    // TS type (`?:`, no `| null`).
    passThresholdPercent: z.number().min(0).max(100).nullish().transform(v => v ?? undefined),
    gradeRelease: z.enum(['immediate', 'afterReview', 'scheduled', 'never']),
    releaseAt: z.iso.datetime({ offset: true }).nullish().transform(v => v ?? undefined),
    respondentVisibility: quizRespondentVisibilitySchema,
    resultMessagePass: z.string().nullish().transform(v => v ?? undefined),
    resultMessageFail: z.string().nullish().transform(v => v ?? undefined),
  })
  // "scheduled" release without a timestamp is meaningless — never let it
  // silently drop into "release whenever nobody looks" behavior downstream.
  .refine(
    (settings) => settings.gradeRelease !== 'scheduled' || !!settings.releaseAt,
    { message: 'releaseAt is required when gradeRelease is "scheduled"', path: ['releaseAt'] }
  );

/**
 * Validates untrusted persisted data into a clean FieldGrading. Invalid
 * grading is dropped (not thrown) — collab races and hand-edited JSON must
 * never take the whole field down. Returns undefined when the input doesn't
 * parse, preserving "absent = not a quiz field".
 */
export const sanitizeFieldGrading = (
  input: unknown
): FieldGrading | undefined => {
  const parsed = fieldGradingSchema.safeParse(input);
  return parsed.success ? (parsed.data as FieldGrading) : undefined;
};

/**
 * Validates untrusted persisted data into a clean QuizSettings. Invalid
 * settings are dropped (not thrown), returning undefined so "absent = not a
 * quiz" is preserved.
 */
export const sanitizeQuizSettings = (
  input: unknown
): QuizSettings | undefined => {
  const parsed = quizSettingsSchema.safeParse(input);
  return parsed.success ? (parsed.data as QuizSettings) : undefined;
};

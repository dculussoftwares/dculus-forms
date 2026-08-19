/**
 * Native Quiz — pure grading engine (Story 02, GitHub issue #291).
 *
 * Zero I/O and zero service imports — only @dculus/types. This keeps the
 * engine trivially unit-testable and reusable by submitResponse (Story 06),
 * a future regrade job, and preview.
 */
import type {
  FieldGrading,
  FillableFormField,
  FormField,
  FormSchema,
  GradingMode,
  QuestionGradeResult,
  QuizSettings,
} from '@dculus/types';
import safeRegex from 'safe-regex';

export interface GradeResult {
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  status: 'AUTO_GRADED' | 'NEEDS_REVIEW';
  questions: QuestionGradeResult[];
}

const MAX_REGEX_PATTERN_LENGTH = 200;
// Defense-in-depth backstop: safe-regex's star-height heuristic has known
// false negatives, so also cap the string it runs against — bounds the
// worst case even for a pattern that slips past the heuristic.
const MAX_REGEX_INPUT_LENGTH = 500;

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

type GradableField = FillableFormField & { grading: FieldGrading };

const isGradableField = (field: FormField): field is GradableField => {
  if (field.deleted) return false;
  const grading = (field as Partial<FillableFormField>).grading;
  return !!grading && typeof grading === 'object';
};

/** Trim/coerce a submitted value to a comparable string; null/undefined -> ''. */
const toComparableString = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

/** Normalizes an array-or-scalar submitted value into a deduplicated string set. */
const toStringSet = (value: unknown): Set<string> => {
  const raw = Array.isArray(value) ? value : value === null || value === undefined ? [] : [value];
  const out = new Set<string>();
  for (const item of raw) {
    const s = String(item).trim();
    if (s.length > 0) out.add(s);
  }
  return out;
};

const normalizeText = (
  value: unknown,
  opts: NonNullable<FieldGrading['text']>
): string => {
  let s = value === null || value === undefined ? '' : String(value);
  if (opts.trimWhitespace !== false) s = s.trim();
  if (opts.collapseWhitespace !== false) s = s.replace(/\s+/g, ' ');
  if (!opts.caseSensitive) s = s.toLowerCase();
  if (opts.ignorePunctuation) s = s.replace(/[^\p{L}\p{N}\s]/gu, '');
  return s;
};

interface ModeOutcome {
  correct: boolean | null;
  points: number;
}

const gradeExact = (grading: FieldGrading, value: unknown): ModeOutcome => {
  const target = toComparableString(grading.acceptedAnswers[0]);
  const submitted = toComparableString(value);
  const correct = submitted.length > 0 && submitted === target;
  return { correct, points: correct ? grading.pointValue : 0 };
};

const gradeSet = (grading: FieldGrading, value: unknown): ModeOutcome => {
  const key = toStringSet(grading.acceptedAnswers);
  const picked = toStringSet(value);
  const scoring = grading.set?.scoring ?? 'all';
  const penalty = grading.set?.wrongSelectionPenalty ?? 1;

  const intersectionSize = [...picked].filter((v) => key.has(v)).length;
  const wrongSize = [...picked].filter((v) => !key.has(v)).length;

  if (scoring === 'all') {
    const correct = key.size === picked.size && intersectionSize === key.size;
    return { correct, points: correct ? grading.pointValue : 0 };
  }

  if (scoring === 'any') {
    const correct = intersectionSize >= 1;
    return { correct, points: correct ? grading.pointValue : 0 };
  }

  // partial
  if (key.size === 0) return { correct: false, points: 0 };
  const raw = (intersectionSize - penalty * wrongSize) / key.size;
  const points = round2(grading.pointValue * Math.max(0, raw));
  const correct = key.size === picked.size && intersectionSize === key.size;
  return { correct, points };
};

const gradeText = (grading: FieldGrading, value: unknown): ModeOutcome => {
  const opts = grading.text ?? {};

  if (opts.regex) {
    const normalized = normalizeText(value, { ...opts, caseSensitive: true, ignorePunctuation: false });
    const submitted = normalized.slice(0, MAX_REGEX_INPUT_LENGTH);
    const flags = opts.caseSensitive ? '' : 'i';
    const matched = grading.acceptedAnswers.some((pattern) => {
      if (typeof pattern !== 'string' || pattern.length === 0 || pattern.length > MAX_REGEX_PATTERN_LENGTH) {
        return false;
      }
      // safe-regex rejects catastrophic-backtracking shapes (nested/ambiguous
      // quantifiers, e.g. `(a+)+$`) by limiting star height — the anchoring
      // and length cap above don't bound that on their own.
      if (!safeRegex(pattern)) return false;
      try {
        const anchored = new RegExp(`^(?:${pattern})$`, flags);
        return anchored.test(submitted);
      } catch {
        return false;
      }
    });
    return { correct: matched, points: matched ? grading.pointValue : 0 };
  }

  const submitted = normalizeText(value, opts);
  const matched =
    submitted.length > 0 &&
    grading.acceptedAnswers.some((answer) => normalizeText(answer, opts) === submitted);
  return { correct: matched, points: matched ? grading.pointValue : 0 };
};

const gradeNumeric = (grading: FieldGrading, value: unknown): ModeOutcome => {
  const submitted = Number(value);
  if (value === null || value === undefined || value === '' || Number.isNaN(submitted)) {
    return { correct: false, points: 0 };
  }

  const opts = grading.numeric;
  let correct: boolean;

  if (opts && (opts.min !== undefined || opts.max !== undefined)) {
    correct =
      (opts.min === undefined || submitted >= opts.min) &&
      (opts.max === undefined || submitted <= opts.max);
  } else {
    const target = Number(grading.acceptedAnswers[0]);
    if (opts?.tolerance !== undefined) {
      correct = !Number.isNaN(target) && Math.abs(submitted - target) <= opts.tolerance;
    } else if (opts?.tolerancePercent !== undefined) {
      const allowed = Math.abs(target) * (opts.tolerancePercent / 100);
      correct = !Number.isNaN(target) && Math.abs(submitted - target) <= allowed;
    } else {
      correct = !Number.isNaN(target) && submitted === target;
    }
  }

  return { correct, points: correct ? grading.pointValue : 0 };
};

const gradeManual = (): ModeOutcome => ({ correct: null, points: 0 });

const gradeByMode = (mode: GradingMode, grading: FieldGrading, value: unknown): ModeOutcome => {
  switch (mode) {
    case 'exact':
      return gradeExact(grading, value);
    case 'set':
      return gradeSet(grading, value);
    case 'text':
      return gradeText(grading, value);
    case 'numeric':
      return gradeNumeric(grading, value);
    case 'manual':
      return gradeManual();
    default:
      return { correct: false, points: 0 };
  }
};

const feedbackFor = (grading: FieldGrading, correct: boolean | null): string | undefined => {
  if (correct === true) return grading.whenCorrect ?? grading.general;
  if (correct === false) return grading.whenIncorrect ?? grading.general;
  return grading.general;
};

/**
 * Grades a submitted response against a form's answer keys. Pure and
 * side-effect free: same inputs always produce the same GradeResult.
 *
 * `data` must already be conditionally-stripped by the caller (see
 * stripConditionallyHiddenValues in the submit path) — a fieldId absent from
 * `data` is treated as "the respondent never saw this question" and is
 * excluded from both scoring and the denominator, never marked wrong.
 */
export function gradeResponse(
  schema: FormSchema,
  settings: QuizSettings,
  data: Record<string, unknown>
): GradeResult {
  const questions: QuestionGradeResult[] = [];
  let score = 0;
  let maxScore = 0;
  let needsReview = false;

  for (const page of schema.pages) {
    for (const field of page.fields) {
      if (!isGradableField(field)) continue;
      if (!Object.prototype.hasOwnProperty.call(data, field.id)) continue;

      const grading = field.grading;
      const value = data[field.id];
      const { correct, points } = gradeByMode(grading.mode, grading, value);
      const pointsAwarded = round2(points);

      score += pointsAwarded;
      maxScore += grading.pointValue;
      if (correct === null) needsReview = true;

      questions.push({
        fieldId: field.id,
        fieldLabel: field.label,
        fieldType: field.type,
        mode: grading.mode,
        submittedValue: value,
        acceptedAnswers: grading.acceptedAnswers,
        correct,
        pointsAwarded,
        pointValue: grading.pointValue,
        autoPointsAwarded: pointsAwarded,
        feedbackShown: feedbackFor(grading, correct),
      });
    }
  }

  const percentage = maxScore > 0 ? round2((score / maxScore) * 100) : 0;
  const passThreshold = settings.passThresholdPercent ?? 60;

  return {
    score: round2(score),
    maxScore,
    percentage,
    passed: percentage >= passThreshold,
    status: needsReview ? 'NEEDS_REVIEW' : 'AUTO_GRADED',
    questions,
  };
}

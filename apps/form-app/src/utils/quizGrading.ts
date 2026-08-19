import {
  FieldGrading,
  FieldType,
  FillableFormField,
  FormField,
  FormPage,
  isGradableFieldType,
} from '@dculus/types';

/**
 * Whether a saved `FieldGrading` actually has an answer to grade against — as
 * opposed to being present but empty (e.g. quiz mode was turned on for a text
 * field but no accepted answer was ever typed). Manual mode has no automatic
 * key by design, so it's never "unkeyed" — there's nothing to warn about.
 */
export const hasAnswerKey = (grading?: FieldGrading): boolean => {
  if (!grading) return false;
  switch (grading.mode) {
    case 'exact':
    case 'set':
    case 'text':
      return grading.acceptedAnswers.some((answer) => answer.trim().length > 0);
    case 'numeric':
      return (
        grading.acceptedAnswers.some((answer) => answer.trim().length > 0) ||
        grading.numeric?.min !== undefined ||
        grading.numeric?.max !== undefined
      );
    case 'manual':
      return true;
    default:
      return false;
  }
};

export interface QuizFieldSummary {
  field: FillableFormField;
  isKeyed: boolean;
}

export interface QuizSummary {
  totalPoints: number;
  questionCount: number;
  unkeyedCount: number;
  gradableFields: QuizFieldSummary[];
}

/** Walks every page's fields once to build the builder's quiz summary strip
 * (total points / graded question count / unkeyed count) and to answer
 * per-field "is this gradable and keyed?" questions on the field cards. */
export const computeQuizSummary = (pages: FormPage[]): QuizSummary => {
  const gradableFields: QuizFieldSummary[] = [];
  let totalPoints = 0;
  let unkeyedCount = 0;

  for (const page of pages) {
    for (const field of page.fields as FormField[]) {
      if (field.deleted) continue;
      if (!isGradableFieldType(field.type as FieldType)) continue;

      const fillable = field as FillableFormField;
      const keyed = hasAnswerKey(fillable.grading);
      gradableFields.push({ field: fillable, isKeyed: keyed });

      if (keyed) {
        totalPoints += fillable.grading?.pointValue ?? 0;
      } else {
        unkeyedCount += 1;
      }
    }
  }

  return {
    totalPoints,
    questionCount: gradableFields.length,
    unkeyedCount,
    gradableFields,
  };
};

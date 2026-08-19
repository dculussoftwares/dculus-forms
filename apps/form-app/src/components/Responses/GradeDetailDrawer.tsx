/**
 * Grade Detail Drawer
 *
 * Native Quiz (epic #289, Story 11): per-response grade breakdown — score,
 * pass/fail, and a per-question comparison of the respondent's answer against
 * the answer key. Adapted from apps/form-app/src/plugins/quiz/ResultsDialog.tsx
 * into a native component; does not import from the plugin directory, which
 * Story 14 (#303) deprecates.
 */

import React from 'react';
import { useQuery } from '@apollo/client/react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Badge,
  LoadingSpinner,
} from '@dculus/ui';
import { cn, formatFieldValue } from '@dculus/utils';
import { FieldType } from '@dculus/types';
import { CheckCircle2, XCircle, HelpCircle, Award, TrendingUp } from 'lucide-react';
import { GET_RESPONSE_GRADE_DETAIL } from '../../graphql/queries';

interface QuestionGradeDetail {
  fieldId: string;
  fieldLabel: string;
  fieldType: string;
  mode: string;
  submittedValue: unknown;
  acceptedAnswers: string[];
  correct: boolean | null;
  pointsAwarded: number;
  pointValue: number;
  autoPointsAwarded: number;
  overriddenBy?: string | null;
  graderComment?: string | null;
  feedbackShown?: string | null;
}

interface ResponseGradeRecord {
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  status: string;
  gradedAt: string;
  detail: QuestionGradeDetail[];
}

interface GradeDetailDrawerProps {
  responseId: string | null;
  open: boolean;
  onClose: () => void;
  t: (
    key: string,
    options?: { values?: Record<string, string | number>; defaultValue?: string }
  ) => string;
}

const formatAnswer = (value: unknown, fieldType: string, noAnswerLabel: string): string => {
  if (value === null || value === undefined || value === '') return noAnswerLabel;
  const formatted = formatFieldValue(value, fieldType as FieldType);
  return formatted || noAnswerLabel;
};

export const GradeDetailDrawer: React.FC<GradeDetailDrawerProps> = ({
  responseId,
  open,
  onClose,
  t,
}) => {
  const { data, loading, error } = useQuery(GET_RESPONSE_GRADE_DETAIL, {
    variables: { id: responseId },
    skip: !responseId || !open,
  });

  const grade: ResponseGradeRecord | undefined = data?.response?.responseGrade;
  const needsReview = grade?.status === 'NEEDS_REVIEW';
  const passed = !!grade?.passed && !needsReview;
  const totalQuestions = grade?.detail.length ?? 0;
  const correctCount = grade?.detail.filter((q) => q.correct === true).length ?? 0;

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'p-2 rounded-lg',
                needsReview ? 'bg-amber-100' : passed ? 'bg-green-100' : 'bg-[var(--tf-error-bg)]'
              )}
            >
              <Award
                className={cn(
                  'h-6 w-6',
                  needsReview ? 'text-amber-600' : passed ? 'text-green-600' : 'text-destructive'
                )}
              />
            </div>
            <div>
              <SheetTitle>{t('gradeDrawer.title')}</SheetTitle>
              {grade && (
                <p className="text-sm text-muted-foreground">
                  {t('gradeDrawer.graded')} {new Date(grade.gradedAt).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6 mt-4">
          {loading && (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          )}

          {!loading && error && (
            <p className="text-sm text-destructive">{t('gradeDrawer.error')}</p>
          )}

          {!loading && !error && grade && (
            <>
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-6 border border-[var(--tf-border-medium)]">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-5 w-5 text-foreground" />
                    <h3 className="font-semibold text-primary">{t('gradeDrawer.overallScore')}</h3>
                  </div>
                  <Badge
                    variant={needsReview ? 'outline' : passed ? 'default' : 'destructive'}
                    className="text-sm px-3 py-1"
                  >
                    {needsReview
                      ? t('gradeDrawer.status.needsReview')
                      : passed
                        ? t('gradeDrawer.status.passed')
                        : t('gradeDrawer.status.failed')}
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {grade.score}/{grade.maxScore}
                    </div>
                    <div className="text-xs text-foreground mt-1">{t('gradeDrawer.pointsEarned')}</div>
                  </div>
                  <div className="text-center border-x border-[var(--tf-border-strong)]">
                    <div className="text-2xl font-bold text-primary">{grade.percentage.toFixed(1)}%</div>
                    <div className="text-xs text-foreground mt-1">{t('gradeDrawer.percentage')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {correctCount}/{totalQuestions}
                    </div>
                    <div className="text-xs text-foreground mt-1">{t('gradeDrawer.correct')}</div>
                  </div>
                </div>

                <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={cn(
                      'h-full transition-all',
                      needsReview ? 'bg-amber-500' : passed ? 'bg-green-500' : 'bg-red-500'
                    )}
                    style={{ width: `${Math.min(100, Math.max(0, grade.percentage))}%` }}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold text-primary flex items-center gap-2">
                  <span className="text-sm uppercase tracking-wide text-foreground">
                    {t('gradeDrawer.answerBreakdown')}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({t('gradeDrawer.questionCount', { values: { count: totalQuestions } })})
                  </span>
                </h3>

                {grade.detail.map((question, idx) => {
                  const isManual = question.correct === null;
                  return (
                    <div
                      key={question.fieldId}
                      className={cn(
                        'rounded-lg border-2 p-4 transition-all',
                        isManual
                          ? 'border-amber-200 bg-amber-50/50'
                          : question.correct
                            ? 'border-green-200 bg-green-50/50'
                            : 'border-[var(--tf-error-bg-lg)] bg-[var(--tf-error-bg)]/50'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                          {isManual ? (
                            <HelpCircle className="h-5 w-5 text-amber-600" />
                          ) : question.correct ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          ) : (
                            <XCircle className="h-5 w-5 text-destructive" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex-1 min-w-0">
                              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                {t('gradeDrawer.questionLabel', { values: { number: idx + 1 } })}
                              </span>
                              <div className="font-medium text-primary truncate">{question.fieldLabel}</div>
                            </div>
                            <Badge variant="outline" className="font-mono shrink-0">
                              {question.pointsAwarded} / {question.pointValue}
                            </Badge>
                          </div>

                          {isManual ? (
                            <div className="text-sm p-3 rounded-lg bg-amber-100 text-amber-800">
                              {t('gradeDrawer.needsManualGrading')}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div
                                className={cn(
                                  'text-sm p-3 rounded-lg break-words',
                                  question.correct
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-[var(--tf-error-bg)] text-destructive'
                                )}
                              >
                                <span className="font-medium">{t('gradeDrawer.yourAnswer')} </span>
                                {formatAnswer(question.submittedValue, question.fieldType, t('gradeDrawer.noAnswer'))}
                              </div>
                              {!question.correct && question.acceptedAnswers.length > 0 && (
                                <div className="text-sm p-3 rounded-lg bg-green-100 text-green-800 break-words">
                                  <span className="font-medium">{t('gradeDrawer.correctAnswer')} </span>
                                  {question.acceptedAnswers.join(', ')}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

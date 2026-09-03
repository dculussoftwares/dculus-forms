/**
 * Grade Detail Drawer
 *
 * Native Quiz (epic #289, Story 11): per-response grade breakdown — score,
 * pass/fail, and a per-question comparison of the respondent's answer against
 * the answer key. Adapted from apps/form-app/src/plugins/quiz/ResultsDialog.tsx
 * into a native component; does not import from the plugin directory, which
 * Story 14 (#303) deprecates.
 *
 * Also the manual-grading + release surface that completes the
 * `gradeRelease: 'afterReview'` flow: any question can be scored/rescored
 * here (`overrideResponseGradeQuestion`), and once nothing is left pending,
 * `releaseResponseGrade` makes the grade visible to the respondent.
 */

import React, { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Badge,
  Button,
  Input,
  Textarea,
  LoadingSpinner,
  toastSuccess,
  toastError,
} from '@dculus/ui';
import { cn, formatFieldValue } from '@dculus/utils';
import { FieldType } from '@dculus/types';
import { CheckCircle2, XCircle, HelpCircle, Award, TrendingUp, Loader2, Send, Pencil } from 'lucide-react';
import { GET_RESPONSE_GRADE_DETAIL } from '../../graphql/queries';
import { OVERRIDE_RESPONSE_GRADE_QUESTION, RELEASE_RESPONSE_GRADE } from '../../graphql/mutations';

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
  releasedAt: string | null;
  detail: QuestionGradeDetail[];
}

interface GradeDetailDrawerProps {
  responseId: string | null;
  open: boolean;
  onClose: () => void;
  // Native Quiz — only "After manual review" forms ever need the Release
  // control; 'immediate'/'never' are already resolved and 'scheduled'
  // releases itself.
  canRelease: boolean;
  // Lets the parent (Responses table) refresh the score/status column once a
  // question is graded or the grade is released.
  onChanged?: () => void;
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
  canRelease,
  onChanged,
  t,
}) => {
  const { data, loading, error, refetch } = useQuery(GET_RESPONSE_GRADE_DETAIL, {
    variables: { id: responseId },
    skip: !responseId || !open,
  });

  const [overrideQuestion, { loading: overriding }] = useMutation(OVERRIDE_RESPONSE_GRADE_QUESTION);
  const [releaseGrade, { loading: releasing }] = useMutation(RELEASE_RESPONSE_GRADE);

  // The question currently expanded for grading/regrading, plus its draft values.
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [draftCorrect, setDraftCorrect] = useState<boolean | null>(null);
  const [draftPoints, setDraftPoints] = useState(0);
  const [draftComment, setDraftComment] = useState('');
  // Confirming release is an inline two-step control (not a second overlay,
  // and never window.confirm()): a nested modal/dialog on top of this Sheet
  // fights its outside-click handling, and a native confirm() blocks the
  // whole tab until manually dismissed.
  const [showReleaseConfirm, setShowReleaseConfirm] = useState(false);

  // This component instance is reused across responses (Responses.tsx just
  // toggles responseId/open rather than remounting it), so without this a
  // draft left open on one response's question would carry into the next
  // response's grade — same fieldId, wrong response.
  useEffect(() => {
    setEditingFieldId(null);
    setDraftCorrect(null);
    setDraftPoints(0);
    setDraftComment('');
    setShowReleaseConfirm(false);
  }, [responseId]);

  const grade: ResponseGradeRecord | undefined = data?.response?.responseGrade;
  const needsReview = grade?.status === 'NEEDS_REVIEW';
  const passed = !!grade?.passed && !needsReview;
  const totalQuestions = grade?.detail.length ?? 0;
  const correctCount = grade?.detail.filter((q) => q.correct === true).length ?? 0;
  const pendingCount = grade?.detail.filter((q) => q.correct === null).length ?? 0;
  // Mirrors the backend's isReleased() (gradingService.ts) — REVIEWED and
  // RELEASED are equally visible to the respondent, so both read as
  // "already released" here even though nothing currently writes REVIEWED.
  const isReleased = grade?.status === 'RELEASED' || grade?.status === 'REVIEWED';

  const startEditing = (question: QuestionGradeDetail) => {
    setEditingFieldId(question.fieldId);
    setDraftCorrect(question.correct);
    setDraftPoints(question.pointsAwarded);
    setDraftComment(question.graderComment ?? '');
  };

  const cancelEditing = () => setEditingFieldId(null);

  const chooseOutcome = (question: QuestionGradeDetail, correct: boolean) => {
    setDraftCorrect(correct);
    setDraftPoints(correct ? question.pointValue : 0);
  };

  const saveOverride = async (question: QuestionGradeDetail) => {
    if (draftCorrect === null || !responseId) return;
    try {
      await overrideQuestion({
        variables: {
          input: {
            responseId,
            fieldId: question.fieldId,
            correct: draftCorrect,
            pointsAwarded: draftPoints,
            graderComment: draftComment.trim() || undefined,
          },
        },
      });
      setEditingFieldId(null);
      await refetch();
      onChanged?.();
      toastSuccess(t('gradeDrawer.grading.saveSuccess'));
    } catch (err) {
      toastError(t('gradeDrawer.grading.saveError'), err instanceof Error ? err.message : undefined);
    }
  };

  const handleRelease = async () => {
    setShowReleaseConfirm(false);
    if (!responseId) return;
    try {
      await releaseGrade({ variables: { responseId } });
      await refetch();
      onChanged?.();
      toastSuccess(t('gradeDrawer.release.success'));
    } catch (err) {
      toastError(t('gradeDrawer.release.error'), err instanceof Error ? err.message : undefined);
    }
  };

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

              {canRelease && (
                <div
                  className="rounded-xl p-4 flex items-center justify-between gap-3"
                  style={{ border: '1px solid var(--tf-border-medium)' }}
                >
                  {isReleased ? (
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <Send className="h-4 w-4" />
                      {t('gradeDrawer.release.releasedOn', {
                        values: {
                          date: grade.releasedAt
                            ? new Date(grade.releasedAt).toLocaleDateString()
                            : new Date(grade.gradedAt).toLocaleDateString(),
                        },
                      })}
                    </div>
                  ) : showReleaseConfirm ? (
                    <>
                      <div className="text-sm text-muted-foreground">{t('gradeDrawer.release.confirm')}</div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setShowReleaseConfirm(false)}
                          disabled={releasing}
                        >
                          {t('gradeDrawer.grading.cancel')}
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleRelease}
                          disabled={releasing}
                          data-testid="confirm-release-grade-button"
                        >
                          {releasing && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                          {t('gradeDrawer.release.button')}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-sm text-muted-foreground">
                        {pendingCount > 0
                          ? t('gradeDrawer.release.pendingHint', { values: { count: pendingCount } })
                          : t('gradeDrawer.release.readyHint')}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => setShowReleaseConfirm(true)}
                        disabled={pendingCount > 0}
                        data-testid="release-grade-button"
                      >
                        <Send className="mr-1.5 h-3.5 w-3.5" />
                        {t('gradeDrawer.release.button')}
                      </Button>
                    </>
                  )}
                </div>
              )}

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
                  const isEditing = editingFieldId === question.fieldId;
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

                          {isManual && !isEditing ? (
                            <div className="text-sm p-3 rounded-lg bg-amber-100 text-amber-800">
                              {t('gradeDrawer.needsManualGrading')}
                            </div>
                          ) : !isEditing ? (
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
                              {question.graderComment && (
                                <div className="text-sm p-3 rounded-lg bg-slate-100 text-slate-700 break-words">
                                  <span className="font-medium">{t('gradeDrawer.grading.commentLabel')} </span>
                                  {question.graderComment}
                                </div>
                              )}
                            </div>
                          ) : null}

                          {isEditing ? (
                            <div className="mt-2 space-y-2 rounded-lg border p-3" style={{ borderColor: 'var(--tf-border-medium)' }}>
                              <div className="text-sm p-3 rounded-lg bg-slate-100 break-words">
                                <span className="font-medium">{t('gradeDrawer.yourAnswer')} </span>
                                {formatAnswer(question.submittedValue, question.fieldType, t('gradeDrawer.noAnswer'))}
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={draftCorrect === true ? 'default' : 'outline'}
                                  className={draftCorrect === true ? 'bg-green-600 hover:bg-green-700' : ''}
                                  onClick={() => chooseOutcome(question, true)}
                                  data-testid={`mark-correct-${question.fieldId}`}
                                >
                                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                                  {t('gradeDrawer.grading.markCorrect')}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={draftCorrect === false ? 'destructive' : 'outline'}
                                  onClick={() => chooseOutcome(question, false)}
                                  data-testid={`mark-incorrect-${question.fieldId}`}
                                >
                                  <XCircle className="mr-1.5 h-3.5 w-3.5" />
                                  {t('gradeDrawer.grading.markIncorrect')}
                                </Button>
                              </div>
                              <div className="flex items-center gap-2">
                                <label className="text-xs text-muted-foreground shrink-0">
                                  {t('gradeDrawer.grading.pointsLabel')}
                                </label>
                                <Input
                                  type="number"
                                  min={0}
                                  max={question.pointValue}
                                  value={draftPoints}
                                  onChange={(e) => {
                                    const next = Number(e.target.value);
                                    setDraftPoints(Number.isNaN(next) ? 0 : Math.min(Math.max(next, 0), question.pointValue));
                                  }}
                                  className="h-8 w-24"
                                  data-testid={`points-input-${question.fieldId}`}
                                />
                                <span className="text-xs text-muted-foreground">/ {question.pointValue}</span>
                              </div>
                              <Textarea
                                placeholder={t('gradeDrawer.grading.commentPlaceholder')}
                                value={draftComment}
                                onChange={(e) => setDraftComment(e.target.value)}
                                className="text-sm min-h-[60px]"
                              />
                              <div className="flex gap-2 justify-end">
                                <Button type="button" size="sm" variant="ghost" onClick={cancelEditing} disabled={overriding}>
                                  {t('gradeDrawer.grading.cancel')}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => saveOverride(question)}
                                  disabled={draftCorrect === null || overriding}
                                  data-testid={`save-grade-${question.fieldId}`}
                                >
                                  {overriding && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                                  {t('gradeDrawer.grading.save')}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => startEditing(question)}
                              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary"
                              data-testid={`grade-question-${question.fieldId}`}
                            >
                              <Pencil className="h-3 w-3" />
                              {isManual ? t('gradeDrawer.grading.gradeThisAnswer') : t('gradeDrawer.grading.overrideScore')}
                            </button>
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

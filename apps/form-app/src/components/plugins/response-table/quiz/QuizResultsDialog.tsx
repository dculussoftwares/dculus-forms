import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Badge,
} from '@dculus/ui';
import { cn } from '@dculus/utils';
import { CheckCircle2, XCircle, Award, TrendingUp } from 'lucide-react';
import { useTranslation } from '../../../../hooks/useTranslation';

interface QuizResultsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metadata: {
    quizScore: number;
    totalMarks: number;
    percentage: number;
    passThreshold?: number;
    fieldResults: Array<{
      fieldId: string;
      fieldLabel: string;
      userAnswer: string;
      correctAnswer: string;
      isCorrect: boolean;
      marksAwarded: number;
      maxMarks: number;
    }>;
    gradedAt: string;
    gradedBy: string;
  };
  responseId?: string;
}

export const QuizResultsDialog: React.FC<QuizResultsDialogProps> = ({
  open,
  onOpenChange,
  metadata,
  responseId,
}) => {
  const { t } = useTranslation('quizResultsDialog');
  const passThreshold = metadata.passThreshold ?? 60; // Fallback to 60 for old responses
  const passed = metadata.percentage >= passThreshold;
  const correctAnswers = metadata.fieldResults.filter((r) => r.isCorrect).length;
  const totalQuestions = metadata.fieldResults.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg', passed ? 'bg-green-100' : 'bg-[var(--tf-error-bg)]')}>
              <Award className={cn('h-6 w-6', passed ? 'text-green-600' : 'text-destructive')} />
            </div>
            <div>
              <DialogTitle>{t('title')}</DialogTitle>
              <DialogDescription>
                {responseId && `${t('response')} ${responseId.slice(-6)} • `}
                {t('graded')} {new Date(metadata.gradedAt).toLocaleDateString()}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Score Summary */}
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-6 border border-[var(--tf-border-medium)]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-foreground" />
                <h3 className="font-semibold text-primary">{t('overallScore')}</h3>
              </div>
              <Badge
                variant={passed ? 'default' : 'destructive'}
                className="text-base px-4 py-1.5"
              >
                {passed ? t('status.passed') : t('status.failed')}
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">
                  {metadata.quizScore}
                </div>
                <div className="text-sm text-foreground mt-1">{t('pointsEarned')}</div>
              </div>
              <div className="text-center border-x border-[var(--tf-border-strong)]">
                <div className="text-3xl font-bold text-primary">
                  {metadata.percentage.toFixed(1)}%
                </div>
                <div className="text-sm text-foreground mt-1">{t('percentage')}</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">
                  {correctAnswers}/{totalQuestions}
                </div>
                <div className="text-sm text-foreground mt-1">{t('correct')}</div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
              <div
                className={cn('h-full transition-all', passed ? 'bg-green-500' : 'bg-red-500')}
                style={{ width: `${metadata.percentage}%` }}
              />
            </div>
            <div className="text-xs text-muted-foreground text-center mt-2">
              Pass threshold: {passThreshold}%
            </div>
          </div>

          {/* Answer Breakdown */}
          <div className="space-y-3">
            <h3 className="font-semibold text-primary flex items-center gap-2">
              <span className="text-sm uppercase tracking-wide text-foreground">
                Answer Breakdown
              </span>
              <span className="text-xs text-muted-foreground">
                ({totalQuestions} questions)
              </span>
            </h3>

            {metadata.fieldResults.map((result, idx) => (
              <div
                key={result.fieldId}
                className={cn(
                  'rounded-lg border-2 p-4 transition-all',
                  result.isCorrect
                    ? 'border-green-200 bg-green-50/50'
                    : 'border-[var(--tf-error-bg-lg)] bg-[var(--tf-error-bg)]/50'
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {result.isCorrect ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-destructive" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Question {idx + 1}
                          </span>
                        </div>
                        <div className="font-medium text-primary">
                          {result.fieldLabel}
                        </div>
                      </div>
                      <Badge variant="outline" className="font-mono shrink-0">
                        {result.marksAwarded} / {result.maxMarks} pts
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <div
                        className={cn(
                          'text-sm p-3 rounded-lg',
                          result.isCorrect
                            ? 'bg-green-100 text-green-800'
                            : 'bg-[var(--tf-error-bg)] text-destructive'
                        )}
                      >
                        <span className="font-medium">{t('yourAnswer')} </span>
                        {result.userAnswer}
                      </div>
                      {!result.isCorrect && (
                        <div className="text-sm p-3 rounded-lg bg-green-100 text-green-800">
                          <span className="font-medium">{t('correctAnswer')} </span>
                          {result.correctAnswer}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

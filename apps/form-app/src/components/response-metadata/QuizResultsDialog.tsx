import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Badge,
} from '@dculus/ui';
import { CheckCircle2, XCircle, Award, TrendingUp } from 'lucide-react';

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
  const passThreshold = metadata.passThreshold ?? 60; // Fallback to 60 for old responses
  const passed = metadata.percentage >= passThreshold;
  const correctAnswers = metadata.fieldResults.filter((r) => r.isCorrect).length;
  const totalQuestions = metadata.fieldResults.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${passed ? 'bg-green-100' : 'bg-red-100'}`}>
              <Award className={`h-6 w-6 ${passed ? 'text-green-600' : 'text-red-600'}`} />
            </div>
            <div>
              <DialogTitle>Quiz Results</DialogTitle>
              <DialogDescription>
                {responseId && `Response ${responseId.slice(-6)} • `}
                Graded {new Date(metadata.gradedAt).toLocaleDateString()}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Score Summary */}
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-slate-600" />
                <h3 className="font-semibold text-slate-900">Overall Score</h3>
              </div>
              <Badge
                variant={passed ? 'default' : 'destructive'}
                className="text-base px-4 py-1.5"
              >
                {passed ? 'PASSED' : 'FAILED'}
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-slate-900">
                  {metadata.quizScore}
                </div>
                <div className="text-sm text-slate-600 mt-1">Points Earned</div>
              </div>
              <div className="text-center border-x border-slate-300">
                <div className="text-3xl font-bold text-slate-900">
                  {metadata.percentage.toFixed(1)}%
                </div>
                <div className="text-sm text-slate-600 mt-1">Percentage</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-slate-900">
                  {correctAnswers}/{totalQuestions}
                </div>
                <div className="text-sm text-slate-600 mt-1">Correct</div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full transition-all ${
                  passed ? 'bg-green-500' : 'bg-red-500'
                }`}
                style={{ width: `${metadata.percentage}%` }}
              />
            </div>
            <div className="text-xs text-slate-500 text-center mt-2">
              Pass threshold: {passThreshold}%
            </div>
          </div>

          {/* Answer Breakdown */}
          <div className="space-y-3">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <span className="text-sm uppercase tracking-wide text-slate-600">
                Answer Breakdown
              </span>
              <span className="text-xs text-slate-400">
                ({totalQuestions} questions)
              </span>
            </h3>

            {metadata.fieldResults.map((result, idx) => (
              <div
                key={result.fieldId}
                className={`rounded-lg border-2 p-4 transition-all ${
                  result.isCorrect
                    ? 'border-green-200 bg-green-50/50'
                    : 'border-red-200 bg-red-50/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {result.isCorrect ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                            Question {idx + 1}
                          </span>
                        </div>
                        <div className="font-medium text-slate-900">
                          {result.fieldLabel}
                        </div>
                      </div>
                      <Badge variant="outline" className="font-mono shrink-0">
                        {result.marksAwarded} / {result.maxMarks} pts
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <div
                        className={`text-sm p-3 rounded-md ${
                          result.isCorrect
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        <span className="font-medium">Your answer: </span>
                        {result.userAnswer}
                      </div>
                      {!result.isCorrect && (
                        <div className="text-sm p-3 rounded-md bg-green-100 text-green-800">
                          <span className="font-medium">Correct answer: </span>
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

import React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
} from '@dculus/ui';
import { CheckCircle2, XCircle, Award } from 'lucide-react';
import { useTranslation } from '../../../../hooks/useTranslation';

interface QuizGradingMetadataViewerProps {
  metadata: {
    quizScore: number;
    totalMarks: number;
    percentage: number;
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
}

export const QuizGradingMetadataViewer: React.FC<QuizGradingMetadataViewerProps> = ({
  metadata,
}) => {
  const { t } = useTranslation('quizGradingMetadataViewer');
  const passed = metadata.percentage >= 60;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-primary" />
          <CardTitle>{t('title')}</CardTitle>
        </div>
        <CardDescription>
          {t('gradedOn', { values: { date: new Date(metadata.gradedAt).toLocaleString() } })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Score Summary */}
        <div className="space-y-4">
          <div className="text-center">
            <div className="text-5xl font-bold text-gray-900">
              {metadata.quizScore} / {metadata.totalMarks}
            </div>
            <div className="text-2xl text-muted-foreground mt-2">
              {metadata.percentage.toFixed(1)}%
            </div>
          </div>

          <div className="space-y-2">
            {/* Progress bar */}
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full transition-all ${
                  passed ? 'bg-green-500' : 'bg-red-500'
                }`}
                style={{ width: `${metadata.percentage}%` }}
              />
            </div>
            <div className="flex justify-center">
              <Badge
                variant={passed ? 'default' : 'destructive'}
                className="text-sm px-4 py-1"
              >
                {passed ? t('status.passed') : t('status.failed')}
              </Badge>
            </div>
          </div>
        </div>

        {/* Answer Breakdown */}
        <div className="space-y-3">
          <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            {t('answerBreakdown')}
          </h4>

          {metadata.fieldResults.map((result, idx) => (
            <div
              key={result.fieldId}
              className={`border rounded-lg p-4 ${
                result.isCorrect
                  ? 'border-green-200 bg-green-50'
                  : 'border-red-200 bg-red-50'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <div className="mt-1">
                    {result.isCorrect ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 mb-2">
                      {t('questionLabel', { values: { number: idx + 1, label: result.fieldLabel } })}
                    </div>
                    <div className="space-y-1">
                      <div
                        className={`text-sm ${
                          result.isCorrect ? 'text-green-700' : 'text-red-700'
                        }`}
                      >
                        <span className="font-medium">{t('yourAnswer')}</span> {result.userAnswer}
                      </div>
                      {!result.isCorrect && (
                        <div className="text-sm text-green-700">
                          <span className="font-medium">{t('correctAnswer')}</span>{' '}
                          {result.correctAnswer}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <Badge variant="outline" className="font-mono">
                    {result.marksAwarded} / {result.maxMarks}
                  </Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

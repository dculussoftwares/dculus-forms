import React from 'react';
import { Badge, Button } from '@dculus/ui';
import type { ResponseCellProps } from '../core/registry';

export const QuizResponseCell: React.FC<ResponseCellProps> = ({
  metadata,
  responseId,
  onViewDetails,
}) => {
  if (!metadata?.['quiz-grading']) {
    return <span className="text-muted-foreground">-</span>;
  }

  const quiz = metadata['quiz-grading'];
  const passThreshold = quiz.passThreshold ?? 60;
  const passed = quiz.percentage >= passThreshold;

  return (
    <Button
      variant="ghost"
      onClick={(e) => {
        e.stopPropagation();
        onViewDetails?.(quiz, responseId);
      }}
      className="flex items-center gap-2 hover:opacity-80 h-auto p-0"
    >
      <Badge variant={passed ? 'default' : 'destructive'}>
        {quiz.quizScore} / {quiz.totalMarks}
      </Badge>
      <span className="text-sm text-muted-foreground">({quiz.percentage.toFixed(0)}%)</span>
    </Button>
  );
};

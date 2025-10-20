import React from 'react';
import { Badge } from '@dculus/ui';

interface QuizScoreCellProps {
  metadata: any;
  responseId: string;
  onViewResults: (quizMetadata: any, responseId: string) => void;
}

/**
 * Quiz Score Cell Component
 * Displays quiz score badge in the responses table
 */
export const QuizScoreCell: React.FC<QuizScoreCellProps> = ({
  metadata,
  responseId,
  onViewResults,
}) => {
  // Check if quiz-grading metadata exists
  if (!metadata || !metadata['quiz-grading']) {
    return <span className="text-muted-foreground">-</span>;
  }

  const quiz = metadata['quiz-grading'];
  const passThreshold = quiz.passThreshold ?? 60; // Fallback to 60 for old responses
  const passed = quiz.percentage >= passThreshold;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onViewResults(quiz, responseId);
      }}
      className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer"
    >
      <Badge variant={passed ? 'default' : 'destructive'}>
        {quiz.quizScore} / {quiz.totalMarks}
      </Badge>
      <span className="text-sm text-muted-foreground">
        ({quiz.percentage.toFixed(0)}%)
      </span>
    </button>
  );
};

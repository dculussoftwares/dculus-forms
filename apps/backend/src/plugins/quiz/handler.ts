import type { PluginHandler } from '../types.js';
import type {
  QuizGradingPluginConfig,
  QuizFieldConfig,
  QuizGradingResult,
} from './types.js';
import { QUIZ_GRADING_METADATA_KEY } from './types.js';

/**
 * Grade quiz response based on configuration
 */
function gradeQuizResponse(
  quizFields: QuizFieldConfig[],
  responseData: Record<string, any>,
  passThreshold: number
): any {
  let totalScore = 0;
  let totalMarks = 0;
  const fieldResults: any[] = [];

  for (const quizField of quizFields) {
    const userAnswer = responseData[quizField.fieldId] || '';
    const correctAnswer = quizField.correctAnswer;
    const maxMarks = quizField.marks;

    // Binary grading: full marks if correct, 0 if incorrect
    const isCorrect = userAnswer === correctAnswer;
    const marksAwarded = isCorrect ? maxMarks : 0;

    totalScore += marksAwarded;
    totalMarks += maxMarks;

    fieldResults.push({
      fieldId: quizField.fieldId,
      fieldLabel: quizField.fieldLabel || 'Unknown Field',
      userAnswer: userAnswer || '(No answer)',
      correctAnswer,
      isCorrect,
      marksAwarded,
      maxMarks,
    });
  }

  const percentage = totalMarks > 0 ? (totalScore / totalMarks) * 100 : 0;

  return {
    quizScore: totalScore,
    totalMarks,
    percentage: parseFloat(percentage.toFixed(2)),
    passThreshold,
    fieldResults,
    gradedAt: new Date().toISOString(),
    gradedBy: 'plugin',
  };
}

/**
 * Quiz Grading Plugin Handler
 * Automatically grades quiz responses and stores results in response metadata
 */
export const quizGradingHandler: PluginHandler = async (plugin, event, context) => {
  const config = plugin.config as QuizGradingPluginConfig;

  context.logger.info('Quiz grading plugin triggered', {
    eventType: event.type,
    formId: event.formId,
    quizFieldCount: config.quizFields.length,
  });

  try {
    // 1. Validate event has response ID
    if (!event.data.responseId) {
      throw new Error('No response ID in event data');
    }

    // 2. Get response data
    const response = await context.getResponseById(event.data.responseId);
    if (!response) {
      throw new Error(`Response not found: ${event.data.responseId}`);
    }

    // 3. Grade the quiz
    // Note: Field labels are now stored in the quiz config itself for reliability
    const quizMetadata = gradeQuizResponse(
      config.quizFields,
      response.data,
      config.passThreshold
    );

    // 5. Update response metadata with quiz results
    const existingMetadata = (response.metadata as any) || {};
    const updatedMetadata = {
      ...existingMetadata,
      [QUIZ_GRADING_METADATA_KEY]: quizMetadata,
    };

    await context.prisma.response.update({
      where: { id: response.id },
      data: { metadata: updatedMetadata },
    });

    context.logger.info('Quiz graded successfully', {
      responseId: response.id,
      score: `${quizMetadata.quizScore}/${quizMetadata.totalMarks}`,
      percentage: `${quizMetadata.percentage.toFixed(1)}%`,
      passed: quizMetadata.percentage >= config.passThreshold,
    });

    // 6. Return result
    const result: QuizGradingResult = {
      success: true,
      quizScore: quizMetadata.quizScore,
      totalMarks: quizMetadata.totalMarks,
      percentage: quizMetadata.percentage,
      passed: quizMetadata.percentage >= config.passThreshold,
      responseId: response.id,
    };

    return result;

  } catch (error: any) {
    context.logger.error('Quiz grading failed', {
      error: error.message,
      formId: event.formId,
      responseId: event.data.responseId,
    });

    throw new Error(`Quiz grading failed: ${error.message}`);
  }
};

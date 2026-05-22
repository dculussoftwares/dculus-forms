import type { PluginManifest } from '../types.js';

export const quizManifest: PluginManifest = {
  id: 'quiz-grading',
  name: 'Quiz Auto-Grading',
  description:
    'Automatically grade quiz responses with correct answers and scoring.',
  icon: 'GraduationCap',
  iconColor: '#5c2e6b',
  iconBgColor: '#ddd6fa',
  category: 'Workflow',
  available: true,
};

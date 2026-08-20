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
  deprecated: true,
  deprecationMessage:
    'This plugin is deprecated. Use native quiz mode in Form Settings → Quiz for new forms — existing quiz plugin instances keep working.',
};

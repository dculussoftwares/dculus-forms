import React from 'react';
import { LayoutProps } from '../types';
import { StandardIntroLayout } from './shared/StandardIntroLayout';

/**
 * L8 "Hero" — a full-bleed image with the headline and CTA set over a bottom
 * gradient scrim. Previously the intro rendered no text at all; it now has an
 * editable headline like every other layout.
 */
export const L8ImageLayout: React.FC<LayoutProps> = (props) => (
  <StandardIntroLayout
    {...props}
    layoutCode="L8"
    variant="hero"
    defaultContent="<h1>Welcome</h1><p>Tap continue to begin.</p>"
    defaultCtaLabel="Continue"
    fieldStyles={{
      field: {
        container: 'mb-6',
        label: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2',
        input:
          'w-full h-12 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-4 text-gray-900 dark:text-gray-100',
        textarea:
          'w-full h-24 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-gray-900 dark:text-gray-100',
        select:
          'w-full h-12 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-4 text-gray-900 dark:text-gray-100',
      },
      submitButton: 'w-full h-12 bg-primary rounded-lg flex items-center justify-center',
    }}
  />
);

import React from 'react';
import { LayoutProps } from '../types';
import { StandardIntroLayout } from './shared/StandardIntroLayout';

/**
 * L3 "Card" — a full-bleed image with a single centered card floating over it.
 */
export const L3CardLayout: React.FC<LayoutProps> = (props) => (
  <StandardIntroLayout
    {...props}
    layoutCode="L3"
    variant="card"
    defaultContent="<h1>Card Layout Survey</h1>"
    defaultCtaLabel="Start Survey"
    fieldStyles={{
      field: {
        container: 'mb-4',
        label: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1',
        input:
          'w-full h-10 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md px-3 text-gray-900 dark:text-gray-100',
        textarea:
          'w-full h-24 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md px-3 py-2 text-gray-900 dark:text-gray-100',
        select:
          'w-full h-10 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md px-3 text-gray-900 dark:text-gray-100',
      },
      submitButton: 'w-full h-10 bg-primary rounded-md flex items-center justify-center',
    }}
  />
);

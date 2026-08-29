import React from 'react';
import { LayoutProps } from '../types';
import { StandardIntroLayout } from './shared/StandardIntroLayout';

/**
 * L2 "Modern" — a large image panel on the right meeting an edge-to-edge
 * content panel (flatter frame, no floating card). Distinct from L1, which
 * puts the image left and floats the content on an inset card.
 */
export const L2ModernLayout: React.FC<LayoutProps> = (props) => (
  <StandardIntroLayout
    {...props}
    layoutCode="L2"
    variant="modern"
    defaultContent="<h1>Modern Design Survey</h1>"
    defaultCtaLabel="Start Survey"
    fieldStyles={{
      field: {
        container: 'mb-6',
        label: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2',
        input:
          'w-full h-12 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-4 text-gray-900 dark:text-gray-100',
        textarea:
          'w-full h-32 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-4 py-3 text-gray-900 dark:text-gray-100',
        select:
          'w-full h-12 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-4 text-gray-900 dark:text-gray-100',
      },
      submitButton: 'w-full h-10 bg-primary rounded-md flex items-center justify-center',
    }}
  />
);

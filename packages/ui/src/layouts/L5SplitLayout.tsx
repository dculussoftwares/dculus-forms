import React from 'react';
import { LayoutProps } from '../types';
import { StandardIntroLayout } from './shared/StandardIntroLayout';

/**
 * L5 "Split" — a literal 50/50 composition: image edge-to-edge on the right
 * half, content on the left half, a crisp seam between them.
 */
export const L5SplitLayout: React.FC<LayoutProps> = (props) => (
  <StandardIntroLayout
    {...props}
    layoutCode="L5"
    variant="split"
    defaultContent="<h1>Split Layout</h1><p>Left-right split design with information panel and form section.</p>"
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

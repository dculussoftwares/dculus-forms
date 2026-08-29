import React from 'react';
import { LayoutProps } from '../types';
import { StandardIntroLayout } from './shared/StandardIntroLayout';

/**
 * L7 "Single" — no image column on desktop; one full-width, centered content
 * panel. The background media reads through as a soft wash (desktop) or the
 * image band (mobile).
 */
export const L7SingleLayout: React.FC<LayoutProps> = (props) => (
  <StandardIntroLayout
    {...props}
    layoutCode="L7"
    variant="single"
    defaultContent="<h1>Single Layout</h1><p>Clean single-section design with information panel and form section.</p>"
    defaultCtaLabel="Continue"
    fieldStyles={{
      field: {
        container: 'mb-4',
        label: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2',
        input:
          'w-full h-10 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 text-gray-900 dark:text-gray-100',
        textarea:
          'w-full h-24 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-gray-900 dark:text-gray-100',
        select:
          'w-full h-10 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 text-gray-900 dark:text-gray-100',
      },
      submitButton: 'w-full h-12 bg-primary rounded-lg flex items-center justify-center',
    }}
  />
);

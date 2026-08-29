import React from 'react';
import { LayoutProps } from '../types';
import { StandardIntroLayout } from './shared/StandardIntroLayout';

/**
 * L4 "Minimal" — a narrow image rail beside an airy, centered content column
 * with underlined form fields. Restraint is the point.
 */
export const L4MinimalLayout: React.FC<LayoutProps> = (props) => (
  <StandardIntroLayout
    {...props}
    layoutCode="L4"
    variant="minimal"
    defaultContent="<h1>Minimal Form</h1><p>Clean and spacious design for better focus.</p>"
    defaultCtaLabel="Continue"
    fieldStyles={{
      field: {
        container: 'mb-8',
        label: 'block text-xs font-light text-gray-500 dark:text-gray-400 mt-2',
        input:
          'w-full h-12 bg-transparent border-b-2 border-gray-300 dark:border-gray-600 px-0 text-gray-900 dark:text-gray-100 focus:border-gray-600 dark:focus:border-gray-400',
        textarea:
          'w-full h-32 bg-transparent border-b-2 border-gray-300 dark:border-gray-600 px-0 py-0 text-gray-900 dark:text-gray-100 focus:border-gray-600 dark:focus:border-gray-400',
        select:
          'w-full h-12 bg-transparent border-b-2 border-gray-300 dark:border-gray-600 px-0 text-gray-900 dark:text-gray-100 focus:border-gray-600 dark:focus:border-gray-400',
      },
      submitButton: 'w-full h-12 bg-primary rounded-lg flex items-center justify-center',
    }}
  />
);

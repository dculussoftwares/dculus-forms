import React from 'react';
import { LayoutProps } from '../types';
import { StandardIntroLayout } from './shared/StandardIntroLayout';

/**
 * L1 "Classic" — framed hero, image left, content on a floating inset card.
 * The most traditional of the nine; on mobile it renders the shared
 * image-band + content-sheet composition (see `IntroHero`).
 */
export const L1ClassicLayout: React.FC<LayoutProps> = (props) => (
  <StandardIntroLayout
    {...props}
    layoutCode="L1"
    variant="classic"
    defaultContent="<h1>Employee satisfaction survey</h1>"
    defaultCtaLabel="Get Started"
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
      submitButton: 'w-full h-10 bg-primary rounded-md flex items-center justify-center',
    }}
  />
);

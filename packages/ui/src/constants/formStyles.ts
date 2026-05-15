import { LayoutStyles } from '../renderers/SinglePageForm';

export const DEFAULT_LAYOUT_STYLES: LayoutStyles = {
  field: {
    container: 'mb-10',
    label: 'text-xl font-semibold text-gray-900 dark:text-white mb-5',
    input:
      'w-full bg-transparent border-0 border-b-2 px-0 pb-3 text-base text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-0 transition-colors duration-200',
    textarea:
      'w-full bg-transparent border-0 border-b-2 px-0 pb-3 pt-1 text-base text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-0 transition-colors duration-200 resize-none min-h-[100px]',
    select: 'w-full',
  },
  submitButton:
    'inline-flex items-center justify-center gap-3 px-10 py-4 text-base font-semibold text-white bg-primary hover:bg-primary/90 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 active:scale-[0.98]',
};

export const FORM_CONSTANTS = {
  FIELD_FOCUS_DELAY_MS: 10,
  EMPTY_PAGE_MESSAGE: 'No fields in this page yet.',
  DEFAULT_SUBMIT_TEXT: 'Submit',
} as const;

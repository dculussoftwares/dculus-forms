import { LayoutStyles } from '../renderers/SinglePageForm';

export const DEFAULT_LAYOUT_STYLES: LayoutStyles = {
  field: {
    container: 'mb-5',

    /* Label — exactly matches builder FieldPreview: text-gray-900 dark:text-white */
    label: 'text-sm font-medium text-gray-900 dark:text-white',

    /* Boxed input — matches our updated Input component style */
    input:
      'w-full h-9 rounded-lg bg-white/80 px-3 py-1.5 text-sm text-[#4c414e] placeholder:text-[#655d67] focus:outline-none focus:ring-0 transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/5 dark:text-foreground dark:placeholder:text-muted-foreground',

    /* Boxed textarea */
    textarea:
      'w-full rounded-lg bg-white/80 px-3 py-2.5 text-sm text-[#4c414e] placeholder:text-[#655d67] focus:outline-none focus:ring-0 transition-colors duration-150 resize-none min-h-[80px] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/5 dark:text-foreground dark:placeholder:text-muted-foreground',

    select: 'w-full',
  },

  /* Submit button — dark aubergine #3c323e */
  submitButton:
    'inline-flex items-center justify-center gap-2 px-8 py-2.5 text-sm font-medium text-white bg-[#3c323e] hover:bg-[#2e2530] rounded-lg shadow-sm hover:shadow-md transition-all duration-200 active:scale-[0.98]',
};

export const FORM_CONSTANTS = {
  FIELD_FOCUS_DELAY_MS: 10,
  EMPTY_PAGE_MESSAGE: 'No fields in this page yet.',
  DEFAULT_SUBMIT_TEXT: 'Submit',
} as const;

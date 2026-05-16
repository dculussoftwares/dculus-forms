import { LayoutStyles } from '../renderers/SinglePageForm';

export const DEFAULT_LAYOUT_STYLES: LayoutStyles = {
  field: {
    container: 'mb-10',
    /* Typeform form viewer: 20px label, normal weight, #3c323e color */
    label: 'text-xl font-normal text-[#3c323e] dark:text-foreground mb-4',
    /* Typeform underline-only input: no box, bottom-only border, blue placeholder rgb(155,181,223) */
    input:
      'w-full bg-transparent border-0 border-b border-[rgba(60,50,62,0.20)] px-0 pb-3 text-lg text-[#3c323e] dark:text-foreground dark:border-white/20 placeholder:text-[rgb(155,181,223)] focus:outline-none focus:ring-0 focus:border-[#3c323e] focus:shadow-[0_1px_0_0_#3c323e] transition-all duration-200',
    textarea:
      'w-full bg-transparent border-0 border-b border-[rgba(60,50,62,0.20)] px-0 pb-3 pt-1 text-lg text-[#3c323e] dark:text-foreground dark:border-white/20 placeholder:text-[rgb(155,181,223)] focus:outline-none focus:ring-0 focus:border-[#3c323e] transition-all duration-200 resize-none min-h-[100px]',
    select: 'w-full',
  },
  /* Typeform submit: #3c323e bg, white text, 8px radius */
  submitButton:
    'inline-flex items-center justify-center gap-2 px-8 py-3 text-sm font-medium text-white bg-[#3c323e] hover:bg-[#2e2530] rounded-lg shadow-sm hover:shadow-md transition-all duration-200 active:scale-[0.98]',
};

export const FORM_CONSTANTS = {
  FIELD_FOCUS_DELAY_MS: 10,
  EMPTY_PAGE_MESSAGE: 'No fields in this page yet.',
  DEFAULT_SUBMIT_TEXT: 'Submit',
} as const;

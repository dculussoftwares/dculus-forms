import { LayoutStyles } from '../renderers/SinglePageForm';

/**
 * Default styles for form components
 * Extracted to eliminate magic values and improve maintainability
 */
export const DEFAULT_LAYOUT_STYLES: LayoutStyles = {
  field: {
    container: 'mb-4',
    label: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2',
    input: 'w-full h-10 bg-white border border-gray-300 rounded-md px-3 text-gray-500',
    textarea: 'w-full h-24 bg-white border border-gray-300 rounded-md px-3 py-2 text-gray-500',
    select: 'w-full h-10 bg-white border border-gray-300 rounded-md px-3 text-gray-500',
  },
  submitButton: 'w-full h-10 bg-blue-600 text-white rounded-md flex items-center justify-center hover:bg-blue-700 transition-colors',
};

/**
 * Form-related constants
 */
export const FORM_CONSTANTS = {
  FIELD_FOCUS_DELAY_MS: 10,
  EMPTY_PAGE_MESSAGE: 'No fields in this page yet.',
  DEFAULT_SUBMIT_TEXT: 'Submit',
} as const;
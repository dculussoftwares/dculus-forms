/**
 * Constants for field settings components
 * Centralizes magic strings, error messages, and configuration values
 */

export const FIELD_SETTINGS_CONSTANTS = {
  // Validation limits
  VALIDATION_LIMITS: {
    LABEL_MIN_LENGTH: 1,
    LABEL_MAX_LENGTH: 200,
    HINT_MAX_LENGTH: 500,
    PLACEHOLDER_MAX_LENGTH: 100,
    DEFAULT_VALUE_MAX_LENGTH: 1000,
    PREFIX_MAX_LENGTH: 10,
    CHARACTER_LIMIT_MAX: 5000,
    OPTIONS_MIN_COUNT: 1,
    RADIO_OPTIONS_MIN_COUNT: 2,
    SELECTED_VALUES_MAX_COUNT: 100,
  },

  // CSS classes
  CSS_CLASSES: {
    ERROR_INPUT: 'border-red-500 focus:border-red-500 focus:ring-red-500',
    EMPTY_OPTION: 'border-red-300 focus:border-red-500 focus:ring-red-500',
    DIRTY_BACKGROUND: 'bg-gradient-to-b from-orange-25 to-transparent dark:from-orange-950/10',
    SECTION_SPACING: 'space-y-4',
    INPUT_SPACING: 'space-y-2',
    TEXT_SMALL: 'text-sm',
    TEXT_XS: 'text-xs',
    LABEL_STYLE: 'text-xs font-medium text-gray-700 dark:text-gray-300',
    SECTION_TITLE: 'text-sm font-medium text-gray-900 dark:text-white',
  },

  // Error messages
  ERROR_MESSAGES: {
    REQUIRED_FIELD: 'This field is required',
    LABEL_REQUIRED: 'Field label is required',
    LABEL_TOO_LONG: 'Label is too long',
    HINT_TOO_LONG: 'Help text is too long',
    PLACEHOLDER_TOO_LONG: 'Placeholder is too long',
    DEFAULT_VALUE_TOO_LONG: 'Default value is too long',
    PREFIX_TOO_LONG: 'Prefix is too long',
    MIN_LENGTH_INVALID: 'Minimum length must be 0 or greater',
    MAX_LENGTH_INVALID: 'Maximum length must be 1 or greater',
    CHARACTER_LIMIT_EXCEEDED: 'Cannot exceed 5000 characters',
    MIN_GREATER_THAN_MAX: 'Minimum length must be less than or equal to maximum length',
    MIN_VALUE_GREATER_THAN_MAX: 'Minimum value must be less than or equal to maximum value',
    DEFAULT_BELOW_MIN: 'Default value must be greater than or equal to minimum value',
    DEFAULT_ABOVE_MAX: 'Default value must be less than or equal to maximum value',
    INVALID_NUMBER: 'Must be a valid number',
    INVALID_DATE: 'Invalid date format',
    MIN_DATE_AFTER_MAX: 'Minimum date must be before or equal to maximum date',
    DEFAULT_DATE_BELOW_MIN: 'Default date must be after or equal to minimum date',
    DEFAULT_DATE_ABOVE_MAX: 'Default date must be before or equal to maximum date',
    OPTION_EMPTY: 'Option text cannot be empty',
    DUPLICATE_OPTIONS: 'Duplicate options are not allowed',
    MIN_OPTIONS_REQUIRED: 'Add at least one option',
    MIN_RADIO_OPTIONS_REQUIRED: 'Radio fields need at least 2 options to choose from',
    DEFAULT_VALUES_INVALID: 'Default values must be from the available options',
  },

  // Placeholder texts
  PLACEHOLDERS: {
    FIELD_LABEL: 'Field label',
    HELP_TEXT: 'Help text for this field',
    DEFAULT_VALUE: 'Default value',
    PLACEHOLDER_TEXT: 'Placeholder text',
    PREFIX_TEXT: 'e.g., $, @',
    NO_MINIMUM: 'No minimum',
    NO_MAXIMUM: 'No maximum',
    MIN_PLACEHOLDER: 'Min',
    MAX_PLACEHOLDER: 'Max',
    OPTION_PLACEHOLDER: (index: number) => `Option ${index + 1}`,
    SELECT_DEFAULT_OPTION: 'Select default option',
  },

  // Field type configurations
  FIELD_TYPE_CONFIG: {
    TEXT_INPUT: {
      supportsCharacterLimits: true,
      supportsPrefix: true,
      hasOptions: false,
    },
    TEXT_AREA: {
      supportsCharacterLimits: true,
      supportsPrefix: true,
      hasOptions: false,
    },
    EMAIL: {
      supportsCharacterLimits: false,
      supportsPrefix: false,
      hasOptions: false,
    },
    NUMBER: {
      supportsCharacterLimits: false,
      supportsPrefix: true,
      hasOptions: false,
    },
    SELECT: {
      supportsCharacterLimits: false,
      supportsPrefix: false,
      hasOptions: true,
    },
    RADIO: {
      supportsCharacterLimits: false,
      supportsPrefix: false,
      hasOptions: true,
    },
    CHECKBOX: {
      supportsCharacterLimits: false,
      supportsPrefix: false,
      hasOptions: true,
    },
    DATE: {
      supportsCharacterLimits: false,
      supportsPrefix: false,
      hasOptions: false,
    },
  },

  // Input types
  INPUT_TYPES: {
    TEXT: 'text',
    EMAIL: 'email',
    NUMBER: 'number',
    DATE: 'date',
    CHECKBOX: 'checkbox',
  },

  // Special values
  SPECIAL_VALUES: {
    NONE_OPTION: '__none__',
    EMPTY_STRING: '',
  },

  // Section titles
  SECTION_TITLES: {
    BASIC_SETTINGS: 'Basic Settings',
    VALIDATION: 'Validation',
    OPTIONS: 'Options',
    CHARACTER_LIMITS: 'Character Limits',
    NUMBER_RANGE: 'Number Range',
    DATE_RANGE: 'Date Range',
    PREFIX_SETTINGS: 'Prefix Settings',
  },

  // Labels
  LABELS: {
    LABEL: 'Label',
    HELP_TEXT: 'Help Text',
    DEFAULT_VALUE: 'Default Value',
    PLACEHOLDER: 'Placeholder',
    PREFIX: 'Prefix',
    REQUIRED_FIELD: 'Required field',
    MINIMUM: 'Minimum',
    MAXIMUM: 'Maximum',
    MINIMUM_LENGTH: 'Minimum Length',
    MAXIMUM_LENGTH: 'Maximum Length',
    MINIMUM_DATE: 'Minimum Date',
    MAXIMUM_DATE: 'Maximum Date',
  },

  // Button texts
  BUTTONS: {
    ADD: 'Add',
    SAVE: 'Save',
    CANCEL: 'Cancel',
    RESET: 'Reset',
  },

  // Info messages
  INFO_MESSAGES: {
    NO_OPTIONS_AVAILABLE: 'No options available. Add options first to set default values.',
    SELECTED_COUNT: (count: number) => `${count} option${count === 1 ? '' : 's'} selected as default`,
    SELECT_FIELD_TO_EDIT: 'Select a field to edit its settings',
  },
} as const;

/**
 * Type-safe accessor for constants
 */
export type FieldSettingsConstantsType = typeof FIELD_SETTINGS_CONSTANTS;
export type ErrorMessage = typeof FIELD_SETTINGS_CONSTANTS.ERROR_MESSAGES[keyof typeof FIELD_SETTINGS_CONSTANTS.ERROR_MESSAGES];
export type CSSClass = typeof FIELD_SETTINGS_CONSTANTS.CSS_CLASSES[keyof typeof FIELD_SETTINGS_CONSTANTS.CSS_CLASSES];
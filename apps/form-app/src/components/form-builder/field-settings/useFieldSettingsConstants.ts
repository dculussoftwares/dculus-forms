/**
 * Translation-aware constants for field settings components
 * Provides the same interface as the original constants but with translations
 */

import { useTranslation } from '../../../hooks';

/**
 * Hook to get translated field settings constants
 * Returns the same structure as FIELD_SETTINGS_CONSTANTS but with translated strings
 */
export const useFieldSettingsConstants = () => {
  const { t } = useTranslation('fieldSettingsConstants');

  return {
    // Validation limits (unchanged as they're not user-facing)
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

    // CSS classes (unchanged as they're not user-facing)
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

    // Error messages (translated)
    ERROR_MESSAGES: {
      REQUIRED_FIELD: t('errorMessages.requiredField'),
      LABEL_REQUIRED: t('errorMessages.labelRequired'),
      LABEL_TOO_LONG: t('errorMessages.labelTooLong'),
      HINT_TOO_LONG: t('errorMessages.hintTooLong'),
      PLACEHOLDER_TOO_LONG: t('errorMessages.placeholderTooLong'),
      DEFAULT_VALUE_TOO_LONG: t('errorMessages.defaultValueTooLong'),
      PREFIX_TOO_LONG: t('errorMessages.prefixTooLong'),
      MIN_LENGTH_INVALID: t('errorMessages.minLengthInvalid'),
      MAX_LENGTH_INVALID: t('errorMessages.maxLengthInvalid'),
      CHARACTER_LIMIT_EXCEEDED: t('errorMessages.characterLimitExceeded'),
      MIN_GREATER_THAN_MAX: t('errorMessages.minGreaterThanMax'),
      MIN_VALUE_GREATER_THAN_MAX: t('errorMessages.minValueGreaterThanMax'),
      DEFAULT_BELOW_MIN: t('errorMessages.defaultBelowMin'),
      DEFAULT_ABOVE_MAX: t('errorMessages.defaultAboveMax'),
      INVALID_NUMBER: t('errorMessages.invalidNumber'),
      INVALID_DATE: t('errorMessages.invalidDate'),
      MIN_DATE_AFTER_MAX: t('errorMessages.minDateAfterMax'),
      DEFAULT_DATE_BELOW_MIN: t('errorMessages.defaultDateBelowMin'),
      DEFAULT_DATE_ABOVE_MAX: t('errorMessages.defaultDateAboveMax'),
      OPTION_EMPTY: t('errorMessages.optionEmpty'),
      DUPLICATE_OPTIONS: t('errorMessages.duplicateOptions'),
      MIN_OPTIONS_REQUIRED: t('errorMessages.minOptionsRequired'),
      MIN_RADIO_OPTIONS_REQUIRED: t('errorMessages.minRadioOptionsRequired'),
      DEFAULT_VALUES_INVALID: t('errorMessages.defaultValuesInvalid'),
    },

    // Placeholder texts (translated)
    PLACEHOLDERS: {
      FIELD_LABEL: t('placeholders.fieldLabel'),
      HELP_TEXT: t('placeholders.helpText'),
      DEFAULT_VALUE: t('placeholders.defaultValue'),
      PLACEHOLDER_TEXT: t('placeholders.placeholderText'),
      PREFIX_TEXT: t('placeholders.prefixText'),
      NO_MINIMUM: t('placeholders.noMinimum'),
      NO_MAXIMUM: t('placeholders.noMaximum'),
      MIN_PLACEHOLDER: t('placeholders.minPlaceholder'),
      MAX_PLACEHOLDER: t('placeholders.maxPlaceholder'),
      OPTION_PLACEHOLDER: (index: number) => t('placeholders.optionPlaceholder', { values: { index: index + 1 } }),
      SELECT_DEFAULT_OPTION: t('placeholders.selectDefaultOption'),
    },

    // Field type configurations (unchanged as they're not user-facing)
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

    // Input types (unchanged as they're not user-facing)
    INPUT_TYPES: {
      TEXT: 'text',
      EMAIL: 'email',
      NUMBER: 'number',
      DATE: 'date',
      CHECKBOX: 'checkbox',
    },

    // Special values (unchanged as they're not user-facing)
    SPECIAL_VALUES: {
      NONE_OPTION: '__none__',
      EMPTY_STRING: '',
    },

    // Section titles (translated)
    SECTION_TITLES: {
      BASIC_SETTINGS: t('sectionTitles.basicSettings'),
      VALIDATION: t('sectionTitles.validation'),
      OPTIONS: t('sectionTitles.options'),
      CHARACTER_LIMITS: t('sectionTitles.characterLimits'),
      NUMBER_RANGE: t('sectionTitles.numberRange'),
      DATE_RANGE: t('sectionTitles.dateRange'),
      PREFIX_SETTINGS: t('sectionTitles.prefixSettings'),
    },

    // Labels (translated)
    LABELS: {
      LABEL: t('labels.label'),
      HELP_TEXT: t('labels.helpText'),
      DEFAULT_VALUE: t('labels.defaultValue'),
      PLACEHOLDER: t('labels.placeholder'),
      PREFIX: t('labels.prefix'),
      REQUIRED_FIELD: t('labels.requiredField'),
      MINIMUM: t('labels.minimum'),
      MAXIMUM: t('labels.maximum'),
      MINIMUM_LENGTH: t('labels.minimumLength'),
      MAXIMUM_LENGTH: t('labels.maximumLength'),
      MINIMUM_DATE: t('labels.minimumDate'),
      MAXIMUM_DATE: t('labels.maximumDate'),
    },

    // Button texts (translated)
    BUTTONS: {
      ADD: t('buttons.add'),
      SAVE: t('buttons.save'),
      CANCEL: t('buttons.cancel'),
      RESET: t('buttons.reset'),
    },

    // Info messages (translated)
    INFO_MESSAGES: {
      NO_OPTIONS_AVAILABLE: t('infoMessages.noOptionsAvailable'),
      SELECTED_COUNT: (count: number) => t('infoMessages.selectedCount', { 
        values: { 
          count, 
          plural: count === 1 ? '' : t('infoMessages.selectedCountPlural')
        } 
      }),
      SELECT_FIELD_TO_EDIT: t('infoMessages.selectFieldToEdit'),
    },
  } as const;
};
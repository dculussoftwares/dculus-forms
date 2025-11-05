/**
 * Field Type Utilities
 *
 * Centralized utilities for working with form field types across the application.
 * This module provides icon mappings, display names, and type checking utilities.
 *
 * Usage:
 * ```typescript
 * import { getFieldTypeIcon, getFieldTypeDisplayName, FIELD_TYPE_ICONS } from '@dculus/utils';
 *
 * const Icon = getFieldTypeIcon('text_input_field');
 * const displayName = getFieldTypeDisplayName('text_input_field', t);
 * ```
 */

import { FieldType } from '@dculus/types';

// Note: Icons are exported for convenience but should be imported directly
// from lucide-react in components to enable tree-shaking
export {
  FileText,
  Hash,
  Mail,
  Calendar,
  ListOrdered,
  CheckSquare,
  CircleDot,
  BarChart3
} from 'lucide-react';

/**
 * Map of field types to their corresponding Lucide icon component names
 * Used for rendering field type indicators throughout the application
 */
export const FIELD_TYPE_ICON_MAP: Record<FieldType, string> = {
  [FieldType.TEXT_INPUT_FIELD]: 'FileText',
  [FieldType.TEXT_AREA_FIELD]: 'FileText',
  [FieldType.NUMBER_FIELD]: 'Hash',
  [FieldType.EMAIL_FIELD]: 'Mail',
  [FieldType.DATE_FIELD]: 'Calendar',
  [FieldType.SELECT_FIELD]: 'ListOrdered',
  [FieldType.RADIO_FIELD]: 'CircleDot',
  [FieldType.CHECKBOX_FIELD]: 'CheckSquare',
  [FieldType.RICH_TEXT_FIELD]: 'FileText',
  // Base types - fallback to generic icon
  [FieldType.TEXT]: 'BarChart3',
  [FieldType.FORM_FIELD]: 'BarChart3',
  [FieldType.FILLABLE_FORM_FIELD]: 'BarChart3',
  [FieldType.NON_FILLABLE_FORM_FIELD]: 'BarChart3',
  [FieldType.TEXT_FIELD_VALIDATION]: 'BarChart3',
  [FieldType.CHECKBOX_FIELD_VALIDATION]: 'BarChart3',
};

/**
 * Gets the icon component name for a given field type
 *
 * @param fieldType - The field type to get the icon for
 * @returns Icon component name as string
 *
 * @example
 * ```typescript
 * const iconName = getFieldTypeIconName(FieldType.TEXT_INPUT_FIELD); // 'FileText'
 * ```
 */
export const getFieldTypeIconName = (fieldType: string): string => {
  return FIELD_TYPE_ICON_MAP[fieldType as FieldType] || 'BarChart3';
};

/**
 * Translation key map for field type display names
 * Used with i18n translation functions to get localized field type names
 */
export const FIELD_TYPE_TRANSLATION_KEYS: Record<FieldType, string> = {
  [FieldType.TEXT_INPUT_FIELD]: 'fieldTypes.text_input_field',
  [FieldType.TEXT_AREA_FIELD]: 'fieldTypes.text_area_field',
  [FieldType.NUMBER_FIELD]: 'fieldTypes.number_field',
  [FieldType.EMAIL_FIELD]: 'fieldTypes.email_field',
  [FieldType.DATE_FIELD]: 'fieldTypes.date_field',
  [FieldType.SELECT_FIELD]: 'fieldTypes.select_field',
  [FieldType.RADIO_FIELD]: 'fieldTypes.radio_field',
  [FieldType.CHECKBOX_FIELD]: 'fieldTypes.checkbox_field',
  [FieldType.RICH_TEXT_FIELD]: 'fieldTypes.rich_text_field',
  // Base types
  [FieldType.TEXT]: 'fieldTypes.unknown',
  [FieldType.FORM_FIELD]: 'fieldTypes.unknown',
  [FieldType.FILLABLE_FORM_FIELD]: 'fieldTypes.unknown',
  [FieldType.NON_FILLABLE_FORM_FIELD]: 'fieldTypes.unknown',
  [FieldType.TEXT_FIELD_VALIDATION]: 'fieldTypes.unknown',
  [FieldType.CHECKBOX_FIELD_VALIDATION]: 'fieldTypes.unknown',
};

/**
 * Gets the localized display name for a field type
 *
 * @param fieldType - The field type to get the display name for
 * @param t - Translation function from useTranslation hook
 * @returns Localized display name string
 *
 * @example
 * ```typescript
 * const { t } = useTranslation('common');
 * const displayName = getFieldTypeDisplayName('text_input_field', t); // 'Short Text'
 * ```
 */
export const getFieldTypeDisplayName = (
  fieldType: string,
  t: (key: string) => string
): string => {
  const translationKey = FIELD_TYPE_TRANSLATION_KEYS[fieldType as FieldType];
  return translationKey ? t(translationKey) : t('fieldTypes.unknown');
};

/**
 * Checks if a field type is a fillable field (accepts user input)
 *
 * @param fieldType - The field type to check
 * @returns True if field accepts user input, false otherwise
 */
export const isFillableFieldType = (fieldType: string): boolean => {
  const fillableTypes = [
    FieldType.TEXT_INPUT_FIELD,
    FieldType.TEXT_AREA_FIELD,
    FieldType.NUMBER_FIELD,
    FieldType.EMAIL_FIELD,
    FieldType.DATE_FIELD,
    FieldType.SELECT_FIELD,
    FieldType.RADIO_FIELD,
    FieldType.CHECKBOX_FIELD,
  ];
  return fillableTypes.includes(fieldType as FieldType);
};

/**
 * Checks if a field type supports text content
 *
 * @param fieldType - The field type to check
 * @returns True if field contains text content, false otherwise
 */
export const isTextFieldType = (fieldType: string): boolean => {
  const textTypes = [
    FieldType.TEXT_INPUT_FIELD,
    FieldType.TEXT_AREA_FIELD,
    FieldType.EMAIL_FIELD,
  ];
  return textTypes.includes(fieldType as FieldType);
};

/**
 * Checks if a field type supports multiple selection
 *
 * @param fieldType - The field type to check
 * @returns True if field supports multiple selections, false otherwise
 */
export const isMultiSelectFieldType = (fieldType: string): boolean => {
  return fieldType === FieldType.CHECKBOX_FIELD;
};

/**
 * Checks if a field type has predefined options
 *
 * @param fieldType - The field type to check
 * @returns True if field has options array, false otherwise
 */
export const hasOptionsFieldType = (fieldType: string): boolean => {
  const optionTypes = [
    FieldType.SELECT_FIELD,
    FieldType.RADIO_FIELD,
    FieldType.CHECKBOX_FIELD,
  ];
  return optionTypes.includes(fieldType as FieldType);
};

/**
 * Gets all fillable field types
 * Useful for filtering or validation
 */
export const getAllFillableFieldTypes = (): FieldType[] => {
  return [
    FieldType.TEXT_INPUT_FIELD,
    FieldType.TEXT_AREA_FIELD,
    FieldType.NUMBER_FIELD,
    FieldType.EMAIL_FIELD,
    FieldType.DATE_FIELD,
    FieldType.SELECT_FIELD,
    FieldType.RADIO_FIELD,
    FieldType.CHECKBOX_FIELD,
  ];
};

/**
 * Gets all field types that support analytics
 * Used by analytics components to filter displayable fields
 */
export const getAnalyticsEnabledFieldTypes = (): FieldType[] => {
  return [
    FieldType.TEXT_INPUT_FIELD,
    FieldType.TEXT_AREA_FIELD,
    FieldType.NUMBER_FIELD,
    FieldType.EMAIL_FIELD,
    FieldType.DATE_FIELD,
    FieldType.SELECT_FIELD,
    FieldType.RADIO_FIELD,
    FieldType.CHECKBOX_FIELD,
  ];
};

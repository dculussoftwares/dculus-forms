/**
 * Field Value Formatters
 *
 * Centralized utilities for formatting form field values for display.
 * This module provides consistent formatting across responses, exports, and analytics.
 *
 * Usage:
 * ```typescript
 * import { formatFieldValue, formatDateFieldValue, formatCheckboxFieldValue } from '@dculus/utils';
 *
 * const displayValue = formatFieldValue(rawValue, FieldType.DATE_FIELD);
 * const dateString = formatDateFieldValue(timestamp);
 * ```
 */

import { FieldType } from '@dculus/types';

/**
 * Formats a timestamp into a localized date string
 *
 * @param value - Timestamp (number or string) or Date object
 * @param locale - Optional locale string (e.g., 'en-US', 'fr-FR')
 * @param options - Optional Intl.DateTimeFormatOptions
 * @returns Formatted date string or 'Invalid date' if parsing fails
 *
 * @example
 * ```typescript
 * formatDateFieldValue(1609459200000); // '1/1/2021' (depends on locale)
 * formatDateFieldValue('1609459200000', 'en-US'); // '1/1/2021'
 * formatDateFieldValue(new Date(2021, 0, 1)); // '1/1/2021'
 * ```
 */
export const formatDateFieldValue = (
  value: any,
  locale?: string,
  options?: Intl.DateTimeFormatOptions
): string => {
  if (value === null || value === undefined || value === '') return '';

  try {
    // Parse timestamp from various formats
    const timestamp = typeof value === 'string' ? parseInt(value, 10) : value;
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }

    // Use Intl.DateTimeFormat for locale-aware formatting
    return date.toLocaleDateString(locale, options);
  } catch (error) {
    return 'Invalid date';
  }
};

/**
 * Formats a checkbox field value (array) into a comma-separated string
 *
 * @param value - Array of selected values or single value
 * @param separator - Optional separator (default: ', ')
 * @returns Comma-separated string or empty string
 *
 * @example
 * ```typescript
 * formatCheckboxFieldValue(['Option 1', 'Option 2']); // 'Option 1, Option 2'
 * formatCheckboxFieldValue('Single Value'); // 'Single Value'
 * formatCheckboxFieldValue([]); // ''
 * ```
 */
export const formatCheckboxFieldValue = (
  value: any,
  separator: string = ', '
): string => {
  if (value === null || value === undefined) return '';

  if (Array.isArray(value)) {
    return value.filter(Boolean).join(separator);
  }

  return String(value);
};

/**
 * Formats a select field value (can be single or multiple)
 *
 * @param value - Selected value(s) - string or array
 * @param separator - Optional separator (default: ', ')
 * @returns Formatted string
 *
 * @example
 * ```typescript
 * formatSelectFieldValue('Option 1'); // 'Option 1'
 * formatSelectFieldValue(['Option 1', 'Option 2']); // 'Option 1, Option 2'
 * ```
 */
export const formatSelectFieldValue = (
  value: any,
  separator: string = ', '
): string => {
  if (value === null || value === undefined) return '';

  if (Array.isArray(value)) {
    return value.filter(Boolean).join(separator);
  }

  return String(value);
};

/**
 * Formats a number field value with optional precision and locale
 *
 * @param value - Numeric value to format
 * @param locale - Optional locale string
 * @param options - Optional Intl.NumberFormatOptions
 * @returns Formatted number string
 *
 * @example
 * ```typescript
 * formatNumberFieldValue(1234.567); // '1234.567'
 * formatNumberFieldValue(1234.567, 'en-US', { maximumFractionDigits: 2 }); // '1234.57'
 * formatNumberFieldValue(1234.567, 'de-DE'); // '1234,567'
 * ```
 */
export const formatNumberFieldValue = (
  value: any,
  locale?: string,
  options?: Intl.NumberFormatOptions
): string => {
  if (value === null || value === undefined || value === '') return '';

  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(numValue)) {
    return String(value);
  }

  // Use Intl.NumberFormat for locale-aware formatting
  if (locale || options) {
    return numValue.toLocaleString(locale, options);
  }

  return String(numValue);
};

/**
 * Formats an email field value (trims and lowercases)
 *
 * @param value - Email string
 * @returns Formatted email string
 *
 * @example
 * ```typescript
 * formatEmailFieldValue('  User@Example.COM  '); // 'user@example.com'
 * ```
 */
export const formatEmailFieldValue = (value: any): string => {
  if (value === null || value === undefined || value === '') return '';

  return String(value).trim().toLowerCase();
};

/**
 * Formats a text field value (trims whitespace)
 *
 * @param value - Text string
 * @param maxLength - Optional maximum length before truncation
 * @returns Formatted text string
 *
 * @example
 * ```typescript
 * formatTextFieldValue('  Hello World  '); // 'Hello World'
 * formatTextFieldValue('Very long text...', 10); // 'Very long ...'
 * ```
 */
export const formatTextFieldValue = (
  value: any,
  maxLength?: number
): string => {
  if (value === null || value === undefined || value === '') return '';

  const stringValue = String(value).trim();

  if (maxLength && stringValue.length > maxLength) {
    return stringValue.substring(0, maxLength - 3) + '...';
  }

  return stringValue;
};

/**
 * Generic field value formatter that automatically handles different field types
 *
 * @param value - Raw field value from response data
 * @param fieldType - FieldType enum value
 * @param options - Optional formatting options
 * @returns Formatted string ready for display
 *
 * @example
 * ```typescript
 * formatFieldValue(1609459200000, FieldType.DATE_FIELD); // '1/1/2021'
 * formatFieldValue(['A', 'B'], FieldType.CHECKBOX_FIELD); // 'A, B'
 * formatFieldValue('hello@example.com', FieldType.EMAIL_FIELD); // 'hello@example.com'
 * ```
 */
export const formatFieldValue = (
  value: any,
  fieldType: FieldType,
  options?: {
    locale?: string;
    separator?: string;
    maxLength?: number;
    dateOptions?: Intl.DateTimeFormatOptions;
    numberOptions?: Intl.NumberFormatOptions;
  }
): string => {
  // Handle null/undefined
  if (value === null || value === undefined) return '';

  switch (fieldType) {
    case FieldType.CHECKBOX_FIELD:
      return formatCheckboxFieldValue(value, options?.separator);

    case FieldType.DATE_FIELD:
      return formatDateFieldValue(value, options?.locale, options?.dateOptions);

    case FieldType.SELECT_FIELD:
      return formatSelectFieldValue(value, options?.separator);

    case FieldType.NUMBER_FIELD:
      return formatNumberFieldValue(
        value,
        options?.locale,
        options?.numberOptions
      );

    case FieldType.EMAIL_FIELD:
      return formatEmailFieldValue(value);

    case FieldType.TEXT_INPUT_FIELD:
    case FieldType.TEXT_AREA_FIELD:
      return formatTextFieldValue(value, options?.maxLength);

    case FieldType.RADIO_FIELD:
      return String(value);

    case FieldType.RICH_TEXT_FIELD:
      // For rich text, return raw HTML or strip tags based on context
      return String(value);

    default:
      return String(value);
  }
};

/**
 * Formats multiple field values at once for a response object
 *
 * @param responseData - Object containing field IDs and their values
 * @param fieldTypeMap - Map of field IDs to their FieldType values
 * @param options - Optional formatting options
 * @returns Object with formatted values
 *
 * @example
 * ```typescript
 * const formatted = formatResponseData(
 *   { field1: ['A', 'B'], field2: 1609459200000 },
 *   { field1: FieldType.CHECKBOX_FIELD, field2: FieldType.DATE_FIELD }
 * );
 * // { field1: 'A, B', field2: '1/1/2021' }
 * ```
 */
export const formatResponseData = (
  responseData: Record<string, any>,
  fieldTypeMap: Record<string, FieldType>,
  options?: {
    locale?: string;
    separator?: string;
    maxLength?: number;
  }
): Record<string, string> => {
  const formatted: Record<string, string> = {};

  Object.keys(responseData).forEach((fieldId) => {
    const value = responseData[fieldId];
    const fieldType = fieldTypeMap[fieldId];

    if (fieldType) {
      formatted[fieldId] = formatFieldValue(value, fieldType, options);
    } else {
      formatted[fieldId] = String(value || '');
    }
  });

  return formatted;
};

/**
 * Parses a formatted value back to its original format (useful for editing)
 *
 * @param formattedValue - Formatted string value
 * @param fieldType - FieldType enum value
 * @returns Parsed value in original format
 *
 * @example
 * ```typescript
 * parseFormattedValue('A, B', FieldType.CHECKBOX_FIELD); // ['A', 'B']
 * parseFormattedValue('1/1/2021', FieldType.DATE_FIELD); // Date object
 * ```
 */
export const parseFormattedValue = (
  formattedValue: string,
  fieldType: FieldType
): any => {
  if (formattedValue === null || formattedValue === undefined || formattedValue === '') {
    return null;
  }

  switch (fieldType) {
    case FieldType.CHECKBOX_FIELD:
    case FieldType.SELECT_FIELD:
      // Split comma-separated values back into array
      return formattedValue.split(',').map((v) => v.trim()).filter(Boolean);

    case FieldType.DATE_FIELD:
      // Parse date string back to Date object
      return new Date(formattedValue);

    case FieldType.NUMBER_FIELD:
      // Parse number from string
      const numValue = parseFloat(formattedValue);
      return isNaN(numValue) ? null : numValue;

    default:
      return formattedValue;
  }
};

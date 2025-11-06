/**
 * Analytics Component Registry
 *
 * Maps field types to their corresponding analytics components, data keys, and icons.
 * Provides a single source of truth for field analytics rendering.
 */

import { FieldType } from '@dculus/types';
import {
  FileText,
  Hash,
  Mail,
  Calendar,
  ListOrdered,
  CheckSquare,
  CircleDot,
  BarChart3
} from 'lucide-react';
import { TextFieldAnalytics } from '../TextFieldAnalytics';
import { NumberFieldAnalytics } from '../NumberFieldAnalytics';
import { SelectionFieldAnalytics } from '../SelectionFieldAnalytics';
import { CheckboxFieldAnalytics } from '../CheckboxFieldAnalytics';
import { DateFieldAnalytics } from '../DateFieldAnalytics';
import { EmailFieldAnalytics } from '../EmailFieldAnalytics';
import { AnalyticsRegistry } from './types';

/**
 * Analytics Component Registry
 *
 * This registry maps each supported field type to:
 * - component: The React component that renders the analytics
 * - dataKey: The key in FieldAnalyticsData that contains the data for this field type
 * - icon: The Lucide icon component to represent this field type
 */
export const analyticsRegistry: AnalyticsRegistry = {
  [FieldType.TEXT_INPUT_FIELD]: {
    component: TextFieldAnalytics,
    dataKey: 'textAnalytics',
    icon: FileText,
  },
  [FieldType.TEXT_AREA_FIELD]: {
    component: TextFieldAnalytics,
    dataKey: 'textAnalytics',
    icon: FileText,
  },
  [FieldType.NUMBER_FIELD]: {
    component: NumberFieldAnalytics,
    dataKey: 'numberAnalytics',
    icon: Hash,
  },
  [FieldType.SELECT_FIELD]: {
    component: SelectionFieldAnalytics,
    dataKey: 'selectionAnalytics',
    icon: ListOrdered,
  },
  [FieldType.RADIO_FIELD]: {
    component: SelectionFieldAnalytics,
    dataKey: 'selectionAnalytics',
    icon: CircleDot,
  },
  [FieldType.CHECKBOX_FIELD]: {
    component: CheckboxFieldAnalytics,
    dataKey: 'checkboxAnalytics',
    icon: CheckSquare,
  },
  [FieldType.DATE_FIELD]: {
    component: DateFieldAnalytics,
    dataKey: 'dateAnalytics',
    icon: Calendar,
  },
  [FieldType.EMAIL_FIELD]: {
    component: EmailFieldAnalytics,
    dataKey: 'emailAnalytics',
    icon: Mail,
  },
};

/**
 * Get analytics component for a field type
 *
 * @param fieldType - The field type to get the component for
 * @returns The analytics component or undefined if not supported
 */
export const getAnalyticsComponent = (fieldType: FieldType) => {
  return analyticsRegistry[fieldType]?.component;
};

/**
 * Get data key for a field type
 *
 * @param fieldType - The field type to get the data key for
 * @returns The data key or undefined if not supported
 */
export const getAnalyticsDataKey = (fieldType: FieldType) => {
  return analyticsRegistry[fieldType]?.dataKey;
};

/**
 * Get icon for a field type
 *
 * @param fieldType - The field type to get the icon for
 * @returns The icon component or default BarChart3 icon
 */
export const getAnalyticsIcon = (fieldType: FieldType) => {
  return analyticsRegistry[fieldType]?.icon || BarChart3;
};

/**
 * Check if field type has analytics support
 *
 * @param fieldType - The field type to check
 * @returns True if analytics are supported for this field type
 */
export const hasAnalyticsSupport = (fieldType: FieldType): boolean => {
  return fieldType in analyticsRegistry;
};

/**
 * Get all supported field types
 *
 * @returns Array of field types that have analytics support
 */
export const getSupportedFieldTypes = (): FieldType[] => {
  return Object.keys(analyticsRegistry) as FieldType[];
};

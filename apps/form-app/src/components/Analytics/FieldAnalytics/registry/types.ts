/**
 * Analytics Registry Type Definitions
 *
 * Type definitions for the field analytics component registry.
 */

import { FieldType } from '@dculus/types';
import { ComponentType } from 'react';
import {
  TextFieldAnalyticsData,
  NumberFieldAnalyticsData,
  SelectionFieldAnalyticsData,
  CheckboxFieldAnalyticsData,
  DateFieldAnalyticsData,
  EmailFieldAnalyticsData,
  FieldAnalyticsData,
} from '../../../../hooks/useFieldAnalytics';

/**
 * Base props that all field analytics components must accept
 */
export interface BaseFieldAnalyticsProps {
  fieldLabel: string;
  totalResponses: number;
  loading: boolean;
}

/**
 * Props for text field analytics
 */
export interface TextFieldAnalyticsProps extends BaseFieldAnalyticsProps {
  data: TextFieldAnalyticsData;
}

/**
 * Props for number field analytics
 */
export interface NumberFieldAnalyticsProps extends BaseFieldAnalyticsProps {
  data: NumberFieldAnalyticsData;
}

/**
 * Props for selection field analytics (select/radio)
 */
export interface SelectionFieldAnalyticsProps extends BaseFieldAnalyticsProps {
  data: SelectionFieldAnalyticsData;
  fieldType: 'select' | 'radio';
}

/**
 * Props for checkbox field analytics
 */
export interface CheckboxFieldAnalyticsProps extends BaseFieldAnalyticsProps {
  data: CheckboxFieldAnalyticsData;
}

/**
 * Props for date field analytics
 */
export interface DateFieldAnalyticsProps extends BaseFieldAnalyticsProps {
  data: DateFieldAnalyticsData;
}

/**
 * Props for email field analytics
 */
export interface EmailFieldAnalyticsProps extends BaseFieldAnalyticsProps {
  data: EmailFieldAnalyticsData;
}

/**
 * Union type of all possible analytics component props
 */
export type FieldAnalyticsComponentProps =
  | TextFieldAnalyticsProps
  | NumberFieldAnalyticsProps
  | SelectionFieldAnalyticsProps
  | CheckboxFieldAnalyticsProps
  | DateFieldAnalyticsProps
  | EmailFieldAnalyticsProps;

/**
 * Registry entry for a field type
 *
 * Contains the component to render, the data key to access in FieldAnalyticsData,
 * and the icon to display for this field type.
 */
export interface AnalyticsRegistryEntry {
  component: ComponentType<any>;
  dataKey: keyof FieldAnalyticsData;
  icon: ComponentType<{ className?: string }>;
}

/**
 * Complete analytics registry type
 *
 * Maps FieldType enum values to their analytics registry entries.
 */
export type AnalyticsRegistry = Partial<Record<FieldType, AnalyticsRegistryEntry>>;
